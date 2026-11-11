'use strict';

/**
 * Общая отрисовка человечка-фермера (игрок и напарники)
 */
function drawFarmer(ctx, o) {
    const OUT = '#3b2212';
    ctx.save();
    ctx.translate(o.x, o.y);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;

    // Тень
    ctx.fillStyle = 'rgba(20,40,20,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 17, 16, 6.5, 0, 0, Math.PI * 2); ctx.fill();

    const bob = o.moving ? Math.abs(Math.sin(o.walk)) * 3 : Math.sin(o.t * 2.4) * 0.8;
    ctx.translate(0, -bob);
    if (o.stun > 0) ctx.rotate(Math.sin(o.t * 22) * 0.16);
    else if (o.dashing) ctx.rotate(0.28 * o.facing);
    else if (o.moving) ctx.rotate(0.06 * o.facing);
    ctx.scale(o.facing, 1);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    // Ноги
    const leg = o.moving ? Math.sin(o.walk) * 6 : 0;
    ctx.fillStyle = '#4a2f1a'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-9 + leg, 13 + bob * 0.6, 8, 8, 3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(1 - leg, 13 + bob * 0.6, 8, 8, 3); ctx.fill(); ctx.stroke();

    // Туловище: рубашка и комбинезон
    ctx.fillStyle = o.shirt || '#f4f1e8'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.roundRect(-12, -8, 24, 24, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = o.suit;
    ctx.beginPath(); ctx.roundRect(-12, 0, 24, 16, [3, 3, 7, 7]); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-7, -6, 14, 9, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(-5, -2.5, 1.5, 0, Math.PI * 2); ctx.arc(5, -2.5, 1.5, 0, Math.PI * 2); ctx.fill();

    // Голова
    ctx.fillStyle = o.skin || '#ffd9b0'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(0, -17, 10.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (o.stun > 0) {
        ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(1.5, -20.5); ctx.lineTo(6.5, -15.5); ctx.moveTo(6.5, -20.5); ctx.lineTo(1.5, -15.5); ctx.stroke();
    } else {
        ctx.fillStyle = OUT;
        ctx.beginPath(); ctx.arc(4.2, -18, 1.9, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#b5522b'; ctx.lineWidth = 1.7;
        ctx.beginPath(); ctx.arc(3.5, -14, 3.6, 0.15, Math.PI * 0.8); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,110,110,0.4)';
    ctx.beginPath(); ctx.arc(-1, -13.5, 2.6, 0, Math.PI * 2); ctx.fill();

    drawHat(ctx, o.hat || 'straw', o.hatColor);

    // Рука с сачком
    ctx.save();
    ctx.translate(8, -1);
    let ang = -0.55 + (o.moving ? Math.sin(o.walk) * 0.12 : 0);
    if (o.swingK >= 0) ang = -2.1 + U.easeOut(o.swingK) * 3.2;
    ctx.rotate(ang);
    ctx.strokeStyle = OUT; ctx.lineWidth = 5.5;
    ctx.beginPath(); ctx.moveTo(-2, 2); ctx.lineTo(22, -6); ctx.stroke();
    ctx.strokeStyle = '#a9743f'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-2, 2); ctx.lineTo(22, -6); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.strokeStyle = OUT; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.ellipse(31, -9, 10, 13, 0.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = o.netColor || '#e8eef5'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -1; i <= 1; i++) { ctx.moveTo(31 + i * 5, -21); ctx.lineTo(31 + i * 5, 3); ctx.moveTo(22, -9 + i * 6); ctx.lineTo(40, -9 + i * 6); }
    ctx.stroke();
    ctx.fillStyle = o.skin || '#ffd9b0'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(0, 1, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();

    ctx.restore();

    // Звёздочки оглушения
    if (o.stun > 0) {
        ctx.fillStyle = '#ffe066';
        for (let i = 0; i < 3; i++) {
            const a = o.t * 7 + (i * Math.PI * 2) / 3;
            Fx.starPath(ctx, o.x + Math.cos(a) * 16, o.y - 40 + Math.sin(a) * 5, 5, a);
            ctx.fill();
        }
    }
}

function drawHat(ctx, id, color) {
    const OUT = '#3b2212';
    ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.lineJoin = 'round';
    switch (id) {
        case 'cap':
            ctx.fillStyle = color || '#2f6fed';
            ctx.beginPath(); ctx.arc(0, -21, 10.8, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.roundRect(3, -24, 15, 4.5, 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, -31.5, 2, 0, Math.PI * 2); ctx.fill();
            break;
        case 'cowboy':
            ctx.fillStyle = '#8a5a34';
            ctx.beginPath(); ctx.moveTo(-20, -26); ctx.quadraticCurveTo(0, -17, 20, -26); ctx.quadraticCurveTo(0, -22, -20, -26); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-9, -24); ctx.lineTo(-8, -35); ctx.quadraticCurveTo(0, -31, 8, -35); ctx.lineTo(9, -24); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#ffd23f'; ctx.fillRect(-8.5, -27, 17, 2.6);
            break;
        case 'chef':
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(-7, -35, 7, 0, Math.PI * 2); ctx.arc(7, -35, 7, 0, Math.PI * 2); ctx.arc(0, -39, 8, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(-7, -35, 7, 0, Math.PI * 2); ctx.arc(7, -35, 7, 0, Math.PI * 2); ctx.arc(0, -39, 8, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.roundRect(-9, -33, 18, 10, 2); ctx.fill(); ctx.stroke();
            break;
        case 'viking':
            ctx.fillStyle = '#fff7df';
            ctx.beginPath(); ctx.moveTo(-9, -26); ctx.quadraticCurveTo(-20, -28, -17, -40); ctx.quadraticCurveTo(-13, -31, -7, -30); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(9, -26); ctx.quadraticCurveTo(20, -28, 17, -40); ctx.quadraticCurveTo(13, -31, 7, -30); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#aab4bf';
            ctx.beginPath(); ctx.arc(0, -22, 11, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.rect(-11, -24.5, 22, 3.5); ctx.fill(); ctx.stroke();
            break;
        case 'pig':
            ctx.fillStyle = '#ff9ec4';
            ctx.beginPath(); ctx.moveTo(-10, -24); ctx.lineTo(-9, -37); ctx.lineTo(-1, -27); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(10, -24); ctx.lineTo(9, -37); ctx.lineTo(1, -27); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = '#f4729f'; ctx.lineWidth = 3.5;
            ctx.beginPath(); ctx.arc(0, -17, 11, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
            break;
        case 'crown':
            ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#a66a00';
            ctx.beginPath(); ctx.moveTo(-10, -24); ctx.lineTo(-12, -37); ctx.lineTo(-5, -30); ctx.lineTo(0, -40); ctx.lineTo(5, -30); ctx.lineTo(12, -37); ctx.lineTo(10, -24); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.arc(0, -29, 2.4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#4cc9f0'; ctx.beginPath(); ctx.arc(-6.5, -27, 1.7, 0, Math.PI * 2); ctx.arc(6.5, -27, 1.7, 0, Math.PI * 2); ctx.fill();
            break;
        default: // соломенная
            ctx.fillStyle = color || '#f2c94c';
            ctx.beginPath(); ctx.roundRect(-9, -34, 18, 11, [5, 5, 0, 0]); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#e63946'; ctx.fillRect(-8.6, -27, 17.2, 3);
            ctx.fillStyle = color || '#f2c94c';
            ctx.beginPath(); ctx.ellipse(0, -23.5, 18.5, 4.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
}

/**
 * Игрок-фермер
 */
class Player {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.r = CONFIG.PLAYER_RADIUS;
        this.vx = 0; this.vy = 0;
        this.speed = CONFIG.PLAYER_SPEED;
        this.catchRadius = CONFIG.CATCH_RADIUS;
        this.swingCd = CONFIG.SWING_COOLDOWN;
        this.dashCd = CONFIG.DASH_COOLDOWN;

        this.cd = 0; this.cdMax = 1;
        this.dashT = 0; this.dashCdT = 0;
        this.dashX = 1; this.dashY = 0;
        this.stun = 0;
        this.invuln = 0;
        this.facing = 1;
        this.aimX = 1; this.aimY = 0;
        this.walk = 0;
        this.moving = false;
        this.swingT = 0; this.swingDur = 0.24;
        this.t = 0;
        this.hat = 'straw';
        this.trail = [];
        this.trailT = 0;
        this.inMud = false;
        this.stepT = 0;
    }

    canSwing() { return this.cd <= 0 && this.stun <= 0; }

    swing(missed) {
        this.swingT = this.swingDur;
        this.cdMax = this.swingCd * (missed ? CONFIG.SWING_MISS_FACTOR : 1);
        this.cd = this.cdMax;
    }

    startDash(ix, iy) {
        if (this.dashCdT > 0 || this.stun > 0) return false;
        const l = Math.hypot(ix, iy);
        if (l > 0.2) { this.dashX = ix / l; this.dashY = iy / l; } else { this.dashX = this.aimX; this.dashY = this.aimY; }
        this.dashT = CONFIG.DASH_TIME;
        this.dashCdT = this.dashCd;
        this.invuln = CONFIG.DASH_TIME + 0.15;
        return true;
    }

    update(dt, g, ix, iy) {
        this.t += dt;
        if (this.cd > 0) this.cd -= dt;
        if (this.dashCdT > 0) this.dashCdT -= dt;
        if (this.swingT > 0) this.swingT -= dt;
        if (this.invuln > 0) this.invuln -= dt;
        for (let i = this.trail.length - 1; i >= 0; i--) { this.trail[i].life -= dt; if (this.trail[i].life <= 0) this.trail.splice(i, 1); }

        const w = g.world;
        this.inMud = this.dashT <= 0 && w.inMud(this.x, this.y + 10);

        if (this.stun > 0) {
            this.stun -= dt;
            this.vx *= Math.max(0, 1 - 5 * dt); this.vy *= Math.max(0, 1 - 5 * dt);
            this.moving = false;
        } else if (this.dashT > 0) {
            this.dashT -= dt;
            this.vx = this.dashX * CONFIG.DASH_SPEED; this.vy = this.dashY * CONFIG.DASH_SPEED;
            this.moving = true;
            this.trailT -= dt;
            if (this.trailT <= 0) { this.trail.push({ x: this.x, y: this.y, life: 0.26, facing: this.facing, walk: this.walk }); this.trailT = 0.028; }
            if (Math.random() < dt * 60) g.fx.dust(this.x, this.y + 14, 1, g.dustColor);
        } else {
            let l = Math.hypot(ix, iy);
            if (l > 1) { ix /= l; iy /= l; l = 1; }
            let sp = this.speed * (g.buffs.speed > 0 ? 1.45 : 1) * (this.inMud ? 0.5 : 1);
            const k = Math.min(1, 16 * dt);
            this.vx += (ix * sp - this.vx) * k; this.vy += (iy * sp - this.vy) * k;
            this.moving = l > 0.12;
            if (this.moving) {
                this.aimX = ix / l; this.aimY = iy / l;
                this.stepT -= dt;
                if (this.stepT <= 0) {
                    this.stepT = this.inMud ? 0.14 : 0.2;
                    g.fx.dust(this.x, this.y + 16, 1, this.inMud ? 'rgba(92,61,33,0.8)' : g.dustColor);
                }
            }
        }

        this.x += this.vx * dt; this.y += this.vy * dt;
        if (this.moving) this.walk += dt * (this.dashT > 0 ? 26 : 13);
        if (Math.abs(this.vx) > 20) this.facing = this.vx > 0 ? 1 : -1;
        w.resolve(this, this.r);
    }

    draw(ctx, g) {
        const R = g.reach;
        // Зона действия сачка
        ctx.save();
        const ready = this.cd <= 0;
        if (this.stun <= 0) {
            ctx.lineWidth = g.pigInReach && ready ? 3.5 : 2.2;
            ctx.setLineDash([9, 8]);
            ctx.lineDashOffset = -this.t * 14;
            if (ready) {
                ctx.strokeStyle = g.pigInReach ? 'rgba(255,240,150,0.95)' : 'rgba(255,255,255,0.3)';
                ctx.beginPath(); ctx.arc(this.x, this.y + 4, R, 0, Math.PI * 2); ctx.stroke();
                if (g.pigInReach) { ctx.fillStyle = 'rgba(255,240,150,0.10)'; ctx.fill(); }
            } else {
                ctx.strokeStyle = 'rgba(255,255,255,0.18)';
                ctx.beginPath(); ctx.arc(this.x, this.y + 4, R, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]);
                ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3;
                const k = 1 - this.cd / this.cdMax;
                ctx.beginPath(); ctx.arc(this.x, this.y + 4, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
            }
        }
        ctx.restore();

        // Взмах
        if (this.swingT > 0) {
            const p = 1 - this.swingT / this.swingDur, e = U.easeOut(p);
            ctx.save();
            ctx.fillStyle = `rgba(255,255,255,${0.2 * (1 - p)})`;
            ctx.beginPath(); ctx.arc(this.x, this.y + 4, R * (0.5 + 0.5 * e), 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(255,255,255,${0.95 * (1 - p)})`;
            ctx.lineWidth = 3 + 11 * (1 - p); ctx.lineCap = 'round';
            const a0 = -Math.PI * 0.7 + e * Math.PI * 1.9 * this.facing;
            ctx.beginPath(); ctx.arc(this.x, this.y + 4, R * (0.62 + 0.3 * e), a0, a0 + Math.PI * 1.1 * this.facing, this.facing < 0); ctx.stroke();
            ctx.restore();
        }

        // Шлейф рывка
        for (const tr of this.trail) {
            drawFarmer(ctx, { x: tr.x, y: tr.y, facing: tr.facing, walk: tr.walk, moving: true, t: 0, suit: '#7dd3fc', shirt: '#e0f2fe', hat: this.hat, swingK: -1, alpha: tr.life * 1.6, stun: 0 });
        }

        const blink = this.invuln > 0 && this.dashT <= 0 && Math.sin(this.t * 50) > 0;
        drawFarmer(ctx, {
            x: this.x, y: this.y, facing: this.facing, walk: this.walk, moving: this.moving, t: this.t,
            suit: g.buffs.speed > 0 ? '#f59e0b' : '#3b82f6', hat: this.hat, stun: this.stun, dashing: this.dashT > 0,
            swingK: this.swingT > 0 ? 1 - this.swingT / this.swingDur : -1, alpha: blink ? 0.55 : 1
        });

        // Индикатор перезарядки рывка
        if (this.dashCdT > 0) {
            const k = 1 - this.dashCdT / this.dashCd;
            ctx.fillStyle = 'rgba(30,20,10,0.55)'; ctx.beginPath(); ctx.roundRect(this.x - 15, this.y + 26, 30, 6, 3); ctx.fill();
            ctx.fillStyle = '#7dd3fc'; ctx.beginPath(); ctx.roundRect(this.x - 14, this.y + 27, 28 * k, 4, 2); ctx.fill();
        }
    }
}
