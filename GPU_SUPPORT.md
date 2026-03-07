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