# Эксплуатация ФСП Карьеры на GCP

Проект: `project-4c60f7e8-37f9-44bb-b05`. VM: `fsp-career`, зона `europe-north1-a`, тип `e2-medium`, 4 ГиБ RAM, boot disk 30 ГиБ `pd-standard`. Статический IPv4: `35.228.53.5`. Временный адрес: `https://fsp-career.35-228-53-5.sslip.io`.

Приложение публично, доступ к кабинетам требует email/пароль. Подтверждение адреса и восстановление по email пока отключены по договорённости. Реальный реестр ФСП не подключён. База новая; старые пользовательские записи D1 не импортировались, поскольку реальных данных там нет.

## Доступ и расположение файлов

```sh
gcloud compute ssh fsp-career --zone=europe-north1-a --tunnel-through-iap --project=project-4c60f7e8-37f9-44bb-b05
sudo -i
cd /opt/fsp-career/current
docker compose ps
docker compose logs --tail=100 app caddy
```

SSH доступен только через Google IAP. Собственная VPC `fsp-career`; firewall разрешает 80/443 из интернета и 22 из диапазона IAP. Приложение и PostgreSQL не публикуют свои порты на хост. У VM нет service account. Приватный `/opt/fsp-career/.env` доступен root (0600), содержит пароль БД, домен и тег образа. Файл не хранится в Git или исходном архиве. В `/opt/fsp-career/releases/` лежат версии кода, `current` указывает на последнюю успешную.

## Обновление

Передавайте исходники без `.git`, `node_modules`, `.env*`, `.next`, `.wrangler` и локальных файлов. Распакуйте новый архив в отдельный `/opt/fsp-career/releases/<version>`, затем от root в этом каталоге выполните:

```sh
bash deploy/release.sh fsp-career.35-228-53-5.sslip.io <version>
```

Вместо `<version>` используйте уникальный тег. Скрипт сохраняет пароль БД, собирает контейнер, применяет SQL-миграции в транзакции, ждёт readiness и включает резервное копирование. При неудачном обновлении пытается вернуть предыдущие конфигурацию и контейнер. Схема БД автоматически назад не откатывается — будущие миграции должны быть совместимы с предыдущей версией приложения.

Образы Node, PostgreSQL и Caddy закреплены по digest. Для обновления ОС работает unattended-upgrades; обновление контейнеров выполняется отдельным проверенным релизом.

## Резервные копии и восстановление

`fsp-backup.timer` ежедневно около 03:30 UTC сохраняет `pg_dump -Fc` в `/var/backups/fsp-career`, удерживает 7 дней. Копии содержат персональные данные и хеши паролей; каталог 0700, файлы 0600. Ручной запуск:

```sh
systemctl start fsp-backup.service
systemctl status fsp-backup.service
systemctl list-timers fsp-backup.timer
```

GCP policy `fsp-career-daily` снимает весь boot disk ежедневно в 05:00 UTC, удерживает 7 дней и сохраняет снимки после удаления диска. Это копия вне VM, включающая завершённый ночной SQL dump. Дисковые снимки не заменяют логический dump для согласованного восстановления PostgreSQL. Снимки тарифицируются отдельно от VM.

Проверить dump в отдельной пустой базе, не меняя рабочую:

```sh
docker compose exec -T postgres createdb -U fsp restore_check
docker compose exec -T postgres pg_restore -U fsp -d restore_check --exit-on-error < /var/backups/fsp-career/<backup>.dump
docker compose exec -T postgres psql -U fsp -d restore_check -c 'SELECT count(*) FROM accounts;'
docker compose exec -T postgres dropdb -U fsp restore_check
```

Для аварийного восстановления рабочей базы остановите приложение, сохраните текущий dump, затем восстановите выбранную копию через `pg_restore --clean --if-exists --exit-on-error` и запустите приложение. При потере VM создайте диск из последнего GCP snapshot, поднимите VM и восстановите нужный SQL dump. Не используйте `docker compose down -v`: эта команда удаляет данные.

## Сброс пароля до подключения SMTP

Администратор проверяет владельца аккаунта отдельно. Новый пароль передаётся через stdin, не как аргумент или переменная среды контейнера. Все активные сессии аккаунта отзываются.

```sh
read -rsp 'Новый пароль (12–128 символов): ' fsp_password
printf '%s' "$fsp_password" | docker compose exec -T app node scripts/reset-password.mjs user@example.com
unset fsp_password
```

Замените email аккаунта. Скрипт никогда не выводит пароль. Самостоятельное восстановление требует отдельного почтового сервиса.

## Свой домен

После покупки домена у регистратора установите DNS `A @ 35.228.53.5`. При необходимости `CNAME www <ваш-домен>`; не добавляйте AAAA без настроенного IPv6. Когда DNS резолвится, в `current` от root:

```sh
python3 deploy/init-env.py --domain <ваш-домен> --version <текущий-тег>
docker compose up -d --force-recreate app caddy --wait
```

Домен меняет и `APP_URL`, используемый для Origin-проверки. Caddy получает сертификат автоматически. Сессия на временном домене не переносится в cookie нового домена: войдите заново. Храните доступ регистратора у владельца проекта.

## Диагностика

```sh
curl -fsS https://fsp-career.35-228-53-5.sslip.io/api/health
docker compose ps
docker stats --no-stream
df -h /
systemctl status docker fsp-backup.timer
```

Логи контейнеров ротируются: 3 файла по 10 МБ. Контейнеры ограничены по памяти; 2 ГиБ swap помогают сборке на VM. Данные PostgreSQL находятся в persistent Docker volume `fsp-career_postgres_data`. Все бизнес-записи сериализуются advisory lock — решение для небольшого MVP; при росте нагрузки переходите на адресные блокировки и пагинацию каталогов.
