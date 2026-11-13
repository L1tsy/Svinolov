'use strict';

/**
 * Магазин: улучшения, команда, шляпы, достижения, ферма (престиж).
 * Рисует содержимое модального окна #shop-modal; открытием/паузой управляет UI.
 */
class Shop {
    constructor(game, ui) {
        this.game = game;
        this.ui = ui;
        this.el = document.getElementById('shop-modal');
        this.tabsEl = document.getElementById('shop-tabs');
        this.bodyEl = document.getElementById('shop-body');
        this.coinsEl = document.getElementById('shop-coins');
        this.tab = 'upgrades';
        this._coins = null;

        this.tabs = [
            { id: 'upgrades', label: '⬆️ Улучшения' },
            { id: 'team', label: '👥 Команда' },
            { id: 'hats', label: '🎩 Шляпы' },
            { id: 'ach', label: '🏆 Достижения' },
            { id: 'farm', label: '🌾 Ферма' }
        ];

        this.tabsEl.addEventListener('click', (e) => {
            const b = e.target.closest('[data-tab]');
            if (b) this.setTab(b.dataset.tab);
        });
        this.bodyEl.addEventListener('click', (e) => this._onBody(e));
    }

    get isOpen() { return !this.el.classList.contains('hidden'); }

    open(tab) {
        if (tab) this.tab = tab;
        this.el.classList.remove('hidden');
        this._coins = null;
        this.bodyEl.scrollTop = 0;
        this.render();
    }

    close() { this.el.classList.add('hidden'); }

    refresh() { if (this.isOpen) this.render(); }

    setTab(id) {
        if (id === this.tab) return;
        this.tab = id;
        this.bodyEl.scrollTop = 0;
        this.render();
    }

    /* ---------- Отрисовка ---------- */
    render(flashId, quiet) {
        const save = this.game.save;
        const scroll = this.bodyEl.scrollTop;

        // Баланс
        const coinsTxt = '🪙 ' + U.fmt(save.coins);
        if (this._coins !== null && this._coins !== save.coins) {
            this.coinsEl.classList.remove('bump'); void this.coinsEl.offsetWidth; this.coinsEl.classList.add('bump');
        }
        this._coins = save.coins;
        this.coinsEl.textContent = coinsTxt;

        // Вкладки
        const achDone = ACHIEVEMENTS.filter((a) => save.ach[a.id]).length;
        this.tabsEl.innerHTML = this.tabs.map((t) => {
            let badge = '';
            if (t.id === 'ach') badge = `<span class="badge">${achDone}/${ACHIEVEMENTS.length}</span>`;
            return `<button type="button" class="tab${t.id === this.tab ? ' active' : ''}" data-tab="${t.id}">${t.label}${badge}</button>`;
        }).join('');

        this.bodyEl.className = 'shop-body' + (this.tab === 'hats' ? ' hats' : '') + (this.tab === 'farm' ? ' single' : '');
        let html = '';
        switch (this.tab) {
            case 'upgrades': html = this._upgradesHtml(save); break;
            case 'team': html = this._teamHtml(save); break;
            case 'hats': html = this._hatsHtml(save); break;
            case 'ach': html = this._achHtml(save); break;
            case 'farm': html = this._farmHtml(save); break;
        }
        this.bodyEl.innerHTML = html;
        // повторный рендер при покупке не должен заново «выпрыгивать» карточки
        if (quiet) this.bodyEl.querySelectorAll('.card').forEach((c) => { c.style.animation = 'none'; });
        if (this.tab === 'hats') this._drawHats();
        this.bodyEl.scrollTop = scroll;

        if (flashId) {
            const card = this.bodyEl.querySelector(`[data-id="${flashId}"]`);
            if (card) { card.style.animation = ''; card.classList.add('flash'); }
        }
    }

    _pips(level, max) {
        let s = '';
        for (let i = 0; i < max; i++) s += `<i class="pip${i < level ? ' on' : ''}"></i>`;
        return `<div class="pips">${s}</div>`;
    }

    _renderUpgradeCard(up, save) {
        const lvl = (save.upgrades && save.upgrades[up.id]) || 0;
        const maxed = lvl >= up.max;
        let btn, fx;
        if (maxed) {
            btn = '<button type="button" class="btn yellow" disabled>⭐ МАКС</button>';
            fx = `<span class="now">${up.fx(lvl)}</span>`;
        } else {
            const cost = upgradeCost(up, lvl);
            const can = save.coins >= cost;
            btn = `<button type="button" class="btn green ${can ? 'can' : 'off'}" data-silent="1" data-act="upgrade" data-id="${up.id}">Улучшить · 🪙 ${U.fmt(cost)}</button>`;
            fx = `<span class="now">${up.fx(lvl)}</span><span>➜</span><span class="next">${up.fx(lvl + 1)}</span>`;
        }
        return `<div class="card${maxed ? ' maxed' : ''}" data-id="${up.id}">
            <div class="card-head"><div class="card-ico">${up.icon}</div>
                <div><div class="card-title">${up.title}</div><div class="card-desc">${up.desc}</div></div></div>
            <div class="pips-label"><span>Уровень ${lvl} из ${up.max}</span></div>
            ${this._pips(lvl, up.max)}
            <div class="card-fx">${fx}</div>
            ${btn}</div>`;
    }

    _upgradesHtml(save) {
        const farmerUps = UPGRADES.filter(u => u.category !== 'team');
        const helperUps = typeof HELPER_UPGRADES !== 'undefined' ? HELPER_UPGRADES : UPGRADES.filter(u => u.category === 'team');

        const farmerCards = farmerUps.map(up => this._renderUpgradeCard(up, save)).join('');
        const helperCards = helperUps.map(up => this._renderUpgradeCard(up, save)).join('');

        const titleFarmer = `<div class="shop-section-title" style="grid-column: 1 / -1; font-size: 16px; font-weight: 800; color: #fff; margin: 4px 0 2px; text-shadow: 0 2px 4px rgba(0,0,0,0.55);">🧑‍🌾 Снаряжение фермера</div>`;
        const titleHelpers = `<div class="shop-section-title" style="grid-column: 1 / -1; font-size: 16px; font-weight: 800; color: #fff; margin: 16px 0 2px; text-shadow: 0 2px 4px rgba(0,0,0,0.55);">🐕 Прокачка напарников и пса</div>`;

        return titleFarmer + farmerCards + titleHelpers + helperCards;
    }

    _teamHtml(save) {
        const teamCards = TEAM.map((m) => {
            const count = save[m.id] || 0;
            const total = m.costs.length;
            let btn;
            let locked = false;
            if (count >= total) {
                btn = '<button type="button" class="btn yellow" disabled>⭐ МАКС</button>';
            } else if (save.day < m.days[count]) {
                locked = true;
                btn = `<button type="button" class="btn" disabled>🔒 Откроется на ${m.days[count]}-й день</button>`;
            } else {
                const cost = m.costs[count];
                const can = save.coins >= cost;
                btn = `<button type="button" class="btn green ${can ? 'can' : 'off'}" data-silent="1" data-act="team" data-id="${m.id}">Нанять · 🪙 ${U.fmt(cost)}</button>`;
            }
            return `<div class="card${count >= total ? ' maxed' : ''}${locked ? ' locked-card' : ''}" data-id="${m.id}">
                <div class="card-head"><div class="card-ico">${m.icon}</div>
                    <div><div class="card-title">${m.title}</div><div class="card-desc">${m.desc}</div></div></div>
                <div class="pips-label"><span>В строю: ${count}</span><span>максимум ${total}</span></div>
                ${this._pips(count, total)}
                ${btn}</div>`;
        }).join('');

        const helperList = typeof HELPER_UPGRADES !== 'undefined' ? HELPER_UPGRADES : UPGRADES.filter(u => u.category === 'team');
        const helperCards = helperList.map(up => this._renderUpgradeCard(up, save)).join('');

        const titleTeam = `<div class="shop-section-title" style="grid-column: 1 / -1; font-size: 16px; font-weight: 800; color: #fff; margin: 4px 0 2px; text-shadow: 0 2px 4px rgba(0,0,0,0.55);">👥 Найм напарников</div>`;
        const titleUpgrades = `<div class="shop-section-title" style="grid-column: 1 / -1; font-size: 16px; font-weight: 800; color: #fff; margin: 16px 0 2px; text-shadow: 0 2px 4px rgba(0,0,0,0.55);">🐕 Прокачка напарников и пса</div>`;

        return titleTeam + teamCards + titleUpgrades + helperCards;
    }

    _hatsHtml(save) {
        return HATS.map((h) => {
            const owned = save.hats.includes(h.id);
            const worn = save.hat === h.id;
            let btn;
            if (worn) btn = '<button type="button" class="btn yellow btn-small" disabled>✔ Надето</button>';
            else if (owned) btn = `<button type="button" class="btn pink btn-small" data-silent="1" data-act="hat" data-id="${h.id}">Надеть</button>`;
            else {
                const can = save.coins >= h.cost;
                btn = `<button type="button" class="btn green btn-small ${can ? 'can' : 'off'}" data-silent="1" data-act="hat" data-id="${h.id}">🪙 ${U.fmt(h.cost)}</button>`;
            }
            return `<div class="card hat-card${worn ? ' worn' : ''}${owned ? '' : ' locked-hat'}" data-id="${h.id}">
                <canvas width="208" height="192" data-hat="${h.id}"></canvas>
                <div class="card-title">${h.name}</div>
                ${btn}</div>`;
        }).join('');
    }

    _drawHats() {
        this.bodyEl.querySelectorAll('canvas[data-hat]').forEach((cv) => {
            const ctx = cv.getContext('2d');
            ctx.clearRect(0, 0, cv.width, cv.height);
            ctx.save();
            ctx.scale(2 * 1.6, 2 * 1.6);
            try {
                drawFarmer(ctx, {
                    x: 20, y: 33, facing: 1, walk: 0, moving: false, t: 0,
                    suit: '#3b82f6', hat: cv.dataset.hat, swingK: -1, stun: 0
                });
            } catch (e) { /* превью — необязательная часть */ }
            ctx.restore();
        });
    }

    _achHtml(save) {
        const done = ACHIEVEMENTS.filter((a) => save.ach[a.id]).length;
        const head = `<div class="ach-count">🏆 Выполнено: <b>${done}</b> из <b>${ACHIEVEMENTS.length}</b></div>`;
        return head + ACHIEVEMENTS.map((a) => {
            const ok = !!save.ach[a.id];
            const val = Math.min(save.stats[a.stat] || 0, a.goal);
            const pct = Math.round((val / a.goal) * 100);
            return `<div class="card ach${ok ? ' done' : ''}" data-id="${a.id}">
                <div class="card-ico">${a.icon}</div>
                <div class="ach-main">
                    <div class="card-title">${a.title}</div>
                    <div class="card-desc">${a.desc}</div>
                    <div class="bar"><i style="width:${pct}%"></i></div>
                    <div class="ach-meta"><span>${U.fmt(val)} / ${U.fmt(a.goal)}</span><span>Награда: 🪙 ${U.fmt(a.reward)}</span></div>
                </div>
                ${ok ? '<div class="ach-check">✅</div>' : ''}</div>`;
        }).join('');
    }

    _farmHtml(save) {
        const s = save.stats;
        const rows = [
            ['🐷 Всего свиней', U.fmt(s.totalPigs || 0)],
            ['🪙 Монет заработано', U.fmt(s.totalCoins || 0)],
            ['🔥 Лучшее комбо', 'x' + (s.bestCombo || 0)],
            ['🕸️ Лучший улов за взмах', s.bestMulti || 0],
            ['✨ Золотых свиней', s.goldCaught || 0],
            ['🐗 Боссов побеждено', s.bossKilled || 0],
            ['⭐ Дней на 3★', s.perfectDays || 0],
            ['📅 Рекорд дня', s.bestDay || 1]
        ];
        const grid = '<div class="farm-grid">' + rows.map((r) => `<div class="stat"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('') + '</div>';

        const pct = Math.round(CONFIG.PRESTIGE_BONUS * 100);
        const curPrestige = save.prestige || 0;
        const curMult = Math.round(curPrestige * CONFIG.PRESTIGE_BONUS * 100);
        const nextPrestige = curPrestige + 1;
        const nextBonusCoins = typeof prestigeStartingCoins === 'function'
            ? prestigeStartingCoins(nextPrestige)
            : (50 + 50 * nextPrestige);
        const curBonusCoins = typeof prestigeStartingCoins === 'function'
            ? prestigeStartingCoins(curPrestige)
            : (curPrestige > 0 ? (50 + 50 * curPrestige) : 0);

        const can = this.game.canPrestige();
        const unlocked = save.day >= CONFIG.PRESTIGE_DAY;
        let action;
        if (can) {
            action = '<button type="button" class="btn pink btn-big can" data-silent="1" data-act="prestige" style="width:100%">🐽 Продать ферму</button>';
        } else if (!unlocked) {
            action = `<div class="prestige-lock">🔒 Откроется с ${CONFIG.PRESTIGE_DAY}-го дня. Сейчас день ${save.day}.</div>`;
        } else {
            action = '<div class="prestige-lock">🔒 Сейчас продать ферму нельзя.</div>';
        }
        const prestige = `<div class="card prestige-card">
            <h3>🐽 Продать ферму</h3>
            <div class="card-desc" style="font-size:15px;opacity:1">Начни всё с чистого листа — но богаче, чем прежде.</div>
            <ul>
                <li>Сбрасываются: прогресс дней, монеты, улучшения и команда.</li>
                <li>Остаются: шляпы и достижения.</li>
                <li>Навсегда: <b>+${pct}% монет</b> за каждую продажу.</li>
                <li>Стартовый капитал на новый забег: <b>+${nextBonusCoins} 🪙</b></li>
            </ul>
            <div class="bonus">Продаж: <b>${curPrestige}</b> · сейчас бонус <b>+${curMult}%</b>${curBonusCoins > 0 ? ` · прошлый старт: <b>+${curBonusCoins} 🪙</b>` : ''}</div>
            ${action}</div>`;
        return grid + prestige;
    }

    /* ---------- Действия ---------- */
    _onBody(e) {
        const btn = e.target.closest('[data-act]');
        if (!btn || btn.disabled) return;
        const act = btn.dataset.act, id = btn.dataset.id;
        const g = this.game;
        let ok = false;
        if (act === 'upgrade') ok = g.buyUpgrade(id);
        else if (act === 'team') ok = g.buyTeam(id);
        else if (act === 'hat') ok = g.buyHat(id);
        else if (act === 'prestige') {
            if (!g.canPrestige()) return;
            const nextPrestige = (g.save.prestige || 0) + 1;
            const nextCoins = typeof prestigeStartingCoins === 'function' ? prestigeStartingCoins(nextPrestige) : (50 + 50 * nextPrestige);
            if (window.confirm(`Продать ферму? Прогресс дней, монеты, улучшения и команда сбросятся. Шляпы и достижения останутся, а монет навсегда станет больше (+${Math.round(CONFIG.PRESTIGE_BONUS * 100)}% и стартовый капитал +${nextCoins} 🪙).`)) {
                if (g.storage && typeof g.storage.resetPrestige === 'function') {
                    g.storage.resetPrestige(g.save);
                }
                g.doPrestige();
                this.ui.closeShop();
            }
            return;
        }
        this.render(ok ? id : null, true);
        if (!ok) this._shake(btn);
    }

    _shake(btn) {
        const b = this.bodyEl.querySelector(`[data-act="${btn.dataset.act}"][data-id="${btn.dataset.id}"]`);
        if (b && b.animate) b.animate(
            [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
            { duration: 220 }
        );
    }
}
