#!/bin/bash
# Caminhos
FILE1="$HOME/cameras-arcos/.env"
FILE2="$HOME/cameras-arcos/mediamtx.yml"
FILE3="$HOME/cameras-arcos/backend/app/services/mediamtx_client.py"
CHECKSUM_FILE1="$HOME/cameras-arcos/.env.md5"
CHECKSUM_FILE2="$HOME/cameras-arcos/mediamtx.yml.md5"
CHECKSUM_FILE3="$HOME/cameras-arcos/backend/app/services/mediamtx_client.py.md5"
PROJECT_DIR="$HOME/cameras-arcos"

# Gera o hash atual
CURRENT_HASH1=$(md5sum "$FILE1" | awk '{print $1}')
CURRENT_HASH2=$(md5sum "$FILE2" | awk '{print $1}')
CURRENT_HASH3=$(md5sum "$FILE3" | awk '{print $1}')

# Verifica se o arquivo de checksum existe
if [ -f "$CHECKSUM_FILE1" ]; then
    OLD_HASH1=$(cat "$CHECKSUM_FILE1")

    # Compara os hashes
    if [ "$CURRENT_HASH1" != "$OLD_HASH1" ]; then
        echo "Alteração detectada no $FILE1 Reiniciando Docker..."
        cd "$PROJECT_DIR" && docker compose down -v && docker compose up -d --build
        # Atualiza o hash para a próxima verificação
        echo "$CURRENT_HASH1" > "$CHECKSUM_FILE1"
    fi
else
    # Se for a primeira vez, apenas cria o registro do hash
    echo "$CURRENT_HASH1" > "$CHECKSUM_FILE1"
fi

if [ -f "$CHECKSUM_FILE2" ]; then
    OLD_HASH2=$(cat "$CHECKSUM_FILE2")

    # Compara os hashes
    if [ "$CURRENT_HASH2" != "$OLD_HASH2" ]; then
        echo "Alteração detectada no $FILE2 Reiniciando Docker..."
        cd "$PROJECT_DIR" && docker compose down -v && docker compose up -d --build
        # Atualiza o hash para a próxima verificação
        echo "$CURRENT_HASH2" > "$CHECKSUM_FILE2"
    fi
else
    # Se for a primeira vez, apenas cria o registro do hash
    echo "$CURRENT_HASH2" > "$CHECKSUM_FILE2"
fi


if [ -f "$CHECKSUM_FILE3" ]; then
    OLD_HASH3=$(cat "$CHECKSUM_FILE3")

    # Compara os hashes
    if [ "$CURRENT_HASH3" != "$OLD_HASH3" ]; then
        echo "Alteração detectada no $FILE3 Reiniciando Docker..."
        cd "$PROJECT_DIR" && docker compose down -v && docker compose up -d --build
        # Atualiza o hash para a próxima verificação
        echo "$CURRENT_HASH3" > "$CHECKSUM_FILE3"
    fi
else
    # Se for a primeira vez, apenas cria o registro do hash
    echo "$CURRENT_HASH3" > "$CHECKSUM_FILE3"
fi


