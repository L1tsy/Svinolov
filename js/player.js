'use strict';

/**
 * Общая отрисовка человечка-фермера (игрок 1, игрок 2 / напарница и напарники)
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

    // Волосы сзади для Фермерши / P2 (косички с покачиванием)
    if (o.isFemale || o.hair) {
        ctx.fillStyle = o.hairColor || '#854d0e';
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 1.8;
        const braidBob = o.moving ? Math.sin(o.walk * 1.4) * 3.5 : Math.sin(o.t * 3.2) * 1.2;
        // Задняя прическа
        ctx.beginPath();
        ctx.arc(0, -17, 11.5, Math.PI * 0.7, Math.PI * 2.3);
        ctx.fill(); ctx.stroke();
        // Левая косичка
        ctx.beginPath();
        ctx.ellipse(-9, -12 + braidBob * 0.5, 4.5, 7.5, -0.25, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Бантик на косе
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath(); ctx.arc(-11, -7 + braidBob * 0.5, 2.5, 0, Math.PI * 2); ctx.fill();
        // Правая косичка
        ctx.fillStyle = o.hairColor || '#854d0e';
        ctx.beginPath();
        ctx.ellipse(3, -13 - braidBob * 0.5, 4, 7, 0.25, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
    }

    // Ноги
    const leg = o.moving ? Math.sin(o.walk) * 6 : 0;
    ctx.fillStyle = o.bootsColor || '#4a2f1a'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-9 + leg, 13 + bob * 0.6, 8, 8, 3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(1 - leg, 13 + bob * 0.6, 8, 8, 3); ctx.fill(); ctx.stroke();

    // Туловище: рубашка и комбинезон
    ctx.fillStyle = o.shirt || '#f4f1e8'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.roundRect(-12, -8, 24, 24, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = o.suit || '#3b82f6';
    ctx.beginPath(); ctx.roundRect(-12, 0, 24, 16, [3, 3, 7, 7]); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-7, -6, 14, 9, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(-5, -2.5, 1.5, 0, Math.PI * 2); ctx.arc(5, -2.5, 1.5, 0, Math.PI * 2); ctx.fill();

    // Голова
    ctx.fillStyle = o.skin || '#ffd9b0'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(0, -17, 10.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Челка для напарницы
    if (o.isFemale || o.hair) {
        ctx.fillStyle = o.hairColor || '#854d0e';
        ctx.strokeStyle = OUT; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(-2, -22, 6, 0.2, Math.PI * 0.9);
        ctx.stroke();
    }

    if (o.stun > 0) {
        ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(1.5, -20.5); ctx.lineTo(6.5, -15.5); ctx.moveTo(6.5, -20.5); ctx.lineTo(1.5, -15.5); ctx.stroke();
    } else {
        ctx.fillStyle = OUT;
        ctx.beginPath(); ctx.arc(4.2, -18, 1.9, 0, Math.PI * 2); ctx.fill();
        if (o.isFemale) {
            // Реснички у глаз
            ctx.strokeStyle = OUT; ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(5.0, -19.8); ctx.lineTo(6.8, -21.2);
            ctx.moveTo(5.9, -18.6); ctx.lineTo(7.6, -19.2);
            ctx.stroke();
        }
        ctx.strokeStyle = '#b5522b'; ctx.lineWidth = 1.7;
        ctx.beginPath(); ctx.arc(3.5, -14, 3.6, 0.15, Math.PI * 0.8); ctx.stroke();
    }
    // Румянец
    ctx.fillStyle = o.isFemale ? 'rgba(255,90,130,0.6)' : 'rgba(255,110,110,0.4)';
    ctx.beginPath(); ctx.arc(-1, -13.5, o.isFemale ? 3.0 : 2.6, 0, Math.PI * 2); ctx.fill();

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
    ctx.strokeStyle = o.netColor || '#e8eef5'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = -1; i <= 1; i++) {
        ctx.moveTo(31 + i * 5, -21); ctx.lineTo(31 + i * 5, 3);
        ctx.moveTo(22, -9 + i * 6); ctx.lineTo(40, -9 + i * 6);
    }
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
        case 'daisy':
            // Соломенная шляпка с ромашкой для Фермерши
            ctx.fillStyle = color || '#f5d77f';
            ctx.beginPath(); ctx.roundRect(-9, -34, 18, 11, [5, 5, 0, 0]); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#06b6d4'; ctx.fillRect(-8.6, -27, 17.2, 3); // бирюзовая ленточка
            ctx.fillStyle = color || '#f5d77f';
            ctx.beginPath(); ctx.ellipse(0, -23.5, 18.5, 4.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            // Ромашка
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 6; i++) {
                const a = (i * Math.PI * 2) / 6;
                ctx.beginPath(); ctx.arc(7 + Math.cos(a) * 3, -26 + Math.sin(a) * 3, 2, 0, Math.PI * 2); ctx.fill();
            }
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath(); ctx.arc(7, -26, 1.8, 0, Math.PI * 2); ctx.fill();
            break;
        case 'bandana':
            // Красная бандана с узелком
            ctx.fillStyle = color || '#e11d48';
            ctx.beginPath();
            ctx.arc(0, -21, 11, Math.PI * 0.95, Math.PI * 2.05);
            ctx.lineTo(8, -19); ctx.lineTo(-12, -22); ctx.closePath();
            ctx.fill(); ctx.stroke();
            // Узелок
            ctx.beginPath();
            ctx.moveTo(-10, -20); ctx.lineTo(-17, -18); ctx.lineTo(-14, -24); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-10, -20); ctx.lineTo(-16, -23); ctx.lineTo(-12, -26); ctx.closePath();
            ctx.fill(); ctx.stroke();
            // Белые горошины
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(-3, -25, 1.2, 0, Math.PI * 2);
            ctx.arc(3, -26, 1.2, 0, Math.PI * 2);
            ctx.arc(6, -22, 1.2, 0, Math.PI * 2);
            ctx.arc(-7, -23, 1.2, 0, Math.PI * 2);
            ctx.fill();
            break;
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

// Глобальный трекер физических кодов клавиш для автономного ввода Player 1 и Player 2
const ACTIVE_KEYS = new Set();
if (typeof window !== 'undefined' && !window.__SVINOLOV_PLAYER_KEYS_ATTACHED__) {
    window.addEventListener('keydown', (e) => {
        ACTIVE_KEYS.add(e.code);
    }, { passive: true });
    window.addEventListener('keyup', (e) => {
        ACTIVE_KEYS.delete(e.code);
    }, { passive: true });
    window.addEventListener('blur', () => {
        ACTIVE_KEYS.clear();
    });
    window.__SVINOLOV_PLAYER_KEYS_ATTACHED__ = true;
}

/**
 * Игрок-фермер (поддерживает Player 1 и Player 2)
 */
class Player {
    constructor(x, y, idOrOpts = 1) {
        let id = 1;
        let opts = {};
        if (typeof idOrOpts === 'number') {
            id = idOrOpts;
        } else if (typeof idOrOpts === 'object' && idOrOpts !== null) {
            id = idOrOpts.id || idOrOpts.playerIndex || 1;
            opts = idOrOpts;
        }

        this.id = id;
        this.playerIndex = id;
        this.isFemale = this.id === 2;
        this.name = opts.name || (this.id === 2 ? 'Фермерша' : 'Фермер');

        this.x = x; this.y = y;
        this.r = CONFIG.PLAYER_RADIUS;
        this.vx = 0; this.vy = 0;
        this.speed = CONFIG.PLAYER_SPEED;
        this.catchRadius = CONFIG.CATCH_RADIUS;
        this.swingCd = CONFIG.SWING_COOLDOWN;
        this.dashCd = CONFIG.DASH_COOLDOWN;

        this.cd = 0; this.cdMax = 1;
        this.dashT = 0; this.dashCdT = 0;
        this.dashGauge = 1;
        this.dashX = 1; this.dashY = 0;
        this.stun = 0;
        this.invuln = 0;
        this.facing = 1;
        this.aimX = 1; this.aimY = 0;
        this.walk = 0;
        this.moving = false;
        this.swingT = 0; this.swingDur = 0.24;
        this.t = 0;
        this.hat = opts.hat || (this.id === 2 ? 'daisy' : 'straw');
        this.trail = [];
        this.trailT = 0;
        this.inMud = false;
        this.stepT = 0;

        // Визуальные отличия
        this.suit = opts.suit || (this.id === 2 ? '#0d9488' : '#3b82f6'); // бирюзовый для P2, синий для P1
        this.shirt = opts.shirt || (this.id === 2 ? '#fef08a' : '#f4f1e8'); // нежно-желтый / кремовый
        this.netColor = opts.netColor || (this.id === 2 ? '#5eead4' : '#e8eef5');
        this.trailColor = opts.trailColor || (this.id === 2 ? '#2dd4bf' : '#7dd3fc');
        this.hairColor = opts.hairColor || '#854d0e';

        // Кооп механики
        this.inSynergy = false;
        this.synergyDist = 999;
        this.highFiveCd = 0;
        this.unstunCd = 0;
        this.highFiveBoost = 1;
        this.score = 0;
        this.dayCaught = 0;
        this.totalCaught = 0;
        this.swingBuf = 0;

        // Сетевой режим (P2P WebRTC на 2 устройства)
        this.isRemote = !!opts.isRemote;
        this.isLocal = opts.isLocal !== undefined ? !!opts.isLocal : (this.id === 1);
        this.targetX = undefined;
        this.targetY = undefined;
    }

    /** Упаковка состояния игрока для отправки по сети */
    getNetworkState() {
        return {
            id: this.id,
            x: Math.round(this.x * 10) / 10,
            y: Math.round(this.y * 10) / 10,
            vx: Math.round(this.vx),
            vy: Math.round(this.vy),
            facing: this.facing,
            moving: this.moving,
            dashing: this.dashT > 0,
            dashT: Math.round(this.dashT * 100) / 100,
            swingT: Math.round(this.swingT * 100) / 100,
            stun: Math.round(this.stun * 100) / 100,
            score: this.score,
            dayCaught: this.dayCaught,
            hat: this.hat
        };
    }

    /** Применение сетевого снимка от напарника */
    applyNetworkState(s) {
        if (!s) return;
        this.targetX = s.x;
        this.targetY = s.y;
        this.vx = s.vx || 0;
        this.vy = s.vy || 0;
        if (s.facing !== undefined) this.facing = s.facing;
        if (s.moving !== undefined) this.moving = s.moving;
        if (s.dashing && this.dashT <= 0) this.dashT = s.dashT || 0.15;
        if (s.swingT > 0 && this.swingT <= 0) this.swing();
        if (s.stun !== undefined) this.stun = s.stun;
        if (s.score !== undefined) this.score = s.score;
        if (s.dayCaught !== undefined) this.dayCaught = s.dayCaught;
        if (s.hat) this.hat = s.hat;

        // При большом лаге или первом появлении телепортируем сразу
        if (Math.hypot(this.x - s.x, this.y - s.y) > 160) {
            this.x = s.x;
            this.y = s.y;
        }
    }

    /**
     * Возвращает список клавиш управления для данного игрока
     */
    static getControls(id, mode = 'coop') {
        if (id === 2) {
            return {
                up: ['ArrowUp'],
                down: ['ArrowDown'],
                left: ['ArrowLeft'],
                right: ['ArrowRight'],
                dash: ['ShiftRight', 'Numpad0', 'KeyK'],
                swing: ['Enter', 'NumpadEnter', 'Slash', 'KeyL']
            };
        }
        // id === 1
        if (mode === 'solo') {
            return {
                up: ['KeyW', 'ArrowUp'],
                down: ['KeyS', 'ArrowDown'],
                left: ['KeyA', 'ArrowLeft'],
                right: ['KeyD', 'ArrowRight'],
                dash: ['ShiftLeft', 'ShiftRight'],
                swing: ['Space']
            };
        }
        return {
            up: ['KeyW'],
            down: ['KeyS'],
            left: ['KeyA'],
            right: ['KeyD'],
            dash: ['ShiftLeft'],
            swing: ['Space']
        };
    }

    /**
     * Считывает вектор движения из клавиш управления
     */
    getMoveVector(g) {
        if (this.isRemote) return { x: 0, y: 0 };
        let x = 0, y = 0;
        const isCoop = g && (g.mode === 'coop' || g.player2);
        const isOnline = g && (g.isOnline || (g.net && g.net.connected));

        if (this.isLocal && isOnline) {
            // На своем устройстве в онлайн-коопе игрок может ходить и на WASD, и на стрелках
            if (ACTIVE_KEYS.has('KeyD') || ACTIVE_KEYS.has('ArrowRight')) x += 1;
            if (ACTIVE_KEYS.has('KeyA') || ACTIVE_KEYS.has('ArrowLeft')) x -= 1;
            if (ACTIVE_KEYS.has('KeyS') || ACTIVE_KEYS.has('ArrowDown')) y += 1;
            if (ACTIVE_KEYS.has('KeyW') || ACTIVE_KEYS.has('ArrowUp')) y -= 1;
            if (g && g.input) {
                x += Number(g.input.joyX) || 0;
                y += Number(g.input.joyY) || 0;
            }
        } else if (this.id === 2) {
            // Player 2 на общем локальном устройстве: Стрелки
            if (ACTIVE_KEYS.has('ArrowRight')) x += 1;
            if (ACTIVE_KEYS.has('ArrowLeft')) x -= 1;
            if (ACTIVE_KEYS.has('ArrowDown')) y += 1;
            if (ACTIVE_KEYS.has('ArrowUp')) y -= 1;
            // Поддержка второго джойстика
            if (g && g.input && (g.input.joy2X !== undefined || g.input.joy2Y !== undefined)) {
                x += Number(g.input.joy2X) || 0;
                y += Number(g.input.joy2Y) || 0;
            }
        } else {
            // Player 1: WASD (в соло-режиме также поддерживает стрелки)
            if (ACTIVE_KEYS.has('KeyD')) x += 1;
            if (ACTIVE_KEYS.has('KeyA')) x -= 1;
            if (ACTIVE_KEYS.has('KeyS')) y += 1;
            if (ACTIVE_KEYS.has('KeyW')) y -= 1;
            if (!isCoop) {
                if (ACTIVE_KEYS.has('ArrowRight')) x += 1;
                if (ACTIVE_KEYS.has('ArrowLeft')) x -= 1;
                if (ACTIVE_KEYS.has('ArrowDown')) y += 1;
                if (ACTIVE_KEYS.has('ArrowUp')) y -= 1;
            }
            if (g && g.input) {
                x += Number(g.input.joyX) || 0;
                y += Number(g.input.joyY) || 0;
            }
        }

        const l = Math.hypot(x, y);
        if (l > 1) { x /= l; y /= l; }
        return { x, y };
    }

    isDashPressed(g) {
        if (this.isRemote) return false;
        const isOnline = g && (g.isOnline || (g.net && g.net.connected));
        if (this.isLocal && isOnline) {
            return ACTIVE_KEYS.has('ShiftLeft') || ACTIVE_KEYS.has('ShiftRight') || ACTIVE_KEYS.has('Numpad0');
        }
        if (this.id === 2) {
            return ACTIVE_KEYS.has('ShiftRight') || ACTIVE_KEYS.has('Numpad0') || ACTIVE_KEYS.has('KeyK');
        }
        return ACTIVE_KEYS.has('ShiftLeft');
    }

    isSwingPressed(g) {
        if (this.isRemote) return false;
        const isOnline = g && (g.isOnline || (g.net && g.net.connected));
        if (this.isLocal && isOnline) {
            return ACTIVE_KEYS.has('Space') || ACTIVE_KEYS.has('Enter') || ACTIVE_KEYS.has('NumpadEnter') || ACTIVE_KEYS.has('Slash');
        }
        if (this.id === 2) {
            return ACTIVE_KEYS.has('Enter') || ACTIVE_KEYS.has('NumpadEnter') || ACTIVE_KEYS.has('Slash') || ACTIVE_KEYS.has('KeyL');
        }
        return ACTIVE_KEYS.has('Space');
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
        if (l > 0.2) { this.dashX = ix / l; this.dashY = iy / l; }
        else { this.dashX = this.aimX; this.dashY = this.aimY; }
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
        if (this.highFiveCd > 0) this.highFiveCd -= dt;
        if (this.unstunCd > 0) this.unstunCd -= dt;
        if (this.highFiveBoost > 1) this.highFiveBoost = Math.max(1, this.highFiveBoost - dt * 0.45);
        if (this.swingBuf > 0) this.swingBuf -= dt;

        this.dashGauge = this.dashCdT > 0 ? Math.max(0, 1 - this.dashCdT / this.dashCd) : 1;

        for (let i = this.trail.length - 1; i >= 0; i--) {
            this.trail[i].life -= dt;
            if (this.trail[i].life <= 0) this.trail.splice(i, 1);
        }

        // Если ix, iy не переданы, считываем клавиши сами
        if (ix === undefined || iy === undefined) {
            const mv = this.getMoveVector(g);
            ix = mv.x; iy = mv.y;
        }

        const w = g.world;

        // Удаленный сетевой напарник интерполирует координаты из сети
        if (this.isRemote) {
            if (this.targetX !== undefined && this.targetY !== undefined) {
                const k = Math.min(1, 24 * dt);
                this.x += (this.targetX - this.x) * k;
                this.y += (this.targetY - this.y) * k;
            }
            if (this.dashT > 0) {
                this.dashT -= dt;
                this.trailT -= dt;
                if (this.trailT <= 0) {
                    this.trail.push({ x: this.x, y: this.y, life: 0.26, facing: this.facing, walk: this.walk });
                    this.trailT = 0.028;
                }
            }
            if (this.moving) this.walk += dt * (this.dashT > 0 ? 26 : 13);
            w.resolve(this, this.r);
            return;
        }

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
            if (this.trailT <= 0) {
                this.trail.push({ x: this.x, y: this.y, life: 0.26, facing: this.facing, walk: this.walk });
                this.trailT = 0.028;
            }
            if (Math.random() < dt * 60) g.fx.dust(this.x, this.y + 14, 1, g.dustColor);
        } else {
            let l = Math.hypot(ix, iy);
            if (l > 1) { ix /= l; iy /= l; l = 1; }
            let sp = this.speed * (g.buffs && g.buffs.speed > 0 ? 1.45 : 1) * (this.inMud ? 0.5 : 1) * this.highFiveBoost;
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

        // Коллизии с картой
        w.resolve(this, this.r);

        // Интерактивные объекты мира (пугало, колокол)
        if (this.dashT > 0 && w.triggerInteractive) {
            w.triggerInteractive(this.x, this.y, this.r + 10, g);
        }

        // Кооп взаимодействия с напарником
        const partner = (this.id === 1 ? g.player2 : g.player);
        if (partner && partner !== this) {
            const dist = Math.hypot(this.x - partner.x, this.y - partner.y);
            this.synergyDist = dist;
            this.inSynergy = dist < 170;

            // Снятие стана напарником при касании ("Дай пять!")
            if (this.stun > 0 && dist < 48 && this.unstunCd <= 0) {
                this.stun = 0;
                this.unstunCd = 2.0;
                if (g.fx) {
                    g.fx.sparkle(this.x, this.y - 15, '#ffd23f');
                    g.fx.floatText(this.x, this.y - 35, '✋ ДАЙ ПЯТЬ! СТАН СНЯТ!', '#ffd23f');
                }
                if (g.sfx && g.sfx.powerup) g.sfx.powerup();
                this.highFiveBoost = 1.35;
                partner.highFiveBoost = 1.35;
            }

            // Дружеское "Дай пять!" на рывке или столкновении
            if (this.highFiveCd <= 0 && dist < 42 && (this.dashT > 0 || partner.dashT > 0 || (this.moving && partner.moving))) {
                this.highFiveCd = 4.0;
                partner.highFiveCd = 4.0;
                const mx = (this.x + partner.x) / 2, my = (this.y + partner.y) / 2;
                if (g.fx) {
                    g.fx.floatText(mx, my - 32, '✋ ДАЙ ПЯТЬ!', '#38bdf8');
                    g.fx.confetti(mx, my - 15, 14);
                }
                if (g.sfx && g.sfx.combo) g.sfx.combo(2);
                this.highFiveBoost = 1.25;
                partner.highFiveBoost = 1.25;
            }

            // Мягкое расталкивание игроков, чтобы они не накладывались полностью
            const minDist = this.r * 1.5;
            if (dist < minDist && dist > 0.001) {
                const push = (minDist - dist) * 0.5;
                const ddx = (this.x - partner.x) / dist;
                const ddy = (this.y - partner.y) / dist;
                this.x += ddx * push * 0.5;
                this.y += ddy * push * 0.5;
            }
        } else {
            this.inSynergy = false;
        }
    }

    draw(ctx, g) {
        const baseReach = g.reach || this.catchRadius;
        // Синергия напарников увеличивает радиус на 20%
        const R = baseReach * (this.inSynergy ? 1.2 : 1.0);
        const partner = (this.id === 1 ? g.player2 : g.player);

        // Индикатор синергетической дуги между игроками (рисует P1 один раз)
        if (this.id === 1 && this.inSynergy && partner) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 215, 64, 0.75)';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([7, 6]);
            ctx.lineDashOffset = -this.t * 32;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(partner.x, partner.y);
            ctx.stroke();

            // Искорка в центре связи
            const mx = (this.x + partner.x) / 2;
            const my = (this.y + partner.y) / 2;
            ctx.fillStyle = '#ffd23f';
            ctx.beginPath();
            ctx.arc(mx, my, 4.5 + Math.sin(this.t * 12) * 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Зона действия сачка
        ctx.save();
        const ready = this.cd <= 0;
        if (this.stun <= 0) {
            ctx.lineWidth = g.pigInReach && ready ? 3.5 : 2.2;
            ctx.setLineDash(this.inSynergy ? [6, 4] : [9, 8]);
            ctx.lineDashOffset = -this.t * (this.inSynergy ? 22 : 14);

            if (this.inSynergy) {
                // Сияние синергии
                ctx.shadowColor = '#ffd23f';
                ctx.shadowBlur = 9;
            }

            if (ready) {
                if (this.inSynergy) {
                    ctx.strokeStyle = this.id === 2 ? '#2dd4bf' : '#38bdf8';
                    ctx.beginPath(); ctx.arc(this.x, this.y + 4, R, 0, Math.PI * 2); ctx.stroke();
                    ctx.fillStyle = this.id === 2 ? 'rgba(45,212,191,0.12)' : 'rgba(56,189,248,0.12)';
                    ctx.fill();
                } else {
                    ctx.strokeStyle = g.pigInReach ? 'rgba(255,240,150,0.95)' : 'rgba(255,255,255,0.3)';
                    ctx.beginPath(); ctx.arc(this.x, this.y + 4, R, 0, Math.PI * 2); ctx.stroke();
                    if (g.pigInReach) { ctx.fillStyle = 'rgba(255,240,150,0.10)'; ctx.fill(); }
                }
            } else {
                ctx.strokeStyle = 'rgba(255,255,255,0.18)';
                ctx.beginPath(); ctx.arc(this.x, this.y + 4, R, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]);
                ctx.strokeStyle = this.id === 2 ? '#2dd4bf' : 'rgba(255,255,255,0.85)';
                ctx.lineWidth = 3;
                const k = 1 - this.cd / this.cdMax;
                ctx.beginPath(); ctx.arc(this.x, this.y + 4, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
            }
        }
        ctx.restore();

        // Взмах сачка
        if (this.swingT > 0) {
            const p = 1 - this.swingT / this.swingDur, e = U.easeOut(p);
            ctx.save();
            ctx.fillStyle = `rgba(255,255,255,${0.2 * (1 - p)})`;
            ctx.beginPath(); ctx.arc(this.x, this.y + 4, R * (0.5 + 0.5 * e), 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = this.inSynergy ? `rgba(255,215,64,${0.95 * (1 - p)})` : `rgba(255,255,255,${0.95 * (1 - p)})`;
            ctx.lineWidth = 3 + 11 * (1 - p); ctx.lineCap = 'round';
            const a0 = -Math.PI * 0.7 + e * Math.PI * 1.9 * this.facing;
            ctx.beginPath(); ctx.arc(this.x, this.y + 4, R * (0.62 + 0.3 * e), a0, a0 + Math.PI * 1.1 * this.facing, this.facing < 0); ctx.stroke();
            ctx.restore();
        }

        // Шлейф рывка
        for (const tr of this.trail) {
            drawFarmer(ctx, {
                x: tr.x, y: tr.y, facing: tr.facing, walk: tr.walk, moving: true, t: 0,
                suit: this.trailColor, shirt: '#e0f2fe', hat: this.hat, swingK: -1,
                alpha: tr.life * 1.6, stun: 0, isFemale: this.isFemale, hairColor: this.hairColor
            });
        }

        const blink = this.invuln > 0 && this.dashT <= 0 && Math.sin(this.t * 50) > 0;
        const currentSuit = (g.buffs && g.buffs.speed > 0) ? '#f59e0b' : this.suit;

        drawFarmer(ctx, {
            x: this.x, y: this.y, facing: this.facing, walk: this.walk, moving: this.moving, t: this.t,
            suit: currentSuit, shirt: this.shirt, netColor: this.netColor, hat: this.hat,
            stun: this.stun, dashing: this.dashT > 0,
            swingK: this.swingT > 0 ? 1 - this.swingT / this.swingDur : -1,
            alpha: blink ? 0.55 : 1, isFemale: this.isFemale, hairColor: this.hairColor
        });

        // Индикатор перезарядки рывка (полоска под ногами)
        if (this.dashCdT > 0) {
            const k = 1 - this.dashCdT / this.dashCd;
            ctx.fillStyle = 'rgba(30,20,10,0.55)'; ctx.beginPath(); ctx.roundRect(this.x - 15, this.y + 26, 30, 6, 3); ctx.fill();
            ctx.fillStyle = this.trailColor; ctx.beginPath(); ctx.roundRect(this.x - 14, this.y + 27, 28 * k, 4, 2); ctx.fill();
        }

        // Значок игрока (P1 / P2) в режиме коопа
        const isCoop = g && (g.mode === 'coop' || g.player2);
        if (isCoop) {
            ctx.save();
            const badgeText = this.id === 2 ? 'P2' : 'P1';
            const badgeColor = this.id === 2 ? '#0d9488' : '#2563eb';
            const tagY = this.y - 48;
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.beginPath(); ctx.roundRect(this.x - 12, tagY + 1, 24, 13, 4); ctx.fill();
            ctx.fillStyle = badgeColor;
            ctx.beginPath(); ctx.roundRect(this.x - 12, tagY, 24, 13, 4); ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 9px "Nunito","Segoe UI",sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(badgeText, this.x, tagY + 6.5);

            // Иконка синергии над плашкой
            if (this.inSynergy) {
                ctx.fillStyle = '#ffd23f';
                ctx.font = '900 11px sans-serif';
                ctx.fillText('⚡', this.x, tagY - 6);
            }
            ctx.restore();
        }
    }
}
