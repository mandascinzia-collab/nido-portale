#!/usr/bin/env bash
# Installazione del server dei dati (PocketBase + Caddy) su un server Hetzner con Ubuntu 24.04.
# Si esegue UNA SOLA VOLTA, da root:
#   bash install.sh NOME.duckdns.org indirizzo-email-amministratore URL-DEL-REPOSITORY-GITHUB
# Esempio:
#   bash install.sh nidoquartu.duckdns.org cinzia@esempio.it https://github.com/cemea/nido-portale.git
set -euo pipefail

DOMINIO="${1:-}"; EMAIL_ADMIN="${2:-}"; REPO="${3:-}"
PB_VERSIONE="0.40.6"
if [[ -z "$DOMINIO" || -z "$EMAIL_ADMIN" || -z "$REPO" ]]; then
  echo "Uso: bash install.sh NOME.duckdns.org email-amministratore URL-repository-GitHub"; exit 1
fi
if [[ $EUID -ne 0 ]]; then echo "Eseguire come root (sudo -i)."; exit 1; fi

echo "== 1/7 Aggiornamento del sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y unzip curl git ufw unattended-upgrades debian-keyring debian-archive-keyring apt-transport-https gpg openssl

echo "== 2/7 Aggiornamenti di sicurezza automatici e firewall"
dpkg-reconfigure -f noninteractive unattended-upgrades
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "== 3/7 Utente di servizio e cartelle"
id nido >/dev/null 2>&1 || useradd --system --home /opt/nido --shell /usr/sbin/nologin nido
mkdir -p /opt/nido /opt/nido/pb_data
if [[ ! -d /opt/nido-repo/.git ]]; then git clone "$REPO" /opt/nido-repo; fi
echo "$REPO" > /opt/nido/repo.url

echo "== 4/7 PocketBase $PB_VERSIONE"
cd /tmp
curl -fsSL -o pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSIONE}/pocketbase_${PB_VERSIONE}_linux_amd64.zip"
unzip -o -q pb.zip pocketbase -d /opt/nido
rm -f pb.zip
chmod +x /opt/nido/pocketbase
cp /opt/nido-repo/server/aggiorna.sh /usr/local/bin/nido-aggiorna
cp /opt/nido-repo/server/stato.sh /usr/local/bin/nido-stato
cp /opt/nido-repo/server/imposta-sito.sh /usr/local/bin/nido-imposta-sito
chmod +x /usr/local/bin/nido-aggiorna /usr/local/bin/nido-stato /usr/local/bin/nido-imposta-sito
/usr/local/bin/nido-aggiorna --solo-copia

chown -R nido:nido /opt/nido
echo "== 5/7 Account amministratore del server"
PASSWORD_ADMIN="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-20)"
runuser -u nido -- /opt/nido/pocketbase superuser upsert "$EMAIL_ADMIN" "$PASSWORD_ADMIN" \
  --dir=/opt/nido/pb_data --hooksDir=/opt/nido/pb_hooks --migrationsDir=/opt/nido/pb_migrations
umask 077
cat > /root/credenziali-nido.txt <<CRED
Pannello di amministrazione: https://$DOMINIO/_/
Email:    $EMAIL_ADMIN
Password: $PASSWORD_ADMIN
(Copia queste credenziali in un luogo sicuro, poi cancella questo file con: rm /root/credenziali-nido.txt)
CRED
umask 022

echo "== 6/7 Servizio PocketBase"
cat > /etc/nido.env <<ENV
# Indirizzo del sito dei genitori (Netlify). Si imposta dopo con: nido-imposta-sito https://NOME.netlify.app
NIDO_SITE_URL=
ENV
chmod 644 /etc/nido.env
cat > /etc/systemd/system/nido.service <<UNIT
[Unit]
Description=Portale Spazio gioco 0/6 (PocketBase)
After=network.target

[Service]
User=nido
Group=nido
WorkingDirectory=/opt/nido
EnvironmentFile=/etc/nido.env
ExecStart=/opt/nido/pocketbase serve --http=127.0.0.1:8090 --dir=/opt/nido/pb_data --hooksDir=/opt/nido/pb_hooks --migrationsDir=/opt/nido/pb_migrations
Restart=always
RestartSec=5
LimitNOFILE=4096
NoNewPrivileges=true
ProtectSystem=full
ReadWritePaths=/opt/nido

[Install]
WantedBy=multi-user.target
UNIT
chown -R nido:nido /opt/nido
systemctl daemon-reload
systemctl enable --now nido

echo "== 7/7 Caddy (indirizzo sicuro https automatico)"
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi
cat > /etc/caddy/Caddyfile <<CADDY
$DOMINIO {
	encode gzip
	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "same-origin"
	}
	reverse_proxy 127.0.0.1:8090
}
CADDY
systemctl reload caddy || systemctl restart caddy

echo
echo "Fatto. Il servizio è attivo."
echo "Credenziali del pannello: cat /root/credenziali-nido.txt"
echo "Prova: apri https://$DOMINIO/api/health  (deve comparire un messaggio con \"code\":200)"
