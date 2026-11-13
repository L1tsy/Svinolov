'use strict';

/**
 * Мир фермы: генерация, препятствия, отрисовка земли, реки, мостов и построек
 * Поддерживает одиночный режим (solo) и кооперативные карты (coop)
 */
class World {
    constructor(tier, seasonIdx, modeOrOpts = 'solo', coopMapIdx = 0) {
        let mode = 'solo';
        let mapIdx = 0;
        if (typeof modeOrOpts === 'string') {
            mode = modeOrOpts;
            mapIdx = coopMapIdx || 0;
        } else if (typeof modeOrOpts === 'object' && modeOrOpts !== null) {
            mode = modeOrOpts.mode || 'solo';
            mapIdx = modeOrOpts.coopMapIdx || coopMapIdx || 0;
        }

        this.tier = tier;
        this.seasonIdx = seasonIdx;
        this.season = SEASONS[seasonIdx];
        this.mode = mode;
        this.coopMapIdx = mapIdx;

        // Размеры карты: для коопа даем больше простора двум игрокам
        if (this.mode === 'coop') {
            const base = CONFIG.WORLD_SIZES[tier] || [1500, 1000];
            this.w = Math.round(base[0] * 1.2);
            this.h = Math.round(base[1] * 1.15);
        } else {
            [this.w, this.h] = CONFIG.WORLD_SIZES[tier];
        }

        this.margin = 36;
        this.rects = [];
        this.circles = [];
        this.props = [];
        this.paths = [];
        this.puddles = [];
        this.bridges = [];
        this.interactives = [];
        this.river = null;
        this.time = 0;

        this._barnOpen = 0;
        this._barnBounce = 0;
        this._barn2Open = 0;
        this._barn2Bounce = 0;

        if (this.mode === 'coop') {
            this.buildCoop(tier, seasonIdx, this.coopMapIdx);
        } else {
            this.build();
        }
        this.renderGround();
    }

    /** Геттеры/сеттеры для анимации ворот амбаров с поддержкой обоих амбаров */
    get barnOpen() { return this._barnOpen; }
    set barnOpen(v) { this._barnOpen = v; this._barn2Open = v; }
    get barnBounce() { return this._barnBounce; }
    set barnBounce(v) { this._barnBounce = v; this._barn2Bounce = v; }
    get barn2Open() { return this._barn2Open; }
    set barn2Open(v) { this._barn2Open = v; }
    get barn2Bounce() { return this._barn2Bounce; }
    set barn2Bounce(v) { this._barn2Bounce = v; }

    /** Статический фабричный метод для создания кооп-карты */
    static buildCoop(tier, seasonIdx, coopMapIdx = 0) {
        return new World(tier, seasonIdx, 'coop', coopMapIdx);
    }

    /* ================= Одиночная генерация (Solo) ================= */
    build() {
        const W = this.w, H = this.h, rnd = U.seeded(4242 + this.tier * 97);
        const addBuilding = (type, bx, by, w, h) => {
            const b = { type, x: bx, y: by, w, h, solid: true };
            this.props.push(b);
            this.rects.push({ x: bx - w / 2 + 5, y: by - h * 0.68, w: w - 10, h: h * 0.68 - 2 });
            return b;
        };

        this.barn = addBuilding('barn', W / 2, H / 2 + 50, 210, 162);
        this.barn1 = this.barn;
        this.barn2 = null;
        this.door = { x: W / 2, y: this.barn.y + 10 };
        this.door1 = this.door;
        this.door2 = null;
        this.barns = [this.barn];
        this.doors = [this.door];

        const house = addBuilding('house', W * 0.16, H * 0.25, 150, 124);
        const mill = addBuilding('mill', W * 0.85, H * 0.26, 92, 132);
        const shed = addBuilding('shed', W * 0.15, H * 0.87, 128, 96);
        const coop = addBuilding('coop', W * 0.86, H * 0.87, 118, 88);

        // Колодец
        const well = { type: 'well', x: W * 0.37, y: H * 0.22, r: 20 };
        this.props.push(well);
        this.circles.push({ x: well.x, y: well.y - 8, r: 20 });

        // Пруд
        const prx = 92 + this.tier * 22;
        this.pond = { x: W * 0.79, y: H * 0.57, rx: prx, ry: prx * 0.64 };
        this.circles.push({ x: this.pond.x, y: this.pond.y, r: prx - 8, sy: 0.64, water: true });

        // Тропинки
        const d = this.door;
        const mk = (tx, ty, bend) => {
            const mx = (d.x + tx) / 2 + bend, my = (d.y + 40 + ty) / 2 + Math.abs(bend) * 0.4;
            return { x0: d.x, y0: d.y + 6, cx: mx, cy: my, x1: tx, y1: ty, w: 26 };
        };
        this.paths = [
            { x0: d.x, y0: d.y - 4, cx: d.x + 22, cy: (d.y + H) / 2, x1: d.x, y1: H - 10, w: 40 },
            mk(house.x, house.y + 12, -70), mk(mill.x, mill.y + 12, 70),
            mk(shed.x + 30, shed.y + 6, -40), mk(coop.x - 30, coop.y + 6, 40)
        ];
        const pathPts = [];
        for (const p of this.paths) {
            for (let i = 0; i <= 14; i++) {
                const t = i / 14, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
                pathPts.push({ x: a * p.x0 + b * p.cx + c * p.x1, y: a * p.y0 + b * p.cy + c * p.y1 });
            }
        }

        const placed = [];
        const okSpot = (x, y, r, pathGap = 46) => {
            if (x < this.margin + 30 || x > W - this.margin - 30 || y < this.margin + 50 || y > H - this.margin - 20) return false;
            if (Math.hypot(x - d.x, y - d.y) < 190) return false;
            for (const rc of this.rects) {
                if (x > rc.x - r - 46 && x < rc.x + rc.w + r + 46 && y > rc.y - r - 70 && y < rc.y + rc.h + r + 60) return false;
            }
            for (const c of this.circles) {
                if (Math.hypot(x - c.x, (y - c.y) / (c.sy || 1)) < c.r + r + 40) return false;
            }
            for (const p of pathPts) if (Math.hypot(x - p.x, y - p.y) < pathGap) return false;
            for (const p of placed) if (Math.hypot(x - p.x, y - p.y) < p.r + r + 44) return false;
            return true;
        };
        const scatter = (type, count, r, colR, edgeBias, extra = {}) => {
            let made = 0, tries = 0;
            while (made < count && tries++ < count * 40) {
                let x, y;
                if (rnd() < edgeBias) {
                    const side = Math.floor(rnd() * 4), off = this.margin + 40 + rnd() * 170;
                    if (side === 0) { x = off; y = rnd() * H; }
                    else if (side === 1) { x = W - off; y = rnd() * H; }
                    else if (side === 2) { x = rnd() * W; y = off + 30; }
                    else { x = rnd() * W; y = H - off; }
                } else { x = rnd() * W; y = rnd() * H; }
                if (!okSpot(x, y, r)) continue;
                placed.push({ x, y, r });
                this.props.push({ type, x, y, r, seed: rnd() * 100, v: Math.floor(rnd() * 3), ...extra });
                if (colR) this.circles.push({ x, y: y - 4, r: colR });
                made++;
            }
        };

        // Яблоневый сад (со 2-й зоны)
        if (this.tier >= 1) {
            const ox = W * 0.2, oy = H * 0.52;
            for (let i = 0; i < 6; i++) {
                const x = ox + (i % 3) * 92, y = oy + Math.floor(i / 3) * 96;
                placed.push({ x, y, r: 26 });
                this.props.push({ type: 'tree', x, y, r: 26, seed: i * 3.1, v: 1, apple: true });
                this.circles.push({ x, y: y - 4, r: 13 });
            }
        }

        const area = W * H;
        scatter('tree', Math.round(area / 80000), 26, 13, 0.62);
        scatter('hay', 4 + this.tier * 3, 24, 22, 0.15);
        scatter('bush', 7 + this.tier * 4, 17, 12, 0.3);
        scatter('rock', 5 + this.tier * 3, 12, 11, 0.3);

        this.props.sort((a, b) => a.y - b.y);

        // Мелкие декорации на земле
        this.decor = [];
        const count = Math.floor(area / 4200);
        const fl = this.season.flowers;
        for (let i = 0; i < count; i++) {
            const x = this.margin + rnd() * (W - this.margin * 2), y = this.margin + rnd() * (H - this.margin * 2);
            const r = rnd();
            let type = 'tuft';
            if (fl.length && r < 0.3 * this.season.flowerRate) type = 'flower';
            else if (r > 0.93) type = 'pebble';
            this.decor.push({ x, y, type, size: 3 + rnd() * 4, c: Math.floor(rnd() * 8), a: rnd() * 6.28 });
        }
        this.blotches = [];
        for (let i = 0; i < Math.floor(area / 14000); i++) {
            this.blotches.push({ x: rnd() * W, y: rnd() * H, rx: 40 + rnd() * 110, ry: 26 + rnd() * 60, a: rnd() * 3.14, light: rnd() < 0.5 });
        }
        this.pumpkins = this.tier >= 2 ? { x: W * 0.64, y: H * 0.18 } : null;
    }

    /* ================= Кооперативная генерация (Co-op) ================= */
    buildCoop(tier, seasonIdx, coopMapIdx = 0) {
        const W = this.w, H = this.h;
        const rnd = U.seeded(8888 + tier * 113 + coopMapIdx * 41);

        const addBuilding = (type, bx, by, w, h, extra = {}) => {
            const b = { type, x: bx, y: by, w, h, solid: true, ...extra };
            this.props.push(b);
            this.rects.push({ x: bx - w / 2 + 5, y: by - h * 0.68, w: w - 10, h: h * 0.68 - 2 });
            return b;
        };

        // 1. Двойные амбары (Dual Barns):
        // Амбар 1 (Западный / Фермер P1 - красный)
        const b1x = (coopMapIdx === 1) ? W * 0.22 : W * 0.24;
        const b1y = (coopMapIdx === 1) ? H * 0.38 : H * 0.48;
        this.barn1 = addBuilding('barn', b1x, b1y, 196, 152, { barnIndex: 1, name: 'Амбар Фермера (P1)' });
        this.door1 = { x: b1x, y: b1y + 10 };

        // Амбар 2 (Восточный / Фермерша P2 - бирюзовый)
        const b2x = (coopMapIdx === 1) ? W * 0.78 : W * 0.76;
        const b2y = (coopMapIdx === 1) ? H * 0.62 : H * 0.48;
        this.barn2 = addBuilding('barn', b2x, b2y, 196, 152, { barnIndex: 2, name: 'Амбар Напарницы (P2)' });
        this.door2 = { x: b2x, y: b2y + 10 };

        // Обратная совместимость для полей одиночного режима
        this.barn = this.barn1;
        this.door = this.door1;
        this.barns = [this.barn1, this.barn2];
        this.doors = [this.door1, this.door2];

        // Хозяйственные постройки по краям
        const house = addBuilding('house', W * 0.12, H * 0.20, 142, 118);
        const shed = addBuilding('shed', W * 0.12, H * 0.82, 120, 92);
        const mill = addBuilding('mill', W * 0.88, H * 0.20, 88, 126);
        const coop = addBuilding('coop', W * 0.88, H * 0.82, 112, 84);

        // 2. Живописная река, делящая поле (Scenic River)
        let riverPoints = [];
        const riverWidth = 96;
        if (coopMapIdx === 1) {
            // Диагональная река
            riverPoints = [
                { x: W * 0.36, y: 0 },
                { x: W * 0.44, y: H * 0.30 },
                { x: W * 0.52, y: H * 0.62 },
                { x: W * 0.64, y: H }
            ];
        } else if (coopMapIdx === 2) {
            // Извилистая мягкая река
            riverPoints = [
                { x: W * 0.50, y: 0 },
                { x: W * 0.55, y: H * 0.32 },
                { x: W * 0.45, y: H * 0.68 },
                { x: W * 0.50, y: H }
            ];
        } else {
            // Макет 0: Речная долина с центральным руслом
            riverPoints = [
                { x: W * 0.49, y: 0 },
                { x: W * 0.53, y: H * 0.28 },
                { x: W * 0.47, y: H * 0.68 },
                { x: W * 0.51, y: H }
            ];
        }
        this.river = { points: riverPoints, width: riverWidth };

        // 3. Деревянные пешеходные мостики (Wooden Footbridges)
        this.bridges = [];
        if (coopMapIdx === 1) {
            this.bridges.push({ id: 'north_bridge', x: W * 0.42, y: H * 0.32, w: 132, h: 78, name: 'Северный мост' });
            this.bridges.push({ id: 'south_bridge', x: W * 0.58, y: H * 0.68, w: 132, h: 78, name: 'Южный мост' });
        } else {
            this.bridges.push({ id: 'north_bridge', x: W * 0.52, y: H * 0.22, w: 126, h: 76, name: 'Северный мост' });
            this.bridges.push({ id: 'center_bridge', x: W * 0.50, y: H * 0.50, w: 140, h: 88, name: 'Центральный мост' });
            this.bridges.push({ id: 'south_bridge', x: W * 0.48, y: H * 0.78, w: 126, h: 76, name: 'Южный мост' });
        }

        // Вычисляем сэмплы реки и добавляем физические коллизии воды (кроме мостов)
        const riverSamples = [];
        const steps = 44;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const p = this.evalRiverPoint(t);
            riverSamples.push(p);

            // Если точка не на мосту — добавляем коллизию воды
            if (!this.isOnBridge(p.x, p.y, 16)) {
                this.circles.push({ x: p.x, y: p.y, r: riverWidth * 0.46, sy: 0.92, water: true });
            }
        }
        this.river.samples = riverSamples;

        // 4. Интерактивные элементы карты
        // Пугало (Scarecrow)
        const scPos = (coopMapIdx === 1) ? { x: W * 0.32, y: H * 0.70 } : { x: W * 0.20, y: H * 0.30 };
        const scarecrow = { type: 'scarecrow', x: scPos.x, y: scPos.y, r: 16, wobble: 0, solid: true, name: 'Пугало Кузя' };
        this.props.push(scarecrow);
        this.circles.push({ x: scarecrow.x, y: scarecrow.y - 4, r: 14 });
        this.interactives.push(scarecrow);

        // Колокол фермы (Farm Bell)
        const bellPos = (coopMapIdx === 1) ? { x: W * 0.50, y: H * 0.48 } : { x: W * 0.58, y: H * 0.50 };
        const bell = { type: 'bell', x: bellPos.x, y: bellPos.y, r: 18, ringT: 0, solid: true, name: 'Колокол фермы' };
        this.props.push(bell);
        this.circles.push({ x: bell.x, y: bell.y - 4, r: 15 });
        this.interactives.push(bell);

        // Колодец
        const well = { type: 'well', x: W * 0.35, y: H * 0.20, r: 20 };
        this.props.push(well);
        this.circles.push({ x: well.x, y: well.y - 8, r: 20 });

        // 5. Тропинки между амбарами, мостами и домами
        const d1 = this.door1, d2 = this.door2;
        const mkPath = (x0, y0, x1, y1, bend = 0, w = 26) => {
            const mx = (x0 + x1) / 2 + bend, my = (y0 + y1) / 2;
            return { x0, y0, cx: mx, cy: my, x1, y1, w };
        };

        this.paths = [
            // От Амбара 1 к мостам и постройкам
            mkPath(d1.x, d1.y, this.bridges[0].x, this.bridges[0].y, -20),
            mkPath(d1.x, d1.y, this.bridges[Math.floor(this.bridges.length / 2)].x, this.bridges[Math.floor(this.bridges.length / 2)].y, 0, 32),
            mkPath(d1.x, d1.y, this.bridges[this.bridges.length - 1].x, this.bridges[this.bridges.length - 1].y, -20),
            mkPath(d1.x, d1.y, house.x, house.y + 12, -40),
            mkPath(d1.x, d1.y, shed.x + 20, shed.y + 6, -30),

            // От Амбара 2 к мостам и постройкам
            mkPath(d2.x, d2.y, this.bridges[0].x, this.bridges[0].y, 20),
            mkPath(d2.x, d2.y, this.bridges[Math.floor(this.bridges.length / 2)].x, this.bridges[Math.floor(this.bridges.length / 2)].y, 0, 32),
            mkPath(d2.x, d2.y, this.bridges[this.bridges.length - 1].x, this.bridges[this.bridges.length - 1].y, 20),
            mkPath(d2.x, d2.y, mill.x, mill.y + 12, 40),
            mkPath(d2.x, d2.y, coop.x - 20, coop.y + 6, 30)
        ];

        // 6. Коридоры препятствий для загона свиней (Apple Orchard & Hay Funnels)
        // Яблоневый сад слева (вертикальные аллеи для загона)
        const ox = W * 0.32, oy = H * 0.30;
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 2; col++) {
                const tx = ox + col * 72, ty = oy + row * 84;
                this.props.push({ type: 'tree', x: tx, y: ty, r: 26, seed: row * 4 + col, v: 1, apple: true });
                this.circles.push({ x: tx, y: ty - 4, r: 13 });
            }
        }

        // Коридоры из стогов сена для флангового перехвата (Hay Bales)
        const haySpots = [
            // Ворота перед мостами
            { x: this.bridges[0].x - 110, y: this.bridges[0].y - 25 },
            { x: this.bridges[0].x + 110, y: this.bridges[0].y + 25 },
            { x: this.bridges[this.bridges.length - 1].x - 110, y: this.bridges[this.bridges.length - 1].y + 25 },
            { x: this.bridges[this.bridges.length - 1].x + 110, y: this.bridges[this.bridges.length - 1].y - 25 },
            // Коридоры у Амбара 1
            { x: b1x - 90, y: b1y + 60 },
            { x: b1x + 90, y: b1y + 60 },
            // Коридоры у Амбара 2
            { x: b2x - 90, y: b2y + 60 },
            { x: b2x + 90, y: b2y + 60 },
            // Полевые ловушки
            { x: W * 0.65, y: H * 0.32 },
            { x: W * 0.68, y: H * 0.72 }
        ];
        for (const h of haySpots) {
            this.props.push({ type: 'hay', x: h.x, y: h.y, r: 24 });
            this.circles.push({ x: h.x, y: h.y - 4, r: 22 });
        }

        // Декоративные деревья, кусты, камни
        const scatterProps = (type, count, r, colR) => {
            let placedCount = 0, tries = 0;
            while (placedCount < count && tries++ < count * 35) {
                const x = this.margin + 40 + rnd() * (W - this.margin * 2 - 80);
                const y = this.margin + 50 + rnd() * (H - this.margin * 2 - 80);
                // Проверяем расстояние от дверей, реки и мостов
                if (Math.hypot(x - d1.x, y - d1.y) < 160 || Math.hypot(x - d2.x, y - d2.y) < 160) continue;
                if (this.isOnBridge(x, y, 30)) continue;
                let nearWater = false;
                for (const s of this.river.samples) {
                    if (Math.hypot(x - s.x, y - s.y) < riverWidth * 0.6) { nearWater = true; break; }
                }
                if (nearWater) continue;

                this.props.push({ type, x, y, r, seed: rnd() * 100, v: Math.floor(rnd() * 3) });
                if (colR) this.circles.push({ x, y: y - 4, r: colR });
                placedCount++;
            }
        };

        scatterProps('bush', 12 + this.tier * 4, 17, 12);
        scatterProps('rock', 8 + this.tier * 3, 12, 11);
        scatterProps('tree', 10 + this.tier * 2, 26, 13);

        this.props.sort((a, b) => a.y - b.y);

        // Земляные декорации
        this.decor = [];
        const area = W * H;
        const count = Math.floor(area / 4200);
        const fl = this.season.flowers;
        for (let i = 0; i < count; i++) {
            const x = this.margin + rnd() * (W - this.margin * 2), y = this.margin + rnd() * (H - this.margin * 2);
            const r = rnd();
            let type = 'tuft';
            if (fl.length && r < 0.3 * this.season.flowerRate) type = 'flower';
            else if (r > 0.93) type = 'pebble';
            this.decor.push({ x, y, type, size: 3 + rnd() * 4, c: Math.floor(rnd() * 8), a: rnd() * 6.28 });
        }
        this.blotches = [];
        for (let i = 0; i < Math.floor(area / 14000); i++) {
            this.blotches.push({ x: rnd() * W, y: rnd() * H, rx: 40 + rnd() * 110, ry: 26 + rnd() * 60, a: rnd() * 3.14, light: rnd() < 0.5 });
        }
        this.pumpkins = { x: W * 0.70, y: H * 0.20 };
    }

    /** Вычисление точки кубической кривой Безье для русла реки */
    evalRiverPoint(t) {
        if (!this.river || !this.river.points) return { x: this.w * 0.5, y: t * this.h };
        const pts = this.river.points;
        if (pts.length === 4) {
            const mt = 1 - t;
            const mt2 = mt * mt, t2 = t * t;
            const a = mt2 * mt, b = 3 * mt2 * t, c = 3 * mt * t2, d = t2 * t;
            return {
                x: a * pts[0].x + b * pts[1].x + c * pts[2].x + d * pts[3].x,
                y: a * pts[0].y + b * pts[1].y + c * pts[2].y + d * pts[3].y
            };
        }
        return { x: this.w * 0.5, y: t * this.h };
    }

    /** Проверка, находится ли сущность на одном из деревянных мостиков */
    isOnBridge(x, y, pad = 8) {
        if (!this.bridges || !this.bridges.length) return false;
        for (const b of this.bridges) {
            const hw = b.w / 2 + pad, hh = b.h / 2 + pad;
            if (x >= b.x - hw && x <= b.x + hw && y >= b.y - hh && y <= b.y + hh) {
                return true;
            }
        }
        return false;
    }

    /** Возвращает ближайшую дверь амбара для заданной точки */
    getClosestDoor(x, y) {
        if (!this.doors || !this.doors.length) return this.door;
        let best = this.doors[0], minD = Math.hypot(x - best.x, y - best.y);
        for (let i = 1; i < this.doors.length; i++) {
            const d = Math.hypot(x - this.doors[i].x, y - this.doors[i].y);
            if (d < minD) { minD = d; best = this.doors[i]; }
        }
        return best;
    }

    /** Возвращает дверь конкретного игрока (P1 -> door1, P2 -> door2) */
    getDoorForPlayer(p) {
        const id = (typeof p === 'number') ? p : (p && p.id ? p.id : 1);
        if (id === 2 && this.door2) return this.door2;
        return this.door1 || this.door;
    }

    /** Возвращает амбар конкретного игрока (P1 -> barn1, P2 -> barn2) */
    getBarnForPlayer(p) {
        const id = (typeof p === 'number') ? p : (p && p.id ? p.id : 1);
        if (id === 2 && this.barn2) return this.barn2;
        return this.barn1 || this.barn;
    }

    /** Активация открытия ворот амбара */
    openBarn(barnIndex = 1) {
        if (barnIndex === 2) {
            this.barn2Open = 1.2;
            this.barn2Bounce = 1.0;
        } else {
            this.barnOpen = 1.2;
            this.barnBounce = 1.0;
        }
    }

    /** Взаимодействие с интерактивными объектами карты (пугало, колокол) */
    triggerInteractive(x, y, rad = 36, game = null) {
        let triggered = null;
        for (const it of this.interactives) {
            const dist = Math.hypot(x - it.x, y - it.y);
            if (dist <= rad + it.r) {
                if (it.type === 'scarecrow') {
                    it.wobble = 1.0;
                    triggered = 'scarecrow';
                    if (game && game.fx) game.fx.dust(it.x, it.y - 12, 6, '#fef08a');
                    if (game && game.sfx && game.sfx.combo) game.sfx.combo(1);
                    // Пугало отпугивает ближайших свиней в коридоре
                    if (game && game.pigs) {
                        for (const pig of game.pigs) {
                            const pd = Math.hypot(pig.x - it.x, pig.y - it.y);
                            if (pd < 170 && !pig.caught && !pig.inBarn) {
                                pig.scared = 2.0;
                                const ang = Math.atan2(pig.y - it.y, pig.x - it.x);
                                pig.vx = Math.cos(ang) * 190;
                                pig.vy = Math.sin(ang) * 190;
                            }
                        }
                    }
                } else if (it.type === 'bell') {
                    it.ringT = 1.0;
                    triggered = 'bell';
                    if (game && game.sfx && game.sfx.combo) game.sfx.combo(3);
                    if (game && game.fx) {
                        game.fx.sparkle(it.x, it.y - 36, '#ffd23f');
                        game.fx.floatText(it.x, it.y - 50, '🔔 ДИНЬ-ДОН!', '#ffd23f');
                    }
                    // Звон привлекает внимание свиней или путает их направление
                    if (game && game.pigs) {
                        for (const pig of game.pigs) {
                            const pd = Math.hypot(pig.x - it.x, pig.y - it.y);
                            if (pd < 220 && !pig.caught && !pig.inBarn) {
                                pig.alarmT = 2.5;
                                if (pig.vx) pig.vx = -pig.vx;
                            }
                        }
                    }
                }
            }
        }
        return triggered;
    }

    /* ================= Коллизии ================= */
    resolve(e, rad, clampBounds = true) {
        let hit = false;
        const onBridge = this.isOnBridge(e.x, e.y);

        for (const r of this.rects) {
            if (r.water && onBridge) continue;
            const nx = U.clamp(e.x, r.x, r.x + r.w), ny = U.clamp(e.y, r.y, r.y + r.h);
            const dx = e.x - nx, dy = e.y - ny, d2 = dx * dx + dy * dy;
            if (d2 >= rad * rad) continue;
            hit = true;
            if (d2 > 0.0001) {
                const dd = Math.sqrt(d2);
                e.x = nx + (dx / dd) * rad; e.y = ny + (dy / dd) * rad;
            } else {
                const l = e.x - r.x, rr = r.x + r.w - e.x, t = e.y - r.y, b = r.y + r.h - e.y, m = Math.min(l, rr, t, b);
                if (m === l) e.x = r.x - rad; else if (m === rr) e.x = r.x + r.w + rad;
                else if (m === t) e.y = r.y - rad; else e.y = r.y + r.h + rad;
            }
        }
        for (const c of this.circles) {
            if (c.water && onBridge) continue;
            const sy = c.sy || 1;
            const dx = e.x - c.x, dy = (e.y - c.y) / sy, dd = Math.hypot(dx, dy), min = c.r + rad;
            if (dd >= min) continue;
            hit = true;
            const nx = dd > 0.001 ? dx / dd : 1, ny = dd > 0.001 ? dy / dd : 0;
            e.x = c.x + nx * min; e.y = c.y + ny * min * sy;
        }
        if (clampBounds) {
            const m = this.margin + rad;
            if (e.x < m) { e.x = m; hit = true; } else if (e.x > this.w - m) { e.x = this.w - m; hit = true; }
            if (e.y < m + 8) { e.y = m + 8; hit = true; } else if (e.y > this.h - m) { e.y = this.h - m; hit = true; }
        }
        return hit;
    }

    /** Вектор отталкивания от препятствий (для ИИ свиней и напарников) */
    avoid(x, y, range) {
        let ax = 0, ay = 0;
        const onBridge = this.isOnBridge(x, y);

        for (const r of this.rects) {
            if (r.water && onBridge) continue;
            const nx = U.clamp(x, r.x, r.x + r.w), ny = U.clamp(y, r.y, r.y + r.h);
            const dx = x - nx, dy = y - ny, dd = Math.hypot(dx, dy);
            if (dd < range && dd > 0.01) { const k = (1 - dd / range); ax += (dx / dd) * k; ay += (dy / dd) * k; }
        }
        for (const c of this.circles) {
            if (c.water && onBridge) continue;
            const dx = x - c.x, dy = (y - c.y) / (c.sy || 1), dd = Math.hypot(dx, dy) - c.r;
            if (dd < range) { const l = Math.hypot(dx, dy) || 1, k = (1 - Math.max(0, dd) / range); ax += (dx / l) * k; ay += (dy / l) * k; }
        }
        return { x: ax, y: ay };
    }

    isFree(x, y, rad) {
        if (x < this.margin + rad || x > this.w - this.margin - rad || y < this.margin + rad + 8 || y > this.h - this.margin - rad) return false;
        const onBridge = this.isOnBridge(x, y);

        for (const r of this.rects) {
            if (r.water && onBridge) continue;
            const nx = U.clamp(x, r.x, r.x + r.w), ny = U.clamp(y, r.y, r.y + r.h);
            if (Math.hypot(x - nx, y - ny) < rad) return false;
        }
        for (const c of this.circles) {
            if (c.water && onBridge) continue;
            if (Math.hypot(x - c.x, (y - c.y) / (c.sy || 1)) < c.r + rad) return false;
        }
        return true;
    }

    freeSpot(rad = 30, near = null, minD = 0, maxD = 1e9) {
        for (let i = 0; i < 90; i++) {
            const x = U.rand(this.margin + rad, this.w - this.margin - rad);
            const y = U.rand(this.margin + rad + 10, this.h - this.margin - rad);
            if (!this.isFree(x, y, rad)) continue;
            if (near) {
                const dd = Math.hypot(x - near.x, y - near.y);
                if (dd < minD || dd > maxD) continue;
            }
            return { x, y };
        }
        return { x: this.door.x + U.rand(-180, 180), y: this.door.y + U.rand(90, 200) };
    }

    addPuddle(x, y, r = 34, life = 11) {
        if (this.puddles.length > 70) return;
        this.puddles.push({ x, y, r, life, max: life, seed: Math.random() * 10 });
    }

    inMud(x, y) {
        for (const p of this.puddles) {
            if (Math.hypot(x - p.x, (y - p.y) / 0.6) < p.r) return true;
        }
        return false;
    }

    update(dt) {
        this.time += dt;
        if (this._barnOpen > 0) this._barnOpen = Math.max(0, this._barnOpen - dt);
        if (this._barnBounce > 0) this._barnBounce = Math.max(0, this._barnBounce - dt * 4);
        if (this._barn2Open > 0) this._barn2Open = Math.max(0, this._barn2Open - dt);
        if (this._barn2Bounce > 0) this._barn2Bounce = Math.max(0, this._barn2Bounce - dt * 4);

        // Обновление интерактивных элементов
        for (const it of this.interactives) {
            if (it.wobble > 0) it.wobble = Math.max(0, it.wobble - dt * 2.8);
            if (it.ringT > 0) it.ringT = Math.max(0, it.ringT - dt * 2.4);
        }

        for (let i = this.puddles.length - 1; i >= 0; i--) {
            const p = this.puddles[i];
            p.life -= dt;
            if (p.life <= 0) this.puddles.splice(i, 1);
        }
    }

    /* ================= Земля (рисуется в буфер) ================= */
    renderGround() {
        const W = this.w, H = this.h, s = this.season;
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const ctx = cv.getContext('2d');
        const rnd = U.seeded(99 + this.tier * 31);

        // Трава
        ctx.fillStyle = s.grass;
        ctx.fillRect(0, 0, W, H);

        for (const b of this.blotches) {
            ctx.fillStyle = b.light ? s.grass3 : s.grass2;
            ctx.globalAlpha = 0.55;
            ctx.beginPath();
            ctx.ellipse(b.x, b.y, b.rx, b.ry, b.a, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Если кооп: река со сглаженными берегами
        if (this.mode === 'coop' && this.river && this.river.samples) {
            const smp = this.river.samples;
            const rw = this.river.width;
            const isWinter = s.id === 'winter';

            // Берега реки (песок / галька / снег)
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = isWinter ? '#b9c7d1' : '#c9b17c';
            ctx.lineWidth = rw + 24;
            ctx.beginPath();
            ctx.moveTo(smp[0].x, smp[0].y);
            for (let i = 1; i < smp.length; i++) ctx.lineTo(smp[i].x, smp[i].y);
            ctx.stroke();

            // Водное зеркало реки
            ctx.strokeStyle = isWinter ? '#bae6fd' : '#38bdf8';
            ctx.lineWidth = rw;
            ctx.beginPath();
            ctx.moveTo(smp[0].x, smp[0].y);
            for (let i = 1; i < smp.length; i++) ctx.lineTo(smp[i].x, smp[i].y);
            ctx.stroke();

            // Внутреннее русло реки с градиентом глубины
            ctx.strokeStyle = isWinter ? '#93c5fd' : '#0284c7';
            ctx.lineWidth = rw * 0.72;
            ctx.stroke();

            // Водная рябь у берегов
            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.lineWidth = 2.5;
            for (let i = 2; i < smp.length - 2; i += 3) {
                const sp = smp[i];
                ctx.beginPath();
                ctx.ellipse(sp.x - rw * 0.28, sp.y, 14, 5, 0.2, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // Тропинки
        ctx.lineCap = 'round';
        for (const pass of [0, 1, 2]) {
            for (const p of this.paths) {
                ctx.strokeStyle = pass === 0 ? s.pathEdge : (pass === 1 ? s.path : 'rgba(255,255,255,0.16)');
                ctx.lineWidth = pass === 0 ? p.w + 8 : (pass === 1 ? p.w : p.w * 0.4);
                ctx.beginPath();
                ctx.moveTo(p.x0, p.y0);
                ctx.quadraticCurveTo(p.cx, p.cy, p.x1, p.y1);
                ctx.stroke();
            }
        }

        // Площадки перед воротами амбаров
        for (const d of this.doors) {
            ctx.fillStyle = s.pathEdge;
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 14, 88, 38, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = s.path;
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 14, 82, 33, 0, 0, Math.PI * 2); ctx.fill();
        }

        // Деревянные мостики в режиме коопа
        if (this.mode === 'coop') {
            for (const b of this.bridges) {
                this.drawBridgeDeck(ctx, b, s);
            }
        }

        // Одиночный пруд (если соло)
        if (this.pond) {
            const p = this.pond;
            ctx.fillStyle = s.id === 'winter' ? '#b9c7d1' : '#c9b17c';
            ctx.beginPath(); ctx.ellipse(p.x, p.y, p.rx + 12, p.ry + 10, 0, 0, Math.PI * 2); ctx.fill();
            const wg = ctx.createRadialGradient(p.x - p.rx * 0.2, p.y - p.ry * 0.3, 10, p.x, p.y, p.rx);
            if (s.id === 'winter') { wg.addColorStop(0, '#eaf6ff'); wg.addColorStop(1, '#a9d4ee'); }
            else { wg.addColorStop(0, '#6fd3f7'); wg.addColorStop(1, '#2a9fd6'); }
            ctx.fillStyle = wg;
            ctx.beginPath(); ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.ellipse(p.x, p.y, p.rx - 5, p.ry - 5, 0, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
            if (s.id !== 'winter') {
                ctx.fillStyle = '#3fae5a';
                for (const [ox, oy, r] of [[-0.4, 0.2, 10], [0.35, -0.25, 12], [0.1, 0.45, 8]]) {
                    ctx.beginPath(); ctx.moveTo(p.x + ox * p.rx, p.y + oy * p.ry);
                    ctx.arc(p.x + ox * p.rx, p.y + oy * p.ry, r, 0.5, Math.PI * 2); ctx.fill();
                }
                ctx.fillStyle = '#ff9ecd';
                ctx.beginPath(); ctx.arc(p.x + 0.35 * p.rx, p.y - 0.25 * p.ry, 4, 0, Math.PI * 2); ctx.fill();
            }
        }

        // Тыквенная грядка
        if (this.pumpkins) {
            const g = this.pumpkins;
            for (let row = 0; row < 3; row++) {
                ctx.fillStyle = '#7a4a22';
                ctx.beginPath(); ctx.roundRect(g.x - 80, g.y + row * 30, 160, 14, 7); ctx.fill();
                for (let col = 0; col < 4; col++) {
                    const px = g.x - 58 + col * 39, py = g.y + row * 30 + 4;
                    ctx.fillStyle = '#f2811d'; ctx.beginPath(); ctx.ellipse(px, py, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = '#b85a0c'; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.ellipse(px, py, 4, 8, 0, 0, Math.PI * 2); ctx.stroke();
                    ctx.fillStyle = '#3f8a3a'; ctx.fillRect(px - 1.5, py - 11, 3, 5);
                }
            }
        }

        // Трава, цветы, камушки
        for (const dcr of this.decor) {
            if (dcr.type === 'tuft') {
                ctx.strokeStyle = s.id === 'winter' ? '#bcd3df' : s.grass2;
                ctx.globalAlpha = 0.9; ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.moveTo(dcr.x, dcr.y); ctx.lineTo(dcr.x - 3, dcr.y - dcr.size);
                ctx.moveTo(dcr.x, dcr.y); ctx.lineTo(dcr.x + 3, dcr.y - dcr.size * 1.1);
                ctx.moveTo(dcr.x, dcr.y); ctx.lineTo(dcr.x, dcr.y - dcr.size * 1.3);
                ctx.stroke();
                ctx.globalAlpha = 1;
            } else if (dcr.type === 'flower') {
                const col = s.flowers[dcr.c % s.flowers.length];
                ctx.fillStyle = col;
                for (let i = 0; i < 5; i++) {
                    const a = dcr.a + (i * Math.PI * 2) / 5;
                    ctx.beginPath(); ctx.arc(dcr.x + Math.cos(a) * dcr.size * 0.5, dcr.y + Math.sin(a) * dcr.size * 0.5, dcr.size * 0.36, 0, Math.PI * 2); ctx.fill();
                }
                ctx.fillStyle = '#f59e0b';
                ctx.beginPath(); ctx.arc(dcr.x, dcr.y, dcr.size * 0.3, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.fillStyle = '#9aa5b1';
                ctx.beginPath(); ctx.ellipse(dcr.x, dcr.y, dcr.size, dcr.size * 0.6, dcr.a, 0, Math.PI * 2); ctx.fill();
            }
        }

        // Забор по периметру карты
        const m = this.margin;
        ctx.fillStyle = s.id === 'winter' ? '#9fb8c6' : '#2f6b33';
        ctx.fillRect(0, 0, W, m - 8); ctx.fillRect(0, H - m + 10, W, m); ctx.fillRect(0, 0, m - 10, H); ctx.fillRect(W - m + 10, 0, m, H);
        ctx.fillStyle = s.id === 'winter' ? '#c9dbe5' : '#3d8440';
        for (let x = 0; x < W; x += 26) {
            ctx.beginPath(); ctx.arc(x + rnd() * 8, m - 10, 14 + rnd() * 6, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + rnd() * 8, H - m + 14, 14 + rnd() * 6, 0, Math.PI * 2); ctx.fill();
        }
        for (let y = 0; y < H; y += 26) {
            ctx.beginPath(); ctx.arc(m - 14, y + rnd() * 8, 14 + rnd() * 6, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(W - m + 14, y + rnd() * 8, 14 + rnd() * 6, 0, Math.PI * 2); ctx.fill();
        }
        const rail = (x0, y0, x1, y1) => {
            ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
            ctx.strokeStyle = '#a9743f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y0 - 1); ctx.lineTo(x1, y1 - 1); ctx.stroke();
        };
        const fy0 = m + 2, fy1 = H - m + 2, fx0 = m, fx1 = W - m;
        rail(fx0, fy0, fx1, fy0); rail(fx0, fy0 - 9, fx1, fy0 - 9);
        rail(fx0, fy1, W / 2 - 34, fy1); rail(W / 2 + 34, fy1, fx1, fy1);
        rail(fx0, fy0, fx0, fy1); rail(fx1, fy0, fx1, fy1);
        ctx.fillStyle = '#7a4d27';
        for (let x = fx0; x <= fx1; x += 46) { ctx.fillRect(x - 3.5, fy0 - 16, 7, 22); ctx.fillRect(x - 3.5, fy1 - 14, 7, 20); }
        for (let y = fy0; y <= fy1; y += 46) { ctx.fillRect(fx0 - 3.5, y - 14, 7, 20); ctx.fillRect(fx1 - 3.5, y - 14, 7, 20); }

        this.ground = cv;
    }

    /** Отрисовка деревянного настила мостика */
    drawBridgeDeck(ctx, b, season) {
        const OUT = '#4a2810';
        const hw = b.w / 2, hh = b.h / 2;

        // Каменные устои моста на берегах
        ctx.fillStyle = '#64748b';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(b.x - hw - 8, b.y - hh - 2, 14, b.h + 4, 3);
        ctx.roundRect(b.x + hw - 6, b.y - hh - 2, 14, b.h + 4, 3);
        ctx.fill(); ctx.stroke();

        // Деревянный настил
        ctx.fillStyle = '#92400e';
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(b.x - hw, b.y - hh, b.w, b.h, 4);
        ctx.fill(); ctx.stroke();

        // Доски настила
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2;
        const step = 14;
        for (let px = b.x - hw + step; px < b.x + hw; px += step) {
            ctx.beginPath();
            ctx.moveTo(px, b.y - hh + 2);
            ctx.lineTo(px, b.y + hh - 2);
            ctx.stroke();

            // Гвоздики на досках
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(px - step / 2, b.y - hh + 6, 1.2, 0, Math.PI * 2);
            ctx.arc(px - step / 2, b.y + hh - 6, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Боковые перила
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(b.x - hw - 4, b.y - hh + 3); ctx.lineTo(b.x + hw + 4, b.y - hh + 3);
        ctx.moveTo(b.x - hw - 4, b.y + hh - 3); ctx.lineTo(b.x + hw + 4, b.y + hh - 3);
        ctx.stroke();

        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(b.x - hw - 4, b.y - hh + 3); ctx.lineTo(b.x + hw + 4, b.y - hh + 3);
        ctx.moveTo(b.x - hw - 4, b.y + hh - 3); ctx.lineTo(b.x + hw + 4, b.y + hh - 3);
        ctx.stroke();

        // Столбики перил с теплыми фонариками по углам
        for (const [px, py] of [[b.x - hw + 4, b.y - hh + 3], [b.x + hw - 4, b.y - hh + 3], [b.x - hw + 4, b.y + hh - 3], [b.x + hw - 4, b.y + hh - 3]]) {
            ctx.fillStyle = '#451a03';
            ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255, 235, 120, 0.4)';
            ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffd23f';
            ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill();
        }
    }

    drawGround(ctx, vx, vy, vw, vh) {
        const sx = Math.max(0, Math.floor(vx)), sy = Math.max(0, Math.floor(vy));
        const sw = Math.min(this.w - sx, Math.ceil(vw) + 2), sh = Math.min(this.h - sy, Math.ceil(vh) + 2);
        if (sw > 0 && sh > 0) ctx.drawImage(this.ground, sx, sy, sw, sh, sx, sy, sw, sh);

        // Блики и анимация воды
        const t = this.time;
        if (this.mode === 'coop' && this.river && this.river.samples) {
            // Течение реки и легкие волны
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 2;
            const smp = this.river.samples;
            for (let i = 3; i < smp.length - 3; i += 4) {
                const sp = smp[i];
                const ph = (t * 0.4 + i * 0.15) % 1;
                ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.55;
                ctx.beginPath();
                ctx.ellipse(sp.x + Math.sin(ph * 4) * 8, sp.y + ph * 12, 10 + ph * 10, 3.5, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        } else if (this.pond && this.season.id !== 'winter') {
            const p = this.pond;
            ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
            for (let i = 0; i < 3; i++) {
                const ph = (t * 0.35 + i / 3) % 1;
                ctx.globalAlpha = (1 - ph) * 0.6;
                ctx.beginPath();
                ctx.ellipse(p.x + (i - 1) * p.rx * 0.38, p.y + (i % 2 ? 0.2 : -0.15) * p.ry, 6 + ph * 20, 3 + ph * 9, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        // Грязевые лужи
        for (const pd of this.puddles) {
            const k = Math.min(1, pd.life / 1.2) * Math.min(1, (pd.max - pd.life) * 5 + 0.2);
            ctx.globalAlpha = Math.min(1, k);
            ctx.fillStyle = '#5c3d21';
            ctx.beginPath(); ctx.ellipse(pd.x, pd.y, pd.r, pd.r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#7a5230';
            ctx.beginPath(); ctx.ellipse(pd.x - pd.r * 0.12, pd.y - pd.r * 0.08, pd.r * 0.72, pd.r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            ctx.beginPath(); ctx.ellipse(pd.x - pd.r * 0.3, pd.y - pd.r * 0.18, pd.r * 0.2, pd.r * 0.08, -0.3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    /* ================= Постройки и объекты ================= */
    drawProp(ctx, p, focus, info) {
        const t = this.time;
        let alpha = 1;
        if (focus) {
            const hw = p.w ? p.w / 2 : 34, hh = p.h || 90;
            if (Math.abs(focus.x - p.x) < hw + 8 && focus.y < p.y - 4 && focus.y > p.y - hh - 10) alpha = 0.45;
        }
        ctx.save();
        ctx.globalAlpha = alpha;
        switch (p.type) {
            case 'barn': this.drawBarn(ctx, p, info); break;
            case 'house': this.drawHouse(ctx, p, t); break;
            case 'mill': this.drawMill(ctx, p, t); break;
            case 'shed': this.drawShed(ctx, p); break;
            case 'coop': this.drawCoop(ctx, p); break;
            case 'well': this.drawWell(ctx, p); break;
            case 'scarecrow': this.drawScarecrow(ctx, p, t); break;
            case 'bell': this.drawBell(ctx, p, t); break;
            case 'tree': this.drawTree(ctx, p, t); break;
            case 'hay': this.drawHay(ctx, p); break;
            case 'bush': this.drawBush(ctx, p, t); break;
            case 'rock': this.drawRock(ctx, p); break;
        }
        ctx.restore();
    }

    shadow(ctx, x, y, rx, ry) {
        ctx.fillStyle = 'rgba(20,40,20,0.22)';
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    }

    drawBarn(ctx, b, info) {
        const w = b.w, h = b.h, OUT = '#4a2513';
        this.shadow(ctx, b.x, b.y, w * 0.6, 18);
        ctx.translate(b.x, b.y);

        const isBarn2 = b.barnIndex === 2 || b === this.barn2;
        const bn = isBarn2 ? this._barn2Bounce : this._barnBounce;
        ctx.scale(1 + bn * 0.05, 1 - bn * 0.06);
        const x = -w / 2, y = -h;

        // Цветовая схема: Красный (P1) vs Бирюзово-синий (P2)
        const facadeColor = isBarn2 ? '#0284c7' : '#d23f36';
        const plankColor = isBarn2 ? 'rgba(10,50,90,0.45)' : 'rgba(120,20,20,0.45)';
        const roofTrim = isBarn2 ? '#0369a1' : '#7b4a2b';
        const leafColor = isBarn2 ? '#0891b2' : '#b3342c';

        // Фасад
        ctx.fillStyle = facadeColor;
        ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x, 0); ctx.lineTo(x, y + 62); ctx.lineTo(x + 26, y + 28); ctx.lineTo(0, y + 6);
        ctx.lineTo(-x - 26, y + 28); ctx.lineTo(-x, y + 62); ctx.lineTo(-x, 0); ctx.closePath();
        ctx.fill(); ctx.stroke();

        // Доски
        ctx.strokeStyle = plankColor; ctx.lineWidth = 1.5;
        for (let px = x + 15; px < -x; px += 15) {
            ctx.beginPath(); ctx.moveTo(px, y + 62); ctx.lineTo(px, -1); ctx.stroke();
        }

        // Крыша
        ctx.strokeStyle = OUT; ctx.lineWidth = 17; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - 10, y + 66); ctx.lineTo(x + 22, y + 26); ctx.lineTo(0, y + 2); ctx.lineTo(-x - 22, y + 26); ctx.lineTo(-x + 10, y + 66); ctx.stroke();
        ctx.strokeStyle = roofTrim; ctx.lineWidth = 11;
        ctx.beginPath(); ctx.moveTo(x - 10, y + 66); ctx.lineTo(x + 22, y + 26); ctx.lineTo(0, y + 2); ctx.lineTo(-x - 22, y + 26); ctx.lineTo(-x + 10, y + 66); ctx.stroke();
        if (this.season.id === 'winter') {
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(x + 22, y + 22); ctx.lineTo(0, y - 1); ctx.lineTo(-x - 22, y + 22); ctx.stroke();
        }

        // Чердачное окно (для P1 — свинка, для P2 — золотая свинка / птичка)
        ctx.fillStyle = '#2b1a3a'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, y + 44, 15, Math.PI, 0); ctx.lineTo(15, y + 56); ctx.lineTo(-15, y + 56); ctx.closePath(); ctx.fill(); ctx.stroke();
        const peek = Math.sin(this.time * 1.3) * 2;
        ctx.fillStyle = isBarn2 ? '#fed7aa' : '#fbb6d4';
        ctx.beginPath(); ctx.arc(0, y + 51 + peek, 8.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = isBarn2 ? '#f97316' : '#f4729f';
        ctx.beginPath(); ctx.ellipse(0, y + 53 + peek, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1f1320';
        const blink = (this.time % 3.4) < 0.12 ? 0.3 : 1.3;
        ctx.beginPath(); ctx.ellipse(-3.5, y + 48.5 + peek, 1.2, blink, 0, 0, Math.PI * 2); ctx.ellipse(3.5, y + 48.5 + peek, 1.2, blink, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = facadeColor; ctx.fillRect(-16, y + 56, 32, 5);

        // Ворота
        const dw = 64, dh = 66;
        ctx.fillStyle = '#1d0f0a';
        ctx.fillRect(-dw / 2, -dh, dw, dh);
        const openTime = isBarn2 ? this._barn2Open : this._barnOpen;
        const open = Math.min(1, openTime * 3);
        const leaf = (dir) => {
            ctx.save();
            ctx.translate(dir * dw / 2, 0);
            ctx.scale(dir * (1 - open * 0.82), 1);
            ctx.fillStyle = leafColor; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.rect(-dw / 2, -dh, dw / 2, dh); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-dw / 2, -dh); ctx.lineTo(0, 0); ctx.moveTo(0, -dh); ctx.lineTo(-dw / 2, 0); ctx.stroke();
            ctx.restore();
        };
        leaf(1); leaf(-1);
        ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(-dw / 2, -dh, dw, dh);

        // Табличка-счётчик или название амбара
        const tagText = info || (this.mode === 'coop' ? (isBarn2 ? '🏠 P2 АМБАР' : '🏠 P1 АМБАР') : null);
        if (tagText) {
            ctx.fillStyle = '#fff3d6'; ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.roundRect(-46, -dh - 26, 92, 21, 6); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#5b3a1e'; ctx.font = '900 12px "Nunito","Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(tagText, 0, -dh - 15);
        }
    }

    drawScarecrow(ctx, p, t) {
        const OUT = '#3f2a17';
        this.shadow(ctx, p.x, p.y + 2, 24, 7);
        ctx.translate(p.x, p.y);

        // Покачивание от ветра или толчка
        const wob = Math.sin(t * 18) * (p.wobble || 0) * 0.22 + Math.sin(t * 2.2) * 0.04;
        ctx.rotate(wob);

        // Деревянный шест
        ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, -56); ctx.stroke();

        // Поперечная перекладина для рук
        ctx.beginPath(); ctx.moveTo(-28, -38); ctx.lineTo(28, -38); ctx.stroke();

        // Пучки соломы на концах рукавов
        ctx.fillStyle = '#fde047'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-28, -38); ctx.lineTo(-37, -35); ctx.lineTo(-35, -41); ctx.closePath();
        ctx.moveTo(28, -38); ctx.lineTo(37, -35); ctx.lineTo(35, -41); ctx.closePath();
        ctx.fill(); ctx.stroke();

        // Рубашка (клетчатая)
        ctx.fillStyle = '#dc2626'; ctx.strokeStyle = OUT; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.roundRect(-14, -46, 28, 26, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-10, -36, 6, 6); ctx.fillRect(4, -36, 6, 6); ctx.fillRect(-3, -44, 6, 6);

        // Голова из мешковины
        ctx.fillStyle = '#d97706'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, -58, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        // Глазки-пуговицы и улыбка крестиком
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.arc(-4, -60, 2, 0, Math.PI * 2); ctx.arc(4, -60, 2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, -55, 5, 0.2, Math.PI - 0.2); ctx.stroke();

        // Шляпа пугала
        ctx.fillStyle = '#b45309'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, -66, 17, 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(-8, -78, 16, 13, [5, 5, 0, 0]); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ef4444'; ctx.fillRect(-7.5, -70, 15, 3);
    }

    drawBell(ctx, p, t) {
        const OUT = '#3f2a17';
        this.shadow(ctx, p.x, p.y + 2, 26, 8);
        ctx.translate(p.x, p.y);

        // Опорная деревянная арка
        ctx.strokeStyle = '#78350f'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-16, 2); ctx.lineTo(-16, -48);
        ctx.moveTo(16, 2); ctx.lineTo(16, -48);
        ctx.moveTo(-22, -48); ctx.lineTo(22, -48);
        ctx.stroke();

        // Колокол с раскачиванием от звона
        ctx.save();
        ctx.translate(0, -46);
        const swing = Math.sin(t * 26) * (p.ringT || 0) * 0.35;
        ctx.rotate(swing);

        // Золотистый колокол
        ctx.fillStyle = '#f59e0b'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-4, 0); ctx.lineTo(4, 0);
        ctx.lineTo(8, 16); ctx.quadraticCurveTo(12, 22, 14, 25);
        ctx.lineTo(-14, 25); ctx.quadraticCurveTo(-12, 22, -8, 16);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // Юбка колокола и язычок
        ctx.fillStyle = '#d97706';
        ctx.beginPath(); ctx.ellipse(0, 25, 14, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#78350f';
        ctx.beginPath(); ctx.arc(0, 28, 3, 0, Math.PI * 2); ctx.fill();

        // Веревочка
        ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, 28); ctx.lineTo(2, 42); ctx.stroke();
        ctx.restore();

        // Звуковые волны при звоне
        if (p.ringT > 0.05) {
            ctx.strokeStyle = `rgba(255, 215, 64, ${p.ringT * 0.8})`;
            ctx.lineWidth = 2;
            const rWave = (1 - p.ringT) * 36 + 18;
            ctx.beginPath(); ctx.arc(0, -32, rWave, -Math.PI * 0.8, -Math.PI * 0.2); ctx.stroke();
            ctx.beginPath(); ctx.arc(0, -32, rWave * 1.3, -Math.PI * 0.75, -Math.PI * 0.25); ctx.stroke();
        }
    }

    drawHouse(ctx, b, t) {
        const w = b.w, h = b.h, OUT = '#4a2f1a';
        this.shadow(ctx, b.x, b.y, w * 0.58, 14);
        ctx.translate(b.x, b.y);
        const x = -w / 2, y = -h;
        // Дым
        for (let i = 0; i < 4; i++) {
            const ph = (t * 0.28 + i / 4) % 1;
            ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - ph)})`;
            ctx.beginPath(); ctx.arc(x + 32 + Math.sin(ph * 5 + i) * 7 + ph * 14, y - 4 - ph * 62, 6 + ph * 11, 0, Math.PI * 2); ctx.fill();
        }
        ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
        ctx.fillStyle = '#9a4b3c'; ctx.beginPath(); ctx.rect(x + 22, y - 2, 20, 40); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f6e3bd'; ctx.beginPath(); ctx.rect(x, y + 46, w, h - 46); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#c64b3a';
        ctx.beginPath(); ctx.moveTo(x - 12, y + 52); ctx.lineTo(0, y + 2); ctx.lineTo(-x + 12, y + 52); ctx.closePath(); ctx.fill(); ctx.stroke();
        if (this.season.id === 'winter') {
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x + 14, y + 36); ctx.lineTo(0, y + 2); ctx.lineTo(-x - 14, y + 36); ctx.lineTo(0, y + 16); ctx.closePath(); ctx.fill();
        }
        // Окна и дверь
        ctx.fillStyle = '#ffe58a';
        for (const wx of [x + 16, -x - 44]) {
            ctx.beginPath(); ctx.rect(wx, y + 62, 28, 28); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(wx + 14, y + 62); ctx.lineTo(wx + 14, y + 90); ctx.moveTo(wx, y + 76); ctx.lineTo(wx + 28, y + 76); ctx.stroke();
        }
        ctx.fillStyle = '#7a4a2a'; ctx.beginPath(); ctx.roundRect(-14, -44, 28, 44, [10, 10, 0, 0]); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(7, -20, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    drawMill(ctx, b, t) {
        const w = b.w, h = b.h, OUT = '#4a3a2a';
        this.shadow(ctx, b.x, b.y, w * 0.6, 13);
        ctx.translate(b.x, b.y);
        ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
        ctx.fillStyle = '#f2ede2';
        ctx.beginPath(); ctx.moveTo(-w / 2 + 6, 0); ctx.lineTo(w / 2 - 6, 0); ctx.lineTo(w / 2 - 22, -h + 30); ctx.lineTo(-w / 2 + 22, -h + 30); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#8a5a34';
        ctx.beginPath(); ctx.moveTo(-w / 2 + 14, -h + 32); ctx.lineTo(0, -h - 4); ctx.lineTo(w / 2 - 14, -h + 32); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#6b4423'; ctx.beginPath(); ctx.roundRect(-11, -34, 22, 34, [9, 9, 0, 0]); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#bfe3ff'; ctx.beginPath(); ctx.arc(0, -64, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // Лопасти
        ctx.save();
        ctx.translate(0, -h + 26);
        ctx.rotate(t * 0.9);
        for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -62); ctx.stroke();
            ctx.fillStyle = '#fff6dc'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.rect(3, -60, 15, 42); ctx.fill(); ctx.stroke();
        }
        ctx.fillStyle = '#d23f36'; ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
    }

    drawShed(ctx, b) {
        const w = b.w, h = b.h, OUT = '#3f2a17';
        this.shadow(ctx, b.x, b.y, w * 0.58, 12);
        ctx.translate(b.x, b.y);
        const x = -w / 2, y = -h;
        ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
        ctx.fillStyle = '#b07a45'; ctx.beginPath(); ctx.rect(x, y + 32, w, h - 32); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(70,40,15,0.4)'; ctx.lineWidth = 1.5;
        for (let px = x + 14; px < -x; px += 14) { ctx.beginPath(); ctx.moveTo(px, y + 32); ctx.lineTo(px, 0); ctx.stroke(); }
        ctx.strokeStyle = OUT; ctx.lineWidth = 3;
        ctx.fillStyle = '#e0a73a';
        ctx.beginPath(); ctx.moveTo(x - 10, y + 36); ctx.lineTo(0, y + 2); ctx.lineTo(-x + 10, y + 36); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.rect(-24, -46, 48, 46); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f2c94c';
        ctx.beginPath(); ctx.arc(-8, -2, 15, Math.PI, 0); ctx.arc(10, -2, 11, Math.PI, 0); ctx.fill();
    }

    drawCoop(ctx, b) {
        const w = b.w, h = b.h, OUT = '#3f2a17';
        this.shadow(ctx, b.x, b.y, w * 0.58, 12);
        ctx.translate(b.x, b.y);
        const x = -w / 2, y = -h;
        ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
        ctx.fillStyle = '#e9c98a'; ctx.beginPath(); ctx.rect(x, y + 30, w, h - 30); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#4f9a8f';
        ctx.beginPath(); ctx.moveTo(x - 10, y + 34); ctx.lineTo(x + 20, y + 4); ctx.lineTo(-x - 20, y + 4); ctx.lineTo(-x + 10, y + 34); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.arc(0, -16, 15, Math.PI, 0); ctx.lineTo(15, 0); ctx.lineTo(-15, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        // Курица в окошке
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-34, -30, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.arc(-34, -40, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f4a100'; ctx.beginPath(); ctx.moveTo(-26, -30); ctx.lineTo(-20, -28); ctx.lineTo(-26, -26); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1f1320'; ctx.beginPath(); ctx.arc(-31, -32, 1.4, 0, Math.PI * 2); ctx.fill();
    }

    drawWell(ctx, p) {
        const OUT = '#3f3a36';
        this.shadow(ctx, p.x, p.y + 4, 28, 9);
        ctx.translate(p.x, p.y);
        ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(-17, -10); ctx.lineTo(-17, -46); ctx.moveTo(17, -10); ctx.lineTo(17, -46); ctx.stroke();
        ctx.fillStyle = '#9aa5b1'; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.roundRect(-22, -22, 44, 26, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2a6f97'; ctx.beginPath(); ctx.ellipse(0, -22, 19, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#c64b3a';
        ctx.beginPath(); ctx.moveTo(-28, -44); ctx.lineTo(0, -62); ctx.lineTo(28, -44); ctx.closePath(); ctx.fill(); ctx.stroke();
    }

    drawTree(ctx, p, t) {
        const s = this.season, OUT = 'rgba(30,50,30,0.55)';
        this.shadow(ctx, p.x, p.y + 2, 30, 10);
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#7a4d27'; ctx.strokeStyle = '#4a2f1a'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.roundRect(-7, -34, 14, 36, 4); ctx.fill(); ctx.stroke();
        ctx.rotate(Math.sin(t * 1.1 + p.seed) * 0.025);
        const sc = 0.9 + p.v * 0.1;
        ctx.scale(sc, sc);
        ctx.lineWidth = 3; ctx.strokeStyle = OUT;
        ctx.fillStyle = s.tree;
        ctx.beginPath(); ctx.arc(-18, -48, 24, 0, Math.PI * 2); ctx.arc(18, -48, 24, 0, Math.PI * 2); ctx.arc(0, -72, 28, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(-18, -48, 24, 0, Math.PI * 2); ctx.arc(18, -48, 24, 0, Math.PI * 2); ctx.arc(0, -72, 28, 0, Math.PI * 2); ctx.arc(0, -50, 22, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = s.tree2;
        ctx.beginPath(); ctx.arc(-10, -74, 15, 0, Math.PI * 2); ctx.arc(12, -56, 11, 0, Math.PI * 2); ctx.arc(-22, -52, 10, 0, Math.PI * 2); ctx.fill();
        if (p.apple && (s.id === 'summer' || s.id === 'autumn')) {
            ctx.fillStyle = '#e63946';
            for (const [ax, ay] of [[-20, -44], [16, -40], [2, -66], [-8, -84], [22, -62]]) { ctx.beginPath(); ctx.arc(ax, ay, 4.2, 0, Math.PI * 2); ctx.fill(); }
        }
    }

    drawHay(ctx, p) {
        this.shadow(ctx, p.x, p.y + 3, 30, 9);
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#f2c94c'; ctx.strokeStyle = '#8a6a1c'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-27, 4); ctx.quadraticCurveTo(-30, -44, 0, -46); ctx.quadraticCurveTo(30, -44, 27, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(138,106,28,0.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-14, -6); ctx.lineTo(-10, -30); ctx.moveTo(2, -4); ctx.lineTo(4, -36); ctx.moveTo(15, -8); ctx.lineTo(12, -28); ctx.stroke();
        if (this.season.id === 'winter') { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(0, -41, 17, 6, 0, 0, Math.PI * 2); ctx.fill(); }
    }

    drawBush(ctx, p, t) {
        const s = this.season;
        this.shadow(ctx, p.x, p.y + 2, 22, 7);
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.sin(t * 1.4 + p.seed) * 0.03);
        ctx.fillStyle = s.id === 'winter' ? '#cfe0ea' : (s.id === 'autumn' ? '#c9892f' : '#3f8f45');
        ctx.strokeStyle = 'rgba(30,50,30,0.5)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(-11, -9, 13, 0, Math.PI * 2); ctx.arc(11, -9, 13, 0, Math.PI * 2); ctx.arc(0, -19, 14, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(-11, -9, 13, 0, Math.PI * 2); ctx.arc(11, -9, 13, 0, Math.PI * 2); ctx.arc(0, -19, 14, 0, Math.PI * 2); ctx.fill();
        if (s.id !== 'winter') {
            ctx.fillStyle = p.v === 0 ? '#e63946' : '#7b5cd6';
            for (const [bx, by] of [[-9, -12], [6, -20], [12, -7], [-2, -5]]) { ctx.beginPath(); ctx.arc(bx, by, 2.6, 0, Math.PI * 2); ctx.fill(); }
        }
    }

    drawRock(ctx, p) {
        this.shadow(ctx, p.x, p.y + 2, 16, 5);
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#a3adb8'; ctx.strokeStyle = '#59626d'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(-14, 2); ctx.quadraticCurveTo(-15, -15, -3, -17); ctx.quadraticCurveTo(13, -18, 14, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-4, -11, 5, 3, -0.4, 0, Math.PI * 2); ctx.fill();
    }
}
