#!/usr/bin/env python3
"""Install a Resend key from stdin into the root-only deployment env."""
import argparse
import os
from pathlib import Path
import re
import secrets
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--file', default='/opt/fsp-career/.env')
args = parser.parse_args()
key = sys.stdin.read().strip()
if not re.fullmatch(r're_[A-Za-z0-9_\-]{16,200}', key):
    raise SystemExit('Invalid Resend key format')
target = Path(args.file)
values = dict(line.split('=', 1) for line in target.read_text().splitlines() if '=' in line)
domain = values.get('SITE_DOMAIN', '')
if not re.fullmatch(r'[a-z0-9.-]+', domain):
    raise SystemExit('Configure the deployment domain first')
values.update(RESEND_API_KEY=key,
              MAIL_TOKEN_KEY=values.get('MAIL_TOKEN_KEY') or secrets.token_hex(32),
              EMAIL_FROM=f'ФСП Карьера <no-reply@{domain}>')
temporary = target.with_suffix('.mail.tmp')
fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as stream:
    for name, value in values.items():
        stream.write(f'{name}={value}\n')
os.replace(temporary, target)
print('Mail configuration saved privately; existing credentials preserved.')
