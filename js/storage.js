/**
 * Управление сохранением и загрузкой данных игры через localStorage
 */
class StorageManager {
    constructor(key = 'svinolov_save_v1') {
        this.key = key;
        this.defaultData = {
            coins: 0,
            day: 1,
            totalPigsCaught: 0,
            upgrades: {
                helpersCount: 0,
                playerSpeedLevel: 1
            }
        };
    }

    /**
     * Загружает данные из хранилища с откатом на значения по умолчанию
     * @returns {Object}
     */
    load() {
        try {
            const raw = localStorage.getItem(this.key);
            if (!raw) return { ...this.defaultData };
            const parsed = JSON.parse(raw);
            return {
                coins: typeof parsed.coins === 'number' ? parsed.coins : this.defaultData.coins,
                day: typeof parsed.day === 'number' ? parsed.day : this.defaultData.day,
                totalPigsCaught: typeof parsed.totalPigsCaught === 'number' ? parsed.totalPigsCaught : 0,
                upgrades: { ...this.defaultData.upgrades, ...(parsed.upgrades || {}) }
            };
        } catch (e) {
            console.warn('Не удалось прочитать localStorage, используются значения по умолчанию:', e);
            return { ...this.defaultData };
        }
    }

    /**
     * Сохраняет текущие данные игры
     * @param {Object} data 
     * @returns {boolean} Успешность сохранения
     */
    save(data) {
        try {
            const current = this.load();
            const toSave = {
                ...current,
                ...data,
                updatedAt: Date.now()
            };
            localStorage.setItem(this.key, JSON.stringify(toSave));
            return true;
        } catch (e) {
            console.warn('Не удалось сохранить данные в localStorage:', e);
            return false;
        }
    }

    /**
     * Полный сброс сохранений
     */
    reset() {
        try {
            localStorage.removeItem(this.key);
        } catch (e) {
            console.warn('Ошибка при сбросе данных в localStorage:', e);
        }
    }
}
