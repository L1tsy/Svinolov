'use strict';

/**
 * «Свинолов» — главный игровой цикл:
 * состояния, механика дня, камера, кооп-режим (2 игрока), престиж-бонусы, отрисовка, ввод
 */
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.storage = new StorageManager();
        this.save = this.storage.load();

        // --- Стартовый капитал престижа ---
        this.prestigeBonusCoins = this.getPrestigeStartingCoins(this.save.prestige || 0);
        if (this.save.day === 1 && (this.save.prestige || 0) > 0 && (this.save.coins || 0) === 0 && this.prestigeBonusCoins > 0) {
            this.save.coins = this.prestigeBonusCoins;
            if (!this.save.stats) this.save.stats = {};
            this.save.stats.totalCoins = Math.max(this.save.stats.totalCoins || 0, this.prestigeBonusCoins);
            this.saveDirty = true;
        }

        this.sfx = new Sfx(this.save.settings);
        this.fx = new Fx();
        this.input = { joyX: 0, joyY: 0, swingHeld: false };

        // --- Режим игры: solo | coop ---
        this.mode = this.save.mode === 'coop' ? 'coop' : 'solo';

        // --- Онлайн-режимы: 'coop' (Кооперативная ферма) | 'battle' (1v1 Битва на 60 сек) ---
        this.onlineMode = 'coop';
        this.battleTimer = (typeof CONFIG !== 'undefined' && CONFIG.BATTLE_DURATION) || 60.0;
        this.battleDuration = (typeof CONFIG !== 'undefined' && CONFIG.BATTLE_DURATION) || 60.0;
        this.battleP1Score = 0;
        this.battleP2Score = 0;
        this.battleActive = false;
        this.battleWinner = null;
        this.opponentNickname = 'Фермерша';

        // --- Состояние ---
        this.state = 'title';          // title | intro | play | ending | result | battle_result
        this.paused = false;
        this.noSave = false;
        this.saveDirty = false;
        this.lastSaveAt = 0;
        this.time = 0;                 // реальное время (для анимаций)
        this.timeScale = 1;
        this.hitStop = 0;
        this.slowT = 0;
        this.introT = 0;
        this.endT = 0;
        this.titleT = 0;

        // Клавиши управления:
        // P1: WASD + Space (взмах) + ShiftLeft (рывок/спринт)
        // P2: Стрелки + Enter/Slash (взмах) + ShiftRight/Num0/M/K (рывок/спринт)
        this.keys = {
            w: false, s: false, a: false, d: false,
            up: false, down: false, left: false, right: false,
            space: false, enter: false,
            shift1: false, shift2: false
        };
        this.mouseDown = false;
        this.swingBuf1 = 0;
        this.swingBuf2 = 0;
        this.touch = 'ontouchstart' in window;

        this.w = 800; this.h = 600; this.dpr = 1;
        this.baseZoom = 1; this.zoom = 1; this.vw = 800; this.vh = 600;
        this.camCX = 0; this.camCY = 0; this.camX = 0; this.camY = 0;

        // Совместимость с Pig / Player / Helper / Dog
        this.pigs = [];
        this.helpers = [];
        this.dogs = [];
        this.threats = [];
        this.lureT = 0;
        this.pigSpeedMul = 1;
        this.dustColor = 'rgba(255,255,255,0.55)';
        this.buffs = { speed: 0, net: 0, x2: 0 };
        this.reach = CONFIG.CATCH_RADIUS;
        this.reach2 = CONFIG.CATCH_RADIUS;
        this.pigInReach = false;
        this.pigInReach2 = false;

        // Статистика дня (включая разделение по игрокам для коопа)
        this.day = this.save.day;
        this.event = null;
        this.eventMul = 1;
        this.roster = [];
        this.total = 0;
        this.dayCaught = 0;
        this.dayCaughtP1 = 0;
        this.dayCaughtP2 = 0;
        this.dayCoins = 0;
        this.dayCoinsP1 = 0;
        this.dayCoinsP2 = 0;
        this.dayBestCombo = 0;
        this.lastCatcher = null;       // 1 или 2
        this.coopCatchCombo = 0;       // серия совместной ловли по очереди

        this.timeTotal = 60;
        this.timeLeft = 60;
        this.elapsed = 0;
        this.quest = null;
        this.waves = [];
        this.spawnQueue = [];
        this.goldTimes = [];
        this.powerups = [];
        this.powerupT = 7;
        this.bossPiglets = 0;
        this.combo = 0;
        this.comboT = 0;
        this.comboMax = CONFIG.COMBO_WINDOW;
        this.comboPulse = 0;
        this.dashUsed = false;
        this.stunned = false;
        this.pickups = 0;
        this.winPlayed = false;
        this.lastTickSec = -1;
        this.weatherAcc = 0;
        this.shownCoins = this.save.coins;
        this.lastCoinSfx = 0;
        this.tutStep = 0;
        this.tutMove = 0;
        this.tutDashed = false;

        // Игроки и мир
        this.world = null;
        this.player = null;            // Игрок 1
        this.player2 = null;           // Игрок 2 (в кооп-режиме)
        this.hasDualBarns = !!(this.save && this.save.hasDualBarns && (this.save.prestige || 0) >= 6);
        this.setupWorld(this.save.day, true);
        this.initPlayers();
        this.recalc();

        this.resize();
        this.ui = new UI(this);

        // --- Сетевой менеджер (WebRTC P2P для игры по сети на 2 устройствах) ---
        this.network = (typeof NetworkManager !== 'undefined') ? new NetworkManager(this) : null;
        this.net = this.network;
        this.isOnline = false;
        this.netRole = null;          // 'host' | 'guest'
        this._spawnBarnToggle = false;

        if (this.ui) {
            this.ui.onHostRoom = (customCode, mode) => this.hostOnlineGame(customCode, mode);
            this.ui.onJoinRoom = (code) => this.joinOnlineGame(code);
        }

        this.bindInput();
        this.enterTitle();

        this.lastFrame = performance.now();
        const loop = (now) => {
            const rdt = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000) || 0);
            this.lastFrame = now;
            this.update(rdt);
            this.render();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    /* ================= Свойства доступа ================= */
    get coins() {
        return this.save ? this.save.coins : 0;
    }

    set coins(val) {
        if (this.save) this.save.coins = Math.max(0, Math.floor(Number(val) || 0));
    }

    get coopCombo() { return this.coopCatchCombo; }
    get p1Caught() { return this.dayCaughtP1; }
    get p2Caught() { return this.dayCaughtP2; }
    get p1Coins() { return this.dayCoinsP1; }
    get p2Coins() { return this.dayCoinsP2; }

    get hasDualBarns() {
        const d = (this.storage && this.storage.data) || this.save;
        return !!((this._hasDualBarns || (d && d.hasDualBarns)) && d && (d.prestige || 0) >= 6);
    }

    set hasDualBarns(v) {
        this._hasDualBarns = !!v;
        if (this.save) this.save.hasDualBarns = !!v;
        if (this.storage && this.storage.data) this.storage.data.hasDualBarns = !!v;
    }

    setDualBarns(val = true) {
        this.hasDualBarns = !!val;
        if (this.save) this.save.hasDualBarns = !!val;
        if (this.storage && this.storage.data) this.storage.data.hasDualBarns = !!val;
        this.setupWorld(this.day, true);
        this.initPlayers();
        this.resetPlayerAtGate();
        this.persist();
        return this.hasDualBarns;
    }

    claimAchievementTier(chainId) {
        if (this.storage && typeof this.storage.claimAchievementTier === 'function') {
            const res = this.storage.claimAchievementTier(chainId);
            if (res && res.success) {
                this.coins = this.save.coins;
                this.persist();
            }
            return res;
        }
        return null;
    }

    exportSave() {
        return this.save;
    }

    /** Стартовый капитал при престиже (поддерживает функцию из config.js или формулу) */
    getPrestigeStartingCoins(prestige) {
        const p = Math.max(0, Math.floor(Number(prestige) || 0));
        if (p <= 0) return 0;
        if (typeof prestigeStartingCoins === 'function') return prestigeStartingCoins(p);
        if (CONFIG && typeof CONFIG.prestigeStartingCoins === 'function') return CONFIG.prestigeStartingCoins(p);
        const base = (CONFIG && CONFIG.PRESTIGE_START_BASE) || 50;
        const step = (CONFIG && CONFIG.PRESTIGE_START_STEP) || 50;
        return base + step * p;
    }

    /* ================= Инициализация игроков ================= */
    initPlayers() {
        const w = this.world;
        const width = (w && (w.width || w.w)) || 800;
        const height = (w && (w.height || w.h)) || 600;
        const d = w ? w.door : { x: 400, y: 300 };

        if (this.hasDualBarns) {
            // Player spawns in the center of the field (w.width / 2, w.height / 2)
            const cx = width / 2;
            const cy = height / 2;
            this.player = new Player(cx, cy, 1);
            if (this.mode === 'coop') {
                this.player2 = new Player(cx + 40, cy, 2);
                this.setupPlayerVisuals(this.player, 1);
                this.setupPlayerVisuals(this.player2, 2);
            } else {
                this.player2 = null;
                this.setupPlayerVisuals(this.player, 1);
            }
        } else if (this.mode === 'coop') {
            const d1 = (this.world && this.world.door1) ? this.world.door1 : d;
            const d2 = (this.world && this.world.door2) ? this.world.door2 : d;
            this.player = new Player(d1.x, d1.y + 60, 1);
            this.player2 = new Player(d2.x, d2.y + 60, 2);
            this.setupPlayerVisuals(this.player, 1);
            this.setupPlayerVisuals(this.player2, 2);
        } else {
            this.player = new Player(d.x, d.y + 84, 1);
            this.player2 = null;
            this.setupPlayerVisuals(this.player, 1);
        }
    }

    setupPlayerVisuals(p, id = 1) {
        if (!p) return;
        p.id = id;
        if (id === 1) {
            p.hat = this.save.hat || 'straw';
            p.suit = p.suit || '#3b82f6';
            p.shirt = p.shirt || '#f4f1e8';
        } else {
            p.hat = p.hat || 'cap';
            p.suit = p.suit || '#06b6d4';
            p.shirt = p.shirt || '#ffedd5';
            p.hatColor = p.hatColor || '#ec4899';
        }
    }

    /* ================= Производные характеристики ================= */
    recalc() {
        if (this.onlineMode === 'battle') {
            const eqSpeed = (typeof CONFIG !== 'undefined' && CONFIG.BATTLE_PLAYER_SPEED) || 280;
            const eqRadius = (typeof CONFIG !== 'undefined' && CONFIG.BATTLE_CATCH_RADIUS) || 72;
            const eqDashCd = (typeof CONFIG !== 'undefined' && CONFIG.BATTLE_DASH_COOLDOWN) || 2.0;

            const applyBattleStats = (p, id = 1) => {
                if (!p) return;
                p.id = id;
                p.speed = eqSpeed;
                p.catchRadius = eqRadius;
                p.swingCd = (typeof CONFIG !== 'undefined' && CONFIG.SWING_COOLDOWN) || 0.35;
                p.dashCd = eqDashCd;
                this.setupPlayerVisuals(p, id);
            };

            applyBattleStats(this.player, 1);
            if (this.player2) applyBattleStats(this.player2, 2);
            this.helpers = [];
            this.dogs = [];
            return;
        }

        const u = this.save.upgrades;
        const lv = (id) => Math.max(0, Number(u[id]) || 0);

        const applyStats = (p, id = 1) => {
            if (!p) return;
            p.id = id;
            p.speed = CONFIG.PLAYER_SPEED * (1 + 0.06 * lv('boots'));
            p.catchRadius = CONFIG.CATCH_RADIUS * (1 + 0.08 * lv('net'));
            p.swingCd = CONFIG.SWING_COOLDOWN * Math.pow(0.9, lv('hands'));
            p.dashCd = CONFIG.DASH_COOLDOWN * Math.pow(0.87, lv('dash'));
            this.setupPlayerVisuals(p, id);
        };

        applyStats(this.player, 1);
        if (this.player2) applyStats(this.player2, 2);

        this.comboBonus = 0.5 * lv('combo');
        this.coinMult = (1 + 0.15 * lv('bank')) * (1 + CONFIG.PRESTIGE_BONUS * (this.save.prestige || 0));
        this.clockBonus = 6 * lv('clock');
        this.luck = 1 + 0.15 * lv('luck');
        this.syncTeam();
    }

    syncTeam() {
        const p = this.player;
        const nh = Math.max(0, this.save.helpers | 0), nd = Math.max(0, this.save.dogs | 0);
        while (this.helpers.length < nh) {
            const i = this.helpers.length;
            this.helpers.push(new Helper(i, p.x + (i - 1) * 44, p.y + 34 + U.rand(0, 20)));
        }
        this.helpers.length = Math.min(this.helpers.length, nh);
        while (this.dogs.length < nd) {
            const i = this.dogs.length;
            this.dogs.push(new Dog(i, p.x - 40 - i * 30, p.y + 30));
        }
        this.dogs.length = Math.min(this.dogs.length, nd);
    }

    /* ================= Мир и смена режимов ================= */
    setupWorld(day, silent) {
        const tier = tierForDay(day), si = seasonForDay(day);
        const prev = this.world;
        const coopMapIdx = Math.max(0, (day - 1) % 3);
        const dualActive = !!this.hasDualBarns;
        const prestige = (this.save && this.save.prestige) || 0;
        if (prev && prev.tier === tier && prev.seasonIdx === si && prev.mode === this.mode && (this.mode !== 'coop' || prev.coopMapIdx === coopMapIdx) && prev.hasDualBarns === dualActive) return false;
        this.world = new World(tier, si, { mode: this.mode, coopMapIdx, hasDualBarns: dualActive, prestige });
        if (this.world) {
            this.world.mode = this.mode;
            this.world.hasDualBarns = dualActive;
            if (dualActive && typeof this.world.configureDualBarns === 'function') {
                this.world.configureDualBarns();
            }
        }
        const sid = this.world.season.id;
        this.dustColor = (sid === 'summer' || sid === 'winter') ? 'rgba(255,255,255,0.55)' : 'rgba(196,160,110,0.55)';
        this.weatherAcc = 0;
        if (!silent && prev) {
            this.zoneChanged = prev.tier !== tier;
            this.seasonChanged = prev.seasonIdx !== si;
        }
        return true;
    }

    setMode(mode) {
        const next = mode === 'coop' ? 'coop' : 'solo';
        this.mode = next;
        this.save.mode = next;
        if (this.storage && this.storage.data) {
            this.storage.data.mode = next;
        }
        this.saveDirty = true;

        if (next === 'solo') {
            this.player2 = null;
            if (this.isOnline && this.network) {
                try { this.network.disconnect(); } catch (e) {}
                this.isOnline = false;
            }
        }

        this.setupWorld(this.day, true);
        this.initPlayers();
        this.resetPlayerAtGate();
        this.recalc();

        if (next === 'solo' && this.player) {
            this.camCX = this.player.x;
            this.camCY = this.player.y;
            this.camX = this.player.x - this.w / 2;
            this.camY = this.player.y - this.h / 2;
        }

        if (this.ui) {
            if (typeof this.ui._syncModeUI === 'function') this.ui._syncModeUI();
            if (typeof this.ui.onModeChanged === 'function') this.ui.onModeChanged(this.mode);
            if (typeof this.ui.syncHUDCoop === 'function') this.ui.syncHUDCoop();
        }
        if (next === 'coop') {
            this.mode = 'coop';
            if (!this.player2) this.initPlayers();
        }
        this.persist();
        return this.mode;
    }

    toggleMode() {
        return this.setMode(this.mode === 'coop' ? 'solo' : 'coop');
    }

    getMode() {
        return this.mode;
    }

    /* ================= Размеры ================= */
    resize() {
        const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
        this.w = w; this.h = h;
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.baseZoom = U.clamp(Math.min(w / 1150, h / 700), 0.55, 1.4);
        this.zoom = this.baseZoom;
        this.vw = w / this.zoom; this.vh = h / this.zoom;
        this.canvas.width = Math.floor(w * this.dpr);
        this.canvas.height = Math.floor(h * this.dpr);
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
    }

    /* ================= Ввод ================= */
    bindInput() {
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('pagehide', () => this.persist());
        window.addEventListener('beforeunload', () => this.persist());
        window.addEventListener('blur', () => {
            for (const k in this.keys) this.keys[k] = false;
            this.mouseDown = false;
            if (['play', 'intro', 'ending'].includes(this.state) && !this.paused && !this.ui.modalOpen) this.ui.openPause();
        });

        window.addEventListener('keydown', (e) => {
            this.sfx.init();
            const c = e.code;
            if (c === 'Escape' || c === 'KeyP') {
                if (!e.defaultPrevented && !e.repeat && !this.ui.modalOpen && ['play', 'intro', 'ending'].includes(this.state)) this.ui.openPause();
                return;
            }
            if (this.ui.modalOpen) return;

            switch (c) {
                // Игрок 1: WASD
                case 'KeyW': this.keys.w = true; e.preventDefault(); break;
                case 'KeyS': this.keys.s = true; e.preventDefault(); break;
                case 'KeyA': this.keys.a = true; e.preventDefault(); break;
                case 'KeyD': this.keys.d = true; e.preventDefault(); break;

                // Игрок 2 (или Игрок 1 в соло-режиме): Стрелки
                case 'ArrowUp': this.keys.up = true; e.preventDefault(); break;
                case 'ArrowDown': this.keys.down = true; e.preventDefault(); break;
                case 'ArrowLeft': this.keys.left = true; e.preventDefault(); break;
                case 'ArrowRight': this.keys.right = true; e.preventDefault(); break;

                // Взмах сачком Игрока 1 (Space)
                case 'Space':
                    this.keys.space = true;
                    if (!e.repeat) this.swingBuf1 = 0.15;
                    e.preventDefault();
                    break;

                // Взмах сачком Игрока 2 (Enter / NumEnter / Slash / Period)
                case 'Enter': case 'NumpadEnter': case 'Slash': case 'Period':
                    if (this.mode === 'coop') {
                        this.keys.enter = true;
                        if (!e.repeat) this.swingBuf2 = 0.15;
                        e.preventDefault();
                    } else {
                        // В соло-режиме Enter тоже срабатывает для Игрока 1
                        this.keys.space = true;
                        if (!e.repeat) this.swingBuf1 = 0.15;
                    }
                    break;

                // Рывок / Спринт Игрока 1 (Left Shift)
                case 'ShiftLeft':
                    this.keys.shift1 = true;
                    if (!e.repeat) this.requestDash(1);
                    break;

                // Рывок / Спринт Игрока 2 (Right Shift / Num0 / KeyM / KeyK)
                case 'ShiftRight': case 'Numpad0': case 'KeyM': case 'KeyK':
                    if (this.mode === 'coop') {
                        this.keys.shift2 = true;
                        if (!e.repeat) this.requestDash(2);
                    } else {
                        this.keys.shift1 = true;
                        if (!e.repeat) this.requestDash(1);
                    }
                    break;

                default: break;
            }
        });

        window.addEventListener('keyup', (e) => {
            switch (e.code) {
                case 'KeyW': this.keys.w = false; break;
                case 'KeyS': this.keys.s = false; break;
                case 'KeyA': this.keys.a = false; break;
                case 'KeyD': this.keys.d = false; break;
                case 'ArrowUp': this.keys.up = false; break;
                case 'ArrowDown': this.keys.down = false; break;
                case 'ArrowLeft': this.keys.left = false; break;
                case 'ArrowRight': this.keys.right = false; break;
                case 'Space': this.keys.space = false; break;
                case 'Enter': case 'NumpadEnter': case 'Slash': case 'Period':
                    this.keys.enter = false;
                    if (this.mode !== 'coop') this.keys.space = false;
                    break;
                case 'ShiftLeft':
                    this.keys.shift1 = false;
                    break;
                case 'ShiftRight': case 'Numpad0': case 'KeyM': case 'KeyK':
                    this.keys.shift2 = false;
                    if (this.mode !== 'coop') this.keys.shift1 = false;
                    break;
                default: break;
            }
        });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        this.canvas.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'touch') return;
            this.sfx.init();
            if (this.ui.modalOpen) return;
            const targetP = (this.isOnline && this.netRole === 'guest') ? 2 : 1;
            if (e.button === 0) {
                this.mouseDown = true;
                if (targetP === 2) this.swingBuf2 = 0.15;
                else this.swingBuf1 = 0.15;
            }
            else if (e.button === 2) { this.requestDash(targetP); e.preventDefault(); }
        });
        const up = (e) => { if (e.pointerType !== 'touch' && e.button === 0) this.mouseDown = false; };
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', () => { this.mouseDown = false; });

        // Полноэкранный режим (⛶)
        const toggleFs = () => {
            try {
                if (!document.fullscreenElement) {
                    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
                } else {
                    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
                }
            } catch (err) { /* ignore */ }
        };
        ['btn-fullscreen', 'title-fullscreen', 'pause-fullscreen'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn && !btn._fsHandlerBound) {
                btn._fsHandlerBound = true;
                btn.addEventListener('click', (e) => { e.stopPropagation(); toggleFs(); });
            }
        });
    }

    inputAllowed() {
        return !this.ui.modalOpen && !this.paused && (this.state === 'play' || this.state === 'intro' || this.state === 'ending');
    }

    moveVector(playerIdx = 1) {
        if (!this.inputAllowed()) return { x: 0, y: 0 };
        const k = this.keys;
        let x = 0, y = 0;

        if (this.isOnline) {
            if (this.netRole === 'host') {
                if (playerIdx === 1) {
                    x = ((k.d || k.right) ? 1 : 0) - ((k.a || k.left) ? 1 : 0) + (Number(this.input.joyX) || 0);
                    y = ((k.s || k.down) ? 1 : 0) - ((k.w || k.up) ? 1 : 0) + (Number(this.input.joyY) || 0);
                } else {
                    return { x: 0, y: 0 };
                }
            } else if (this.netRole === 'guest') {
                if (playerIdx === 2) {
                    x = ((k.d || k.right) ? 1 : 0) - ((k.a || k.left) ? 1 : 0) + (Number(this.input.joyX) || 0);
                    y = ((k.s || k.down) ? 1 : 0) - ((k.w || k.up) ? 1 : 0) + (Number(this.input.joyY) || 0);
                } else {
                    return { x: 0, y: 0 };
                }
            }
        } else if (playerIdx === 1) {
            if (this.mode === 'coop') {
                x = (k.d ? 1 : 0) - (k.a ? 1 : 0) + (Number(this.input.joyX) || 0);
                y = (k.s ? 1 : 0) - (k.w ? 1 : 0) + (Number(this.input.joyY) || 0);
            } else {
                x = ((k.d || k.right) ? 1 : 0) - ((k.a || k.left) ? 1 : 0) + (Number(this.input.joyX) || 0);
                y = ((k.s || k.down) ? 1 : 0) - ((k.w || k.up) ? 1 : 0) + (Number(this.input.joyY) || 0);
            }
        } else if (playerIdx === 2 && this.mode === 'coop') {
            x = (k.right ? 1 : 0) - (k.left ? 1 : 0);
            y = (k.down ? 1 : 0) - (k.up ? 1 : 0);
        }

        const l = Math.hypot(x, y);
        if (l > 1) { x /= l; y /= l; }
        return { x, y };
    }

    requestDash(playerIdx = null) {
        if (this.state !== 'play' || this.paused || this.ui.modalOpen) return false;
        let pNum = playerIdx;
        if (pNum === null) {
            pNum = (this.isOnline && this.netRole === 'guest') ? 2 : 1;
        }
        const target = pNum === 1 ? this.player : (this.mode === 'coop' ? this.player2 : null);
        if (!target) return false;

        const m = this.moveVector(pNum);
        if (!target.startDash(m.x, m.y)) return false;

        this.sfx.init();
        this.sfx.dash();
        if (pNum === 1) this.dashUsed = true;
        this.fx.dust(target.x, target.y + 14, 5, this.dustColor);

        if (pNum === 1) {
            if (this.tutStep === 2) this.finishTutorial(); else this.tutDashed = true;
        }

        if (this.isOnline && this.network) {
            this.network.broadcastEvent('PLAYER_DASH', { p: pNum, x: target.x, y: target.y, vx: target.vx, vy: target.vy });
        }
        return true;
    }

    /* ================= Публичное API для UI ================= */
    startGame() {
        if (this.state !== 'title') return;
        this.sfx.init();
        this.ui.hideTitle();
        this.ui.setHud(true);
        this.startDay(this.save.day);
    }

    nextDay() {
        this.sfx.init();
        this.ui.hideResult();
        if (this.isOnline && this.network && this.netRole === 'host') {
            this.network.broadcastEvent('NEXT_DAY', { day: this.save.day });
        }
        this.startDay(this.save.day);
    }
    retryDay() {
        this.sfx.init();
        this.ui.hideResult();
        if (this.isOnline && this.network && this.netRole === 'host') {
            this.network.broadcastEvent('RETRY_DAY', { day: this.save.day });
        }
        this.startDay(this.save.day);
    }
    setPaused(p) { this.paused = !!p; }

    buyUpgrade(id) {
        const up = UPGRADES.find((u) => u.id === id);
        if (!up) return false;

        // Блокировка улучшений напарников, если напарник еще не куплен
        if ((id === 'helper_speed' || id === 'helper_radius' || id === 'helper_vision') && (this.save.helpers || 0) < 1) {
            this.sfx.error();
            if (this.ui && typeof this.ui.toast === 'function') {
                this.ui.toast('🔒 Сначала наймите напарника');
            }
            return false;
        }

        // Блокировка улучшения пса Бобика, если Бобик еще не куплен
        if (id === 'dog_power' && (this.save.dogs || 0) < 1) {
            this.sfx.error();
            if (this.ui && typeof this.ui.toast === 'function') {
                this.ui.toast('🔒 Сначала наймите пса Бобика');
            }
            return false;
        }

        const level = this.save.upgrades[id] || 0;
        if (level >= up.max) { this.sfx.error(); return false; }
        const cost = upgradeCost(up, level);
        if (this.save.coins < cost) { this.sfx.error(); return false; }
        this.save.coins -= cost;
        this.save.upgrades[id] = level + 1;
        this.recalc();
        this.sfx.buy();
        this.persist();
        this.ui.refreshShop();
        return true;
    }

    buyTeam(id) {
        const team = TEAM.find((t) => t.id === id);
        if (!team) return false;
        const count = this.save[id] || 0;
        if (count >= team.costs.length || this.save.day < team.days[count]) { this.sfx.error(); return false; }
        const cost = team.costs[count];
        if (this.save.coins < cost) { this.sfx.error(); return false; }
        this.save.coins -= cost;
        this.save[id] = count + 1;
        this.recalc();
        this.sfx.buy();
        this.persist();
        this.ui.refreshShop();
        return true;
    }

    buyHat(id) {
        const hat = HATS.find((h) => h.id === id);
        if (!hat) return false;
        const owned = this.save.hats.includes(id);
        if (!owned) {
            if (this.save.coins < hat.cost) { this.sfx.error(); return false; }
            this.save.coins -= hat.cost;
            this.save.hats.push(id);
            this.sfx.buy();
        } else {
            this.sfx.click();
        }
        this.save.hat = id;
        this.player.hat = id;
        this.persist();
        this.ui.refreshShop();
        return true;
    }

    canPrestige() { return this.save.day >= CONFIG.PRESTIGE_DAY; }

    doPrestige() {
        if (!this.canPrestige()) return false;
        if (this.storage.resetPrestige) {
            this.save = this.storage.resetPrestige(this.save);
        } else {
            const s = this.save;
            s.prestige = (s.prestige || 0) + 1;
            s.stats.prestige = s.prestige;
            const startCoins = this.getPrestigeStartingCoins(s.prestige);
            s.coins = startCoins;
            s.day = 1;
            for (const u of UPGRADES) s.upgrades[u.id] = 0;
            s.helpers = 0;
            s.dogs = 0;
        }
        this.coins = this.save.coins;
        this.checkAch(true);
        this.persist();
        this.noSave = true;
        location.reload();
        return true;
    }

    resetProgress() {
        this.noSave = true;
        this.storage.reset();
        location.reload();
    }

    toggleMute() {
        this.save.settings.muted = !this.save.settings.muted;
        this.sfx.setMuted(this.save.settings.muted);
        this.persist();
        return this.save.settings.muted;
    }

    toggleMusic() {
        this.save.settings.music = !this.save.settings.music;
        this.sfx.setMusic(this.save.settings.music);
        this.persist();
        return this.save.settings.music;
    }

    persist() {
        if (this.noSave) return;
        this.storage.save(this.save);
        this.saveDirty = false;
        this.lastSaveAt = performance.now();
    }

    /* ================= Титул и Главное меню ================= */
    enterTitle() {
        this.returnToTitle();
    }

    returnToTitle() {
        // 1. Saves game state via this.storage.save(this.exportSave())
        if (this.storage && typeof this.storage.save === 'function') {
            this.storage.save(this.exportSave());
        }
        this.saveDirty = false;
        this.lastSaveAt = performance.now();

        // 2. Disconnect online match if connected
        if (this.network && typeof this.network.disconnect === 'function') {
            try { this.network.disconnect(); } catch (err) {}
        }
        this.isOnline = false;
        this.battleActive = false;
        this.paused = false;

        // 3. Clears active wave, powerups, floating texts
        this.waves = [];
        this.spawnQueue = [];
        this.powerups = [];
        if (this.fx && typeof this.fx.clear === 'function') {
            this.fx.clear();
        }
        this.pigs = [];
        this.threats = [];

        // 4. Transitions state to 'title'
        this.state = 'title';

        // 5. Closes all active modals (result modal, pause modal, etc.)
        if (this.ui) {
            if (typeof this.ui.hideResult === 'function') this.ui.hideResult();
            if (typeof this.ui.closePause === 'function') this.ui.closePause();
            if (typeof this.ui.closeShop === 'function') this.ui.closeShop();
            if (typeof this.ui.closeLeaderboard === 'function') this.ui.closeLeaderboard();
            if (typeof this.ui.closeOnlineModal === 'function') this.ui.closeOnlineModal();
            if (typeof this.ui.hideBattleResult === 'function') this.ui.hideBattleResult();
            if (typeof this.ui.setHud === 'function') this.ui.setHud(false);
        }

        // Reset world & camera view for title
        const w = this.world;
        if (w) {
            const d = w.door || { x: 400, y: 300 };
            const types = ['pink', 'pink', 'pink', 'piglet', 'piglet', 'runner', 'pink', 'pink'];
            for (const t of types) {
                const s = (typeof w.freeSpot === 'function') ? w.freeSpot(30, d, 120, 650) : { x: d.x + 100, y: d.y };
                this.pigs.push(new Pig(t, s.x, s.y, 1));
            }
            this.resetPlayerAtGate();
            if (w.barn) {
                this.camCX = w.barn.x; this.camCY = w.barn.y;
            } else if (w.northBarn) {
                this.camCX = w.w / 2; this.camCY = w.h / 2;
            }
        }

        // 6. Opens Title screen via this.ui.showTitle()
        if (this.ui) {
            if (typeof this.ui._syncModeUI === 'function') this.ui._syncModeUI();
            if (typeof this.ui.showTitle === 'function') this.ui.showTitle();
        }
    }

    resetPlayerAtGate() {
        const w = this.world;
        const width = (w && (w.width || w.w)) || 800;
        const height = (w && (w.height || w.h)) || 600;
        const d1 = (this.mode === 'coop' && w && w.door1) ? w.door1 : (w ? w.door : { x: 400, y: 300 });
        const d2 = (this.mode === 'coop' && w && w.door2) ? w.door2 : (w ? w.door : { x: 400, y: 300 });

        const resetP = (p, x, y, id = 1) => {
            if (!p) return;
            p.id = id;
            p.x = x; p.y = y;
            p.vx = p.vy = 0; p.stun = 0; p.invuln = 0; p.cd = 0; p.dashT = 0; p.dashCdT = 0; p.swingT = 0;
            p.trail.length = 0; p.facing = id === 2 ? -1 : 1; p.aimX = id === 2 ? -1 : 1; p.aimY = 0;
            if (typeof p.resetSprint === 'function') p.resetSprint();
            if (this.world) this.world.resolve(p, p.r);
        };

        if (this.hasDualBarns) {
            // Player spawns in the center of the field (w.width / 2, w.height / 2)
            const cx = width / 2;
            const cy = height / 2;
            if (!this.player) this.player = new Player(cx, cy, 1);
            resetP(this.player, cx, cy, 1);

            if (this.mode === 'coop') {
                if (!this.player2) this.player2 = new Player(cx + 40, cy, 2);
                resetP(this.player2, cx + 40, cy, 2);
            } else {
                this.player2 = null;
            }
        } else if (this.mode === 'coop') {
            if (!this.player) this.player = new Player(d1.x, d1.y + 60, 1);
            resetP(this.player, d1.x, d1.y + 60, 1);

            if (!this.player2) this.player2 = new Player(d2.x, d2.y + 60, 2);
            resetP(this.player2, d2.x, d2.y + 60, 2);
        } else {
            if (!this.player) this.player = new Player(d1.x, d1.y + 84, 1);
            resetP(this.player, d1.x, d1.y + 84, 1);
            this.player2 = null;
        }

        const p = this.player;
        this.helpers.forEach((h, i) => { h.x = p.x + (i - 1) * 44; h.y = p.y + 34; h.vx = h.vy = 0; h.target = null; h.cd = U.rand(0.3, 1); });
        this.dogs.forEach((o, i) => { o.x = p.x - 44 - i * 30; o.y = p.y + 28; o.vx = o.vy = 0; o.target = null; o.rest = 0; });
    }

    /* ================= Начало дня ================= */
    shuffle(a) {
        for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
        return a;
    }

    startDay(day) {
        const s = this.save;
        this.paused = false;
        if (this.onlineMode === 'battle') this.onlineMode = 'coop';
        this.battleActive = false;
        const bBar = document.getElementById('hud-battle-bar');
        if (bBar) bBar.classList.add('hidden');

        this.zoneChanged = false; this.seasonChanged = false;
        this.setupWorld(day, false);
        const w = this.world;
        const zone = this.zoneChanged || (w.tier > 0 && day === CONFIG.TIER_DAYS[w.tier]);

        this.day = day;
        this.event = pickEvent(day);
        this.roster = buildRoster(day, this.event);
        this.total = this.roster.length;
        this.timeTotal = dayDuration(day, this.roster) + this.clockBonus;
        this.timeLeft = this.timeTotal;
        this.quest = makeQuest(day, this.roster);
        this.elapsed = 0;

        // Сброс состояния дня
        this.pigs = [];
        this.spawnQueue = [];
        this.powerups = [];
        this.fx.clear();
        this.buffs.speed = this.buffs.net = this.buffs.x2 = 0;
        this.lureT = 0;
        this.combo = 0; this.comboT = 0; this.comboPulse = 0;
        this.dayCaught = 0;
        this.dayCaughtP1 = 0;
        this.dayCaughtP2 = 0;
        this.dayCoins = 0;
        this.dayCoinsP1 = 0;
        this.dayCoinsP2 = 0;
        this.dayBestCombo = 0;
        this.lastCatcher = null;
        this.coopCatchCombo = 0;

        this.dashUsed = false; this.stunned = false; this.pickups = 0;
        this.bossPiglets = 0; this.winPlayed = false; this.hitStop = 0; this.slowT = 0; this.timeScale = 1;
        this.lastTickSec = -1;
        this.powerupT = 7;
        this.tutMove = 0;
        this.tutStep = 0;
        this.tutDashed = false;
        this.sfx.tempoMul = 1;
        this.eventMul = (this.event === 'rain' || this.event === 'night') ? 1.5 : 1;
        this.pigSpeedMul = this.event === 'rain' ? 1.1 : 1;

        w.puddles.length = 0;
        w.barnOpen = 0; w.barnBounce = 0;
        if (this.event === 'rain') {
            for (let i = 0; i < 16; i++) {
                const sp = w.freeSpot(40);
                w.addPuddle(sp.x, sp.y, U.rand(30, 52), 9999);
            }
        }

        // Золотые свиньи
        this.goldTimes = [];
        if (this.event === 'gold') {
            for (let i = 0; i < 4; i++) this.goldTimes.push(this.timeTotal * (0.12 + 0.18 * i + U.rand(0, 0.1)));
        } else if (day >= 2 && Math.random() < Math.min(0.8, 0.3 * this.luck)) {
            this.goldTimes.push(this.timeTotal * U.rand(0.2, 0.7));
        }

        // Волны
        const others = this.shuffle(this.roster.filter((t) => t !== 'boss'));
        const first = this.roster.includes('boss') ? ['boss'] : [];
        const n1 = Math.max(first.length + 1, Math.ceil(this.roster.length * 0.6));
        first.push(...others.splice(0, Math.max(0, n1 - first.length)));
        this.firstWave = first;
        this.waves = [];
        if (others.length > 0 && others.length <= 3) {
            this.waves.push({ at: this.timeTotal * 0.22, list: others });
        } else if (others.length > 3) {
            const half = Math.ceil(others.length / 2);
            this.waves.push({ at: this.timeTotal * 0.22, list: others.slice(0, half) });
            this.waves.push({ at: this.timeTotal * 0.48, list: others.slice(half) });
        }

        // Игрок(и) и команда
        this.resetPlayerAtGate();
        const focusP = (this.isOnline && this.netRole === 'guest' && this.player2) ? this.player2 : this.player;
        this.camCX = focusP.x; this.camCY = focusP.y - 30;
        this.prewarmWeather();

        // Баннер
        let sub = '';
        let tipShown = false;
        if (this.roster.includes('boss')) sub = '⚠ ХРЯК-БОСС';
        else {
            const nt = this.roster.find((t) => PIG_TYPES[t] && PIG_TYPES[t].tip && !s.seen[t]);
            if (nt) { sub = PIG_TYPES[nt].tip; s.seen[nt] = true; tipShown = true; this.saveDirty = true; }
            else if (this.event && EVENTS[this.event]) sub = EVENTS[this.event].icon + ' ' + EVENTS[this.event].title;
        }
        const ev = this.event ? EVENTS[this.event] : null;
        if (zone) {
            this.ui.banner('Новая территория!', 'День ' + day, 2200);
            if (sub) this.ui.toast(tipShown ? '💡' : '⚠️', tipShown ? 'Новый вид свиней' : 'Внимание', sub, 4500);
        } else {
            this.ui.banner('День ' + day, sub, tipShown ? 3200 : 1900);
        }
        if (ev) this.ui.toast(ev.icon, ev.title, ev.desc, 4200);
        if (this.seasonChanged && !zone) this.ui.toast(w.season.icon, w.season.name, 'Сменилось время года', 3000);

        this.state = 'intro';
        this.introT = 1.5;
        this.ui.setHud(true);
        this.persist();
    }

    beginPlay() {
        this.state = 'play';
        this.launchWave(this.firstWave, false);
    }

    /* ================= Волны и появление свиней ================= */
    launchWave(list, announce) {
        if (!list || !list.length) return;
        if (announce) this.ui.banner('Ещё свиньи!', '', 1200);
        this.sfx.squeal();
        this.world.barnOpen = 1.2;
        this.fx.addShake(5);
        list.forEach((t, i) => this.spawnQueue.push({ type: t, t: 0.1 + i * 0.14 }));
    }

    spawnPig(type, doorOverride) {
        let d = this.world.door;
        if (this.mode === 'coop' && this.world.doors && this.world.doors.length > 1) {
            this._spawnBarnToggle = !this._spawnBarnToggle;
            d = this._spawnBarnToggle ? (this.world.door2 || this.world.doors[1]) : (this.world.door1 || this.world.doors[0]);
        }
        if (doorOverride) d = doorOverride;
        const p = new Pig(type, d.x + U.rand(-24, 24), d.y + 6, this.day);
        p.startBurst(Math.PI / 2 + U.rand(-1.3, 1.3), U.rand(0.7, 1.1));
        this.pigs.push(p);

        if (d === this.world.door2) {
            this.world.barn2Open = Math.max(this.world.barn2Open || 0, 0.6);
        } else {
            this.world.barnOpen = Math.max(this.world.barnOpen, 0.6);
        }
        this.fx.dust(d.x + U.rand(-20, 20), d.y + 8, 3, this.dustColor);
        if (type === 'boss') { this.sfx.roar(); this.fx.addShake(10); }
        return p;
    }

    fieldCount() {
        let n = 0;
        for (const p of this.pigs) if (p.counts && p.active && p.state !== 'escape') n++;
        return n + this.spawnQueue.length;
    }

    spawnGold() {
        const anchor = (this.mode === 'coop' && this.player2) ? { x: (this.player.x + this.player2.x) / 2, y: (this.player.y + this.player2.y) / 2 } : this.player;
        const sp = this.world.freeSpot(30, anchor, 350, 700);
        const p = new Pig('gold', sp.x, sp.y, this.day);
        p.counts = false;
        this.pigs.push(p);
        this.sfx.gold();
        this.fx.stars(sp.x, sp.y - 10, 10, ['#ffe066', '#ffffff', '#ffb703']);
        this.fx.ring(sp.x, sp.y, 50, '#ffd23f', 0.5, 5);
        this.ui.toast('✨', 'Золотая свинья!', 'Поймай её, пока не убежала', 3200);
    }

    spawnPowerup() {
        const ids = Object.keys(POWERUPS);
        const bag = [];
        for (const id of ids) { const n = id === 'clock' ? 1 : 3; for (let i = 0; i < n; i++) bag.push(id); }
        const id = U.pick(bag);
        const anchor = (this.mode === 'coop' && this.player2) ? { x: (this.player.x + this.player2.x) / 2, y: (this.player.y + this.player2.y) / 2 } : this.player;
        const sp = this.world.freeSpot(24, anchor, 200, 600);
        this.powerups.push({ id, x: sp.x, y: sp.y, life: CONFIG.POWERUP_LIFETIME, seed: Math.random() * 10 });
        this.fx.ring(sp.x, sp.y - 10, 24, POWERUPS[id].color, 0.4, 3);
    }

    /* ================= Колбэки для Pig / Player ================= */
    hitPlayer(pig, targetPlayer) {
        let p = targetPlayer;
        if (!p) {
            const d1 = U.dist(this.player.x, this.player.y, pig.x, pig.y);
            const d2 = (this.mode === 'coop' && this.player2) ? U.dist(this.player2.x, this.player2.y, pig.x, pig.y) : Infinity;
            p = (d2 < d1 && d2 < pig.r + this.player2.r + 20) ? this.player2 : this.player;
        }
        if (!p || p.invuln > 0) return false;

        p.stun = CONFIG.STUN_TIME;
        p.invuln = CONFIG.STUN_TIME + 1.5;
        p.dashT = 0;
        const dx = p.x - pig.x, dy = p.y - pig.y, l = Math.hypot(dx, dy) || 1;
        p.vx = (dx / l) * 520; p.vy = (dy / l) * 520;

        if (this.combo >= 3) this.sfx.comboBreak();
        this.combo = 0; this.comboT = 0;
        this.stunned = true;
        this.fx.addShake(14);
        this.fx.addFlash('#ff4d4d', 0.28);
        this.fx.stars(p.x, p.y - 20, 8);
        this.fx.text(p.x, p.y - 44, 'АЙ!', { color: '#ff8a8a', size: 28 });
        this.sfx.stun();
        return true;
    }

    onPigArrived(pig) {
        const w = this.world;
        let d = w.door;
        if (w.doors && w.doors.length > 1) {
            d = (typeof w.getClosestDoor === 'function') ? w.getClosestDoor(pig.tx || pig.x, pig.ty || pig.y) : w.doors[0];
        }
        if (d === w.door2) {
            w.barn2Bounce = 1;
            w.barn2Open = Math.max(w.barn2Open || 0, 0.4);
        } else {
            w.barnBounce = 1;
            w.barnOpen = Math.max(w.barnOpen, 0.4);
        }
        this.fx.dust(d.x + U.rand(-16, 16), d.y - 14, 4, this.dustColor);
        this.fx.ring(d.x, d.y - 24, 26, 'rgba(255,255,255,0.7)', 0.3, 3);
    }

    onGoldFled(pig) {
        this.fx.text(pig.x, pig.y - 30, 'Сбежала…', { color: '#ffe9a0', size: 20 });
    }

    onPigGone(pig) { /* сбежавшие свиньи просто пропадают; счёт считается по итогам дня */ }

    /* ================= Взмах и поимка ================= */
    reachFor(p) {
        if (!p) return CONFIG.CATCH_RADIUS;
        const r = p.catchRadius || CONFIG.CATCH_RADIUS;
        return r * (this.buffs.net > 0 ? 1.8 : 1);
    }

    doSwing(playerIdx = null) {
        let pNum = playerIdx;
        if (pNum === null) {
            pNum = (this.isOnline && this.netRole === 'guest') ? 2 : 1;
        }
        const p = pNum === 1 ? this.player : (this.mode === 'coop' ? this.player2 : null);
        if (!p || !p.canSwing()) return false;
        const reach = this.reachFor(p);
        const res = this.sweep(p, reach);
        p.swing(res.hits === 0);
        this.sfx.swing();
        if (this.world && typeof this.world.triggerInteractive === 'function') {
            this.world.triggerInteractive(p.x, p.y, reach, this);
        }

        if (this.isOnline && this.network) {
            this.network.broadcastEvent('PLAYER_SWING', { p: pNum, miss: res.hits === 0, x: p.x, y: p.y });
        }
        return true;
    }

    sweep(catcher, radius) {
        const isPlayer = catcher === this.player || (this.mode === 'coop' && catcher === this.player2);
        let hits = 0, caught = 0;
        const list = this.pigs.slice();
        for (const pig of list) {
            if (!pig.active || pig.inBarn) continue;
            if (pig.state === 'burst' || pig.state === 'escape') continue;
            if (U.dist(catcher.x, catcher.y, pig.x, pig.y) > radius + pig.r * 0.6) continue;

            if (pig.dodge > 0) {
                pig.teleport(this);
                this.fx.text(pig.x, pig.y - 30, 'ПУФ!', { color: '#e5e7eb', size: 22 });
                this.sfx.poof();
                continue;
            }
            if (pig.hp > 1) {
                const crit = pig.state === 'dizzy';
                pig.hp -= crit ? 2 : 1;
                this.onPigHit(pig, catcher, crit);
                if (pig.hp > 0) { hits++; continue; }
            }
            hits++; caught++;
            this.catchPig(pig, catcher);
        }

        if (isPlayer && caught >= 2) {
            const bonus = 2 * (caught - 1);
            this.addCoins(bonus);
            const name = caught === 2 ? 'ДВОЙНОЙ!' : (caught === 3 ? 'ТРОЙНОЙ!' : 'МЕГА-УЛОВ x' + caught + '!');
            this.fx.text(catcher.x, catcher.y - 56, name + ' +' + bonus, { color: '#7dd3fc', size: 30, life: 1.3 });
            this.sfx.multi(caught);
            this.fx.addShake(8);
            this.save.stats.bestMulti = Math.max(this.save.stats.bestMulti, caught);
            if (this.quest && this.quest.id === 'multi' && caught >= this.quest.goal) this.completeQuest();
            this.checkAch();
        }
        return { hits, caught };
    }

    addCoins(n) {
        this.save.coins += n;
        this.save.stats.totalCoins += n;
        this.dayCoins += n;
        this.saveDirty = true;
    }

    onPigHit(pig, catcher, crit) {
        pig.hitFlash = 0.15;
        pig.knock(catcher.x, catcher.y, crit ? 380 : 300);
        this.sfx.hit();
        this.fx.addShake(crit ? 10 : 6);
        this.hitStop = 0.05;
        this.fx.stars(pig.x, pig.y - pig.r, crit ? 8 : 5);
        this.fx.text(pig.x, pig.y - pig.r - 24, crit ? 'КРИТ!' : 'УДАР!', { color: crit ? '#ffd23f' : '#ffffff', size: crit ? 28 : 22 });

        if (pig.def.boss && pig.hp > 0) {
            if (!pig.enraged && pig.hp <= pig.maxHp / 2) {
                pig.enraged = true;
                this.ui.banner('Босс в ярости!', '', 1400);
                this.sfx.roar();
                this.fx.addShake(14);
            }
            if (this.bossPiglets < 6) {
                this.bossPiglets++;
                const pl = new Pig('piglet', pig.x, pig.y, this.day);
                pl.counts = false;
                pl.startBurst(Math.random() * Math.PI * 2, U.rand(0.6, 0.9));
                this.pigs.push(pl);
            }
        }
    }

    catchPig(pig, catcher) {
        const isP1 = catcher === this.player;
        const isP2 = this.mode === 'coop' && catcher === this.player2;
        const isP = isP1 || isP2;
        const pNum = isP1 ? 1 : (isP2 ? 2 : 0);

        const w = this.world, s = this.save, st = s.stats;
        let door = w.door;
        if (this.hasDualBarns || (w && w.hasDualBarns)) {
            if (typeof w.getClosestDoor === 'function') {
                door = w.getClosestDoor(pig.x, pig.y);
            } else if (w.doors && w.doors.length > 1) {
                let bd = Infinity;
                for (const d of w.doors) {
                    if (!d) continue;
                    const dist = U.dist(pig.x, pig.y, d.x, d.y);
                    if (dist < bd) { bd = dist; door = d; }
                }
            }
        } else if (this.mode === 'coop' && typeof w.getDoorForPlayer === 'function' && pNum > 0) {
            door = w.getDoorForPlayer(pNum);
        } else if (typeof w.getClosestDoor === 'function') {
            door = w.getClosestDoor(pig.x, pig.y);
        } else if (w.doors && w.doors.length > 1) {
            let bd = Infinity;
            for (const d of w.doors) {
                if (!d) continue;
                const dist = U.dist(pig.x, pig.y, d.x, d.y);
                if (dist < bd) { bd = dist; door = d; }
            }
        }
        pig.catchTo(door.x, door.y - 20);
        if (typeof w.openBarn === 'function') {
            const barnIdx = (door === (w.door2 || w.southDoor || (w.doors && w.doors[1]))) ? 2 : 1;
            w.openBarn(barnIdx);
        } else {
            w.barnOpen = 1.2;
        }
        pig.frozen = 0;
        if (pig.counts) this.dayCaught++;

        if (pNum === 1) this.dayCaughtP1++;
        else if (pNum === 2) this.dayCaughtP2++;

        // Счёт в режиме 1v1 Battle Mode
        if (this.onlineMode === 'battle') {
            if (pNum === 1) this.battleP1Score++;
            else if (pNum === 2) this.battleP2Score++;
            this.dayCaughtP1 = this.battleP1Score;
            this.dayCaughtP2 = this.battleP2Score;

            if (this.netRole === 'host' || !this.isOnline) {
                this.spawnBattlePig();
            }
            this.updateBattleHud();
        }

        // Совместное кооперативное комбо при ловле по очереди (P1 -> P2 -> P1...)
        if (this.mode === 'coop' && pNum > 0) {
            if (this.lastCatcher && this.lastCatcher !== pNum) {
                this.coopCatchCombo++;
                const coopBonus = 3 * this.coopCatchCombo;
                this.addCoins(coopBonus);
                if (pNum === 1) this.dayCoinsP1 += coopBonus; else this.dayCoinsP2 += coopBonus;

                const midX = (this.player.x + (this.player2 ? this.player2.x : this.player.x)) / 2;
                const midY = (this.player.y + (this.player2 ? this.player2.y : this.player.y)) / 2;
                this.fx.text(midX, midY - 38, '🤝 КООП-КОМБО x' + this.coopCatchCombo + ' (+' + coopBonus + ' 🪙)', { color: '#38bdf8', size: 26, life: 1.5 });
                this.fx.ring(midX, midY, 65, '#38bdf8', 0.5, 4);
                this.fx.stars(midX, midY - 10, 9, ['#38bdf8', '#ffd23f', '#ffffff']);
                this.sfx.multi(Math.min(5, this.coopCatchCombo + 1));
            }
            this.lastCatcher = pNum;
        }

        let mult = 1;
        if (isP) {
            this.combo++;
            this.comboMax = CONFIG.COMBO_WINDOW + this.comboBonus;
            this.comboT = this.comboMax;
            this.comboPulse = 1;
            this.dayBestCombo = Math.max(this.dayBestCombo, this.combo);
            st.bestCombo = Math.max(st.bestCombo, this.combo);
            mult = Math.min(CONFIG.COMBO_MAX_MULT, 1 + (this.combo - 1) * CONFIG.COMBO_STEP);
            if (this.quest && this.quest.id === 'combo' && this.combo >= this.quest.goal) this.completeQuest();
            if (this.tutStep <= 1) this.tutStep = this.tutDashed ? 3 : 2;
            if (this.tutStep === 3) this.finishTutorial();
        }
        const x2 = this.buffs.x2 > 0 ? 2 : 1;
        const reward = Math.max(1, Math.round(pig.reward * this.coinMult * mult * x2 * this.eventMul));
        this.addCoins(reward);
        if (pNum === 1) this.dayCoinsP1 += reward;
        else if (pNum === 2) this.dayCoinsP2 += reward;

        st.totalPigs++;
        if (pig.def.gold) st.goldCaught++;
        if (pig.def.ninja) st.ninjaCaught++;
        if (pig.def.boss) st.bossKilled++;

        // Сочность
        const big = isP && this.combo >= 5;
        this.fx.stars(pig.x, pig.y - 10, pig.def.gold ? 12 : 8, pig.def.gold ? ['#ffe066', '#ffffff', '#ffb703'] : undefined);
        this.fx.ring(pig.x, pig.y, 34 + (pig.def.boss ? 30 : 0), pig.def.gold ? '#ffd23f' : '#ffffff', 0.35, 4);
        const size = 22 + (isP ? Math.min(14, this.combo * 1.5) : 0);
        this.fx.text(pig.x, pig.y - pig.r - 18, '+' + reward, { color: big ? '#ffb347' : '#ffe066', size });
        const tgt = this.ui.coinTarget() || { x: this.w - 70, y: 28 };
        this.fx.coinFly((pig.x - this.camX) * this.zoom, (pig.y - this.camY) * this.zoom, Math.min(8, Math.max(1, Math.ceil(reward / 3))), tgt.x, tgt.y);
        if (isP) { this.hitStop = Math.max(this.hitStop, 0.05); this.fx.addShake(4); }
        this.sfx.catch(isP ? this.combo : 1);
        if (pig.def.boss) {
            this.fx.confetti(pig.x, pig.y - 20, 50);
            this.fx.addShake(16);
            this.fx.text(pig.x, pig.y - 70, 'БОСС ПОВЕРЖЕН!', { color: '#ffd23f', size: 34, life: 1.6 });
        }
        this.checkAch();

        if (this.isOnline && this.network) {
            if (this.onlineMode === 'battle') {
                this.network.broadcastEvent('PIG_CAUGHT', {
                    catcher: pNum,
                    p1Score: this.battleP1Score,
                    p2Score: this.battleP2Score,
                    reward,
                    combo: this.combo
                });
            } else if (this.netRole === 'host') {
                this.network.broadcastEvent('PIG_CAUGHT', {
                    catcher: pNum,
                    reward,
                    combo: this.combo,
                    coopCombo: this.coopCatchCombo
                });
            }
        }
    }

    /* ================= Кооперативные механики ================= */
    /** Зажатие свиней/кабанов/босса в клещи двумя игроками (co-op pin stun) */
    updateCoopPinning(dt) {
        if (this.mode !== 'coop' || !this.player || !this.player2) return;
        if (this.state !== 'play') return;
        const p1 = this.player, p2 = this.player2;
        if (p1.stun > 0 || p2.stun > 0) return;

        for (const pig of this.pigs) {
            if (!pig.active || pig.inBarn || pig.state === 'escape' || pig.state === 'burst') continue;
            const isTough = pig.def.charger || pig.def.boss || pig.type === 'big' || pig.type === 'boss';
            if (!isTough) continue;
            if (pig.coopPinCd > 0) pig.coopPinCd -= dt;

            const pinRange = pig.r + 58;
            const d1 = U.dist(p1.x, p1.y, pig.x, pig.y);
            const d2 = U.dist(p2.x, p2.y, pig.x, pig.y);

            if (d1 <= pinRange && d2 <= pinRange) {
                const v1x = (p1.x - pig.x) / (d1 || 1);
                const v1y = (p1.y - pig.y) / (d1 || 1);
                const v2x = (p2.x - pig.x) / (d2 || 1);
                const v2y = (p2.y - pig.y) / (d2 || 1);
                const dot = v1x * v2x + v1y * v2y;

                // Если игроки окружают с разных сторон (угол между векторами > ~75°)
                if (dot < 0.25 && (pig.coopPinCd || 0) <= 0) {
                    pig.coopPinCd = 4.0;
                    pig.state = 'dizzy';
                    pig.stateT = 3.0;
                    pig.vx = 0; pig.vy = 0;
                    if (pig.chargeCd !== undefined) pig.chargeCd = Math.max(pig.chargeCd, 3.5);

                    this.sfx.hit();
                    this.fx.addShake(12);
                    this.fx.addFlash('#fef08a', 0.2);
                    this.fx.text(pig.x, pig.y - pig.r - 28, '🤝 ЗАЖАТ В КЛЕЩИ! ОГЛУШЁН!', { color: '#facc15', size: 24, life: 1.8 });
                    this.fx.stars(pig.x, pig.y - pig.r, 14, ['#38bdf8', '#facc15', '#ffffff']);
                    this.fx.ring(pig.x, pig.y, pig.r + 30, '#38bdf8', 0.5, 5);
                    this.fx.ring(pig.x, pig.y, pig.r + 45, '#facc15', 0.6, 3);

                    if (this.isOnline && this.network) {
                        this.network.broadcastEvent('COOP_PIN', { x: pig.x, y: pig.y - pig.r });
                    }
                }
            }
        }
    }

    /** Выручка оглушенного напарника при сближении */
    updateCoopPartnerAssist() {
        if (this.mode !== 'coop' || !this.player || !this.player2) return;
        const p1 = this.player, p2 = this.player2;
        const dist = U.dist(p1.x, p1.y, p2.x, p2.y);
        if (dist < 46) {
            if (p1.stun > 0 && p2.stun <= 0) {
                p1.stun = 0;
                this.fx.text(p1.x, p1.y - 32, 'НАПАРНИК ВЫРУЧИЛ! 🤝', { color: '#4ade80', size: 22, life: 1.2 });
                this.fx.stars(p1.x, p1.y - 15, 6, ['#4ade80', '#ffffff']);
                this.sfx.powerup();
                if (this.isOnline && this.network) {
                    this.network.broadcastEvent('ASSIST', { x: p1.x, y: p1.y });
                }
            } else if (p2.stun > 0 && p1.stun <= 0) {
                p2.stun = 0;
                this.fx.text(p2.x, p2.y - 32, 'НАПАРНИК ВЫРУЧИЛ! 🤝', { color: '#4ade80', size: 22, life: 1.2 });
                this.fx.stars(p2.x, p2.y - 15, 6, ['#4ade80', '#ffffff']);
                this.sfx.powerup();
                if (this.isOnline && this.network) {
                    this.network.broadcastEvent('ASSIST', { x: p2.x, y: p2.y });
                }
            }
        }
    }

    /* ================= Бонусы ================= */
    pickPowerup(u, picker) {
        const def = POWERUPS[u.id], p = picker || this.player;
        if (u.id === 'speed' || u.id === 'net' || u.id === 'x2') this.buffs[u.id] = def.time;
        else if (u.id === 'carrot') this.lureT = def.time;
        else if (u.id === 'freeze') { for (const pig of this.pigs) if (pig.active && pig.state !== 'escape') pig.frozen = def.time; }
        else if (u.id === 'clock') { this.timeLeft += 10; this.timeTotal += 10; }
        this.fx.text(p.x, p.y - 52, def.text, { color: def.color, size: 26, life: 1.2 });
        this.fx.ring(p.x, p.y, 40, def.color, 0.4, 4);
        this.fx.stars(p.x, p.y - 10, 6, [def.color, '#ffffff']);
        this.sfx.powerup();
        this.pickups++;
        if (this.quest && this.quest.id === 'powerups' && this.pickups >= this.quest.goal) this.completeQuest();
    }

    /* ================= Задание и достижения ================= */
    completeQuest() {
        const q = this.quest;
        if (!q || q.done || q.failed) return;
        q.done = true;
        this.ui.toast('📜', 'Задание выполнено', q.text + ' (+' + q.reward + ' 🪙 по итогам дня)', 3600);
        this.sfx.achievement();
    }

    checkQuestAtWin() {
        const q = this.quest;
        if (!q || q.done) return;
        if (q.id === 'fast' && this.timeTotal > 0 && (this.timeLeft / this.timeTotal) * 100 >= q.goal) this.completeQuest();
        else if (q.id === 'nodash' && !this.dashUsed) this.completeQuest();
        else if (q.id === 'nostun' && !this.stunned) this.completeQuest();
    }

    checkAch(silent) {
        const s = this.save;
        let changed = false;
        for (const a of ACHIEVEMENTS) {
            if (s.ach[a.id] || (s.stats[a.stat] || 0) < a.goal) continue;
            s.ach[a.id] = true;
            s.coins += a.reward;
            changed = true;
            if (!silent) {
                this.ui.toast(a.icon, 'Достижение: ' + a.title, '+' + a.reward + ' 🪙', 3800);
                this.sfx.achievement();
            }
        }
        if (changed) this.saveDirty = true;
    }

    finishTutorial() {
        this.tutStep = 3;
        if (!this.save.tutorial) { this.save.tutorial = true; this.saveDirty = true; }
    }

    /* ================= Конец дня и режим Битвы 1v1 ================= */
    victory() {
        if (this.state === 'ending' || this.state === 'result' || this.state === 'battle_result') return;
        this.state = 'ending';
        this.endT = 1.3;
        this.slowT = 0.5;
        this.winPlayed = true;
        this.checkQuestAtWin();
        this.sfx.win();
        this.fx.confetti(this.player.x, this.player.y - 30, 60);
        if (this.mode === 'coop' && this.player2) {
            this.fx.confetti(this.player2.x, this.player2.y - 30, 60);
        }
        this.fx.addFlash('#fff6c0', 0.3);
        this.ui.banner('Все свиньи пойманы!', '', 1500);
        for (const p of this.pigs) if (p && p.active && p.state !== 'escape') p.beginEscape(this.world);
    }

    timeUp() {
        if (this.state === 'ending' || this.state === 'result' || this.state === 'battle_result') return;
        this.state = 'ending';
        this.endT = 1.3;
        this.timeLeft = 0;
        this.spawnQueue = [];
        this.waves = [];
        this.goldTimes = [];
        this.sfx.tempoMul = 1;
        this.ui.banner('Солнце село!', '', 1500);
        for (const p of this.pigs) if (p && p.active && p.state !== 'escape') p.beginEscape(this.world);
    }

    /**
     * Завершение дня (endDay):
     * Чистый переход в состояние 'result', пауза геймплея, расчет звёзд, монет, комбо,
     * командного бонуса в коопе и надежный вызов окна итогов без зависаний.
     */
    endDay() {
        if (this.state === 'result') return;
        this.state = 'result';
        this.paused = true;
        this.sfx.tempoMul = 1;

        try {
            const s = this.save || {};
            const st = s.stats || (s.stats = {});
            const q = this.quest;
            const day = this.day || 1;
            const total = Math.max(1, this.total || 1);
            const caught = this.dayCaught || 0;
            const all = caught >= total;
            const frac = this.timeTotal > 0 ? U.clamp(this.timeLeft / this.timeTotal, 0, 1) : 0;
            let stars = 0;
            if (all && frac >= 0.3) stars = 3;
            else if (all) stars = 2;
            else if (total > 0 && caught / total >= 0.6) stars = 1;
            const failed = stars === 0;

            const isCoop = this.mode === 'coop' || (this.network && this.network.isConnected && this.onlineMode === 'coop');

            const p1c = this.dayCaughtP1 || 0;
            const p2c = this.dayCaughtP2 || 0;
            const p1m = this.dayCoinsP1 || 0;
            const p2m = this.dayCoinsP2 || 0;
            const mvp = p1c > p2c ? 1 : (p2c > p1c ? 2 : (p1c > 0 ? 0 : 0));

            const lines = [];
            lines.push({ label: 'Свиней поймано', value: caught + ' из ' + total });
            if (isCoop) {
                const p1Label = this.isOnline ? '  🧑‍🌾 Хост (Амбар 1)' : '  🧑‍🌾 Игрок 1 (WASD)';
                const p2Label = this.isOnline ? '  👩‍🌾 Гость (Амбар 2)' : '  👩‍🌾 Игрок 2 (Стрелки)';
                lines.push({ label: p1Label, value: p1c + ' шт.' });
                lines.push({ label: p2Label, value: p2c + ' шт.' });
                if (this.coopCatchCombo > 0) {
                    lines.push({ label: '  🤝 Кооп-комбо', value: 'x' + this.coopCatchCombo });
                }
                lines.push({ label: 'Командный улов', value: '+' + (this.dayCoins || 0) + ' 🪙' });
            } else {
                lines.push({ label: 'Монеты за свиней', value: '+' + (this.dayCoins || 0) + ' 🪙' });
            }

            let earned = this.dayCoins || 0;
            if (!failed) {
                const starB = stars * (2 + Math.floor(day / 2));
                const timeB = all ? Math.floor((this.timeLeft || 0) / 3) : 0;
                const questB = q && q.done ? (q.reward || 0) : 0;
                lines.push({ label: 'Бонус за звёзды', value: '+' + starB + ' 🪙' });
                if (timeB > 0) lines.push({ label: 'Бонус за время', value: '+' + timeB + ' 🪙' });
                const bonus = starB + timeB + questB;
                s.coins = (s.coins || 0) + bonus;
                st.totalCoins = (st.totalCoins || 0) + bonus;
                earned += bonus;
            }

            // Командный бонус за слаженную работу в коопе (только в кооп-режиме)
            let teamworkBonus = 0;
            if (isCoop && !failed) {
                teamworkBonus = Math.round((this.coopCatchCombo || 0) * 3 + Math.min(p1c, p2c) * 2);
                if (teamworkBonus > 0) {
                    lines.push({ label: '🤝 Командная синергия', value: '+' + teamworkBonus + ' 🪙' });
                    s.coins = (s.coins || 0) + teamworkBonus;
                    st.totalCoins = (st.totalCoins || 0) + teamworkBonus;
                    earned += teamworkBonus;
                }
            }

            if (!failed) {
                s.day = day + 1;
                st.bestDay = Math.max(st.bestDay || 1, s.day);
                st.daysPlayed = (st.daysPlayed || 0) + 1;
                if (stars === 3) st.perfectDays = (st.perfectDays || 0) + 1;
            }
            if (day === 1) this.finishTutorial();
            this.checkAch();
            this.persist();

            if (failed) this.sfx.fail(); else if (!this.winPlayed) this.sfx.win();

            const resultData = {
                day, stars, failed, caught, total,
                escaped: Math.max(0, total - caught),
                lines, earned,
                quest: q ? { text: q.text, done: !!q.done, reward: q.reward } : null,
                bestCombo: this.dayBestCombo || 0,
                canPrestige: this.canPrestige(),
                mode: isCoop ? 'coop' : 'solo',
                isCoop: isCoop
            };

            // Never pass co-op flag or co-op card data when playing solo!
            if (isCoop) {
                resultData.p1Caught = p1c;
                resultData.p2Caught = p2c;
                resultData.p1Coins = p1m;
                resultData.p2Coins = p2m;
                resultData.mvp = mvp;
                resultData.teamworkBonus = teamworkBonus;
                resultData.coopCombo = this.coopCatchCombo || 0;
            }

            // Обновление карточки двух игроков в окне итогов
            const coopCard = document.getElementById('res-coop-card');
            if (coopCard) {
                if (isCoop) {
                    coopCard.classList.remove('hidden');
                    const elP1c = document.getElementById('res-p1-caught'); if (elP1c) elP1c.textContent = p1c;
                    const elP2c = document.getElementById('res-p2-caught'); if (elP2c) elP2c.textContent = p2c;
                    const elP1m = document.getElementById('res-p1-coins'); if (elP1m) elP1m.textContent = p1m;
                    const elP2m = document.getElementById('res-p2-coins'); if (elP2m) elP2m.textContent = p2m;
                    const elCombo = document.getElementById('res-coop-combo'); if (elCombo) elCombo.textContent = 'x' + (this.coopCatchCombo || 0);

                    const b1 = document.getElementById('res-p1-badge');
                    const b2 = document.getElementById('res-p2-badge');
                    if (b1) {
                        b1.classList.toggle('hidden', !(p1c > p2c && p1c > 0));
                        b1.textContent = '👑 MVP ДНЯ';
                    }
                    if (b2) {
                        b2.classList.toggle('hidden', !(p2c > p1c && p2c > 0));
                        b2.textContent = '👑 MVP ДНЯ';
                    }
                } else {
                    coopCard.classList.add('hidden');
                }
            }

            if (this.ui) {
                if (isCoop && typeof this.ui.showCoopResult === 'function') {
                    this.ui.showCoopResult(resultData);
                } else if (typeof this.ui.showResult === 'function') {
                    this.ui.showResult(resultData);
                }
            }
        } catch (err) {
            console.error('Error in endDay:', err);
            if (this.ui && typeof this.ui.showResult === 'function') {
                try {
                    this.ui.showResult({
                        day: this.day || 1,
                        stars: 1,
                        failed: false,
                        caught: this.dayCaught || 0,
                        total: this.total || 0,
                        lines: [],
                        earned: this.dayCoins || 0,
                        mode: 'solo',
                        isCoop: false
                    });
                } catch (e2) {
                    console.error('Fallback showResult failed:', e2);
                }
            }
        }
    }

    finishDay() {
        return this.endDay();
    }

    /* ================= 1v1 Battle Mode («Битва ловцов на 60 сек») ================= */
    startBattle(initPacket = null) {
        this.onlineMode = 'battle';
        this.mode = 'coop'; // 2 игрока на поле
        this.state = 'play';
        this.paused = false;
        this.battleActive = true;
        this.battleTimer = (typeof CONFIG !== 'undefined' && CONFIG.BATTLE_DURATION) || 60.0;
        this.battleDuration = this.battleTimer;
        this.battleP1Score = 0;
        this.battleP2Score = 0;
        this.battleWinner = null;
        this.lastTickSec = -1;

        this.dayCaught = 0;
        this.dayCaughtP1 = 0;
        this.dayCaughtP2 = 0;
        this.dayCoins = 0;
        this.dayCoinsP1 = 0;
        this.dayCoinsP2 = 0;
        this.combo = 0;
        this.comboT = 0;
        this.pigs = [];
        this.spawnQueue = [];
        this.waves = [];
        this.powerups = [];
        this.helpers = [];
        this.dogs = [];
        this.fx.clear();

        // Карта и позиции игроков
        this.setupWorld(1, true);
        this.initPlayers();
        this.resetPlayerAtGate();

        // Уравнивание характеристик обоих игроков для честной битвы
        this.recalc();

        // Появление начальной группы свиней высокой плотности (8 шт.)
        if (this.netRole === 'host' || !this.isOnline) {
            const targetPigs = (typeof CONFIG !== 'undefined' && CONFIG.BATTLE_PIG_TARGET) || 8;
            for (let i = 0; i < targetPigs; i++) {
                this.spawnBattlePig();
            }
        }

        // Обновление HUD битвы
        this.updateBattleHud();
        this.sfx.init();
        this.sfx.tempoMul = 1;
        this.sfx.win(); // стартовый свисток

        if (this.ui) {
            this.ui.hideTitle();
            this.ui.hideResult();
            this.hideBattleResult();
            if (typeof this.ui.closeOnlineModal === 'function') this.ui.closeOnlineModal();
            this.ui.setHud(true);
            if (typeof this.ui.setBattleHud === 'function') this.ui.setBattleHud(true);
            this.ui.banner('⚔️ 1v1 БИТВА ЛОВЦОВ!', '60 сек · Поймай больше свиней!', 2200);
            this.ui.toast('⚔️', 'Битва началась!', 'Хватай сачок и лови свиней быстрее соперника!');
        }

        if (this.isOnline && this.network && this.netRole === 'host') {
            this.network.broadcastEvent('BATTLE_START', {
                duration: this.battleDuration,
                targetPigs: (typeof CONFIG !== 'undefined' && CONFIG.BATTLE_PIG_TARGET) || 8
            });
        }
    }

    /** Спавн свиньи для режима Битвы (появляются из кустов и амбаров) */
    spawnBattlePig() {
        if (!this.world) return null;
        let spot = null;
        const bushes = (this.world.props || []).filter(pr => pr && pr.k === 'bush');
        if (bushes.length > 0 && Math.random() < 0.65) {
            const b = U.pick(bushes);
            spot = { x: b.x + U.rand(-15, 15), y: b.y + U.rand(-10, 10) };
        } else if (this.world.doors && this.world.doors.length > 0 && Math.random() < 0.6) {
            const d = U.pick(this.world.doors);
            spot = { x: d.x + U.rand(-20, 20), y: d.y + 10 };
        } else {
            spot = this.world.freeSpot(30);
        }

        const r = Math.random();
        let type = 'pink';
        if (r < 0.22) type = 'runner';
        else if (r < 0.46) type = 'piglet';
        else if (r < 0.58) type = 'mud';
        else if (r < 0.66) type = 'gold';

        const pig = new Pig(type, spot.x, spot.y, 1);
        pig.startBurst(Math.random() * Math.PI * 2, U.rand(0.65, 1.15));
        this.pigs.push(pig);
        this.fx.dust(spot.x, spot.y, 4, this.dustColor);
        if (type === 'gold') {
            this.sfx.gold();
            this.fx.stars(spot.x, spot.y, 6, ['#ffe066', '#ffffff']);
        }
        return pig;
    }

    /** Цикл обновления 60-секундного матча Битвы */
    updateBattle(dt) {
        if (!this.battleActive) return;
        this.battleTimer -= dt;

        // Темп музыки и звуковой таймер в последние секунды
        this.sfx.tempoMul = this.battleTimer <= 10 ? 1.3 : 1;
        if (this.battleTimer <= 5 && this.battleTimer > 0) {
            const sec = Math.ceil(this.battleTimer);
            if (sec !== this.lastTickSec) {
                this.lastTickSec = sec;
                this.sfx.tick();
            }
        }

        // Непрерывный спавн: поддержание плотности в 8 свиней
        if (this.netRole === 'host' || !this.isOnline) {
            const activeCount = this.pigs.filter(p => p.active && !p.caught && !p.inBarn && p.state !== 'escape').length;
            const target = (typeof CONFIG !== 'undefined' && CONFIG.BATTLE_PIG_TARGET) || 8;
            if (activeCount < target) {
                const need = Math.min(3, target - activeCount);
                for (let i = 0; i < need; i++) this.spawnBattlePig();
            }
        }

        this.updateBattleHud();

        // Окончание матча ровно на 0 секунд
        if (this.battleTimer <= 0) {
            this.battleTimer = 0;
            this.endBattle();
        }
    }

    /** Обновление интерфейса табло Битвы */
    updateBattleHud() {
        const bar = document.getElementById('hud-battle-bar');
        if (!bar) return;
        if (this.onlineMode !== 'battle' || this.state === 'title') {
            bar.classList.add('hidden');
            return;
        }
        bar.classList.remove('hidden');

        const p1ScoreEl = document.getElementById('battle-p1-score');
        if (p1ScoreEl) p1ScoreEl.textContent = this.battleP1Score || 0;

        const p2ScoreEl = document.getElementById('battle-p2-score');
        if (p2ScoreEl) p2ScoreEl.textContent = this.battleP2Score || 0;

        const timerEl = document.getElementById('battle-timer-secs');
        if (timerEl) {
            const secs = Math.max(0, Math.ceil(this.battleTimer));
            timerEl.textContent = secs;
            if (timerEl.parentElement) {
                timerEl.parentElement.classList.toggle('urgent', secs <= 10);
            }
        }

        const p1NameEl = document.getElementById('battle-p1-name');
        if (p1NameEl) p1NameEl.textContent = (this.save && this.save.nickname) || 'Фермер';

        const p2NameEl = document.getElementById('battle-p2-name');
        if (p2NameEl) p2NameEl.textContent = this.opponentNickname || 'Фермерша';
    }

    /** Окончание матча Битвы: подсчет счета, определение победителя, награда и запись в лидерборд */
    endBattle(winnerOverride = null) {
        if (!this.battleActive && this.state === 'battle_result') return;
        this.battleActive = false;
        this.state = 'battle_result';
        this.paused = true;
        this.sfx.tempoMul = 1;

        if (winnerOverride) {
            this.battleWinner = winnerOverride;
        } else if (this.battleP1Score > this.battleP2Score) {
            this.battleWinner = 'p1';
        } else if (this.battleP2Score > this.battleP1Score) {
            this.battleWinner = 'p2';
        } else {
            this.battleWinner = 'draw';
        }

        const isHost = !this.isOnline || this.netRole === 'host';
        let localResult = 'draw';
        if (this.battleWinner === 'p1') localResult = isHost ? 'win' : 'lose';
        else if (this.battleWinner === 'p2') localResult = isHost ? 'lose' : 'win';
        else localResult = 'draw';

        // Звуки свистка и победы
        this.sfx.win();

        // Награда за битву: победа = 25, ничья = 10, участие = 5 монет
        const reward = (typeof CONFIG !== 'undefined' && typeof CONFIG.battleReward === 'function')
            ? CONFIG.battleReward(localResult)
            : (localResult === 'win' ? 25 : (localResult === 'draw' ? 10 : 5));
        this.addCoins(reward);

        // Сохранение статистики боя в профиль игрока и лидерборд
        const myPigs = isHost ? this.battleP1Score : this.battleP2Score;
        const oppPigs = isHost ? this.battleP2Score : this.battleP1Score;
        const oppName = this.opponentNickname || (isHost ? 'Фермерша' : 'Фермер');

        if (!this.save.battleStats) {
            this.save.battleStats = { wins: 0, losses: 0, ties: 0, bestCatch: 0, totalMatches: 0 };
        }
        this.save.battleStats.totalMatches++;
        if (localResult === 'win') {
            this.save.battleStats.wins++;
            if (!this.save.stats) this.save.stats = {};
            this.save.stats.battleWins = (this.save.stats.battleWins || 0) + 1;
        } else if (localResult === 'lose') {
            this.save.battleStats.losses++;
            if (!this.save.stats) this.save.stats = {};
            this.save.stats.battleLosses = (this.save.stats.battleLosses || 0) + 1;
        } else {
            this.save.battleStats.ties++;
        }
        this.save.battleStats.bestCatch = Math.max(this.save.battleStats.bestCatch || 0, myPigs);
        if (!this.save.stats) this.save.stats = {};
        this.save.stats.bestBattlePigs = Math.max(this.save.stats.bestBattlePigs || 0, myPigs);

        if (this.storage && typeof this.storage.recordBattleResult === 'function') {
            try {
                this.storage.recordBattleResult(localResult, myPigs, oppPigs, oppName);
            } catch (err) {
                console.warn('recordBattleResult error:', err);
            }
        }
        this.persist();

        // Визуальные эффекты победителя
        if (localResult === 'win') {
            this.fx.confetti(this.player.x, this.player.y - 30, 80);
            this.fx.addFlash('#fef08a', 0.35);
        }

        const p1Name = (this.save && this.save.nickname) || 'Фермер';
        const p2Name = this.opponentNickname || 'Фермерша';

        const battleData = {
            winner: this.battleWinner,
            localResult,
            isHost,
            role: isHost ? 'host' : 'guest',
            p1Score: this.battleP1Score,
            p2Score: this.battleP2Score,
            myScore: myPigs,
            oppScore: oppPigs,
            reward,
            p1Name,
            p2Name
        };

        if (this.isOnline && this.network && this.netRole === 'host') {
            this.network.broadcastEvent('BATTLE_END', {
                winner: this.battleWinner,
                p1Score: this.battleP1Score,
                p2Score: this.battleP2Score
            });
        }

        this.showBattleResult(battleData);
    }

    /** Отображение экрана окончания Битвы 1v1 */
    showBattleResult(data) {
        if (this.ui && typeof this.ui.showBattleResult === 'function') {
            this.ui.showBattleResult(data);
            return;
        }

        const modal = document.getElementById('battle-result-modal');
        if (!modal) {
            const title = data.localResult === 'win' ? '👑 ПОБЕДА!' : (data.localResult === 'draw' ? '🤝 НИЧЬЯ!' : 'ПОРАЖЕНИЕ');
            this.ui.banner(title, `Счёт: ${data.p1Score} vs ${data.p2Score} · +${data.reward} 🪙`, 5000);
            return;
        }

        const isWin = data.localResult === 'win';
        const isDraw = data.localResult === 'draw';

        const iconEl = document.getElementById('battle-result-icon');
        if (iconEl) iconEl.textContent = isWin ? '👑' : (isDraw ? '🤝' : '😵');

        const titleEl = document.getElementById('battle-result-title');
        if (titleEl) titleEl.textContent = isWin ? 'ПОБЕДА!' : (isDraw ? 'НИЧЬЯ!' : 'ПОРАЖЕНИЕ');

        const descEl = document.getElementById('battle-result-desc');
        if (descEl) {
            descEl.textContent = isWin
                ? 'Вы поймали больше свиней за 60 секунд!'
                : (isDraw ? 'Боевая ничья! Отличная реакция обоих фермеров!' : 'Соперник оказался быстрее в этот раз!');
        }

        const p1ScoreEl = document.getElementById('battle-res-score-p1');
        if (p1ScoreEl) p1ScoreEl.textContent = data.p1Score;

        const p2ScoreEl = document.getElementById('battle-res-score-p2');
        if (p2ScoreEl) p2ScoreEl.textContent = data.p2Score;

        const p1NameEl = document.getElementById('battle-res-name-p1');
        if (p1NameEl) p1NameEl.textContent = data.p1Name || 'Фермер';

        const p2NameEl = document.getElementById('battle-res-name-p2');
        if (p2NameEl) p2NameEl.textContent = data.p2Name || 'Фермерша';

        const b1 = document.getElementById('battle-res-badge-p1');
        const b2 = document.getElementById('battle-res-badge-p2');
        if (b1) {
            b1.className = 'battle-res-badge' + (data.winner === 'p1' ? ' winner' : '');
            b1.textContent = data.winner === 'p1' ? '👑 ПОБЕДИТЕЛЬ' : (data.winner === 'draw' ? '🤝 НИЧЬЯ' : '2 МЕСТО');
        }
        if (b2) {
            b2.className = 'battle-res-badge' + (data.winner === 'p2' ? ' winner' : '');
            b2.textContent = data.winner === 'p2' ? '👑 ПОБЕДИТЕЛЬ' : (data.winner === 'draw' ? '🤝 НИЧЬЯ' : '2 МЕСТО');
        }

        const rewEl = document.getElementById('battle-reward-text');
        if (rewEl) rewEl.textContent = `+${data.reward} 🪙`;

        modal.classList.remove('hidden');

        const rematchBtn = document.getElementById('btn-battle-rematch');
        if (rematchBtn) {
            rematchBtn.onclick = () => {
                modal.classList.add('hidden');
                this.rematchBattle();
            };
        }
        const exitBtn = document.getElementById('btn-battle-exit');
        if (exitBtn) {
            exitBtn.onclick = () => {
                modal.classList.add('hidden');
                this.exitBattle();
            };
        }
    }

    hideBattleResult() {
        const modal = document.getElementById('battle-result-modal');
        if (modal) modal.classList.add('hidden');
    }

    rematchBattle() {
        this.hideBattleResult();
        if (this.isOnline && this.network) {
            this.network.broadcastEvent('BATTLE_REMATCH', {});
        }
        this.startBattle();
    }

    exitBattle() {
        this.hideBattleResult();
        const bar = document.getElementById('hud-battle-bar');
        if (bar) bar.classList.add('hidden');
        this.onlineMode = 'coop';
        this.battleActive = false;
        if (this.isOnline && this.network) {
            this.network.disconnect();
        }
        this.enterTitle();
    }

    /* ================= Обновление ================= */
    isActiveState() { return this.state === 'play' || this.state === 'intro' || this.state === 'ending'; }

    update(rdt) {
        this.time += rdt;
        this.swingBuf1 = Math.max(0, this.swingBuf1 - rdt);
        this.swingBuf2 = Math.max(0, this.swingBuf2 - rdt);

        // В состоянии итогов дня или битвы полностью останавливаем физику мира,
        // обновляя лишь партиклы и анимацию монет
        if (this.state === 'result' || this.state === 'battle_result') {
            this.fx.update(0, rdt);
            const arrived = this.fx.updateCoins(rdt);
            if (arrived > 0) {
                const now = performance.now();
                if (now - this.lastCoinSfx > 50) { this.lastCoinSfx = now; this.ui.bumpCoins(); this.sfx.coin(); }
            }
            return;
        }

        this.frozenNow = this.paused || (this.ui.modalOpen && this.isActiveState());
        if (this.frozenNow) return;

        let dt = rdt;
        if (this.hitStop > 0) { this.hitStop -= rdt; dt = 0; }
        else {
            if (this.state === 'ending' && this.slowT > 0) { this.slowT -= rdt; this.timeScale = 0.25; } else this.timeScale = 1;
            dt = rdt * this.timeScale;
        }

        const w = this.world, p = this.player, p2 = this.player2, st = this.state;
        if (st === 'title') this.titleT += rdt;

        // Состояния
        if (st === 'intro') {
            this.introT -= rdt;
            if (this.introT <= 0) this.beginPlay();
        } else if (st === 'ending') {
            this.endT -= rdt;
            if (this.endT <= 0) this.endDay();
        }
        const playing = this.state === 'play';

        w.update(dt);

        // Игрок 1
        const mv1 = this.moveVector(1);
        const px0 = p.x, py0 = p.y;
        if (p) p.sprintHeld = !!(this.keys && (this.mode === 'coop' ? this.keys.shift1 : (this.keys.shift1 || this.keys.shift2)));
        p.update(dt, this, mv1.x, mv1.y);
        if (this.tutStep === 0 && playing) {
            this.tutMove += Math.hypot(p.x - px0, p.y - py0);
            if (this.tutMove > 140) this.tutStep = 1;
        }

        // Игрок 2 (в кооп-режиме)
        if (this.mode === 'coop' && p2) {
            const mv2 = this.moveVector(2);
            p2.sprintHeld = !!(this.keys && this.keys.shift2);
            p2.update(dt, this, mv2.x, mv2.y);
        }

        // Трекинг общего времени бега / спринта для цепочки достижений «Марафонец»
        if (playing && ((p && p.isSprinting) || (p2 && p2.isSprinting))) {
            if (!this.storage.data) this.storage.data = this.save || {};
            this.storage.data.sprintTimeTotal = (this.storage.data.sprintTimeTotal || 0) + dt;
            if (this.save) this.save.sprintTimeTotal = this.storage.data.sprintTimeTotal;
            if (!this.save.stats) this.save.stats = {};
            this.save.stats.sprintTimeTotal = this.storage.data.sprintTimeTotal;
        }

        // Взмахи сачком
        if (playing && this.inputAllowed()) {
            if (this.isOnline && this.netRole === 'guest') {
                const want2 = this.swingBuf2 > 0 || this.swingBuf1 > 0 || this.keys.space || this.keys.enter || this.mouseDown || this.input.swingHeld;
                if (want2 && p2 && p2.canSwing()) { this.doSwing(2); this.swingBuf1 = 0; this.swingBuf2 = 0; }
            } else {
                const want1 = this.swingBuf1 > 0 || this.keys.space || this.mouseDown || this.input.swingHeld;
                if (want1 && p.canSwing()) { this.doSwing(1); this.swingBuf1 = 0; }

                if (this.mode === 'coop' && p2 && !this.isOnline) {
                    const want2 = this.swingBuf2 > 0 || this.keys.enter;
                    if (want2 && p2.canSwing()) { this.doSwing(2); this.swingBuf2 = 0; }
                }
            }
        }

        // Кооп-взаимодействия (клещи и выручка)
        if (this.mode === 'coop' && p2) {
            this.updateCoopPinning(dt);
            this.updateCoopPartnerAssist();
        }

        for (const h of this.helpers) h.update(dt, this);
        for (const o of this.dogs) o.update(dt, this);

        // Расписание дня или режим Битвы
        if (playing) {
            if (this.onlineMode === 'battle') {
                this.updateBattle(dt);
            } else {
                this.updateDay(dt);
            }
        }

        // Свиньи
        for (const pig of this.pigs) pig.update(dt, this);
        this.separatePigs(dt);
        this.pigs = this.pigs.filter((pig) => !pig.inBarn && !pig.gone);

        // Угрозы, радиус, подсветка
        this.threats.length = 0;
        if (this.state !== 'title' && this.state !== 'result') {
            this.threats.push({ x: p.x, y: p.y, k: 1 });
            if (this.mode === 'coop' && p2) {
                this.threats.push({ x: p2.x, y: p2.y, k: 1 });
            }
            for (const h of this.helpers) this.threats.push({ x: h.x, y: h.y, k: 0.7 });
        }

        this.reach = this.reachFor(p);
        this.reach2 = p2 ? this.reachFor(p2) : CONFIG.CATCH_RADIUS;

        let inReach1 = false, inReach2 = false;
        for (const pig of this.pigs) {
            if (!pig.active || pig.state === 'burst' || pig.state === 'escape') continue;
            if (!inReach1 && U.dist(p.x, p.y, pig.x, pig.y) <= this.reach + pig.r * 0.6) inReach1 = true;
            if (p2 && !inReach2 && U.dist(p2.x, p2.y, pig.x, pig.y) <= this.reach2 + pig.r * 0.6) inReach2 = true;
            if (inReach1 && (inReach2 || !p2)) break;
        }
        this.pigInReach = inReach1;
        this.pigInReach2 = inReach2;

        // Бафы и комбо
        for (const k of ['speed', 'net', 'x2']) if (this.buffs[k] > 0) this.buffs[k] = Math.max(0, this.buffs[k] - dt);
        if (this.lureT > 0) this.lureT = Math.max(0, this.lureT - dt);
        if (this.comboPulse > 0) this.comboPulse = Math.max(0, this.comboPulse - rdt * 4);
        if (this.combo > 0 && this.state !== 'title') {
            this.comboT -= dt;
            if (this.comboT <= 0) {
                if (this.combo >= 3) this.sfx.comboBreak();
                this.combo = 0; this.comboT = 0;
            }
        }

        this.updateWeather(dt);
        this.fx.update(dt, rdt);
        const arrived = this.fx.updateCoins(rdt);
        if (arrived > 0) {
            const now = performance.now();
            if (now - this.lastCoinSfx > 50) { this.lastCoinSfx = now; this.ui.bumpCoins(); this.sfx.coin(); }
        }

        this.updateCamera(rdt);

        // Анимация монет
        const diff = this.save.coins - this.shownCoins;
        if (Math.abs(diff) < 1) this.shownCoins = this.save.coins;
        else this.shownCoins += diff * Math.min(1, rdt * 6) + Math.sign(diff) * 0.2;

        if (this.saveDirty && performance.now() - this.lastSaveAt > 2000) this.persist();

        if (this.state !== 'title') {
            this.ui.updateHud({
                day: this.day, caught: this.dayCaught, total: this.total, coins: Math.round(this.shownCoins),
                timeLeft: Math.max(0, this.timeLeft), timeTotal: this.timeTotal,
                seasonIcon: w.season.icon, eventIcon: this.event ? EVENTS[this.event].icon : '',
                mode: this.mode,
                p1Caught: this.dayCaughtP1,
                p2Caught: this.dayCaughtP2,
                p1Coins: this.dayCoinsP1,
                p2Coins: this.dayCoinsP2,
                p1DashReady: this.player ? this.player.dashCdT <= 0 : true,
                p2DashReady: (this.mode === 'coop' && this.player2) ? this.player2.dashCdT <= 0 : true,
                coopCombo: this.coopCatchCombo
            });
        }
    }

    updateDay(dt) {
        this.elapsed += dt;
        this.timeLeft -= dt;

        // Очередь появления
        for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
            const q = this.spawnQueue[i];
            q.t -= dt;
            if (q.t <= 0) { this.spawnQueue.splice(i, 1); this.spawnPig(q.type); }
        }
        // Следующая волна
        if (this.waves.length) {
            const wv = this.waves[0];
            if (this.elapsed >= wv.at || this.fieldCount() === 0) {
                this.waves.shift();
                this.launchWave(wv.list, true);
            }
        }
        // Золотые свиньи
        if (this.goldTimes.length && this.elapsed >= Math.min(...this.goldTimes)) {
            const idx = this.goldTimes.indexOf(Math.min(...this.goldTimes));
            this.goldTimes.splice(idx, 1);
            this.spawnGold();
        }
        // Бонусы
        this.powerupT -= dt;
        if (this.powerupT <= 0) {
            if (this.powerups.length < CONFIG.POWERUP_MAX) this.spawnPowerup();
            this.powerupT = CONFIG.POWERUP_INTERVAL / this.luck * U.rand(0.7, 1.3);
        }
        const p1 = this.player, p2 = this.player2;
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const u = this.powerups[i];
            u.life -= dt;
            if (u.life <= 0) { this.powerups.splice(i, 1); continue; }
            const d1 = U.dist(p1.x, p1.y, u.x, u.y);
            const d2 = (this.mode === 'coop' && p2) ? U.dist(p2.x, p2.y, u.x, u.y) : Infinity;
            if (d1 < 36) {
                this.powerups.splice(i, 1); this.pickPowerup(u, p1);
            } else if (d2 < 36) {
                this.powerups.splice(i, 1); this.pickPowerup(u, p2);
            }
        }

        // Тик и темп музыки
        const left = this.timeLeft;
        this.sfx.tempoMul = left <= 10 ? 1.25 : 1;
        if (left <= 5 && left > 0) {
            const sec = Math.ceil(left);
            if (sec !== this.lastTickSec) { this.lastTickSec = sec; this.sfx.tick(); }
        }

        // Проверка завершения дня:
        // 1. Все свиньи пойманы -> чистая победа!
        // 2. Все волны вышли и свиней больше нет на поле -> завершение дня без зависания!
        // 3. Время вышло (timeLeft <= 0)
        const allSpawned = this.spawnQueue.length === 0 && this.waves.length === 0;
        if (allSpawned) {
            if (this.dayCaught >= this.total) { this.victory(); return; }
            if (this.fieldCount() === 0) {
                if (this.dayCaught > 0) this.victory();
                else this.timeUp();
                return;
            }
        }
        if (this.timeLeft <= 0) { this.timeUp(); return; }
    }

    separatePigs(dt) {
        const ps = this.pigs, k = Math.min(1, dt * 10);
        if (k <= 0) return;
        for (let i = 0; i < ps.length; i++) {
            const a = ps[i];
            if (!a.active || a.state === 'burst' || a.state === 'escape' || a.state === 'charge') continue;
            for (let j = i + 1; j < ps.length; j++) {
                const b = ps[j];
                if (!b.active || b.state === 'burst' || b.state === 'escape' || b.state === 'charge') continue;
                const dx = b.x - a.x, dy = b.y - a.y, min = (a.r + b.r) * 0.85;
                if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
                const d = Math.hypot(dx, dy);
                if (d >= min) continue;
                const nx = d > 0.01 ? dx / d : 1, ny = d > 0.01 ? dy / d : 0;
                const ov = (min - d) * 0.5 * k;
                const wa = a.def.boss ? 0.2 : 1, wb = b.def.boss ? 0.2 : 1;
                a.x -= nx * ov * wa; a.y -= ny * ov * wa;
                b.x += nx * ov * wb; b.y += ny * ov * wb;
            }
        }
    }

    /* ================= Динамическая камера ================= */
    updateCamera(rdt) {
        const p = this.player, p2 = this.player2, w = this.world;
        let tx, ty;

        if (this.state === 'title') {
            const b = w.barn, t = this.titleT;
            tx = b.x + Math.cos(t * 0.12) * 260; ty = b.y - 20 + Math.sin(t * 0.17) * 120;
            this.zoom = this.baseZoom;
            this.vw = this.w / this.zoom;
            this.vh = this.h / this.zoom;
        } else if (this.isOnline) {
            // Онлайн-мультиплеер на 2 устройства: у каждого игрока своя камера на своём экране
            const targetP = (this.netRole === 'guest' && p2) ? p2 : p;
            this.zoom = this.baseZoom;
            this.vw = this.w / this.zoom;
            this.vh = this.h / this.zoom;
            tx = targetP.x + U.clamp(targetP.vx * 0.28, -110, 110);
            ty = targetP.y - 20 + U.clamp(targetP.vy * 0.28, -80, 80);
        } else if (this.mode === 'coop' && p2) {
            // Динамическая камера между Игроком 1 и Игроком 2 (локальный кооп на одном экране)
            const midX = (p.x + p2.x) / 2;
            const midY = (p.y + p2.y) / 2;
            const dx = Math.abs(p.x - p2.x);
            const dy = Math.abs(p.y - p2.y);

            // Динамическое масштабирование, чтобы оба игрока всегда были в кадре
            const padX = 260, padY = 220;
            const neededZoomX = this.w / (dx + padX);
            const neededZoomY = this.h / (dy + padY);
            const targetZoom = U.clamp(Math.min(neededZoomX, neededZoomY, this.baseZoom), 0.48, this.baseZoom);
            const kZoom = 1 - Math.exp(-rdt * 3.5);
            this.zoom += (targetZoom - this.zoom) * kZoom;
            this.vw = this.w / this.zoom;
            this.vh = this.h / this.zoom;

            const avgVx = (p.vx + p2.vx) / 2;
            const avgVy = (p.vy + p2.vy) / 2;
            tx = midX + U.clamp(avgVx * 0.22, -100, 100);
            ty = midY - 20 + U.clamp(avgVy * 0.22, -70, 70);

            // Мягкое удержание игроков в пределах видимой зоны
            const maxSepX = this.vw * 0.94;
            const maxSepY = this.vh * 0.94;
            const curDx = p2.x - p.x;
            const curDy = p2.y - p.y;
            if (Math.abs(curDx) > maxSepX) {
                const excess = (Math.abs(curDx) - maxSepX) * 0.5;
                if (curDx > 0) { p.x += excess * 0.5; p2.x -= excess * 0.5; }
                else { p.x -= excess * 0.5; p2.x += excess * 0.5; }
            }
            if (Math.abs(curDy) > maxSepY) {
                const excess = (Math.abs(curDy) - maxSepY) * 0.5;
                if (curDy > 0) { p.y += excess * 0.5; p2.y -= excess * 0.5; }
                else { p.y -= excess * 0.5; p2.y += excess * 0.5; }
            }
        } else {
            this.zoom = this.baseZoom;
            this.vw = this.w / this.zoom;
            this.vh = this.h / this.zoom;
            tx = p.x + U.clamp(p.vx * 0.28, -110, 110);
            ty = p.y - 20 + U.clamp(p.vy * 0.28, -80, 80);
        }

        const k = 1 - Math.exp(-rdt * (this.state === 'title' ? 1.5 : 5));
        this.camCX += (tx - this.camCX) * k;
        this.camCY += (ty - this.camCY) * k;
        this.computeCam();
    }

    computeCam() {
        const w = this.world, vw = this.vw, vh = this.vh;
        let x = this.camCX - vw / 2, y = this.camCY - vh / 2;
        x = w.w <= vw ? (w.w - vw) / 2 : U.clamp(x, 0, w.w - vw);
        y = w.h <= vh ? (w.h - vh) / 2 : U.clamp(y, 0, w.h - vh);
        this.camX = Number.isFinite(x) ? x : 0;
        this.camY = Number.isFinite(y) ? y : 0;
    }

    /* ================= Погода ================= */
    weatherParticle(kind, randomY) {
        const vy = kind === 'snow' ? U.rand(80, 130) : U.rand(45, 80);
        const life = randomY ? U.rand(2, 6) : Math.min((this.vh + 60) / vy, 9);
        const x = this.camX + U.rand(-60, this.vw + 60);
        const y = randomY ? this.camY + U.rand(0, this.vh) : this.camY - 15;
        if (kind === 'snow') {
            this.fx.spawn({ x, y, vx: U.rand(-15, 15), vy, life, size: U.rand(1.8, 3.6), color: '#ffffff', type: 'circle', drag: 0, fade: true, shrink: false, sway: U.rand(0, 6) });
        } else if (kind === 'leaf') {
            this.fx.spawn({
                x, y, vx: U.rand(-30, 30), vy, life, size: U.rand(4, 6.5), color: U.pick(['#e0782a', '#f2aa3a', '#c9892f', '#b4541c']),
                type: 'leaf', drag: 0, fade: true, shrink: false, sway: U.rand(0, 6), vr: U.rand(-3, 3)
            });
        } else if (kind === 'petal') {
            this.fx.spawn({
                x, y, vx: U.rand(-25, 25), vy, life, size: U.rand(3, 4.5), color: U.pick(['#ffd0e2', '#ffffff', '#ff9ecd']),
                type: 'leaf', drag: 0, fade: true, shrink: false, sway: U.rand(0, 6), vr: U.rand(-4, 4)
            });
        }
    }

    prewarmWeather() {
        const kind = this.world.season.weather;
        if (!kind) return;
        this.computeCam();
        for (let i = 0; i < 70; i++) this.weatherParticle(kind, true);
    }

    updateWeather(dt) {
        const kind = this.world.season.weather;
        if (!kind || dt <= 0) return;
        const rate = kind === 'snow' ? 24 : (kind === 'leaf' ? 7 : 9);
        this.weatherAcc += dt * rate;
        while (this.weatherAcc >= 1) { this.weatherAcc -= 1; this.weatherParticle(kind, false); }
    }

    /* ================= Отрисовка ================= */
    render() {
        const ctx = this.ctx, dpr = this.dpr, zoom = this.zoom;
        const w = this.w, h = this.h, world = this.world, fx = this.fx, p = this.player, p2 = this.player2;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#1d3a22';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.computeCam();
        const shk = this.frozenNow ? 0 : fx.shake;
        const shx = (Math.random() * 2 - 1) * shk, shy = (Math.random() * 2 - 1) * shk;
        const camX = this.camX, camY = this.camY, vw = this.vw, vh = this.vh;
        ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, (-camX * zoom + shx) * dpr, (-camY * zoom + shy) * dpr);

        world.drawGround(ctx, camX, camY, vw, vh);

        // Общий список объектов по глубине Y
        const items = [];
        const x0 = camX - 140, x1 = camX + vw + 140, y0 = camY - 30, y1 = camY + vh + 190;
        for (const pr of world.props) {
            if (pr.x < x0 || pr.x > x1 || pr.y < y0 || pr.y > y1) continue;
            items.push({ y: pr.y, k: 0, o: pr });
        }
        for (const pig of this.pigs) {
            if (pig.caught || pig.gone || pig.inBarn) continue;
            if (pig.x < x0 || pig.x > x1 || pig.y < y0 - 60 || pig.y > y1) continue;
            items.push({ y: pig.y, k: 1, o: pig });
        }
        items.push({ y: p.y, k: 2, o: p });
        if (this.mode === 'coop' && p2) {
            items.push({ y: p2.y, k: 6, o: p2 });
        }
        for (const hp of this.helpers) items.push({ y: hp.y, k: 3, o: hp });
        for (const dg of this.dogs) items.push({ y: dg.y, k: 4, o: dg });
        for (const u of this.powerups) items.push({ y: u.y, k: 5, o: u });
        items.sort((a, b) => a.y - b.y);

        // Совместная связка в кооп-режиме (линия взаимодействия при сближении)
        if (this.mode === 'coop' && p2 && this.state !== 'title' && this.state !== 'result') {
            const distP = U.dist(p.x, p.y, p2.x, p2.y);
            if (distP < 140) {
                ctx.save();
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
                ctx.lineWidth = 3;
                ctx.setLineDash([7, 6]);
                ctx.lineDashOffset = -this.time * 20;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y + 4);
                ctx.lineTo(p2.x, p2.y + 4);
                ctx.stroke();
                ctx.restore();
            }
        }

        const showInfo = this.state !== 'title';
        const barnInfo = '🐷 ' + this.dayCaught + '/' + this.total;
        for (const it of items) {
            switch (it.k) {
                case 0: world.drawProp(ctx, it.o, p, (it.o === world.barn && showInfo) ? barnInfo : undefined); break;
                case 1: it.o.draw(ctx, this); break;
                case 2:
                    this.reach = this.reachFor(p);
                    this.pigInReach = this.pigInReach;
                    p.draw(ctx, this);
                    break;
                case 3: case 4: it.o.draw(ctx, this); break;
                case 5: this.drawPowerup(ctx, it.o); break;
                case 6:
                    this.reach = this.reachFor(it.o);
                    this.pigInReach = this.pigInReach2;
                    it.o.draw(ctx, this);
                    break;
                default: break;
            }
        }
        // Восстановление reach Игрока 1 по умолчанию
        this.reach = this.reachFor(p);

        // Летящие пойманные свиньи поверх
        for (const pig of this.pigs) if (pig.caught && !pig.inBarn) pig.draw(ctx, this);

        fx.drawWorld(ctx);
        fx.drawTexts(ctx, false);

        // --- Экранные слои ---
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const rainy = this.event === 'rain' && this.state !== 'title';
        if (rainy) this.drawRain(ctx, w, h);
        this.drawEvening(ctx, w, h);
        if (this.event === 'night' && this.state !== 'title' && this.state !== 'result') this.drawNight(ctx, w, h);
        if (fx.flash > 0) {
            ctx.globalAlpha = U.clamp(fx.flash, 0, 1);
            ctx.fillStyle = fx.flashColor;
            ctx.fillRect(0, 0, w, h);
            ctx.globalAlpha = 1;
        }
        if (this.state === 'play' || this.state === 'intro' || this.state === 'ending') this.drawHud(ctx, w, h);
        fx.drawCoins(ctx);
        fx.drawTexts(ctx, true);
    }

    label(ctx, str, x, y, size, fill, stroke = '#3b2212', align = 'center') {
        ctx.font = '900 ' + size + 'px ' + Game.FONT;
        ctx.textAlign = align; ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(3, size * 0.22);
        ctx.strokeStyle = stroke;
        ctx.strokeText(str, x, y);
        ctx.fillStyle = fill;
        ctx.fillText(str, x, y);
    }

    drawPowerup(ctx, u) {
        const def = POWERUPS[u.id];
        const bob = Math.sin(this.time * 3 + u.seed) * 4 - 18;
        const blink = u.life < 4 && Math.floor(u.life * 6) % 2 === 0;
        ctx.save();
        ctx.fillStyle = 'rgba(20,40,20,0.25)';
        ctx.beginPath(); ctx.ellipse(u.x, u.y + 4, 12, 4.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = blink ? 0.35 : 1;
        const cy = u.y + bob;
        ctx.fillStyle = def.color;
        ctx.globalAlpha = (blink ? 0.35 : 1) * 0.18; ctx.beginPath(); ctx.arc(u.x, cy, 36, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = (blink ? 0.35 : 1) * 0.28; ctx.beginPath(); ctx.arc(u.x, cy, 27, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = blink ? 0.35 : 1;
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = def.color; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(u.x, cy, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.font = '20px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(def.icon, u.x, cy + 1);
        const k = U.clamp(u.life / CONFIG.POWERUP_LIFETIME, 0, 1);
        ctx.strokeStyle = 'rgba(60,40,20,0.55)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(u.x, cy, 22.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
        ctx.restore();
    }

    drawRain(ctx, w, h) {
        ctx.fillStyle = 'rgba(40,60,90,0.14)';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(200,225,255,0.5)'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        const n = Math.min(160, Math.floor(w * h / 5500));
        const t = this.time;
        for (let i = 0; i < n; i++) {
            const sp = 900 * (0.8 + (i % 5) * 0.1);
            const xx = (((i * 137.5 - t * sp * 0.2) % (w + 60)) + (w + 60)) % (w + 60) - 30;
            const y = ((i * 71.7 + t * sp) % (h + 60)) - 30;
            ctx.moveTo(xx, y); ctx.lineTo(xx - 7, y + 22);
        }
        ctx.stroke();
    }

    drawEvening(ctx, w, h) {
        if (this.state === 'title' || this.onlineMode === 'battle' || this.timeTotal <= 0) return;
        const prog = 1 - U.clamp(this.timeLeft / this.timeTotal, 0, 1);
        const f = U.clamp((prog - 0.6) / 0.4, 0, 1);
        if (f <= 0) return;
        // Мягкий теплый золотистый закат без темной дымки — локация всегда яркая и видимая
        const r = 255, g = 180, b = 90;
        ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (0.02 + 0.06 * f).toFixed(3) + ')';
        ctx.fillRect(0, 0, w, h);
    }

    drawNight(ctx, w, h) {
        if (this.onlineMode === 'battle') return;
        const p = this.player, p2 = this.player2, z = this.zoom;
        const toScreen = (wx, wy) => ({ x: (wx - this.camX) * z, y: (wy - this.camY) * z });
        const pPos = toScreen(p.x, p.y - 10);

        ctx.save();
        // Приятная легкая лунная ночь — локация остается светлой и четко различимой
        ctx.fillStyle = 'rgba(10, 24, 52, 0.22)';
        ctx.fillRect(0, 0, w, h);

        // Мягкое золотое освещение фонарем вокруг фермера и напарников
        ctx.globalCompositeOperation = 'lighter';

        const drawLanternGlow = (sx, sy, radius, alpha = 0.35) => {
            const grad = ctx.createRadialGradient(sx, sy, 10, sx, sy, radius * z);
            grad.addColorStop(0, `rgba(255, 235, 140, ${alpha})`);
            grad.addColorStop(0.4, `rgba(255, 215, 100, ${alpha * 0.5})`);
            grad.addColorStop(1, 'rgba(255, 200, 80, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy, radius * z, 0, Math.PI * 2);
            ctx.fill();
        };

        // Фонарь игрока 1 (широкий круг света)
        drawLanternGlow(pPos.x, pPos.y, 450, 0.40);

        // Фонарь игрока 2 в коопе
        if (this.mode === 'coop' && p2) {
            const p2Pos = toScreen(p2.x, p2.y - 10);
            drawLanternGlow(p2Pos.x, p2Pos.y, 450, 0.40);
        }

        // Освещение фонарями у ворот всех амбаров
        if (this.world && this.world.doors) {
            for (const d of this.world.doors) {
                const dPos = toScreen(d.x, d.y);
                drawLanternGlow(dPos.x, dPos.y, 280, 0.32);
            }
        }

        ctx.restore();
    }

    drawHud(ctx, w, h) {
        const z = this.zoom, world = this.world, p = this.player, p2 = this.player2;
        const toS = (x, y) => ({ x: (x - this.camX) * z, y: (y - this.camY) * z });

        // --- Стрелки на свиней за экраном ---
        if (this.state === 'play') {
            const padX = 28, padT = 100, padB = 28;
            for (const pig of this.pigs) {
                if (!pig.active || pig.state === 'escape' || pig.state === 'burst') continue;
                const s = toS(pig.x, pig.y);
                if (s.x >= -4 && s.x <= w + 4 && s.y >= -4 && s.y <= h + 4) continue;
                const cx = w / 2, cy = (padT + h - padB) / 2;
                const dx = s.x - cx, dy = s.y - cy;
                const tx = Math.abs(dx) > 0.01 ? (w / 2 - padX) / Math.abs(dx) : Infinity;
                const ty = Math.abs(dy) > 0.01 ? ((h - padB - padT) / 2) / Math.abs(dy) : Infinity;
                const t = Math.min(tx, ty);
                if (!Number.isFinite(t)) continue;
                const ax = cx + dx * t, ay = cy + dy * t;
                const col = pig.def.gold ? '#ffd23f' : (pig.def.charger ? '#ff4d4d' : '#ff8fb8');
                ctx.save();
                ctx.translate(ax, ay);
                ctx.rotate(Math.atan2(dy, dx));
                ctx.globalAlpha = pig.def.gold ? 0.65 + 0.35 * Math.sin(this.time * 8) : 0.9;
                const sc = pig.def.boss ? 1.4 : 1;
                ctx.scale(sc, sc);
                ctx.fillStyle = col; ctx.strokeStyle = 'rgba(60,20,40,0.85)'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
                ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(-8, -10); ctx.lineTo(-3, 0); ctx.lineTo(-8, 10); ctx.closePath();
                ctx.fill(); ctx.stroke();
                ctx.restore();
            }
        }

        // --- Миникарта ---
        const narrow = w < 700;
        const mw = w < 600 ? 96 : 132, mh = mw * world.h / world.w, mx = 12, my = narrow ? 92 : 76, sc = mw / world.w;
        ctx.save();
        ctx.fillStyle = 'rgba(20,45,25,0.6)'; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(mx - 3, my - 3, mw + 6, mh + 6, 8); ctx.fill(); ctx.stroke();
        const b = world.barn;
        ctx.fillStyle = '#d23f36'; ctx.fillRect(mx + (b.x - b.w / 2) * sc, my + (b.y - b.h) * sc, b.w * sc, b.h * sc);
        if (world.pond) {
            ctx.fillStyle = '#2a8fd0'; ctx.beginPath(); ctx.ellipse(mx + world.pond.x * sc, my + world.pond.y * sc, world.pond.rx * sc, world.pond.ry * sc, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
        ctx.strokeRect(mx + this.camX * sc, my + this.camY * sc, this.vw * sc, this.vh * sc);
        for (const u of this.powerups) { ctx.fillStyle = POWERUPS[u.id].color; ctx.beginPath(); ctx.arc(mx + u.x * sc, my + u.y * sc, 3, 0, Math.PI * 2); ctx.fill(); }
        for (const pig of this.pigs) {
            if (!pig.active) continue;
            ctx.fillStyle = pig.def.gold ? '#ffd23f' : (pig.def.charger ? '#ff3b3b' : '#ff8fb8');
            ctx.beginPath(); ctx.arc(mx + pig.x * sc, my + pig.y * sc, pig.def.charger ? 3.8 : 2.6, 0, Math.PI * 2); ctx.fill();
        }
        for (const hp of this.helpers) { ctx.fillStyle = '#6ee787'; ctx.beginPath(); ctx.arc(mx + hp.x * sc, my + hp.y * sc, 2.8, 0, Math.PI * 2); ctx.fill(); }

        // Игрок 1 на миникарте (синий)
        ctx.fillStyle = '#3b82f6'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(mx + p.x * sc, my + p.y * sc, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        // Игрок 2 на миникарте (бирюзовый/розовый)
        if (this.mode === 'coop' && p2) {
            ctx.fillStyle = '#06b6d4'; ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(mx + p2.x * sc, my + p2.y * sc, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        ctx.restore();

        // --- Задание дня ---
        const q = this.quest;
        if (q) {
            const qy = my + mh + 22;
            const txt = '📜 ' + q.text + (q.done ? '  ✓' : '');
            ctx.font = '800 13px ' + Game.FONT;
            const tw = Math.min(Math.min(w - 24, 320), ctx.measureText(txt).width + 18);
            ctx.fillStyle = q.done ? 'rgba(40,120,60,0.8)' : 'rgba(40,25,10,0.62)';
            ctx.beginPath(); ctx.roundRect(mx - 3, qy - 12, tw, 24, 8); ctx.fill();
            ctx.fillStyle = '#fff7df'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(txt, mx + 6, qy + 1, tw - 14);
        }

        // --- Комбо ---
        if (this.combo >= 2) {
            const k = 1 + 0.35 * this.comboPulse;
            const mult = Math.min(CONFIG.COMBO_MAX_MULT, 1 + (this.combo - 1) * CONFIG.COMBO_STEP);
            ctx.save();
            ctx.translate(w / 2, narrow ? 116 : 96);
            ctx.scale(k, k);
            this.label(ctx, 'КОМБО x' + this.combo, 0, 0, 26, this.combo >= 10 ? '#ff9f43' : '#ffe066');
            this.label(ctx, 'монеты x' + mult.toFixed(1), 0, 24, 15, '#ffffff');
            const bw = 140, frac = U.clamp(this.comboT / (this.comboMax || 1), 0, 1);
            ctx.fillStyle = 'rgba(40,20,10,0.6)'; ctx.beginPath(); ctx.roundRect(-bw / 2 - 2, 38, bw + 4, 10, 5); ctx.fill();
            ctx.fillStyle = frac < 0.3 ? '#ff6b6b' : '#ffd23f'; ctx.beginPath(); ctx.roundRect(-bw / 2, 40, Math.max(0, bw * frac), 6, 3); ctx.fill();
            ctx.restore();
        }

        // --- Активные бонусы ---
        const act = [];
        for (const id of ['speed', 'net', 'x2']) if (this.buffs[id] > 0) act.push({ icon: POWERUPS[id].icon, t: this.buffs[id], max: POWERUPS[id].time, color: POWERUPS[id].color });
        if (this.lureT > 0) act.push({ icon: POWERUPS.carrot.icon, t: this.lureT, max: POWERUPS.carrot.time, color: POWERUPS.carrot.color });
        act.forEach((a, i) => {
            const bx = w - 34, by = (narrow ? 124 : 110) + i * 46;
            ctx.fillStyle = 'rgba(40,25,10,0.65)'; ctx.beginPath(); ctx.arc(bx, by, 19, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = a.color; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(bx, by, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * U.clamp(a.t / a.max, 0, 1)); ctx.stroke();
            ctx.font = '19px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff'; ctx.fillText(a.icon, bx, by + 1);
            this.label(ctx, String(Math.ceil(a.t)), bx - 27, by, 14, '#ffffff', '#3b2212', 'right');
        });

        // --- Полоса босса ---
        const boss = this.pigs.find((pg) => pg.def && pg.def.boss && pg.active);
        if (boss) {
            const bw = Math.min(420, w * 0.6), bx = w / 2 - bw / 2, by = h - 50;
            this.label(ctx, 'Хряк-Босс', w / 2, by - 14, 18, boss.enraged ? '#ff8a8a' : '#ffffff');
            ctx.fillStyle = 'rgba(40,20,10,0.75)'; ctx.beginPath(); ctx.roundRect(bx - 3, by - 3, bw + 6, 20, 9); ctx.fill();
            const frac = U.clamp(boss.hp / boss.maxHp, 0, 1);
            ctx.fillStyle = boss.enraged ? '#ff3b3b' : '#ff6b81';
            ctx.beginPath(); ctx.roundRect(bx, by, Math.max(0, bw * frac), 14, 7); ctx.fill();
            ctx.strokeStyle = 'rgba(40,20,10,0.6)'; ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 1; i < boss.maxHp; i++) { const sx = bx + bw * i / boss.maxHp; ctx.moveTo(sx, by); ctx.lineTo(sx, by + 14); }
            ctx.stroke();
        }

        // --- Обучение ---
        if (this.state === 'play' && this.day === 1 && !this.save.tutorial && this.tutStep < 3) {
            const txts = this.touch
                ? ['Джойстик слева — бежать', 'Кнопка 🕸️ — взмах сачком!', 'Кнопка 💨 — рывок!']
                : (this.mode === 'coop'
                    ? ['P1: WASD / P2: Стрелки — бежать', 'P1: ПРОБЕЛ / P2: ENTER — взмах сачком!', 'P1: LSHIFT / P2: RSHIFT — рывок!']
                    : ['WASD — бежать', 'ПРОБЕЛ / клик — взмах сачком!', 'SHIFT — рывок!']);
            const str = txts[this.tutStep];
            const s = toS(p.x, p.y);
            const by = s.y - 78 * z - 8 + Math.sin(this.time * 4) * 3;
            ctx.font = '900 17px ' + Game.FONT;
            const tw = ctx.measureText(str).width + 28;
            const bx = U.clamp(s.x, tw / 2 + 8, w - tw / 2 - 8);
            ctx.fillStyle = 'rgba(255,247,223,0.95)'; ctx.strokeStyle = '#3b2212'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.roundRect(bx - tw / 2, by - 17, tw, 34, 12); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#5b3a1e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(str, bx, by + 1);
        }
    }

    /* ================= Сетевой режим (WebRTC P2P на 2 устройства) ================= */
    hostOnlineGame(customCode, mode = 'coop') {
        if (!this.network) return false;
        this.onlineMode = (mode === 'battle' || mode === 'online_battle') ? 'battle' : 'coop';
        this.setMode('coop');
        return this.network.hostRoom(customCode, this.onlineMode);
    }

    joinOnlineGame(code) {
        if (!this.network) return false;
        this.setMode('coop');
        return this.network.joinRoom(code);
    }

    startOnlineGame(role, initPacket = null) {
        this.isOnline = true;
        this.netRole = role; // 'host' or 'guest'
        this.setMode('coop');

        const mode = (initPacket && (initPacket.onlineMode || initPacket.mode))
            || (this.network && this.network.onlineMode)
            || this.onlineMode
            || 'coop';
        this.onlineMode = (mode === 'battle' || mode === 'online_battle') ? 'battle' : 'coop';

        if (role === 'guest' && initPacket) {
            this.day = initPacket.day || this.day;
            const tier = initPacket.tier !== undefined ? initPacket.tier : tierForDay(this.day);
            const seasonIdx = initPacket.seasonIdx !== undefined ? initPacket.seasonIdx : seasonForDay(this.day);
            const coopMapIdx = initPacket.coopMapIdx || 0;
            this.world = new World(tier, seasonIdx, 'coop', coopMapIdx);
            this.world.mode = 'coop';
            this.initPlayers();
            this.resetPlayerAtGate();
            this.recalc();
        }

        if (this.ui) {
            this.ui.closeOnlineModal();
            this.ui.hideTitle();
            this.ui.setHud(true);
            const roleName = role === 'host' ? 'P1 Хост (Амбар 1)' : 'P2 Гость (Амбар 2)';
            const roomCode = (this.network && this.network.roomCode) || '';
            this.ui.setOnlineHudStatus(true, roleName, roomCode);
            if (this.onlineMode === 'battle') {
                this.ui.toast('⚔️', 'Битва началась!', '60 секунд — поймай больше свиней, чем соперник!');
            } else {
                this.ui.toast('🌐', 'Онлайн-игра началась!', role === 'host' ? 'Вы управляете Красным амбаром (P1)' : 'Вы управляете Бирюзовым амбаром (P2)');
            }
        }

        if (this.onlineMode === 'battle') {
            this.startBattle(initPacket);
        } else {
            if (role === 'host') {
                this.startDay(this.day);
            } else {
                this.state = 'play';
            }
        }
    }

    createNetworkSnapshot() {
        if (!this.world || !this.player) return null;
        const packedPigs = [];
        for (let i = 0; i < this.pigs.length; i++) {
            const pg = this.pigs[i];
            if (pg.inBarn || pg.gone) continue;
            packedPigs.push({
                i,
                t: pg.type,
                x: Math.round(pg.x * 10) / 10,
                y: Math.round(pg.y * 10) / 10,
                vx: Math.round(pg.vx),
                vy: Math.round(pg.vy),
                f: pg.facing,
                s: pg.state,
                c: pg.caught ? 1 : 0,
                hp: pg.hp,
                mhp: pg.maxHp,
                enr: pg.enraged ? 1 : 0,
                spr: pg.isSprinting ? 1 : 0,
                tx: pg.tx !== undefined ? Math.round(pg.tx) : undefined,
                ty: pg.ty !== undefined ? Math.round(pg.ty) : undefined,
                ft: pg.flyT !== undefined ? Math.round(pg.flyT * 100) / 100 : undefined
            });
        }

        const packedPowerups = [];
        for (let i = 0; i < this.powerups.length; i++) {
            const u = this.powerups[i];
            packedPowerups.push({
                id: u.id,
                x: Math.round(u.x),
                y: Math.round(u.y),
                l: Math.round(u.life)
            });
        }

        return {
            day: this.day,
            om: this.onlineMode || 'coop',
            mode: this.onlineMode || 'coop',
            bt: Math.round(this.battleTimer * 10) / 10,
            p1s: this.battleP1Score,
            p2s: this.battleP2Score,
            bw: this.battleWinner,
            st: this.state,
            tl: Math.round(this.timeLeft * 10) / 10,
            tt: Math.round(this.timeTotal),
            c: Math.round(this.shownCoins),
            cb: this.combo,
            cbt: Math.round(this.comboT * 10) / 10,
            cc: this.coopCatchCombo,
            dc: this.dayCaught,
            tot: this.total,
            p1c: this.dayCaughtP1,
            p2c: this.dayCaughtP2,
            p1m: this.dayCoinsP1,
            p2m: this.dayCoinsP2,
            b1o: Math.round((this.world.barnOpen || 0) * 100) / 100,
            b2o: Math.round((this.world.barn2Open || 0) * 100) / 100,
            p1: this.player ? this.player.getNetworkState() : null,
            pigs: packedPigs,
            pu: packedPowerups,
            bf: {
                spd: Math.round(this.buffs.speed),
                net: Math.round(this.buffs.net),
                x2: Math.round(this.buffs.x2)
            }
        };
    }

    receiveHostState(pkt) {
        if (!pkt) return;
        if (pkt.om) this.onlineMode = pkt.om;
        else if (pkt.mode) this.onlineMode = pkt.mode;

        if (pkt.bt !== undefined) this.battleTimer = pkt.bt;
        if (pkt.p1s !== undefined) this.battleP1Score = pkt.p1s;
        if (pkt.p2s !== undefined) this.battleP2Score = pkt.p2s;
        if (pkt.bw !== undefined) this.battleWinner = pkt.bw;

        if (this.onlineMode === 'battle') {
            this.updateBattleHud();
            if (pkt.st === 'battle_result' && this.state !== 'battle_result') {
                this.endBattle(pkt.bw);
            }
        }

        this.day = pkt.day ?? this.day;
        this.timeLeft = pkt.tl ?? this.timeLeft;
        this.timeTotal = pkt.tt ?? this.timeTotal;
        if (pkt.st && this.state !== pkt.st) {
            this.state = pkt.st;
            if (pkt.st === 'result' && this.ui) {
                this.endDay();
            }
        }
        this.shownCoins = pkt.c ?? this.shownCoins;
        this.combo = pkt.cb ?? this.combo;
        this.comboT = pkt.cbt ?? this.comboT;
        this.coopCatchCombo = pkt.cc ?? this.coopCatchCombo;
        this.dayCaught = pkt.dc ?? this.dayCaught;
        this.total = pkt.tot ?? this.total;
        this.dayCaughtP1 = pkt.p1c ?? this.dayCaughtP1;
        this.dayCaughtP2 = pkt.p2c ?? this.dayCaughtP2;
        this.dayCoinsP1 = pkt.p1m ?? this.dayCoinsP1;
        this.dayCoinsP2 = pkt.p2m ?? this.dayCoinsP2;

        if (this.world) {
            if (pkt.b1o !== undefined) this.world._barnOpen = pkt.b1o;
            if (pkt.b2o !== undefined) this.world._barn2Open = pkt.b2o;
        }

        if (pkt.p1 && this.player) {
            this.player.applyNetworkState(pkt.p1);
        }

        if (pkt.pigs && Array.isArray(pkt.pigs)) {
            for (const sp of pkt.pigs) {
                let pig = this.pigs.find(p => p._netIdx === sp.i || (p.type === sp.t && Math.hypot(p.x - sp.x, p.y - sp.y) < 120));
                if (!pig) {
                    pig = new Pig(sp.t, sp.x, sp.y, this.day);
                    pig._netIdx = sp.i;
                    this.pigs.push(pig);
                }
                pig._netIdx = sp.i;
                pig.x = sp.x;
                pig.y = sp.y;
                pig.vx = sp.vx;
                pig.vy = sp.vy;
                pig.facing = sp.f;
                pig.state = sp.s;
                pig.hp = sp.hp;
                pig.maxHp = sp.mhp;
                pig.enraged = !!sp.enr;
                pig.isSprinting = !!sp.spr;

                if (sp.c && !pig.caught) {
                    const door = (this.world && this.world.door2) ? this.world.door2 : (this.world ? this.world.door : { x: 400, y: 300 });
                    pig.catchTo(sp.tx || door.x, sp.ty || door.y);
                }
                if (sp.ft !== undefined) pig.flyT = sp.ft;
            }
        }

        if (pkt.pu && Array.isArray(pkt.pu)) {
            this.powerups = pkt.pu.map(u => ({ id: u.id, x: u.x, y: u.y, life: u.l, seed: 1 }));
        }

        if (pkt.bf) {
            this.buffs.speed = pkt.bf.spd || 0;
            this.buffs.net = pkt.bf.net || 0;
            this.buffs.x2 = pkt.bf.x2 || 0;
        }
    }

    receiveGuestInput(pkt) {
        if (!this.player2 || !pkt) return;
        this.player2.applyNetworkState(pkt);
        if (pkt.swingBuf && this.player2.canSwing()) {
            this.doSwing(2);
        }
    }

    receiveNetEvent(event, payload) {
        if (!event) return;
        switch (event) {
            case 'PLAYER_SWING': {
                const target = payload.p === 2 ? this.player2 : this.player;
                if (target) {
                    target.swing(payload.miss);
                    this.sfx.swing();
                }
                break;
            }
            case 'PLAYER_DASH': {
                const target = payload.p === 2 ? this.player2 : this.player;
                if (target) {
                    target.startDash(payload.vx, payload.vy);
                    this.sfx.dash();
                    this.fx.dust(target.x, target.y + 14, 5, this.dustColor);
                }
                break;
            }
            case 'PIG_CAUGHT': {
                this.sfx.catch(payload.combo || 1);
                if (this.onlineMode === 'battle') {
                    if (payload.p1Score !== undefined) this.battleP1Score = payload.p1Score;
                    if (payload.p2Score !== undefined) this.battleP2Score = payload.p2Score;
                    this.updateBattleHud();
                    if (this.netRole === 'host') this.spawnBattlePig();
                } else if (payload.coopCombo > 1) {
                    this.sfx.multi(Math.min(5, payload.coopCombo));
                }
                break;
            }
            case 'COOP_PIN': {
                this.sfx.hit();
                this.fx.addShake(12);
                this.fx.addFlash('#fef08a', 0.2);
                this.fx.text(payload.x, payload.y - 28, '🤝 ЗАЖАТ В КЛЕЩИ! ОГЛУШЁН!', { color: '#facc15', size: 24, life: 1.8 });
                break;
            }
            case 'ASSIST': {
                this.sfx.powerup();
                this.fx.text(payload.x, payload.y - 32, 'НАПАРНИК ВЫРУЧИЛ! 🤝', { color: '#4ade80', size: 22, life: 1.2 });
                break;
            }
            case 'NEXT_DAY': {
                if (this.ui) this.ui.hideResult();
                this.startDay(payload.day || (this.day + 1));
                break;
            }
            case 'RETRY_DAY': {
                if (this.ui) this.ui.hideResult();
                this.startDay(payload.day || this.day);
                break;
            }
            case 'BATTLE_START': {
                this.startBattle(payload);
                break;
            }
            case 'BATTLE_SCORE': {
                if (payload) {
                    if (payload.p1Score !== undefined) this.battleP1Score = payload.p1Score;
                    if (payload.p2Score !== undefined) this.battleP2Score = payload.p2Score;
                    this.updateBattleHud();
                }
                break;
            }
            case 'BATTLE_END': {
                this.endBattle(payload ? payload.winner : null);
                break;
            }
            case 'BATTLE_REMATCH': {
                this.startBattle();
                break;
            }
            case 'PLAYER_PROFILE': {
                if (payload && payload.nickname) {
                    this.opponentNickname = payload.nickname;
                    this.updateBattleHud();
                }
                break;
            }
        }
    }

    onOnlinePartnerDisconnected(reason) {
        this.isOnline = false;
        this.netRole = null;
        if (this.ui) {
            this.ui.setOnlineHudStatus(false);
            this.ui.toast('⚠️', 'Связь потеряна', reason || 'Напарник покинул игру');
        }
    }
}

Game.FONT = '"Nunito", "Segoe UI", system-ui, sans-serif';

window.addEventListener('DOMContentLoaded', () => { window.game = new Game(); });
