"""
Serviço de gravação inteligente de câmeras IP com detecção de movimento.

Cada câmera roda uma thread que:
1. Lê frames a baixa resolução (160x120, 2 FPS) via FFmpeg para detecção de movimento
2. Quando movimento é detectado → inicia gravação FFmpeg (-c copy, sem re-encoding)
3. Continua gravando enquanto houver movimento (+ cooldown de 15s)
4. Para a gravação quando não há mais movimento
5. Segmenta gravações no máximo a cada SEGMENT_DURATION_SECONDS

Isso economiza disco e CPU significativamente em comparação com gravação contínua.
"""

import os
import signal
import threading
import time
import logging
import subprocess
from datetime import datetime

import numpy as np

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models import Gravacao, Camera

logger = logging.getLogger("recorder")

# ---- Sync DB engine (para uso em threads de background) ----
_sync_db_url = settings.DATABASE_URL.replace("+asyncpg", "").replace(
    "postgresql://", "postgresql+psycopg2://"
)
if "asyncpg" in _sync_db_url:
    _sync_db_url = _sync_db_url.replace("asyncpg", "psycopg2")

sync_engine = create_engine(_sync_db_url, pool_size=5)
SyncSession = sessionmaker(bind=sync_engine)

# ---- Parâmetros de detecção de movimento ----
MOTION_FPS = 2                  # FPS para análise de movimento
MOTION_WIDTH = 160              # Largura do frame para análise
MOTION_HEIGHT = 120             # Altura do frame para análise
MOTION_FRAME_SIZE = MOTION_WIDTH * MOTION_HEIGHT  # Bytes por frame (grayscale)
MOTION_THRESHOLD_PCT = 1.5      # % de pixels que devem mudar para considerar movimento
MOTION_PIXEL_THRESHOLD = 25     # Diferença mínima de intensidade por pixel (0-255)
MOTION_COOLDOWN = 15            # Segundos para continuar gravando após último movimento
MOTION_BLUR_KERNEL = 21         # Tamanho do kernel de blur para suavizar ruído


class CameraRecorder(threading.Thread):
    """Thread que gerencia detecção de movimento e gravação de uma câmera."""

    def __init__(self, camera_id: int, camera_nome: str, rtsp_url: str):
        super().__init__(daemon=True, name=f"recorder_cam_{camera_id}")
        self.camera_id = camera_id
        self.camera_nome = camera_nome
        self.rtsp_url = rtsp_url
        self.running = True

        # Processos FFmpeg
        self.motion_process = None   # FFmpeg para ler frames (detecção)
        self.recording_process = None  # FFmpeg para gravar (-c copy)

        # Estado de gravação
        self.is_recording = False
        self.last_motion_time = 0
        self.recording_start = None
        self.recording_path = None
        self.segment_start_time = 0

        # Estado de detecção
        self.prev_frame = None

    def stop(self):
        """Para todos os processos imediatamente (não-bloqueante)."""
        self.running = False

        # Mata o detector de movimento imediatamente
        if self.motion_process and self.motion_process.poll() is None:
            try:
                self.motion_process.kill()
            except Exception:
                pass

        # Mata a gravação imediatamente
        if self.recording_process and self.recording_process.poll() is None:
            try:
                self.recording_process.kill()
            except Exception:
                pass

        logger.info(f"[Cam {self.camera_id}] Stop sinalizado")

    def _start_motion_detector(self):
        """Inicia FFmpeg para ler frames a baixa resolução para detecção de movimento."""
        cmd = [
            "ffmpeg",
            "-rtsp_transport", "tcp",
            "-i", self.rtsp_url,
            "-f", "rawvideo",
            "-pix_fmt", "gray",       # Grayscale (1 byte/pixel)
            "-r", str(MOTION_FPS),     # FPS baixo
            "-vf", f"scale={MOTION_WIDTH}:{MOTION_HEIGHT}",
            "-an",                      # Sem áudio
            "-",                        # Saída para stdout
        ]

        self.motion_process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            bufsize=MOTION_FRAME_SIZE * 4,
        )
        self.prev_frame = None
        logger.info(f"[Cam {self.camera_id}] Detector de movimento iniciado")

    def _read_motion_frame(self):
        """Lê um frame do stream de detecção de movimento."""
        try:
            raw = self.motion_process.stdout.read(MOTION_FRAME_SIZE)
            if len(raw) != MOTION_FRAME_SIZE:
                return None
            return np.frombuffer(raw, dtype=np.uint8).reshape(
                (MOTION_HEIGHT, MOTION_WIDTH)
            )
        except Exception:
            return None

    def _detect_motion(self, current_frame):
        """
        Compara o frame atual com o anterior para detectar movimento.

        Usa diferença absoluta entre frames + threshold para identificar
        pixels que mudaram significativamente. Se a % de pixels alterados
        exceder MOTION_THRESHOLD_PCT, há movimento.
        """
        if self.prev_frame is None:
            self.prev_frame = current_frame
            return False

        # Calcula diferença absoluta
        delta = np.abs(
            current_frame.astype(np.int16) - self.prev_frame.astype(np.int16)
        )

        # Pixels que mudaram mais que o threshold
        changed = np.count_nonzero(delta > MOTION_PIXEL_THRESHOLD)
        total = current_frame.shape[0] * current_frame.shape[1]
        pct = (changed / total) * 100

        self.prev_frame = current_frame

        return pct > MOTION_THRESHOLD_PCT

    def _start_recording(self):
        """Inicia gravação FFmpeg com codec copy (sem re-encoding)."""
        self.recording_start = datetime.now()
        output_dir = self._get_output_dir(self.recording_start)
        filename = f"{self.recording_start.strftime('%Y%m%d_%H%M%S')}.mp4"
        self.recording_path = os.path.join(output_dir, filename)

        duration = settings.SEGMENT_DURATION_SECONDS

        command = [
            "ffmpeg", "-y",
            "-rtsp_transport", "tcp",
            "-i", self.rtsp_url,
            "-c", "copy",
            "-t", str(duration),
            "-movflags", "frag_keyframe+empty_moov+default_base_moof",
            self.recording_path,
        ]

        self.recording_process = subprocess.Popen(
            command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
        )

        self.is_recording = True
        self.segment_start_time = time.time()

        # Detecta modo para log personalizado
        try:
            from app.main import is_continuous_recording_active
            modo = "gravação contínua" if is_continuous_recording_active() else "movimento detectado"
        except Exception:
            modo = "movimento detectado"

        logger.info(
            f"[Cam {self.camera_id}] 🔴 Gravação iniciada ({modo}): "
            f"{filename}"
        )

    def _stop_recording(self):
        """Para a gravação graciosamente (SIGINT para FFmpeg finalizar o arquivo)."""
        if self.recording_process and self.recording_process.poll() is None:
            try:
                # SIGINT permite ao FFmpeg finalizar o moov atom do MP4
                self.recording_process.send_signal(signal.SIGINT)
            except Exception:
                pass
            # Espera o FFmpeg finalizar o arquivo
            try:
                self.recording_process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                # Se não finalizou em 10s, força o encerramento
                try:
                    self.recording_process.kill()
                    self.recording_process.wait(timeout=3)
                except Exception:
                    pass

        self._finalize_segment()
        self.is_recording = False

    def _finalize_segment(self):
        """Salva o segmento finalizado no banco e aciona reconhecimento facial."""
        # Guard contra dupla finalização
        path = self.recording_path
        start = self.recording_start
        self.recording_path = None
        self.recording_start = None

        if not path or not os.path.exists(path):
            return

        file_size = os.path.getsize(path)

        if file_size < 1000:
            # Arquivo muito pequeno, provavelmente corrompido
            try:
                os.remove(path)
            except Exception:
                pass
            return

        data_fim = datetime.now()
        self._save_to_db(path, start, data_fim)

    def _get_output_dir(self, dt: datetime) -> str:
        """Gera o diretório base: /recordings/{camera_id}/YYYY-MM-DD/"""
        dir_path = os.path.join(
            settings.RECORDINGS_PATH,
            str(self.camera_id),
            dt.strftime("%Y-%m-%d"),
        )
        os.makedirs(dir_path, exist_ok=True)
        return dir_path

    def run(self):
        """Loop principal: detecta movimento e gerencia gravação."""
        logger.info(
            f"[Cam {self.camera_id}] Iniciando monitoramento com detecção de movimento: "
            f"{self.camera_nome}"
        )

        while self.running:
            try:
                self._run_loop()
            except Exception as e:
                logger.error(f"[Cam {self.camera_id}] Erro no loop principal: {e}")
                time.sleep(5)

        # Cleanup ao parar
        if self.is_recording:
            self._stop_recording()
        if self.motion_process and self.motion_process.poll() is None:
            self.motion_process.terminate()

    def _run_loop(self):
        """Loop interno de detecção de movimento e gravação."""
        consecutive_failures = 0

        while self.running:
            from app.main import is_continuous_recording_active
            is_continuous = is_continuous_recording_active()

            if is_continuous:
                # Se está gravando contínuo, para o detector de movimento
                if self.motion_process:
                    self.motion_process.terminate()
                    self.motion_process = None
                
                if not self.is_recording:
                    self._start_recording()
                
                if self.is_recording:
                    if self.recording_process and self.recording_process.poll() is not None:
                        self._finalize_segment()
                        self._start_recording() # Inicia novo segmento imediatamente
                
                time.sleep(1)
                continue

            # --- MODO MOVIMENTO ---
            if self.motion_process is None:
                self._start_motion_detector()
                consecutive_failures = 0

            frame = self._read_motion_frame()

            if frame is None:
                consecutive_failures += 1
                if consecutive_failures > 10:
                    logger.warning(
                        f"[Cam {self.camera_id}] Stream de detecção caiu, reiniciando..."
                    )
                    if self.motion_process:
                        self.motion_process.terminate()
                    time.sleep(3)
                    self._start_motion_detector()
                    consecutive_failures = 0
                continue

            consecutive_failures = 0
            has_motion = self._detect_motion(frame)

            if has_motion:
                self.last_motion_time = time.time()

                if not self.is_recording:
                    # INÍCIO: movimento detectado, começar a gravar
                    self._start_recording()

            # Verificações do estado de gravação
            if self.is_recording:
                now = time.time()
                time_since_motion = now - self.last_motion_time

                # Verificar se o segmento FFmpeg terminou (atingiu duração máxima)
                if self.recording_process and self.recording_process.poll() is not None:
                    self._finalize_segment()

                    if time_since_motion < MOTION_COOLDOWN:
                        # Ainda há movimento recente, iniciar novo segmento
                        logger.info(
                            f"[Cam {self.camera_id}] Segmento concluído, "
                            f"iniciando novo (movimento ativo)"
                        )
                        self._start_recording()
                    else:
                        # Sem movimento, não iniciar novo segmento
                        self.is_recording = False
                        logger.info(
                            f"[Cam {self.camera_id}] ⬛ Gravação parada "
                            f"(sem movimento por {time_since_motion:.0f}s)"
                        )

                elif time_since_motion >= MOTION_COOLDOWN:
                    # Cooldown expirou durante um segmento, parar a gravação
                    logger.info(
                        f"[Cam {self.camera_id}] ⬛ Sem movimento por "
                        f"{MOTION_COOLDOWN}s, parando gravação"
                    )
                    self._stop_recording()

    def _save_to_db(self, path, inicio, fim):
        """Salva o segmento no banco de dados e aciona reconhecimento facial."""
        session = SyncSession()
        try:
            file_size = os.path.getsize(path)
            gravacao = Gravacao(
                id_camera=self.camera_id,
                caminho_arquivo=path,
                data_inicio=inicio,
                data_fim=fim,
                tamanho_bytes=file_size,
            )
            session.add(gravacao)
            session.commit()

            duration_secs = (fim - inicio).total_seconds()
            logger.info(
                f"[Cam {self.camera_id}] Segmento salvo: {os.path.basename(path)} "
                f"({file_size/1024/1024:.1f} MB, {duration_secs:.0f}s)"
            )

            # Processar reconhecimento facial em background (apenas se ativo)
            try:
                from app.main import is_face_recognition_active
                if is_face_recognition_active():
                    from app.services.face_recognition_service import process_video_async
                    process_video_async(path, self.camera_id, gravacao_id=gravacao.id)
                else:
                    logger.debug(
                        f"[Cam {self.camera_id}] Reconhecimento facial desativado, pulando análise"
                    )
            except Exception as e:
                logger.warning(
                    f"[Cam {self.camera_id}] Erro ao iniciar reconhecimento facial: {e}"
                )

        except Exception as e:
            session.rollback()
            logger.error(f"[Cam {self.camera_id}] Erro ao salvar no banco: {e}")
        finally:
            session.close()


class RecordingManager:
    """Gerencia as threads de gravação com detecção de movimento."""

    def __init__(self):
        self.recorders: dict[int, CameraRecorder] = {}

    def start_all(self):
        session = SyncSession()
        try:
            cameras = session.query(Camera).filter(Camera.habilitada == True).all()
            for cam in cameras:
                self.start_camera(cam.id, cam.nome, cam.rtsp_url)
        finally:
            session.close()

    def start_camera(self, camera_id: int, nome: str, rtsp_url: str):
        if camera_id in self.recorders:
            return
        recorder = CameraRecorder(camera_id, nome, rtsp_url)
        self.recorders[camera_id] = recorder
        recorder.start()

    def stop_camera(self, camera_id: int):
        recorder = self.recorders.pop(camera_id, None)
        if recorder:
            recorder.stop()

    def stop_all(self):
        for cam_id in list(self.recorders.keys()):
            self.stop_camera(cam_id)

    def is_active(self) -> bool:
        return any(rec.is_alive() for rec in self.recorders.values())

    def get_status(self) -> dict:
        return {
            cam_id: {
                "nome": rec.camera_nome,
                "running": rec.is_alive(),
                "recording": rec.is_recording,
            }
            for cam_id, rec in self.recorders.items()
        }


recording_manager = RecordingManager()
