#!/bin/bash
# Run as root on the VM from an extracted release directory.
set -euo pipefail
if [ "$EUID" -ne 0 ]; then echo 'Run with sudo.' >&2; exit 1; fi
domain=${1:?Pass public domain}
version=${2:?Pass unique release version}
revision=${3:-}
root=${FSP_DEPLOY_ROOT:-/opt/fsp-career}
systemd_dir=${FSP_SYSTEMD_DIR:-/etc/systemd/system}
release=$(pwd)
previous=$(readlink -f "$root/current" || true)
if [ -f "$root/.env" ]; then cp -p "$root/.env" "$root/.env.rollback"; fi
rollback() {
 trap - ERR HUP INT TERM
 if [ -n "$previous" ] && [ -f "$root/.env.rollback" ]; then
  cp -p "$root/.env.rollback" "$root/.env"
  ln -sfn "$previous" "$root/current"
  (cd "$previous" && docker compose up -d --no-build --wait --wait-timeout 180) || true
 fi
 echo 'Release failed; inspect docker compose logs. Existing database was preserved.' >&2
}
trap rollback ERR
trap 'rollback; exit 1' HUP INT TERM
if [ -n "$previous" ]; then (cd "$previous" && bash deploy/backup.sh); fi
python3 deploy/init-env.py --file "$root/.env" --domain "$domain" --version "$version" --revision "$revision"
ln -sfn "$root/.env" .env
docker compose build app
docker compose run --rm --no-deps app node --input-type=module -e 'import {requireMail} from "./lib/mail.mjs"; requireMail();'
docker compose up -d --no-build --wait --wait-timeout 180
ln -sfn "$release" "$root/current"
chmod 750 deploy/backup.sh
cp deploy/fsp-backup.service deploy/fsp-backup.timer "$systemd_dir/"
cp deploy/fsp-mail.service deploy/fsp-mail.timer "$systemd_dir/"
systemctl daemon-reload
systemctl enable --now fsp-backup.timer
systemctl enable --now fsp-mail.timer
bash deploy/backup.sh
if [ -n "$previous" ] && [ "$previous" != "$release" ]; then
 echo "$previous" > "$root/previous-release"
fi
trap - ERR HUP INT TERM
echo "Release healthy: https://$domain"
