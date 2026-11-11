'use strict';

/**
 * Мир фермы: генерация, препятствия, отрисовка земли и построек
 */
class World {
    constructor(tier, seasonIdx) {
        this.tier = tier;
        this.seasonIdx = seasonIdx;
        this.season = SEASONS[seasonIdx];
        [this.w, this.h] = CONFIG.WORLD_SIZES[tier];
        this.margin = 36;
        this.rects = [];
        this.circles = [];
        this.props = [];
        this.paths = [];
        this.puddles = [];
        this.time = 0;
        this.barnOpen = 0;
        this.barnBounce = 0;
        this.build();
        this.renderGround();
    }

    /* ================= Генерация ================= */
    build() {
        const W = this.w, H = this.h, rnd = U.seeded(4242 + this.tier * 97);
        const addBuilding = (type, bx, by, w, h) => {
            const b = { type, x: bx, y: by, w, h, solid: true };
            this.props.push(b);
            this.rects.push({ x: bx - w / 2 + 5, y: by - h * 0.68, w: w - 10, h: h * 0.68 - 2 });
            return b;
        };

        this.barn = addBuilding('barn', W / 2, H / 2 + 50, 210, 162);
        this.door = { x: W / 2, y: this.barn.y + 10 };
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

        // Мелкие декорации на земле (рисуются один раз)
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

    /* ================= Коллизии ================= */
    resolve(e, rad, clampBounds = true) {
        let hit = false;
        for (const r of this.rects) {
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

    /** Вектор отталкивания от ближайших препятствий (для ИИ) */
    avoid(x, y, range) {
        let ax = 0, ay = 0;
        for (const r of this.rects) {
            const nx = U.clamp(x, r.x, r.x + r.w), ny = U.clamp(y, r.y, r.y + r.h);
            const dx = x - nx, dy = y - ny, dd = Math.hypot(dx, dy);
            if (dd < range && dd > 0.01) { const k = (1 - dd / range); ax += (dx / dd) * k; ay += (dy / dd) * k; }
        }
        for (const c of this.circles) {
            const dx = x - c.x, dy = (y - c.y) / (c.sy || 1), dd = Math.hypot(dx, dy) - c.r;
            if (dd < range) { const l = Math.hypot(dx, dy) || 1, k = (1 - Math.max(0, dd) / range); ax += (dx / l) * k; ay += (dy / l) * k; }
        }
        return { x: ax, y: ay };
    }

    isFree(x, y, rad) {
        if (x < this.margin + rad || x > this.w - this.margin - rad || y < this.margin + rad + 8 || y > this.h - this.margin - rad) return false;
        for (const r of this.rects) {
            const nx = U.clamp(x, r.x, r.x + r.w), ny = U.clamp(y, r.y, r.y + r.h);
            if (Math.hypot(x - nx, y - ny) < rad) return false;
        }
        for (const c of this.circles) if (Math.hypot(x - c.x, (y - c.y) / (c.sy || 1)) < c.r + rad) return false;
        return true;
    }

    freeSpot(rad = 30, near = null, minD = 0, maxD = 1e9) {
        for (let i = 0; i < 80; i++) {
            const x = U.rand(this.margin + rad, this.w - this.margin - rad);
            const y = U.rand(this.margin + rad + 10, this.h - this.margin - rad);
            if (!this.isFree(x, y, rad)) continue;
            if (near) { const dd = Math.hypot(x - near.x, y - near.y); if (dd < minD || dd > maxD) continue; }
            return { x, y };
        }
        return { x: this.door.x + U.rand(-200, 200), y: this.door.y + U.rand(90, 220) };
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
        if (this.barnOpen > 0) this.barnOpen = Math.max(0, this.barnOpen - dt);
        if (this.barnBounce > 0) this.barnBounce = Math.max(0, this.barnBounce - dt * 4);
        for (let i = this.puddles.length - 1; i >= 0; i--) {
            const p = this.puddles[i];
            p.life -= dt;
            if (p.life <= 0) this.puddles.splice(i, 1);
        }
    }

    /* ================= Земля (рисуется один раз в буфер) ================= */
    renderGround() {
        const W = this.w, H = this.h, s = this.season;
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const ctx = cv.getContext('2d');
        const rnd = U.seeded(99 + this.tier * 31);

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
        // Утоптанная площадка у ворот амбара
        ctx.fillStyle = s.pathEdge;
        ctx.beginPath(); ctx.ellipse(this.door.x, this.door.y + 14, 92, 40, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = s.path;
        ctx.beginPath(); ctx.ellipse(this.door.x, this.door.y + 14, 86, 35, 0, 0, Math.PI * 2); ctx.fill();

        // Пруд
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

        // Живая изгородь и забор по периметру
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

    drawGround(ctx, vx, vy, vw, vh) {
        const sx = Math.max(0, Math.floor(vx)), sy = Math.max(0, Math.floor(vy));
        const sw = Math.min(this.w - sx, Math.ceil(vw) + 2), sh = Math.min(this.h - sy, Math.ceil(vh) + 2);
        if (sw > 0 && sh > 0) ctx.drawImage(this.ground, sx, sy, sw, sh, sx, sy, sw, sh);

        // Блики на воде
        const p = this.pond, t = this.time;
        if (this.season.id !== 'winter') {
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
        // Постройка становится полупрозрачной, если фермер зашёл за неё
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
        const bn = this.barnBounce;
        ctx.scale(1 + bn * 0.05, 1 - bn * 0.06);
        const x = -w / 2, y = -h;

        // Фасад
        ctx.fillStyle = '#d23f36';
        ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x, 0); ctx.lineTo(x, y + 62); ctx.lineTo(x + 26, y + 28); ctx.lineTo(0, y + 6);
        ctx.lineTo(-x - 26, y + 28); ctx.lineTo(-x, y + 62); ctx.lineTo(-x, 0); ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Доски
        ctx.strokeStyle = 'rgba(120,20,20,0.45)'; ctx.lineWidth = 1.5;
        for (let px = x + 15; px < -x; px += 15) { ctx.beginPath(); ctx.moveTo(px, y + 62); ctx.lineTo(px, -1); ctx.stroke(); }
        // Крыша
        ctx.strokeStyle = OUT; ctx.lineWidth = 17; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - 10, y + 66); ctx.lineTo(x + 22, y + 26); ctx.lineTo(0, y + 2); ctx.lineTo(-x - 22, y + 26); ctx.lineTo(-x + 10, y + 66); ctx.stroke();
        ctx.strokeStyle = '#7b4a2b'; ctx.lineWidth = 11;
        ctx.beginPath(); ctx.moveTo(x - 10, y + 66); ctx.lineTo(x + 22, y + 26); ctx.lineTo(0, y + 2); ctx.lineTo(-x - 22, y + 26); ctx.lineTo(-x + 10, y + 66); ctx.stroke();
        if (this.season.id === 'winter') {
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(x + 22, y + 22); ctx.lineTo(0, y - 1); ctx.lineTo(-x - 22, y + 22); ctx.stroke();
        }

        // Чердачное окно со свинкой
        ctx.fillStyle = '#2b1a3a'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, y + 44, 15, Math.PI, 0); ctx.lineTo(15, y + 56); ctx.lineTo(-15, y + 56); ctx.closePath(); ctx.fill(); ctx.stroke();
        const peek = Math.sin(this.time * 1.3) * 2;
        ctx.fillStyle = '#fbb6d4'; ctx.beginPath(); ctx.arc(0, y + 51 + peek, 8.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f4729f'; ctx.beginPath(); ctx.ellipse(0, y + 53 + peek, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1f1320';
        const blink = (this.time % 3.4) < 0.12 ? 0.3 : 1.3;
        ctx.beginPath(); ctx.ellipse(-3.5, y + 48.5 + peek, 1.2, blink, 0, 0, Math.PI * 2); ctx.ellipse(3.5, y + 48.5 + peek, 1.2, blink, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d23f36'; ctx.fillRect(-16, y + 56, 32, 5);

        // Ворота
        const dw = 64, dh = 66;
        ctx.fillStyle = '#1d0f0a';
        ctx.fillRect(-dw / 2, -dh, dw, dh);
        const open = Math.min(1, this.barnOpen * 3);
        const leaf = (dir) => {
            ctx.save();
            ctx.translate(dir * dw / 2, 0);
            ctx.scale(dir * (1 - open * 0.82), 1);
            ctx.fillStyle = '#b3342c'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.rect(-dw / 2, -dh, dw / 2, dh); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-dw / 2, -dh); ctx.lineTo(0, 0); ctx.moveTo(0, -dh); ctx.lineTo(-dw / 2, 0); ctx.stroke();
            ctx.restore();
        };
        leaf(1); leaf(-1);
        ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(-dw / 2, -dh, dw, dh);

        // Табличка-счётчик
        if (info) {
            ctx.fillStyle = '#fff3d6'; ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.roundRect(-44, -dh - 26, 88, 21, 6); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#5b3a1e'; ctx.font = '900 13px "Nunito","Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(info, 0, -dh - 15);
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
