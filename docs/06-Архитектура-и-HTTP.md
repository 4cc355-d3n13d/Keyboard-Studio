# Архитектура, HTTP и хранение

## Компоненты

```text
Чат / MCP-клиент
   │ tools/call через доверенную авторизацию Sites
   ▼
Worker /mcp ─── чтение catalog/state/project/status
   │ изменение
   ▼
D1 orbit_mcp_commands ◄── poll / ack ── Открытая веб-студия
                                        │ OrbitControl.invoke
                                        ▼
                                   Tone.js / Web Audio
                                        │
                                        ▼
                                   Выход устройства
```

Приложение собрано без framework runtime. `web/index.html` содержит UI, музыкальное состояние и движок; `mcp/protocol.js` — определения и валидацию инструментов; `mcp/browser.js` — исполнитель и мост; `worker/server.js` — HTTP, идентификацию, очередь и JSON-RPC. При сборке эти части объединяются с каталогом. Tone.js 14.8.49 включён локальным файлом, в автономном HTML — встроенным скриптом.

## Аудиомаршруты

```text
live + remote → instrument Filter → Vibrato → Pan → канал Инструмент ┐
seq → отдельные Filter → Vibrato → Pan → канал Мелодия               ├→ FX → Master → Limiter → выход
drums + sample Players → канал Drum rack                            ┘
метроном ───────────────────────────────────────────────────────────→ Master
Limiter → Waveform / FFT / Meter → Canvas
```

Массив внутренних аудиоканалов и порядок фейдеров UI различаются: applyTracks использует отображение [0,2,1]. Мелодические события секвенсора и Piano Roll идут в seq, удалённые короткие ноты — в remote, а физические клавиши — в live. Результирующий звук всё равно использует один выбранный пресет.

## Состояние и владельцы нот

`AudioEngine.sources` связывает источник pointer/key/pad с нотой, `owners` хранит набор удерживающих источников на высоту. Отпускание одного источника не выключает ноту, которую продолжает удерживать другой. `deferred` хранит отпускания под Sustain. `panic()` снимает голоса, очищает активные источники и sample Players, сбрасывает pitch. StringSynth поддерживает собственные voice envelopes, cache и dispose.

Sequencer использует Tone.Transport с repeat на шестнадцатых, арпеджиатор — проверку сетки на тридцать вторых. UI-подсветка планируется Tone.Draw, а не управляет звуком через задержки DOM. RecordingManager хранит временные pending-ноты, затем превращает их в события. History хранит JSON снимков pattern/events/length.

## HTTP маршруты

| Метод и путь | Назначение |
|---|---|
| GET/HEAD `/`, `/index.html` | Страница со вставленным MCP-мостом |
| GET/HEAD `/tone.js` | Локальная библиотека Tone |
| GET/HEAD `/Tone.js.LICENSE.txt` | Лицензия библиотеки |
| GET/HEAD `/download/music-keyboard-studio.html` | Самодостаточный HTML как attachment |
| POST `/mcp` | JSON-RPC MCP |
| POST `/api/orbit/connect` | Создать браузерную сессию |
| POST `/api/orbit/poll` | Обновить снимок и получить до 16 команд |
| POST `/api/orbit/ack` | Подтвердить команду и новый снимок |
| POST `/api/orbit/disconnect` | Пометить вкладку отключённой, истечь pending-команды |

JSON API отвечает `Content-Type: application/json`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`. Статика получает no-cache. Тела JSON ограничены 524288 байтами; проверяются Content-Length и фактическая UTF-8 длина. Ограничение относится ко всему HTTP-запросу, а не только к вложенному project.

Браузерный API принимает только POST. Если Origin передан, он должен совпадать с origin запроса или каноническим ORBIT origin. Отсутствие Origin само по себе не заменяет проверку личности. Это не общедоступный CORS API для произвольных сайтов.

## connect / poll / ack / disconnect

```json
{"label":"ORBIT · браузер","snapshot":{"project":{},"state":{"audio_ready":false}}}
```

Это форма connect; реальная студия отправляет полный снимок. Ответ содержит `session_id`. Poll принимает `session_id` и новый `snapshot`, отвечает `commands:[{id,tool,arguments}]`. Команды сортируются по created_at и rowid; возвращаются только pending и ещё не истёкшие.

```json
{"session_id":"SESSION_ID","command_id":"COMMAND_ID","result":{"ok":true,"value":{"scheduled":true}},"snapshot":{"project":{},"state":{}}}
```

Ack проверяет пользователя, сессию и команду, затем сохраняет статус done/error, result и snapshot. Повторный ack уже завершённой команды не меняет её результат. Просроченный pending ack получает COMMAND_EXPIRED. Disconnect принимает только session_id, сбрасывает updated_at и expires_at pending-команд. При pagehide браузер пытается отправить disconnect через sendBeacon; доставка beacon не гарантирована.

## D1

| Таблица | Поля |
|---|---|
| orbit_mcp_sessions | id PK, user_id, label, snapshot JSON string, updated_at epoch ms |
| orbit_mcp_commands | id PK, user_id, session_id, tool, arguments JSON string, created_at, expires_at, status, result JSON string/null |

Индексы: sessions(user_id,updated_at) и commands(session_id,user_id,status,created_at). Миграция: `drizzle/0000_orbit_mcp.sql`; журнал миграций хранится в `drizzle/meta/_journal.json`. В manifest D1 binding — строка `DB`. R2 не используется.

Все операции пользователя фильтруются по user_id; владение сессией проверяется до изменения. SQL использует bind-параметры. В этой схеме нет отдельных таблиц песен или проектов: одна активная сессия хранит один последний снимок.

## Очередь, сроки и повторные доставки

| Настройка | Значение |
|---|---|
| Активность сессии | Снимок обновлялся в пределах примерно 90 с |
| Интервал следующего browser poll | 900 мс после завершения предыдущего прохода |
| Тайм-аут browser fetch | 12 с |
| Максимум команд за poll | 16 |
| Лимит живых pending на сессию | 64 |
| TTL play_notes/trigger_pad/transport | 15 с |
| TTL остальных изменений | 90 с |
| Ожидание ack в tools/call | До 12 проверок с паузами 250 мс, плюс время DB |
| Кэш результатов в памяти вкладки | 128 command_id |
| Очистка старых записей | При новом connect: команды с expires_at старше 24 ч и сессии с updated_at старше 24 ч |

Очистка запускается при connect, это не гарантированный фоновый TTL-сервис. Записи могут оставаться дольше 24 часов, если никто не подключается. Поллинг не push/WebSocket; фоновые вкладки и энергосбережение могут задерживать доставку. Сервер хранит команды, но не генерирует звук вместо закрытой вкладки.

## MCP JSON-RPC

Реализованы `server/discover`, `initialize`, `ping`, `tools/list`, `tools/call` и принятие `notifications/*` с HTTP 202. Основная объявленная версия в коде — `2026-07-28`; initialize при другом запросе отвечает fallback `2025-11-25`. Это описание совместимости конкретной реализации, не обещание поддержки всех возможностей будущих стандартов MCP.

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"orbit_list_instruments","arguments":{}}}
```

```json
{"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"{\"instruments\":[]}"}],"isError":false}}
```

Полезная нагрузка ORBIT находится в JSON-строке text и требует ещё одного JSON.parse при использовании низкоуровневого клиента. Ошибки команды обычно возвращаются как result с isError=true, а не HTTP 500. Ошибки JSON-RPC имеют коды −32700/−32600/−32601/−32602. GET /mcp отвечает 405 с Allow: POST. Batch RPC, SSE-streaming, MCP resources и prompts в сервере не реализованы.

## Идентификация и границы доверия

Production Worker доверяет `oai-authenticated-user-id`, который устанавливает Sites. Он не проверяет собственную сессию логина по cookie и не верифицирует самостоятельно подпись bearer token. Без доверенного прокси перед Worker такой заголовок можно подделать; при переносе на другой хостинг orbitUser нужно заменить реальной проверкой личности. Тестовая подстановка личности допустима только в loopback preview.

Схемы инструментов запрещают лишние поля и не содержат eval/execute_script. Это ограничивает команды явным набором операций; не означает, что вся браузерная среда стала изолированным sandbox для недоверенных скриптов. Не добавляйте произвольное исполнение кода как способ управления студией.

Site остаётся с прежней приватной аудиторией. Изменение адреса или развёртывание копии не переносит автоматически аккаунты, OAuth, D1 и права. Endpoint позволяет менять музыкальный проект; не публикуйте секреты в проекте, примерах или документации.
