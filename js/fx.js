'use strict';

/**
 * Частицы, всплывающие надписи, тряска экрана, летящие в кошелёк монеты
 */
class Fx {
    constructor() {
        this.parts = [];
        this.texts = [];
        this.coins = [];     // экранные монеты, летящие к счётчику
        this.shake = 0;
        this.flash = 0;
        this.flashColor = '#ffffff';
    }

    clear() {
        this.parts.length = 0;
        this.texts.length = 0;
        this.coins.length = 0;
        this.shake = 0;
    }

    addShake(v) { this.shake = Math.min(22, Math.max(this.shake, v)); }

    addFlash(color = '#ffffff', a = 0.35) { this.flash = a; this.flashColor = color; }

    spawn(p) {
        if (this.parts.length > 900) return;
        p.max = p.life;
        p.rot = p.rot || 0;
        this.parts.push(p);
    }

    burst(x, y, n, o = {}) {
        for (let i = 0; i < n; i++) {
            const a = (o.angle === undefined ? Math.random() * Math.PI * 2 : o.angle + U.rand(-(o.spread || 0.5), o.spread || 0.5));
            const sp = U.rand(o.speedMin || 40, o.speed || 160);
            this.spawn({
                x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 0),
                life: U.rand(o.lifeMin || 0.3, o.life || 0.7), size: U.rand(o.sizeMin || 2, o.size || 5),
                color: Array.isArray(o.color) ? U.pick(o.color) : (o.color || '#ffffff'),
                type: o.type || 'circle', grav: o.grav || 0, drag: o.drag === undefined ? 2.5 : o.drag,
                vr: U.rand(-8, 8), fade: o.fade !== false, shrink: o.shrink !== false
            });
        }
    }

    dust(x, y, n = 1, color = 'rgba(255,255,255,0.55)') {
        for (let i = 0; i < n; i++) {
            this.spawn({
                x: x + U.rand(-5, 5), y: y + U.rand(-2, 2), vx: U.rand(-22, 22), vy: U.rand(-28, -6),
                life: U.rand(0.3, 0.55), size: U.rand(3, 6.5), color, type: 'circle', grav: 0, drag: 2, fade: true, shrink: false, grow: 9
            });
        }
    }

    stars(x, y, n = 8, color = ['#ffe066', '#ffffff', '#ffb703']) {
        this.burst(x, y, n, { type: 'star', color, speed: 260, speedMin: 90, life: 0.65, size: 8, sizeMin: 4, drag: 3 });
    }

    ring(x, y, r, color = '#ffffff', life = 0.35, width = 4) {
        this.spawn({ x, y, vx: 0, vy: 0, life, size: r, color, type: 'ring', width, drag: 0, fade: true });
    }

    smoke(x, y, n = 14, color = ['#e5e7eb', '#cbd5e1', '#f8fafc']) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, sp = U.rand(20, 110);
            this.spawn({
                x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: U.rand(0.45, 0.9), size: U.rand(8, 16),
                color: U.pick(color), type: 'circle', drag: 3, fade: true, shrink: false, grow: 14
            });
        }
    }

    confetti(x, y, n = 40) {
        this.burst(x, y, n, {
            type: 'rect', color: ['#ff5d8f', '#ffd23f', '#4cc9f0', '#80ed99', '#c77dff', '#ff9f1c'],
            speed: 520, speedMin: 160, life: 1.7, lifeMin: 0.9, size: 8, sizeMin: 4, grav: 700, drag: 1.2, up: 260, shrink: false
        });
    }

    text(x, y, str, o = {}) {
        this.texts.push({
            x, y, str, color: o.color || '#ffe066', size: o.size || 22, life: o.life || 1.0, max: o.life || 1.0,
            vy: o.vy === undefined ? -55 : o.vy, stroke: o.stroke || '#3b2212', screen: !!o.screen
        });
    }

    /** Монетки, летящие из точки на экране в счётчик */
    coinFly(sx, sy, n, tx, ty) {
        n = Math.min(n, 10);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, sp = U.rand(120, 300);
            this.coins.push({ x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, t: -i * 0.035, tx, ty, done: false });
        }
    }

    update(dt, realDt) {
        if (this.shake > 0) this.shake = Math.max(0, this.shake - realDt * 38);
        if (this.flash > 0) this.flash = Math.max(0, this.flash - realDt * 1.6);

        for (let i = this.parts.length - 1; i >= 0; i--) {
            const p = this.parts[i];
            p.life -= dt;
            if (p.life <= 0) { this.parts[i] = this.parts[this.parts.length - 1]; this.parts.pop(); continue; }
            if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
            if (p.grav) p.vy += p.grav * dt;
            if (p.sway) p.vx += Math.sin(p.life * 3 + p.sway) * 30 * dt;
            p.x += p.vx * dt; p.y += p.vy * dt;
            if (p.vr) p.rot += p.vr * dt;
            if (p.grow) p.size += p.grow * dt;
        }

        for (let i = this.texts.length - 1; i >= 0; i--) {
            const t = this.texts[i];
            t.life -= realDt;
            t.y += t.vy * realDt;
            t.vy *= Math.max(0, 1 - 1.6 * realDt);
            if (t.life <= 0) this.texts.splice(i, 1);
        }
    }

    /** @returns {number} сколько монет долетело до счётчика в этом кадре */
    updateCoins(realDt) {
        let arrived = 0;
        for (let i = this.coins.length - 1; i >= 0; i--) {
            const c = this.coins[i];
            c.t += realDt;
            if (c.t < 0) continue;
            if (c.t < 0.22) {
                c.x += c.vx * realDt; c.y += c.vy * realDt;
                c.vx *= 0.92; c.vy *= 0.92;
            } else {
                const k = Math.min(1, (c.t - 0.22) * 3.2);
                const pull = 6 + k * 22;
                c.x += (c.tx - c.x) * Math.min(1, pull * realDt);
                c.y += (c.ty - c.y) * Math.min(1, pull * realDt);
                if (Math.hypot(c.tx - c.x, c.ty - c.y) < 16 || c.t > 1.4) {
                    this.coins.splice(i, 1);
                    arrived++;
                }
            }
        }
        return arrived;
    }

    drawWorld(ctx) {
        for (const p of this.parts) {
            const k = p.life / p.max;
            ctx.globalAlpha = p.fade ? Math.min(1, k * 1.6) : 1;
            const s = p.shrink ? p.size * (0.35 + 0.65 * k) : p.size;
            ctx.fillStyle = p.color;
            switch (p.type) {
                case 'star':
                    Fx.starPath(ctx, p.x, p.y, s, p.rot);
                    ctx.fill();
                    break;
                case 'rect':
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rot);
                    ctx.fillRect(-s / 2, -s / 3, s, s * 0.66);
                    ctx.restore();
                    break;
                case 'ring':
                    ctx.strokeStyle = p.color;
                    ctx.lineWidth = p.width * k;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size * (1 + (1 - k) * 0.35), 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                case 'leaf':
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rot);
                    ctx.beginPath();
                    ctx.ellipse(0, 0, s, s * 0.5, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                    break;
                default:
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, Math.max(0.5, s), 0, Math.PI * 2);
                    ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }

    drawTexts(ctx, screen) {
        for (const t of this.texts) {
            if (t.screen !== screen) continue;
            const k = t.life / t.max;
            const age = t.max - t.life;
            const pop = age < 0.14 ? U.easeOutBack(age / 0.14) : 1;
            ctx.save();
            ctx.globalAlpha = Math.min(1, k * 2.4);
            ctx.translate(t.x, t.y);
            ctx.scale(pop, pop);
            ctx.font = `900 ${t.size}px "Nunito", "Segoe UI", system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineJoin = 'round';
            ctx.lineWidth = Math.max(4, t.size * 0.24);
            ctx.strokeStyle = t.stroke;
            ctx.strokeText(t.str, 0, 0);
            ctx.fillStyle = t.color;
            ctx.fillText(t.str, 0, 0);
            ctx.restore();
        }
    }

    drawCoins(ctx) {
        for (const c of this.coins) {
            if (c.t < 0) continue;
            ctx.fillStyle = '#b45309';
            ctx.beginPath(); ctx.arc(c.x, c.y + 1.5, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath(); ctx.arc(c.x, c.y, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fde68a';
            ctx.beginPath(); ctx.arc(c.x - 2, c.y - 2, 3.2, 0, Math.PI * 2); ctx.fill();
        }
    }

    static starPath(ctx, x, y, r, rot = 0) {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
            const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
            const rr = i % 2 === 0 ? r : r * 0.45;
            const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
    }
}
