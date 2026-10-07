#!/bin/bash
set -euo pipefail
cd /opt/fsp-career/current
install -d -m 0700 /var/backups/fsp-career
backup="/var/backups/fsp-career/fsp-$(date -u +%Y%m%dT%H%M%SZ).dump"
umask 077
docker compose exec -T postgres pg_dump -U fsp -d fsp -Fc > "$backup.tmp"
test -s "$backup.tmp"
mv "$backup.tmp" "$backup"
docker compose exec -T postgres psql -U fsp -d fsp -c "DELETE FROM auth_sessions WHERE expires < (extract(epoch from now()) * 1000)::bigint; DELETE FROM auth_rate_limits WHERE expires < (extract(epoch from now()) * 1000)::bigint;" > /dev/null
find /var/backups/fsp-career -name 'fsp-*.dump' -mtime +7 -delete
# Optional off-VM copy; no credentials are embedded in this script.
if [ -f /etc/fsp-career-backup-bucket ]; then
  gcloud storage cp "$backup" "$(cat /etc/fsp-career-backup-bucket)/$(basename "$backup")" --quiet
fi
