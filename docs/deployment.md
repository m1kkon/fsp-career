# Эксплуатация ФСП Карьеры на GCP

Актуализировано по коду 10 октября 2026 года. Команды и переменные проверены по `compose.yaml`, `Dockerfile`, `.github/workflows/deploy.yml` и `deploy/`. Параметры VM, DNS, IAM, Resend и дисковых снимков ниже — сохранённая конфигурация развёртывания, а не новая проверка облачных панелей. Перед операцией сверяйте их с текущей конфигурацией владельца. Изменения локальной рабочей копии, включая оценивание v3, не считаются опубликованными до успешного релиза и проверки его SHA.

Проект: `project-4c60f7e8-37f9-44bb-b05`. VM: `fsp-career`, зона `europe-north1-a`, тип `e2-medium`, 4 ГиБ RAM, boot disk 30 ГиБ `pd-standard`. Статический IPv4: `35.228.53.5`. Основной адрес: `https://fspcareer.space`. `www.fspcareer.space` и прежний `fsp-career.35-228-53-5.sslip.io` перенаправляются на основной адрес с сохранением пути и query string.

Приложение публично, доступ к кабинетам требует email/пароль. Подтверждение адреса и восстановление пароля отправляются через Resend. Существующие неподтверждённые аккаунты должны подтвердить email при следующем входе. Реальный реестр ФСП не подключён. Исторический прототип Sites/D1 заменён приложением Next.js с PostgreSQL; автоматического импорта D1 в текущем релизе нет. Заголовки идентичности Sites не используются для входа.

## Архитектура и конфигурация

Next.js 16.3.8 / React 19.2.6 выполняется в Node.js. Минимум из `package.json` — Node 22.13.0; CI и Docker используют Node 24. Текущая production-сборка — `.next/standalone/server.js`; публичные ресурсы копируются отдельно. SQL-миграции `db/migrations/*.sql` применяет `scripts/migrate.mjs` в одной транзакции с advisory lock и журналом `schema_migrations`. Drizzle описывает схему и создаёт миграции, рабочий доступ к БД выполняет `pg`.

`compose.yaml` запускает PostgreSQL 17, одноразовый `migrate`, `app` и Caddy. БД должна стать healthy до миграции; приложение — после её успеха; Caddy — после readiness приложения. Миграции и сервер используют один образ приложения. Порты 80/443 публикует только Caddy. PostgreSQL хранится в именованном томе.

Шаблон конфигурации — [`deploy/env.example`](../deploy/env.example), реальное `.env` исключено из Git и Docker build context.

| Переменная | Назначение |
|---|---|
| `POSTGRES_PASSWORD` | 64 шестнадцатеричных символа; `init-env.py` создаёт или сохраняет пароль |
| `SITE_DOMAIN`, `SITE_REDIRECT_DOMAINS` | Основной домен и перенаправляемые алиасы Caddy |
| `APP_VERSION`, `RELEASE_SHA` | Тег контейнера и SHA для проверки `/api/health` |
| `DATABASE_URL`, `APP_URL` | Compose формирует для приложения из пароля и домена; при запуске вне Docker задаются отдельно |
| `RESEND_API_KEY`, `EMAIL_FROM`, `MAIL_TOKEN_KEY` | Отправка и шифрование очереди писем; production-релиз требует рабочую конфигурацию |
| `TEST_MAINTAINER_IDS` | ID аккаунтов мейнтейнеров через запятую; отдельный доступ к тестовому администрированию |
| `CODE_SANDBOX_URL`, `CODE_SANDBOX_TOKEN` | Адрес отдельного worker и общий секрет, не менее 32 символов |

`FSP_DEMO_MODE=1` — локальный режим с общей демонстрационной идентичностью и памятью процесса, который обходится без обычного входа. Он не передаётся production Compose и не должен использоваться на публичном сервисе. Такой режим не проверяет PostgreSQL, почту и реальные права аккаунтов; `/api/health` при этом всё равно обращается к PostgreSQL. Он содержит отдельную прежнюю демонстрационную сессию из шести вопросов и не заменяет проверку текущего стандартного оценивания v3.

## Worker исполнения кода

Основной контейнер приложения не содержит Docker CLI, не получает Docker socket и не поднимает coding worker через Compose. Для практических задач нужен отдельный Docker-host, собранный образ `sandbox/Dockerfile` и процесс `scripts/code-sandbox-server.mjs`. Без них просмотр интерфейса возможен, но запуск/проверка кода вернёт ошибку доступности; успешный `/api/health` сам по себе не проверяет worker.

Подготовка на worker-host:

```sh
docker build -t fsp-code-sandbox:local sandbox
node scripts/code-sandbox-server.mjs
```

До запуска задайте в закрытом окружении worker `CODE_SANDBOX_TOKEN` (тот же секрет, что у app). По умолчанию он слушает `127.0.0.1:4180`; `CODE_SANDBOX_HOST` и `CODE_SANDBOX_PORT` меняют адрес. При доступе между хостами требуется защищённый маршрут с HTTPS и ограничением клиентов. В worker `CODE_SANDBOX_URL` удаляется, чтобы запрос исполнялся локально, а не пересылался обратно. `CODE_SANDBOX_IMAGE` меняет имя уже подготовленного образа (по умолчанию `fsp-code-sandbox:local`); загрузки образа при каждом решении нет (`--pull=never`).

Сервис принимает POST с Bearer-секретом и ограничивает JSON 60 КБ. Каждая проверка запускает контейнер без сети, с read-only filesystem, без capabilities, от UID 1000, с лимитами 256 МБ, 1 CPU, 32 процесса и временным каталогом 64 МБ. Время исполнения — до 8 секунд на проверку, общий stdout/stderr — до 32 КБ; локальный worker допускает четыре параллельных запуска. Образ поддерживает Python, JavaScript, TypeScript, SQL, Bash, HTML, CSS и React. Эти ограничения не заменяют отдельный хост и мониторинг его ресурсов.

Первичный rollout worker ещё нужно подтвердить реальным end-to-end запуском в целевой среде. Docker-зависимые тесты могут пропускаться, если Docker/образ недоступны; зелёная проверка без них не подтверждает работоспособность практических задач в production.

## Доступ и расположение файлов

```sh
gcloud compute ssh fsp-career --zone=europe-north1-a --tunnel-through-iap --project=project-4c60f7e8-37f9-44bb-b05 --account=workingww00@gmail.com
sudo -i
cd /opt/fsp-career/current
docker compose ps
docker compose logs --tail=100 app caddy
```

SSH доступен только через Google IAP. Собственная VPC `fsp-career`; firewall разрешает 80/443 из интернета и 22 из диапазона IAP. Приложение и PostgreSQL не публикуют свои порты на хост. У VM нет service account. Приватный `/opt/fsp-career/.env` доступен root (0600), содержит пароль БД, домен, тег образа, RESEND_API_KEY, EMAIL_FROM и независимый MAIL_TOKEN_KEY. Не выводите docker compose config или содержимое .env в общие логи. Файл не хранится в Git или исходном архиве. В `/opt/fsp-career/releases/` лежат версии кода, `current` указывает на последнюю успешную.

## Автодеплой GitHub Actions

Workflow `.github/workflows/deploy.yml` работает при пуше в `main` и ручном `workflow_dispatch`. Pull request в `main` выполняет только проверки. Вначале запускаются сборка Next.js, тесты (включая настоящую PostgreSQL 17 и проверки отката), TypeScript и lint. Только успешная проверка разрешает deploy. Actions закреплены по SHA. В CI PostgreSQL загружается через Google mirror: `mirror.gcr.io/library/postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`. Это тот же закреплённый upstream digest; зеркало уменьшает зависимость от анонимного лимита Docker Hub. Production Compose пока использует `postgres:17-alpine` напрямую с тем же digest.

CI не подготавливает образ coding sandbox. Проверки реального Docker-исполнения могут быть пропущены; результаты смотрите отдельно от общего успешного статуса. Проверка банка (`npm run bank:audit`) и синтетические benchmark-команды выполняются отдельно — workflow их явно не запускает.

После проверки архивируются только отслеживаемые Git файлы. Архив передаётся через IAP; после передачи workflow обновляет авторизацию GCP, чтобы следующий SSH-вход не использовал истёкший OIDC-токен при больших архивах. Серверный `/opt/fsp-career/bin/deploy-archive` запускает обновление отдельным systemd job. Разрыв SSH не прерывает сборку. GitHub выполняет релизы последовательно; сервер дополнительно использует `flock`. Коммит, уже вытесненный новым `main`, пропускается перед передачей. После деплоя workflow проверяет публичный `/api/health`: `status: ok`, `revision` совпадает с SHA коммита.

Перед обновлением сохраняется `pg_dump`. Пароль PostgreSQL, ключ Resend и `MAIL_TOKEN_KEY` остаются в root-only `.env` на VM; GitHub не получает их. Ошибка сборки, readiness, настройки таймеров или резервного копирования возвращает прежние `.env`, `current` и контейнеры. Миграции схемы не откатываются автоматически: изменения БД должны быть совместимы с предыдущим приложением. Сохраняются пять последних CI-релизов, а также текущий и предыдущий; старые образы удаляются, том PostgreSQL сохраняется.

### Доступ GitHub к GCP

Используется Workload Identity Federation, без JSON-ключа service account и без GitHub Secrets:

- Project number: `517647198997`; pool `fsp-career-ci`; provider `github`.
- Service account: `fsp-github-deploy@project-4c60f7e8-37f9-44bb-b05.iam.gserviceaccount.com`.
- OIDC допускает только repository ID `1404898475`, owner ID `150428399`, ref `refs/heads/main`, workflow `m1kkon/fsp-career/.github/workflows/deploy.yml@refs/heads/main` и события `push`/`workflow_dispatch`.
- `roles/iam.workloadIdentityUser` на service account предоставлен principalSet этого repository ID.
- `roles/compute.osAdminLogin` выдан только на VM `fsp-career`. OS Login включён только у неё. У владельца `workingww00@gmail.com` также сохранён OS Admin Login.
- Проектная custom role `fspGithubComputeRead` содержит только `compute.projects.get`, `compute.instances.list`, `serviceusage.services.use` для gcloud.
- `roles/iap.tunnelResourceAccessor` ограничен условием `destination.ip == "10.44.0.2" && destination.port == 22`.

Доступ позволяет workflow управлять контейнерами от root на этой VM. Изменения `main` и workflow должны делать доверенные участники репозитория. При смене имени репозитория/ветки/файла workflow обновите условие OIDC; при смене внутреннего IP — условие IAP. Другая VM `sitewatch` не получает доступ через эту настройку.

Статус и логи: [GitHub Actions](https://github.com/m1kkon/fsp-career/actions/workflows/deploy.yml). Для повтора текущего `main` используйте `Run workflow`. На сервере: `journalctl -u fsp-deploy-<run-id>-<attempt> --no-pager`. Чтобы немедленно отключить доступ GitHub, отключите provider `github` в pool `fsp-career-ci` либо удалите его привязку `roles/iam.workloadIdentityUser` с service account.

Ручной откат приложения после успешного, но нежелательного релиза: из root-shell проверьте путь в `/opt/fsp-career/previous-release`, перейдите в него и выполните `bash deploy/release.sh fspcareer.space <его-тег> <его-SHA>`. Для прежних ручных релизов SHA можно опустить. После этого исправьте или откатите соответствующий коммит в `main`, чтобы следующий автоматический запуск не вернул нежелательную версию.

## Ручное обновление

Передавайте исходники без `.git`, `node_modules`, `.env*`, `.next`, `.wrangler` и локальных файлов. Распакуйте новый архив в отдельный `/opt/fsp-career/releases/<version>`, затем от root в этом каталоге выполните:

```sh
bash deploy/release.sh fspcareer.space <version>
```

Вместо `<version>` используйте уникальный тег. Скрипт сохраняет пароль БД, собирает контейнер, применяет SQL-миграции в транзакции, проверяет наличие почтовой конфигурации до миграции, ждёт readiness и включает резервное копирование и обработчик писем. При неудачном обновлении пытается вернуть предыдущие конфигурацию и контейнер. Схема БД автоматически назад не откатывается — будущие миграции должны быть совместимы с предыдущей версией приложения.

Образы основного приложения Node, PostgreSQL и Caddy закреплены по digest. Отдельный `sandbox/Dockerfile` пока использует тег `node:24-bookworm-slim` без digest; воспроизводимость worker нужно учитывать отдельно. Для обновления ОС работает unattended-upgrades; обновление контейнеров выполняется отдельным проверенным релизом.

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

Администратор проверяет владельца аккаунта отдельно. Новый пароль передаётся через stdin, не как аргумент или переменная среды контейнера. Все активные сессии и API-ключи аккаунта отзываются.

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

`fsp-mail.timer` каждые 30 секунд вызывает `scripts/send-mail.mjs`. Письма ставятся в зашифрованную очередь в той же транзакции, что и токен. Рабочий процесс использует lease и idempotency key; повторяет ошибки до пяти попыток с увеличением интервала, истёкшие ссылки удаляются. Лимит приложения — 95 постановок писем за 24-часовое окно; повторные запросы ограничены по IP и email. Квоты доставки Resend зависят от действующего плана и отдельно ограничивают отправку. Проверяйте актуальные лимиты и остаток в панели; при отказе провайдера очередь повторяет попытки, затем пользователю потребуется новая ссылка.

```sh
systemctl status fsp-mail.timer
systemctl start fsp-mail.service
journalctl -u fsp-mail.service --since '1 hour ago'
docker compose exec -T postgres psql -U fsp -d fsp -c 'SELECT attempts,last_error,count(*) FROM auth_mail_outbox GROUP BY attempts,last_error;'
```

Логи обработчика содержат только число отправок/ошибок и безопасные HTTP-коды, без адресов, ключей или ссылок. При окончательной ошибке пользователь может запросить новую ссылку. Новое письмо отменяет предыдущее того же назначения. Подтверждение действует 24 часа, восстановление — 30 минут, ссылки одноразовые. Восстановление завершает все сессии и отзывает API-ключи. Старые аккаунты сохраняются; миграция отзывает их неподтверждённые сессии.

## Проверка релиза и устранение сбоя CI

При красной проверке сначала откройте job `validate`: ошибка скачивания PostgreSQL до шагов сборки означает, что тесты ещё не запускались. Текущий workflow использует Google mirror с digest; после временной сетевой ошибки можно повторить только failed jobs либо вручную запустить workflow текущего `main`. Если ошибка относится к сборке, тестам или миграциям, исправьте её до следующего релиза. Не меняйте digest на случайный тег ради обхода ошибки.

После успешного deploy проверьте `/api/health` и совпадение `revision` с SHA ожидаемого коммита. Дополнительно пройдите вход, выдачу кандидатов и практическую задачу через настроенный worker: readiness проверяет только доступ к таблице `schema_migrations`. Текущая локальная проверка и ограничения описаны в [`validation.md`](validation.md); методика оценки — в [`scoring.md`](scoring.md).
