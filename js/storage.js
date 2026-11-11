'use strict';

/**
 * Сохранение прогресса в localStorage
 */
class StorageManager {
    constructor(key = CONFIG.SAVE_KEY) {
        this.key = key;
    }

    defaults() {
        const upgrades = {};
        for (const u of UPGRADES) upgrades[u.id] = 0;
        return {
            v: 2,
            coins: 0,
            day: 1,
            prestige: 0,
            upgrades,
            helpers: 0,
            dogs: 0,
            hats: ['straw'],
            hat: 'straw',
            ach: {},
            seen: {},
            tutorial: false,
            stats: {
                totalPigs: 0, totalCoins: 0, bestCombo: 0, bestMulti: 0, goldCaught: 0, bossKilled: 0,
                ninjaCaught: 0, perfectDays: 0, bestDay: 1, prestige: 0, daysPlayed: 0
            },
            settings: { muted: false, music: true }
        };
    }

    load() {
        const def = this.defaults();
        try {
            const raw = localStorage.getItem(this.key);
            if (!raw) return def;
            const p = JSON.parse(raw);
            if (!p || typeof p !== 'object') return def;
            const out = { ...def, ...p };
            out.upgrades = { ...def.upgrades, ...(p.upgrades || {}) };
            out.stats = { ...def.stats, ...(p.stats || {}) };
            out.settings = { ...def.settings, ...(p.settings || {}) };
            out.ach = { ...(p.ach || {}) };
            out.seen = { ...(p.seen || {}) };
            out.hats = Array.isArray(p.hats) && p.hats.length ? p.hats : ['straw'];
            out.coins = Math.max(0, Math.floor(Number(out.coins) || 0));
            out.day = Math.max(1, Math.floor(Number(out.day) || 1));
            return out;
        } catch (e) {
            console.warn('Не удалось прочитать сохранение:', e);
            return def;
        }
    }

    save(data) {
        try {
            localStorage.setItem(this.key, JSON.stringify({ ...data, updatedAt: Date.now() }));
            return true;
        } catch (e) {
            return false;
        }
    }

    reset() {
        try { localStorage.removeItem(this.key); } catch (e) { /* ignore */ }
    }
}
