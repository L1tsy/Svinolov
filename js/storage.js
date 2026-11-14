'use strict';

/**
 * Сохранение прогресса в localStorage
 */
class StorageManager {
    constructor(key = CONFIG.SAVE_KEY) {
        this.key = key;
        this.data = null;
    }

    _defaultAchProgress() {
        const prog = {};
        const chainIds = [
            'pigs_catch', 'coins_earned', 'combo_streak', 'days_survived',
            'boars_caught', 'bosses_defeated', 'ninjas_caught', 'gold_caught',
            'perfect_days', 'sprint_time', 'prestige_rank'
        ];
        if (typeof ACHIEVEMENT_CHAINS !== 'undefined' && Array.isArray(ACHIEVEMENT_CHAINS)) {
            for (const c of ACHIEVEMENT_CHAINS) {
                prog[c.id] = { tier: 1, claimed: false };
            }
        } else {
            for (const id of chainIds) {
                prog[id] = { tier: 1, claimed: false };
            }
        }
        return prog;
    }

    defaults(prestige = 0) {
        const upgrades = {};
        for (const u of UPGRADES) upgrades[u.id] = 0;
        // Гарантированные поля для улучшений напарников
        upgrades.helper_speed = 0;
        upgrades.helper_radius = 0;
        upgrades.helper_vision = 0;
        upgrades.dog_power = 0;

        const p = Math.max(0, Math.floor(Number(prestige) || 0));
        const startCoins = typeof prestigeStartingCoins === 'function'
            ? prestigeStartingCoins(p)
            : (p > 0 ? (50 + 50 * p) : 0);

        const out = {
            v: 2,
            playerId: 'player_' + Math.random().toString(36).slice(2, 9),
            nickname: 'Фермер',
            coins: startCoins,
            day: 1,
            prestige: p,
            upgrades,
            helpers: 0,
            dogs: 0,
            hats: ['straw'],
            hat: 'straw',
            ach: {},
            achProgress: this._defaultAchProgress(),
            hasDualBarns: false,
            sprintTimeTotal: 0,
            seen: {},
            tutorial: false,
            stats: {
                totalPigs: 0, totalCoins: startCoins, bestCombo: 0, bestMulti: 0, goldCaught: 0, bossKilled: 0,
                ninjaCaught: 0, boarsCaught: 0, perfectDays: 0, bestDay: 1, prestige: p, daysPlayed: 0,
                sprintTimeTotal: 0
            },
            battleStats: {
                wins: 0,
                losses: 0,
                ties: 0,
                bestCatch: 0,
                totalMatches: 0
            },
            realLeaderboard: [],
            settings: { muted: false, music: true }
        };
        this.data = out;
        return out;
    }

    load() {
        const def = this.defaults();
        try {
            const raw = localStorage.getItem(this.key);
            if (!raw) {
                this.data = def;
                this.syncSelfToLeaderboard(this.data);
                return def;
            }
            const p = JSON.parse(raw);
            if (!p || typeof p !== 'object') {
                this.data = def;
                this.syncSelfToLeaderboard(this.data);
                return def;
            }
            const out = { ...def, ...p };
            out.playerId = (typeof p.playerId === 'string' && p.playerId.trim()) ? p.playerId : def.playerId;
            out.nickname = (typeof p.nickname === 'string' && p.nickname.trim()) ? p.nickname.trim().slice(0, 20) : 'Фермер';

            out.upgrades = { ...def.upgrades, ...(p.upgrades || {}) };
            if (out.upgrades.helper_speed === undefined) out.upgrades.helper_speed = 0;
            if (out.upgrades.helper_radius === undefined) out.upgrades.helper_radius = 0;
            if (out.upgrades.helper_vision === undefined) out.upgrades.helper_vision = 0;
            if (out.upgrades.dog_power === undefined) out.upgrades.dog_power = 0;

            out.stats = { ...def.stats, ...(p.stats || {}) };
            if (out.stats.boarsCaught === undefined) out.stats.boarsCaught = 0;
            if (out.stats.sprintTimeTotal === undefined) out.stats.sprintTimeTotal = 0;

            out.settings = { ...def.settings, ...(p.settings || {}) };
            out.ach = { ...(p.ach || {}) };
            out.seen = { ...(p.seen || {}) };
            out.hats = Array.isArray(p.hats) && p.hats.length ? p.hats : ['straw'];
            out.coins = Math.max(0, Math.floor(Number(out.coins) || 0));
            out.day = Math.max(1, Math.floor(Number(out.day) || 1));

            // Dual Barns (Северный и Южный амбары)
            out.hasDualBarns = typeof p.hasDualBarns === 'boolean' ? p.hasDualBarns : false;

            // Sprint time total (seconds spent running/sprinting)
            out.sprintTimeTotal = Math.max(0, Number(p.sprintTimeTotal) || Number(out.stats.sprintTimeTotal) || 0);
            out.stats.sprintTimeTotal = out.sprintTimeTotal;

            // Multi-tiered achievements progress
            out.achProgress = {};
            const defAchProg = this._defaultAchProgress();
            const savedAchProg = (p && typeof p.achProgress === 'object' && p.achProgress !== null) ? p.achProgress : {};
            for (const chainId in defAchProg) {
                const sItem = savedAchProg[chainId];
                if (sItem && typeof sItem === 'object') {
                    out.achProgress[chainId] = {
                        tier: Math.max(1, Math.floor(Number(sItem.tier) || 1)),
                        claimed: !!sItem.claimed
                    };
                } else {
                    out.achProgress[chainId] = { ...defAchProg[chainId] };
                }
            }

            // 1v1 Battle stats
            const b = p.battleStats || {};
            out.battleStats = {
                wins: Math.max(0, Math.floor(Number(b.wins) || 0)),
                losses: Math.max(0, Math.floor(Number(b.losses) || 0)),
                ties: Math.max(0, Math.floor(Number(b.ties) || 0)),
                bestCatch: Math.max(0, Math.floor(Number(b.bestCatch) || 0)),
                totalMatches: Math.max(0, Math.floor(Number(b.totalMatches) || 0))
            };

            // Real players leaderboard
            out.realLeaderboard = Array.isArray(p.realLeaderboard) ? p.realLeaderboard : [];

            this.data = out;
            this.syncSelfToLeaderboard(out);
            return out;
        } catch (e) {
            console.warn('Не удалось прочитать сохранение:', e);
            this.data = def;
            this.syncSelfToLeaderboard(this.data);
            return def;
        }
    }

    save(data) {
        try {
            this.data = data;
            localStorage.setItem(this.key, JSON.stringify({ ...data, updatedAt: Date.now() }));
            return true;
        } catch (e) {
            return false;
        }
    }

    reset() {
        try { localStorage.removeItem(this.key); } catch (e) { /* ignore */ }
    }

    /** Сброс при продаже фермы (престиже) с начислением стартового капитала */
    resetPrestige(save) {
        const curPrestige = save ? (Number(save.prestige) || 0) : 0;
        const newPrestige = curPrestige + 1;
        const startCoins = typeof prestigeStartingCoins === 'function'
            ? prestigeStartingCoins(newPrestige)
            : (50 + 50 * newPrestige);

        if (save) {
            save.prestige = newPrestige;
            if (!save.stats) save.stats = {};
            save.stats.prestige = newPrestige;
            save.coins = startCoins;
            save.day = 1;
            if (!save.upgrades) save.upgrades = {};
            for (const u of UPGRADES) save.upgrades[u.id] = 0;
            save.upgrades.helper_speed = 0;
            save.upgrades.helper_radius = 0;
            save.upgrades.helper_vision = 0;
            save.upgrades.dog_power = 0;
            save.helpers = 0;
            save.dogs = 0;

            // Preserve multi-tier achievement progress, dual barns unlock, and sprint time across prestige
            if (!save.achProgress) save.achProgress = this._defaultAchProgress();
            if (save.hasDualBarns === undefined) save.hasDualBarns = false;
            if (save.sprintTimeTotal === undefined) save.sprintTimeTotal = 0;
            if (save.stats.boarsCaught === undefined) save.stats.boarsCaught = 0;
            if (save.stats.sprintTimeTotal === undefined) save.stats.sprintTimeTotal = save.sprintTimeTotal;

            this.data = save;
            this.syncSelfToLeaderboard(save);
            this.save(save);
            return save;
        }
        const fresh = this.defaults(newPrestige);
        this.save(fresh);
        return fresh;
    }

    /** Сохранение редактируемого никнейма игрока */
    savePlayerNickname(name) {
        if (!this.data) this.load();
        let clean = typeof name === 'string' ? name.trim() : '';
        if (!clean) clean = 'Фермер';
        if (clean.length > 20) clean = clean.slice(0, 20);
        this.data.nickname = clean;
        if (typeof window !== 'undefined' && window.game && window.game.save) {
            window.game.save.nickname = clean;
        }
        this.syncSelfToLeaderboard(this.data);
        this.save(this.data);
        return clean;
    }

    /**
     * Запись результата матча 1v1 Battle Mode
     * @param {'win'|'loss'|'tie'} result
     * @param {number} myPigs
     * @param {number} opponentPigs
     * @param {string} [opponentName]
     */
    recordBattleResult(result, myPigs = 0, opponentPigs = 0, opponentName = '') {
        if (!this.data) this.load();
        if (!this.data.battleStats) {
            this.data.battleStats = { wins: 0, losses: 0, ties: 0, bestCatch: 0, totalMatches: 0 };
        }
        const bs = this.data.battleStats;
        const myCount = Math.max(0, Math.floor(Number(myPigs) || 0));
        const oppCount = Math.max(0, Math.floor(Number(opponentPigs) || 0));

        bs.totalMatches = (bs.totalMatches || 0) + 1;
        if (result === 'win' || myCount > oppCount) {
            bs.wins = (bs.wins || 0) + 1;
        } else if (result === 'loss' || myCount < oppCount) {
            bs.losses = (bs.losses || 0) + 1;
        } else {
            bs.ties = (bs.ties || 0) + 1;
        }
        bs.bestCatch = Math.max(bs.bestCatch || 0, myCount);

        // Синхронизируем обновленный профиль локального игрока в лидерборд
        this.syncSelfToLeaderboard(this.data);

        // Если передан оппонент, регистрируем его в реальном лидерборде
        if (opponentName && typeof opponentName === 'string' && opponentName.trim()) {
            const oppClean = opponentName.trim().slice(0, 20);
            const oppId = 'real_' + oppClean.toLowerCase().replace(/[^a-z0-9а-яё]/gi, '_');
            const existingOpp = (this.data.realLeaderboard || []).find(p => p && (p.id === oppId || p.name === oppClean));
            this.upsertRealPlayer({
                id: oppId,
                name: oppClean,
                hat: existingOpp ? existingOpp.hat : 'straw',
                prestige: existingOpp ? existingOpp.prestige : 0,
                totalCoins: existingOpp ? existingOpp.totalCoins : (oppCount * 10),
                bestDay: existingOpp ? existingOpp.bestDay : 1,
                totalPigs: (existingOpp ? (existingOpp.totalPigs || 0) : 0) + oppCount,
                bestCombo: existingOpp ? existingOpp.bestCombo : 0,
                perfectDays: existingOpp ? existingOpp.perfectDays : 0,
                battleWins: (existingOpp ? (existingOpp.battleWins || 0) : 0) + (result === 'loss' ? 1 : 0),
                updatedAt: Date.now()
            });
        }

        this.save(this.data);
        return bs;
    }

    /**
     * Добавление / обновление реального игрока в локальной таблице лидеров
     * @param {Object} playerData { id, name, hat, prestige, totalCoins, bestDay, totalPigs, bestCombo, perfectDays, battleWins, updatedAt }
     */
    upsertRealPlayer(playerData) {
        if (!this.data) this.load();
        if (!Array.isArray(this.data.realLeaderboard)) {
            this.data.realLeaderboard = [];
        }
        if (!playerData || typeof playerData !== 'object') return null;

        const id = String(playerData.id || ('p_' + (playerData.name || 'player').toLowerCase().replace(/[^a-z0-9а-яё]/gi, '_'))).slice(0, 40);
        const name = String(playerData.name || 'Фермер').trim().slice(0, 20) || 'Фермер';
        const hat = String(playerData.hat || 'straw').slice(0, 20);
        const prestige = Math.max(0, Math.floor(Number(playerData.prestige) || 0));
        const totalCoins = Math.max(0, Math.floor(Number(playerData.totalCoins) || 0));
        const bestDay = Math.max(1, Math.floor(Number(playerData.bestDay) || 1));
        const totalPigs = Math.max(0, Math.floor(Number(playerData.totalPigs) || 0));
        const bestCombo = Math.max(0, Math.floor(Number(playerData.bestCombo) || 0));
        const perfectDays = Math.max(0, Math.floor(Number(playerData.perfectDays) || 0));
        const battleWins = Math.max(0, Math.floor(Number(playerData.battleWins) || 0));
        const updatedAt = Number(playerData.updatedAt) || Date.now();
        const isSelf = !!playerData.isSelf || id === 'local_player' || id === this.data.playerId;

        const entry = {
            id,
            name,
            hat,
            prestige,
            totalCoins,
            bestDay,
            totalPigs,
            bestCombo,
            perfectDays,
            battleWins,
            isSelf,
            updatedAt
        };

        const index = this.data.realLeaderboard.findIndex(p => p && (p.id === id || (p.name === name && !isSelf && !p.isSelf)));
        if (index >= 0) {
            const existing = this.data.realLeaderboard[index];
            this.data.realLeaderboard[index] = {
                ...existing,
                ...entry,
                name: entry.name || existing.name,
                hat: entry.hat || existing.hat,
                prestige: Math.max(existing.prestige || 0, entry.prestige),
                totalCoins: Math.max(existing.totalCoins || 0, entry.totalCoins),
                bestDay: Math.max(existing.bestDay || 1, entry.bestDay),
                totalPigs: Math.max(existing.totalPigs || 0, entry.totalPigs),
                bestCombo: Math.max(existing.bestCombo || 0, entry.bestCombo),
                perfectDays: Math.max(existing.perfectDays || 0, entry.perfectDays),
                battleWins: Math.max(existing.battleWins || 0, entry.battleWins),
                isSelf: existing.isSelf || isSelf,
                updatedAt
            };
        } else {
            this.data.realLeaderboard.push(entry);
        }

        // Ограничиваем таблицу лидеров сотней лучших записей
        if (this.data.realLeaderboard.length > 100) {
            this.data.realLeaderboard.sort((a, b) => (b.prestige * 100000 + b.totalCoins) - (a.prestige * 100000 + a.totalCoins));
            this.data.realLeaderboard = this.data.realLeaderboard.slice(0, 100);
        }

        this.save(this.data);
        return entry;
    }

    /**
     * Синхронизация профиля текущего игрока в список realLeaderboard
     */
    syncSelfToLeaderboard(save = this.data) {
        if (!save) return null;
        const stats = save.stats || {};
        const bStats = save.battleStats || {};
        const selfEntry = {
            id: save.playerId || 'local_player',
            name: save.nickname || 'Фермер',
            hat: save.hat || 'straw',
            prestige: Math.max(0, Math.floor(Number(save.prestige) || 0)),
            totalCoins: Math.max(0, Math.floor(Number(stats.totalCoins) || Number(save.coins) || 0)),
            bestDay: Math.max(1, Math.floor(Number(stats.bestDay) || Number(save.day) || 1)),
            totalPigs: Math.max(0, Math.floor(Number(stats.totalPigs) || 0)),
            bestCombo: Math.max(0, Math.floor(Number(stats.bestCombo) || 0)),
            perfectDays: Math.max(0, Math.floor(Number(stats.perfectDays) || 0)),
            battleWins: Math.max(0, Math.floor(Number(bStats.wins) || 0)),
            isSelf: true,
            updatedAt: Date.now()
        };
        return this.upsertRealPlayer(selfEntry);
    }

    /**
     * Возвращает отсортированный список реальных игроков по выбранному критерию
     */
    getRealLeaderboard(criterion = 'prestige') {
        if (!this.data) this.load();
        this.syncSelfToLeaderboard(this.data);
        const list = [...(this.data.realLeaderboard || [])];
        list.sort((a, b) => {
            const va = Number(a[criterion]) || 0;
            const vb = Number(b[criterion]) || 0;
            if (vb !== va) return vb - va;
            return (Number(b.totalCoins) || 0) - (Number(a.totalCoins) || 0);
        });
        return list;
    }

    /**
     * Возвращает карточку профиля локального игрока для WebRTC обмена
     */
    getLocalProfile() {
        if (!this.data) this.load();
        this.syncSelfToLeaderboard(this.data);
        const s = this.data;
        const st = s.stats || {};
        const bs = s.battleStats || {};
        return {
            id: s.playerId || 'local_player',
            name: s.nickname || 'Фермер',
            hat: s.hat || 'straw',
            prestige: Number(s.prestige) || 0,
            totalCoins: Number(st.totalCoins) || Number(s.coins) || 0,
            bestDay: Number(st.bestDay) || Number(s.day) || 1,
            totalPigs: Number(st.totalPigs) || 0,
            bestCombo: Number(st.bestCombo) || 0,
            perfectDays: Number(st.perfectDays) || 0,
            battleWins: Number(bs.wins) || 0,
            battleLosses: Number(bs.losses) || 0,
            battleTies: Number(bs.ties) || 0,
            battleMatches: Number(bs.totalMatches) || 0,
            bestCatch: Number(bs.bestCatch) || 0,
            updatedAt: Date.now()
        };
    }

    /**
     * Получить состояние уровня цепочки достижений (только текущий незавершенный уровень)
     * @param {string} chainId
     * @returns {Object} Информация об активном уровне цепочки
     */
    getAchievementTier(chainId) {
        if (!this.data) this.load();
        if (typeof getActiveAchievementTier === 'function') {
            return getActiveAchievementTier(chainId, this.data);
        }
        const prog = (this.data.achProgress && this.data.achProgress[chainId]) || { tier: 1, claimed: false };
        const chain = (typeof ACHIEVEMENT_CHAINS !== 'undefined' && ACHIEVEMENT_CHAINS[chainId]) || null;
        const currentTierNum = Math.max(1, Math.floor(Number(prog.tier) || 1));
        const maxTierNum = chain ? chain.tiers.length : 5;
        const isCompleted = currentTierNum > maxTierNum;
        const tierDef = chain ? (chain.tiers.find(t => t.tier === currentTierNum) || chain.tiers[chain.tiers.length - 1]) : null;

        let statVal = 0;
        if (chain && chain.stat) {
            if (chain.stat === 'sprintTimeTotal') statVal = Math.floor(Number(this.data.sprintTimeTotal) || 0);
            else if (chain.stat === 'prestige') statVal = Number(this.data.prestige) || 0;
            else if (this.data.stats) statVal = Number(this.data.stats[chain.stat]) || 0;
        }

        const goal = tierDef ? tierDef.goal : 1;
        const canClaim = !isCompleted && !prog.claimed && (statVal >= goal);

        return {
            chainId,
            chainName: chain ? chain.name : chainId,
            icon: chain ? chain.icon : '🏆',
            tier: currentTierNum,
            maxTier: maxTierNum,
            roman: isCompleted ? 'MAX' : (tierDef ? tierDef.roman : 'I'),
            title: isCompleted ? (chain ? `${chain.name} (Завершено)` : chainId) : (tierDef ? tierDef.title : chainId),
            desc: tierDef ? tierDef.desc : '',
            goal,
            target: goal,
            reward: tierDef ? tierDef.reward : 0,
            currentValue: statVal,
            displayValue: Math.min(statVal, goal),
            pct: isCompleted ? 100 : Math.min(100, Math.round((statVal / goal) * 100)),
            canClaim,
            claimed: !!prog.claimed,
            isCompleted,
            unlocksDualBarns: !!(tierDef && tierDef.unlocksDualBarns)
        };
    }

    /**
     * Забрать награду за текущий выполненный уровень цепочки достижений:
     * начисляет монеты награды, продвигает уровень цепочки к следующему (tier + 1)
     * @param {string} chainId
     * @returns {Object} Результат операции
     */
    claimAchievementTier(chainId) {
        if (!this.data) this.load();
        if (!this.data.achProgress) this.data.achProgress = this._defaultAchProgress();
        if (!this.data.achProgress[chainId]) {
            this.data.achProgress[chainId] = { tier: 1, claimed: false };
        }
        const prog = this.data.achProgress[chainId];
        const chain = (typeof ACHIEVEMENT_CHAINS !== 'undefined' && ACHIEVEMENT_CHAINS[chainId]) || null;
        const currentTier = Math.max(1, Math.floor(Number(prog.tier) || 1));
        const maxTier = chain ? chain.tiers.length : 5;

        if (currentTier > maxTier) {
            return { success: false, reason: 'already_maxed', chainId, tier: currentTier };
        }

        const tierDef = chain ? (chain.tiers.find(t => t.tier === currentTier) || chain.tiers[currentTier - 1]) : null;
        const reward = tierDef ? tierDef.reward : 10;

        // Начисление монет награды
        this.data.coins = Math.max(0, (Number(this.data.coins) || 0) + reward);
        if (this.data.stats) {
            this.data.stats.totalCoins = Math.max(0, (Number(this.data.stats.totalCoins) || 0) + reward);
        }

        // Продвижение уровня к tier + 1
        prog.tier = currentTier + 1;
        prog.claimed = false;

        // Синхронизация с рантайм-объектом window.game, если игра сейчас запущена
        if (typeof window !== 'undefined' && window.game && window.game.save) {
            window.game.save.coins = this.data.coins;
            if (!window.game.save.achProgress) window.game.save.achProgress = {};
            window.game.save.achProgress[chainId] = { ...prog };
            if (window.game.save.stats) {
                window.game.save.stats.totalCoins = this.data.stats.totalCoins;
            }
        }

        this.syncSelfToLeaderboard(this.data);
        this.save(this.data);

        return {
            success: true,
            chainId,
            claimedTier: currentTier,
            newTier: prog.tier,
            reward,
            isCompleted: prog.tier > maxTier
        };
    }

    /**
     * Включение / выключение Второго Амбара (Prestige 6+)
     * @param {boolean} active
     * @returns {boolean}
     */
    setDualBarns(active) {
        if (!this.data) this.load();
        const val = !!active;
        this.data.hasDualBarns = val;
        if (typeof window !== 'undefined' && window.game && window.game.save) {
            window.game.save.hasDualBarns = val;
        }
        this.save(this.data);
        return this.data.hasDualBarns;
    }

    /**
     * Проверка, активны ли два амбара
     * @returns {boolean}
     */
    hasDualBarns() {
        if (!this.data) this.load();
        return !!this.data.hasDualBarns;
    }

    /**
     * Проверка права на открытие / покупку Второго Амбара (престиж 6+)
     * @returns {boolean}
     */
    canUnlockDualBarns() {
        if (!this.data) this.load();
        const p = Math.max(0, Math.floor(Number(this.data.prestige) || 0));
        return p >= (typeof CONFIG !== 'undefined' && CONFIG.DUAL_BARNS_PRESTIGE_REQ ? CONFIG.DUAL_BARNS_PRESTIGE_REQ : 6);
    }

    /**
     * Добавление секунд спринта/бега в общий счетчик достижений
     * @param {number} seconds
     * @returns {number}
     */
    addSprintTime(seconds) {
        if (!this.data) this.load();
        const dt = Math.max(0, Number(seconds) || 0);
        this.data.sprintTimeTotal = (Number(this.data.sprintTimeTotal) || 0) + dt;
        if (this.data.stats) {
            this.data.stats.sprintTimeTotal = this.data.sprintTimeTotal;
        }
        if (typeof window !== 'undefined' && window.game && window.game.save) {
            window.game.save.sprintTimeTotal = this.data.sprintTimeTotal;
            if (window.game.save.stats) {
                window.game.save.stats.sprintTimeTotal = this.data.sprintTimeTotal;
            }
        }
        return this.data.sprintTimeTotal;
    }

    /**
     * Регистрация пойманного кабана
     * @param {number} count
     * @returns {number}
     */
    recordBoarCaught(count = 1) {
        if (!this.data) this.load();
        if (!this.data.stats) this.data.stats = {};
        const n = Math.max(0, Math.floor(Number(count) || 1));
        this.data.stats.boarsCaught = (Number(this.data.stats.boarsCaught) || 0) + n;
        if (typeof window !== 'undefined' && window.game && window.game.save && window.game.save.stats) {
            window.game.save.stats.boarsCaught = this.data.stats.boarsCaught;
        }
        return this.data.stats.boarsCaught;
    }
}
