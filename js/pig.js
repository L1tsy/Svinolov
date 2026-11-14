'use strict';

/**
 * Свинья: Адаптивный умный ИИ (блуждание, паника, стайная тревога, увороты/зигзаги, укрытия, спринт) и процедурная отрисовка
 */
class Pig {
    static dispersionSeq = 0;

    constructor(type, x, y, day = 1) {
        this.type = type;
        this.def = PIG_TYPES[type];
        const d = this.def;
        this.x = x; this.y = y;
        this.r = d.r;
        this.day = day;
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

        // --- Умный ИИ и адаптивность ---
        // 1. Зигзаги и увороты (Evasive zig-zag / Jinking)
        this.jinkTimer = U.rand(0.2, 0.45);
        this.jinkSide = Math.random() < 0.5 ? 1 : -1;

        // 2. Спринт-рывок при опасности и истощение (Sprint burst & fatigue)
        this.sprintGauge = 1.0;          // Запас шкалы спринта (0..1)
        this.sprintBurstT = 0;          // Таймер активного рывка
        this.sprintCd = 0;              // Перезарядка рывка
        this.sprintCooldownMax = 4.0;
        this.isSprinting = false;

        this.fatigueT = 0;              // Таймер истощения/усталости после рывка (2.8 - 3.6с)
        this.fatigueDur = 0;            // Длительность текущего истощения
        this.isFatigued = false;        // Флаг состояния усталости
        this.pantingAnim = 0;           // Фаза анимации частого дыхания (panting)
        this.fatigueSqueakCd = 0;       // Кулдаун усталого похрюкивания
        this.isInitialSpawn = true;     // Флаг начального появления (для радиального разбега)

        // 3. Стайная тревога (Pack alarm)
        this.alarmT = 0;
        this.alarmThreatX = 0;
        this.alarmThreatY = 0;

        // 4. Окружение и укрытия (Cover & Environment)
        this.inCover = false;
        this.coverT = 0;

        // 5. Прыжки через реку (River jumping)
        this.isJumping = false;
        this.jumpT = 0;
        this.jumpDur = 0.75;
        this.jumpStartX = 0;
        this.jumpStartY = 0;
        this.jumpEndX = 0;
        this.jumpEndY = 0;
        this.jumpArcH = 32;
        this.jumpCd = U.rand(1.0, 2.5);

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

    /**
     * Динамическое масштабирование интеллекта свиньи от текущего дня и престижа.
     * Возвращает коэффициент IQ от ~0.12 (первые дни) до 1.5+ (поздние дни и престиж).
     */
    getIntelligence(g) {
        const d = this.def;
        const currentDay = this.day || (g && g.day) || (g && g.save && g.save.day) || 1;
        const prestige = (g && g.save && (g.save.prestige || (g.save.stats && g.save.stats.prestige))) || 0;

        let iq = 0.12 + Math.min(0.85, (currentDay - 1) * 0.038) + prestige * 0.25;

        if (d.ninja) iq += 0.35;
        else if (d.gold) iq += 0.28;
        else if (this.type === 'runner') iq += 0.20;
        else if (d.mud) iq += 0.15;
        else if (d.boss) iq += 0.25;
        else if (this.type === 'big') iq += 0.10;
        else if (this.type === 'piglet') iq -= 0.06;

        return U.clamp(iq, 0.1, 1.6);
    }

    /**
     * Сбор всех угроз на поле: игрок (включая второго игрока в коопе), напарники и собаки.
     */
    getThreats(g) {
        const threats = [];
        if (g.dogs && g.dogs.length > 0) {
            for (const dog of g.dogs) {
                const isTarget = (dog.target === this);
                threats.push({
                    x: dog.x, y: dog.y,
                    k: isTarget ? 1.35 : 0.85,
                    vx: dog.vx || 0, vy: dog.vy || 0,
                    dashing: false,
                    isDog: true
                });
            }
        }
        if (g.helpers && g.helpers.length > 0) {
            for (const h of g.helpers) {
                threats.push({
                    x: h.x, y: h.y,
                    k: 0.75,
                    vx: h.vx || 0, vy: h.vy || 0,
                    dashing: false
                });
            }
        }
        const players = [];
        if (g.players && Array.isArray(g.players)) {
            for (const p of g.players) if (p && !players.includes(p)) players.push(p);
        }
        if (g.player && !players.includes(g.player)) players.push(g.player);
        if (g.player2 && !players.includes(g.player2)) players.push(g.player2);

        for (const pl of players) {
            threats.push({
                x: pl.x, y: pl.y,
                k: 1.0,
                vx: pl.vx || 0, vy: pl.vy || 0,
                dashing: (pl.dashT > 0),
                isPlayer: true,
                ref: pl
            });
        }
        return threats;
    }

    /**
     * Стайная тревога: когда свинья визжит или паникует,
     * сородичи поблизости слышат это и тоже пускаются в бегство.
     */
    triggerPackAlarm(g, threatX, threatY) {
        if (!g || !g.pigs || g.pigs.length <= 1) return;
        const iq = this.getIntelligence(g);
        const radius = (this.type === 'piglet' ? 260 : 200) * (0.85 + iq * 0.35);

        for (let i = 0; i < g.pigs.length; i++) {
            const other = g.pigs[i];
            if (other === this || !other.active || other.state === 'caught' || other.state === 'escape') continue;
            const dx = other.x - this.x, dy = other.y - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist < radius) {
                other.receiveAlarm(this, threatX, threatY, dist / radius);
            }
        }
    }

    receiveAlarm(fromPig, threatX, threatY, distRatio) {
        if (this.state === 'wander' || this.state === 'lured') {
            this.alarmT = Math.max(this.alarmT, 1.7 * (1 - distRatio * 0.45));
            this.alarmThreatX = threatX;
            this.alarmThreatY = threatY;
            if (this.alert <= 0) this.alert = 0.45;
            this.idle = false;
        }
    }

    /**
     * Вычисление радиального угла разбега (0..360°) от дверей амбара на старте дня / волны.
     * Использует золотое сечение (Golden Angle ~137.5°) для идеального
     * распределения свиней по всем направлениям без скучивания + случайное отклонение.
     */
    static getRadialDispersionAngle(x, y, world = null, pigIndex = -1) {
        if (pigIndex < 0) {
            pigIndex = Pig.dispersionSeq++;
        }
        const GOLDEN_ANGLE = 2.399963229728653; // ~137.508°
        const W = (world && world.w) ? world.w : 1800;
        const H = (world && world.h) ? world.h : 1200;

        let baseAngle;

        // 1. Проверяем наличие амбаров в мире
        if (world && world.doors && world.doors.length > 1) {
            // Двойные амбары (Северный/Южный на Prestige 6+ или Западный/Восточный в Коопе)
            if (y < H * 0.35) {
                // Северный амбар (дверь смотрит на Юг): сектор разбега в сторону южной части фермы
                const spread = Math.PI * 0.88;
                const frac = ((pigIndex * 0.6180339887) % 1) - 0.5;
                baseAngle = (Math.PI / 2) + frac * spread;
            } else if (y > H * 0.65) {
                // Южный амбар (дверь смотрит на Север): сектор разбега в сторону северной части фермы
                const spread = Math.PI * 0.88;
                const frac = ((pigIndex * 0.6180339887) % 1) - 0.5;
                baseAngle = (-Math.PI / 2) + frac * spread;
            } else if (x < W * 0.35) {
                // Западный амбар (Кооп): сектор разбега на Восток
                const spread = Math.PI * 0.88;
                const frac = ((pigIndex * 0.6180339887) % 1) - 0.5;
                baseAngle = 0 + frac * spread;
            } else if (x > W * 0.65) {
                // Восточный амбар (Кооп): сектор разбега на Запад
                const spread = Math.PI * 0.88;
                const frac = ((pigIndex * 0.6180339887) % 1) - 0.5;
                baseAngle = Math.PI + frac * spread;
            } else {
                // Центральный амбар: полный разбег на 360°
                baseAngle = (pigIndex * GOLDEN_ANGLE) % (Math.PI * 2);
            }
        } else if (y < H * 0.35) {
            // Одиночный Северный амбар
            const spread = Math.PI * 0.88;
            const frac = ((pigIndex * 0.6180339887) % 1) - 0.5;
            baseAngle = (Math.PI / 2) + frac * spread;
        } else if (y > H * 0.65) {
            // Одиночный Южный амбар
            const spread = Math.PI * 0.88;
            const frac = ((pigIndex * 0.6180339887) % 1) - 0.5;
            baseAngle = (-Math.PI / 2) + frac * spread;
        } else {
            // Центральный амбар (классический одиночный режим): радиальный разбег на 360 градусов
            baseAngle = (pigIndex * GOLDEN_ANGLE) % (Math.PI * 2);
            // Если угол направлен прямо в стену амбара (строго на север -PI/2),
            // направляем свинку в обход левого или правого крыла амбара в северное поле
            let normAngle = baseAngle;
            if (normAngle > Math.PI) normAngle -= Math.PI * 2;
            if (normAngle < -0.38 && normAngle > -Math.PI + 0.38) {
                if (normAngle > -Math.PI / 2) {
                    baseAngle = -0.32; // обход правого крыла амбара
                } else {
                    baseAngle = -Math.PI + 0.32; // обход левого крыла амбара
                }
            }
        }

        // Случайная девиация (+- 12 градусов / +- 0.21 рад)
        const deviation = U.rand(-0.21, 0.21);
        return baseAngle + deviation;
    }

    /** Сброс последовательности радиального разбега */
    static resetDispersion() {
        Pig.dispersionSeq = 0;
    }

    startBurst(angle, dur, world = null) {
        let finalAngle = angle;
        // Если угол не передан или передан старый однонаправленный конус спавна из амбара:
        // автоматически применяем процедурный радиальный разбег на 360 градусов!
        if (finalAngle === null || finalAngle === undefined || (this.isInitialSpawn && typeof finalAngle === 'number' && Math.abs(finalAngle - Math.PI / 2) <= 1.32)) {
            finalAngle = Pig.getRadialDispersionAngle(this.x, this.y, world);
        }
        this.isInitialSpawn = false;

        this.state = 'burst';
        this.dirX = Math.cos(finalAngle); this.dirY = Math.sin(finalAngle);
        this.burstDur = dur || U.rand(0.75, 1.15);
        this.stateT = this.burstDur;
        this.vx = this.dirX * 340; this.vy = this.dirY * 340;
    }

    /**
     * Явный запуск радиального разбега от дверей амбара
     */
    startRadialDispersion(door = null, world = null, dur = null) {
        const x = door ? door.x : this.x;
        const y = door ? door.y : this.y;
        const angle = Pig.getRadialDispersionAngle(x, y, world);
        this.startBurst(angle, dur || U.rand(0.75, 1.15), world);
    }

    catchTo(tx, ty) {
        this.caught = true;
        this.state = 'caught';
        this.isJumping = false;
        this.fatigueT = 0;
        this.isFatigued = false;
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
        if (this.alarmT > 0) this.alarmT -= dt;
        if (this.coverT > 0) {
            this.coverT -= dt;
            if (this.coverT <= 0) this.inCover = false;
        }
        if (this.sprintCd > 0) this.sprintCd -= dt;
        if (this.jumpCd > 0) this.jumpCd -= dt;
        if (this.sprintBurstT > 0) {
            this.sprintBurstT -= dt;
            if (this.sprintBurstT <= 0) {
                this.sprintBurstT = 0;
                this.isSprinting = false;

                // Вход в состояние истощения (Fatigue) на 2.8 - 3.6 секунды
                this.fatigueDur = U.rand(2.8, 3.6);
                this.fatigueT = this.fatigueDur;
                this.isFatigued = true;
                this.fatigueSqueakCd = 0;
                this.sprintCd = Math.max(this.sprintCd, this.fatigueDur + 1.0);

                if (g.fx) {
                    g.fx.text(this.x, this.y - this.r - 20, '💦 УФФ...', { color: '#7dd3fc', size: 15, life: 0.85 });
                    g.fx.burst(this.x, this.y - this.r * 0.4, 4, {
                        color: ['#60a5fa', '#93c5fd'],
                        speed: 35,
                        life: 0.45,
                        size: 3
                    });
                }
                if (g.sfx && g.sfx.oink) {
                    g.sfx.oink();
                }
            } else {
                this.isSprinting = true;
            }
        } else {
            this.isSprinting = false;
        }

        // Обработка состояния истощения / усталости (Pig Sprint Fatigue)
        if (this.fatigueT > 0) {
            this.fatigueT -= dt;
            this.isFatigued = true;
            this.pantingAnim += dt * 15; // частое запыхавшееся дыхание (panting)

            // Периодические капли пота в игровой мир
            if (Math.random() < dt * 4.0 && g.fx) {
                g.fx.burst(this.x + U.rand(-6, 6), this.y - this.r * 0.3, 1, {
                    color: '#60a5fa',
                    speed: 20,
                    life: 0.35,
                    size: 2.4,
                    up: -12
                });
            }

            // Периодический усталый вздох / хрюк
            this.fatigueSqueakCd -= dt;
            if (this.fatigueSqueakCd <= 0) {
                if (g.sfx && g.sfx.oink && Math.random() < 0.6) {
                    g.sfx.oink();
                }
                this.fatigueSqueakCd = U.rand(1.3, 2.0);
            }

            if (this.fatigueT <= 0) {
                this.fatigueT = 0;
                this.isFatigued = false;
            }
        } else {
            this.isFatigued = false;
            this.pantingAnim = 0;
        }

        // Восстановление запаса спринта (не восстанавливается во время истощения)
        if (this.sprintBurstT <= 0 && this.fatigueT <= 0) {
            const rechargeRate = 0.22 + (this.type === 'runner' ? 0.08 : 0);
            this.sprintGauge = Math.min(1, this.sprintGauge + dt * rechargeRate);
        }

        // Обработка активного акробатического прыжка через реку
        if (this.isJumping) {
            this.jumpT += dt / this.jumpDur;
            const p = Math.min(1, this.jumpT);
            this.x = U.lerp(this.jumpStartX, this.jumpEndX, p);
            this.y = U.lerp(this.jumpStartY, this.jumpEndY, p);
            this.anim += dt * 32;
            this.facing = (this.jumpEndX >= this.jumpStartX) ? 1 : -1;

            if (p > 0.35 && p < 0.65 && Math.random() < dt * 9) {
                if (g.fx) g.fx.dust(this.x, this.y, 1, 'rgba(186, 230, 253, 0.6)');
            }

            if (this.jumpT >= 1) {
                this.isJumping = false;
                this.x = this.jumpEndX;
                this.y = this.jumpEndY;
                this.jumpCd = U.rand(3.5, 5.2);

                if (g.fx) {
                    g.fx.dust(this.x, this.y + this.r * 0.5, 6, g.dustColor || '#d4b483');
                    g.fx.ring(this.x, this.y + this.r * 0.4, 22, '#7dd3fc', 0.35, 3);
                    const words = ['ХОП!', 'ВЖУХ!', 'ПЛЮХ!', 'ПРЫГ!'];
                    const word = words[Math.floor(Math.random() * words.length)];
                    g.fx.text(this.x, this.y - this.r - 20, word, { color: '#38bdf8', size: 15, life: 0.55 });
                }
                if (g.sfx) {
                    if (g.sfx.splat) g.sfx.splat();
                    else if (g.sfx.dash) g.sfx.dash();
                }

                this.state = 'panic';
                this.vx = (this.facing > 0 ? 1 : -1) * this.def.panic * 0.85;
                this.vy = 0;
            }
            return;
        }

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

        // Поиск ближайшего игрока (с поддержкой одиночной игры и коопа)
        let targetPlayer = g.player;
        if (g.players && g.players.length > 1) {
            let minD = Infinity;
            for (const p of g.players) {
                if (!p) continue;
                const dist = Math.hypot(p.x - this.x, p.y - this.y);
                if (dist < minD) { minD = dist; targetPlayer = p; }
            }
        } else if (g.player2) {
            const d1 = Math.hypot(g.player.x - this.x, g.player.y - this.y);
            const d2 = Math.hypot(g.player2.x - this.x, g.player2.y - this.y);
            targetPlayer = d2 < d1 ? g.player2 : g.player;
        }
        const pl = targetPlayer || g.player;
        const dpx = pl.x - this.x, dpy = pl.y - this.y, dPlayer = Math.hypot(dpx, dpy) || 1;
        let speedMul = (this.slow > 0 ? 0.5 : 1) * g.pigSpeedMul;
        if (this.fatigueT > 0) {
            // Замедление до 50-60% от нормальной скорости при истощении
            speedMul *= 0.55;
        }
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
                const iq = this.getIntelligence(g);
                let ax = 0, ay = 0, panic = 0;
                const threats = this.getThreats(g);

                let closestThreat = null;
                let closestThreatDist = Infinity;

                // 1. Оценка угроз с динамическим радиусом паники от интеллекта
                if (d.panicR > 0) {
                    for (const th of threats) {
                        const dx = this.x - th.x, dy = this.y - th.y;
                        const dd = Math.hypot(dx, dy) || 1;
                        const R = d.panicR * th.k * (0.9 + iq * 0.28);
                        if (dd < closestThreatDist) {
                            closestThreatDist = dd;
                            closestThreat = th;
                        }
                        if (dd < R) {
                            let wg = 1 - dd / R;
                            // Если свинья укрылась в кустах — прямая линия видимости прервана, эффект угрозы слабее
                            if (this.inCover) wg *= 0.65;

                            let px = dx / dd, py = dy / dd;
                            // Умные свиньи упреждают траекторию движения ловца
                            if (iq >= 0.4 && (th.vx || th.vy)) {
                                const leadX = (th.vx || 0) * 0.18, leadY = (th.vy || 0) * 0.18;
                                const ldx = this.x - (th.x + leadX), ldy = this.y - (th.y + leadY);
                                const ldd = Math.hypot(ldx, ldy) || 1;
                                px = ldx / ldd; py = ldy / ldd;
                            }
                            ax += px * wg;
                            ay += py * wg;
                            if (wg > panic) panic = wg;
                        }
                    }
                }

                // 2. Реакция на стайную тревогу (Pack alarm)
                if (this.alarmT > 0 && panic < 0.8) {
                    const adx = this.x - this.alarmThreatX, ady = this.y - this.alarmThreatY;
                    const add = Math.hypot(adx, ady) || 1;
                    const alarmWeight = (this.alarmT / 1.7) * 0.75;
                    ax += (adx / add) * alarmWeight;
                    ay += (ady / add) * alarmWeight;
                    if (alarmWeight > panic) panic = alarmWeight;
                }

                const lured = g.lureT > 0 && !d.charger && dPlayer < 560;

                // Кабан / Босс: подготовка к тарану
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
                    const wasPanic = (this.state === 'panic');
                    this.state = 'panic';
                    this.idle = false;

                    // При начале паники подаём сигнал тревоги стае
                    if (!wasPanic) {
                        this.alert = 0.5;
                        const thX = closestThreat ? closestThreat.x : pl.x;
                        const thY = closestThreat ? closestThreat.y : pl.y;
                        this.triggerPackAlarm(g, thX, thY);
                        if (this.squealCd <= 0 && g.state === 'play') {
                            g.sfx.oink();
                            this.squealCd = U.rand(2.2, 4.0);
                        }
                    } else if (this.squealCd <= 0 && Math.random() < dt * 0.35 && g.state === 'play') {
                        // Периодический визг в панике поддерживает стайную настороженность
                        const thX = closestThreat ? closestThreat.x : pl.x;
                        const thY = closestThreat ? closestThreat.y : pl.y;
                        this.triggerPackAlarm(g, thX, thY);
                        g.sfx.oink();
                        this.squealCd = U.rand(2.6, 4.6);
                    }

                    let l = Math.hypot(ax, ay) || 1;
                    ax /= l; ay /= l;

                    // 3. Увороты и зигзаги (Evasive zig-zagging / Jinking)
                    const threatIsDashing = closestThreat && closestThreat.dashing;
                    const threatIsClose = closestThreatDist < (145 + iq * 40);
                    // Истощенная свинья неповоротлива и не может делать резкие увороты/зигзаги
                    if ((threatIsClose || threatIsDashing) && this.fatigueT <= 0) {
                        this.jinkTimer -= dt;
                        if (this.jinkTimer <= 0) {
                            this.jinkSide = -this.jinkSide;
                            this.jinkTimer = U.rand(0.2, 0.42) / (0.8 + iq * 0.6);
                        }
                        const perpX = -ay * this.jinkSide;
                        const perpY = ax * this.jinkSide;
                        // При рывке ловца — резкий срез под 90 градусов
                        const jinkStr = threatIsDashing ? (1.3 + iq * 0.4) : (1 - closestThreatDist / (150 + iq * 40)) * (0.45 + iq * 0.7);
                        ax += perpX * jinkStr;
                        ay += perpY * jinkStr;
                        l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l;
                    }

                    // Хаотичность мелких поросят
                    if (d.erratic) {
                        const j = Math.sin(this.t * 8.5 + this.seed) * 0.85;
                        const c = Math.cos(j), s = Math.sin(j);
                        const nx = ax * c - ay * s;
                        ay = ax * s + ay * c;
                        ax = nx;
                        l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l;
                    }

                    // 4. Окружение и укрытия:
                    // А) Заборы и тупики: избегание застревания в углах
                    const m = 125 + iq * 40;
                    let wx = 0, wy = 0;
                    if (this.x < w.margin + m) wx += 1 - (this.x - w.margin) / m;
                    else if (this.x > w.w - w.margin - m) wx -= 1 - (w.w - w.margin - this.x) / m;
                    if (this.y < w.margin + m) wy += 1 - (this.y - w.margin) / m;
                    else if (this.y > w.h - w.margin - m) wy -= 1 - (w.h - w.margin - this.y) / m;

                    // Зажата в углу — бежим к открытому центру карты
                    if (Math.abs(wx) > 0.25 && Math.abs(wy) > 0.25) {
                        const cx = (w.w * 0.5 - this.x) / (w.w * 0.5);
                        const cy = (w.h * 0.5 - this.y) / (w.h * 0.5);
                        const escapeCornerWeight = (0.9 + iq * 0.8);
                        ax += cx * escapeCornerWeight;
                        ay += cy * escapeCornerWeight;
                    } else if (wx || wy) {
                        ax += wx * 1.6 - wy * this.side * 1.4;
                        ay += wy * 1.6 + wx * this.side * 1.4;
                    }

                    // Обход препятствий
                    const av = w.avoid(this.x, this.y, this.r + 36);
                    ax += av.x * 1.8;
                    ay += av.y * 1.8;

                    // Б) Укрытие в кустах / сене (сбивает преследование)
                    if (iq >= 0.25 && w.props && w.props.length > 0) {
                        let bestBush = null, bestBushScore = -Infinity;
                        for (let i = 0; i < w.props.length; i++) {
                            const pr = w.props[i];
                            if (pr.type !== 'bush' && pr.type !== 'hay') continue;
                            const bdx = pr.x - this.x, bdy = pr.y - this.y;
                            const bdist = Math.hypot(bdx, bdy);
                            if (bdist > 280) continue;
                            const toThreatDist = closestThreat ? Math.hypot(pr.x - closestThreat.x, pr.y - closestThreat.y) : 300;
                            const score = (280 - bdist) + (toThreatDist > 100 ? 60 : -100);
                            if (score > bestBushScore) {
                                bestBushScore = score;
                                bestBush = pr;
                            }
                        }
                        if (bestBush) {
                            const bdx = bestBush.x - this.x, bdy = bestBush.y - this.y;
                            const bdist = Math.hypot(bdx, bdy) || 1;
                            const coverWeight = (0.35 + iq * 0.35) * (1 - bdist / 280);
                            ax += (bdx / bdist) * coverWeight;
                            ay += (bdy / bdist) * coverWeight;

                            if (bdist < (bestBush.r || 18) + 12) {
                                this.inCover = true;
                                this.coverT = 0.35;
                            }
                        }
                    }

                    // В) Грязь: Грязнуля и умные свиньи направляются к лужам, в которых игрок замедляется
                    if ((d.mud || iq >= 0.5) && w.puddles && w.puddles.length > 0) {
                        let bestPuddle = null, bestPuddleDist = 260;
                        for (let i = 0; i < w.puddles.length; i++) {
                            const pud = w.puddles[i];
                            const pdx = pud.x - this.x, pdy = pud.y - this.y;
                            const pdist = Math.hypot(pdx, pdy);
                            if (pdist < bestPuddleDist) {
                                bestPuddleDist = pdist;
                                bestPuddle = pud;
                            }
                        }
                        if (bestPuddle) {
                            const pdx = bestPuddle.x - this.x, pdy = bestPuddle.y - this.y;
                            const pdist = Math.hypot(pdx, pdy) || 1;
                            const mudBias = d.mud ? 0.75 : 0.35 * iq;
                            ax += (pdx / pdist) * mudBias;
                            ay += (pdy / pdist) * mudBias;
                        }
                    }

                    l = Math.hypot(ax, ay) || 1;
                    ax /= l; ay /= l;

                    // 5. Панический спринт-рывок (Panic sprint burst)
                    const isCornered = (closestThreatDist < 80) ||
                                       (threatIsDashing && closestThreatDist < 125) ||
                                       ((wx !== 0 || wy !== 0) && closestThreatDist < 110);
                    if (isCornered && this.sprintGauge >= 0.85 && this.sprintCd <= 0 && this.tired <= 0 && this.sprintBurstT <= 0 && this.fatigueT <= 0) {
                        this.sprintBurstT = 0.50;
                        this.sprintGauge = 0;
                        this.sprintCd = this.sprintCooldownMax;
                        this.isSprinting = true;
                        // Срезаем под углом вокруг ловца
                        const cutX = -ay * this.jinkSide * 0.85, cutY = ax * this.jinkSide * 0.85;
                        ax += cutX; ay += cutY;
                        l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l;

                        g.fx.dust(this.x, this.y + this.r * 0.5, 4, g.dustColor);
                        if (this.type === 'runner') {
                            g.fx.text(this.x, this.y - this.r - 20, '⚡ ВЖУХ!', { color: '#ffd23f', size: 16, life: 0.5 });
                        } else if (d.ninja) {
                            g.fx.text(this.x, this.y - this.r - 20, '💨 ШАГ!', { color: '#e2e8f0', size: 16, life: 0.5 });
                        } else {
                            g.fx.text(this.x, this.y - this.r - 18, '💨 РЫВОК!', { color: '#bbf7d0', size: 15, life: 0.45 });
                        }
                        if (g.sfx && g.sfx.dash) g.sfx.dash();
                    }

                    // Усталость: долго в панике — выдыхается
                    if (this.tired > 0) {
                        this.tired -= dt;
                        if (this.tired <= 0) this.stam = d.stamina;
                    } else {
                        this.stam -= dt;
                        if (this.stam <= 0) {
                            this.tired = 2.3;
                            g.fx.text(this.x, this.y - this.r - 16, 'уфф…', { color: '#bfe3ff', size: 15, life: 0.8 });
                        }
                    }

                    let v = d.panic * (this.tired > 0 ? 0.5 : 1);
                    if (this.sprintBurstT > 0) {
                        v *= 1.62;
                        accel = 20;
                        if (Math.random() < dt * 15) g.fx.dust(this.x, this.y + this.r * 0.5, 1, g.dustColor);
                    } else if (this.fatigueT > 0) {
                        accel = 2.4; // Неповоротливый радиус разворота при истощении (sluggish turn rate)
                    } else {
                        accel = 7.5;
                    }

                    if (d.mud && w.inMud(this.x, this.y)) {
                        v *= 1.1;
                    }

                    tvx = ax * v; tvy = ay * v;

                    if (d.mud) {
                        this.mudT -= dt;
                        if (this.mudT <= 0) {
                            w.addPuddle(this.x, this.y + this.r * 0.5, U.rand(30, 40), 10);
                            this.mudT = 0.85;
                        }
                    }
                    if (Math.random() < dt * 9) g.fx.dust(this.x - this.vx * 0.05, this.y + this.r * 0.6, 1, g.dustColor);

                    // 6. Акробатический прыжок через реку при бегстве к противоположному берегу
                    if (w.river && this.jumpCd <= 0) {
                        const leaped = this.checkRiverJump(w, g, closestThreat, closestThreatDist, ax, ay, panic);
                        if (leaped) return;
                    }
                } else {
                    // Спокойное блуждание (Wander) со стайным поведением (Flocking)
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
                    else {
                        let flX = this.hx, flY = this.hy;
                        if ((this.type === 'piglet' || this.type === 'pink') && g.pigs && g.pigs.length > 1) {
                            let flockCount = 0, avgX = 0, avgY = 0;
                            for (let i = 0; i < g.pigs.length; i++) {
                                const other = g.pigs[i];
                                if (other === this || !other.active || other.state === 'escape' || other.state === 'caught') continue;
                                const fdx = other.x - this.x, fdy = other.y - this.y;
                                const fdist = Math.hypot(fdx, fdy);
                                if (fdist < 110 && fdist > 15) {
                                    avgX += fdx; avgY += fdy;
                                    flockCount++;
                                }
                            }
                            if (flockCount > 0) {
                                avgX /= flockCount; avgY /= flockCount;
                                const al = Math.hypot(avgX, avgY) || 1;
                                flX += (avgX / al) * 0.35;
                                flY += (avgY / al) * 0.35;
                                const flLen = Math.hypot(flX, flY) || 1;
                                flX /= flLen; flY /= flLen;
                            }
                        }
                        tvx = flX * d.speed; tvy = flY * d.speed;
                    }
                    accel = this.fatigueT > 0 ? 2.0 : 4;
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

        if (this.state !== 'escape' && !this.isJumping) {
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

    /**
     * Проверка и инициация акробатического прыжка свиньи через реку
     */
    checkRiverJump(w, g, closestThreat, closestThreatDist, ax, ay, panic) {
        if (!w || !w.river || !w.getRiverInfo || this.jumpCd > 0 || this.isJumping) return false;
        if (this.caught || this.state === 'escape' || this.state === 'dizzy' || this.state === 'telegraph') return false;

        // Не прыгаем, если свинья уже находится на мостике
        if (w.isOnBridge(this.x, this.y, 24)) return false;

        const rInfo = w.getRiverInfo(this.x, this.y);
        if (!rInfo) return false;

        // Расстояние до кромки воды (от -15 до 75px)
        const dBank = rInfo.distToBank;
        if (dBank < -15 || dBank > 75) return false;

        // Проверяем направление бега в сторону противоположного берега
        let headingTowardRiver = false;
        let targetX = 0;

        if (rInfo.bank === 'west') {
            // Свинья на западном берегу, река на востоке
            const threatPushing = closestThreat && (closestThreat.x < this.x + 35);
            if (ax > 0.04 || this.vx > 8 || threatPushing || this.isSprinting) {
                headingTowardRiver = true;
                targetX = rInfo.rx + rInfo.rw * 0.5 + U.rand(28, 48);
            }
        } else {
            // Свинья на восточном берегу, река на западе
            const threatPushing = closestThreat && (closestThreat.x > this.x - 35);
            if (ax < -0.04 || this.vx < -8 || threatPushing || this.isSprinting) {
                headingTowardRiver = true;
                targetX = rInfo.rx - rInfo.rw * 0.5 - U.rand(28, 48);
            }
        }

        if (!headingTowardRiver) return false;

        // Свинья должна быть в панике, спасаться от погони или бежать в спринте
        const inPanic = (this.state === 'panic' || this.isSprinting || this.sprintBurstT > 0 || panic > 0.18 || closestThreatDist < 260);
        if (!inPanic && Math.random() > 0.25) return false;

        // Точка приземления с учетом вертикальной скорости и легкого разброса
        const driftY = (this.vy || 0) * 0.28 + U.rand(-25, 25);
        const targetY = U.clamp(this.y + driftY, w.margin + 45, w.h - w.margin - 45);

        // Инициация прыжка
        const leapDist = Math.hypot(targetX - this.x, targetY - this.y);
        this.jumpStartX = this.x;
        this.jumpStartY = this.y;
        this.jumpEndX = targetX;
        this.jumpEndY = targetY;
        this.jumpDur = U.clamp(leapDist / 200, 0.65, 0.85);
        this.jumpT = 0;
        this.jumpArcH = Math.min(35, 22 + leapDist * 0.08);
        this.isJumping = true;
        this.facing = (targetX >= this.x) ? 1 : -1;

        if (g.fx) {
            g.fx.dust(this.x, this.y + this.r * 0.5, 4, g.dustColor || '#d4b483');
            g.fx.ring(this.x, this.y + this.r * 0.4, 18, 'rgba(255,255,255,0.7)', 0.3, 2.5);
            const cheer = (this.type === 'runner' || (this.def && this.def.ninja)) ? '🦘 ПРЫЖОК!' : '💨 ХОП!';
            g.fx.text(this.x, this.y - this.r - 20, cheer, { color: '#fef08a', size: 15, life: 0.5 });
        }
        if (g.sfx) {
            if (g.sfx.dash) g.sfx.dash();
            else if (g.sfx.oink) g.sfx.oink();
        }

        return true;
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
        this.fatigueT = 0;
        this.isFatigued = false;
        this.sprintGauge = 1.0;
        this.sprintBurstT = 0;
        this.state = 'wander';
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
        } else if (this.isJumping) {
            const jt = Math.min(1, Math.max(0, this.jumpT));
            lift = Math.sin(Math.PI * jt) * this.jumpArcH;
            const puff = 1 + Math.sin(Math.PI * jt) * 0.20;
            sc *= puff;
            rot = Math.sin(Math.PI * jt) * 0.28 * this.facing;
            // Тень проецируется на поверхность земли / воды под свинкой
            const shadowFade = 0.24 * (1 - 0.45 * (lift / this.jumpArcH));
            const shadowR = Math.max(9, (19 - 4 * (lift / this.jumpArcH))) * d.scale;
            ctx.fillStyle = `rgba(15, 30, 40, ${shadowFade})`;
            ctx.beginPath(); ctx.ellipse(x, y + 13 * d.scale, shadowR, shadowR * 0.38, 0, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.fillStyle = 'rgba(20,40,20,0.22)';
            ctx.beginPath(); ctx.ellipse(x, y + 13 * sc, 19 * sc, 7 * sc, 0, 0, Math.PI * 2); ctx.fill();
        }

        const speed = Math.hypot(this.vx, this.vy);
        const running = (speed > 20 || this.isJumping) && !this.caught && this.frozen <= 0;
        const hop = running ? Math.abs(Math.sin(this.anim)) * (speed > 120 ? 4.5 : 2.2) : 0;
        const pop = this.spawnPop < 1 ? U.easeOutBack(this.spawnPop) : 1;

        ctx.save();
        ctx.translate(x, y - lift - hop * sc);
        let shakeX = 0;
        if (this.state === 'telegraph') shakeX = Math.sin(this.t * 70) * 2.5;
        if (this.state === 'dizzy') rot = Math.sin(this.t * 6) * 0.12;
        ctx.translate(shakeX, 0);

        let squash = 1;
        if (this.fatigueT > 0) {
            // Быстрое запыхавшееся дыхание / одышка (panting animation)
            const pant = Math.sin(this.pantingAnim);
            squash = 1 + pant * 0.09;
            rot += Math.sin(this.t * 8) * 0.05;
        } else if (running) {
            squash = 1 + Math.sin(this.anim * 2) * 0.05;
        } else {
            squash = 1 + Math.sin(this.t * 2.2) * 0.02;
        }

        ctx.rotate(rot);
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
        const walk = this.isJumping ? Math.sin(this.t * 32) * 8.5 : (running ? Math.sin(this.anim) * 5 : 0);
        const panic = this.state === 'panic' || this.state === 'burst' || this.state === 'escape' || this.isJumping;

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
        const earW = this.fatigueT > 0 ? -4.5 : (panic ? -2 : Math.sin(this.t * 3 + this.seed) * 0.8);
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
        const blink = (this.t + this.seed) % 3.7 < 0.1 && !panic && this.fatigueT <= 0;
        if (this.state === 'dizzy') {
            ctx.strokeStyle = '#1f1320'; ctx.lineWidth = 1.8;
            ctx.beginPath(); ctx.moveTo(8, -6.5); ctx.lineTo(13, -1.5); ctx.moveTo(13, -6.5); ctx.lineTo(8, -1.5); ctx.stroke();
        } else if (this.fatigueT > 0) {
            // Уставшие полуприкрытые глаза при истощении
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(10.5, -4, 3.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1f1320';
            ctx.beginPath(); ctx.arc(11.2, -3.6, 1.8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = dark;
            ctx.beginPath(); ctx.arc(10.5, -4, 3.4, Math.PI, Math.PI * 2); ctx.fill();
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
        // Открытый рот в панике и при одышке
        if (panic || this.fatigueT > 0) {
            ctx.fillStyle = '#7a1f3a';
            const mouthH = this.fatigueT > 0 ? (2.4 + Math.sin(this.pantingAnim) * 0.8) : 2.2;
            ctx.beginPath(); ctx.ellipse(13.5, 8, 2.8, Math.max(1.2, mouthH), 0, 0, Math.PI * 2); ctx.fill();
            if (this.fatigueT > 0) {
                // Высунутый розовый язычок при одышке
                ctx.fillStyle = '#fb7185';
                const tongueY = 8.8 + Math.sin(this.pantingAnim) * 0.4;
                ctx.beginPath(); ctx.ellipse(15.2, tongueY, 1.8, 1.3, 0.2, 0, Math.PI * 2); ctx.fill();
            }
        }

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
        // Маскировка в кустах / траве
        if (this.inCover) {
            ctx.fillStyle = '#4ade80'; ctx.strokeStyle = '#166534'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.ellipse(-9, -15, 5, 2.6, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(7, -17, 5.5, 3, 0.45, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
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
        if (this.fatigueT > 0) {
            // Эффект капель пота 💦 над головой при истощении после рывка
            const sweatBounce = Math.sin(this.t * 9) * 2.5;
            ctx.font = `${Math.round(15 * sc)}px sans-serif`;
            ctx.fillText('💦', x + 11 * this.facing * sc, top - 6 + sweatBounce);

            // Анимированные маленькие капельки пота
            ctx.fillStyle = '#60a5fa';
            for (let i = 0; i < 2; i++) {
                const ph = (this.t * 3.2 + i * 0.5) % 1;
                ctx.globalAlpha = (1 - ph) * 0.85;
                ctx.beginPath();
                ctx.arc(x + (i === 0 ? -10 : 10) * sc, top - 2 + ph * 14 * sc, 2.2 * sc, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        } else if (this.state === 'telegraph') {
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

        // Шкала спринта свиньи и восстановление после истощения
        if (this.state === 'panic' || this.sprintGauge < 0.98 || this.sprintBurstT > 0 || this.fatigueT > 0) {
            const gw = 26 * sc, gh = 3.2;
            const gx = x - gw / 2;
            const gy = y + (this.maxHp > 1 && !this.def.boss ? 34 : 20) * sc;
            ctx.fillStyle = 'rgba(20,20,30,0.65)';
            ctx.beginPath(); ctx.roundRect(gx - 1, gy - 1, gw + 2, gh + 2, 2); ctx.fill();
            let col = '#38bdf8';
            if (this.sprintBurstT > 0) col = '#ffdd00';
            else if (this.fatigueT > 0) col = '#f43f5e'; // Красная шкала истощения
            else if (this.sprintGauge < 0.85) col = '#94a3b8';
            ctx.fillStyle = col;
            const fillRatio = this.fatigueT > 0 ? (1 - this.fatigueT / this.fatigueDur) : this.sprintGauge;
            ctx.beginPath(); ctx.roundRect(gx, gy, Math.max(0, gw * fillRatio), gh, 1.5); ctx.fill();
        }
    }
}

Pig.dispersionSeq = 0;
