#!/usr/bin/env python3
"""Create/update a private deployment env file without printing credentials."""
import argparse
import os
from pathlib import Path
import re
import secrets

parser = argparse.ArgumentParser()
parser.add_argument('--domain', required=True)
parser.add_argument('--version', required=True)
parser.add_argument('--file', default='/opt/fsp-career/.env')
args = parser.parse_args()
if not re.fullmatch(r'[a-z0-9.-]+', args.domain) or not re.fullmatch(r'[a-zA-Z0-9_.-]+', args.version):
    raise SystemExit('Invalid domain/version')
target = Path(args.file)
values = dict(line.split('=', 1) for line in target.read_text().splitlines() if '=' in line) if target.exists() else {}
aliases = {f'www.{args.domain}'}
previous_domain = values.get('SITE_DOMAIN')
if previous_domain and previous_domain != args.domain:
    aliases.add(previous_domain)
for alias in values.get('SITE_REDIRECT_DOMAINS', '').split(','):
    alias = alias.strip()
    if alias and alias != args.domain:
        aliases.add(alias)
if any(not re.fullmatch(r'[a-z0-9.-]+', alias) for alias in aliases):
    raise SystemExit('Invalid redirect domain')
redirect_domains = ', '.join(sorted(aliases))
password = values.get('POSTGRES_PASSWORD') or secrets.token_hex(32)
if not re.fullmatch(r'[a-f0-9]{64}', password):
    raise SystemExit('Expected a generated URL-safe database password')
mail_key = values.get('MAIL_TOKEN_KEY') or secrets.token_hex(32)
if not re.fullmatch(r'[a-f0-9]{64}', mail_key):
    raise SystemExit('Invalid mail encryption key')
mail_values = {'MAIL_TOKEN_KEY': mail_key, 'RESEND_API_KEY': values.get('RESEND_API_KEY', ''), 'EMAIL_FROM': values.get('EMAIL_FROM') or f'ФСП Карьера <no-reply@{args.domain}>'}
if any('\n' in value or '\r' in value for value in mail_values.values()):
    raise SystemExit('Invalid mail setting')
target.parent.mkdir(parents=True, exist_ok=True)
temporary = target.with_suffix('.tmp')
fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, 'w') as stream:
    stream.write(f'POSTGRES_PASSWORD={password}\nSITE_DOMAIN={args.domain}\nAPP_VERSION={args.version}\nSITE_REDIRECT_DOMAINS={redirect_domains}\n')
    for key, value in mail_values.items():
        stream.write(f'{key}={value}\n')
os.chmod(temporary, 0o600)
os.replace(temporary, target)
print('Deployment environment saved; database password preserved/generated.')
