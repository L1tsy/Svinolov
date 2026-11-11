/**
 * Класс напарника-ловца (автономный помощник, нанимаемый с 10 дня)
 */
class Helper {
    constructor(x, y, config = {}) {
        this.id = 'helper';
        this.x = x;
        this.y = y;
        this.radius = 18;

        // Скорость и радиус сачка помощника
        this.speed = (config.PLAYER_SPEED || 235) * 0.88; // чуть медленнее игрока
        this.catchRadius = (config.CATCH_RADIUS || 52) * 0.95;
        this.catchCooldown = 1.2; // перезарядка помощника
        this.catchCooldownTimer = 0;

        // Вектор и анимация
        this.facing = 1;
        this.isMoving = false;
        this.walkAnimTimer = 0;
        this.swingTimer = 0;
        this.isSwinging = false;
        this.swingCircleTimer = 0;

        // Внешность: зелёный комбинезон и бежевая кепка
        this.color = '#15803d'; // зеленый рабочий комбинезон
        this.hatColor = '#d97706'; // темно-соломенная кепка
    }

    /**
     * Готов ли помощник сделать взмах сачком
     */
    canCatch() {
        return this.catchCooldownTimer <= 0;
    }

    /**
     * Взмах сачком
     */
    swing() {
        this.isSwinging = true;
        this.swingTimer = 0.25;
        this.swingCircleTimer = 0.2;
    }

    /**
     * Успешная поимка
     */
    onSuccessfulCatch() {
        this.catchCooldownTimer = this.catchCooldown;
    }

    /**
     * Автономный ИИ помощника: преследование ближайшей непойманной свиньи
     */
    update(dt, arenaWidth, arenaHeight, obstacles = [], pigs = []) {
        if (this.catchCooldownTimer > 0) {
            this.catchCooldownTimer = Math.max(0, this.catchCooldownTimer - dt);
        }
        if (this.isSwinging) {
            this.swingTimer -= dt;
            if (this.swingTimer <= 0) this.isSwinging = false;
        }
        if (this.swingCircleTimer > 0) {
            this.swingCircleTimer -= dt;
        }

        // Поиск ближайшей свиньи на поле
        let closestPig = null;
        let minDist = Infinity;

        for (const pig of pigs) {
            if (pig.caught || pig.isInBarn) continue;

            const dist = Math.hypot(pig.x - this.x, pig.y - this.y);
            // Приоритет большим свиньям, если они есть
            const priorityBonus = pig.isBig ? -80 : 0;
            if (dist + priorityBonus < minDist) {
                minDist = dist + priorityBonus;
                closestPig = pig;
            }
        }

        let vx = 0;
        let vy = 0;

        if (closestPig) {
            const dx = closestPig.x - this.x;
            const dy = closestPig.y - this.y;
            const dist = Math.hypot(dx, dy);

            if (dist > 28) {
                this.isMoving = true;
                this.walkAnimTimer += dt * 10;
                vx = (dx / dist) * this.speed;
                vy = (dy / dist) * this.speed;

                if (Math.abs(vx) > 3) {
                    this.facing = vx >= 0 ? 1 : -1;
                }
            } else {
                this.isMoving = false;
                this.walkAnimTimer = 0;
            }
        } else {
            // Если свиней нет — стоит на месте
            this.isMoving = false;
            this.walkAnimTimer = 0;
        }

        // Применяем скорость
        this.x += vx * dt;
        this.y += vy * dt;

        // Коллизии со зданиями
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

        // Границы экрана
        const margin = this.radius;
        this.x = Math.max(margin, Math.min(arenaWidth - margin, this.x));
        this.y = Math.max(margin, Math.min(arenaHeight - margin, this.y));
    }

    /**
     * Отрисовка напарника в зеленом комбинезоне с бейджем
     */
    draw(ctx) {
        // Кружок сачка при взмахе
        if (this.swingCircleTimer > 0) {
            ctx.save();
            ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.catchRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(this.x, this.y);

        // Тень
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.beginPath();
        ctx.ellipse(0, 16, 16, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Бейджик над головой «🤝 НАПАРНИК»
        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.roundRect(-30, -38, 60, 14, 4);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🤝 НАПАРНИК', 0, -28);

        // Покачивание
        const bobOffset = this.isMoving ? Math.sin(this.walkAnimTimer) * 2.5 : 0;
        ctx.translate(0, bobOffset);

        ctx.scale(this.facing, 1);

        // Зеленый комбинезон
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.roundRect(-12, -4, 24, 22, [4, 4, 6, 6]);
        ctx.fill();

        // Ремни
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-6, -4);
        ctx.lineTo(-6, 12);
        ctx.moveTo(6, -4);
        ctx.lineTo(6, 12);
        ctx.stroke();

        // Ноги
        const legSwing = this.isMoving ? Math.sin(this.walkAnimTimer) * 4 : 0;
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(-9, 18 + legSwing, 6, 6);
        ctx.fillRect(3, 18 - legSwing, 6, 6);

        // Голова
        ctx.fillStyle = '#ffedd5';
        ctx.beginPath();
        ctx.arc(0, -12, 10, 0, Math.PI * 2);
        ctx.fill();

        // Лицо
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(4, -13, 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#c2410c';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(3, -9, 3, 0.1, Math.PI * 0.8);
        ctx.stroke();

        // Кепка/панама
        ctx.fillStyle = this.hatColor;
        ctx.beginPath();
        ctx.roundRect(-8, -24, 16, 7, [3, 3, 0, 0]);
        ctx.fill();

        ctx.fillStyle = '#15803d';
        ctx.fillRect(-8, -19, 16, 2.5);

        ctx.fillStyle = this.hatColor;
        ctx.beginPath();
        ctx.ellipse(0, -17, 16, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Сачок напарника
        ctx.save();
        ctx.translate(10, 2);

        if (this.isSwinging) {
            ctx.rotate(Math.PI / 4 + Math.sin((0.25 - this.swingTimer) * 20) * 0.7);
        }

        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-2, 4);
        ctx.lineTo(16, -10);
        ctx.stroke();

        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(18, -12, 7, 11, Math.PI / 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(220, 252, 231, 0.6)';
        ctx.beginPath();
        ctx.ellipse(21, -10, 6, 9, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.restore();
    }
}
