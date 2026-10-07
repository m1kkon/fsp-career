#!/bin/bash
# Installed once as /opt/fsp-career/bin/deploy-archive; called by GitHub via IAP.
set -euo pipefail
if [ "$EUID" -ne 0 ]; then echo 'Run with sudo.' >&2; exit 1; fi
revision=${1:?Pass commit SHA}
run=${2:?Pass workflow run ID}
attempt=${3:?Pass workflow attempt}
[[ "$revision" =~ ^[a-f0-9]{40}$ && "$run" =~ ^[0-9]+$ && "$attempt" =~ ^[0-9]+$ ]] || exit 2
exec 9>/opt/fsp-career/deploy.lock
flock -w 1200 9
version="main-$revision-$run-$attempt"
archive="/tmp/fsp-$revision-$run-$attempt.tar.gz"
release="/opt/fsp-career/releases/$version"
test -f "$archive"
install -d -m 0750 "$release"
tar --no-same-owner --no-same-permissions -xzf "$archive" -C "$release"
cd "$release"
bash deploy/release.sh fspcareer.space "$version" "$revision"
# Keep the dispatcher aligned with the successfully deployed source.
install -m 0750 deploy/deploy-archive.sh /opt/fsp-career/bin/deploy-archive
unlink "$archive"
# CI image tags are unique. Retain five releases, always preserving rollback.
python3 - <<'PY'
from pathlib import Path
import re
import shutil
import subprocess
root = Path('/opt/fsp-career')
current = (root/'current').resolve()
previous_file = root/'previous-release'
previous = Path(previous_file.read_text().strip()) if previous_file.exists() else current
releases = sorted((p for p in (root/'releases').glob('main-*') if re.fullmatch(r'main-[a-f0-9]{40}-[0-9]+-[0-9]+', p.name)), key=lambda p:p.stat().st_mtime, reverse=True)
for release in releases[5:]:
    if release in (current, previous):
        continue
    result = subprocess.run(['docker','image','rm','fsp-career:'+release.name], capture_output=True)
    if result.returncode == 0:
        shutil.rmtree(release)
PY
docker builder prune --force --keep-storage 2GB > /dev/null || true
