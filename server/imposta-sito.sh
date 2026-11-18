#!/usr/bin/env bash
# Imposta l'indirizzo del sito dei genitori (serve ai link nelle email). Uso: nido-imposta-sito https://NOME.netlify.app
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Eseguire come root."; exit 1; }
URL="${1:-}"
[[ "$URL" =~ ^https://[A-Za-z0-9.-]+(/)?$ ]] || { echo "Uso: nido-imposta-sito https://NOME.netlify.app"; exit 1; }
echo "NIDO_SITE_URL=${URL%/}" > /etc/nido.env
systemctl restart nido
echo "Impostato: ${URL%/}"
