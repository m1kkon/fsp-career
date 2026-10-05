#!/bin/bash
# Run as root on the VM from an extracted release directory.
set -euo pipefail
if [ "$EUID" -ne 0 ]; then echo 'Run with sudo.' >&2; exit 1; fi
domain=${1:?Pass public domain}
version=${2:?Pass unique release version}
release=$(pwd)
previous=$(readlink -f /opt/fsp-career/current || true)
if [ -f /opt/fsp-career/.env ]; then cp -p /opt/fsp-career/.env /opt/fsp-career/.env.rollback; fi
rollback() {
 if [ -n "$previous" ] && [ -f /opt/fsp-career/.env.rollback ]; then
  cp -p /opt/fsp-career/.env.rollback /opt/fsp-career/.env
  (cd "$previous" && docker compose up -d --no-build --wait --wait-timeout 180) || true
 fi
 echo 'Release failed; inspect docker compose logs. Existing database was preserved.' >&2
}
trap rollback ERR
python3 deploy/init-env.py --domain "$domain" --version "$version"
ln -sfn /opt/fsp-career/.env .env
docker compose build
docker compose up -d --wait --wait-timeout 180
trap - ERR
ln -sfn "$release" /opt/fsp-career/current
if [ -n "$previous" ] && [ "$previous" != "$release" ]; then
 echo "$previous" > /opt/fsp-career/previous-release
fi
chmod 750 deploy/backup.sh
cp deploy/fsp-backup.service deploy/fsp-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now fsp-backup.timer
./deploy/backup.sh
echo "Release healthy: https://$domain"
