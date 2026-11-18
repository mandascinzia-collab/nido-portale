#!/usr/bin/env bash
# Aggiorna le regole del server con l'ultima versione presente su GitHub e riavvia il servizio.
# Uso: nido-aggiorna            (scarica da GitHub, copia, riavvia)
#      nido-aggiorna --solo-copia (usato dall'installazione)
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Eseguire come root."; exit 1; }
if [[ "${1:-}" != "--solo-copia" ]]; then
  git -C /opt/nido-repo pull --ff-only
fi
rm -rf /opt/nido/pb_hooks /opt/nido/pb_migrations
cp -r /opt/nido-repo/pocketbase/pb_hooks /opt/nido/pb_hooks
cp -r /opt/nido-repo/pocketbase/pb_migrations /opt/nido/pb_migrations
chown -R nido:nido /opt/nido/pb_hooks /opt/nido/pb_migrations
if [[ "${1:-}" != "--solo-copia" ]]; then
  systemctl restart nido
  sleep 2
  systemctl is-active nido && echo "Server aggiornato e riavviato."
fi
