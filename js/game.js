/**
 * Полифилл для ctx.roundRect для совместимости со всеми браузерами
 */
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
        let r = typeof radii === 'number' ? radii : (Array.isArray(radii) ? radii[0] : 0) || 0;
        r = Math.min(r, w / 2, h / 2);
        this.beginPath();
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    };
}

/**
 * Глобальная конфигурация баланса игры «Свинолов»
 */
const CONFIG = {
    // Баланс свиней и дней
    BASE_PIGS_COUNT: 2,        // В начале всего 2 свиньи для мягкого старта
    COIN_REWARD_PER_PIG: 1,    // Монет за обычную пойманную свинью

    // Напарники (каждые 10-15 дней, 1-й: 50, 2-й: 75, 3-й: 100...)
    HELPER_BASE_DAY: 10,       // 1-й доступен с 10 дня
    HELPER_STEP_DAY: 10,       // Следующие каждые 10 дней (день 20, 30...)
    HELPER_BASE_COST: 50,      // 1-й стоит 50 монет
    HELPER_STEP_COST: 25,      // +25 монет за каждого следующего

    // Большая свинья
    BIG_PIG_START_DAY: 15,     // Появляется с 15-20 дня
    BIG_PIG_REWARD: 10,        // Большая свинья приносит 10 монет

    // Расширение карты
    EXPANDED_WORLD_DAY: 20,    // С 20 дня открываются новые зоны деревни

    // Бонус за быстрый улов
    SPEED_BONUS_BASE_TIME: 14, // Базовое целевое время (секунды)
    SPEED_BONUS_PER_PIG: 3.5,  // Дополнительно секунд на каждую свинку дня
    SPEED_BONUS_COINS: 3,      // Награда за быстрый улов

    // Скорости и физика
    PIG_BASE_SPEED: 80,        // Базовая скорость блуждания (px/s)
    PIG_PANIC_SPEED: 185,      // Скорость панического разбега (px/s)
    PIG_PANIC_RADIUS: 125,     // Радиус испуга свиньи (px)

    // Игрок-фермер
    PLAYER_SPEED: 235,         // Скорость перемещения (WASD)
    CATCH_RADIUS: 52,          // Небольшой кружок области действия сачка вокруг игрока
    CATCH_COOLDOWN: 1.0        // Ровно 1 секунда между поимками свиней
};

/**
 * Главный класс игры «Свинолов»
 */
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Модули сохранения, интерфейса и магазина
        this.storage = new StorageManager();
        this.ui = new UI();
        this.shop = new Shop();

        // Загрузка состояния
        const savedData = this.storage.load();
        this.coins = savedData.coins || 0;
        this.day = savedData.day || 1;
        this.totalPigsCaught = savedData.totalPigsCaught || 0;
        this.upgrades = savedData.upgrades || {};

        // Размеры окна и виртуального мира
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.isExpandedWorld = this.day >= CONFIG.EXPANDED_WORLD_DAY;
        this.worldWidth = this.isExpandedWorld ? Math.floor(this.width * 1.6) : this.width;
        this.worldHeight = this.isExpandedWorld ? Math.floor(this.height * 1.6) : this.height;

        // Камера
        this.camX = 0;
        this.camY = 0;

        // Центральная база (Амбар)
        this.barn = {
            x: 0,
            y: 0,
            width: 190,
            height: 145,
            doorWidth: 52,
            doorHeight: 56,
            doorOpenTimer: 0
        };

        // Декоративные домики деревни вокруг
        this.houses = [];

        // Игрок (фермер-свинолов)
        this.player = new Player(this.worldWidth / 2, this.worldHeight / 2 + 120, CONFIG);
        this.catchers = [this.player];

        // Список напарников
        this.helpers = [];

        // Применяем улучшения и создаем напарников
        this.applyUpgrades();

        // Таймер для бонуса быстрого улова
        this.dayStartTime = performance.now();

        // Свиньи текущего дня
        this.pigs = [];
        this.totalDayPigs = 0;
        this.caughtDayPigs = 0;
        this.isDayTransitioning = false;

        // Ввод (WASD, Пробел, Мышь)
        this.keys = new Set();
        this.cursor = { x: -1000, y: -1000, isActive: false };

        // Декорации поля (пучки травы, тропинки, цветочки)
        this.decorations = [];
        this.paths = [];
        this.extraZones = []; // сад, тыквы, пруд
        this.windmillAngle = 0; // вращение лопастей мельницы

        // Игровой цикл
        this.lastTime = performance.now();
        this.isRunning = false;

        this.init();
    }

    /**
     * Применение купленных улучшений к персонажу и напарникам
     */
    applyUpgrades() {
        const spdLvl = this.upgrades.speedLevel || 1;
        const radLvl = this.upgrades.radiusLevel || 1;
        const cdLvl = this.upgrades.cooldownLevel || 1;

        // Скорость игрока
        this.player.speed = CONFIG.PLAYER_SPEED * (1 + (spdLvl - 1) * 0.15);

        // Радиус зоны сачка
        this.player.catchRadius = CONFIG.CATCH_RADIUS * (1 + (radLvl - 1) * 0.15);

        // Кулдаун сачка
        this.player.catchCooldown = Math.max(0.4, CONFIG.CATCH_COOLDOWN - (cdLvl - 1) * 0.15);

        // Напарники
        const count = this.upgrades.helpersCount || 0;
        this.helpers = [];
        this.catchers = [this.player];

        for (let i = 0; i < count; i++) {
            const spawnX = (this.houses[0] ? this.houses[0].x + 40 : this.worldWidth / 2) + (i * 22);
            const spawnY = (this.houses[0] ? this.houses[0].y + 90 : this.worldHeight / 2 + 100) + (i * 18);
            const h = new Helper(spawnX, spawnY, CONFIG, i);
            this.helpers.push(h);
            this.catchers.push(h);
        }
    }

    /**
     * Добавление нового купленного напарника
     */
    addNewHelper() {
        const index = (this.upgrades.helpersCount || 1) - 1;
        const spawnX = (this.houses[0] ? this.houses[0].x + 40 : this.worldWidth / 2) + (index * 22);
        const spawnY = (this.houses[0] ? this.houses[0].y + 90 : this.worldHeight / 2 + 100) + (index * 18);
        const h = new Helper(spawnX, spawnY, CONFIG, index);
        this.helpers.push(h);
        this.catchers.push(h);
        this.updateHUDAndHelperButton();
    }

    /**
     * Инициализация мира и событий
     */
    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.setupKeyboardInput();
        this.setupPointerInput();
        this.setupMobileControls();

        // Кнопка открытия Магазина улучшений
        const btnOpenShop = document.getElementById('btn-open-shop');
        if (btnOpenShop) {
            btnOpenShop.addEventListener('click', () => {
                this.ui.initAudio();
                this.shop.open(this);
            });
        }

        // Слушатель кнопки быстрого найма напарника в HUD
        if (this.ui.btnBuyHelper) {
            this.ui.btnBuyHelper.addEventListener('click', () => {
                this.tryHireHelper();
            });
        }

        // Сброс прогресса
        if (this.ui.btnReset) {
            this.ui.btnReset.addEventListener('click', () => {
                if (confirm('Сбросить весь прогресс (монеты, день и пойманных свиней)?')) {
                    this.storage.reset();
                    location.reload();
                }
            });
        }

        // Старт текущего дня
        this.startDay(this.day);

        // Старт игрового цикла
        this.isRunning = true;
        this.lastTime = performance.now();
        requestAnimationFrame((time) => this.loop(time));
    }

    /**
     * Адаптивный ресайз холста и перерасчет позиций зданий
     */
    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        // Расширение карты деревни с 20-го дня
        this.isExpandedWorld = this.day >= CONFIG.EXPANDED_WORLD_DAY;
        this.worldWidth = this.isExpandedWorld ? Math.floor(this.width * 1.6) : this.width;
        this.worldHeight = this.isExpandedWorld ? Math.floor(this.height * 1.6) : this.height;

        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;

        this.ctx.resetTransform();
        this.ctx.scale(dpr, dpr);

        // База (Амбар) строго в центре мира
        this.barn.width = Math.min(220, Math.max(180, Math.floor(this.worldWidth * 0.18)));
        this.barn.height = Math.min(160, Math.max(130, Math.floor(this.worldHeight * 0.18)));
        this.barn.doorWidth = Math.floor(this.barn.width * 0.28);
        this.barn.doorHeight = Math.floor(this.barn.height * 0.38);
        this.barn.x = Math.floor((this.worldWidth - this.barn.width) / 2);
        this.barn.y = Math.floor((this.worldHeight - this.barn.height) / 2 - 20);

        // Расстановка домиков и дополнительных зон деревни
        this.setupVillageHouses();

        // Генерация текстуры травы и тропинок
        this.generateEnvironment();
    }

    /**
     * Создание декоративных домиков деревни
     */
    setupVillageHouses() {
        const W = this.worldWidth;
        const H = this.worldHeight;

        this.houses = [
            // 1. Уютный жилой дом фермера с трубой (северо-запад)
            {
                type: 'farmhouse',
                x: Math.max(25, Math.floor(W * 0.1)),
                y: Math.max(25, Math.floor(H * 0.1)),
                width: 130,
                height: 105,
                color: '#78350f',
                roofColor: '#b91c1c'
            },
            // 2. Ветряная мельница (северо-восток)
            {
                type: 'windmill',
                x: Math.min(W - 150, Math.floor(W * 0.82)),
                y: Math.max(30, Math.floor(H * 0.1)),
                width: 100,
                height: 125,
                color: '#e2e8f0',
                roofColor: '#854d0e'
            },
            // 3. Сарайчик для сена (юго-запад)
            {
                type: 'shed',
                x: Math.max(30, Math.floor(W * 0.1)),
                y: Math.min(H - 130, Math.floor(H * 0.78)),
                width: 115,
                height: 90,
                color: '#92400e',
                roofColor: '#ca8a04'
            },
            // 4. Курятник с заборчиком (юго-восток)
            {
                type: 'coop',
                x: Math.min(W - 150, Math.floor(W * 0.82)),
                y: Math.min(H - 125, Math.floor(H * 0.78)),
                width: 110,
                height: 85,
                color: '#a16207',
                roofColor: '#dc2626'
            }
        ];

        // Дополнительные зоны расширенной карты (сад, тыквы, пруд)
        this.extraZones = [];
        if (this.isExpandedWorld) {
            this.extraZones = [
                // 🍎 Яблоневый сад
                { type: 'orchard', x: Math.floor(W * 0.05), y: Math.floor(H * 0.42), width: 140, height: 120 },
                // 🎃 Огород с тыквами
                { type: 'pumpkins', x: Math.floor(W * 0.83), y: Math.floor(H * 0.42), width: 130, height: 110 },
                // 🦆 Пруд с кувшинками
                { type: 'pond', x: Math.floor(W * 0.44), y: Math.floor(H * 0.82), width: 150, height: 95 }
            ];
        }
    }

    /**
     * Получить список всех препятствий для коллизий
     */
    getObstacles() {
        const list = [
            // Центральный амбар
            {
                x: this.barn.x,
                y: this.barn.y,
                width: this.barn.width,
                height: this.barn.height - 12
            }
        ];

        // Добавляем все домики
        for (const h of this.houses) {
            list.push({
                x: h.x,
                y: h.y,
                width: h.width,
                height: h.height - 10
            });
        }
        return list;
    }

    /**
     * Генерация живописной травы, тропинок и растительности
     */
    generateEnvironment() {
        this.decorations = [];

        const W = this.worldWidth;
        const H = this.worldHeight;

        // Грунтовые тропинки от центрального амбара к домикам
        const barnCenterX = this.barn.x + this.barn.width / 2;
        const barnBottomY = this.barn.y + this.barn.height;

        this.paths = [
            // Главная тропа вниз от ворот амбара
            { fromX: barnCenterX, fromY: barnBottomY, toX: barnCenterX, toY: H - 40, width: 34 },
            // Тропа к дому фермера
            { fromX: barnCenterX - 40, fromY: this.barn.y + 40, toX: this.houses[0].x + 60, toY: this.houses[0].y + 90, width: 22 },
            // Тропа к мельнице
            { fromX: barnCenterX + 40, fromY: this.barn.y + 40, toX: this.houses[1].x + 40, toY: this.houses[1].y + 100, width: 22 },
            // Тропа к сараю
            { fromX: barnCenterX - 20, fromY: barnBottomY + 40, toX: this.houses[2].x + 60, toY: this.houses[2].y + 40, width: 20 },
            // Тропа к курятнику
            { fromX: barnCenterX + 20, fromY: barnBottomY + 40, toX: this.houses[3].x + 40, toY: this.houses[3].y + 40, width: 20 }
        ];

        // Пучки травы, полевые цветы и камушки
        const count = Math.floor((W * H) / 7500);
        for (let i = 0; i < count; i++) {
            const x = Math.random() * W;
            const y = Math.random() * H;

            const r = Math.random();
            let type = 'tuft'; // пучок сочной травы
            let color = '#2e6b27';

            if (r < 0.35) {
                type = 'flower';
                color = r < 0.12 ? '#fef08a' : (r < 0.24 ? '#ffffff' : '#60a5fa');
            } else if (r < 0.5) {
                type = 'clover';
                color = '#4ade80';
            } else if (r < 0.6) {
                type = 'pebble';
                color = '#94a3b8';
            }

            this.decorations.push({
                x,
                y,
                type,
                color,
                size: Math.random() * 5 + 4
            });
        }
    }

    /**
     * Настройка клавиатуры (WASD, Стрелки, Пробел)
     */
    setupKeyboardInput() {
        window.addEventListener('keydown', (e) => {
            this.ui.initAudio();

            // ПРОБЕЛ — триггер ловли в область кружка сачка вокруг фермера
            if (e.code === 'Space') {
                e.preventDefault();
                this.triggerCatchAttempt();
                return;
            }

            this.keys.add(e.code);
            this.updateMoveDirectionFromKeys();
        });

        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.code);
            this.updateMoveDirectionFromKeys();
        });

        window.addEventListener('blur', () => {
            this.keys.clear();
            this.player.setMoveDirection(0, 0);
        });
    }

    /**
     * Обновление направления WASD
     */
    updateMoveDirectionFromKeys() {
        let dx = 0;
        let dy = 0;

        if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx -= 1;
        if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += 1;
        if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dy -= 1;
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dy += 1;

        this.player.setMoveDirection(dx, dy);
    }

    /**
     * Настройка мыши и тача: ЛКМ триггерит область сачка вокруг игрока
     */
    setupPointerInput() {
        const getCanvasCoords = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - rect.left + this.camX,
                y: clientY - rect.top + this.camY
            };
        };

        const handlePointerStart = (e) => {
            this.ui.initAudio();
            const pos = getCanvasCoords(e);
            this.cursor.x = pos.x;
            this.cursor.y = pos.y;
            this.cursor.isActive = true;

            // Нажатие ЛКМ / тапа активирует взмах сачком на область вокруг фермера!
            this.triggerCatchAttempt();
        };

        const handlePointerMove = (e) => {
            const pos = getCanvasCoords(e);
            this.cursor.x = pos.x;
            this.cursor.y = pos.y;
            this.cursor.isActive = true;
        };

        const handlePointerEnd = () => {
            if ('ontouchstart' in window) {
                this.cursor.isActive = false;
            }
        };

        this.canvas.addEventListener('mousedown', handlePointerStart);
        window.addEventListener('mousemove', handlePointerMove);
        window.addEventListener('mouseup', handlePointerEnd);

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handlePointerStart(e);
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            handlePointerMove(e);
        }, { passive: false });

        this.canvas.addEventListener('touchend', handlePointerEnd);
        this.canvas.addEventListener('touchcancel', handlePointerEnd);
    }

    /**
     * Экранный D-Pad и кнопка для смартфонов
     */
    setupMobileControls() {
        const dpadButtons = document.querySelectorAll('.dpad-btn');
        const touchCatchBtn = document.getElementById('btn-touch-catch');

        const dpadState = { up: false, down: false, left: false, right: false };

        const updateDpadMovement = () => {
            let dx = 0;
            let dy = 0;
            if (dpadState.left) dx -= 1;
            if (dpadState.right) dx += 1;
            if (dpadState.up) dy -= 1;
            if (dpadState.down) dy += 1;
            this.player.setMoveDirection(dx, dy);
        };

        dpadButtons.forEach(btn => {
            const dir = btn.getAttribute('data-dir');
            const press = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.ui.initAudio();
                dpadState[dir] = true;
                btn.classList.add('active');
                updateDpadMovement();
            };
            const release = (e) => {
                e.preventDefault();
                e.stopPropagation();
                dpadState[dir] = false;
                btn.classList.remove('active');
                updateDpadMovement();
            };

            btn.addEventListener('touchstart', press, { passive: false });
            btn.addEventListener('touchend', release);
            btn.addEventListener('touchcancel', release);
            btn.addEventListener('mousedown', press);
            btn.addEventListener('mouseup', release);
            btn.addEventListener('mouseleave', release);
        });

        if (touchCatchBtn) {
            const handleCatch = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.ui.initAudio();
                this.triggerCatchAttempt();
            };
            touchCatchBtn.addEventListener('touchstart', handleCatch, { passive: false });
            touchCatchBtn.addEventListener('click', handleCatch);
        }
    }

    /**
     * Попытка нанять напарника (1-й за 50, 2-й за 75, 3-й за 100...)
     */
    tryHireHelper() {
        this.ui.initAudio();
        const currentCount = this.upgrades.helpersCount || 0;
        const nextCost = CONFIG.HELPER_BASE_COST + currentCount * CONFIG.HELPER_STEP_COST;
        const reqDay = CONFIG.HELPER_BASE_DAY + currentCount * CONFIG.HELPER_STEP_DAY;

        if (this.day < reqDay) {
            this.ui.addFloatingText(this.player.x, this.player.y - 25, `Доступно с ${reqDay} дня!`, '#ef4444');
            return;
        }

        if (this.coins < nextCost) {
            this.ui.addFloatingText(this.player.x, this.player.y - 25, `Нужно ${nextCost} 🪙 (у вас ${this.coins})`, '#ef4444');
            return;
        }

        // Успешная покупка
        this.coins -= nextCost;
        this.upgrades.helpersCount = currentCount + 1;
        this.addNewHelper();

        this.ui.playHireSound();
        this.ui.addFloatingText(this.player.x, this.player.y - 25, `🤝 Напарник #${this.upgrades.helpersCount} нанят! -${nextCost} 🪙`, '#22c55e');
        this.updateHUDAndHelperButton();
        this.saveProgress();
    }

    /**
     * Синхронизация HUD и кнопки напарника
     */
    updateHUDAndHelperButton() {
        this.ui.updateHUD(this.coins, this.day, this.caughtDayPigs, this.totalDayPigs);
        const count = this.upgrades.helpersCount || 0;
        const nextCost = CONFIG.HELPER_BASE_COST + count * CONFIG.HELPER_STEP_COST;
        const reqDay = CONFIG.HELPER_BASE_DAY + count * CONFIG.HELPER_STEP_DAY;
        this.ui.updateHelperButton(this.day, this.coins, false, reqDay, nextCost);

        if (this.ui.helperBtnText) {
            if (this.day >= reqDay) {
                this.ui.helperBtnText.textContent = `Напарник #${count + 1} (${nextCost}🪙)`;
            } else {
                this.ui.helperBtnText.textContent = `Напарник #${count + 1} (${reqDay}дн)`;
            }
        }
    }

    /**
     * Основная механика: активация сачка по ЛКМ / Пробелу на небольшой кружок вокруг.
     * Обычную свинью ловит 1 ловец (кулдаун 1 сек).
     * Большую свинью (с 15 дня) можно поймать ТОЛЬКО вдвоём с напарником (+10 🪙)!
     */
    triggerCatchAttempt() {
        if (!this.player.canCatch()) {
            return;
        }

        // Анимация взмаха сачком у игрока
        this.player.swing();

        // Поиск ближайшей свиньи внутри кружка сачка вокруг фермера
        let targetPig = null;
        let minDistance = Infinity;
        const catchReach = this.player.catchRadius;

        for (const pig of this.pigs) {
            if (pig.caught || pig.isInBarn) continue;

            const dist = Math.hypot(pig.x - this.player.x, pig.y - this.player.y);
            if (dist <= catchReach + pig.radius && dist < minDistance) {
                minDistance = dist;
                targetPig = pig;
            }
        }

        if (targetPig) {
            // Если это Большая свинья: нужно ловить вдвоём с напарником!
            if (targetPig.isBig) {
                const helperNearby = this.helper && Math.hypot(this.helper.x - targetPig.x, this.helper.y - targetPig.y) <= (this.helper.catchRadius + targetPig.radius + 20);

                if (!helperNearby) {
                    // Игрок один — большая свинья вырывается!
                    this.ui.addFloatingText(targetPig.x, targetPig.y - 30, '⚠️ Нужен напарник (вдвоём)!', '#ef4444');
                    targetPig.state = 'PANIC';
                    targetPig.speed = CONFIG.PIG_PANIC_SPEED * 1.2;
                    return;
                }

                // Напарник рядом! Ловят большую свинью вдвоём!
                this.helper.swing();
                this.helper.onSuccessfulCatch();
                this.player.onSuccessfulCatch();
                this.catchPig(targetPig);
            } else {
                // Обычная свинья: ловит игрок
                this.player.onSuccessfulCatch();
                this.catchPig(targetPig);
            }
        }
    }

    /**
     * Получение разнообразных точек спавна свиней по деревне
     */
    getSpawnLocations() {
        const locs = [];
        if (this.houses[1]) locs.push({ x: this.houses[1].x + 30, y: this.houses[1].y + this.houses[1].height + 35 });
        if (this.houses[0]) locs.push({ x: this.houses[0].x + this.houses[0].width + 30, y: this.houses[0].y + 55 });
        if (this.houses[2]) locs.push({ x: this.houses[2].x + this.houses[2].width + 25, y: this.houses[2].y + 40 });
        if (this.houses[3]) locs.push({ x: this.houses[3].x - 30, y: this.houses[3].y + 45 });
        locs.push({ x: this.barn.x + this.barn.width / 2, y: Math.max(50, this.barn.y - 45) });
        locs.push({ x: this.barn.x + this.barn.width / 2, y: Math.min(this.height - 50, this.barn.y + this.barn.height + 70) });
        return locs;
    }

    /**
     * Старт дня: спавн свиней сразу в нескольких точках карты,
     * плавный рост: в начале 2 свиньи, прибавляются раз в 1-2 дня.
     * На 15-20 дне появляется Большая свинья (+10 монет, ловится вдвоём)!
     */
    startDay(dayNumber) {
        this.day = dayNumber;
        this.isDayTransitioning = false;

        // Фиксация времени старта дня для бонуса за скорость
        this.dayStartTime = performance.now();

        // Количество свиней: день 1 — 2; день 2 — 3; день 3 — 3; день 4 — 4...
        this.totalDayPigs = CONFIG.BASE_PIGS_COUNT + Math.floor(dayNumber / 2);
        this.caughtDayPigs = 0;

        // Распахиваем ворота амбара
        this.barn.doorOpenTimer = 0.8;

        const spawnLocs = this.getSpawnLocations();
        this.pigs = [];

        // Большая свинья появляется начиная с 15 дня
        const hasBigPig = (dayNumber >= CONFIG.BIG_PIG_START_DAY);

        for (let i = 0; i < this.totalDayPigs; i++) {
            const loc = spawnLocs[i % spawnLocs.length];
            const spawnX = Math.max(40, Math.min(this.width - 40, loc.x + (Math.random() - 0.5) * 50));
            const spawnY = Math.max(40, Math.min(this.height - 40, loc.y + (Math.random() - 0.5) * 50));

            // Первая свинья на 15+ дне — Большая свинья (+10 монет)!
            const isBig = hasBigPig && (i === 0);
            const pig = new Pig(spawnX, spawnY, CONFIG, { isBig });

            const angle = Math.random() * Math.PI * 2;
            pig.vx = Math.cos(angle);
            pig.vy = Math.sin(angle);
            pig.state = 'WANDER';
            pig.wanderTimer = 1.0 + Math.random() * 2.0;

            this.pigs.push(pig);
        }

        this.updateHUDAndHelperButton();
    }

    /**
     * Поимка свиньи: обычная (+1 монета), большая (+10 монет)
     */
    catchPig(pig) {
        if (pig.caught) return;

        const doorCenterX = this.barn.x + this.barn.width / 2;
        const doorBottomY = this.barn.y + this.barn.height - 10;

        const caught = pig.catch(doorCenterX, doorBottomY);
        if (caught) {
            this.caughtDayPigs++;
            const reward = pig.isBig ? CONFIG.BIG_PIG_REWARD : CONFIG.COIN_REWARD_PER_PIG;
            this.coins += reward;
            this.totalPigsCaught++;

            // Открываем двери амбара
            this.barn.doorOpenTimer = 0.7;

            // Визуальный и аудио отклик
            if (pig.isBig) {
                this.ui.addFloatingText(pig.x, pig.y - 25, `👑 БОЛЬШАЯ СВИНЬЯ! +${reward} 🪙`, '#f59e0b');
                this.ui.playDayWinSound();
            } else {
                this.ui.addFloatingText(pig.x, pig.y - 18, `+${reward} 🪙`);
                this.ui.playCoinSound();
            }

            this.updateHUDAndHelperButton();
            this.saveProgress();

            if (this.caughtDayPigs >= this.totalDayPigs && !this.isDayTransitioning) {
                this.isDayTransitioning = true;
                setTimeout(() => {
                    this.onDayComplete();
                }, 850);
            }
        }
    }

    /**
     * Завершение дня: расчет бонуса за быстрый улов
     */
    onDayComplete() {
        const timeTakenSec = Math.max(1, (performance.now() - this.dayStartTime) / 1000);
        const targetTimeSec = CONFIG.SPEED_BONUS_BASE_TIME + this.totalDayPigs * CONFIG.SPEED_BONUS_PER_PIG;

        // Расчет бонуса за скорость
        let speedBonus = 0;
        if (timeTakenSec <= targetTimeSec) {
            speedBonus = CONFIG.SPEED_BONUS_COINS;
            this.coins += speedBonus;
        }

        // Общий заработок дня
        let earnedThisDay = 0;
        for (const p of this.pigs) {
            earnedThisDay += (p.isBig ? CONFIG.BIG_PIG_REWARD : CONFIG.COIN_REWARD_PER_PIG);
        }

        this.ui.showDayComplete(this.day, earnedThisDay, speedBonus, timeTakenSec, () => {
            this.startDay(this.day + 1);
            this.saveProgress();
        });
    }

    /**
     * Сохранение прогресса
     */
    saveProgress() {
        this.storage.save({
            coins: this.coins,
            day: this.day,
            totalPigsCaught: this.totalPigsCaught,
            upgrades: {
                ...this.upgrades,
                hasHelper: this.hasHelper
            }
        });
    }

    /**
     * Обновление физики и логики
     */
    update(dt) {
        const safeDt = Math.min(dt, 0.1);

        // Вращение лопастей ветряной мельницы
        this.windmillAngle += safeDt * 1.4;

        // Таймер открытых ворот амбара
        if (this.barn.doorOpenTimer > 0) {
            this.barn.doorOpenTimer -= safeDt;
        }

        // Препятствия
        const obstacles = this.getObstacles();

        // Плавное движение камеры за фермером
        if (this.isExpandedWorld) {
            const targetCamX = this.player.x - this.width / 2;
            const targetCamY = this.player.y - this.height / 2;
            this.camX += (targetCamX - this.camX) * 0.12;
            this.camY += (targetCamY - this.camY) * 0.12;

            this.camX = Math.max(0, Math.min(this.worldWidth - this.width, this.camX));
            this.camY = Math.max(0, Math.min(this.worldHeight - this.height, this.camY));
        } else {
            this.camX = 0;
            this.camY = 0;
        }

        // Препятствия
        const obstacles = this.getObstacles();

        // 1. Игрок
        this.player.update(safeDt, this.worldWidth, this.worldHeight, obstacles);

        // 2. Все нанятые напарники (автономная ловля свиней)
        for (const helper of this.helpers) {
            helper.update(safeDt, this.worldWidth, this.worldHeight, obstacles, this.pigs);

            if (helper.canCatch()) {
                for (const pig of this.pigs) {
                    if (pig.caught || pig.isInBarn) continue;

                    const dist = Math.hypot(pig.x - helper.x, pig.y - helper.y);
                    // Обычная свинья: напарник ловит самостоятельно!
                    if (!pig.isBig && dist <= helper.catchRadius + pig.radius) {
                        helper.swing();
                        helper.onSuccessfulCatch();
                        this.catchPig(pig);
                        break;
                    }
                }
            }
        }

        // 3. Угрозы для свиней (курсор + ловцы)
        const threats = [];
        if (this.cursor.isActive) {
            threats.push(this.cursor);
        }
        for (const catcher of this.catchers) {
            threats.push({ x: catcher.x, y: catcher.y });
        }

        // 4. Свиньи (паника, блуждание, обход зданий)
        for (const pig of this.pigs) {
            pig.update(safeDt, this.worldWidth, this.worldHeight, threats, obstacles);
        }
    }

    /**
     * Отрисовка игрового мира с виртуальной камерой
     */
    draw(dt) {
        const ctx = this.ctx;

        // 1. Сдвиг виртуальной камеры
        ctx.save();
        ctx.translate(-Math.round(this.camX), -Math.round(this.camY));

        // Природный стиль луга на весь мир
        this.drawGrassField(ctx);

        // Грунтовые тропинки деревни
        this.drawPaths(ctx);

        // Дополнительные зоны расширенной карты (сад, тыквы, пруд)
        this.drawExtraZones(ctx);

        // Декорации (пучки травы, клевер, ромашки)
        this.drawDecorations(ctx);

        // Декоративные домики деревни
        this.drawVillageHouses(ctx);

        // Центральная база — Амбар
        this.drawBarn(ctx);

        // Свиньи
        for (const pig of this.pigs) {
            pig.draw(ctx);
        }

        // Фермер и напарники с сачками
        for (const catcher of this.catchers) {
            catcher.draw(ctx);
        }

        // Плавающие надписи (+1 🪙, +10 🪙)
        this.ui.updateAndDrawFloatingTexts(ctx, dt);

        ctx.restore();

        // 2. Радар-миникарта (на расширенной карте после 20 дня)
        if (this.isExpandedWorld) {
            this.drawMinimap(ctx);
        }
    }

    /**
     * Отрисовка стильного мягкого газона на весь мир
     */
    drawGrassField(ctx) {
        const W = this.worldWidth;
        const H = this.worldHeight;

        // Базовый сочный травяной цвет
        ctx.fillStyle = '#47823b';
        ctx.fillRect(0, 0, W, H);

        // Мягкий природный градиент освещения луга
        const grad = ctx.createRadialGradient(
            W / 2, H / 2, 90,
            W / 2, H / 2, Math.max(W, H) * 0.75
        );
        grad.addColorStop(0, 'rgba(102, 187, 85, 0.22)');
        grad.addColorStop(1, 'rgba(28, 59, 23, 0.35)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Органические мягкие полосы поля
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        const stripeSize = 64;
        for (let x = 0; x < W; x += stripeSize * 2) {
            ctx.fillRect(x, 0, stripeSize, H);
        }
    }

    /**
     * Отрисовка зон расширенной карты (яблоневый сад, тыквы, пруд)
     */
    drawExtraZones(ctx) {
        if (!this.isExpandedWorld) return;

        for (const zone of this.extraZones) {
            ctx.save();

            if (zone.type === 'orchard') {
                // 🍎 Яблоневый сад
                ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
                ctx.beginPath();
                ctx.roundRect(zone.x, zone.y, zone.width, zone.height, 14);
                ctx.fill();
                ctx.strokeStyle = '#15803d';
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 6]);
                ctx.stroke();

                // Вывеска сада
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 11px sans-serif';
                ctx.fillText('🍎 ЯБЛОНЕВЫЙ САД', zone.x + 12, zone.y - 6);

                // Яблони
                const trees = [
                    { x: zone.x + 35, y: zone.y + 40 },
                    { x: zone.x + 105, y: zone.y + 45 },
                    { x: zone.x + 70, y: zone.y + 90 }
                ];
                for (const t of trees) {
                    // Ствол
                    ctx.fillStyle = '#78350f';
                    ctx.fillRect(t.x - 5, t.y, 10, 20);
                    // Крона
                    ctx.fillStyle = '#16a34a';
                    ctx.beginPath();
                    ctx.arc(t.x, t.y - 4, 18, 0, Math.PI * 2);
                    ctx.fill();
                    // Спелые красные яблоки
                    ctx.fillStyle = '#ef4444';
                    ctx.beginPath();
                    ctx.arc(t.x - 7, t.y - 6, 3, 0, Math.PI * 2);
                    ctx.arc(t.x + 6, t.y - 8, 3, 0, Math.PI * 2);
                    ctx.arc(t.x + 2, t.y + 2, 3, 0, Math.PI * 2);
                    ctx.fill();
                }

            } else if (zone.type === 'pumpkins') {
                // 🎃 Огород с тыквами
                ctx.fillStyle = 'rgba(180, 83, 9, 0.18)';
                ctx.beginPath();
                ctx.roundRect(zone.x, zone.y, zone.width, zone.height, 12);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 11px sans-serif';
                ctx.fillText('🎃 ОГОРОД С ТЫКВАМИ', zone.x + 10, zone.y - 6);

                // Грядки и тыквы
                for (let row = 0; row < 3; row++) {
                    const gy = zone.y + 25 + row * 28;
                    ctx.fillStyle = '#92400e';
                    ctx.fillRect(zone.x + 10, gy, zone.width - 20, 10);

                    // Тыковки на грядке
                    for (let col = 0; col < 3; col++) {
                        const px = zone.x + 25 + col * 40;
                        ctx.fillStyle = '#ea580c';
                        ctx.beginPath();
                        ctx.ellipse(px, gy + 5, 8, 7, 0, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = '#15803d';
                        ctx.fillRect(px - 1.5, gy - 1, 3, 3);
                    }
                }

            } else if (zone.type === 'pond') {
                // 🦆 Пруд с кувшинками
                ctx.fillStyle = '#0284c7';
                ctx.beginPath();
                ctx.ellipse(zone.x + zone.width / 2, zone.y + zone.height / 2, zone.width / 2, zone.height / 2, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 3;
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 11px sans-serif';
                ctx.fillText('🦆 ПРУД', zone.x + zone.width / 2 - 20, zone.y - 6);

                // Кувшинки
                ctx.fillStyle = '#16a34a';
                ctx.beginPath();
                ctx.arc(zone.x + 40, zone.y + 35, 8, 0, Math.PI * 1.7);
                ctx.lineTo(zone.x + 40, zone.y + 35);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(zone.x + 95, zone.y + 55, 9, 0.4, Math.PI * 2);
                ctx.lineTo(zone.x + 95, zone.y + 55);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    /**
     * Отрисовка радар-миникарты в углу экрана при расширенной карте
     */
    drawMinimap(ctx) {
        ctx.save();

        const mw = 130;
        const mh = 90;
        const mx = this.width - mw - 16;
        const my = this.height - mh - 20;

        // Фон миникарты
        ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
        ctx.beginPath();
        ctx.roundRect(mx, my, mw, mh, 10);
        ctx.fill();

        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Заголовок миникарты
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText('🗺️ РАДАР ФЕРМЫ', mx + 8, my + 13);

        const scaleX = (mw - 16) / this.worldWidth;
        const scaleY = (mh - 22) / this.worldHeight;
        const offsetX = mx + 8;
        const offsetY = my + 16;

        // Центральный амбар на миникарте
        ctx.fillStyle = '#b91c1c';
        ctx.fillRect(
            offsetX + this.barn.x * scaleX,
            offsetY + this.barn.y * scaleY,
            Math.max(4, this.barn.width * scaleX),
            Math.max(4, this.barn.height * scaleY)
        );

        // Свиньи
        for (const pig of this.pigs) {
            if (pig.caught || pig.isInBarn) continue;

            if (pig.isBig) {
                ctx.fillStyle = '#fbbf24'; // золотая большая свинья
                ctx.beginPath();
                ctx.arc(offsetX + pig.x * scaleX, offsetY + pig.y * scaleY, 3.5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = '#f472b6'; // обычная свинка
                ctx.beginPath();
                ctx.arc(offsetX + pig.x * scaleX, offsetY + pig.y * scaleY, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Напарники (зелёные точки)
        ctx.fillStyle = '#22c55e';
        for (const h of this.helpers) {
            ctx.beginPath();
            ctx.arc(offsetX + h.x * scaleX, offsetY + h.y * scaleY, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Игрок (яркая синяя точка)
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(offsetX + this.player.x * scaleX, offsetY + this.player.y * scaleY, 3.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /**
     * Отрисовка грунтовых тропинок от амбара к домикам
     */
    drawPaths(ctx) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const p of this.paths) {
            // Внешняя тень тропинки
            ctx.strokeStyle = '#8a6237';
            ctx.lineWidth = p.width + 4;
            ctx.beginPath();
            ctx.moveTo(p.fromX, p.fromY);
            ctx.lineTo(p.toX, p.toY);
            ctx.stroke();

            // Песчано-грунтовая поверхность
            ctx.strokeStyle = '#c99b66';
            ctx.lineWidth = p.width;
            ctx.beginPath();
            ctx.moveTo(p.fromX, p.fromY);
            ctx.lineTo(p.toX, p.toY);
            ctx.stroke();

            // Светлая колея по центру
            ctx.strokeStyle = 'rgba(245, 222, 179, 0.4)';
            ctx.lineWidth = p.width * 0.45;
            ctx.beginPath();
            ctx.moveTo(p.fromX, p.fromY);
            ctx.lineTo(p.toX, p.toY);
            ctx.stroke();
        }
        ctx.restore();
    }

    /**
     * Отрисовка пучков травы, ромашек, клевера
     */
    drawDecorations(ctx) {
        for (const dec of this.decorations) {
            if (dec.type === 'tuft') {
                ctx.strokeStyle = dec.color;
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.moveTo(dec.x, dec.y);
                ctx.lineTo(dec.x - 3, dec.y - dec.size);
                ctx.moveTo(dec.x, dec.y);
                ctx.lineTo(dec.x + 3, dec.y - dec.size * 1.1);
                ctx.moveTo(dec.x, dec.y);
                ctx.lineTo(dec.x, dec.y - dec.size * 1.2);
                ctx.stroke();
            } else if (dec.type === 'flower') {
                ctx.fillStyle = dec.color;
                ctx.beginPath();
                ctx.arc(dec.x, dec.y, dec.size * 0.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ea580c';
                ctx.beginPath();
                ctx.arc(dec.x, dec.y, dec.size * 0.22, 0, Math.PI * 2);
                ctx.fill();
            } else if (dec.type === 'clover') {
                ctx.fillStyle = dec.color;
                ctx.beginPath();
                ctx.arc(dec.x - 2, dec.y, 2.5, 0, Math.PI * 2);
                ctx.arc(dec.x + 2, dec.y, 2.5, 0, Math.PI * 2);
                ctx.arc(dec.x, dec.y - 2.5, 2.5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = dec.color;
                ctx.beginPath();
                ctx.ellipse(dec.x, dec.y, dec.size * 0.8, dec.size * 0.45, 0.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    /**
     * Отрисовка декоративных домиков деревни
     */
    drawVillageHouses(ctx) {
        for (const h of this.houses) {
            ctx.save();

            // Тень дома
            ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
            ctx.beginPath();
            ctx.roundRect(h.x - 4, h.y + h.height - 8, h.width + 8, 18, 8);
            ctx.fill();

            if (h.type === 'farmhouse') {
                // Жилой коттедж фермера
                ctx.fillStyle = h.color;
                ctx.fillRect(h.x, h.y + 30, h.width, h.height - 30);

                // Кирпичная труба с дымком
                ctx.fillStyle = '#7f1d1d';
                ctx.fillRect(h.x + 20, h.y - 10, 14, 28);
                // Дымок
                ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
                ctx.beginPath();
                ctx.arc(h.x + 27, h.y - 18, 6, 0, Math.PI * 2);
                ctx.arc(h.x + 32, h.y - 28, 8, 0, Math.PI * 2);
                ctx.fill();

                // Двускатная крыша
                ctx.fillStyle = h.roofColor;
                ctx.beginPath();
                ctx.moveTo(h.x - 10, h.y + 32);
                ctx.lineTo(h.x + h.width / 2, h.y - 4);
                ctx.lineTo(h.x + h.width + 10, h.y + 32);
                ctx.closePath();
                ctx.fill();

                // Окна с теплым светом
                ctx.fillStyle = '#fef08a';
                ctx.fillRect(h.x + 18, h.y + 44, 24, 24);
                ctx.fillRect(h.x + h.width - 42, h.y + 44, 24, 24);
                ctx.strokeStyle = '#451a03';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(h.x + 18, h.y + 44, 24, 24);
                ctx.strokeRect(h.x + h.width - 42, h.y + 44, 24, 24);

                // Дверь
                ctx.fillStyle = '#451a03';
                ctx.fillRect(h.x + h.width / 2 - 12, h.y + h.height - 36, 24, 36);

            } else if (h.type === 'windmill') {
                // Башня мельницы
                ctx.fillStyle = h.color;
                ctx.beginPath();
                ctx.moveTo(h.x + 20, h.y + h.height);
                ctx.lineTo(h.x + h.width - 20, h.y + h.height);
                ctx.lineTo(h.x + h.width - 28, h.y + 24);
                ctx.lineTo(h.x + 28, h.y + 24);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#64748b';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Купол мельницы
                ctx.fillStyle = h.roofColor;
                ctx.beginPath();
                ctx.arc(h.x + h.width / 2, h.y + 24, 24, Math.PI, 0);
                ctx.fill();

                // Вращающиеся лопасти
                const millCenterX = h.x + h.width / 2;
                const millCenterY = h.y + 24;
                ctx.save();
                ctx.translate(millCenterX, millCenterY);
                ctx.rotate(this.windmillAngle);

                ctx.strokeStyle = '#451a03';
                ctx.lineWidth = 3;
                const bladeLen = 42;
                for (let i = 0; i < 4; i++) {
                    ctx.rotate(Math.PI / 2);
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(0, -bladeLen);
                    ctx.stroke();
                    // Ткань лопасти
                    ctx.fillStyle = 'rgba(254, 243, 199, 0.85)';
                    ctx.fillRect(2, -bladeLen + 6, 10, bladeLen - 12);
                }
                ctx.restore();

            } else {
                // Сарайчик / курятник
                ctx.fillStyle = h.color;
                ctx.fillRect(h.x, h.y + 20, h.width, h.height - 20);

                ctx.fillStyle = h.roofColor;
                ctx.beginPath();
                ctx.moveTo(h.x - 8, h.y + 22);
                ctx.lineTo(h.x + h.width / 2, h.y);
                ctx.lineTo(h.x + h.width + 8, h.y + 22);
                ctx.closePath();
                ctx.fill();

                // Ворота сарая
                ctx.fillStyle = '#451a03';
                ctx.fillRect(h.x + h.width / 2 - 18, h.y + h.height - 38, 36, 38);
            }

            ctx.restore();
        }
    }

    /**
     * Отрисовка центрального амбара (База)
     */
    drawBarn(ctx) {
        const b = this.barn;

        ctx.save();

        // 1. Тень
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.beginPath();
        ctx.roundRect(b.x - 6, b.y + b.height - 10, b.width + 12, 22, 10);
        ctx.fill();

        // 2. Стены амбара
        ctx.fillStyle = '#b91c1c';
        ctx.beginPath();
        ctx.roundRect(b.x, b.y + 25, b.width, b.height - 25, 4);
        ctx.fill();

        // Вертикальные доски
        ctx.strokeStyle = '#991b1b';
        ctx.lineWidth = 1.5;
        const plankStep = 16;
        for (let px = b.x + plankStep; px < b.x + b.width; px += plankStep) {
            ctx.beginPath();
            ctx.moveTo(px, b.y + 25);
            ctx.lineTo(px, b.y + b.height);
            ctx.stroke();
        }

        // Белые декоративные фермерские балки (X)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        const leftSecW = (b.width - b.doorWidth) / 2 - 12;
        ctx.strokeRect(b.x + 8, b.y + 40, leftSecW, b.height - 52);
        ctx.beginPath();
        ctx.moveTo(b.x + 8, b.y + 40);
        ctx.lineTo(b.x + 8 + leftSecW, b.y + b.height - 12);
        ctx.moveTo(b.x + 8 + leftSecW, b.y + 40);
        ctx.lineTo(b.x + 8, b.y + b.height - 12);
        ctx.stroke();

        const rightSecX = b.x + b.width - leftSecW - 8;
        ctx.strokeRect(rightSecX, b.y + 40, leftSecW, b.height - 52);
        ctx.beginPath();
        ctx.moveTo(rightSecX, b.y + 40);
        ctx.lineTo(rightSecX + leftSecW, b.y + b.height - 12);
        ctx.moveTo(rightSecX + leftSecW, b.y + 40);
        ctx.lineTo(rightSecX, b.y + b.height - 12);
        ctx.stroke();

        // 3. Крыша
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.moveTo(b.x - 12, b.y + 28);
        ctx.lineTo(b.x + b.width / 2, b.y - 12);
        ctx.lineTo(b.x + b.width + 12, b.y + 28);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 3;
        ctx.stroke();

        // 4. Окно со свинкой на чердаке
        const winX = b.x + b.width / 2;
        const winY = b.y + 12;
        ctx.fillStyle = '#1e1b4b';
        ctx.beginPath();
        ctx.arc(winX, winY, 14, Math.PI, 0);
        ctx.lineTo(winX + 14, winY + 12);
        ctx.lineTo(winX - 14, winY + 12);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Свинка выглядывает из окна
        ctx.fillStyle = '#f9a8d4';
        ctx.beginPath();
        ctx.arc(winX, winY + 6, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.ellipse(winX, winY + 8, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(winX - 4, winY + 4, 1.2, 0, Math.PI * 2);
        ctx.arc(winX + 4, winY + 4, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // 5. Ворота амбара
        const doorX = b.x + (b.width - b.doorWidth) / 2;
        const doorY = b.y + b.height - b.doorHeight;

        ctx.fillStyle = '#291711';
        ctx.fillRect(doorX, doorY, b.doorWidth, b.doorHeight);

        // Распахивание ворот
        const isOpen = this.barn.doorOpenTimer > 0;
        const openOffset = isOpen ? Math.min(18, this.barn.doorOpenTimer * 30) : 0;

        ctx.fillStyle = '#78350f';
        ctx.fillRect(doorX - openOffset, doorY, b.doorWidth / 2, b.doorHeight);
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 2;
        ctx.strokeRect(doorX - openOffset, doorY, b.doorWidth / 2, b.doorHeight);

        ctx.fillRect(doorX + b.doorWidth / 2 + openOffset, doorY, b.doorWidth / 2, b.doorHeight);
        ctx.strokeRect(doorX + b.doorWidth / 2 + openOffset, doorY, b.doorWidth / 2, b.doorHeight);

        // Петли
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(doorX - openOffset + 2, doorY + 8, 8, 4);
        ctx.fillRect(doorX - openOffset + 2, doorY + b.doorHeight - 12, 8, 4);
        ctx.fillRect(doorX + b.doorWidth + openOffset - 10, doorY + 8, 8, 4);
        ctx.fillRect(doorX + b.doorWidth + openOffset - 10, doorY + b.doorHeight - 12, 8, 4);

        // 6. Вывеска «🏠 БАЗА / АМБАР»
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.roundRect(b.x + b.width / 2 - 42, doorY - 18, 84, 16, 4);
        ctx.fill();
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🏠 БАЗА / АМБАР', b.x + b.width / 2, doorY - 6);

        // 7. Счётчик свиней в амбаре
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px "Segoe UI", sans-serif';
        ctx.fillText(`Свиней: ${this.caughtDayPigs} / ${this.totalDayPigs}`, b.x + b.width / 2, doorY + b.doorHeight - 6);

        ctx.restore();
    }

    /**
     * Игровой цикл
     */
    loop(currentTime) {
        if (!this.isRunning) return;

        const dt = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        this.update(dt);
        this.draw(dt);

        requestAnimationFrame((time) => this.loop(time));
    }
}

// Запуск игры после загрузки DOM
window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});
