#!/usr/bin/env bash
# Controllo rapido (da fare una volta al mese): servizio, spazio su disco, copie di sicurezza, aggiornamenti.
set -uo pipefail
echo "== Servizio";            systemctl is-active nido caddy
echo; echo "== Risposta del server"; curl -s http://127.0.0.1:8090/api/health || echo "NON risponde"
echo; echo; echo "== Spazio su disco"; df -h / | tail -1
echo; echo "== Copie di sicurezza (ultime 3)"
ls -lt /opt/nido/pb_data/backups 2>/dev/null | head -4 || echo "nessuna ancora"
echo; echo "== Aggiornamenti di sistema in attesa"
apt list --upgradable 2>/dev/null | tail -n +2 | wc -l
[[ -f /var/run/reboot-required ]] && echo "ATTENZIONE: serve un riavvio del server (reboot)"
echo; echo "== Dimensione dei dati"; du -sh /opt/nido/pb_data | cut -f1
