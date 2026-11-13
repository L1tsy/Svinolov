'use strict';

/**
 * Сохранение прогресса в localStorage
 */
class StorageManager {
    constructor(key = CONFIG.SAVE_KEY) {
        this.key = key;
        this.data = null;
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
            coins: startCoins,
            day: 1,
            prestige: p,
            upgrades,
            helpers: 0,
            dogs: 0,
            hats: ['straw'],
            hat: 'straw',
            ach: {},
            seen: {},
            tutorial: false,
            stats: {
                totalPigs: 0, totalCoins: startCoins, bestCombo: 0, bestMulti: 0, goldCaught: 0, bossKilled: 0,
                ninjaCaught: 0, perfectDays: 0, bestDay: 1, prestige: p, daysPlayed: 0
            },
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
                return def;
            }
            const p = JSON.parse(raw);
            if (!p || typeof p !== 'object') {
                this.data = def;
                return def;
            }
            const out = { ...def, ...p };
            out.upgrades = { ...def.upgrades, ...(p.upgrades || {}) };
            if (out.upgrades.helper_speed === undefined) out.upgrades.helper_speed = 0;
            if (out.upgrades.helper_radius === undefined) out.upgrades.helper_radius = 0;
            if (out.upgrades.helper_vision === undefined) out.upgrades.helper_vision = 0;
            if (out.upgrades.dog_power === undefined) out.upgrades.dog_power = 0;

            out.stats = { ...def.stats, ...(p.stats || {}) };
            out.settings = { ...def.settings, ...(p.settings || {}) };
            out.ach = { ...(p.ach || {}) };
            out.seen = { ...(p.seen || {}) };
            out.hats = Array.isArray(p.hats) && p.hats.length ? p.hats : ['straw'];
            out.coins = Math.max(0, Math.floor(Number(out.coins) || 0));
            out.day = Math.max(1, Math.floor(Number(out.day) || 1));
            this.data = out;
            return out;
        } catch (e) {
            console.warn('Не удалось прочитать сохранение:', e);
            this.data = def;
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
            this.save(save);
            return save;
        }
        const fresh = this.defaults(newPrestige);
        this.save(fresh);
        return fresh;
    }
}
