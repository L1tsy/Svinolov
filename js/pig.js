/**
 * Класс свиньи с простым ИИ и процедурной отрисовкой
 */
class Pig {
    constructor(x, y, config = {}, options = {}) {
        this.id = 'pig_' + Math.random().toString(36).substring(2, 9);
        this.x = x;
        this.y = y;
        this.config = config;

        // Архитектурный задел под будущие виды свиней (например, BigPig)
        this.isBig = options.isBig || false;
        this.requiredCatchers = this.isBig ? 2 : 1;
        this.coinReward = this.isBig ? 10 : 1; // Большая свинья приносит 10 монет!
        this.currentCatchers = new Set(); // кто сейчас удерживает свинью

        // Размеры и физика
        this.radius = this.isBig ? 28 : 17;
        this.baseSpeed = (config.PIG_BASE_SPEED || 80) * (this.isBig ? 0.8 : 1);
        this.panicSpeed = (config.PIG_PANIC_SPEED || 185) * (this.isBig ? 0.85 : 1);
        this.panicRadius = (config.PIG_PANIC_RADIUS || 125) * (this.isBig ? 1.2 : 1);

        // Вектор движения
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle);
        this.vy = Math.sin(angle);
        this.speed = this.baseSpeed;

        // Состояние
        this.state = 'WANDER'; // 'WANDER' | 'PANIC' | 'CAUGHT'
        this.wanderTimer = Math.random() * 2 + 1; // время до следующей смены направления
        this.isIdle = false;
        this.idleTimer = 0;
        this.facing = this.vx >= 0 ? 1 : -1;
        this.animTimer = Math.random() * 10;

        // Статус поимки
        this.caught = false;
        this.isInBarn = false;
        this.caughtAnimationTimer = 0;
        this.caughtTargetX = 0;
        this.caughtTargetY = 0;

        // Внешность (оттенки розового)
        this.skinColor = this.isBig ? '#f472b6' : '#f9a8d4';
        this.snoutColor = '#f43f5e';
        this.earColor = '#fb7185';
    }

    /**
     * Поимка свиньи и отправка в загон
     * @param {number} penX X-координата загона
     * @param {number} penY Y-координата загона
     */
    catch(penX, penY) {
        if (this.caught) return false;
        this.caught = true;
        this.state = 'CAUGHT';
        this.caughtTargetX = penX;
        this.caughtTargetY = penY;
        this.caughtAnimationTimer = 0;
        return true;
    }

    /**
     * Проверка, попал ли клик/тап по свинье
     */
    isClicked(clickX, clickY, extraRadius = 14) {
        if (this.caught) return false;
        const dist = Math.hypot(clickX - this.x, clickY - this.y);
        return dist <= (this.radius + extraRadius);
    }

    /**
     * Обновление ИИ и положения
     * @param {number} dt Секунды
     * @param {number} arenaWidth 
     * @param {number} arenaHeight 
     * @param {Array<{x: number, y: number}>} threats Угрозы (курсор, палец, игрок)
     * @param {Object} pen Прямоугольник загона {x, y, width, height}
     */
    update(dt, arenaWidth, arenaHeight, threats = [], pen = null) {
        this.animTimer += dt * (this.state === 'PANIC' ? 18 : 8);

        // Если свинья поймана — летит в амбар
        if (this.caught) {
            this.caughtAnimationTimer += dt;
            this.x += (this.caughtTargetX - this.x) * (dt * 8);
            this.y += (this.caughtTargetY - this.y) * (dt * 8);
            if (this.caughtAnimationTimer >= 0.5) {
                this.isInBarn = true;
            }
            return;
        }

        // Поиск ближайшей угрозы (курсор мыши, тач, игрок, помощники)
        let closestThreat = null;
        let minThreatDist = Infinity;

        for (const t of threats) {
            if (!t) continue;
            const dist = Math.hypot(this.x - t.x, this.y - t.y);
            if (dist < minThreatDist) {
                minThreatDist = dist;
                closestThreat = t;
            }
        }

        // Логика паники при угрозе
        if (closestThreat && minThreatDist < this.panicRadius) {
            this.state = 'PANIC';
            this.isIdle = false;
            this.speed = this.panicSpeed;

            // Вектор убегания — строго ОТ угрозы
            let awayX = this.x - closestThreat.x;
            let awayY = this.y - closestThreat.y;
            const len = Math.hypot(awayX, awayY) || 1;
            this.vx = awayX / len;
            this.vy = awayY / len;
        } else {
            // Спокойное блуждание
            this.state = 'WANDER';
            this.speed = this.baseSpeed;

            if (this.isIdle) {
                this.idleTimer -= dt;
                if (this.idleTimer <= 0) {
                    this.isIdle = false;
                    this.wanderTimer = Math.random() * 2.5 + 1.2;
                }
            } else {
                this.wanderTimer -= dt;
                if (this.wanderTimer <= 0) {
                    // Случайный шанс остановиться и понюхать травку
                    if (Math.random() < 0.3) {
                        this.isIdle = true;
                        this.idleTimer = Math.random() * 1.5 + 0.5;
                    } else {
                        const angle = Math.random() * Math.PI * 2;
                        this.vx = Math.cos(angle);
                        this.vy = Math.sin(angle);
                        this.wanderTimer = Math.random() * 3 + 1;
                    }
                }
            }
        }

        // Движение свиньи
        if (!this.isIdle) {
            this.x += this.vx * this.speed * dt;
            this.y += this.vy * this.speed * dt;

            if (Math.abs(this.vx) > 0.1) {
                this.facing = this.vx >= 0 ? 1 : -1;
            }
        }

        // Отталкивание от зданий и амбара, чтобы свиньи не застревали в них
        if (pen) {
            const list = Array.isArray(pen) ? pen : [pen];
            for (const obs of list) {
                if (!obs) continue;
                const margin = this.radius + 6;
                if (this.x > obs.x - margin && this.x < obs.x + obs.width + margin &&
                    this.y > obs.y - margin && this.y < obs.y + obs.height + margin) {
                    
                    if (this.x < obs.x + obs.width / 2) {
                        this.x = obs.x - margin;
                        this.vx = -Math.abs(this.vx);
                    } else {
                        this.x = obs.x + obs.width + margin;
                        this.vx = Math.abs(this.vx);
                    }

                    if (this.y < obs.y + obs.height / 2) {
                        this.y = obs.y - margin;
                        this.vy = -Math.abs(this.vy);
                    } else {
                        this.y = obs.y + obs.height + margin;
                        this.vy = Math.abs(this.vy);
                    }
                }
            }
        }

        // Отскок от границ экрана
        const pad = this.radius + 10;
        if (this.x < pad) {
            this.x = pad;
            this.vx = Math.abs(this.vx);
            this.facing = 1;
        } else if (this.x > arenaWidth - pad) {
            this.x = arenaWidth - pad;
            this.vx = -Math.abs(this.vx);
            this.facing = -1;
        }

        if (this.y < pad) {
            this.y = pad;
            this.vy = Math.abs(this.vy);
        } else if (this.y > arenaHeight - pad) {
            this.y = arenaHeight - pad;
            this.vy = -Math.abs(this.vy);
        }
    }

    /**
     * Процедурная отрисовка милой свиньи на Canvas
     */
    draw(ctx) {
        if (this.isInBarn) return;
        ctx.save();
        ctx.translate(this.x, this.y);

        // Если свинья поймана — уменьшаем масштаб
        if (this.caught) {
            const scale = Math.max(0.15, 1 - (this.caughtAnimationTimer / 0.5) * 0.7);
            ctx.scale(scale, scale);
        }

        // Тень под свиньей
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.beginPath();
        ctx.ellipse(0, this.radius * 0.7, this.radius * 0.9, this.radius * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();

        // Подпрыгивание при беге
        const bounce = (!this.isIdle && !this.caught) ? Math.abs(Math.sin(this.animTimer)) * 3 : 0;
        ctx.translate(0, -bounce);

        // Поворот по горизонтали
        ctx.scale(this.facing, 1);

        // Масштаб для большой свиньи
        if (this.isBig) {
            ctx.scale(1.5, 1.5);
        }

        // Закрученный хвостик сзади
        ctx.strokeStyle = this.skinColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-16, -2);
        ctx.bezierCurveTo(-22, -6, -24, 4, -19, 7);
        ctx.bezierCurveTo(-16, 8, -21, 1, -22, -2);
        ctx.stroke();

        // Копытца (ножки)
        const legWalk = (!this.isIdle && !this.caught) ? Math.sin(this.animTimer) * 5 : 0;
        ctx.fillStyle = '#641b2e'; // тёмные копытца
        // Задние ноги
        ctx.fillRect(-12 - legWalk * 0.6, 8, 4, 8);
        ctx.fillRect(-6 + legWalk * 0.6, 8, 4, 8);
        // Передние ноги
        ctx.fillRect(4 + legWalk, 8, 4, 8);
        ctx.fillRect(10 - legWalk, 8, 4, 8);

        // Тело свинки (пухлый овал)
        ctx.fillStyle = this.skinColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // Милое пятнышко грязи на спинке
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(-5, -6, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Ушки
        ctx.fillStyle = this.earColor;
        // Левое ухо (заднее)
        ctx.beginPath();
        ctx.moveTo(6, -11);
        ctx.lineTo(10, -18);
        ctx.lineTo(13, -10);
        ctx.closePath();
        ctx.fill();

        // Правое ухо (переднее)
        ctx.beginPath();
        ctx.moveTo(10, -9);
        ctx.lineTo(15, -16);
        ctx.lineTo(17, -7);
        ctx.closePath();
        ctx.fill();

        // Глаз
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(11, -4, 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Блик в глазу
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(11.7, -4.7, 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Пятачок
        ctx.fillStyle = this.snoutColor;
        ctx.beginPath();
        ctx.ellipse(17, 1, 4.5, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ноздри
        ctx.fillStyle = '#9f1239';
        ctx.beginPath();
        ctx.arc(17.5, -0.8, 0.9, 0, Math.PI * 2);
        ctx.arc(17.5, 2.5, 0.9, 0, Math.PI * 2);
        ctx.fill();

        // Эмоция паники (капелька пота или восклицательный знак)
        if (this.state === 'PANIC') {
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(6, -18, 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(4, -18);
            ctx.lineTo(6, -23);
            ctx.lineTo(8, -18);
            ctx.closePath();
            ctx.fill();
        }

        // Золотая корона и плашка для большой свиньи
        if (this.isBig) {
            // Корона на голове
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.moveTo(6, -12);
            ctx.lineTo(4, -18);
            ctx.lineTo(8, -15);
            ctx.lineTo(12, -20);
            ctx.lineTo(15, -15);
            ctx.lineTo(18, -18);
            ctx.lineTo(16, -12);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#b45309';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Бейджик над большой свиньей
            ctx.save();
            ctx.scale(this.facing, 1); // не зеркалим текст
            ctx.fillStyle = '#b45309';
            ctx.beginPath();
            ctx.roundRect(-42, -32, 84, 15, 4);
            ctx.fill();
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 8.5px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('👑 БОЛЬШАЯ (+10 🪙)', 0, -22);
            ctx.restore();
        }

        ctx.restore();
    }
}
