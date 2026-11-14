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
        this._closeTimer = null;

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

    get isOpen() {
        return !this.el.classList.contains('hidden') && !this.el.classList.contains('shop-closing');
    }

    open(tab) {
        if (this._closeTimer) {
            clearTimeout(this._closeTimer);
            this._closeTimer = null;
        }
        this.el.classList.remove('shop-closing');
        if (tab) this.tab = tab;
        this.el.classList.remove('hidden');
        this._coins = null;
        this.bodyEl.scrollTop = 0;
        this.render();
    }

    close(immediate = false, onClosed = null) {
        if (typeof immediate === 'function') {
            onClosed = immediate;
            immediate = false;
        }
        if (this.el.classList.contains('hidden') || this.el.classList.contains('shop-closing')) {
            return;
        }
        if (immediate) {
            if (this._closeTimer) clearTimeout(this._closeTimer);
            this._closeTimer = null;
            this.el.classList.remove('shop-closing');
            this.el.classList.add('hidden');
            if (this.ui && typeof this.ui._syncPause === 'function') {
                this.ui._syncPause();
            }
            if (typeof onClosed === 'function') onClosed();
            return;
        }

        // Плавное закрытие через класс .shop-closing
        this.el.classList.add('shop-closing');
        if (this._closeTimer) clearTimeout(this._closeTimer);
        this._closeTimer = setTimeout(() => {
            this.el.classList.add('hidden');
            this.el.classList.remove('shop-closing');
            this._closeTimer = null;
            if (this.ui && typeof this.ui._syncPause === 'function') {
                this.ui._syncPause();
            }
            if (typeof onClosed === 'function') onClosed();
        }, 220);
    }

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
        let achDone = 0;
        let achTotal = 0;
        if (typeof ACHIEVEMENT_CHAINS !== 'undefined' && Array.isArray(ACHIEVEMENT_CHAINS)) {
            achTotal = ACHIEVEMENT_CHAINS.length;
            achDone = ACHIEVEMENT_CHAINS.filter(chain => {
                const prog = (save.achProgress && save.achProgress[chain.id]) || { tier: 1 };
                return (prog.tier > chain.tiers.length);
            }).length;
        } else if (typeof ACHIEVEMENTS !== 'undefined') {
            achTotal = ACHIEVEMENTS.length;
            achDone = ACHIEVEMENTS.filter((a) => save.ach && save.ach[a.id]).length;
        }

        this.tabsEl.innerHTML = this.tabs.map((t) => {
            let badge = '';
            if (t.id === 'ach') badge = `<span class="badge">${achDone}/${achTotal}</span>`;
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
        let locked = false;

        const isHelperUp = (up.id === 'helper_speed' || up.id === 'helper_radius' || up.id === 'helper_vision');
        const isDogUp = (up.id === 'dog_power');
        const hasHelper = (save.helpers || 0) >= 1;
        const hasDog = (save.dogs || 0) >= 1;

        if (isHelperUp && !hasHelper) {
            locked = true;
            btn = '<button type="button" class="btn" disabled>🔒 Сначала наймите напарника</button>';
            fx = `<span class="now">${up.fx(lvl)}</span>`;
        } else if (isDogUp && !hasDog) {
            locked = true;
            btn = '<button type="button" class="btn" disabled>🔒 Сначала наймите пса Бобика</button>';
            fx = `<span class="now">${up.fx(lvl)}</span>`;
        } else if (maxed) {
            btn = '<button type="button" class="btn yellow" disabled>⭐ МАКС</button>';
            fx = `<span class="now">${up.fx(lvl)}</span>`;
        } else {
            const cost = upgradeCost(up, lvl);
            const can = save.coins >= cost;
            btn = `<button type="button" class="btn green ${can ? 'can' : 'off'}" data-silent="1" data-act="upgrade" data-id="${up.id}">Улучшить · 🪙 ${U.fmt(cost)}</button>`;
            fx = `<span class="now">${up.fx(lvl)}</span><span>➜</span><span class="next">${up.fx(lvl + 1)}</span>`;
        }
        return `<div class="card${maxed ? ' maxed' : ''}${locked ? ' locked-card' : ''}" data-id="${up.id}" style="display:flex; flex-direction:column; height:100%; box-sizing:border-box;">
            <div class="card-head">
                <div class="card-ico">${up.icon}</div>
                <div style="flex:1; min-width:0;">
                    <div class="card-title">${up.title}</div>
                    <div class="card-desc" style="min-height:30px; display:flex; align-items:center;">${up.desc}</div>
                </div>
            </div>
            <div class="pips-label"><span>Уровень ${lvl} из ${up.max}</span></div>
            ${this._pips(lvl, up.max)}
            <div class="card-fx" style="min-height:24px; display:flex; align-items:center;">${fx}</div>
            <div class="card-btn-wrap" style="margin-top:auto; padding-top:4px;">${btn}</div>
        </div>`;
    }

    _upgradesHtml(save) {
        const farmerUps = UPGRADES.filter(u => u.category !== 'team');
        const helperUps = typeof HELPER_UPGRADES !== 'undefined' ? HELPER_UPGRADES : UPGRADES.filter(u => u.category === 'team');

        const farmerCards = farmerUps.map(up => this._renderUpgradeCard(up, save)).join('');
        const helperCards = helperUps.map(up => this._renderUpgradeCard(up, save)).join('');

        const titleFarmer = `<div class="shop-section-title" style="grid-column: 1 / -1; font-size: 16px; font-weight: 800; color: var(--ink, #3b2212); background: rgba(59,34,18,0.07); border-left: 4px solid var(--orange, #f97316); border-radius: 8px; padding: 6px 12px; margin: 6px 0 2px; display: flex; align-items: center; gap: 8px;">🧑‍🌾 Снаряжение фермера</div>`;
        const titleHelpers = `<div class="shop-section-title" style="grid-column: 1 / -1; font-size: 16px; font-weight: 800; color: var(--ink, #3b2212); background: rgba(59,34,18,0.07); border-left: 4px solid var(--orange, #f97316); border-radius: 8px; padding: 6px 12px; margin: 14px 0 2px; display: flex; align-items: center; gap: 8px;">🐕 Прокачка напарников и пса</div>`;

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
            return `<div class="card${count >= total ? ' maxed' : ''}${locked ? ' locked-card' : ''}" data-id="${m.id}" style="display:flex; flex-direction:column; height:100%; box-sizing:border-box;">
                <div class="card-head">
                    <div class="card-ico">${m.icon}</div>
                    <div style="flex:1; min-width:0;">
                        <div class="card-title">${m.title}</div>
                        <div class="card-desc" style="min-height:30px; display:flex; align-items:center;">${m.desc}</div>
                    </div>
                </div>
                <div class="pips-label"><span>В строю: ${count}</span><span>максимум ${total}</span></div>
                ${this._pips(count, total)}
                <div class="card-fx" style="min-height:24px;"></div>
                <div class="card-btn-wrap" style="margin-top:auto; padding-top:4px;">${btn}</div>
            </div>`;
        }).join('');

        const helperList = typeof HELPER_UPGRADES !== 'undefined' ? HELPER_UPGRADES : UPGRADES.filter(u => u.category === 'team');
        const helperCards = helperList.map(up => this._renderUpgradeCard(up, save)).join('');

        const titleTeam = `<div class="shop-section-title" style="grid-column: 1 / -1; font-size: 16px; font-weight: 800; color: var(--ink, #3b2212); background: rgba(59,34,18,0.07); border-left: 4px solid var(--orange, #f97316); border-radius: 8px; padding: 6px 12px; margin: 6px 0 2px; display: flex; align-items: center; gap: 8px;">👥 Найм напарников</div>`;
        const titleUpgrades = `<div class="shop-section-title" style="grid-column: 1 / -1; font-size: 16px; font-weight: 800; color: var(--ink, #3b2212); background: rgba(59,34,18,0.07); border-left: 4px solid var(--orange, #f97316); border-radius: 8px; padding: 6px 12px; margin: 14px 0 2px; display: flex; align-items: center; gap: 8px;">🐕 Прокачка напарников и пса</div>`;

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
            return `<div class="card hat-card${worn ? ' worn' : ''}${owned ? '' : ' locked-hat'}" data-id="${h.id}" style="display:flex; flex-direction:column; justify-content:space-between; height:100%; box-sizing:border-box;">
                <canvas width="208" height="192" data-hat="${h.id}"></canvas>
                <div class="card-title" style="margin:4px 0 2px;">${h.name}</div>
                <div class="card-btn-wrap" style="margin-top:auto; width:100%; padding-top:4px;">${btn}</div>
            </div>`;
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
        if (typeof ACHIEVEMENT_CHAINS !== 'undefined' && Array.isArray(ACHIEVEMENT_CHAINS)) {
            const chains = ACHIEVEMENT_CHAINS;
            let totalClaimedTiers = 0;
            let totalPossibleTiers = 0;
            let fullyCompletedChains = 0;

            const cards = chains.map(chain => {
                const getTierFn = (typeof getActiveAchievementTier === 'function') 
                    ? getActiveAchievementTier 
                    : (typeof CONFIG !== 'undefined' && typeof CONFIG.getActiveAchievementTier === 'function' ? CONFIG.getActiveAchievementTier : null);
                
                const data = getTierFn ? getTierFn(chain.id, save) : null;
                const prog = (save.achProgress && save.achProgress[chain.id]) || { tier: 1, claimed: false };
                const curTier = data ? data.tier : Math.max(1, Number(prog.tier) || 1);
                const maxTier = chain.tiers.length;
                totalPossibleTiers += maxTier;
                totalClaimedTiers += Math.min(curTier - 1, maxTier);

                const isCompleted = data ? data.isCompleted : (curTier > maxTier);
                if (isCompleted) fullyCompletedChains++;

                const tierDef = isCompleted 
                    ? chain.tiers[maxTier - 1] 
                    : (chain.tiers.find(t => t.tier === curTier) || chain.tiers[0]);

                let statVal = 0;
                if (chain.stat === 'sprintTimeTotal') {
                    statVal = Math.floor(Number(save.sprintTimeTotal) || (save.stats && Number(save.stats.sprintTimeTotal)) || 0);
                } else if (chain.stat === 'prestige') {
                    statVal = Number(save.prestige) || 0;
                } else if (save.stats) {
                    statVal = Number(save.stats[chain.stat]) || 0;
                }

                const goal = tierDef.goal || tierDef.target;
                const canClaim = data ? data.canClaim : (!isCompleted && statVal >= goal);
                const displayVal = Math.min(statVal, goal);
                const pct = isCompleted ? 100 : Math.min(100, Math.round((statVal / goal) * 100));

                const tierRoman = tierDef.roman || (typeof ROMAN_NUMERALS !== 'undefined' && ROMAN_NUMERALS[curTier] ? ROMAN_NUMERALS[curTier] : curTier);
                const tierBadgeClass = `tier-${Math.min(curTier, 5)}`;
                
                let tierBadgeIcon = '🥉';
                if (curTier === 2) tierBadgeIcon = '🥈';
                else if (curTier === 3) tierBadgeIcon = '🥇';
                else if (curTier === 4) tierBadgeIcon = '💎';
                else if (curTier >= 5) tierBadgeIcon = '👑';

                const tierBadgeText = isCompleted ? '👑 МАСТЕР' : `${tierBadgeIcon} Степень ${tierRoman}`;

                let actionHtml = '';
                if (isCompleted) {
                    actionHtml = `<div class="ach-tier-badge tier-max" style="width:100%; justify-content:center; padding:6px; box-sizing:border-box;">👑 ВСЕ СТЕПЕНИ ВЫПОЛНЕНЫ!</div>`;
                } else if (canClaim) {
                    actionHtml = `<button type="button" class="btn green ach-claim-btn can" data-silent="1" data-act="claim-ach-chain" data-chain="${chain.id}">Забрать 🪙 +${U.fmt(tierDef.reward)}</button>`;
                } else {
                    actionHtml = `<div class="ach-meta"><span>Прогресс: <b>${U.fmt(displayVal)}</b> / ${U.fmt(goal)} ${chain.unit || ''}</span><span>Награда: <b>🪙 ${U.fmt(tierDef.reward)}</b></span></div>`;
                }

                return `<div class="card ach-chain-card${canClaim ? ' claimable' : ''}${isCompleted ? ' all-done' : ''}" data-id="${chain.id}">
                    <div class="ach-chain-head">
                        <div class="ach-chain-ico">${chain.icon}</div>
                        <div class="ach-chain-info">
                            <div class="ach-chain-title-row">
                                <span class="ach-chain-title">${chain.name}</span>
                                <span class="ach-tier-badge ${isCompleted ? 'tier-max' : tierBadgeClass}">${tierBadgeText}</span>
                            </div>
                            <div class="ach-chain-desc">${tierDef.desc}</div>
                        </div>
                    </div>
                    <div class="ach-chain-progress-wrap">
                        <div class="ach-chain-bar"><i style="width:${pct}%"></i></div>
                    </div>
                    ${actionHtml}
                </div>`;
            }).join('');

            const head = `<div class="ach-count" style="grid-column: 1 / -1; text-align: center; font-size: 16px; font-weight: 800; padding: 4px 0 8px; color: var(--ink, #3b2212);">
                🏆 Достижения: завершено цепочек <b>${fullyCompletedChains}</b> из <b>${chains.length}</b> (рангов получено: <b>${totalClaimedTiers}</b> / <b>${totalPossibleTiers}</b>)
            </div>`;
            return head + cards;
        }

        // Классический режим достижений (fallback)
        const done = ACHIEVEMENTS.filter((a) => save.ach && save.ach[a.id]).length;
        const head = `<div class="ach-count" style="grid-column: 1 / -1; text-align: center; font-size: 17px; font-weight: 800; padding: 4px 0 8px; color: var(--ink, #3b2212);">🏆 Выполнено: <b>${done}</b> из <b>${ACHIEVEMENTS.length}</b></div>`;
        return head + ACHIEVEMENTS.map((a) => {
            const ok = !!(save.ach && save.ach[a.id]);
            const val = Math.min((save.stats && save.stats[a.stat]) || 0, a.goal);
            const pct = Math.round((val / a.goal) * 100);
            return `<div class="card ach${ok ? ' done' : ''}" data-id="${a.id}" style="display:flex; flex-direction:row; align-items:center; gap:12px; box-sizing:border-box;">
                <div class="card-ico">${a.icon}</div>
                <div class="ach-main" style="flex:1; min-width:0;">
                    <div class="card-title">${a.title}</div>
                    <div class="card-desc">${a.desc}</div>
                    <div class="bar" style="margin: 4px 0;"><i style="width:${pct}%"></i></div>
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

        // Второй амбар на Престиже 6+ (Северный и Южный амбары)
        let dualBarnsHtml = '';
        if (curPrestige >= 6) {
            const hasDual = !!(save.hasDualBarns || (this.game && this.game.hasDualBarns));
            let dbAction = '';
            if (hasDual) {
                dbAction = '<div class="dual-barns-badge-active">✔ Северный и Южный амбары активны!</div>';
            } else {
                dbAction = '<button type="button" class="btn green btn-big can" data-silent="1" data-act="dual-barns" style="width:100%">🏡 Активировать Второй Амбар</button>';
            }

            dualBarnsHtml = `<div class="card dual-barns-card">
                <h3>🏡 Второй амбар (Северный и Южный амбары)</h3>
                <div class="card-desc" style="font-size:14px; opacity:1; color:#155e75;">
                    Эксклюзив 6-го уровня престижа! На вашей ферме работают сразу два независимых амбара — Северный и Южный.
                </div>
                <ul>
                    <li>Свиньи разбегаются во все стороны и ловятся в ближайший амбар.</li>
                    <li>Повышенная вместимость и динамичный маршрут ловли.</li>
                    <li>Центральная площадь деревни и мощеная разводка путей.</li>
                </ul>
                ${dbAction}
            </div>`;
        } else {
            dualBarnsHtml = `<div class="prestige-lock" style="margin-top:14px;">
                🔒 <b>Второй амбар (Северный и Южный)</b> откроется на 6-м уровне престижа (сейчас престиж: ${curPrestige}).
            </div>`;
        }

        return grid + prestige + dualBarnsHtml;
    }

    /* ---------- Действия ---------- */
    _onBody(e) {
        const btn = e.target.closest('[data-act]');
        if (!btn || btn.disabled) return;
        const act = btn.dataset.act, id = btn.dataset.id;
        const g = this.game;
        let ok = false;
        if (act === 'upgrade') {
            if ((id === 'helper_speed' || id === 'helper_radius' || id === 'helper_vision') && (g.save.helpers || 0) < 1) {
                if (this.ui && typeof this.ui.toast === 'function') {
                    this.ui.toast('🔒 Сначала наймите напарника во вкладке «Команда»!', 'warn');
                }
                this._shake(btn);
                return;
            }
            if (id === 'dog_power' && (g.save.dogs || 0) < 1) {
                if (this.ui && typeof this.ui.toast === 'function') {
                    this.ui.toast('🔒 Сначала наймите пса Бобика во вкладке «Команда»!', 'warn');
                }
                this._shake(btn);
                return;
            }
            ok = g.buyUpgrade(id);
        }
        else if (act === 'team') ok = g.buyTeam(id);
        else if (act === 'hat') ok = g.buyHat(id);
        else if (act === 'claim-ach-chain') {
            const chainId = btn.dataset.chain;
            let res = null;
            if (g.claimAchievementTier) {
                res = g.claimAchievementTier(chainId);
            } else if (g.storage && g.storage.claimAchievementTier) {
                res = g.storage.claimAchievementTier(chainId);
            }
            if (res && res.success) {
                try { g.sfx.win(); } catch (err) { try { g.sfx.coin(); } catch (e) {} }
                if (this.ui && typeof this.ui.toast === 'function') {
                    this.ui.toast(`🏆 Ранг повышен! Получено: +${res.reward} 🪙`, 'ach');
                }
                this.render(chainId, true);
            }
            return;
        } else if (act === 'dual-barns') {
            if (g.setDualBarns) {
                g.setDualBarns(true);
            } else if (g.storage && g.storage.setDualBarns) {
                g.storage.setDualBarns(true);
            } else {
                g.save.hasDualBarns = true;
                g.persist();
            }
            g.hasDualBarns = true;
            if (g.world && typeof g.world.configureDualBarns === 'function') {
                g.world.configureDualBarns();
            }
            try { g.sfx.win(); } catch (err) {}
            if (this.ui && typeof this.ui.toast === 'function') {
                this.ui.toast('🏡 Второй амбар активирован! (Северный и Южный амбары)', 'prestige');
            }
            this.render(null, true);
            return;
        } else if (act === 'prestige') {
            if (!g.canPrestige()) return;
            const nextPrestige = (g.save.prestige || 0) + 1;
            const nextCoins = typeof prestigeStartingCoins === 'function' ? prestigeStartingCoins(nextPrestige) : (50 + 50 * nextPrestige);
            if (window.confirm(`Продать ферму? Прогресс дней, монеты, улучшения и команда сбросятся. Шляпы и достижения останутся, а монет навсегда станет больше (+${Math.round(CONFIG.PRESTIGE_BONUS * 100)}% и стартовый капитал +${nextCoins} 🪙).`)) {
                if (g.storage && typeof g.storage.resetPrestige === 'function') {
                    g.storage.resetPrestige(g.save);
                }
                g.doPrestige();
                if (this.ui && typeof this.ui.closeShop === 'function') {
                    this.ui.closeShop();
                } else {
                    this.close();
                }
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
