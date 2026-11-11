/**
 * Класс игрока (фермера-свинолова)
 */
class Player {
    constructor(x, y, config = {}) {
        this.id = 'player';
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.radius = 18; // физический радиус столкновений

        // Механика ловли областью вокруг с кулдауном
        this.catchRadius = config.CATCH_RADIUS || 48; // радиус кружка действия сачка вокруг
        this.catchCooldown = config.CATCH_COOLDOWN || 1.0; // 1 секунда между поимками
        this.catchCooldownTimer = 0; // текущий таймер отката
        this.speed = config.PLAYER_SPEED || 235;

        // Вектор непрерывного движения (WASD / D-Pad)
        this.moveDir = { x: 0, y: 0 };
        this.hasKeyboardInput = false;

        this.facing = 1; // 1 - вправо, -1 - влево
        this.isMoving = false;
        this.walkAnimTimer = 0;

        // Анимация взмаха сачком и области кружка
        this.swingTimer = 0;
        this.isSwinging = false;
        this.swingCircleTimer = 0;

        this.color = '#2563eb'; // синий комбинезон
        this.hatColor = '#eab308'; // соломенная шляпа
    }

    /**
     * Задать направление движения от клавиш WASD / Стрелок / D-Pad
     */
    setMoveDirection(dx, dy) {
        this.moveDir.x = dx;
        this.moveDir.y = dy;
        this.hasKeyboardInput = (dx !== 0 || dy !== 0);
    }

    /**
     * Установка точки движения (по клику/тапу)
     */
    setTarget(tx, ty) {
        this.targetX = tx;
        this.targetY = ty;
        this.hasKeyboardInput = false;
    }

    /**
     * Сброс позиции
     */
    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.moveDir.x = 0;
        this.moveDir.y = 0;
        this.isMoving = false;
        this.hasKeyboardInput = false;
        this.catchCooldownTimer = 0;
    }

    /**
     * Готов ли игрок поймать свинью (прошла ли 1 секунда кулдауна)
     */
    canCatch() {
        return this.catchCooldownTimer <= 0;
    }

    /**
     * Запуск взмаха сачком и кружка области действия
     */
    swing() {
        this.isSwinging = true;
        this.swingTimer = 0.25;
        this.swingCircleTimer = 0.22; // длительность отображения кружка сачка
    }

    /**
     * Фиксация успешной поимки (включение 1-секундного кулдауна)
     */
    onSuccessfulCatch() {
        this.catchCooldownTimer = this.catchCooldown;
    }

    /**
     * Обновление состояния игрока
     * @param {number} dt Дельта времени в секундах
     * @param {number} arenaWidth 
     * @param {number} arenaHeight 
     * @param {Array<Object>} obstacles Список зданий и препятствий для коллизий
     */
    update(dt, arenaWidth, arenaHeight, obstacles = []) {
        // Таймер перезарядки поимки
        if (this.catchCooldownTimer > 0) {
            this.catchCooldownTimer = Math.max(0, this.catchCooldownTimer - dt);
        }

        // Таймер взмаха сачком
        if (this.isSwinging) {
            this.swingTimer -= dt;
            if (this.swingTimer <= 0) {
                this.isSwinging = false;
            }
        }

        if (this.swingCircleTimer > 0) {
            this.swingCircleTimer -= dt;
        }

        let vx = 0;
        let vy = 0;

        // Перемещение по направлению ввода (WASD / Стрелки / D-Pad)
        const len = Math.hypot(this.moveDir.x, this.moveDir.y);
        if (len > 0.01) {
            vx = (this.moveDir.x / len) * this.speed;
            vy = (this.moveDir.y / len) * this.speed;
            this.isMoving = true;
            this.walkAnimTimer += dt * 11;

            if (Math.abs(vx) > 5) {
                this.facing = vx >= 0 ? 1 : -1;
            }
            this.targetX = this.x;
            this.targetY = this.y;
        } else {
            // Если клавиши не зажаты — фермер спокойно стоит на месте
            this.isMoving = false;
            this.walkAnimTimer = 0;
        }

        // Применяем скорость
        this.x += vx * dt;
        this.y += vy * dt;

        // Коллизии со зданиями (амбар, домики)
        if (Array.isArray(obstacles)) {
            for (const obs of obstacles) {
                if (!obs) continue;
                const pad = this.radius;
                if (this.x > obs.x - pad && this.x < obs.x + obs.width + pad &&
                    this.y > obs.y - pad && this.y < obs.y + obs.height + pad) {
                    
                    const dLeft = Math.abs(this.x - (obs.x - pad));
                    const dRight = Math.abs(this.x - (obs.x + obs.width + pad));
                    const dTop = Math.abs(this.y - (obs.y - pad));
                    const dBottom = Math.abs(this.y - (obs.y + obs.height + pad));

                    const minD = Math.min(dLeft, dRight, dTop, dBottom);
                    if (minD === dLeft) this.x = obs.x - pad;
                    else if (minD === dRight) this.x = obs.x + obs.width + pad;
                    else if (minD === dTop) this.y = obs.y - pad;
                    else if (minD === dBottom) this.y = obs.y + obs.height + pad;
                }
            }
        }

        // Ограничение границами экрана
        const margin = this.radius;
        this.x = Math.max(margin, Math.min(arenaWidth - margin, this.x));
        this.y = Math.max(margin, Math.min(arenaHeight - margin, this.y));
    }

    /**
     * Отрисовка фермера, кружка ловли и индикатора перезарядки
     */
    draw(ctx) {
        // 1. Отрисовка кружка области действия сачка при взмахе
        if (this.swingCircleTimer > 0) {
            ctx.save();
            const progress = 1 - (this.swingCircleTimer / 0.22);
            const currentR = this.catchRadius * (0.6 + 0.4 * progress);

            // Полупрозрачный круг области действия
            ctx.fillStyle = 'rgba(245, 158, 11, 0.16)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, currentR, 0, Math.PI * 2);
            ctx.fill();

            // Яркий контур кружка сачка
            ctx.strokeStyle = `rgba(245, 158, 11, ${0.9 - progress * 0.7})`;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.arc(this.x, this.y, currentR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // 2. Индикатор перезарядки над головой (дуга кулдауна 1 сек)
        if (this.catchCooldownTimer > 0) {
            ctx.save();
            const cdRatio = this.catchCooldownTimer / this.catchCooldown;
            const indX = this.x;
            const indY = this.y - 34;

            // Фоновая дуга
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(indX, indY, 11, 0, Math.PI * 2);
            ctx.stroke();

            // Заполняющая дуга готовности
            ctx.strokeStyle = '#ef4444'; // красный при перезарядке
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            // Рисуем оставшуюся долю перезарядки
            ctx.arc(indX, indY, 11, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * (1 - cdRatio)));
            ctx.stroke();

            // Маленький значок сачка внутри
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⏳', indX, indY);
            ctx.restore();
        }

        // 3. Сам персонаж-фермер
        ctx.save();
        ctx.translate(this.x, this.y);

        // Тень под персонажем
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.beginPath();
        ctx.ellipse(0, 16, 16, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Покачивание при ходьбе
        const bobOffset = this.isMoving ? Math.sin(this.walkAnimTimer) * 2.5 : 0;
        ctx.translate(0, bobOffset);

        // Поворот по горизонтали
        ctx.scale(this.facing, 1);

        // Комбинезон
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.roundRect(-12, -4, 24, 22, [4, 4, 6, 6]);
        ctx.fill();

        // Ремни комбинезона
        ctx.strokeStyle = '#1e3a8a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-6, -4);
        ctx.lineTo(-6, 12);
        ctx.moveTo(6, -4);
        ctx.lineTo(6, 12);
        ctx.stroke();

        // Ноги
        const legSwing = this.isMoving ? Math.sin(this.walkAnimTimer) * 4 : 0;
        ctx.fillStyle = '#451a03';
        ctx.fillRect(-9, 18 + legSwing, 6, 6);
        ctx.fillRect(3, 18 - legSwing, 6, 6);

        // Голова
        ctx.fillStyle = '#fed7aa';
        ctx.beginPath();
        ctx.arc(0, -12, 10, 0, Math.PI * 2);
        ctx.fill();

        // Лицо
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(4, -13, 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#9a3412';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(3, -9, 3, 0.1, Math.PI * 0.8);
        ctx.stroke();

        // Соломенная шляпа
        ctx.fillStyle = this.hatColor;
        ctx.beginPath();
        ctx.roundRect(-8, -26, 16, 8, [3, 3, 0, 0]);
        ctx.fill();

        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-8, -20, 16, 3);

        ctx.fillStyle = this.hatColor;
        ctx.beginPath();
        ctx.ellipse(0, -18, 18, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Сачок
        ctx.save();
        ctx.translate(10, 2);

        if (this.isSwinging) {
            ctx.rotate(Math.PI / 4 + Math.sin((0.25 - this.swingTimer) * 20) * 0.7);
        }

        ctx.strokeStyle = '#854d0e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-2, 4);
        ctx.lineTo(16, -10);
        ctx.stroke();

        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(18, -12, 7, 11, Math.PI / 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(241, 245, 249, 0.55)';
        ctx.beginPath();
        ctx.ellipse(21, -10, 6, 9, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.restore();
    }
}
