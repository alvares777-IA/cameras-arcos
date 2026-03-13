# Como Habilitar Suporte a GPU no Projeto

Atualmente, o projeto está configurado para utilizar apenas **CPU e RAM**. Isso ocorre porque o `docker-compose.yml` não repassa a GPU para os contêineres e as imagens utilizadas (como `python:3.11-slim`) não possuem os drivers CUDA da Nvidia, fazendo com que bibliotecas de processamento visual (`dlib`, OpenCV) sejam compiladas apenas para CPU.

Para que a aplicação consiga utilizar uma GPU Nvidia no servidor, aliviando o processamento pesado e acelerando a detecção facial e o processamento de vídeos, é necessário realizar as seguintes adaptações:

## 1. Instalar Drivers Nvidia no Servidor Host
É essencial instalar o **NVIDIA Container Toolkit** no servidor onde o Docker está rodando, permitindo que a engine do Docker comunique-se com a placa de vídeo.

## 2. Atualizar o `docker-compose.yml`
Deve-se adicionar a permissão para os contêineres acessarem a placa de vídeo. No serviço `backend` (e possivelmente no `mediamtx`), adicionamos o seguinte bloco:

```yaml
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

## 3. Alterar o `Dockerfile` do Backend
As imagens base devem possuir suporte ao CUDA. Ao invés do `python:3.11-slim`, deve-se usar algo como `nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04` (ou similar) instalando o Python em seguida.
Isso garante que, ao instalar dependências como `dlib` (usado pelo `face_recognition`), ele seja compilado ativando o uso da GPU automaticamente.

## 4. Otimização de Vídeo no MediaMTX / FFmpeg
Caso haja conversão de vídeo, pode-se substituir os codecs padrão do FFmpeg pelos codecs de aceleração de hardware (por exemplo, `h264_nvenc`), transferindo o trabalho da CPU (processador) para a GPU (placa de vídeo).

---

## E se a máquina não tiver GPU? (Ex: Ambiente de Desenvolvimento)

Se você configurar o `docker-compose.yml` explicitamente para exigir a GPU (usando o bloco `driver: nvidia`) e a máquina local de desenvolvimento **não tiver uma placa de vídeo Nvidia**, o Docker **dará erro** e não iniciará os contêineres. O Docker acusará que não encontrou o dispositivo de hardware (`nvidia`) e bibliotecas como dlib tentariam rodar com instruções exclusivas de placa de vídeo, resultando em falha ao iniciar o processamento.

### É preciso ter 2 versões do projeto/código-fonte?
**Não precisamos de 2 versões do seu aplicativo / código-fonte!** 

A prática de mercado para resolver isso é lidar com tudo apenas na infraestrutura (Docker), separando os arquivos de ambiente sem tocar no código do seu app (em Python ou React). Fazemos isso da seguinte maneira:

1. **Dois arquivos Docker Compose:**
   - O `docker-compose.yml` atual continuaria sendo o de desenvolvimento (sem GPU).
   - Criaríamos um arquivo secundário, como `docker-compose.prod.yml` (ou similar), que adiciona as configurações de hardware da placa de vídeo e sobrescreve o arquivo normal na hora do *deploy* no servidor.

2. **No momento de gerar o contêiner (Dockerfile):**
   - Podemos usar múltiplos arquivos (ex: um `Dockerfile` padrão para os desenvolvedores e um `Dockerfile.gpu` para o pipeline de servidor).
   - Alternativamente, usaríamos *Build Arguments* no mesmo arquivo para decidir se o contêiner será gerado com suporte à placa de vídeo.

**Conclusão:**
O código em Python de detecção facial continua rigorosamente o mesmo. A biblioteca `face_recognition` (baseada em dlib) e o OpenCV decidem inteligentemente processar pela CPU ou GPU dependendo da forma como foram instalados. **Apenas dizemos ao Docker no servidor para instalar a versão "parruda" da biblioteca.**

Assim, o seu time de desenvolvimento pode programar na própria máquina sem estresse e, quando você subir a atualização para o servidor com placa de vídeo, a estrutura de produção vai usar a GPU automaticamente na potência máxima! Podemos aplicar essa divisão de ambientes futuramente quando for a hora.

ALTERAÇÕES NA ESTRUTURA PARA TENTAR RODAR COM MÁQUINA MENOR:
Sugestões de Performance para o Streaming
1. Reduzir câmeras simultâneas visíveis (maior impacto imediato)
Você já tem paginação com PER_PAGE_OPTIONS. O padrão atual é 4 câmeras por página. Considere reduzir para 1 ou 2 por padrão em máquinas fracas. Cada stream HLS abre conexões contínuas com o MediaMTX — menos streams = muito menos carga.

2. Ajustar parâmetros do HLS.js no HlsPlayer.jsx
Os valores atuais são agressivos para uma máquina fraca:

Parâmetro atual	Problema	Sugestão
lowLatencyMode: true	Aumenta polling e reconexões	false
maxBufferLength: 10	Buffer curto causa reconexões frequentes	20-30
backBufferLength: 30	Consome memória RAM	10
liveSyncDuration: 3	Muito próximo do edge, instável	5-8
liveMaxLatencyDuration: 10	Pode ser um pouco maior	15-20
Com lowLatencyMode: false e buffer maior, o player tolera melhor variações na entrega dos segmentos sem cair.

3. Aumentar o tamanho do segmento HLS no MediaMTX
Segmentos curtos (padrão do MediaMTX: 2s) geram mais requisições HTTP por segundo. Aumentar para 4–6 segundos reduz drasticamente o I/O e CPU do servidor. Isso é configurado no mediamtx.yml:


hlsSegmentDuration: 6s
hlsPartDuration: 1s
4. Desativar lowLatencyMode no MediaMTX (LL-HLS)
O LL-HLS usa partes de segmento (parts) com polling HTTP/2 push, pesado para máquinas fracas. Se não precisar de latência < 2s, desative:

O que é hlsVariant no MediaMTX
O MediaMTX suporta dois modos de entrega HLS:

Valor	Modo	Latência	Custo
fmp4	LL-HLS (Low Latency HLS)	~1–3s	Alto: usa "partes" de segmento, muito mais requisições HTTP por segundo
mpegts	HLS clássico	~5–15s	Baixo: uma requisição por segmento completo
Por que fmp4 pesa tanto
No modo fmp4 + LL-HLS, o browser faz requisições HTTP a cada parte de segmento (você configurou MTX_HLS_PART_DURATION=1s). Com 4 câmeras abertas, são ~4 requisições/segundo por câmera só para buscar partes, além das requisições do manifest. Em uma máquina fraca isso é significativo.

O que fazer
Se não precisar de latência baixa (< 3s), troque para mpegts:

Abra a rota Parâmetros
Encontre MTX_HLS_VARIANT
Mude o valor de fmp4 → mpegts
Ao salvar, o backend chama a API do MediaMTX e aplica sem precisar reiniciar o container.

Efeito colateral
Com mpegts, o parâmetro MTX_HLS_PART_DURATION deixa de ter efeito (partes são exclusivas do LL-HLS). O que passa a controlar a latência e o peso é somente MTX_HLS_SEGMENT_DURATION — que você já ajustou para 6s, o que é ótimo para máquina fraca.

Também mude no HLS.js
Junto com isso, mude o parâmetro HLS_LOW_LATENCY_MODE de false para... ele já está false pelo .env atual, então está correto — o cliente HLS.js já não está tentando usar LL-HLS do lado do browser.

Resumo: mude MTX_HLS_VARIANT de fmp4 para mpegts na tela de Parâmetros. Isso é a mudança mais impactante do tópico 4.


hlsVariant: fmp4   # ou mpegts, mais leve
5. Reduzir resolução/FPS das câmeras no MediaMTX (transcodificação)
Se as câmeras enviam 1080p/30fps, o MediaMTX pode retransmitir sem re-encode (o que já deve estar fazendo). Verifique se ffmpeg está sendo invocado com -vcodec copy — qualquer re-encode em máquina fraca é fatal.

6. Limitar reconexões automáticas no HlsPlayer.jsx
O MAX_AUTO_RETRIES = 5 com RETRY_DELAY_MS = 3000 pode causar tempestade de reconexões quando várias câmeras caem ao mesmo tempo. Sugestão: aumentar o delay com backoff exponencial (3s → 6s → 12s...) para não sobrecarregar o servidor quando ele já está sob pressão.

7. Lazy loading: só iniciar stream quando visível
Câmeras fora da viewport não deveriam reproduzir. Usar IntersectionObserver para pausar/destruir o HLS de players fora da tela e só inicializá-los quando ficarem visíveis.

Prioridade recomendada
#3 e #4 — lado servidor, maior impacto, sem alterar código React
#2 — ajuste rápido no HlsPlayer
#1 — orientar o usuário a usar menos câmeras por página
#6 e #7 — melhorias de resiliência e eficiência no frontend