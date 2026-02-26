"""
Serviço de Reconhecimento Facial.

Após cada segmento de gravação ser finalizado, este módulo:
1. Carrega os encodings faciais conhecidos de /recordings/faces/{id_pessoa}/
2. Extrai frames do vídeo gravado usando FFmpeg (compatibilidade garantida)
3. Detecta faces nos frames
4. Compara com faces conhecidas
5. Registra reconhecimentos na tabela 'reconhecimentos'
6. Para rostos desconhecidos com boa qualidade:
   - Cria automaticamente um registro "VISITANTE N" (ao_tipo='V')
   - Salva a imagem do rosto como face da nova pessoa
   - Registra o reconhecimento
"""

import os
import glob
import logging
import subprocess
import tempfile
import threading
import time
import traceback
from datetime import datetime

import cv2
import numpy as np

try:
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False

from app.config import settings

logger = logging.getLogger("face_recognition_service")

FACES_DIR = os.path.join(settings.RECORDINGS_PATH, "faces")

# Cache de encodings para evitar recalcular
_encodings_cache = {}
_encodings_cache_time = 0
CACHE_TTL = 60  # Recarrega encodings a cada 60 segundos

# Parâmetros de qualidade para auto-registro de visitantes
MIN_FACE_WIDTH = 20
MIN_FACE_HEIGHT = 20
MIN_SHARPNESS = 3.0
MIN_BRIGHTNESS = 15
MAX_BRIGHTNESS = 245
FACE_ASPECT_RATIO_MIN = 0.4
FACE_ASPECT_RATIO_MAX = 1.6
UNKNOWN_MATCH_TOLERANCE = 0.6

# Extração de frames via FFmpeg
FRAME_EXTRACT_INTERVAL = 2  # Extrair 1 frame a cada N segundos

# Escala de redução para processamento
# 0.25 era muito agressivo — rostos ficavam <20px, abaixo do limiar HOG.
# 0.5 mantém bom equilíbrio: 1080p → 960x540, rostos de ~30-60px.
FACE_DETECT_SCALE = 0.5

# Modelo de detecção: 'cnn' é MUITO mais preciso que 'hog' para câmeras de segurança.
# CNN detecta faces em ângulo, parcialmente ocluídas, distorcidas, etc.
# Detecta automaticamente se CNN está disponível (requer dlib com CUDA).
_DETECTION_MODEL = None  # Auto-detectado no primeiro uso


def _get_detection_model():
    """
    Auto-detecta o melhor modelo de detecção disponível.
    CNN é muito mais preciso para câmeras de segurança mas requer dlib com CUDA.
    Se não disponível, usa HOG (com upsample para compensar).
    """
    global _DETECTION_MODEL
    if _DETECTION_MODEL is not None:
        return _DETECTION_MODEL

    # Tenta usar CNN — detecta rostos em ângulo, parcialmente ocluídos, etc.
    try:
        import dlib
        if dlib.DLIB_USE_CUDA and dlib.cuda.get_num_devices() > 0:
            _DETECTION_MODEL = "cnn"
            logger.info("Modelo de detecção facial: CNN (GPU/CUDA)")
            return _DETECTION_MODEL
    except Exception:
        pass

    # CNN sem CUDA é muito lento, usar HOG com upsample
    _DETECTION_MODEL = "hog"
    logger.info("Modelo de detecção facial: HOG (CPU, upsample=2)")
    return _DETECTION_MODEL


# ===== CONTROLE DE CONCORRÊNCIA =====
# Semáforo para limitar processamento a MAX_CONCURRENT vídeos por vez
MAX_CONCURRENT = 2
_semaphore = threading.Semaphore(MAX_CONCURRENT)

# Fila de vídeos pendentes
_queue_lock = threading.Lock()
_pending_queue = []  # lista de (video_path, camera_id)
_queue_thread = None


def _load_known_encodings():
    """
    Carrega os encodings faciais de todas as pessoas cadastradas.
    Retorna: dict {id_pessoa: [list of face encodings]}
    """
    global _encodings_cache, _encodings_cache_time

    now = time.time()
    if _encodings_cache and (now - _encodings_cache_time) < CACHE_TTL:
        return _encodings_cache

    encodings = {}

    if not os.path.exists(FACES_DIR):
        logger.info(f"Diretório de faces não existe: {FACES_DIR}")
        return encodings

    for pessoa_id_str in os.listdir(FACES_DIR):
        pessoa_dir = os.path.join(FACES_DIR, pessoa_id_str)
        if not os.path.isdir(pessoa_dir):
            continue

        try:
            pessoa_id = int(pessoa_id_str)
        except ValueError:
            continue

        pessoa_encodings = []
        for img_file in os.listdir(pessoa_dir):
            if not img_file.lower().endswith(('.jpg', '.jpeg', '.png')):
                continue

            img_path = os.path.join(pessoa_dir, img_file)
            try:
                image = face_recognition.load_image_file(img_path)
                face_encs = face_recognition.face_encodings(image)
                if face_encs:
                    pessoa_encodings.append(face_encs[0])
            except Exception as e:
                logger.warning(f"Erro ao processar face {img_path}: {e}")
                continue

        if pessoa_encodings:
            encodings[pessoa_id] = pessoa_encodings
            logger.debug(f"Pessoa {pessoa_id}: {len(pessoa_encodings)} encoding(s) carregados")

    _encodings_cache = encodings
    _encodings_cache_time = now
    logger.info(f"Encodings faciais carregados: {len(encodings)} pessoas")
    return encodings


def _extract_frames_ffmpeg(video_path: str, output_dir: str):
    """
    Usa FFmpeg para extrair frames do vídeo a cada FRAME_EXTRACT_INTERVAL segundos.
    Aplica escala para manter aspecto correto e resolução consistente.
    """
    output_pattern = os.path.join(output_dir, "frame_%04d.jpg")

    # Escala para 1280px de largura mantendo aspect ratio,
    # e garante altura par (requisito de muitos codecs).
    # Isso elimina a distorção que câmeras com resolução não-padrão podem gerar.
    scale_filter = f"fps=1/{FRAME_EXTRACT_INTERVAL},scale=1280:-2"

    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vf", scale_filter,
        "-q:v", "2",
        output_pattern,
    ]

    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
            timeout=60,
        )

        if result.returncode != 0:
            logger.warning(f"FFmpeg retornou código {result.returncode} para {video_path}")

    except subprocess.TimeoutExpired:
        logger.error(f"FFmpeg timeout ao extrair frames de {video_path}")
        return []
    except Exception as e:
        logger.error(f"Erro ao executar FFmpeg: {e}")
        return []

    frames = sorted(glob.glob(os.path.join(output_dir, "frame_*.jpg")))
    return frames


def _assess_face_quality(frame_rgb, face_location):
    """Avalia a qualidade de uma face detectada."""
    top, right, bottom, left = face_location
    face_width = right - left
    face_height = bottom - top

    if face_width < MIN_FACE_WIDTH or face_height < MIN_FACE_HEIGHT:
        return False, f"pequeno ({face_width}x{face_height})"

    aspect_ratio = face_width / max(face_height, 1)
    if aspect_ratio < FACE_ASPECT_RATIO_MIN or aspect_ratio > FACE_ASPECT_RATIO_MAX:
        return False, f"proporção ({aspect_ratio:.2f})"

    h, w = frame_rgb.shape[:2]
    face_region = frame_rgb[max(0,top):min(h,bottom), max(0,left):min(w,right)]
    if face_region.size == 0:
        return False, "região vazia"

    gray = cv2.cvtColor(face_region, cv2.COLOR_RGB2GRAY)

    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    if laplacian_var < MIN_SHARPNESS:
        return False, f"borrado ({laplacian_var:.1f})"

    mean_brightness = np.mean(gray)
    if mean_brightness < MIN_BRIGHTNESS:
        return False, f"escuro ({mean_brightness:.0f})"
    if mean_brightness > MAX_BRIGHTNESS:
        return False, f"claro ({mean_brightness:.0f})"

    return True, "OK"


def _validate_face_landmarks(rgb_frame, face_locations):
    """
    Filtra detecções falsas verificando se o "rosto" detectado possui
    landmarks faciais reais (olhos, nariz, boca).
    
    O detector HOG gera muitos falsos positivos (pneus, texturas, etc).
    Esta função usa face_landmarks() para confirmar que é realmente um rosto.
    
    Returns:
        Lista de face_locations que passaram na validação.
    """
    if not face_locations:
        return []
    
    landmarks_list = face_recognition.face_landmarks(rgb_frame, face_locations)
    
    valid_locations = []
    for loc, landmarks in zip(face_locations, landmarks_list):
        # Um rosto real deve ter pelo menos: olhos + nariz + boca
        required_features = ['left_eye', 'right_eye', 'nose_bridge', 'top_lip']
        found = sum(1 for feat in required_features if feat in landmarks and len(landmarks[feat]) > 0)
        
        if found >= 3:  # Pelo menos 3 de 4 features
            valid_locations.append(loc)
        else:
            logger.debug(f"Falso positivo descartado - apenas {found}/4 landmarks encontrados")
    
    return valid_locations


def _extract_face_image(frame_bgr, face_location_small):
    """Extrai a imagem do rosto do frame original (alta resolução)."""
    scale = int(round(1.0 / FACE_DETECT_SCALE))
    top, right, bottom, left = face_location_small

    top *= scale
    right *= scale
    bottom *= scale
    left *= scale

    h_face = bottom - top
    w_face = right - left
    margin_h = int(h_face * 0.3)
    margin_w = int(w_face * 0.3)

    h_frame, w_frame = frame_bgr.shape[:2]
    top = max(0, top - margin_h)
    bottom = min(h_frame, bottom + margin_h)
    left = max(0, left - margin_w)
    right = min(w_frame, right + margin_w)

    face_img = frame_bgr[top:bottom, left:right]
    if face_img.size == 0:
        return None
    return face_img


def _get_next_visitor_number():
    """Determina o próximo número de visitante (VISITANTE N)."""
    from app.services.recorder import SyncSession
    from app.models import Pessoa

    session = SyncSession()
    try:
        visitantes = session.query(Pessoa).filter(
            Pessoa.no_pessoa.like("VISITANTE %")
        ).all()

        max_num = 0
        for v in visitantes:
            try:
                num = int(v.no_pessoa.replace("VISITANTE ", ""))
                if num > max_num:
                    max_num = num
            except ValueError:
                continue

        return max_num + 1
    finally:
        session.close()


def _create_visitor(face_encoding, face_image_bgr, camera_id, gravacao_id=None):
    """Cria um novo registro de visitante no banco e salva a imagem do rosto."""
    from app.services.recorder import SyncSession
    from app.models import Pessoa, Reconhecimento

    session = SyncSession()
    try:
        visitor_number = _get_next_visitor_number()
        visitor_name = f"VISITANTE {visitor_number}"

        nova_pessoa = Pessoa(
            no_pessoa=visitor_name,
            ao_tipo='V',
        )
        session.add(nova_pessoa)
        session.flush()

        pessoa_id = nova_pessoa.id_pessoa

        face_dir = os.path.join(FACES_DIR, str(pessoa_id))
        os.makedirs(face_dir, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        filename = f"face_{timestamp}.jpg"
        filepath = os.path.join(face_dir, filename)

        cv2.imwrite(filepath, face_image_bgr, [cv2.IMWRITE_JPEG_QUALITY, 90])

        rec = Reconhecimento(
            id_pessoa=pessoa_id,
            id_camera=camera_id,
            id_gravacao=gravacao_id,
            dt_registro=datetime.now(),
        )
        session.add(rec)
        session.commit()

        logger.info(
            f">>> NOVO VISITANTE: {visitor_name} "
            f"(ID: {pessoa_id}, câmera: {camera_id})"
        )

        invalidate_cache()
        return pessoa_id

    except Exception as e:
        session.rollback()
        logger.error(f"Erro ao criar visitante: {e}")
        return None
    finally:
        session.close()


def _save_additional_face(pessoa_id, face_image_bgr):
    """Salva uma imagem adicional de rosto (máx 5 por pessoa)."""
    face_dir = os.path.join(FACES_DIR, str(pessoa_id))

    if os.path.exists(face_dir):
        existing = [f for f in os.listdir(face_dir) if f.endswith(('.jpg', '.jpeg', '.png'))]
        if len(existing) >= 5:
            return

    os.makedirs(face_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"face_{timestamp}.jpg"
    filepath = os.path.join(face_dir, filename)

    cv2.imwrite(filepath, face_image_bgr, [cv2.IMWRITE_JPEG_QUALITY, 90])
    logger.debug(f"Face adicional salva para pessoa {pessoa_id}: {filename}")


def _save_recognition(pessoa_id: int, camera_id: int, gravacao_id: int = None):
    """Salva um reconhecimento facial no banco de dados."""
    from app.services.recorder import SyncSession
    from app.models import Reconhecimento

    session = SyncSession()
    try:
        rec = Reconhecimento(
            id_pessoa=pessoa_id,
            id_camera=camera_id,
            id_gravacao=gravacao_id,
            dt_registro=datetime.now(),
        )
        session.add(rec)
        session.commit()
        logger.info(f"Reconhecimento salvo: pessoa {pessoa_id}, câmera {camera_id}")
    except Exception as e:
        session.rollback()
        logger.error(f"Erro ao salvar reconhecimento: {e}")
    finally:
        session.close()


def process_video_for_faces(video_path: str, camera_id: int, gravacao_id: int = None):
    """
    Processa um arquivo de vídeo para detectar faces.
    Usa semáforo para limitar concorrência.
    """
    logger.info(f"[Cam {camera_id}] Aguardando slot para processar: {os.path.basename(video_path)}")

    # Aguarda um slot disponível (máx MAX_CONCURRENT simultâneos)
    _semaphore.acquire()
    try:
        _process_video_internal(video_path, camera_id, gravacao_id=gravacao_id)
    except Exception as e:
        logger.error(
            f"[Cam {camera_id}] ERRO FATAL no processamento: {e}\n"
            f"{traceback.format_exc()}"
        )
    finally:
        _semaphore.release()
        # Marca como analisado no banco
        if gravacao_id:
            _mark_as_analyzed(gravacao_id)


def _process_video_internal(video_path: str, camera_id: int, gravacao_id: int = None):
    """Lógica interna de processamento de vídeo."""

    if not FACE_RECOGNITION_AVAILABLE:
        logger.warning("Biblioteca face_recognition não disponível.")
        return

    if not os.path.exists(video_path):
        logger.warning(f"[Cam {camera_id}] Vídeo não encontrado: {video_path}")
        return

    known_encodings = _load_known_encodings()

    logger.info(f"[Cam {camera_id}] Iniciando processamento: {os.path.basename(video_path)}")

    with tempfile.TemporaryDirectory(prefix="face_frames_") as tmp_dir:
        frame_paths = _extract_frames_ffmpeg(video_path, tmp_dir)

        if not frame_paths:
            logger.warning(f"[Cam {camera_id}] Nenhum frame extraído")
            return

        logger.info(f"[Cam {camera_id}] {len(frame_paths)} frames extraídos")

        recognized_people = set()
        unknown_faces_in_video = []
        processed = 0
        new_visitors = 0
        total_faces_detected = 0

        for frame_idx, frame_path in enumerate(frame_paths):
            frame_name = os.path.basename(frame_path)

            frame_bgr = cv2.imread(frame_path)
            if frame_bgr is None:
                logger.warning(f"[Cam {camera_id}] Não foi possível ler: {frame_name}")
                continue

            processed += 1
            frame_original = frame_bgr.copy()

            # Reduz resolução para processamento (0.5x mantém rostos detectáveis)
            small_frame = cv2.resize(frame_bgr, (0, 0), fx=FACE_DETECT_SCALE, fy=FACE_DETECT_SCALE)
            rgb_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)

            logger.info(
                f"[Cam {camera_id}] Processando frame {frame_idx+1}/{len(frame_paths)} "
                f"({frame_name}) - resolução: {small_frame.shape[1]}x{small_frame.shape[0]}"
            )

            try:
                # Auto-detecta modelo na primeira execução
                detection_model = _get_detection_model()

                t0 = time.time()
                if detection_model == "cnn":
                    face_locations = face_recognition.face_locations(rgb_frame, model="cnn")
                else:
                    # HOG com upsample=2 para detectar rostos menores
                    face_locations = face_recognition.face_locations(
                        rgb_frame, model="hog", number_of_times_to_upsample=2
                    )
                t1 = time.time()

                logger.info(
                    f"[Cam {camera_id}] face_locations encontrou {len(face_locations)} candidato(s) "
                    f"em {t1-t0:.2f}s"
                )

                if not face_locations:
                    continue

                # Validar com landmarks (filtra falsos positivos: pneus, texturas, etc)
                t_lm0 = time.time()
                valid_locations = _validate_face_landmarks(rgb_frame, face_locations)
                t_lm1 = time.time()
                
                filtered_out = len(face_locations) - len(valid_locations)
                if filtered_out > 0:
                    logger.info(
                        f"[Cam {camera_id}] Landmarks: {len(valid_locations)} rostos reais, "
                        f"{filtered_out} falso(s) positivo(s) descartado(s) em {t_lm1-t_lm0:.2f}s"
                    )
                
                if not valid_locations:
                    continue

                face_encs = face_recognition.face_encodings(rgb_frame, valid_locations)
                t2 = time.time()

                logger.info(
                    f"[Cam {camera_id}] face_encodings calculou {len(face_encs)} encoding(s) "
                    f"em {t2-t_lm1:.2f}s"
                )

            except Exception as e:
                logger.error(f"[Cam {camera_id}] Erro na detecção de faces: {e}")
                continue

            total_faces_detected += len(valid_locations)

            for face_idx_inner, face_enc in enumerate(face_encs):
                face_loc = valid_locations[face_idx_inner]
                matched_known = False

                # ------- Compara com pessoas conhecidas -------
                for pessoa_id, known_encs in known_encodings.items():
                    if pessoa_id in recognized_people:
                        continue

                    matches = face_recognition.compare_faces(
                        known_encs, face_enc, tolerance=0.6
                    )

                    if any(matches):
                        face_distances = face_recognition.face_distance(known_encs, face_enc)
                        best_match_idx = np.argmin(face_distances)

                        if face_distances[best_match_idx] < 0.6:
                            recognized_people.add(pessoa_id)
                            matched_known = True
                            logger.info(
                                f"[Cam {camera_id}] MATCH: Pessoa {pessoa_id} "
                                f"(distância: {face_distances[best_match_idx]:.3f})"
                            )
                            _save_recognition(pessoa_id, camera_id, gravacao_id=gravacao_id)
                            break

                if matched_known:
                    continue

                # ------- Rosto desconhecido: avaliar qualidade -------
                is_good, reason = _assess_face_quality(rgb_frame, face_loc)
                if not is_good:
                    logger.info(f"[Cam {camera_id}] Rosto desconhecido descartado: {reason}")
                    continue

                logger.info(f"[Cam {camera_id}] Rosto desconhecido com boa qualidade detectado!")

                # Verifica se já foi visto neste vídeo
                already_seen_id = None
                for prev_enc, prev_pessoa_id in unknown_faces_in_video:
                    dist = face_recognition.face_distance([prev_enc], face_enc)[0]
                    if dist < UNKNOWN_MATCH_TOLERANCE:
                        already_seen_id = prev_pessoa_id
                        break

                if already_seen_id is not None:
                    logger.info(f"[Cam {camera_id}] Mesmo desconhecido já visto (pessoa {already_seen_id})")
                    _save_recognition(already_seen_id, camera_id, gravacao_id=gravacao_id)
                    face_img = _extract_face_image(frame_original, face_loc)
                    if face_img is not None:
                        _save_additional_face(already_seen_id, face_img)
                    continue

                # ------- Criar novo visitante -------
                face_img = _extract_face_image(frame_original, face_loc)
                if face_img is None:
                    logger.warning(f"[Cam {camera_id}] Falha ao extrair imagem do rosto")
                    continue

                new_pessoa_id = _create_visitor(face_enc, face_img, camera_id, gravacao_id=gravacao_id)
                if new_pessoa_id is not None:
                    unknown_faces_in_video.append((face_enc, new_pessoa_id))
                    recognized_people.add(new_pessoa_id)
                    new_visitors += 1

    logger.info(
        f"[Cam {camera_id}] === CONCLUÍDO === {os.path.basename(video_path)} | "
        f"{processed} frames | {total_faces_detected} rostos detectados | "
        f"{len(recognized_people)} reconhecidas | {new_visitors} novos visitantes"
    )


def process_video_async(video_path: str, camera_id: int, gravacao_id: int = None):
    """
    Inicia o processamento de vídeo em uma thread separada.
    Usa semáforo para limitar concorrência.
    """
    thread = threading.Thread(
        target=process_video_for_faces,
        args=(video_path, camera_id),
        kwargs={"gravacao_id": gravacao_id},
        daemon=True,
        name=f"face_rec_cam_{camera_id}",
    )
    thread.start()
    return thread


def _mark_as_analyzed(gravacao_id: int):
    """Marca uma gravação como analisada no banco."""
    from app.services.recorder import SyncSession
    from app.models import Gravacao

    session = SyncSession()
    try:
        gravacao = session.query(Gravacao).filter(Gravacao.id == gravacao_id).first()
        if gravacao:
            gravacao.face_analyzed = True
            session.commit()
            logger.info(f"Gravação {gravacao_id} marcada como analisada")
    except Exception as e:
        session.rollback()
        logger.error(f"Erro ao marcar gravação {gravacao_id} como analisada: {e}")
    finally:
        session.close()


def invalidate_cache():
    """Invalida o cache de encodings."""
    global _encodings_cache, _encodings_cache_time
    _encodings_cache = {}
    _encodings_cache_time = 0
    logger.info("Cache de encodings faciais invalidado")
