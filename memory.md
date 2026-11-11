# Memory: «Свинолов» v2.0

Техническая память для разработчика. Пользовательское описание — в `README.md`.

## Краткое описание
Браузерная игра на чистом HTML5 Canvas и ванильном JS. Без сборки, без модулей ES, без внешних библиотек: скрипты подключаются обычными `<script>` в `index.html`, поэтому игра работает по `file://` двойным кликом. Цель игрока — переловить свиней до заката (таймер дня). Прогресс хранится в `localStorage`.

## Архитектура: файлы и ответственность
Порядок подключения в `index.html`: config, storage, audio, fx, world, pig, player, helper, shop, ui, game.

| Файл | Что внутри |
|---|---|
| `js/config.js` | Утилиты `U` (clamp, lerp, rand, seeded ГПСЧ, fmt, plural), полифилл `roundRect`, константы `CONFIG`, `PIG_TYPES`, `UPGRADES`, `TEAM`, `HATS`, `ACHIEVEMENTS`, `SEASONS`, `EVENTS`, `POWERUPS`; функции `upgradeCost`, `tierForDay`, `seasonForDay`, `buildRoster`, `dayDuration`, `pickEvent`, `makeQuest` |
| `js/storage.js` | `class StorageManager`: `defaults()`, `load()`, `save(data)`, `reset()` |
| `js/audio.js` | `class Sfx`: процедурные звуки (`tone`, `noise`), музыка, `setMuted`, `setMusic` |
| `js/fx.js` | `class Fx`: частицы (`burst`, `dust`, `stars`, `ring`, `smoke`, `confetti`), надписи (`text`), летящие монеты (`coinFly`), тряска `addShake`, вспышка `addFlash`; `update`, `drawWorld`, `drawTexts`, `drawCoins` |
| `js/world.js` | `class World(tier, seasonIdx)`: `build`, коллизии (`resolve`, `avoid`, `isFree`, `freeSpot`), лужи (`addPuddle`, `inMud`), `update`, отрисовка земли и пропов, постройки (амбар, дом, мельница, сарай, курятник, колодец) |
| `js/pig.js` | `class Pig(type, x, y, day)`: ИИ (блуждание, паника, усталость через `stam`/`tired`, таран для Кабана и Босса, побег Ниндзи через `beginEscape`, `teleport`), `startBurst`, `catchTo`, `knock`, отрисовка `draw`, `drawBody`, `drawOverhead` |
| `js/player.js` | `drawFarmer`, `drawHat`; `class Player`: `canSwing`, `swing(missed)`, `startDash`, `update(dt, g, ix, iy)`, `draw`; оглушение `stun` |
| `js/helper.js` | `class Helper(index, x, y)`: напарник с палитрой, `pickTarget`, `update`, `draw`; `class Dog`: пёс Бобик, облаивает свиней |
| `js/shop.js` | `class Shop(game, ui)`: вкладки «улучшения», «команда», «шляпы», «достижения», «ферма» (престиж); `render`, покупки |
| `js/ui.js` | `class UI(game)`: HUD (`setHud`, `updateHud`), баннеры и тосты, окно результата `showResult`, магазин, пауза, тач-управление (джойстик, кнопки) |
| `js/game.js` | `class Game` (`window.game`): состояния title/intro/play/ending/result, игровой цикл, камера, волны, комбо, бонусы, отрисовка холста и HUD-слоёв (миникарта, комбо, стрелки) |

## Ключевые константы (CONFIG в js/config.js)
- Фермер: `PLAYER_SPEED 250`, `PLAYER_RADIUS 15`, `CATCH_RADIUS 64`.
- Сачок: `SWING_COOLDOWN 0.55` с; при промахе `SWING_MISS_FACTOR 0.6` (перезарядка короче).
- Рывок: `DASH_SPEED 800`, `DASH_TIME 0.18` с, `DASH_COOLDOWN 2.6` с.
- Комбо: `COMBO_WINDOW 3.6` с, `COMBO_STEP 0.2` (+20% за звено), `COMBO_MAX_MULT 6`.
- Оглушение: `STUN_TIME 0.95` с.
- Бонусы на поле: `POWERUP_INTERVAL 12` с, `POWERUP_LIFETIME 16` с, `POWERUP_MAX 3`.
- Престиж: `PRESTIGE_DAY 20`, `PRESTIGE_BONUS 0.5` (+50% за каждую продажу).
- Карта: `WORLD_SIZES [[1500,1050],[2000,1350],[2500,1650]]`, `TIER_DAYS [1, 7, 15]`.
- Сезоны: `SEASON_LENGTH 6`.
- Виды свиней (`PIG_TYPES`, поле `reward` — базовая награда в монетах): Хрюша 2, Поросёнок 1, Шустрик 4, Кабан 12 (`hp 3`, `chargeSpeed 500`), Грязнуля 4, Ниндзя 6, Золотая 15 (`life 15` с), Хряк-Босс 40 (`hp 6`, `chargeSpeed 560`).
- Улучшения (`UPGRADES`: `max`, `base`, `growth`): boots 10/15/1.55; net 10/20/1.55; hands 8/25/1.6; dash 6/30/1.6; combo 6/30/1.6; bank 12/40/1.6; clock 6/35/1.6; luck 6/45/1.6.
- Команда (`TEAM`): helpers — цены 60, 200, 500, 1100, дни 3, 8, 14, 20; dogs — цены 120, 420, дни 5, 12.

## Формулы
- **Свиней в день** (`buildRoster`): `n = min(44, 4 + round(1.15 · day))`; при событии «Нашествие поросят» `n += 6`. Боссы, кабаны и заранее заданные свиньи входят в `n`.
  - Босс: если `day % 5 === 0`, в ростере ровно один Босс; кабанов в этот день нет.
  - Кабаны: с 4-го дня, `min(3, 1 + floor((day − 4) / 7))` штук.
  - Заранее заданные: день 2 — 3 Поросёнка; день 3 — Шустрик; день 6 — Грязнуля; день 8 — Ниндзя.
  - Остальные добиваются случайно: Ниндзя `min(0.16, 0.08 + 0.004·day)` с 8-го; Грязнуля 0.11 с 6-го; Шустрик `min(0.22, 0.1 + 0.008·day)` с 3-го; Поросёнок 0.2 со 2-го (0.6 при нашествии); иначе Хрюша.
- **Длительность дня** (`dayDuration`): `26 + 3.4 · N + 18 · боссы + 5 · кабаны`, где `N` — длина ростера.
- **Цена улучшения** (`upgradeCost(up, level)`): `raw = base · growth^level`; если `raw < 100`, округление до 5, иначе до 10. Уровень считается с 0.
- **События** (`pickEvent`): не раньше 7-го дня и не в дни босса; вероятность 0.38; равновероятный выбор из четырёх.
- **Задание дня** (`makeQuest`): награда `6 + 2·day`; цель комбо `min(16, 3 + floor(day/3))`; мульти-улов 2 (3 с 12-го дня); «Закончить, пока осталось 45% времени»; 2 бонуса; «Без рывка» с 3-го дня; «Не попасться кабану/боссу», если они в ростере.
- **Сезон** (`seasonForDay`): `floor((day − 1) / 6) % 4` → 0 лето, 1 осень, 2 зима, 3 весна.
- **Уровень карты** (`tierForDay`): индекс последнего порога из `TIER_DAYS`, не превышающий день.

## Структура сохранения (js/storage.js → defaults)
Ключ: `svinolov_save_v2`. Сохранение пишет `{ ...data, updatedAt }`.
- `v: 2`, `coins`, `day: 1`, `prestige: 0`
- `upgrades`: по нулю для каждого id из `UPGRADES`
- `helpers: 0`, `dogs: 0`
- `hats: ['straw']`, `hat: 'straw'`
- `ach: {}`, `seen: {}`, `tutorial: false`
- `stats`: `totalPigs`, `totalCoins`, `bestCombo`, `bestMulti`, `goldCaught`, `bossKilled`, `ninjaCaught`, `perfectDays`, `bestDay: 1`, `prestige`, `daysPlayed`
- `settings: { muted: false, music: true }`

`load()` мержит сохранение с дефолтами по уровням (`upgrades`, `stats`, `settings`, `ach`, `seen`), `hats` без пустого массива, `coins` и `day` приводятся к неотрицательным целым (`day` не меньше 1). Ошибки чтения логируются, возвращаются дефолты.

## Идеи на будущее
1. Вынести пороги звёзд дня (1–3 звезды) в `CONFIG`, сейчас они не в `config.js`.
2. Скрипт в Node для симуляции кривой баланса: число свиней, длительность дня, цены улучшений по дням.
3. Проверка тач-управления на реальных телефонах (джойстик и кнопки 🕸️ и 💨).
4. Миграция сохранения с версии 1 (сейчас ключ v2, старые данные не читаются).
