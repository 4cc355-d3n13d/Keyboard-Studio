# MCP: полный справочник инструментов

Определения извлечены из `mcp/protocol.js` сохранённой версии. Полные исходные JSON Schema и annotations находятся в `reference/mcp-tools.json`. Ниже — русское описание, точные поля и примеры. «Обязательное» для вложенного поля означает обязательность внутри переданного родительского объекта. У необязательного родительского объекта его поля не требуются до передачи самого объекта. Лишние поля аргументов запрещены; исключение — содержимое project, которое дополнительно валидируется приложением. Числа конечные, integer требует целое число; неизвестные tool names отклоняются.

Во всех session-командах session_id — строка 1–80 символов; её можно опустить только при ровно одной активной сессии. Примеры без session_id предполагают именно такой случай. Read-only команды читают кэш без очереди; остальные возвращают подтверждённый результат либо command_id со статусом pending.

## orbit_list_instruments — Каталог инструментов

Не требует открытой браузерной сессии. Возвращает instruments с нулевыми ID, category/description, id_format и studio_url. Это перечень доступных пресетов, а не список нескольких одновременно загруженных дорожек.

Annotations: readOnlyHint=true, destructiveHint=false, idempotentHint=true, openWorldHint=false.

Аргументы: пустой объект `{}`.

Пример аргументов:

```json
{}
```

## orbit_list_sessions — Подключённые вкладки

Возвращает только активные сессии текущего пользователя: session_id, label, audio_ready, updated_at. updated_at — Unix epoch в миллисекундах. Студия должна обновляться примерно в пределах последних 90 секунд.

Annotations: readOnlyHint=true, destructiveHint=false, idempotentHint=true, openWorldHint=false.

Аргументы: пустой объект `{}`.

Пример аргументов:

```json
{}
```

## orbit_get_state — Состояние

Читает последний серверный снимок: session_id, snapshot_age_ms и поля state на верхнем уровне ответа. Поля включают instrument_id/name, bpm, root, scale, scale_lock, loop, playing, recording, audio_ready, pattern_length, recorded_events, position, sound, fx, arp, favorites. Это чтение кэша, без постановки команды в очередь.

Annotations: readOnlyHint=true, destructiveHint=false, idempotentHint=true, openWorldHint=false.

| Поле | Тип | Обязательное | Значения / ограничения |
|---|---|---|---|
| `session_id` | string | нет | длина от 1; длина до 80 |

Пример аргументов:

```json
{}
```

## orbit_get_project — Проект без аудио

Возвращает session_id, snapshot_age_ms, project и sample_audio_included=false. project — структура version 1, samples сохраняют имена без data. Для полного скачиваемого проекта используйте export json.

Annotations: readOnlyHint=true, destructiveHint=false, idempotentHint=true, openWorldHint=false.

| Поле | Тип | Обязательное | Значения / ограничения |
|---|---|---|---|
| `session_id` | string | нет | длина от 1; длина до 80 |

Пример аргументов:

```json
{}
```

## orbit_configure — Настройка студии

Все поля необязательны; обновление частичное. При смене instrument_id сначала применяются стандартные sound нового тембра, затем переданные sound-поля. favorite относится к выбранному в этом вызове/текущему инструменту. Смена root/scale/scale_lock/arp снимает живые удержания через panic. Ответ value — новый state. Громкости tracks, chordType, padMode, visualMode и XY-привязки не являются полями этой команды: их меняют UI/проектом.

Annotations: readOnlyHint=false, destructiveHint=false, idempotentHint=true, openWorldHint=false.

| Поле | Тип | Обязательное | Значения / ограничения |
|---|---|---|---|
| `session_id` | string | нет | длина от 1; длина до 80 |
| `instrument_id` | integer | нет | минимум 0; максимум 35 |
| `bpm` | number | нет | минимум 40; максимум 240 |
| `root` | integer | нет | минимум 0; максимум 11 |
| `scale` | enum | нет | `"minor"` / `"major"` / `"dorian"` / `"pentatonic"` / `"chromatic"` |
| `scale_lock` | boolean | нет | — |
| `loop` | boolean | нет | — |
| `metronome` | boolean | нет | — |
| `humanize` | boolean | нет | — |
| `octave` | integer | нет | минимум 1; максимум 6 |
| `velocity` | number | нет | минимум 0.1; максимум 1 |
| `favorite` | boolean | нет | — |
| `sound` | object | нет | лишние поля запрещены |
| `sound.attack` | number | нет | минимум 0.001; максимум 2 |
| `sound.decay` | number | нет | минимум 0.01; максимум 3 |
| `sound.sustain` | number | нет | минимум 0; максимум 1 |
| `sound.release` | number | нет | минимум 0.03; максимум 5 |
| `sound.cutoff` | number | нет | минимум 100; максимум 16000 |
| `sound.resonance` | number | нет | минимум 0.1; максимум 12 |
| `sound.volume` | number | нет | минимум -30; максимум 0 |
| `sound.pan` | number | нет | минимум -1; максимум 1 |
| `fx` | object | нет | лишние поля запрещены |
| `fx.reverb` | object | нет | лишние поля запрещены |
| `fx.reverb.on` | boolean | нет | — |
| `fx.reverb.a` | number | нет | минимум 0.3; максимум 6 |
| `fx.reverb.b` | number | нет | минимум 0; максимум 0.8 |
| `fx.delay` | object | нет | лишние поля запрещены |
| `fx.delay.on` | boolean | нет | — |
| `fx.delay.a` | number | нет | минимум 0.05; максимум 0.75 |
| `fx.delay.b` | number | нет | минимум 0; максимум 0.8 |
| `fx.distortion` | object | нет | лишние поля запрещены |
| `fx.distortion.on` | boolean | нет | — |
| `fx.distortion.a` | number | нет | минимум 0; максимум 0.95 |
| `fx.distortion.b` | number | нет | минимум 0; максимум 0.8 |
| `fx.chorus` | object | нет | лишние поля запрещены |
| `fx.chorus.on` | boolean | нет | — |
| `fx.chorus.a` | number | нет | минимум 0.1; максимум 8 |
| `fx.chorus.b` | number | нет | минимум 0; максимум 1 |
| `fx.phaser` | object | нет | лишние поля запрещены |
| `fx.phaser.on` | boolean | нет | — |
| `fx.phaser.a` | number | нет | минимум 0.1; максимум 6 |
| `fx.phaser.b` | number | нет | минимум 0; максимум 1 |
| `fx.filter` | object | нет | лишние поля запрещены |
| `fx.filter.on` | boolean | нет | — |
| `fx.filter.a` | number | нет | минимум 100; максимум 16000 |
| `fx.filter.b` | number | нет | минимум 0.1; максимум 12 |
| `fx.tremolo` | object | нет | лишние поля запрещены |
| `fx.tremolo.on` | boolean | нет | — |
| `fx.tremolo.a` | number | нет | минимум 0.5; максимум 14 |
| `fx.tremolo.b` | number | нет | минимум 0; максимум 1 |
| `fx.compressor` | object | нет | лишние поля запрещены |
| `fx.compressor.on` | boolean | нет | — |
| `fx.compressor.a` | number | нет | минимум -45; максимум 0 |
| `fx.compressor.b` | number | нет | минимум 1; максимум 12 |
| `arp` | object | нет | лишние поля запрещены |
| `arp.on` | boolean | нет | — |
| `arp.mode` | enum | нет | `"up"` / `"down"` / `"updown"` / `"random"` / `"played"` |
| `arp.rate` | enum | нет | `"4n"` / `"8n"` / `"16n"` / `"32n"` |
| `arp.oct` | integer | нет | минимум 1; максимум 3 |
| `arp.gate` | number | нет | минимум 0.1; максимум 0.95 |
| `swing` | number | нет | минимум 0; максимум 0.65 |

Пример аргументов:

```json
{
  "instrument_id": 24,
  "bpm": 110,
  "fx": {
    "reverb": {
      "on": true,
      "a": 2.5,
      "b": 0.25
    }
  }
}
```

## orbit_transport — Транспорт и запись

action обязателен. play и record_start требуют уже запущенного аудио. pause сохраняет позицию, stop возвращает к началу и завершает запись. record_stop вызывает finish, сохраняя текущий транспорт. Ответ — state. Повторный play при уже играющем транспорте не создаёт отдельный экземпляр, но сетевые повторные команды всё равно следует проверять по command_id.

Annotations: readOnlyHint=false, destructiveHint=false, idempotentHint=false, openWorldHint=false.

| Поле | Тип | Обязательное | Значения / ограничения |
|---|---|---|---|
| `session_id` | string | нет | длина от 1; длина до 80 |
| `action` | enum | да | `"play"` / `"pause"` / `"stop"` / `"record_start"` / `"record_stop"` |

Пример аргументов:

```json
{
  "action": "play"
}
```

## orbit_play_notes — Короткая нота или аккорд

notes обязателен, 1–12 целых MIDI 0–127. Повторы одной высоты удаляются перед исполнением. duration_beats по умолчанию 0.5, velocity — текущая state.velocity. respect_scale по умолчанию false; при true используется MusicTheoryEngine.lock, который сам учитывает state.scaleLock. Поэтому true не заставляет приведение, если Scale Lock выключен. Звук идёт через remote и отпускается автоматически. Если запись включена, добавляет события note. Ответ: notes фактически выбранных высот, duration_beats, scheduled=true.

Annotations: readOnlyHint=false, destructiveHint=false, idempotentHint=false, openWorldHint=false.

| Поле | Тип | Обязательное | Значения / ограничения |
|---|---|---|---|
| `session_id` | string | нет | длина от 1; длина до 80 |
| `notes` | array | да | элементов от 1; элементов до 12 |
| `notes[]` | integer | элемент массива | минимум 0; максимум 127 |
| `duration_beats` | number | нет | минимум 0.0625; максимум 4 |
| `velocity` | number | нет | минимум 0.05; максимум 1 |
| `respect_scale` | boolean | нет | — |

Пример аргументов:

```json
{
  "notes": [
    60,
    64,
    67
  ],
  "duration_beats": 4,
  "velocity": 0.8,
  "respect_scale": false
}
```

## orbit_trigger_pad — Пэд

pad обязателен, нумерация 0–15. mode по умолчанию — текущий режим пэдов; явный mode меняет этот режим в UI. duration_beats по умолчанию 0.5, velocity — state.velocity. Для chord/scale выбираются ноты по музыкальной теории, для drum вызывается синтез удара. Sample использует существующий браузерный буфер; пользовательский файл предварительно загрузите в UI, иначе используется встроенный. Для sample фактическая громкость берётся из sampleVolume; velocity этой команды не заменяет sampleVolume. Gate/loop автоматически останавливаются через beats; one-shot играет весь буфер. Ответ содержит pad/mode и notes/drum/sample + scheduled.

Annotations: readOnlyHint=false, destructiveHint=false, idempotentHint=false, openWorldHint=false.

| Поле | Тип | Обязательное | Значения / ограничения |
|---|---|---|---|
| `session_id` | string | нет | длина от 1; длина до 80 |
| `pad` | integer | да | минимум 0; максимум 15 |
| `mode` | enum | нет | `"chord"` / `"drum"` / `"scale"` / `"sample"` |
| `duration_beats` | number | нет | минимум 0.0625; максимум 4 |
| `velocity` | number | нет | минимум 0.05; максимум 1 |

Пример аргументов:

```json
{
  "pad": 0,
  "mode": "chord",
  "duration_beats": 2
}
```

## orbit_set_pattern — Секвенсор

Все поля необязательны. length по умолчанию — текущая; replace отсутствует/false — patch. При true очищаются все melodic on и drum ячейки, затем применяются переданные данные. В переданном melody-элементе on по умолчанию true, velocity — текущая, duration_steps — 1; неуказанные значения этого элемента не обязательно сохраняются. Каждая переданная drum-строка полностью заменяет набор активных шагов строки. step/steps должны быть меньше фактической length; duplicate-элементы применяются по порядку. Массивы внутри state остаются длиной 32. При смене length транспорт останавливается. Правка undoable; Piano Roll не очищается. Ответ: length и pattern.

Annotations: readOnlyHint=false, destructiveHint=false, idempotentHint=true, openWorldHint=false.

| Поле | Тип | Обязательное | Значения / ограничения |
|---|---|---|---|
| `session_id` | string | нет | длина от 1; длина до 80 |
| `length` | enum | нет | `16` / `32` |
| `replace` | boolean | нет | — |
| `melody` | array | нет | элементов до 32 |
| `melody[]` | object | элемент массива | лишние поля запрещены |
| `melody[].step` | integer | да | минимум 0; максимум 31 |
| `melody[].note` | integer | да | минимум 0; максимум 127 |
| `melody[].on` | boolean | нет | — |
| `melody[].velocity` | number | нет | минимум 0.05; максимум 1 |
| `melody[].duration_steps` | number | нет | минимум 0.1; максимум 32 |
| `drums` | array | нет | элементов до 4 |
| `drums[]` | object | элемент массива | лишние поля запрещены |
| `drums[].drum` | enum | да | `"kick"` / `"snare"` / `"hat"` / `"clap"` |
| `drums[].steps` | array | да | элементов до 32 |
| `drums[].steps[]` | integer | элемент массива | минимум 0; максимум 31 |

Пример аргументов:

```json
{
  "length": 16,
  "replace": true,
  "melody": [
    {
      "step": 0,
      "note": 60,
      "duration_steps": 4
    }
  ],
  "drums": [
    {
      "drum": "kick",
      "steps": [
        0,
        4,
        8,
        12
      ]
    }
  ]
}
```

## orbit_edit_notes — Piano Roll

notes обязателен, массив до 512 новых событий за один вызов. replace по умолчанию false добавляет, true очищает записанные события перед добавлением. notes=[] с replace=true очищает Piano Roll. Нота должна целиком помещаться: start_step+duration_steps<=length. Общий лимит events — 4096. Velocity по умолчанию текущая. Через эту команду создаются только kind=note, не drum/sample; правка undoable. Ответ: recorded_events.

Annotations: readOnlyHint=false, destructiveHint=false, idempotentHint=false, openWorldHint=false.

| Поле | Тип | Обязательное | Значения / ограничения |
|---|---|---|---|
| `session_id` | string | нет | длина от 1; длина до 80 |
| `replace` | boolean | нет | — |
| `notes` | array | да | элементов до 512 |
| `notes[]` | object | элемент массива | лишние поля запрещены |
| `notes[].note` | integer | да | минимум 0; максимум 127 |
| `notes[].start_step` | number | да | минимум 0; максимум 31.99 |
| `notes[].duration_steps` | number | да | минимум 0.1; максимум 32 |
| `notes[].velocity` | number | нет | минимум 0.05; максимум 1 |

Пример аргументов:

```json
{
  "replace": true,
  "notes": [
    {
      "note": 60,
      "start_step": 0,
      "duration_steps": 4,
      "velocity": 0.75
    }
  ]
}
```

## orbit_generate_progression — Генератор гармонии

genre обязателен. Заменяет мелодическую и барабанные строки текущего секвенсора, использует текущие root/scale/chordType и length. Не переключает тембр и не очищает записанную партию. Undoable. Возвращает genre и pattern. Генератор — локальные формулы, без внешнего AI.

Annotations: readOnlyHint=false, destructiveHint=false, idempotentHint=false, openWorldHint=false.

| Поле | Тип | Обязательное | Значения / ограничения |
|---|---|---|---|
| `session_id` | string | нет | длина от 1; длина до 80 |
| `genre` | enum | да | `"House"` / `"Techno"` / `"Trance"` / `"Ambient"` / `"Synthwave"` / `"Lo-fi"` |

Пример аргументов:

```json
{
  "genre": "House"
}
```

## orbit_history — Undo/Redo

action обязателен. Откатывает pattern/events/length. При пустой истории возвращает ошибку вместо фиктивного успеха. Не восстанавливает всю конфигурацию студии; load_project очищает историю. Возвращает state.

Annotations: readOnlyHint=false, destructiveHint=false, idempotentHint=false, openWorldHint=false.

| Поле | Тип | Обязательное | Значения / ограничения |
|---|---|---|---|
| `session_id` | string | нет | длина от 1; длина до 80 |
| `action` | enum | да | `"undo"` / `"redo"` |

Пример аргументов:

```json
{
  "action": "undo"
}
```

## orbit_export — Скачивание

format обязателен: json, midi, wav. JSON включает sample.data. MIDI не включает аудиосэмплы/FX. WAV требует Start Audio, останавливает transport и рендерит один цикл с рассчитанным хвостом. Возвращает file_name и download_started=true; JSON также includes_sample_audio=true. Это не путь к файлу в окружении агента. Пока WAV рендерится, большинство браузерных операций получают BUSY.

Annotations: readOnlyHint=false, destructiveHint=false, idempotentHint=false, openWorldHint=false.

| Поле | Тип | Обязательное | Значения / ограничения |
|---|---|---|---|
| `session_id` | string | нет | длина от 1; длина до 80 |
| `format` | enum | да | `"json"` / `"midi"` / `"wav"` |

Пример аргументов:

```json
{
  "format": "json"
}
```

## orbit_load_project — Заменить проект

project обязателен и должен быть полным version 1 проектом. Схема инструмента допускает произвольные свойства project, затем ProjectStorage.validate и дополнительные browser-проверки проверяют содержимое. См. default-project.json. Останавливает транспорт, заменяет state и очищает Undo. При совпадающих имени и слоте metadata-сэмпла сохраняет уже находящиеся в памяти data. Ответ: loaded=true, instrument_id, missing_sample_audio. Аргументы с base64 учитываются в 512 KiB общего запроса и записываются в D1 queue. Для крупных проектов используйте файловый интерфейс.

Annotations: readOnlyHint=false, destructiveHint=true, idempotentHint=false, openWorldHint=false.

| Поле | Тип | Обязательное | Значения / ограничения |
|---|---|---|---|
| `session_id` | string | нет | длина от 1; длина до 80 |
| `project` | object | да | — |

Пример с загрузкой полного проекта из файла в JavaScript-клиенте:

```javascript
const project = JSON.parse(await readFile('reference/default-project.json','utf8'));
const args = {session_id: 'SESSION_ID', project};
// Передайте args как params.arguments tools/call.
```

## orbit_command_status — Проверка результата

command_id обязателен; относится к ранее полученному ID этого пользователя. Возвращает pending/done/error/expired и, когда есть, ok/value/error. Не нуждается в активной сессии: полезен при потере связи после отправки. Не повторяйте неизвестный результат звуковой команды без проверки.

Annotations: readOnlyHint=true, destructiveHint=false, idempotentHint=true, openWorldHint=false.

| Поле | Тип | Обязательное | Значения / ограничения |
|---|---|---|---|
| `command_id` | string | да | длина от 1; длина до 120 |

Пример аргументов:

```json
{
  "command_id": "COMMAND_ID"
}
```

## Что означают annotations

ReadOnlyHint описывает отсутствие изменения музыкального состояния. DestructiveHint=true у load_project указывает на замену всей сессии. IdempotentHint — подсказка клиенту, а не гарантия доставки exactly-once: configure и set_pattern помечены идемпотентными, но создают историю/зависят от текущего состояния и могут повторно обновлять UI. Для pending всё равно проверяйте command_status. OpenWorldHint=false означает, что заявленные операции действуют внутри студии; экспорт инициирует локальную браузерную загрузку.

## Общее представление успешного изменения

```json
{"command_id":"COMMAND_ID","session_id":"SESSION_ID","status":"done","ok":true,"value":{"scheduled":true}}
```

У конкретного value форма зависит от инструмента. Для error используются status=error, ok=false и error; при expired отдельного ok может не быть. Сервер помечает такие tool results isError=true. Для get_state/get_project/list/status результат не оборачивается в новый queued command.
