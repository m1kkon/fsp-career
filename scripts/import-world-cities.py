"""Build the checked-in GeoNames snapshot; never downloads data at app startup.

Inputs: cities15000.zip, alternateNamesV2.zip, countryInfo.txt and admin1CodesASCII.txt from
https://download.geonames.org/export/dump/ (CC BY 4.0).
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cities-zip', type=Path, required=True)
parser.add_argument('--alternate-names-zip', type=Path, required=True)
parser.add_argument('--admin1-file', type=Path, required=True)
parser.add_argument('--country-info-file', type=Path, required=True)
parser.add_argument('--snapshot-date', required=True)
parser.add_argument('--output', type=Path, default=Path('public/world-city-data.mjs'))
args = parser.parse_args()

codes = {'PPL', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPLA5', 'PPLC', 'PPLG'}
with zipfile.ZipFile(args.cities_zip) as archive:
    records = [line.split('\t') for line in archive.read('cities15000.txt').decode('utf-8').splitlines()]
cities = {row[0]: row for row in records if row[6] == 'P' and row[7] in codes and len(row[8]) == 2}
languages = {}
for line in args.country_info_file.read_text().splitlines():
    if not line or line.startswith('#'):
        continue
    row = line.split('\t')
    languages[row[0]] = {'ru', 'en', *(language.split('-')[0] for language in row[15].split(','))}
names = {key: {'ru': [], 'en': [], 'native': []} for key in cities}
with zipfile.ZipFile(args.alternate_names_zip) as archive:
    with io.TextIOWrapper(archive.open('alternateNamesV2.txt'), encoding='utf-8') as source:
        for line in source:
            row = line.rstrip('\n').split('\t')
            if row[1] not in cities or row[2] not in languages.get(cities[row[1]][8], {'ru', 'en'}) or row[7] == '1':
                continue
            if not 0 < len(row[3]) <= 80:
                continue
            # Official and short current names precede other variants.
            score = (row[4] == '1', row[5] == '1', row[6] != '1')
            names[row[1]][row[2] if row[2] in {'ru', 'en'} else 'native'].append((score, row[3]))
admins = {row[0]: row[1] for row in (line.split('\t') for line in args.admin1_file.read_text().splitlines())}
world, russian = [], []
for key, row in cities.items():
    ru = [name for _, name in sorted(names[key]['ru'], key=lambda item: item[0], reverse=True)]
    en = [name for _, name in sorted(names[key]['en'], key=lambda item: item[0], reverse=True)]
    native = [name for _, name in sorted(names[key]['native'], key=lambda item: item[0], reverse=True)]
    display = (ru or en or [row[1]])[0]
    if len(display) > 80:
        continue
    aliases = list(dict.fromkeys([display, row[1], row[2], *ru, *en, *native]))
    aliases = [name for name in aliases if name and len(name) <= 80]
    if row[8] == 'RU':
        russian.append([display, aliases])
    else:
        world.append([display, row[8], admins.get(row[8] + '.' + row[10], ''), int(row[14]), aliases])
world.sort(key=lambda row: (-row[3], row[0], row[1], row[2]))
russian.sort(key=lambda row: row[0])
headers = ['// GeoNames, CC BY 4.0. Data only; attribution: /city-data-attribution.txt.',
           '// Snapshot: ' + args.snapshot_date + '. Rebuild with scripts/import-world-cities.py.']
for path in [args.cities_zip, args.alternate_names_zip, args.admin1_file, args.country_info_file]:
    headers.append('// ' + path.name + ' SHA-256: ' + hashlib.sha256(path.read_bytes()).hexdigest())
dump = lambda value: json.dumps(value, ensure_ascii=False, separators=(',', ':'))
args.output.write_text('\n'.join(headers) + '\nexport const worldCityRows=' + dump(world) + ';\nexport const russianCityAliases=' + dump(russian) + ';\n')
print(f'Imported {len(world)} international cities, {len(russian)} Russian alias records; {args.output.stat().st_size} bytes')
