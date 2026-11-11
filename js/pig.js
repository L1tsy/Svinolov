'use strict';

/**
 * Свинья: ИИ (блуждание, паника, усталость, таран) и процедурная отрисовка
 */
class Pig {
    constructor(type, x, y, day = 1) {
        this.type = type;
        this.def = PIG_TYPES[type];
        const d = this.def;
        this.x = x; this.y = y;
        this.r = d.r;
        this.vx = 0; this.vy = 0;
        this.kx = 0; this.ky = 0;          // отбрасывание
        this.facing = Math.random() < 0.5 ? 1 : -1;
        this.anim = Math.random() * 10;
        this.t = Math.random() * 10;
        this.seed = Math.random() * 100;
        this.side = Math.random() < 0.5 ? 1 : -1;

        this.state = 'wander';
        this.stateT = 0;
        this.wT = U.rand(0.5, 2);
        this.idle = false;
        const a = Math.random() * Math.PI * 2;
        this.hx = Math.cos(a); this.hy = Math.sin(a);

        this.stam = d.stamina;
        this.tired = 0;
        this.frozen = 0;
        this.slow = 0;
        this.barkCd = 0;
        this.panicLevel = 0;
        this.alert = 0;
        this.squealCd = 0;
        this.mudT = 0;
        this.spawnPop = 0;
        this.hitFlash = 0;

        this.maxHp = d.hp ? (d.boss ? d.hp + Math.floor(day / 5) * 2 : d.hp) : 1;
        this.hp = this.maxHp;
        this.chargeCd = d.charger ? U.rand(1.5, 3) : 0;
        this.enraged = false;
        this.dodge = d.ninja ? 1 : 0;
        this.life = d.life || null;
        this.counts = !d.bonus;
        this.reward = d.boss ? d.reward + day * 2 : d.reward;

        this.caught = false;
        this.inBarn = false;
        this.gone = false;
        this.flyT = 0;
    }

    get active() { return !this.caught && !this.gone; }

    startBurst(angle, dur) {
        this.state = 'burst';
        this.dirX = Math.cos(angle); this.dirY = Math.sin(angle);
        this.burstDur = dur; this.stateT = dur;
        this.vx = this.dirX * 340; this.vy = this.dirY * 340;
    }

    catchTo(tx, ty) {
        this.caught = true;
        this.state = 'caught';
        this.sx = this.x; this.sy = this.y;
        this.tx = tx; this.ty = ty;
        this.flyT = 0;
        this.flyDur = U.clamp(Math.hypot(tx - this.x, ty - this.y) / 1100, 0.45, 0.85);
    }

    knock(fromX, fromY, power) {
        const dx = this.x - fromX, dy = this.y - fromY, l = Math.hypot(dx, dy) || 1;
        this.kx = (dx / l) * power; this.ky = (dy / l) * power;
    }

    update(dt, g) {
        const d = this.def, w = g.world;
        this.t += dt;
        if (this.hitFlash > 0) this.hitFlash -= dt;
        if (this.alert > 0) this.alert -= dt;
        if (this.squealCd > 0) this.squealCd -= dt;
        if (this.barkCd > 0) this.barkCd -= dt;

        if (this.caught) {
            this.flyT += dt / this.flyDur;
            if (this.flyT >= 1 && !this.inBarn) { this.inBarn = true; g.onPigArrived(this); }
            return;
        }
        if (this.gone) return;
        if (this.spawnPop < 1) this.spawnPop = Math.min(1, this.spawnPop + dt * 3.5);
        if (this.frozen > 0) { this.frozen -= dt; return; }
        if (this.slow > 0) this.slow -= dt;

        if (this.life !== null && this.state !== 'escape') {
            this.life -= dt;
            if (this.life <= 0) { this.beginEscape(w); g.onGoldFled(this); }
        }

        let tvx = 0, tvy = 0, accel = 6;
        const pl = g.player;
        const dpx = pl.x - this.x, dpy = pl.y - this.y, dPlayer = Math.hypot(dpx, dpy) || 1;
        let speedMul = (this.slow > 0 ? 0.5 : 1) * g.pigSpeedMul;
        let moving = true;

        switch (this.state) {
            case 'burst': {
                this.stateT -= dt;
                const k = Math.max(0.3, this.stateT / this.burstDur);
                tvx = this.dirX * 360 * k; tvy = this.dirY * 360 * k; accel = 9;
                if (this.stateT <= 0) { this.state = 'wander'; this.hx = this.dirX; this.hy = this.dirY; this.wT = U.rand(0.6, 1.6); }
                break;
            }
            case 'escape': {
                const dx = this.ex - this.x, dy = this.ey - this.y, l = Math.hypot(dx, dy) || 1;
                tvx = (dx / l) * d.panic * 1.25; tvy = (dy / l) * d.panic * 1.25; accel = 8;
                if (l < 30 || this.x < -40 || this.y < -40 || this.x > w.w + 40 || this.y > w.h + 40) { this.gone = true; g.onPigGone(this); }
                break;
            }
            case 'telegraph': {
                this.stateT -= dt;
                this.facing = dpx >= 0 ? 1 : -1;
                moving = false;
                if (this.stateT <= 0) {
                    this.state = 'charge'; this.stateT = 0.72;
                    this.dirX = dpx / dPlayer; this.dirY = dpy / dPlayer;
                    g.sfx.squeal();
                }
                break;
            }
            case 'charge': {
                this.stateT -= dt;
                const cs = d.chargeSpeed * (this.enraged ? 1.15 : 1);
                tvx = this.dirX * cs; tvy = this.dirY * cs; accel = 22; speedMul = 1;
                if (Math.random() < dt * 40) g.fx.dust(this.x - this.dirX * this.r, this.y + this.r * 0.6, 1);
                if (dPlayer < this.r + pl.r + 4 && g.hitPlayer(this)) { this.state = 'dizzy'; this.stateT = 0.9; this.vx *= 0.2; this.vy *= 0.2; }
                else if (this.stateT <= 0) { this.state = 'dizzy'; this.stateT = this.enraged ? 1.15 : 1.5; }
                break;
            }
            case 'dizzy': {
                this.stateT -= dt;
                moving = false;
                if (this.stateT <= 0) { this.state = 'wander'; this.chargeCd = d.chargeCd * (this.enraged ? 0.65 : 1); }
                break;
            }
            default: {
                // --- Свободное поведение ---
                let ax = 0, ay = 0, panic = 0;
                if (d.panicR > 0) {
                    for (const th of g.threats) {
                        const dx = this.x - th.x, dy = this.y - th.y, dd = Math.hypot(dx, dy) || 1, R = d.panicR * th.k;
                        if (dd < R) { const wg = 1 - dd / R; ax += (dx / dd) * wg; ay += (dy / dd) * wg; if (wg > panic) panic = wg; }
                    }
                }
                const lured = g.lureT > 0 && !d.charger && dPlayer < 560;

                if (d.charger) {
                    this.chargeCd -= dt;
                    if (this.chargeCd <= 0 && dPlayer < d.chargeRange && g.state === 'play' && pl.stun <= 0) {
                        this.state = 'telegraph'; this.stateT = this.enraged ? 0.5 : 0.75;
                        g.sfx.warn();
                        break;
                    }
                }

                if (lured) {
                    this.state = 'lured';
                    if (dPlayer > 44) { tvx = (dpx / dPlayer) * d.speed * 1.9; tvy = (dpy / dPlayer) * d.speed * 1.9; } else moving = false;
                    accel = 5;
                    this.stam = Math.min(d.stamina, this.stam + dt);
                } else if (panic > 0) {
                    if (this.state !== 'panic') {
                        this.alert = 0.5;
                        if (this.squealCd <= 0 && g.state === 'play') { g.sfx.oink(); this.squealCd = U.rand(2, 4); }
                    }
                    this.state = 'panic';
                    this.idle = false;
                    let l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l;
                    // Стены: отталкиваемся и скользим вдоль, чтобы не застревать в углах
                    const m = 115;
                    let wx = 0, wy = 0;
                    if (this.x < w.margin + m) wx += 1 - (this.x - w.margin) / m; else if (this.x > w.w - w.margin - m) wx -= 1 - (w.w - w.margin - this.x) / m;
                    if (this.y < w.margin + m) wy += 1 - (this.y - w.margin) / m; else if (this.y > w.h - w.margin - m) wy -= 1 - (w.h - w.margin - this.y) / m;
                    if (wx || wy) { ax += wx * 1.5 - wy * this.side * 1.3; ay += wy * 1.5 + wx * this.side * 1.3; }
                    const av = w.avoid(this.x, this.y, this.r + 34);
                    ax += av.x * 1.6; ay += av.y * 1.6;
                    if (d.erratic) { const j = Math.sin(this.t * 7 + this.seed) * 0.8, c = Math.cos(j), s = Math.sin(j), nx = ax * c - ay * s; ay = ax * s + ay * c; ax = nx; }
                    l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l;

                    // Усталость: долго в панике — выдыхается
                    if (this.tired > 0) { this.tired -= dt; if (this.tired <= 0) this.stam = d.stamina; }
                    else { this.stam -= dt; if (this.stam <= 0) { this.tired = 2.3; g.fx.text(this.x, this.y - this.r - 16, 'уфф…', { color: '#bfe3ff', size: 15, life: 0.8 }); } }
                    const v = d.panic * (this.tired > 0 ? 0.5 : 1);
                    tvx = ax * v; tvy = ay * v; accel = 7;

                    if (d.mud) {
                        this.mudT -= dt;
                        if (this.mudT <= 0) { w.addPuddle(this.x, this.y + this.r * 0.5, U.rand(30, 40), 10); this.mudT = 0.85; }
                    }
                    if (Math.random() < dt * 9) g.fx.dust(this.x - this.vx * 0.05, this.y + this.r * 0.6, 1, g.dustColor);
                } else {
                    this.state = 'wander';
                    if (this.tired > 0) this.tired -= dt;
                    this.stam = Math.min(d.stamina, this.stam + dt * 1.6);
                    this.wT -= dt;
                    if (this.wT <= 0) {
                        if (this.idle) { this.idle = false; this.pickHeading(w); this.wT = U.rand(1.4, 3.6); }
                        else if (Math.random() < 0.38) { this.idle = true; this.wT = U.rand(0.8, 2.4); }
                        else { this.pickHeading(w); this.wT = U.rand(1.4, 3.6); }
                    }
                    if (this.idle) moving = false;
                    else { tvx = this.hx * d.speed; tvy = this.hy * d.speed; }
                    accel = 4;
                }
                this.panicLevel = panic;
            }
        }

        tvx *= speedMul; tvy *= speedMul;
        if (!moving) { tvx = 0; tvy = 0; }
        const k = Math.min(1, accel * dt);
        this.vx += (tvx - this.vx) * k; this.vy += (tvy - this.vy) * k;
        this.x += (this.vx + this.kx) * dt; this.y += (this.vy + this.ky) * dt;
        const kd = Math.max(0, 1 - 6 * dt); this.kx *= kd; this.ky *= kd;

        const sp = Math.hypot(this.vx, this.vy);
        this.anim += dt * (4 + sp * 0.085);
        if (Math.abs(this.vx) > 12) this.facing = this.vx > 0 ? 1 : -1;

        if (this.state !== 'escape') {
            const hit = w.resolve(this, this.r * 0.8);
            if (hit) {
                if (this.state === 'wander') { this.pickHeading(w); }
                else if (this.state === 'charge') {
                    this.state = 'dizzy'; this.stateT = 1.9;
                    g.fx.addShake(9); g.fx.stars(this.x, this.y - this.r, 8); g.sfx.hit();
                    g.fx.text(this.x, this.y - this.r - 30, 'БАМ!', { color: '#ffffff', size: 26 });
                }
            }
        }
    }

    pickHeading(w) {
        let a = Math.random() * Math.PI * 2;
        // Держимся подальше от забора
        const cx = w.w / 2 - this.x, cy = w.h / 2 - this.y;
        const edge = Math.min(this.x, this.y, w.w - this.x, w.h - this.y);
        if (edge < 160) a = Math.atan2(cy, cx) + U.rand(-0.9, 0.9);
        this.hx = Math.cos(a); this.hy = Math.sin(a);
    }

    beginEscape(w) {
        this.state = 'escape';
        const dl = this.x, dr = w.w - this.x, dt = this.y, db = w.h - this.y, m = Math.min(dl, dr, dt, db);
        this.ex = this.x; this.ey = this.y;
        if (m === dl) this.ex = -60; else if (m === dr) this.ex = w.w + 60; else if (m === dt) this.ey = -60; else this.ey = w.h + 60;
    }

    /** Ниндзя исчезает в дыму */
    teleport(g) {
        this.dodge--;
        g.fx.smoke(this.x, this.y - 6, 16);
        const spot = g.world.freeSpot(30, g.player, 260, 480);
        this.x = spot.x; this.y = spot.y;
        this.vx = 0; this.vy = 0;
        this.spawnPop = 0;
        g.fx.smoke(this.x, this.y - 6, 12);
        this.stam = this.def.stamina;
        this.tired = 0;
    }

    /* ================= Отрисовка ================= */
    draw(ctx, g) {
        if (this.inBarn || this.gone) return;
        const d = this.def;
        let x = this.x, y = this.y, sc = d.scale, rot = 0, lift = 0;

        if (this.caught) {
            const e = Math.min(1, this.flyT), ee = e * e * (3 - 2 * e);
            x = U.lerp(this.sx, this.tx, ee); y = U.lerp(this.sy, this.ty, ee);
            lift = Math.sin(Math.PI * e) * 130;
            rot = e * Math.PI * 4 * this.facing;
            sc *= 1 - e * 0.45;
            ctx.fillStyle = `rgba(20,40,20,${0.2 * (1 - e)})`;
            ctx.beginPath(); ctx.ellipse(x, y + 8, 14 * sc, 5 * sc, 0, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.fillStyle = 'rgba(20,40,20,0.22)';
            ctx.beginPath(); ctx.ellipse(x, y + 13 * sc, 19 * sc, 7 * sc, 0, 0, Math.PI * 2); ctx.fill();
        }

        const speed = Math.hypot(this.vx, this.vy);
        const running = speed > 20 && !this.caught && this.frozen <= 0;
        const hop = running ? Math.abs(Math.sin(this.anim)) * (speed > 120 ? 4.5 : 2.2) : 0;
        const pop = this.spawnPop < 1 ? U.easeOutBack(this.spawnPop) : 1;

        ctx.save();
        ctx.translate(x, y - lift - hop * sc);
        let shakeX = 0;
        if (this.state === 'telegraph') shakeX = Math.sin(this.t * 70) * 2.5;
        if (this.state === 'dizzy') rot = Math.sin(this.t * 6) * 0.12;
        ctx.translate(shakeX, 0);
        ctx.rotate(rot);
        const squash = running ? 1 + Math.sin(this.anim * 2) * 0.05 : 1 + Math.sin(this.t * 2.2) * 0.02;
        ctx.scale(this.facing * sc * pop * (2 - squash), sc * pop * squash);

        this.drawBody(ctx, running, g);
        ctx.restore();

        if (this.caught) return;
        this.drawOverhead(ctx, x, y - hop * sc, sc);
    }

    drawBody(ctx, running, g) {
        const d = this.def;
        let body = d.body, dark = d.dark;
        if (this.hitFlash > 0) { body = '#ffffff'; dark = '#ffd0d0'; }
        if (this.enraged && this.hitFlash <= 0) { body = '#b5553c'; }
        const OUT = d.boss ? '#3a2214' : (d.ninja ? '#1c2026' : 'rgba(122,40,70,0.9)');
        const walk = running ? Math.sin(this.anim) * 5 : 0;
        const panic = this.state === 'panic' || this.state === 'burst' || this.state === 'escape';

        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        // Хвостик
        ctx.strokeStyle = dark; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-17, -3); ctx.bezierCurveTo(-25, -9, -27, 3, -21, 5); ctx.bezierCurveTo(-17, 6, -22, -1, -24, -3); ctx.stroke();
        // Ножки
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.roundRect(-13 - walk * 0.6, 7, 6, 10, 2); ctx.roundRect(-5 + walk * 0.6, 7, 6, 10, 2);
        ctx.roundRect(4 + walk * 0.8, 7, 6, 10, 2); ctx.roundRect(11 - walk * 0.8, 7, 6, 10, 2);
        ctx.fill();
        // Тело
        ctx.fillStyle = body; ctx.strokeStyle = OUT; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.ellipse(0, 0, 19, 14.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // Блик
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.beginPath(); ctx.ellipse(-4, -7, 9, 4, -0.2, 0, Math.PI * 2); ctx.fill();

        if (d.mud) {
            ctx.fillStyle = '#5c3d21';
            ctx.beginPath(); ctx.ellipse(-8, 2, 6, 4, 0.3, 0, Math.PI * 2); ctx.ellipse(3, -8, 5, 3, 0, 0, Math.PI * 2); ctx.ellipse(1, 8, 5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
        }
        if (d.boss) {
            // Щетина-ирокез
            ctx.fillStyle = '#2a170d';
            ctx.beginPath();
            for (let i = 0; i < 6; i++) { const bx = -12 + i * 5; ctx.moveTo(bx - 3, -12); ctx.lineTo(bx, -21 - (i % 2) * 2); ctx.lineTo(bx + 3, -12); }
            ctx.fill();
        }

        // Уши
        ctx.fillStyle = dark; ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
        const earW = panic ? -2 : Math.sin(this.t * 3 + this.seed) * 0.8;
        ctx.beginPath(); ctx.moveTo(4, -11); ctx.lineTo(8 + earW, -21); ctx.lineTo(12, -11); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(9, -10); ctx.lineTo(15 + earW, -19); ctx.lineTo(17, -8); ctx.closePath(); ctx.fill(); ctx.stroke();

        // Аксессуары
        if (this.type === 'runner') {
            ctx.strokeStyle = '#e63946'; ctx.lineWidth = 3.5;
            ctx.beginPath(); ctx.moveTo(1, -11.5); ctx.quadraticCurveTo(9, -14, 17, -8.5); ctx.stroke();
            ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(1, -11.5); ctx.lineTo(-6, -15 + Math.sin(this.anim) * 2); ctx.moveTo(1, -11.5); ctx.lineTo(-5, -9 + Math.cos(this.anim) * 2); ctx.stroke();
        }
        if (d.ninja) {
            ctx.strokeStyle = '#e63946'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(2, -9); ctx.quadraticCurveTo(10, -11, 18, -6); ctx.stroke();
            ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(2, -9); ctx.lineTo(-7, -13 + Math.sin(this.anim) * 2); ctx.stroke();
        }

        // Глаз
        const blink = (this.t + this.seed) % 3.7 < 0.1 && !panic;
        if (this.state === 'dizzy') {
            ctx.strokeStyle = '#1f1320'; ctx.lineWidth = 1.8;
            ctx.beginPath(); ctx.moveTo(8, -6.5); ctx.lineTo(13, -1.5); ctx.moveTo(13, -6.5); ctx.lineTo(8, -1.5); ctx.stroke();
        } else if (blink) {
            ctx.strokeStyle = '#1f1320'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(8, -4); ctx.lineTo(13, -4); ctx.stroke();
        } else {
            const er = panic ? 4.4 : 3.4;
            ctx.fillStyle = (d.boss && (this.state === 'charge' || this.state === 'telegraph' || this.enraged)) ? '#ffd6d6' : '#ffffff';
            ctx.beginPath(); ctx.arc(10.5, -4, er, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = (d.boss && (this.state === 'charge' || this.state === 'telegraph')) ? '#d00000' : '#1f1320';
            ctx.beginPath(); ctx.arc(11.6, -4, panic ? 1.5 : 2, 0, Math.PI * 2); ctx.fill();
            if (d.charger) { // сердитая бровь
                ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(6, -9.5); ctx.lineTo(14, -6.5); ctx.stroke();
            }
        }
        // Румянец
        if (!d.ninja && !d.boss) { ctx.fillStyle = 'rgba(255,90,130,0.35)'; ctx.beginPath(); ctx.arc(8, 3.5, 3.2, 0, Math.PI * 2); ctx.fill(); }

        // Пятачок
        ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : d.snout; ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.ellipse(18.5, 1.5, 5, 6.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(90,20,40,0.8)';
        ctx.beginPath(); ctx.ellipse(19, -0.8, 1, 1.5, 0, 0, Math.PI * 2); ctx.ellipse(19, 3.8, 1, 1.5, 0, 0, Math.PI * 2); ctx.fill();
        // Открытый рот в панике
        if (panic) { ctx.fillStyle = '#7a1f3a'; ctx.beginPath(); ctx.ellipse(13.5, 8, 2.6, 2.2, 0, 0, Math.PI * 2); ctx.fill(); }

        // Клыки
        if (d.charger) {
            ctx.fillStyle = '#fffbe6'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(13, 5); ctx.lineTo(17, -1); ctx.lineTo(17.5, 6.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        // Корона кабана
        if (this.type === 'big') {
            ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#a66a00'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(-6, -14); ctx.lineTo(-7, -21); ctx.lineTo(-3, -17); ctx.lineTo(0, -23); ctx.lineTo(3, -17); ctx.lineTo(7, -21); ctx.lineTo(6, -14); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        // Золотые искорки
        if (d.gold) {
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 3; i++) {
                const ph = (this.t * 1.6 + i / 3) % 1, a = this.seed + i * 2.1;
                ctx.globalAlpha = Math.sin(ph * Math.PI);
                Fx.starPath(ctx, Math.cos(a) * 15, Math.sin(a) * 10 - 2, 3.5 + ph * 2, this.t);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
        // Заморозка
        if (this.frozen > 0) {
            ctx.fillStyle = 'rgba(160,230,255,0.55)'; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.roundRect(-23, -22, 48, 42, 8); ctx.fill(); ctx.stroke();
        }
    }

    drawOverhead(ctx, x, y, sc) {
        const top = y - 24 * sc;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (this.state === 'telegraph') {
            const k = 1 + Math.sin(this.t * 30) * 0.15;
            ctx.font = `900 ${Math.round(30 * k)}px "Nunito","Segoe UI",sans-serif`;
            ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff'; ctx.strokeText('!', x, top - 12);
            ctx.fillStyle = '#e11d48'; ctx.fillText('!', x, top - 12);
        } else if (this.state === 'dizzy') {
            ctx.fillStyle = '#ffe066';
            for (let i = 0; i < 3; i++) {
                const a = this.t * 5 + (i * Math.PI * 2) / 3;
                Fx.starPath(ctx, x + Math.cos(a) * 15 * sc * 0.7, top - 6 + Math.sin(a) * 5, 5, a);
                ctx.fill();
            }
        } else if (this.alert > 0) {
            const k = U.easeOutBack(Math.min(1, (0.5 - this.alert) / 0.15));
            ctx.font = `900 ${Math.round(22 * k)}px "Nunito","Segoe UI",sans-serif`;
            ctx.lineWidth = 5; ctx.strokeStyle = '#3b2212'; ctx.strokeText('!', x, top - 8);
            ctx.fillStyle = '#ffe066'; ctx.fillText('!', x, top - 8);
        } else if (this.state === 'lured') {
            ctx.font = '16px sans-serif';
            ctx.fillText('💕', x, top - 8 + Math.sin(this.t * 6) * 2);
        } else if (this.tired > 0 && this.state === 'panic') {
            ctx.fillStyle = '#8fd3ff';
            for (let i = 0; i < 2; i++) {
                const ph = (this.t * 2.2 + i * 0.5) % 1;
                ctx.globalAlpha = 1 - ph;
                ctx.beginPath(); ctx.arc(x + (i ? 9 : -9) * sc, top - 2 - ph * 14, 2.6, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1;
        } else if (this.slow > 0) {
            ctx.font = '13px sans-serif'; ctx.fillText('💫', x, top - 6);
        }

        // Полоска здоровья кабана
        if (this.maxHp > 1 && !this.def.boss) {
            const w = 38, bx = x - w / 2, by = y + 22 * sc;
            ctx.fillStyle = 'rgba(40,20,10,0.75)'; ctx.beginPath(); ctx.roundRect(bx - 2, by - 2, w + 4, 9, 4); ctx.fill();
            ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.roundRect(bx, by, Math.max(0, w * (this.hp / this.maxHp)), 5, 2.5); ctx.fill();
        }
        // Таймер золотой свиньи
        if (this.life !== null && this.state !== 'escape') {
            const k = U.clamp(this.life / this.def.life, 0, 1);
            ctx.strokeStyle = 'rgba(40,20,10,0.5)'; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.arc(x, top - 12, 7, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = k < 0.3 ? '#ff4d6d' : '#ffe066'; ctx.lineWidth = 3.5;
            ctx.beginPath(); ctx.arc(x, top - 12, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
        }
    }
}
