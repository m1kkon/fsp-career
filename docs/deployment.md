# Эксплуатация ФСП Карьеры на GCP

Проект: `project-4c60f7e8-37f9-44bb-b05`. VM: `fsp-career`, зона `europe-north1-a`, тип `e2-medium`, 4 ГиБ RAM, boot disk 30 ГиБ `pd-standard`. Статический IPv4: `35.228.53.5`. Основной адрес: `https://fspcareer.space`. `www.fspcareer.space` и прежний `fsp-career.35-228-53-5.sslip.io` перенаправляются на основной адрес с сохранением пути и query string.

Приложение публично, доступ к кабинетам требует email/пароль. Подтверждение адреса и восстановление пароля отправляются через Resend. Существующие неподтверждённые аккаунты должны подтвердить email при следующем входе. Реальный реестр ФСП не подключён. База новая; старые пользовательские записи D1 не импортировались, поскольку реальных данных там нет.

## Доступ и расположение файлов

```sh
gcloud compute ssh fsp-career --zone=europe-north1-a --tunnel-through-iap --project=project-4c60f7e8-37f9-44bb-b05
sudo -i
cd /opt/fsp-career/current
docker compose ps
docker compose logs --tail=100 app caddy
```

SSH доступен только через Google IAP. Собственная VPC `fsp-career`; firewall разрешает 80/443 из интернета и 22 из диапазона IAP. Приложение и PostgreSQL не публикуют свои порты на хост. У VM нет service account. Приватный `/opt/fsp-career/.env` доступен root (0600), содержит пароль БД, домен, тег образа, RESEND_API_KEY, EMAIL_FROM и независимый MAIL_TOKEN_KEY. Не выводите docker compose config или содержимое .env в общие логи. Файл не хранится в Git или исходном архиве. В `/opt/fsp-career/releases/` лежат версии кода, `current` указывает на последнюю успешную.

## Обновление

Передавайте исходники без `.git`, `node_modules`, `.env*`, `.next`, `.wrangler` и локальных файлов. Распакуйте новый архив в отдельный `/opt/fsp-career/releases/<version>`, затем от root в этом каталоге выполните:

```sh
bash deploy/release.sh fspcareer.space <version>
```

Вместо `<version>` используйте уникальный тег. Скрипт сохраняет пароль БД, собирает контейнер, применяет SQL-миграции в транзакции, проверяет наличие почтовой конфигурации до миграции, ждёт readiness и включает резервное копирование и обработчик писем. При неудачном обновлении пытается вернуть предыдущие конфигурацию и контейнер. Схема БД автоматически назад не откатывается — будущие миграции должны быть совместимы с предыдущей версией приложения.

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

## Административный сброс пароля

Администратор проверяет владельца аккаунта отдельно. Новый пароль передаётся через stdin, не как аргумент или переменная среды контейнера. Все активные сессии аккаунта отзываются.

```sh
read -rsp 'Новый пароль (12–128 символов): ' fsp_password
printf '%s' "$fsp_password" | docker compose exec -T app node scripts/reset-password.mjs user@example.com
unset fsp_password
```

Замените email аккаунта. Скрипт никогда не выводит пароль. Самостоятельное восстановление доступно через «Забыли пароль?» на сайте; административный сброс не заменяет подтверждение владения email.

## Домен и Cloudflare

`fspcareer.space` делегирован на `camilo.ns.cloudflare.com` и `june.ns.cloudflare.com`. Бесплатный план Cloudflare, DNS:

- `A @ 35.228.53.5`, Proxied, TTL Auto.
- `CNAME www fspcareer.space`, Proxied, TTL Auto.

Cloudflare SSL/TLS: **Full (strict)**; Always Use HTTPS включён, минимальная версия TLS 1.2, TLS 1.3 включён. Universal SSL активен. На VM Caddy автоматически получает и продлевает публичные сертификаты Let's Encrypt. Не включайте Flexible: приложение ожидает HTTPS на origin.

Активное правило кеша `FSP API — never cache`: `starts_with(http.request.uri.path, "/api/")` → Bypass cache. Приватные ответы дополнительно имеют `Cache-Control: no-store`; статические ресурсы можно кешировать. Не добавляйте Cache Everything для API или страниц кабинета.

Caddy доверяет `CF-Connecting-IP` только соединениям из официальных сетей Cloudflare и передаёт вычисленный `{client_ip}` в `X-FSP-Client-IP`, перезаписывая присланное клиентом значение. Прямые подключения к VM не могут подменить этот IP заголовком Cloudflare. Диапазоны в `deploy/Caddyfile` сверены 2026-10-06 с https://www.cloudflare.com/ips/; проверяйте их при обновлении инфраструктуры. Origin остаётся доступен по IPv4 на 80/443, поэтому публичное приложение продолжает самостоятельно проверять сессии, роли, Origin и лимиты.

Чтобы сменить основной домен, сначала настройте DNS-only записи нового домена на VM. В `current` от root:

```sh
python3 deploy/init-env.py --domain <новый-домен> --version <текущий-тег>
docker compose up -d --no-build --force-recreate app caddy --wait
```

Скрипт сохраняет пароль БД и формирует `SITE_REDIRECT_DOMAINS`: `www` нового домена, предыдущий основной домен и уже сохранённые алиасы. Хосты разделяются запятой **и пробелом**. Сохранённые алиасы должны оставаться под вашим контролем; удалите старый домен из списка, если он больше не принадлежит проекту. Домен меняет `APP_URL`, используемый для Origin-проверки. Дождитесь выпуска сертификатов на origin, проверьте HTTPS без отключения проверки сертификата, затем включайте Cloudflare Proxied и Full (strict).

Сессия временного домена не переносится в cookie нового домена: войдите заново. Почта подключена через Resend API; SMTP не используется. При смене домена подтвердите новый домен в Resend и обновите EMAIL_FROM и ограничение домена API-ключа. Храните доступ Cloudflare и регистратора у владельца проекта; токен API на VM не нужен.

## Диагностика

```sh
curl -fsS https://fspcareer.space/api/health
docker compose ps
docker stats --no-stream
df -h /
systemctl status docker fsp-backup.timer
```

Логи контейнеров ротируются: 3 файла по 10 МБ. Контейнеры ограничены по памяти; 2 ГиБ swap помогают сборке на VM. Данные PostgreSQL находятся в persistent Docker volume `fsp-career_postgres_data`. Все бизнес-записи сериализуются advisory lock — решение для небольшого MVP; при росте нагрузки переходите на адресные блокировки и пагинацию каталогов.


## Resend и очередь авторизационных писем

Домен `fspcareer.space` подтверждён в Resend (регион eu-west-1). Отправитель: `ФСП Карьера <no-reply@fspcareer.space>`. DNS-only: TXT `resend._domainkey` с DKIM-ключом из панели; CNAME `rsend` → `rsend-euw1.forge.rmta.net`; CNAME `send` → `send.forge.rmta.net`; TXT `_dmarc` → `v=DMARC1; p=quarantine;`. Не проксируйте почтовые записи. Tracking-домен не настроен; ссылки подтверждения не должны перенаправляться через трекер. TLS для доставки принудительный.

Ключ Resend должен иметь Sending access, ограниченный этим доменом. Установка/ротация: передайте ключ в stdin `python3 deploy/configure-mail.py` и пересоздайте app (`docker compose up -d --no-build --force-recreate app --wait`). Не передавайте ключ в аргументах, Git или чате. MAIL_TOKEN_KEY шифрует очередь; сохраняйте его при обновлениях и восстановлении резервной копии.

`fsp-mail.timer` каждые 30 секунд вызывает `scripts/send-mail.mjs`. Письма ставятся в зашифрованную очередь в той же транзакции, что и токен. Рабочий процесс использует lease и idempotency key; повторяет ошибки до пяти попыток с увеличением интервала, истёкшие ссылки удаляются. Лимит приложения — 95 постановок писем за 24-часовое окно; повторные запросы ограничены по IP и email. Resend отдельно ограничивает бесплатную доставку: 100 писем в день и 3000 в месяц. Проверяйте остаток в панели; при отказе провайдера очередь повторяет попытки, затем пользователю потребуется новая ссылка.

```sh
systemctl status fsp-mail.timer
systemctl start fsp-mail.service
journalctl -u fsp-mail.service --since '1 hour ago'
docker compose exec -T postgres psql -U fsp -d fsp -c 'SELECT attempts,last_error,count(*) FROM auth_mail_outbox GROUP BY attempts,last_error;'
```

Логи обработчика содержат только число отправок/ошибок и безопасные HTTP-коды, без адресов, ключей или ссылок. При окончательной ошибке пользователь может запросить новую ссылку. Новое письмо отменяет предыдущее того же назначения. Подтверждение действует 24 часа, восстановление — 30 минут, ссылки одноразовые. Восстановление завершает все сессии. Старые аккаунты сохраняются; миграция отзывает их неподтверждённые сессии.
