'use strict';

/**
 * Напарник: сам выбирает свинью, догоняет и машет сачком
 */
class Helper {
    constructor(index, x, y) {
        const PAL = [
            { suit: '#2f9e44', hat: '#f08c00' }, { suit: '#7048e8', hat: '#e03131' },
            { suit: '#d9480f', hat: '#2f9e44' }, { suit: '#0c8599', hat: '#f783ac' }
        ];
        this.index = index;
        this.pal = PAL[index % PAL.length];
        this.x = x; this.y = y;
        this.r = 14;
        this.vx = 0; this.vy = 0;
        this.speed = CONFIG.PLAYER_SPEED * 0.84;
        this.catchRadius = CONFIG.CATCH_RADIUS * 0.82;
        this.cd = U.rand(0.3, 1);
        this.swingT = 0; this.swingDur = 0.24;
        this.facing = 1; this.walk = 0; this.moving = false; this.t = Math.random() * 5;
        this.target = null;
        this.retarget = 0;
    }

    update(dt, g) {
        this.t += dt;
        if (this.cd > 0) this.cd -= dt;
        if (this.swingT > 0) this.swingT -= dt;
        this.retarget -= dt;

        let tx = 0, ty = 0;
        if (g.state === 'play') {
            if (!this.target || !this.target.active || this.target.state === 'escape' || this.retarget <= 0) {
                this.target = this.pickTarget(g);
                this.retarget = 0.7;
            }
            const p = this.target;
            if (p) {
                const px = p.x + p.vx * 0.22, py = p.y + p.vy * 0.22;
                const dx = px - this.x, dy = py - this.y, dd = Math.hypot(dx, dy) || 1;
                if (dd > 20) { tx = dx / dd; ty = dy / dd; }
                const av = g.world.avoid(this.x, this.y, 30);
                tx += av.x * 1.3; ty += av.y * 1.3;
                const real = Math.hypot(p.x - this.x, p.y - this.y);
                if (real < this.catchRadius * 0.8 + p.r * 0.5 && this.cd <= 0) {
                    this.swingT = this.swingDur;
                    const res = g.sweep(this, this.catchRadius);
                    this.cd = res.hits > 0 ? 1.5 : 0.8;
                    g.fx.ring(this.x, this.y + 4, this.catchRadius * 0.8, 'rgba(180,255,190,0.8)', 0.25, 4);
                }
            } else {
                // Свиней нет — держимся рядом с фермером
                const dx = g.player.x - this.x, dy = g.player.y - this.y, dd = Math.hypot(dx, dy) || 1;
                if (dd > 110 + this.index * 30) { tx = dx / dd; ty = dy / dd; }
            }
        }
        const l = Math.hypot(tx, ty);
        if (l > 1) { tx /= l; ty /= l; }
        const mud = g.world.inMud(this.x, this.y + 10) ? 0.6 : 1;
        const k = Math.min(1, 10 * dt);
        this.vx += (tx * this.speed * mud - this.vx) * k; this.vy += (ty * this.speed * mud - this.vy) * k;
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.moving = Math.hypot(this.vx, this.vy) > 25;
        if (this.moving) this.walk += dt * 12;
        if (Math.abs(this.vx) > 15) this.facing = this.vx > 0 ? 1 : -1;
        g.world.resolve(this, this.r);
    }

    pickTarget(g) {
        let best = null, bd = Infinity;
        for (const p of g.pigs) {
            if (!p.active || p.state === 'escape' || p.state === 'burst') continue;
            let dd = Math.hypot(p.x - this.x, p.y - this.y);
            for (const h of g.helpers) if (h !== this && h.target === p) dd += 600;   // не толпимся
            if (p.def.charger) dd += 250;
            if (dd < bd) { bd = dd; best = p; }
        }
        return best;
    }

    draw(ctx) {
        drawFarmer(ctx, {
            x: this.x, y: this.y, facing: this.facing, walk: this.walk, moving: this.moving, t: this.t,
            suit: this.pal.suit, hat: 'cap', hatColor: this.pal.hat, skin: '#f7c9a0', stun: 0,
            swingK: this.swingT > 0 ? 1 - this.swingT / this.swingDur : -1
        });
    }
}

/**
 * Пёс Бобик: облаивает свиней, те пугаются и замедляются
 */
class Dog {
    constructor(index, x, y) {
        this.index = index;
        this.x = x; this.y = y;
        this.r = 10;
        this.vx = 0; this.vy = 0;
        this.speed = 335;
        this.facing = 1; this.anim = 0; this.t = Math.random() * 5;
        this.target = null;
        this.rest = 0;
        this.barkT = 0;
        this.color = index === 0 ? '#c68642' : '#f1f1f1';
        this.ear = index === 0 ? '#7a4a22' : '#4a4a4a';
    }

    update(dt, g) {
        this.t += dt;
        if (this.rest > 0) this.rest -= dt;
        if (this.barkT > 0) this.barkT -= dt;
        let tx = 0, ty = 0;
        const pl = g.player;

        if (g.state === 'play' && this.rest <= 0) {
            if (!this.target || !this.target.active || this.target.barkCd > 0 || this.target.state === 'escape') this.target = this.pickTarget(g);
            const p = this.target;
            if (p) {
                const dx = p.x - this.x, dy = p.y - this.y, dd = Math.hypot(dx, dy) || 1;
                tx = dx / dd; ty = dy / dd;
                if (dd < p.r + 30) {
                    p.slow = 3.2; p.barkCd = 8; p.alert = 0.5;
                    this.rest = 0.7; this.barkT = 0.35; this.target = null;
                    g.sfx.bark();
                    g.fx.text(this.x, this.y - 30, 'ГАВ!', { color: '#ffffff', size: 18, life: 0.6 });
                    g.fx.ring(this.x, this.y, 30, 'rgba(255,255,255,0.8)', 0.3, 3);
                    tx = 0; ty = 0;
                }
            }
        }
        if (!this.target && this.rest <= 0) {
            const ox = pl.x - pl.facing * (46 + this.index * 30), oy = pl.y + 26;
            const dx = ox - this.x, dy = oy - this.y, dd = Math.hypot(dx, dy) || 1;
            if (dd > 26) { const s = Math.min(1, dd / 120); tx = (dx / dd) * s; ty = (dy / dd) * s; }
        }
        const av = g.world.avoid(this.x, this.y, 24);
        tx += av.x; ty += av.y;
        const k = Math.min(1, 9 * dt);
        this.vx += (tx * this.speed - this.vx) * k; this.vy += (ty * this.speed - this.vy) * k;
        this.x += this.vx * dt; this.y += this.vy * dt;
        const sp = Math.hypot(this.vx, this.vy);
        this.anim += dt * (3 + sp * 0.07);
        if (Math.abs(this.vx) > 15) this.facing = this.vx > 0 ? 1 : -1;
        g.world.resolve(this, this.r);
    }

    pickTarget(g) {
        let best = null, bd = Infinity;
        const pl = g.player;
        for (const p of g.pigs) {
            if (!p.active || p.barkCd > 0 || p.def.charger || p.state === 'escape' || p.state === 'burst' || p.frozen > 0) continue;
            let dd = Math.hypot(p.x - pl.x, p.y - pl.y);
            if (dd > 620) continue;
            for (const o of g.dogs) if (o !== this && o.target === p) dd += 800;
            if (p.def.gold) dd -= 300;
            if (dd < bd) { bd = dd; best = p; }
        }
        return best;
    }

    draw(ctx) {
        const OUT = '#3b2212';
        const run = Math.hypot(this.vx, this.vy) > 25;
        const hop = run ? Math.abs(Math.sin(this.anim)) * 3 : 0;
        ctx.save();
        ctx.fillStyle = 'rgba(20,40,20,0.22)';
        ctx.beginPath(); ctx.ellipse(this.x, this.y + 10, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.translate(this.x, this.y - hop);
        ctx.scale(this.facing, 1);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        const leg = run ? Math.sin(this.anim) * 4 : 0;
        ctx.fillStyle = this.color; ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
        // Хвост
        ctx.save(); ctx.translate(-12, -4); ctx.rotate(-0.9 + Math.sin(this.t * 14) * 0.45);
        ctx.beginPath(); ctx.roundRect(-2, -11, 4, 12, 2); ctx.fill(); ctx.stroke(); ctx.restore();
        // Лапы
        ctx.beginPath(); ctx.roundRect(-10 - leg, 4, 4.5, 8, 2); ctx.roundRect(6 + leg, 4, 4.5, 8, 2); ctx.fill(); ctx.stroke();
        // Тело
        ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // Голова
        ctx.beginPath(); ctx.arc(12, -8, 7.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(15, -8, 9, 6.5, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = this.ear;
        ctx.beginPath(); ctx.ellipse(8, -9, 3.5, 6.5, 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = OUT;
        ctx.beginPath(); ctx.arc(14, -10, 1.5, 0, Math.PI * 2); ctx.arc(24, -6.5, 1.8, 0, Math.PI * 2); ctx.fill();
        if (this.barkT > 0) { ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.ellipse(20, -1, 3, 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
        // Ошейник
        ctx.strokeStyle = '#e63946'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(7, -2); ctx.lineTo(10, 2); ctx.stroke();
        ctx.restore();
    }
}
