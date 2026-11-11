'use strict';

/**
 * «Свинолов» — главный игровой цикл: состояния, механика дня, камера, отрисовка, ввод
 */
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.storage = new StorageManager();
        this.save = this.storage.load();
        this.sfx = new Sfx(this.save.settings);
        this.fx = new Fx();
        this.input = { joyX: 0, joyY: 0, swingHeld: false };

        // --- Состояние ---
        this.state = 'title';          // title | intro | play | ending | result
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

        this.keys = { up: false, down: false, left: false, right: false, space: false };
        this.mouseDown = false;
        this.swingBuf = 0;
        this.touch = 'ontouchstart' in window;

        this.w = 800; this.h = 600; this.dpr = 1; this.zoom = 1; this.vw = 800; this.vh = 600;
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
        this.pigInReach = false;

        // День
        this.day = this.save.day;
        this.event = null;
        this.eventMul = 1;
        this.roster = [];
        this.total = 0;
        this.dayCaught = 0;
        this.dayCoins = 0;
        this.dayBestCombo = 0;
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

        this.world = null;
        this.player = null;
        this.setupWorld(this.save.day, true);
        const d = this.world.door;
        this.player = new Player(d.x, d.y + 84);
        this.recalc();

        this.resize();
        this.ui = new UI(this);

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

    /* ================= Производные характеристики ================= */
    recalc() {
        const u = this.save.upgrades, p = this.player;
        const lv = (id) => Math.max(0, Number(u[id]) || 0);
        p.speed = CONFIG.PLAYER_SPEED * (1 + 0.06 * lv('boots'));
        p.catchRadius = CONFIG.CATCH_RADIUS * (1 + 0.08 * lv('net'));
        p.swingCd = CONFIG.SWING_COOLDOWN * Math.pow(0.9, lv('hands'));
        p.dashCd = CONFIG.DASH_COOLDOWN * Math.pow(0.87, lv('dash'));
        p.hat = this.save.hat;
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

    /* ================= Мир ================= */
    setupWorld(day, silent) {
        const tier = tierForDay(day), si = seasonForDay(day);
        const prev = this.world;
        if (prev && prev.tier === tier && prev.seasonIdx === si) return false;
        this.world = new World(tier, si);
        const sid = this.world.season.id;
        this.dustColor = (sid === 'summer' || sid === 'winter') ? 'rgba(255,255,255,0.55)' : 'rgba(196,160,110,0.55)';
        this.weatherAcc = 0;
        if (!silent && prev) {
            this.zoneChanged = prev.tier !== tier;
            this.seasonChanged = prev.seasonIdx !== si;
        }
        return true;
    }

    /* ================= Размеры ================= */
    resize() {
        const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
        this.w = w; this.h = h;
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.zoom = U.clamp(Math.min(w / 1150, h / 700), 0.55, 1.4);
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
            this.keys.up = this.keys.down = this.keys.left = this.keys.right = this.keys.space = false;
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
                case 'KeyW': case 'ArrowUp': this.keys.up = true; e.preventDefault(); break;
                case 'KeyS': case 'ArrowDown': this.keys.down = true; e.preventDefault(); break;
                case 'KeyA': case 'ArrowLeft': this.keys.left = true; e.preventDefault(); break;
                case 'KeyD': case 'ArrowRight': this.keys.right = true; e.preventDefault(); break;
                case 'Space':
                    this.keys.space = true;
                    if (!e.repeat) this.swingBuf = 0.15;
                    e.preventDefault();
                    break;
                case 'ShiftLeft': case 'ShiftRight':
                    if (!e.repeat) this.requestDash();
                    break;
                default: break;
            }
        });
        window.addEventListener('keyup', (e) => {
            switch (e.code) {
                case 'KeyW': case 'ArrowUp': this.keys.up = false; break;
                case 'KeyS': case 'ArrowDown': this.keys.down = false; break;
                case 'KeyA': case 'ArrowLeft': this.keys.left = false; break;
                case 'KeyD': case 'ArrowRight': this.keys.right = false; break;
                case 'Space': this.keys.space = false; break;
                default: break;
            }
        });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        this.canvas.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'touch') return;
            this.sfx.init();
            if (this.ui.modalOpen) return;
            if (e.button === 0) { this.mouseDown = true; this.swingBuf = 0.15; }
            else if (e.button === 2) { this.requestDash(); e.preventDefault(); }
        });
        const up = (e) => { if (e.pointerType !== 'touch' && e.button === 0) this.mouseDown = false; };
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', () => { this.mouseDown = false; });
    }

    inputAllowed() {
        return !this.ui.modalOpen && !this.paused && (this.state === 'play' || this.state === 'intro' || this.state === 'ending');
    }

    moveVector() {
        if (!this.inputAllowed()) return { x: 0, y: 0 };
        const k = this.keys;
        let x = (k.right ? 1 : 0) - (k.left ? 1 : 0) + (Number(this.input.joyX) || 0);
        let y = (k.down ? 1 : 0) - (k.up ? 1 : 0) + (Number(this.input.joyY) || 0);
        const l = Math.hypot(x, y);
        if (l > 1) { x /= l; y /= l; }
        return { x, y };
    }

    requestDash() {
        if (this.state !== 'play' || this.paused || this.ui.modalOpen) return false;
        const m = this.moveVector();
        if (!this.player.startDash(m.x, m.y)) return false;
        this.sfx.init();
        this.sfx.dash();
        this.dashUsed = true;
        this.fx.dust(this.player.x, this.player.y + 14, 5, this.dustColor);
        if (this.tutStep === 2) this.finishTutorial(); else this.tutDashed = true;
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

    nextDay() { this.sfx.init(); this.ui.hideResult(); this.startDay(this.save.day); }
    retryDay() { this.sfx.init(); this.ui.hideResult(); this.startDay(this.save.day); }
    setPaused(p) { this.paused = !!p; }

    buyUpgrade(id) {
        const up = UPGRADES.find((u) => u.id === id);
        if (!up) return false;
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
        const s = this.save;
        s.prestige = (s.prestige || 0) + 1;
        s.stats.prestige = s.prestige;
        s.coins = 0;
        s.day = 1;
        for (const u of UPGRADES) s.upgrades[u.id] = 0;
        s.helpers = 0;
        s.dogs = 0;
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

    /* ================= Титул ================= */
    enterTitle() {
        this.state = 'title';
        this.pigs = [];
        this.fx.clear();
        const w = this.world, d = w.door;
        const types = ['pink', 'pink', 'pink', 'piglet', 'piglet', 'runner', 'pink', 'pink'];
        for (const t of types) {
            const s = w.freeSpot(30, d, 120, 650);
            this.pigs.push(new Pig(t, s.x, s.y, 1));
        }
        this.resetPlayerAtGate();
        this.camCX = w.barn.x; this.camCY = w.barn.y;
        this.ui.setHud(false);
        this.ui.showTitle();
    }

    resetPlayerAtGate() {
        const p = this.player, d = this.world.door;
        p.x = d.x; p.y = d.y + 84;
        p.vx = p.vy = 0; p.stun = 0; p.invuln = 0; p.cd = 0; p.dashT = 0; p.dashCdT = 0; p.swingT = 0;
        p.trail.length = 0; p.facing = 1; p.aimX = 1; p.aimY = 0;
        this.world.resolve(p, p.r);
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

        // Сброс состояния
        this.pigs = [];
        this.spawnQueue = [];
        this.powerups = [];
        this.fx.clear();
        this.buffs.speed = this.buffs.net = this.buffs.x2 = 0;
        this.lureT = 0;
        this.combo = 0; this.comboT = 0; this.comboPulse = 0;
        this.dayCaught = 0; this.dayCoins = 0; this.dayBestCombo = 0;
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

        // Игрок и команда
        this.resetPlayerAtGate();
        this.camCX = this.player.x; this.camCY = this.player.y - 30;
        this.prewarmWeather();

        // Баннер
        let sub = '';
        let tipShown = false;
        if (this.roster.includes('boss')) sub = '⚠ ХРЯК-БОСС';
        else {
            const nt = this.roster.find((t) => PIG_TYPES[t].tip && !s.seen[t]);
            if (nt) { sub = PIG_TYPES[nt].tip; s.seen[nt] = true; tipShown = true; this.saveDirty = true; }
            else if (this.event) sub = EVENTS[this.event].icon + ' ' + EVENTS[this.event].title;
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

    spawnPig(type) {
        const d = this.world.door;
        const p = new Pig(type, d.x + U.rand(-24, 24), d.y + 6, this.day);
        p.startBurst(Math.PI / 2 + U.rand(-1.3, 1.3), U.rand(0.7, 1.1));
        this.pigs.push(p);
        this.world.barnOpen = Math.max(this.world.barnOpen, 0.6);
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
        const sp = this.world.freeSpot(30, this.player, 350, 700);
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
        const sp = this.world.freeSpot(24, this.player, 200, 600);
        this.powerups.push({ id, x: sp.x, y: sp.y, life: CONFIG.POWERUP_LIFETIME, seed: Math.random() * 10 });
        this.fx.ring(sp.x, sp.y - 10, 24, POWERUPS[id].color, 0.4, 3);
    }

    /* ================= Колбэки для Pig / Player ================= */
    hitPlayer(pig) {
        const p = this.player;
        if (p.invuln > 0) return false;
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
        const w = this.world, d = w.door;
        w.barnBounce = 1;
        w.barnOpen = Math.max(w.barnOpen, 0.4);
        this.fx.dust(d.x + U.rand(-16, 16), d.y - 14, 4, this.dustColor);
        this.fx.ring(d.x, d.y - 24, 26, 'rgba(255,255,255,0.7)', 0.3, 3);
    }

    onGoldFled(pig) {
        this.fx.text(pig.x, pig.y - 30, 'Сбежала…', { color: '#ffe9a0', size: 20 });
    }

    onPigGone(pig) { /* сбежавшие свиньи просто пропадают; счёт считается по итогам дня */ }

    /* ================= Взмах и поимка ================= */
    doSwing() {
        const p = this.player;
        if (!p.canSwing()) return false;
        const res = this.sweep(p, this.reach);
        p.swing(res.hits === 0);
        this.sfx.swing();
        return true;
    }

    sweep(catcher, radius) {
        const isPlayer = catcher === this.player;
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
        const isP = catcher === this.player;
        const w = this.world, s = this.save, st = s.stats;
        pig.catchTo(w.door.x, w.door.y - 20);
        pig.frozen = 0;
        if (pig.counts) this.dayCaught++;

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
    }

    /* ================= Бонусы ================= */
    pickPowerup(u) {
        const def = POWERUPS[u.id], p = this.player;
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

    /* ================= Конец дня ================= */
    victory() {
        this.state = 'ending';
        this.endT = 1.3;
        this.slowT = 0.5;
        this.winPlayed = true;
        this.checkQuestAtWin();
        this.sfx.win();
        this.fx.confetti(this.player.x, this.player.y - 30, 60);
        this.fx.addFlash('#fff6c0', 0.3);
        this.ui.banner('Все свиньи пойманы!', '', 1500);
        for (const p of this.pigs) if (p.active && p.state !== 'escape') p.beginEscape(this.world);
    }

    timeUp() {
        this.state = 'ending';
        this.endT = 1.3;
        this.timeLeft = 0;
        this.spawnQueue = [];
        this.waves = [];
        this.goldTimes = [];
        this.sfx.tempoMul = 1;
        this.ui.banner('Солнце село!', '', 1500);
        for (const p of this.pigs) if (p.active && p.state !== 'escape') p.beginEscape(this.world);
    }

    finishDay() {
        const s = this.save, st = s.stats, q = this.quest;
        const day = this.day, total = this.total, caught = this.dayCaught;
        const all = caught >= total;
        const frac = this.timeTotal > 0 ? U.clamp(this.timeLeft / this.timeTotal, 0, 1) : 0;
        let stars = 0;
        if (all && frac >= 0.3) stars = 3;
        else if (all) stars = 2;
        else if (total > 0 && caught / total >= 0.6) stars = 1;
        const failed = stars === 0;

        const lines = [];
        lines.push({ label: 'Свиней поймано', value: caught + ' из ' + total });
        lines.push({ label: 'Монеты за свиней', value: '+' + this.dayCoins + ' 🪙' });
        let earned = this.dayCoins;
        if (!failed) {
            const starB = stars * (2 + Math.floor(day / 2));
            const timeB = all ? Math.floor(this.timeLeft / 3) : 0;
            const questB = q && q.done ? q.reward : 0;
            lines.push({ label: 'Бонус за звёзды', value: '+' + starB + ' 🪙' });
            if (timeB > 0) lines.push({ label: 'Бонус за время', value: '+' + timeB + ' 🪙' });
            const bonus = starB + timeB + questB;
            s.coins += bonus; st.totalCoins += bonus; earned += bonus;
        }

        if (!failed) {
            s.day = day + 1;
            st.bestDay = Math.max(st.bestDay, s.day);
            st.daysPlayed++;
            if (stars === 3) st.perfectDays++;
        }
        if (day === 1) this.finishTutorial();
        this.checkAch();
        this.persist();

        this.state = 'result';
        this.sfx.tempoMul = 1;
        if (failed) this.sfx.fail(); else if (!this.winPlayed) this.sfx.win();

        this.ui.showResult({
            day, stars, failed, caught, total, escaped: Math.max(0, total - caught), lines, earned,
            quest: q ? { text: q.text, done: !!q.done, reward: q.reward } : null,
            bestCombo: this.dayBestCombo, canPrestige: this.canPrestige()
        });
    }

    /* ================= Обновление ================= */
    isActiveState() { return this.state === 'play' || this.state === 'intro' || this.state === 'ending'; }

    update(rdt) {
        this.time += rdt;
        this.swingBuf = Math.max(0, this.swingBuf - rdt);
        this.frozenNow = this.paused || (this.ui.modalOpen && this.isActiveState());
        if (this.frozenNow) return;

        let dt = rdt;
        if (this.hitStop > 0) { this.hitStop -= rdt; dt = 0; }
        else {
            if (this.state === 'ending' && this.slowT > 0) { this.slowT -= rdt; this.timeScale = 0.25; } else this.timeScale = 1;
            dt = rdt * this.timeScale;
        }

        const w = this.world, p = this.player, st = this.state;
        if (st === 'title') this.titleT += rdt;

        // Состояния
        if (st === 'intro') {
            this.introT -= rdt;
            if (this.introT <= 0) this.beginPlay();
        } else if (st === 'ending') {
            this.endT -= rdt;
            if (this.endT <= 0) this.finishDay();
        }
        const playing = this.state === 'play';

        w.update(dt);

        // Игрок
        const mv = this.moveVector();
        const px0 = p.x, py0 = p.y;
        p.update(dt, this, mv.x, mv.y);
        if (this.tutStep === 0 && playing) {
            this.tutMove += Math.hypot(p.x - px0, p.y - py0);
            if (this.tutMove > 140) this.tutStep = 1;
        }

        // Взмах (удержание = автоповтор)
        if (playing && this.inputAllowed()) {
            const want = this.swingBuf > 0 || this.keys.space || this.mouseDown || this.input.swingHeld;
            if (want && p.canSwing()) { this.doSwing(); this.swingBuf = 0; }
        }

        for (const h of this.helpers) h.update(dt, this);
        for (const o of this.dogs) o.update(dt, this);

        // Расписание дня
        if (playing) this.updateDay(dt);

        // Свиньи
        for (const pig of this.pigs) pig.update(dt, this);
        this.separatePigs(dt);
        this.pigs = this.pigs.filter((pig) => !pig.inBarn && !pig.gone);

        // Угрозы, радиус, подсветка
        this.threats.length = 0;
        if (this.state !== 'title' && this.state !== 'result') {
            this.threats.push({ x: p.x, y: p.y, k: 1 });
            for (const h of this.helpers) this.threats.push({ x: h.x, y: h.y, k: 0.7 });
        }
        this.reach = p.catchRadius * (this.buffs.net > 0 ? 1.8 : 1);
        let inReach = false;
        for (const pig of this.pigs) {
            if (!pig.active || pig.state === 'burst' || pig.state === 'escape') continue;
            if (U.dist(p.x, p.y, pig.x, pig.y) <= this.reach + pig.r * 0.6) { inReach = true; break; }
        }
        this.pigInReach = inReach;

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
                seasonIcon: w.season.icon, eventIcon: this.event ? EVENTS[this.event].icon : ''
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
        const p = this.player;
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const u = this.powerups[i];
            u.life -= dt;
            if (u.life <= 0) { this.powerups.splice(i, 1); continue; }
            if (U.dist(p.x, p.y, u.x, u.y) < 36) { this.powerups.splice(i, 1); this.pickPowerup(u); }
        }

        // Тик и темп музыки
        const left = this.timeLeft;
        this.sfx.tempoMul = left <= 10 ? 1.25 : 1;
        if (left <= 5 && left > 0) {
            const sec = Math.ceil(left);
            if (sec !== this.lastTickSec) { this.lastTickSec = sec; this.sfx.tick(); }
        }

        // Победа / поражение по времени
        const mine = this.spawnQueue.length === 0 && this.waves.length === 0;
        if (this.dayCaught >= this.total && mine) { this.victory(); return; }
        if (this.timeLeft <= 0) this.timeUp();
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

    updateCamera(rdt) {
        const p = this.player, w = this.world;
        let tx, ty;
        if (this.state === 'title') {
            const b = w.barn, t = this.titleT;
            tx = b.x + Math.cos(t * 0.12) * 260; ty = b.y - 20 + Math.sin(t * 0.17) * 120;
        } else {
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
        const w = this.w, h = this.h, world = this.world, fx = this.fx, p = this.player;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#1d3a22';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.computeCam();
        const shk = this.frozenNow ? 0 : fx.shake;
        const shx = (Math.random() * 2 - 1) * shk, shy = (Math.random() * 2 - 1) * shk;
        const camX = this.camX, camY = this.camY, vw = this.vw, vh = this.vh;
        ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, (-camX * zoom + shx) * dpr, (-camY * zoom + shy) * dpr);

        world.drawGround(ctx, camX, camY, vw, vh);

        // Общий список по глубине
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
        for (const hp of this.helpers) items.push({ y: hp.y, k: 3, o: hp });
        for (const dg of this.dogs) items.push({ y: dg.y, k: 4, o: dg });
        for (const u of this.powerups) items.push({ y: u.y, k: 5, o: u });
        items.sort((a, b) => a.y - b.y);

        const showInfo = this.state !== 'title';
        const barnInfo = '🐷 ' + this.dayCaught + '/' + this.total;
        for (const it of items) {
            switch (it.k) {
                case 0: world.drawProp(ctx, it.o, p, (it.o === world.barn && showInfo) ? barnInfo : undefined); break;
                case 1: it.o.draw(ctx, this); break;
                case 2: p.draw(ctx, this); break;
                case 3: case 4: it.o.draw(ctx, this); break;
                case 5: this.drawPowerup(ctx, it.o); break;
                default: break;
            }
        }
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
        if (this.state === 'title' || this.timeTotal <= 0) return;
        const prog = 1 - U.clamp(this.timeLeft / this.timeTotal, 0, 1);
        const f = U.clamp((prog - 0.6) / 0.4, 0, 1);
        if (f <= 0) return;
        const t2 = U.clamp((f - 0.4) / 0.6, 0, 1);
        const r = Math.round(U.lerp(255, 70, t2)), g = Math.round(U.lerp(150, 50, t2)), b = Math.round(U.lerp(60, 130, t2));
        ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (0.05 + 0.25 * f).toFixed(3) + ')';
        ctx.fillRect(0, 0, w, h);
    }

    drawNight(ctx, w, h) {
        const p = this.player, z = this.zoom;
        const px = (p.x - this.camX) * z, py = (p.y - 10 - this.camY) * z;
        const g = ctx.createRadialGradient(px, py, 70 * z, px, py, 310 * z);
        g.addColorStop(0, 'rgba(6,10,34,0)');
        g.addColorStop(1, 'rgba(6,10,34,0.8)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
    }

    drawHud(ctx, w, h) {
        const z = this.zoom, world = this.world, p = this.player;
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
        ctx.fillStyle = '#2a8fd0'; ctx.beginPath(); ctx.ellipse(mx + world.pond.x * sc, my + world.pond.y * sc, world.pond.rx * sc, world.pond.ry * sc, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
        ctx.strokeRect(mx + this.camX * sc, my + this.camY * sc, this.vw * sc, this.vh * sc);
        for (const u of this.powerups) { ctx.fillStyle = POWERUPS[u.id].color; ctx.beginPath(); ctx.arc(mx + u.x * sc, my + u.y * sc, 3, 0, Math.PI * 2); ctx.fill(); }
        for (const pig of this.pigs) {
            if (!pig.active) continue;
            ctx.fillStyle = pig.def.gold ? '#ffd23f' : (pig.def.charger ? '#ff3b3b' : '#ff8fb8');
            ctx.beginPath(); ctx.arc(mx + pig.x * sc, my + pig.y * sc, pig.def.charger ? 3.8 : 2.6, 0, Math.PI * 2); ctx.fill();
        }
        for (const hp of this.helpers) { ctx.fillStyle = '#6ee787'; ctx.beginPath(); ctx.arc(mx + hp.x * sc, my + hp.y * sc, 2.8, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1d4ed8'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(mx + p.x * sc, my + p.y * sc, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
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
        const boss = this.pigs.find((pg) => pg.def.boss && pg.active);
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
                : ['WASD — бежать', 'ПРОБЕЛ / клик — взмах сачком!', 'SHIFT — рывок!'];
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
}

Game.FONT = '"Nunito", "Segoe UI", system-ui, sans-serif';

window.addEventListener('DOMContentLoaded', () => { window.game = new Game(); });
