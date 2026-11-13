'use strict';

/* ============================================================
 *  «Свинолов» — конфигурация, баланс и общие утилиты
 * ============================================================ */

if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
        let r = typeof radii === 'number' ? radii : (Array.isArray(radii) ? radii[0] : 0) || 0;
        r = Math.min(r, w / 2, h / 2);
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    };
}

const U = {
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a)),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
    easeOut: (t) => 1 - Math.pow(1 - t, 3),
    easeOutBack: (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    /** Детерминированный ГПСЧ — чтобы карта не менялась между перезагрузками */
    seeded: (seed) => () => {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    fmt: (n) => {
        n = Math.floor(n);
        if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.0', '') + 'M';
        if (n >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace('.0', '') + 'K';
        return String(n);
    },
    plural: (n, one, few, many) => {
        const a = Math.abs(n) % 100, b = a % 10;
        if (a > 10 && a < 20) return many;
        if (b > 1 && b < 5) return few;
        if (b === 1) return one;
        return many;
    }
};

const CONFIG = {
    SAVE_KEY: 'svinolov_save_v2',

    PLAYER_SPEED: 250,
    PLAYER_RADIUS: 15,
    CATCH_RADIUS: 64,
    SWING_COOLDOWN: 0.55,
    SWING_MISS_FACTOR: 0.6,   // промах перезаряжается быстрее

    DASH_SPEED: 800,
    DASH_TIME: 0.18,
    DASH_COOLDOWN: 2.6,

    COMBO_WINDOW: 3.6,
    COMBO_STEP: 0.2,          // +20% монет за каждое звено комбо
    COMBO_MAX_MULT: 6,

    STUN_TIME: 0.95,

    POWERUP_INTERVAL: 12,
    POWERUP_LIFETIME: 16,
    POWERUP_MAX: 3,

    PRESTIGE_DAY: 20,
    PRESTIGE_BONUS: 0.5,
    PRESTIGE_START_BASE: 50,
    PRESTIGE_START_STEP: 50,

    WORLD_SIZES: [[1500, 1050], [2000, 1350], [2500, 1650]],
    TIER_DAYS: [1, 7, 15],
    SEASON_LENGTH: 6
};

/* ---------- Виды свиней ---------- */
const PIG_TYPES = {
    pink: {
        name: 'Хрюша', r: 17, scale: 1, speed: 62, panic: 176, panicR: 150, stamina: 5.5, reward: 2,
        body: '#fbb6d4', dark: '#e879a9', snout: '#f4729f'
    },
    piglet: {
        name: 'Поросёнок', r: 11, scale: 0.64, speed: 85, panic: 206, panicR: 135, stamina: 4, reward: 1,
        erratic: true, body: '#ffd0e2', dark: '#f39ac0', snout: '#f78fb3',
        tip: 'Поросята мелкие и вертлявые — зато бегают стайкой: лови одним взмахом!'
    },
    runner: {
        name: 'Шустрик', r: 16, scale: 0.95, speed: 80, panic: 268, panicR: 190, stamina: 2.4, reward: 4,
        body: '#ffc2b0', dark: '#ef8d74', snout: '#f2795c',
        tip: 'Шустрик быстрее тебя, но выдыхается за пару секунд. Гони, пока не запыхтит!'
    },
    big: {
        name: 'Кабан', r: 27, scale: 1.6, speed: 46, panic: 120, panicR: 0, stamina: 99, reward: 12, hp: 3,
        charger: true, chargeSpeed: 500, chargeCd: 3.6, chargeRange: 330,
        body: '#f08fb5', dark: '#c95588', snout: '#d9467e',
        tip: 'Кабан идёт на таран! Увернись рывком (SHIFT) и бей, пока он видит звёзды — урон x2.'
    },
    mud: {
        name: 'Грязнуля', r: 18, scale: 1.05, speed: 66, panic: 182, panicR: 155, stamina: 6, reward: 4,
        mud: true, body: '#c99a6b', dark: '#8a5a33', snout: '#b0784a',
        tip: 'Грязнуля оставляет лужи. В грязи фермер вязнет — обходи или перепрыгивай рывком!'
    },
    ninja: {
        name: 'Ниндзя', r: 16, scale: 0.98, speed: 74, panic: 196, panicR: 170, stamina: 5, reward: 6,
        ninja: true, body: '#5b6472', dark: '#2f3640', snout: '#7b8594',
        tip: 'Ниндзя исчезает в дыму от первого взмаха. Второй раз уже не увернётся!'
    },
    gold: {
        name: 'Золотая', r: 16, scale: 0.95, speed: 110, panic: 252, panicR: 210, stamina: 4, reward: 15,
        gold: true, bonus: true, life: 15, body: '#ffd84a', dark: '#d99a06', snout: '#f5b21a'
    },
    boss: {
        name: 'Хряк-Босс', r: 40, scale: 2.5, speed: 55, panic: 130, panicR: 0, stamina: 99, reward: 40, hp: 6,
        charger: true, boss: true, chargeSpeed: 560, chargeCd: 2.8, chargeRange: 420,
        body: '#9a6748', dark: '#5e3a25', snout: '#c98b68'
    }
};

/** Стартовый капитал при продаже фермы (престиже) */
function prestigeStartingCoins(prestige) {
    const p = Math.max(0, Math.floor(Number(prestige) || 0));
    return p > 0 ? (CONFIG.PRESTIGE_START_BASE + CONFIG.PRESTIGE_START_STEP * p) : 0;
}
CONFIG.prestigeStartingCoins = prestigeStartingCoins;

/* ---------- Прокачка напарников и пса ---------- */
const HELPER_UPGRADES = [
    {
        id: 'helper_speed',
        icon: '🥾',
        title: 'Быстрые ноги',
        desc: 'Напарники бегают быстрее (+15% за ур.)',
        category: 'team',
        max: 5,
        base: 35,
        growth: 1.6,
        fx: (l) => `+${l * 15}% к скорости`
    },
    {
        id: 'helper_radius',
        icon: '🕸️',
        title: 'Большие сачки',
        desc: 'Радиус поимки свиней напарниками (+15% за ур.)',
        category: 'team',
        max: 5,
        base: 40,
        growth: 1.6,
        fx: (l) => `+${l * 15}% к радиусу сачка`
    },
    {
        id: 'helper_vision',
        icon: '👀',
        title: 'Чуткий взор',
        desc: 'Радиус обнаружения свиней (+25% за ур.) и реакция',
        category: 'team',
        max: 4,
        base: 50,
        growth: 1.65,
        fx: (l) => `+${l * 25}% к обзору и реакции`
    },
    {
        id: 'dog_power',
        icon: '🐕',
        title: 'Грозный лай',
        desc: 'Радиус и длительность испуга/замедления свиней от лая Бобика',
        category: 'team',
        max: 5,
        base: 45,
        growth: 1.6,
        fx: (l) => `Радиус лая +${l * 20}%, страх +${(l * 0.7).toFixed(1)} с`
    }
];

/* ---------- Улучшения ---------- */
const UPGRADES = [
    { id: 'boots', icon: '🥾', title: 'Сапоги-скороходы', desc: 'Фермер бегает быстрее', max: 10, base: 15, growth: 1.55, fx: (l) => `+${l * 6}% к скорости` },
    { id: 'net', icon: '🕸️', title: 'Широкий сачок', desc: 'Больше радиус взмаха — больше свиней за раз', max: 10, base: 20, growth: 1.55, fx: (l) => `+${l * 8}% к радиусу` },
    { id: 'hands', icon: '⚡', title: 'Ловкие руки', desc: 'Сачок перезаряжается быстрее', max: 8, base: 25, growth: 1.6, fx: (l) => `Взмах раз в ${(CONFIG.SWING_COOLDOWN * Math.pow(0.9, l)).toFixed(2)} с` },
    { id: 'dash', icon: '💨', title: 'Реактивный рывок', desc: 'Рывок перезаряжается быстрее', max: 6, base: 30, growth: 1.6, fx: (l) => `Рывок раз в ${(CONFIG.DASH_COOLDOWN * Math.pow(0.87, l)).toFixed(1)} с` },
    { id: 'combo', icon: '🔥', title: 'Азарт', desc: 'Комбо не сгорает дольше', max: 6, base: 30, growth: 1.6, fx: (l) => `Комбо держится ${(CONFIG.COMBO_WINDOW + l * 0.5).toFixed(1)} с` },
    { id: 'bank', icon: '🐖', title: 'Свинья-копилка', desc: 'Больше монет за каждую пойманную свинью', max: 12, base: 40, growth: 1.6, fx: (l) => `+${l * 15}% монет` },
    { id: 'clock', icon: '⏰', title: 'Долгий день', desc: 'Солнце садится позже', max: 6, base: 35, growth: 1.6, fx: (l) => `+${l * 6} с к каждому дню` },
    { id: 'luck', icon: '🍀', title: 'Фермерская удача', desc: 'Бонусы и золотые свиньи появляются чаще', max: 6, base: 45, growth: 1.6, fx: (l) => `+${l * 15}% к удаче` },
    ...HELPER_UPGRADES
];

const TEAM = [
    {
        id: 'helpers', icon: '🧑‍🌾', title: 'Напарник', desc: 'Сам бегает по ферме и ловит свиней сачком',
        costs: [60, 200, 500, 1100], days: [3, 8, 14, 20]
    },
    {
        id: 'dogs', icon: '🐕', title: 'Пёс Бобик', desc: 'Облаивает свиней — они замирают от страха и становятся медленными',
        costs: [120, 420], days: [5, 12]
    }
];

/* ---------- Шляпы (косметика) ---------- */
const HATS = [
    { id: 'straw', name: 'Соломенная', cost: 0 },
    { id: 'cap', name: 'Кепка', cost: 40 },
    { id: 'cowboy', name: 'Ковбойская', cost: 120 },
    { id: 'chef', name: 'Колпак повара', cost: 250 },
    { id: 'viking', name: 'Шлем викинга', cost: 500 },
    { id: 'pig', name: 'Свиные ушки', cost: 900 },
    { id: 'crown', name: 'Корона', cost: 2000 }
];

/* ---------- Достижения ---------- */
const ACHIEVEMENTS = [
    { id: 'p1', icon: '🐷', title: 'Первая хрюшка', desc: 'Поймай первую свинью', stat: 'totalPigs', goal: 1, reward: 5 },
    { id: 'p50', icon: '🐖', title: 'Свинопас', desc: 'Поймай 50 свиней', stat: 'totalPigs', goal: 50, reward: 30 },
    { id: 'p250', icon: '🚜', title: 'Гроза свинарника', desc: 'Поймай 250 свиней', stat: 'totalPigs', goal: 250, reward: 120 },
    { id: 'p1000', icon: '🏅', title: 'Легенда фермы', desc: 'Поймай 1000 свиней', stat: 'totalPigs', goal: 1000, reward: 500 },
    { id: 'c5', icon: '🔥', title: 'Разогрелся', desc: 'Набери комбо x5', stat: 'bestCombo', goal: 5, reward: 15 },
    { id: 'c10', icon: '🔥', title: 'В ударе', desc: 'Набери комбо x10', stat: 'bestCombo', goal: 10, reward: 50 },
    { id: 'c20', icon: '☄️', title: 'Не остановить', desc: 'Набери комбо x20', stat: 'bestCombo', goal: 20, reward: 180 },
    { id: 'm2', icon: '✌️', title: 'Двух зайцев', desc: 'Поймай 2 свиней одним взмахом', stat: 'bestMulti', goal: 2, reward: 10 },
    { id: 'm3', icon: '🤟', title: 'Хет-трик', desc: 'Поймай 3 свиней одним взмахом', stat: 'bestMulti', goal: 3, reward: 35 },
    { id: 'm5', icon: '🖐️', title: 'Невод', desc: 'Поймай 5 свиней одним взмахом', stat: 'bestMulti', goal: 5, reward: 120 },
    { id: 'g1', icon: '✨', title: 'Золотая лихорадка', desc: 'Поймай золотую свинью', stat: 'goldCaught', goal: 1, reward: 25 },
    { id: 'g10', icon: '💰', title: 'Золотые руки', desc: 'Поймай 10 золотых свиней', stat: 'goldCaught', goal: 10, reward: 200 },
    { id: 'b1', icon: '🐗', title: 'Укротитель', desc: 'Одолей Хряка-Босса', stat: 'bossKilled', goal: 1, reward: 50 },
    { id: 'b5', icon: '👑', title: 'Король загона', desc: 'Одолей 5 боссов', stat: 'bossKilled', goal: 5, reward: 300 },
    { id: 'n5', icon: '🥷', title: 'Охотник на ниндзя', desc: 'Поймай 5 свиней-ниндзя', stat: 'ninjaCaught', goal: 5, reward: 40 },
    { id: 's5', icon: '⭐', title: 'Отличник', desc: 'Заверши 5 дней на 3 звезды', stat: 'perfectDays', goal: 5, reward: 40 },
    { id: 's20', icon: '🌟', title: 'Перфекционист', desc: 'Заверши 20 дней на 3 звезды', stat: 'perfectDays', goal: 20, reward: 250 },
    { id: 'd10', icon: '📅', title: 'Декада', desc: 'Дойди до 10-го дня', stat: 'bestDay', goal: 10, reward: 60 },
    { id: 'd25', icon: '🗓️', title: 'Старожил', desc: 'Дойди до 25-го дня', stat: 'bestDay', goal: 25, reward: 250 },
    { id: 'd50', icon: '🏆', title: 'Вечный фермер', desc: 'Дойди до 50-го дня', stat: 'bestDay', goal: 50, reward: 800 },
    { id: 'rich', icon: '🤑', title: 'Богатей', desc: 'Заработай 2000 монет за всё время', stat: 'totalCoins', goal: 2000, reward: 150 },
    { id: 'pr1', icon: '🐽', title: 'Новая жизнь', desc: 'Продай ферму и начни заново', stat: 'prestige', goal: 1, reward: 300 }
];

/* ---------- Времена года ---------- */
const SEASONS = [
    {
        id: 'summer', name: 'Лето', icon: '☀️',
        grass: '#63b54d', grass2: '#58a845', grass3: '#77c75e', path: '#d2a56c', pathEdge: '#a67a45',
        tree: '#3f9647', tree2: '#59b458', flowers: ['#ffffff', '#ffe066', '#ff8fab', '#8ecbff'], flowerRate: 1, weather: null
    },
    {
        id: 'autumn', name: 'Осень', icon: '🍂',
        grass: '#a7a84c', grass2: '#99993f', grass3: '#bdbb5e', path: '#c79a63', pathEdge: '#96703f',
        tree: '#e0782a', tree2: '#f2aa3a', flowers: ['#f4a236', '#d9534f', '#ffd166'], flowerRate: 0.5, weather: 'leaf'
    },
    {
        id: 'winter', name: 'Зима', icon: '❄️',
        grass: '#e6f0f6', grass2: '#d7e6ef', grass3: '#f6fbfe', path: '#c4b8a6', pathEdge: '#9c8f7d',
        tree: '#bfd8e6', tree2: '#eef6fb', flowers: ['#bfe3ff'], flowerRate: 0.12, weather: 'snow'
    },
    {
        id: 'spring', name: 'Весна', icon: '🌸',
        grass: '#7ccc5c', grass2: '#70bf52', grass3: '#93dc70', path: '#d6ab75', pathEdge: '#a8804c',
        tree: '#f59fc4', tree2: '#fcc6de', flowers: ['#ffffff', '#ff9ecd', '#ffe066', '#c9a0ff', '#8ecbff'], flowerRate: 2.2, weather: 'petal'
    }
];

/* ---------- События дня ---------- */
const EVENTS = {
    night: { icon: '🌙', title: 'Ночная охота', desc: 'Темно! Видно только то, что рядом. Зато монет x1.5' },
    rain: { icon: '🌧️', title: 'Ливень', desc: 'Кругом лужи грязи, свиньи скользкие и быстрые. Монет x1.5' },
    gold: { icon: '✨', title: 'Золотая лихорадка', desc: 'Золотые свиньи так и лезут из-под земли!' },
    piglets: { icon: '🐽', title: 'Нашествие поросят', desc: 'Целые стайки мелюзги — идеальный день для комбо!' }
};

/* ---------- Бонусы на поле ---------- */
const POWERUPS = {
    speed: { icon: '⚡', name: 'Энергетик', color: '#ffd23f', time: 8, text: 'Скорость!' },
    net: { icon: '🕸️', name: 'Мега-сачок', color: '#7dd3fc', time: 8, text: 'Мега-сачок!' },
    x2: { icon: '💰', name: 'Двойные монеты', color: '#fbbf24', time: 10, text: 'Монеты x2!' },
    carrot: { icon: '🥕', name: 'Морковка', color: '#fb923c', time: 5, text: 'Свиньи бегут к тебе!' },
    freeze: { icon: '❄️', name: 'Заморозка', color: '#a5f3fc', time: 4, text: 'Заморозка!' },
    clock: { icon: '⏰', name: 'Будильник', color: '#f87171', time: 0, text: '+10 секунд!' }
};

/** Стоимость следующего уровня улучшения */
function upgradeCost(up, level) {
    const raw = up.base * Math.pow(up.growth, level);
    return raw < 100 ? Math.round(raw / 5) * 5 : Math.round(raw / 10) * 10;
}

function tierForDay(day) {
    let t = 0;
    for (let i = 0; i < CONFIG.TIER_DAYS.length; i++) if (day >= CONFIG.TIER_DAYS[i]) t = i;
    return t;
}

function seasonForDay(day) {
    return Math.floor((day - 1) / CONFIG.SEASON_LENGTH) % SEASONS.length;
}

/** Состав свиней на день */
function buildRoster(day, eventId) {
    let n = Math.min(44, 4 + Math.round(day * 1.15));
    const list = [];
    const bossDay = day % 5 === 0;
    if (bossDay) list.push('boss');
    const bigs = (!bossDay && day >= 4) ? Math.min(3, 1 + Math.floor((day - 4) / 7)) : 0;
    for (let i = 0; i < bigs; i++) list.push('big');
    if (eventId === 'piglets') n += 6;

    const forced = { 2: ['piglet', 'piglet', 'piglet'], 3: ['runner'], 6: ['mud'], 8: ['ninja'] }[day] || [];
    for (const t of forced) list.push(t);

    while (list.length < n) {
        const r = Math.random();
        let t = 'pink';
        const pRunner = day >= 3 ? Math.min(0.22, 0.1 + day * 0.008) : 0;
        const pMud = day >= 6 ? 0.11 : 0;
        const pNinja = day >= 8 ? Math.min(0.16, 0.08 + day * 0.004) : 0;
        const pPiglet = day >= 2 ? (eventId === 'piglets' ? 0.6 : 0.2) : 0;
        if (r < pNinja) t = 'ninja';
        else if (r < pNinja + pMud) t = 'mud';
        else if (r < pNinja + pMud + pRunner) t = 'runner';
        else if (r < pNinja + pMud + pRunner + pPiglet) t = 'piglet';
        list.push(t);
    }
    return list;
}

function dayDuration(day, roster) {
    let t = 26 + roster.length * 3.4;
    for (const r of roster) {
        if (r === 'boss') t += 18;
        if (r === 'big') t += 5;
    }
    return t;
}

function pickEvent(day) {
    if (day < 7 || day % 5 === 0) return null;
    if (Math.random() > 0.38) return null;
    return U.pick(Object.keys(EVENTS));
}

/** Задание дня */
function makeQuest(day, roster) {
    const reward = 6 + day * 2;
    const pool = [
        { id: 'combo', goal: Math.min(16, 3 + Math.floor(day / 3)), text: (g) => `Набери комбо x${g}` },
        { id: 'multi', goal: day >= 12 ? 3 : 2, text: (g) => `Поймай ${g} свиней одним взмахом` },
        { id: 'fast', goal: 45, text: (g) => `Закончи день, пока осталось ${g}% времени` },
        { id: 'powerups', goal: 2, text: (g) => `Подбери ${g} бонуса` }
    ];
    if (day >= 3) pool.push({ id: 'nodash', goal: 1, text: () => 'Пройди день без рывка' });
    if (roster.includes('big') || roster.includes('boss')) pool.push({ id: 'nostun', goal: 1, text: () => 'Не попадись кабану под копыта' });
    const q = U.pick(pool);
    return { id: q.id, goal: q.goal, text: q.text(q.goal), reward, done: false, failed: false, progress: 0 };
}
