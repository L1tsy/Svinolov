/**
 * Управление пользовательским интерфейсом (HUD, плавающие тексты, модальные окна, звуки Web Audio)
 */
class UI {
    constructor() {
        this.coinCountEl = document.getElementById('coin-count');
        this.dayNumberEl = document.getElementById('day-number');
        this.pigsLeftEl = document.getElementById('pigs-left');
        this.dayCompleteModal = document.getElementById('day-complete-modal');
        this.daySummaryText = document.getElementById('day-summary-text');
        this.btnNextDay = document.getElementById('btn-next-day');
        this.btnReset = document.getElementById('btn-reset');

        // Кнопка найма напарника
        this.btnBuyHelper = document.getElementById('btn-buy-helper');
        this.helperIcon = document.getElementById('helper-icon');
        this.helperBtnText = document.getElementById('helper-btn-text');

        // Список всплывающих надписей (плавающие монетки и надписи +1)
        this.floatingTexts = [];

        // Инициализация Web Audio API для процедурных звуков (без внешних файлов)
        this.audioCtx = null;
    }

    /**
     * Инициализация аудио по первому пользовательскому действию (требование браузеров)
     */
    initAudio() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext();
            }
        }
    }

    /**
     * Звук звона монеты при поимке свинки
     */
    playCoinSound() {
        if (!this.audioCtx) return;
        try {
            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(987.77, now); // B5
            osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.12); // E6

            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start(now);
            osc.stop(now + 0.26);
        } catch (e) {}
    }

    /**
     * Звук найма напарника / фанфары
     */
    playHireSound() {
        if (!this.audioCtx) return;
        try {
            const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
            notes.forEach((freq, idx) => {
                const now = this.audioCtx.currentTime + idx * 0.08;
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now);

                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

                osc.connect(gain);
                gain.connect(this.audioCtx.destination);

                osc.start(now);
                osc.stop(now + 0.31);
            });
        } catch (e) {}
    }

    /**
     * Звук фанфар / победы дня
     */
    playDayWinSound() {
        if (!this.audioCtx) return;
        try {
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            notes.forEach((freq, idx) => {
                const now = this.audioCtx.currentTime + idx * 0.1;
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now);

                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

                osc.connect(gain);
                gain.connect(this.audioCtx.destination);

                osc.start(now);
                osc.stop(now + 0.26);
            });
        } catch (e) {}
    }

    /**
     * Обновление основных показателей на экране
     */
    updateHUD(coins, day, caught, total) {
        if (this.coinCountEl) this.coinCountEl.textContent = coins;
        if (this.dayNumberEl) this.dayNumberEl.textContent = day;
        if (this.pigsLeftEl) {
            const remaining = Math.max(0, total - caught);
            this.pigsLeftEl.textContent = `${remaining} / ${total}`;
        }
    }

    /**
     * Обновление состояния кнопки найма напарника
     * @param {number} day Текущий день
     * @param {number} coins Баланс монет
     * @param {boolean} hasHelper Нанят ли уже напарник
     * @param {number} requiredDay Требуемый день (10)
     * @param {number} cost Стоимость (100)
     */
    updateHelperButton(day, coins, hasHelper, requiredDay = 10, cost = 100) {
        if (!this.btnBuyHelper) return;

        this.btnBuyHelper.classList.remove('locked', 'ready', 'active');

        if (hasHelper) {
            this.btnBuyHelper.classList.add('active');
            if (this.helperIcon) this.helperIcon.textContent = '🤝';
            if (this.helperBtnText) this.helperBtnText.textContent = 'Напарник нанят';
            this.btnBuyHelper.title = 'Напарник уже помогает ловить свиней на ферме!';
        } else if (day < requiredDay) {
            this.btnBuyHelper.classList.add('locked');
            if (this.helperIcon) this.helperIcon.textContent = '🔒';
            if (this.helperBtnText) this.helperBtnText.textContent = `Напарник (с ${requiredDay} дн.)`;
            this.btnBuyHelper.title = `Напарник откроется на ${requiredDay} дне. Стоимость найма: ${cost} 🪙`;
        } else {
            // Доступно с 10 дня!
            if (coins >= cost) {
                this.btnBuyHelper.classList.add('ready');
                if (this.helperIcon) this.helperIcon.textContent = '✨';
                if (this.helperBtnText) this.helperBtnText.textContent = `Нанять напарника (${cost} 🪙)`;
                this.btnBuyHelper.title = `Нажмите, чтобы нанять напарника за ${cost} 🪙!`;
            } else {
                if (this.helperIcon) this.helperIcon.textContent = '🤝';
                if (this.helperBtnText) this.helperBtnText.textContent = `Напарник (${coins}/${cost} 🪙)`;
                this.btnBuyHelper.title = `Нужно накопить ${cost} монет для найма напарника (у вас ${coins} 🪙)`;
            }
        }
    }

    /**
     * Добавление всплывающей надписи в месте события
     */
    addFloatingText(x, y, text = '+1 🪙', color = '#f59e0b') {
        this.floatingTexts.push({
            x,
            y,
            text,
            color,
            alpha: 1.0,
            vy: -45,
            life: 1.0
        });
    }

    /**
     * Отрисовка всплывающих текстов
     */
    updateAndDrawFloatingTexts(ctx, dt) {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.life -= dt;
            ft.y += ft.vy * dt;
            ft.alpha = Math.max(0, ft.life / 1.0);

            if (ft.life <= 0) {
                this.floatingTexts.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.globalAlpha = ft.alpha;
            ctx.font = 'bold 20px "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#000000';
            ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        }
    }

    /**
     * Показать экран завершения дня с бонусом за быстрый улов
     */
    showDayComplete(day, coinsEarned, speedBonus = 0, timeTakenSec = 0, onNextDayCallback) {
        this.playDayWinSound();

        let bonusHtml = '';
        if (speedBonus > 0) {
            bonusHtml = `
                <div style="margin-top:12px; padding:8px 12px; background:#fef3c7; border:1px solid #f59e0b; border-radius:12px;">
                    ⚡ <strong>Быстрый улов!</strong> Время: <strong>${timeTakenSec.toFixed(1)} с</strong><br>
                    Бонус за скорость: <span style="color:#d97706; font-weight:bold;">+${speedBonus} 🪙</span>
                </div>
            `;
        }

        if (this.daySummaryText) {
            this.daySummaryText.innerHTML = `
                Все свиньи дня <strong>${day}</strong> пойманы и заперты в амбаре!<br>
                Заработано: <span style="color:#d97706; font-weight:bold;">+${coinsEarned} 🪙</span>
                ${bonusHtml}
            `;
        }

        if (this.dayCompleteModal) {
            this.dayCompleteModal.classList.remove('hidden');
        }

        if (this.btnNextDay) {
            this.btnNextDay.onclick = () => {
                this.hideDayComplete();
                if (onNextDayCallback) onNextDayCallback();
            };
        }
    }

    /**
     * Скрыть окно завершения дня
     */
    hideDayComplete() {
        if (this.dayCompleteModal) {
            this.dayCompleteModal.classList.add('hidden');
        }
    }
}
