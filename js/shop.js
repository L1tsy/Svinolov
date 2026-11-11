/**
 * Магазин улучшений фермы и найма напарников
 */
class Shop {
    constructor() {
        this.modalEl = document.getElementById('shop-modal');
        this.itemsListEl = document.getElementById('shop-items-list');
        this.btnClose = document.getElementById('btn-close-shop');
        this.shopCoinCountEl = document.getElementById('shop-coin-count');

        // Конфигурация доступных улучшений
        this.catalog = {
            speed: {
                id: 'speed',
                title: 'Сапоги-скороходы',
                icon: '🥾',
                desc: 'Увеличивает скорость перемещения фермера на +15%',
                maxLevel: 5,
                costs: [25, 50, 90, 150, 250],
                getEffectText: (lvl) => `+${lvl * 15}% к скорости бега`
            },
            radius: {
                id: 'radius',
                title: 'Большой сачок',
                icon: '🕸️',
                desc: 'Расширяет кружок зоны действия сачка на +15%',
                maxLevel: 5,
                costs: [30, 60, 110, 180, 300],
                getEffectText: (lvl) => `+${lvl * 15}% к радиусу сачка`
            },
            cooldown: {
                id: 'cooldown',
                title: 'Ловкие руки',
                icon: '⚡',
                desc: 'Снижает перезарядку сачка между поимками свиней',
                maxLevel: 4,
                costs: [40, 85, 160, 300],
                // 1.0s -> 0.85s -> 0.70s -> 0.55s -> 0.40s
                getEffectText: (lvl) => `Кулдаун: ${(1.0 - (lvl - 1) * 0.15).toFixed(2)} сек`
            },
            helper: {
                id: 'helper',
                title: 'Наём напарника',
                icon: '🤝',
                desc: 'Напарник автономно бегает по ферме и ловит свиней. Нужен для поимки Большой свиньи!',
                maxLevel: 10,
                // Формула: 1-й стоит 50 (с 10 дня), 2-й стоит 75 (с 20 дня), 3-й стоит 100 (с 30 дня)...
                getCost: (count) => 50 + 25 * count,
                getRequiredDay: (count) => 10 + 10 * count,
                getEffectText: (count) => `Нанято напарников: ${count}`
            }
        };

        if (this.btnClose) {
            this.btnClose.addEventListener('click', () => this.close());
        }
    }

    /**
     * Открыть магазин
     */
    open(game) {
        if (!this.modalEl) return;
        this.render(game);
        this.modalEl.classList.remove('hidden');
    }

    /**
     * Закрыть магазин
     */
    close() {
        if (this.modalEl) {
            this.modalEl.classList.add('hidden');
        }
    }

    /**
     * Перерисовка карточек магазина
     */
    render(game) {
        if (this.shopCoinCountEl) {
            this.shopCoinCountEl.textContent = game.coins;
        }
        if (!this.itemsListEl) return;

        this.itemsListEl.innerHTML = '';

        // 1. Улучшение скорости
        this.renderUpgradeCard(game, this.catalog.speed, game.upgrades.speedLevel || 1);

        // 2. Улучшение радиуса сачка
        this.renderUpgradeCard(game, this.catalog.radius, game.upgrades.radiusLevel || 1);

        // 3. Улучшение перезарядки
        this.renderUpgradeCard(game, this.catalog.cooldown, game.upgrades.cooldownLevel || 1);

        // 4. Наём напарников (50, 75, 100...)
        this.renderHelperCard(game, this.catalog.helper, game.upgrades.helpersCount || 0);
    }

    /**
     * Рендер стандартной карточки улучшения
     */
    renderUpgradeCard(game, item, currentLevel) {
        const isMax = currentLevel >= item.maxLevel;
        const nextCost = !isMax ? item.costs[currentLevel - 1] : 0;
        const canAfford = !isMax && game.coins >= nextCost;

        const card = document.createElement('div');
        card.className = `shop-item-card ${isMax ? 'maxed' : ''}`;

        // Генерация индикатора уровней (точки/полоски)
        let levelDots = '';
        for (let i = 1; i <= item.maxLevel; i++) {
            levelDots += `<span class="lvl-dot ${i <= currentLevel ? 'active' : ''}"></span>`;
        }

        card.innerHTML = `
            <div class="shop-item-icon">${item.icon}</div>
            <div class="shop-item-info">
                <div class="shop-item-title-row">
                    <h3 class="shop-item-title">${item.title}</h3>
                    <div class="shop-item-level">${levelDots}</div>
                </div>
                <p class="shop-item-desc">${item.desc}</p>
                <div class="shop-item-effect">${item.getEffectText(currentLevel)}</div>
            </div>
            <div class="shop-item-action">
                ${isMax ? `
                    <button class="btn-shop-buy maxed" disabled>МАКС.</button>
                ` : `
                    <button class="btn-shop-buy ${canAfford ? 'ready' : 'disabled'}" data-upgrade="${item.id}">
                        <span>${nextCost} 🪙</span>
                    </button>
                `}
            </div>
        `;

        if (!isMax) {
            const btn = card.querySelector('.btn-shop-buy');
            btn.onclick = () => {
                if (game.coins >= nextCost) {
                    game.coins -= nextCost;
                    if (item.id === 'speed') game.upgrades.speedLevel = currentLevel + 1;
                    if (item.id === 'radius') game.upgrades.radiusLevel = currentLevel + 1;
                    if (item.id === 'cooldown') game.upgrades.cooldownLevel = currentLevel + 1;

                    game.applyUpgrades();
                    game.ui.playHireSound();
                    game.saveProgress();
                    this.render(game);
                }
            };
        }

        this.itemsListEl.appendChild(card);
    }

    /**
     * Рендер карточки найма напарников
     */
    renderHelperCard(game, item, helpersCount) {
        const nextCost = item.getCost(helpersCount);
        const reqDay = item.getRequiredDay(helpersCount);
        const dayUnlocked = game.day >= reqDay;
        const canAfford = dayUnlocked && game.coins >= nextCost;

        const card = document.createElement('div');
        card.className = `shop-item-card helper-card ${!dayUnlocked ? 'locked' : ''}`;

        let statusText = '';
        if (!dayUnlocked) {
            statusText = `🔒 Доступно с <strong>${reqDay} дня</strong>`;
        } else {
            statusText = `Стоимость ${helpersCount + 1}-го напарника: <strong>${nextCost} 🪙</strong>`;
        }

        card.innerHTML = `
            <div class="shop-item-icon">${item.icon}</div>
            <div class="shop-item-info">
                <div class="shop-item-title-row">
                    <h3 class="shop-item-title">${item.title} #${helpersCount + 1}</h3>
                    <span class="helper-count-badge">В строю: ${helpersCount}</span>
                </div>
                <p class="shop-item-desc">${item.desc}</p>
                <div class="shop-item-effect ${!dayUnlocked ? 'locked-text' : ''}">${statusText}</div>
            </div>
            <div class="shop-item-action">
                ${!dayUnlocked ? `
                    <button class="btn-shop-buy locked" disabled>День ${reqDay}</button>
                ` : `
                    <button class="btn-shop-buy ${canAfford ? 'ready' : 'disabled'}" id="btn-buy-helper-shop">
                        <span>${nextCost} 🪙</span>
                    </button>
                `}
            </div>
        `;

        if (dayUnlocked) {
            const btn = card.querySelector('#btn-buy-helper-shop');
            btn.onclick = () => {
                if (game.coins >= nextCost) {
                    game.coins -= nextCost;
                    game.upgrades.helpersCount = (game.upgrades.helpersCount || 0) + 1;
                    game.addNewHelper();
                    game.ui.playHireSound();
                    game.saveProgress();
                    this.render(game);
                }
            };
        }

        this.itemsListEl.appendChild(card);
    }
}
