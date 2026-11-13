'use strict';

/* ============================================================
 *  Константы и данные Топа игроков (Лидерборд)
 * ============================================================ */
const LEADERBOARD_CRITERIA = [
    {
        id: 'prestige',
        icon: '🐽',
        title: 'Престижи',
        header: 'По числу престижей',
        col: 'Престижи',
        fmt: (v) => `${v} 🐽`,
        desc: 'Продажи фермы на пике славы'
    },
    {
        id: 'totalCoins',
        icon: '🪙',
        title: 'Всего монет',
        header: 'По заработанным деньгам (all-time)',
        col: 'Всего монет',
        fmt: (v) => `${U.fmt(v)} 🪙`,
        desc: 'Суммарный доход за историю хозяйства'
    },
    {
        id: 'coins',
        icon: '💰',
        title: 'Баланс монет',
        header: 'По текущему числу монет',
        col: 'В кошельке',
        fmt: (v) => `${U.fmt(v)} 🪙`,
        desc: 'Накопленные монеты прямо сейчас'
    },
    {
        id: 'bestDay',
        icon: '📅',
        title: 'Макс. день',
        header: 'По максимальному пройденному дню',
        col: 'Рекорд дня',
        fmt: (v) => `День ${v}`,
        desc: 'Наивысший достигнутый день'
    },
    {
        id: 'totalPigs',
        icon: '🐷',
        title: 'Всего свиней',
        header: 'По общему числу пойманных свиней',
        col: 'Поймано',
        fmt: (v) => `${U.fmt(v)} 🐷`,
        desc: 'Суммарно загнанных в хлев свиней'
    },
    {
        id: 'bestCombo',
        icon: '🔥',
        title: 'Лучшее комбо',
        header: 'По лучшему комбо',
        col: 'Комбо',
        fmt: (v) => `x${v}`,
        desc: 'Максимальная череда поимок подряд'
    },
    {
        id: 'perfectDays',
        icon: '⭐',
        title: 'Дни на 3★',
        header: 'По дням на 3 звезды',
        col: '3★ Дней',
        fmt: (v) => `${v} ⭐`,
        desc: 'Дней с безупречным уловом всех свиней'
    }
];

const LEADERBOARD_HATS = {
    straw: { name: 'Соломенная', icon: '🌾' },
    cap: { name: 'Кепка', icon: '🧢' },
    cowboy: { name: 'Ковбойская', icon: '🤠' },
    chef: { name: 'Колпак повара', icon: '👨‍🍳' },
    viking: { name: 'Шлем викинга', icon: '🪓' },
    pig: { name: 'Свиные ушки', icon: '🐽' },
    crown: { name: 'Корона', icon: '👑' }
};

const RIVALS_BASE = [
    {
        id: 'mitya', name: 'Дед Митяй', farm: 'Хутор «Старый хряк»', hat: 'straw', avatar: '👴',
        title: 'Сельский ветеран',
        base: { prestige: 2, totalCoins: 3800, coins: 420, bestDay: 19, totalPigs: 280, bestCombo: 9, perfectDays: 8 },
        growth: { prestige: 0.8, totalCoins: 0.85, coins: 0.5, bestDay: 0.6, totalPigs: 0.8, bestCombo: 0.2, perfectDays: 0.5 }
    },
    {
        id: 'glasha', name: 'Фермерша Глаша', farm: 'Усадьба «Розовая хрюшка»', hat: 'cap', avatar: '👩‍🌾',
        title: 'Перфекционистка',
        base: { prestige: 1, totalCoins: 2900, coins: 310, bestDay: 15, totalPigs: 210, bestCombo: 11, perfectDays: 10 },
        growth: { prestige: 0.6, totalCoins: 0.75, coins: 0.6, bestDay: 0.7, totalPigs: 0.7, bestCombo: 0.3, perfectDays: 0.7 }
    },
    {
        id: 'vasya', name: 'Дядя Вася с мельницы', farm: 'Мельничный хутор', hat: 'chef', avatar: '👨‍🍳',
        title: 'Купец-мельник',
        base: { prestige: 1, totalCoins: 4200, coins: 850, bestDay: 12, totalPigs: 160, bestCombo: 7, perfectDays: 5 },
        growth: { prestige: 0.5, totalCoins: 1.1, coins: 0.9, bestDay: 0.4, totalPigs: 0.5, bestCombo: 0.1, perfectDays: 0.4 }
    },
    {
        id: 'bob', name: 'Ковбой Боб', farm: 'Ранчо «Золотое копытце»', hat: 'cowboy', avatar: '🤠',
        title: 'Гроза прерий',
        base: { prestige: 1, totalCoins: 2400, coins: 260, bestDay: 14, totalPigs: 190, bestCombo: 16, perfectDays: 6 },
        growth: { prestige: 0.7, totalCoins: 0.7, coins: 0.4, bestDay: 0.5, totalPigs: 0.7, bestCombo: 0.4, perfectDays: 0.5 }
    },
    {
        id: 'dusya', name: 'Баба Дуся', farm: 'Хутор «Пятачок и К°»', hat: 'straw', avatar: '👵',
        title: 'Добрая бабушка',
        base: { prestige: 0, totalCoins: 750, coins: 80, bestDay: 7, totalPigs: 130, bestCombo: 5, perfectDays: 3 },
        growth: { prestige: 0.3, totalCoins: 0.4, coins: 0.2, bestDay: 0.3, totalPigs: 0.5, bestCombo: 0.1, perfectDays: 0.3 }
    },
    {
        id: 'fedot', name: 'Хитрый Федот', farm: 'Заимка «У дуба»', hat: 'cap', avatar: '🧔',
        title: 'Сельский ростовщик',
        base: { prestige: 0, totalCoins: 1100, coins: 390, bestDay: 8, totalPigs: 85, bestCombo: 6, perfectDays: 2 },
        growth: { prestige: 0.3, totalCoins: 0.5, coins: 0.7, bestDay: 0.35, totalPigs: 0.4, bestCombo: 0.15, perfectDays: 0.25 }
    },
    {
        id: 'semen', name: 'Свинопас Семён', farm: 'Загон «Быстрый шницель»', hat: 'straw', avatar: '🧑‍🌾',
        title: 'Шустрый пастух',
        base: { prestige: 0, totalCoins: 480, coins: 50, bestDay: 5, totalPigs: 95, bestCombo: 8, perfectDays: 1 },
        growth: { prestige: 0.2, totalCoins: 0.35, coins: 0.15, bestDay: 0.25, totalPigs: 0.45, bestCombo: 0.25, perfectDays: 0.2 }
    },
    {
        id: 'lukich', name: 'Пасечник Лукич', farm: 'Пасека «Сладкая поляна»', hat: 'straw', avatar: '🧔‍♂️',
        title: 'Миролюбивый сосед',
        base: { prestige: 0, totalCoins: 1350, coins: 180, bestDay: 10, totalPigs: 140, bestCombo: 7, perfectDays: 4 },
        growth: { prestige: 0.4, totalCoins: 0.5, coins: 0.3, bestDay: 0.4, totalPigs: 0.5, bestCombo: 0.15, perfectDays: 0.35 }
    },
    {
        id: 'stepan', name: 'Агроном Степан', farm: 'Агрокомплекс «Заря»', hat: 'cap', avatar: '👨‍🌾',
        title: 'Ударник труда',
        base: { prestige: 1, totalCoins: 2600, coins: 290, bestDay: 18, totalPigs: 220, bestCombo: 8, perfectDays: 8 },
        growth: { prestige: 0.6, totalCoins: 0.65, coins: 0.4, bestDay: 0.65, totalPigs: 0.65, bestCombo: 0.2, perfectDays: 0.6 }
    },
    {
        id: 'olaf', name: 'Викинг Олаф', farm: 'Фьорд «Дикий вепрь»', hat: 'viking', avatar: '🛡️',
        title: 'Северный богатырь',
        base: { prestige: 3, totalCoins: 6200, coins: 920, bestDay: 24, totalPigs: 390, bestCombo: 14, perfectDays: 12 },
        growth: { prestige: 1.1, totalCoins: 1.0, coins: 0.6, bestDay: 0.75, totalPigs: 0.9, bestCombo: 0.3, perfectDays: 0.6 }
    },
    {
        id: 'bella', name: 'Баронесса Белла', farm: 'Поместье «Трюфель-Холл»', hat: 'crown', avatar: '👸',
        title: 'Свиноводческая элита',
        base: { prestige: 4, totalCoins: 9800, coins: 1600, bestDay: 30, totalPigs: 520, bestCombo: 15, perfectDays: 20 },
        growth: { prestige: 1.3, totalCoins: 1.3, coins: 0.8, bestDay: 0.8, totalPigs: 1.0, bestCombo: 0.25, perfectDays: 0.8 }
    },
    {
        id: 'lee', name: 'Ниндзя Ли', farm: 'Скрытый загон «Тень»', hat: 'pig', avatar: '🥷',
        title: 'Мастер маскировки',
        base: { prestige: 1, totalCoins: 2100, coins: 210, bestDay: 13, totalPigs: 180, bestCombo: 20, perfectDays: 7 },
        growth: { prestige: 0.6, totalCoins: 0.6, coins: 0.3, bestDay: 0.45, totalPigs: 0.6, bestCombo: 0.45, perfectDays: 0.4 }
    }
];

/**
 * Интерфейс поверх холста: HUD, титул, итоги дня, магазин, пауза, топ игроков, тач-управление.
 */
class UI {
    constructor(game) {
        this.game = game;
        const $ = (id) => document.getElementById(id);
        this.el = {
            hud: $('hud'), day: $('hud-day'), icons: $('hud-icons'), caught: $('hud-caught'),
            timer: $('hud-timer'), fill: $('timer-fill'), secs: $('timer-secs'),
            coinChip: $('chip-coins'), coins: $('hud-coins'),
            btnShop: $('btn-shop'), btnPause: $('btn-pause'), btnLeaderboard: $('btn-leaderboard'),
            toasts: $('toasts'), banner: $('banner'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
            title: $('title-screen'), titlePlay: $('title-play'), titleShop: $('title-shop'),
            titleLeaderboard: $('title-leaderboard'), titleMode: $('title-mode'),
            titleModeText: $('title-mode-text'), titleModeIcon: $('title-mode-icon'),
            titleStats: $('title-stats'), helpSolo: $('help-solo'), helpCoop: $('help-coop'),
            result: $('result'), resTitle: $('res-title'), resStars: $('res-stars'), resCaught: $('res-caught'),
            resLines: $('res-lines'), resQuest: $('res-quest'), resEarned: $('res-earned'), resCombo: $('res-combo'),
            resPrestige: $('res-prestige'), resNext: $('res-next'), resShop: $('res-shop'),
            shop: $('shop-modal'), shopClose: $('shop-close'),
            pause: $('pause-modal'), pauseResume: $('pause-resume'), pauseSound: $('pause-sound'),
            pauseMusic: $('pause-music'), pauseReset: $('pause-reset'),
            pauseLeaderboard: $('pause-leaderboard'), pauseMode: $('pause-mode'),
            pauseHelpSolo: $('pause-help-solo'), pauseHelpCoop: $('pause-help-coop'),
            touch: $('touch-ui'), joyZone: $('joy-zone'), joyBase: $('joy-base'), joyStick: $('joy-stick'),
            btnSwing: $('btn-swing'), btnDash: $('btn-dash'),
            // Co-op элементы
            coopBar: $('hud-coop-bar'),
            hudP1Caught: $('hud-p1-caught'), hudP1Coins: $('hud-p1-coins'), hudP1Dash: $('hud-p1-dash'),
            hudP2Caught: $('hud-p2-caught'), hudP2Coins: $('hud-p2-coins'), hudP2Dash: $('hud-p2-dash'),
            coopComboBadge: $('coop-combo-badge'), hudCoopComboText: $('hud-coop-combo-text'),
            // Лидерборд
            leaderboard: $('leaderboard-modal'), lbClose: $('lb-close'),
            lbSummaryRank: $('lb-summary-rank'), lbCriteriaTabs: $('lb-criteria-tabs'),
            lbPlayerCard: $('lb-player-card'), lbTableBody: $('lb-table-body'),
            lbScoreColHeader: $('lb-score-col-header'),
            // Онлайн мультиплеер (P2P)
            onlineModal: $('online-modal'), onlineClose: $('online-close'),
            titleOnline: $('title-online'), pauseOnline: $('pause-online'),
            tabHost: $('tab-host'), tabJoin: $('tab-join'),
            contentHost: $('content-host'), contentJoin: $('content-join'),
            hostCodeDisplay: $('host-code-display'), btnCopyCode: $('btn-copy-code'), btnCopyLink: $('btn-copy-link'),
            btnStartHost: $('btn-start-host'), hostStatusBox: $('host-status-box'),
            hostStatusText: $('host-status-text'), hostSpinner: $('host-spinner'),
            joinCodeInput: $('join-code-input'), btnJoinRoom: $('btn-join-room'),
            joinStatusBox: $('join-status-box'), joinStatusText: $('join-status-text'),
            hudOnlineChip: $('hud-online-chip'), hudOnlineRole: $('hud-online-role'),
            hudOnlineCode: $('hud-online-code')
        };

        this.shop = new Shop(game, this);
        this.lbCriteria = 'prestige';
        this.onlineTab = 'host';
        this.currentRoomCode = '';
        this._hc = {};                 // кэш HUD
        this._coinRect = null;
        this._pausedByUi = false;
        this._resultFailed = false;
        this._resultShownAt = 0;
        this._timers = [];
        this._toastCount = 0;

        this._bindButtons();
        this._bindKeys();
        this._bindTouch();
        this._checkUrlJoinParam();
        window.addEventListener('resize', () => { this._coinRect = null; });
        window.addEventListener('orientationchange', () => { this._coinRect = null; });
    }

    /* ============================================================
     *  Состояние окон
     * ============================================================ */
    _vis(el) { return el && !el.classList.contains('hidden'); }

    get modalOpen() {
        return this._vis(this.el.title) || this._vis(this.el.result) || this.shop.isOpen || this._vis(this.el.pause) || this.isLeaderboardOpen || this.isOnlineOpen;
    }

    _syncPause() {
        const need = this.shop.isOpen || this._vis(this.el.pause) || this.isLeaderboardOpen || this.isOnlineOpen;
        if (need === this._pausedByUi) return;
        this._pausedByUi = need;
        if (need) this._resetTouchInput();
        this.game.setPaused(need);
    }

    /* ============================================================
     *  Кнопки и общие обработчики
     * ============================================================ */
    _bindButtons() {
        const e = this.el;
        const sfx = () => this.game.sfx;
        const initAudio = () => { try { sfx().init(); } catch (err) { /* звук необязателен */ } };
        ['pointerdown', 'touchend', 'keydown'].forEach((t) => document.addEventListener(t, initAudio, true));

        // Звук клика на любой кнопке, кроме помеченных data-silent
        document.addEventListener('click', (ev) => {
            const b = ev.target.closest('button');
            if (b && !b.disabled && !b.hasAttribute('data-silent')) { try { sfx().click(); } catch (err) { /* ignore */ } }
        });

        e.titlePlay.addEventListener('click', () => this.game.startGame());
        e.titleShop.addEventListener('click', () => this.openShop());
        e.btnShop.addEventListener('click', () => this.openShop());
        e.btnPause.addEventListener('click', () => this.openPause());
        e.shopClose.addEventListener('click', () => this.closeShop());
        e.resShop.addEventListener('click', () => this.openShop());
        e.resNext.addEventListener('click', () => this._resultMain());
        e.pauseResume.addEventListener('click', () => this.closePause());
        e.pauseSound.addEventListener('click', () => { this.game.toggleMute(); this._syncToggles(); });
        e.pauseMusic.addEventListener('click', () => { this.game.toggleMusic(); this._syncToggles(); });
        e.pauseReset.addEventListener('click', () => {
            if (window.confirm('Сбросить весь прогресс? Это действие нельзя отменить.')) {
                this.closePause();
                this.game.resetProgress();
            }
        });

        // Лидерборд кнопки
        if (e.btnLeaderboard) e.btnLeaderboard.addEventListener('click', () => this.openLeaderboard());
        if (e.titleLeaderboard) e.titleLeaderboard.addEventListener('click', () => this.openLeaderboard());
        if (e.pauseLeaderboard) e.pauseLeaderboard.addEventListener('click', () => this.openLeaderboard());
        if (e.lbClose) e.lbClose.addEventListener('click', () => this.closeLeaderboard());

        // Вкладки критериев топа игроков
        if (e.lbCriteriaTabs) {
            e.lbCriteriaTabs.addEventListener('click', (ev) => {
                const b = ev.target.closest('[data-criteria]');
                if (b && b.dataset.criteria) this.setLeaderboardCriteria(b.dataset.criteria);
            });
        }

        // Переключение режима игры (1 Игрок / 2 Игрока Кооп)
        if (e.titleMode) e.titleMode.addEventListener('click', () => this.toggleGameMode());
        if (e.pauseMode) e.pauseMode.addEventListener('click', () => this.toggleGameMode());

        // Онлайн мультиплеер кнопки
        if (e.titleOnline) e.titleOnline.addEventListener('click', () => this.openOnlineModal('host'));
        if (e.pauseOnline) e.pauseOnline.addEventListener('click', () => this.openOnlineModal('host'));
        if (e.onlineClose) e.onlineClose.addEventListener('click', () => this.closeOnlineModal());
        if (e.tabHost) e.tabHost.addEventListener('click', () => this.setOnlineTab('host'));
        if (e.tabJoin) e.tabJoin.addEventListener('click', () => this.setOnlineTab('join'));
        if (e.btnCopyCode) e.btnCopyCode.addEventListener('click', () => this.copyRoomCode());
        if (e.btnCopyLink) e.btnCopyLink.addEventListener('click', () => this.copyRoomLink());
        if (e.btnStartHost) e.btnStartHost.addEventListener('click', () => this._onHostClicked());
        if (e.btnJoinRoom) e.btnJoinRoom.addEventListener('click', () => this._onJoinClicked());
        if (e.joinCodeInput) {
            e.joinCodeInput.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') this._onJoinClicked();
            });
            e.joinCodeInput.addEventListener('input', () => {
                e.joinCodeInput.value = e.joinCodeInput.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
            });
        }

        // Клик по затемнению закрывает магазин / паузу / лидерборд / онлайн
        e.shop.addEventListener('click', (ev) => { if (ev.target === e.shop) this.closeShop(); });
        e.pause.addEventListener('click', (ev) => { if (ev.target === e.pause) this.closePause(); });
        if (e.leaderboard) {
            e.leaderboard.addEventListener('click', (ev) => { if (ev.target === e.leaderboard) this.closeLeaderboard(); });
        }
        if (e.onlineModal) {
            e.onlineModal.addEventListener('click', (ev) => { if (ev.target === e.onlineModal) this.closeOnlineModal(); });
        }
    }

    _bindKeys() {
        window.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape') {
                if (this.isOnlineOpen) { this.closeOnlineModal(); ev.preventDefault(); }
                else if (this.isLeaderboardOpen) { this.closeLeaderboard(); ev.preventDefault(); }
                else if (this.shop.isOpen) { this.closeShop(); ev.preventDefault(); }
                else if (this._vis(this.el.pause)) { this.closePause(); ev.preventDefault(); }
                return;
            }
            // Окно итогов: Enter / Пробел жмёт главную кнопку (но не пока открыт магазин / пауза / лидерборд / онлайн)
            if ((ev.key === 'Enter' || ev.code === 'Space') && this._vis(this.el.result) && !this.shop.isOpen && !this._vis(this.el.pause) && !this.isLeaderboardOpen && !this.isOnlineOpen) {
                ev.preventDefault();
                ev.stopPropagation();
                if (!ev.repeat && performance.now() - this._resultShownAt > 700) this._resultMain();
            }
        }, true);
    }

    /* ============================================================
     *  Титул
     * ============================================================ */
    showTitle() {
        const s = this.game.save, st = s.stats;
        this.el.titlePlay.textContent = s.day > 1 ? `▶ Продолжить · День ${s.day}` : '▶ Играть';
        const pills = [`🏆 Рекорд дня: ${st.bestDay || 1}`, `🐷 Всего свиней: ${U.fmt(st.totalPigs || 0)}`];
        if (s.prestige > 0) pills.push(`🐽 Престиж: ${s.prestige}`);
        this.el.titleStats.innerHTML = pills.map((p) => `<span class="pill">${p}</span>`).join('');
        this._syncModeUI();
        this.el.title.classList.remove('hidden');
        // перезапуск анимации появления
        const box = this.el.title.firstElementChild;
        box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
    }

    hideTitle() { this.el.title.classList.add('hidden'); }

    /* ============================================================
     *  HUD
     * ============================================================ */
    setHud(visible) {
        this.el.hud.classList.toggle('hidden', !visible);
        this.el.touch.classList.toggle('hidden', !visible);
        if (this.el.coopBar) {
            const isCoop = (this.game.mode === 'coop');
            this.el.coopBar.classList.toggle('hidden', !visible || !isCoop);
        }
        if (!visible) this._resetTouchInput();
        this._coinRect = null;
    }

    updateHud(d) {
        const c = this._hc, e = this.el;
        if (c.day !== d.day) { c.day = d.day; e.day.textContent = d.day; }
        const icons = (d.seasonIcon || '') + (d.eventIcon ? ' ' + d.eventIcon : '');
        if (c.icons !== icons) { c.icons = icons; e.icons.textContent = icons; }
        const caught = d.caught + '/' + d.total;
        if (c.caught !== caught) { c.caught = caught; e.caught.textContent = caught; }
        const coins = Math.floor(d.coins);
        if (c.coins !== coins) {
            c.coins = coins; e.coins.textContent = U.fmt(coins);
            this._coinRect = null;
        }

        const total = Math.max(1, d.timeTotal);
        const frac = U.clamp(d.timeLeft / total, 0, 1);
        const pct = Math.round(frac * 200) / 2;
        if (c.pct !== pct) {
            c.pct = pct;
            e.fill.style.width = pct + '%';
            // зелёный (110°) -> жёлтый (48°) -> красный (4°)
            const hue = frac > 0.5 ? U.lerp(48, 110, (frac - 0.5) * 2) : U.lerp(4, 48, frac * 2);
            e.fill.style.backgroundColor = `hsl(${Math.round(hue)}, 72%, 50%)`;
        }
        const secs = Math.max(0, Math.ceil(d.timeLeft));
        if (c.secs !== secs) { c.secs = secs; e.secs.textContent = secs; }
        const urgent = d.timeLeft > 0 && d.timeLeft <= 10;
        if (c.urgent !== urgent) { c.urgent = urgent; e.timer.classList.toggle('urgent', urgent); }

        // Co-op HUD обновление
        const isCoop = this.game.mode === 'coop';
        if (e.coopBar) {
            const showCoop = isCoop && this._vis(e.hud);
            e.coopBar.classList.toggle('hidden', !showCoop);
            if (showCoop) {
                const p1 = this.game.player;
                const p2 = this.game.player2;

                const p1Caught = d.p1Caught ?? (p1?.dayCaught ?? (p1?.caught ?? (this.game.p1Caught ?? d.caught)));
                const p2Caught = d.p2Caught ?? (p2?.dayCaught ?? (p2?.caught ?? (this.game.p2Caught ?? 0)));
                const p1Coins = d.p1Coins ?? (p1?.dayCoins ?? (this.game.p1Coins ?? Math.round(this.game.shownCoins || d.coins || 0)));
                const p2Coins = d.p2Coins ?? (p2?.dayCoins ?? (this.game.p2Coins ?? 0));

                if (e.hudP1Caught) e.hudP1Caught.textContent = p1Caught;
                if (e.hudP2Caught) e.hudP2Caught.textContent = p2Caught;
                if (e.hudP1Coins) e.hudP1Coins.textContent = U.fmt(p1Coins);
                if (e.hudP2Coins) e.hudP2Coins.textContent = U.fmt(p2Coins);

                const p1DashReady = p1 ? (p1.dashCdT <= 0.05 && p1.stun <= 0) : true;
                const p2DashReady = p2 ? (p2.dashCdT <= 0.05 && p2.stun <= 0) : true;

                if (e.hudP1Dash) {
                    e.hudP1Dash.classList.toggle('ready', p1DashReady);
                    e.hudP1Dash.classList.toggle('cd', !p1DashReady);
                }
                if (e.hudP2Dash) {
                    e.hudP2Dash.classList.toggle('ready', p2DashReady);
                    e.hudP2Dash.classList.toggle('cd', !p2DashReady);
                }

                const coopCombo = d.coopCombo ?? (this.game.coopCombo ?? 0);
                if (e.coopComboBadge) {
                    const hasCombo = coopCombo > 1;
                    e.coopComboBadge.classList.toggle('hidden', !hasCombo);
                    if (hasCombo && e.hudCoopComboText) {
                        e.hudCoopComboText.textContent = `КООП x${coopCombo}`;
                    }
                }
            }
        }
    }

    coinTarget() {
        if (!this._coinRect) {
            const r = this.el.coinChip.getBoundingClientRect();
            // pop-анимация меняет масштаб — берём центр, он не смещается
            this._coinRect = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }
        return { x: this._coinRect.x, y: this._coinRect.y };
    }

    bumpCoins() {
        const chip = this.el.coinChip;
        chip.classList.remove('pop'); void chip.offsetWidth; chip.classList.add('pop');
    }

    /* ============================================================
     *  Баннер и тосты
     * ============================================================ */
    banner(title, sub = '', ms = 1800) {
        const e = this.el;
        e.bannerTitle.textContent = title;
        e.bannerSub.textContent = sub;
        e.banner.classList.remove('show');
        void e.banner.offsetWidth;
        e.banner.style.animationDuration = ms + 'ms';
        e.banner.classList.add('show');
    }

    toast(icon, title, text = '', ms = 3200) {
        const t = document.createElement('div');
        t.className = 'toast';
        const ico = document.createElement('div'); ico.className = 'toast-ico'; ico.textContent = icon;
        const box = document.createElement('div');
        const ti = document.createElement('div'); ti.className = 'toast-title'; ti.textContent = title;
        box.appendChild(ti);
        if (text) { const tx = document.createElement('div'); tx.className = 'toast-text'; tx.textContent = text; box.appendChild(tx); }
        t.append(ico, box);
        const host = this.el.toasts;
        host.appendChild(t);
        while (host.children.length > 4) host.firstElementChild.remove();
        setTimeout(() => {
            t.classList.add('out');
            setTimeout(() => t.remove(), 360);
        }, ms);
    }

    /* ============================================================
     *  Итоги дня
     * ============================================================ */
    showResult(r) {
        const e = this.el;
        this._clearTimers();
        this._resultFailed = !!r.failed;
        e.resTitle.textContent = r.failed ? '😵 Свиньи разбежались…' : `🎉 День ${r.day} пройден!`;
        e.resCaught.textContent = `🐷 Поймано ${r.caught}/${r.total}`;

        e.resLines.innerHTML = '';
        (r.lines || []).forEach((l, i) => {
            const row = document.createElement('div');
            row.className = 'res-line';
            row.style.animationDelay = (0.3 + i * 0.07) + 's';
            const a = document.createElement('span'); a.textContent = l.label;
            const b = document.createElement('b'); b.textContent = l.value;
            row.append(a, b);
            e.resLines.appendChild(row);
        });

        if (r.quest) {
            e.resQuest.classList.remove('hidden');
            e.resQuest.className = 'res-quest ' + (r.quest.done ? 'done' : 'fail');
            e.resQuest.textContent = r.quest.done
                ? `✅ ${r.quest.text} · +${U.fmt(r.quest.reward)} 🪙`
                : `❌ ${r.quest.text}`;
        } else {
            e.resQuest.className = 'res-quest hidden';
        }

        e.resEarned.textContent = `Итого +${U.fmt(r.earned)} 🪙`;
        e.resCombo.textContent = r.bestCombo > 1 ? `🔥 Лучшее комбо: x${r.bestCombo}` : '';
        e.resCombo.classList.toggle('hidden', !(r.bestCombo > 1));
        e.resPrestige.classList.toggle('hidden', !r.canPrestige);
        e.resNext.textContent = r.failed ? '🔁 Ещё раз' : 'Следующий день ➜';

        // звёзды
        const stars = e.resStars.querySelectorAll('.star');
        stars.forEach((s) => s.classList.remove('on'));
        const n = U.clamp(r.stars | 0, 0, 3);
        for (let i = 0; i < n; i++) {
            this._timers.push(setTimeout(() => {
                if (!this._vis(e.result)) return;
                stars[i].classList.add('on');
                try { this.game.sfx.star(i); } catch (err) { /* ignore */ }
            }, 500 + i * 450));
        }

        e.result.classList.remove('hidden');
        const panel = e.result.firstElementChild;
        panel.scrollTop = 0;
        panel.style.animation = 'none'; void panel.offsetWidth; panel.style.animation = '';
        this._resultShownAt = performance.now();
        this._resetTouchInput();
    }

    hideResult() {
        this._clearTimers();
        this.el.result.classList.add('hidden');
    }

    _clearTimers() {
        this._timers.forEach(clearTimeout);
        this._timers = [];
    }

    _resultMain() {
        const failed = this._resultFailed;
        this.hideResult();
        if (failed) this.game.retryDay(); else this.game.nextDay();
    }

    /* ============================================================
     *  Магазин и пауза
     * ============================================================ */
    openShop(tab = 'upgrades') {
        this.shop.open(tab);
        this._syncPause();
    }

    closeShop() {
        this.shop.close();
        this._syncPause();
    }

    refreshShop() { this.shop.refresh(); }

    openPause() {
        this._syncToggles();
        this._syncModeUI();
        this.el.pause.classList.remove('hidden');
        this._syncPause();
    }

    closePause() {
        this.el.pause.classList.add('hidden');
        this._syncPause();
    }

    _syncToggles() {
        const s = this.game.save.settings;
        const set = (btn, on, label) => {
            btn.textContent = `${label}: ${on ? 'вкл' : 'выкл'}`;
            btn.classList.toggle('is-on', on);
            btn.classList.toggle('is-off', !on);
        };
        set(this.el.pauseSound, !s.muted, '🔊 Звук');
        set(this.el.pauseMusic, s.music !== false, '🎵 Музыка');
    }

    /* ============================================================
     *  Топ игроков (Лидерборд)
     * ============================================================ */
    get isLeaderboardOpen() {
        return this.el.leaderboard && this._vis(this.el.leaderboard);
    }

    openLeaderboard(criteriaId) {
        if (criteriaId) this.lbCriteria = criteriaId;
        if (this.el.leaderboard) {
            this.el.leaderboard.classList.remove('hidden');
            this.renderLeaderboard();
        }
        this._syncPause();
    }

    closeLeaderboard() {
        if (this.el.leaderboard) {
            this.el.leaderboard.classList.add('hidden');
        }
        this._syncPause();
    }

    setLeaderboardCriteria(criteriaId) {
        if (this.lbCriteria === criteriaId) return;
        this.lbCriteria = criteriaId;
        this.renderLeaderboard();
    }

    _getLeaderboardEntries() {
        const s = this.game.save || {};
        const st = s.stats || {};
        const playerPrestige = Math.max(0, s.prestige || 0);
        const playerDay = Math.max(1, s.day || 1);
        const playerBestDay = Math.max(playerDay, st.bestDay || 1);
        const playerTotalCoins = Math.max(0, st.totalCoins || 0);
        const playerCoins = Math.max(0, Math.round(this.game.shownCoins ?? s.coins ?? 0));
        const playerTotalPigs = Math.max(0, st.totalPigs || 0);
        const playerBestCombo = Math.max(0, st.bestCombo || 0);
        const playerPerfectDays = Math.max(0, st.perfectDays || 0);

        const playerHatId = s.hat || 'straw';
        const playerHatDef = LEADERBOARD_HATS[playerHatId] || { name: 'Соломенная', icon: '🌾' };

        const playerEntry = {
            id: 'player',
            isPlayer: true,
            name: 'Фермер',
            farm: 'Родная завалинка',
            title: 'Главный герой',
            hat: playerHatId,
            hatName: playerHatDef.name,
            hatIcon: playerHatDef.icon,
            avatar: '🧑‍🌾',
            stats: {
                prestige: playerPrestige,
                totalCoins: playerTotalCoins,
                coins: playerCoins,
                bestDay: playerBestDay,
                totalPigs: playerTotalPigs,
                bestCombo: playerBestCombo,
                perfectDays: playerPerfectDays
            }
        };

        const rivals = RIVALS_BASE.map((r) => {
            const hatDef = LEADERBOARD_HATS[r.hat] || { name: 'Соломенная', icon: '🌾' };
            return {
                id: r.id,
                isPlayer: false,
                name: r.name,
                farm: r.farm,
                title: r.title,
                hat: r.hat,
                hatName: hatDef.name,
                hatIcon: hatDef.icon,
                avatar: r.avatar,
                stats: {
                    prestige: Math.round(r.base.prestige + playerPrestige * r.growth.prestige),
                    totalCoins: Math.round(r.base.totalCoins + playerTotalCoins * r.growth.totalCoins),
                    coins: Math.round(r.base.coins + playerCoins * r.growth.coins),
                    bestDay: Math.round(r.base.bestDay + Math.max(0, playerBestDay - 5) * r.growth.bestDay),
                    totalPigs: Math.round(r.base.totalPigs + playerTotalPigs * r.growth.totalPigs),
                    bestCombo: Math.round(Math.max(r.base.bestCombo, Math.round(playerBestCombo * (0.8 + r.growth.bestCombo * 0.4)))),
                    perfectDays: Math.round(r.base.perfectDays + playerPerfectDays * r.growth.perfectDays)
                }
            };
        });

        return [playerEntry, ...rivals];
    }

    renderLeaderboard() {
        if (!this.el.leaderboard) return;
        const curCrit = LEADERBOARD_CRITERIA.find((c) => c.id === this.lbCriteria) || LEADERBOARD_CRITERIA[0];

        // 1. Селектор критериев (Pills / Tabs)
        if (this.el.lbCriteriaTabs) {
            this.el.lbCriteriaTabs.innerHTML = LEADERBOARD_CRITERIA.map((c) => {
                const active = c.id === curCrit.id ? ' active' : '';
                return `<button class="lb-tab${active}" data-criteria="${c.id}" type="button" role="tab" aria-selected="${c.id === curCrit.id}" title="${c.desc}">
                    <span class="lb-tab-ico">${c.icon}</span>
                    <span class="lb-tab-text">${c.title}</span>
                </button>`;
            }).join('');
        }

        // 2. Сортировка участников
        const entries = this._getLeaderboardEntries();
        entries.sort((a, b) => {
            const diff = (b.stats[curCrit.id] || 0) - (a.stats[curCrit.id] || 0);
            if (diff !== 0) return diff;
            return (b.stats.totalCoins || 0) - (a.stats.totalCoins || 0);
        });

        const playerRank = entries.findIndex((e) => e.isPlayer) + 1;
        const playerEntry = entries.find((e) => e.isPlayer);

        // 3. Плашка в шапке
        if (this.el.lbSummaryRank) {
            let medal = '';
            if (playerRank === 1) medal = '🥇 ';
            else if (playerRank === 2) medal = '🥈 ';
            else if (playerRank === 3) medal = '🥉 ';
            this.el.lbSummaryRank.textContent = `${medal}Место: #${playerRank} из ${entries.length}`;
        }

        // 4. Профиль игрока (Моя карточка)
        if (this.el.lbPlayerCard && playerEntry) {
            const valFmt = curCrit.fmt(playerEntry.stats[curCrit.id] || 0);
            let rankClass = 'rank-other';
            let rankBadge = `#${playerRank}`;
            if (playerRank === 1) { rankClass = 'rank-gold'; rankBadge = '🥇 1'; }
            else if (playerRank === 2) { rankClass = 'rank-silver'; rankBadge = '🥈 2'; }
            else if (playerRank === 3) { rankClass = 'rank-bronze'; rankBadge = '🥉 3'; }

            this.el.lbPlayerCard.innerHTML = `
                <div class="lb-my-avatar-col">
                    <div class="lb-avatar-frame player">
                        <span class="lb-avatar-char">${playerEntry.avatar}</span>
                        <span class="lb-avatar-hat-badge" title="Шляпа: ${playerEntry.hatName}">${playerEntry.hatIcon}</span>
                    </div>
                </div>
                <div class="lb-my-info-col">
                    <div class="lb-my-header">
                        <b class="lb-my-name">${playerEntry.name}</b>
                        <span class="lb-you-tag">ЭТО ВЫ</span>
                        <span class="lb-my-farm">${playerEntry.farm}</span>
                    </div>
                    <div class="lb-my-subline">Шляпа: <b>${playerEntry.hatName} ${playerEntry.hatIcon}</b> · Хозяйство процветает</div>
                    <div class="lb-my-quick-stats">
                        <span class="lb-stat-pill" title="Престижей">🐽 ${playerEntry.stats.prestige}</span>
                        <span class="lb-stat-pill" title="Монет">🪙 ${U.fmt(playerEntry.stats.coins)}</span>
                        <span class="lb-stat-pill" title="Поймано свиней">🐷 ${U.fmt(playerEntry.stats.totalPigs)}</span>
                        <span class="lb-stat-pill" title="Рекорд дня">📅 День ${playerEntry.stats.bestDay}</span>
                        <span class="lb-stat-pill" title="Лучшее комбо">🔥 x${playerEntry.stats.bestCombo}</span>
                    </div>
                </div>
                <div class="lb-my-rank-col">
                    <div class="lb-my-rank-badge ${rankClass}">${rankBadge}</div>
                    <div class="lb-my-metric-label">${curCrit.title}</div>
                    <div class="lb-my-metric-val">${valFmt}</div>
                </div>
            `;
        }

        // 5. Заголовок колонки
        if (this.el.lbScoreColHeader) {
            this.el.lbScoreColHeader.textContent = curCrit.col;
        }

        // 6. Таблица лидеров
        if (this.el.lbTableBody) {
            this.el.lbTableBody.innerHTML = entries.map((entry, idx) => {
                const rank = idx + 1;
                const isPlayer = !!entry.isPlayer;
                const valFmt = curCrit.fmt(entry.stats[curCrit.id] || 0);

                let rankCell = `<span class="lb-num">#${rank}</span>`;
                let rowRankClass = '';
                if (rank === 1) { rankCell = `<span class="lb-medal gold">🥇 1</span>`; rowRankClass = ' top-gold'; }
                else if (rank === 2) { rankCell = `<span class="lb-medal silver">🥈 2</span>`; rowRankClass = ' top-silver'; }
                else if (rank === 3) { rankCell = `<span class="lb-medal bronze">🥉 3</span>`; rowRankClass = ' top-bronze'; }

                const playerRowClass = isPlayer ? ' is-player' : '';

                return `
                    <tr class="lb-row${rowRankClass}${playerRowClass}">
                        <td class="col-rank">${rankCell}</td>
                        <td class="col-farmer">
                            <div class="lb-farmer-cell">
                                <div class="lb-mini-avatar ${entry.hat || 'straw'}">
                                    <span>${entry.avatar}</span>
                                    <span class="lb-mini-hat" title="${entry.hatName}">${entry.hatIcon}</span>
                                </div>
                                <div class="lb-farmer-meta">
                                    <div class="lb-farmer-name">
                                        <b>${entry.name}</b>
                                        ${isPlayer ? '<span class="lb-you-badge">ВЫ</span>' : ''}
                                    </div>
                                    <span class="lb-farmer-title">${entry.title}</span>
                                </div>
                            </div>
                        </td>
                        <td class="col-farm">
                            <span class="lb-farm-name">${entry.farm}</span>
                        </td>
                        <td class="col-score">
                            <b class="lb-score-val">${valFmt}</b>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    /* ============================================================
     *  Кооперативный режим (Co-op)
     * ============================================================ */
    toggleGameMode() {
        const cur = this.game.mode || 'solo';
        const next = cur === 'coop' ? 'solo' : 'coop';
        this.setGameMode(next);
    }

    setGameMode(mode) {
        if (typeof this.game.setMode === 'function') {
            this.game.setMode(mode);
        } else {
            this.game.mode = mode;
        }
        this._syncModeUI();
        const isCoop = (this.game.mode === 'coop');
        this.toast(
            isCoop ? '👥' : '👤',
            isCoop ? 'Кооператив: 2 Игрока' : 'Режим: 1 Игрок',
            isCoop ? 'Игрок 1: WASD + Shift · Игрок 2: Стрелки + Enter' : 'Одиночная охота на свиней'
        );
    }

    _syncModeUI() {
        const isCoop = (this.game.mode === 'coop');
        const text = isCoop ? 'Режим: 2 Игрока (Кооп)' : 'Режим: 1 Игрок';
        const icon = isCoop ? '👥' : '👤';

        if (this.el.titleModeText) this.el.titleModeText.textContent = text;
        if (this.el.titleModeIcon) this.el.titleModeIcon.textContent = icon;
        if (this.el.titleMode) {
            this.el.titleMode.classList.toggle('coop-active', isCoop);
        }
        if (this.el.pauseMode) {
            this.el.pauseMode.textContent = `${icon} ${text}`;
            this.el.pauseMode.classList.toggle('is-on', isCoop);
            this.el.pauseMode.classList.toggle('is-off', !isCoop);
        }
        if (this.el.helpSolo) this.el.helpSolo.classList.toggle('hidden', isCoop);
        if (this.el.helpCoop) this.el.helpCoop.classList.toggle('hidden', !isCoop);
        if (this.el.pauseHelpSolo) this.el.pauseHelpSolo.classList.toggle('hidden', isCoop);
        if (this.el.pauseHelpCoop) this.el.pauseHelpCoop.classList.toggle('hidden', !isCoop);

        if (this.el.coopBar) {
            this.el.coopBar.classList.toggle('hidden', !isCoop || !this._vis(this.el.hud));
        }
    }

    /* ============================================================
     *  Онлайн Мультиплеер (P2P WebRTC по коду)
     * ============================================================ */
    get isOnlineOpen() {
        return this.el.onlineModal && this._vis(this.el.onlineModal);
    }

    openOnlineModal(tab = 'host') {
        if (!this.el.onlineModal) return;
        this.setOnlineTab(tab);
        this.el.onlineModal.classList.remove('hidden');
        this._syncPause();
    }

    closeOnlineModal() {
        if (!this.el.onlineModal) return;
        this.el.onlineModal.classList.add('hidden');
        this._syncPause();
    }

    setOnlineTab(tab) {
        this.onlineTab = tab;
        const isHost = (tab === 'host');
        if (this.el.tabHost) this.el.tabHost.classList.toggle('active', isHost);
        if (this.el.tabJoin) this.el.tabJoin.classList.toggle('active', !isHost);
        if (this.el.contentHost) this.el.contentHost.classList.toggle('hidden', !isHost);
        if (this.el.contentJoin) this.el.contentJoin.classList.toggle('hidden', isHost);
        if (!isHost && this.el.joinCodeInput) {
            setTimeout(() => this.el.joinCodeInput.focus(), 100);
        }
    }

    setHostRoomCode(code) {
        this.currentRoomCode = code || '';
        if (this.el.hostCodeDisplay) {
            this.el.hostCodeDisplay.textContent = code || '------';
        }
        if (this.el.hudOnlineCode) {
            this.el.hudOnlineCode.textContent = code || '';
        }
    }

    setHostStatus(text, isConnected = false) {
        if (!this.el.hostStatusText) return;
        this.el.hostStatusText.textContent = text;
        if (this.el.hostStatusBox) {
            this.el.hostStatusBox.classList.toggle('connected', isConnected);
        }
        if (this.el.hostSpinner) {
            this.el.hostSpinner.style.display = isConnected ? 'none' : 'block';
        }
    }

    setJoinStatus(text, isConnected = false, isError = false) {
        if (!this.el.joinStatusText) return;
        this.el.joinStatusText.textContent = text;
        if (this.el.joinStatusBox) {
            this.el.joinStatusBox.classList.toggle('connected', isConnected);
            this.el.joinStatusBox.classList.toggle('error', isError);
        }
    }

    setOnlineHudStatus(visible, role = 'P1 Хост', code = '') {
        if (!this.el.hudOnlineChip) return;
        this.el.hudOnlineChip.classList.toggle('hidden', !visible);
        if (this.el.hudOnlineRole) this.el.hudOnlineRole.textContent = role;
        if (this.el.hudOnlineCode) this.el.hudOnlineCode.textContent = code;
    }

    copyRoomCode() {
        const code = this.currentRoomCode || (this.el.hostCodeDisplay ? this.el.hostCodeDisplay.textContent.trim() : '');
        if (!code || code === '------') {
            this.toast('⚠️', 'Код ещё не создан', 'Сначала нажмите «Создать комнату»');
            return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(() => {
                this.toast('📋', 'Код скопирован!', `Код ${code} скопирован в буфер`);
            }).catch(() => this._fallbackCopy(code));
        } else {
            this._fallbackCopy(code);
        }
    }

    copyRoomLink() {
        const code = this.currentRoomCode || (this.el.hostCodeDisplay ? this.el.hostCodeDisplay.textContent.trim() : '');
        if (!code || code === '------') {
            this.toast('⚠️', 'Код ещё не создан', 'Сначала нажмите «Создать комнату»');
            return;
        }
        const url = `${window.location.origin}${window.location.pathname}?join=${encodeURIComponent(code)}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => {
                this.toast('🔗', 'Ссылка скопирована!', 'Отправьте ссылку другу для быстрого входа');
            }).catch(() => this._fallbackCopy(url));
        } else {
            this._fallbackCopy(url);
        }
    }

    _fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            this.toast('✅', 'Скопировано!', text);
        } catch (e) {
            window.prompt('Скопируйте:', text);
        }
        ta.remove();
    }

    _onHostClicked() {
        if (typeof this.onHostRoom === 'function') {
            this.onHostRoom();
            return;
        }
        if (this.game.network && typeof this.game.network.hostRoom === 'function') {
            this.game.network.hostRoom();
            return;
        }
        if (typeof this.game.hostOnlineGame === 'function') {
            this.game.hostOnlineGame();
            return;
        }
        // Заглушка, пока сетевой модуль инициализируется
        const fallbackCode = 'PIG-' + Math.floor(1000 + Math.random() * 9000);
        this.setHostRoomCode(fallbackCode);
        this.setHostStatus('Ожидание подключения второго игрока (Фермерши)...');
        this.toast('🌐', 'Комната создана!', `Код комнаты: ${fallbackCode}`);
    }

    _onJoinClicked() {
        const inp = this.el.joinCodeInput;
        const code = inp ? inp.value.trim().toUpperCase() : '';
        if (!code) {
            this.setJoinStatus('Пожалуйста, введите код комнаты!', false, true);
            return;
        }
        this.setJoinStatus(`Подключение к комнате ${code}...`);
        if (typeof this.onJoinRoom === 'function') {
            this.onJoinRoom(code);
            return;
        }
        if (this.game.network && typeof this.game.network.joinRoom === 'function') {
            this.game.network.joinRoom(code);
            return;
        }
        if (typeof this.game.joinOnlineGame === 'function') {
            this.game.joinOnlineGame(code);
            return;
        }
        this.toast('🌐', 'Подключение...', `Подключаемся к ${code}`);
    }

    _checkUrlJoinParam() {
        try {
            const params = new URLSearchParams(window.location.search);
            const joinCode = params.get('join') || params.get('code');
            if (joinCode) {
                setTimeout(() => {
                    if (this.el.joinCodeInput) this.el.joinCodeInput.value = joinCode.toUpperCase();
                    this.openOnlineModal('join');
                    this.setJoinStatus(`Код ${joinCode.toUpperCase()} загружен из ссылки! Нажмите «Подключиться»`);
                }, 400);
            }
        } catch (e) { /* ignore */ }
    }

    /* ============================================================
     *  Тач-управление
     * ============================================================ */
    _input() { return this.game.input; }

    _setJoy(x, y) {
        const inp = this._input();
        if (inp) { inp.joyX = x; inp.joyY = y; }
    }

    _resetTouchInput() {
        const t = this._touch;
        if (!t) return;
        t.joyId = null; t.swingId = null; t.dashId = null;
        this.el.joyBase.classList.add('hidden');
        this.el.btnSwing.classList.remove('pressed');
        this.el.btnDash.classList.remove('pressed');
        this._setJoy(0, 0);
        const inp = this._input();
        if (inp) inp.swingHeld = false;
    }

    _bindTouch() {
        const e = this.el;
        const t = this._touch = { joyId: null, swingId: null, dashId: null, cx: 0, cy: 0 };
        const R = 56, DEAD = 0.12;

        // Контролы показываем только после первого касания
        window.addEventListener('touchstart', () => document.body.classList.add('touch'), { passive: true, once: true });

        const find = (list, id) => { for (const x of list) if (x.identifier === id) return x; return null; };

        // --- Джойстик ---
        e.joyZone.addEventListener('touchstart', (ev) => {
            ev.preventDefault();
            if (t.joyId !== null) return;
            const p = ev.changedTouches[0];
            t.joyId = p.identifier; t.cx = p.clientX; t.cy = p.clientY;
            e.joyBase.style.left = t.cx + 'px'; e.joyBase.style.top = t.cy + 'px';
            e.joyStick.style.transform = 'translate(0, 0)';
            e.joyBase.classList.remove('hidden');
            this._setJoy(0, 0);
        }, { passive: false });

        e.joyZone.addEventListener('touchmove', (ev) => {
            ev.preventDefault();
            const p = find(ev.changedTouches, t.joyId);
            if (!p) return;
            let dx = p.clientX - t.cx, dy = p.clientY - t.cy;
            const len = Math.hypot(dx, dy);
            if (len > R) { dx = dx / len * R; dy = dy / len * R; }
            e.joyStick.style.transform = `translate(${dx}px, ${dy}px)`;
            const mag = Math.min(1, len / R);
            if (mag < DEAD) { this._setJoy(0, 0); return; }
            const k = (mag - DEAD) / (1 - DEAD);   // плавный выход из мёртвой зоны
            this._setJoy(dx / Math.max(len, 0.001) * k, dy / Math.max(len, 0.001) * k);
        }, { passive: false });

        const joyEnd = (ev) => {
            ev.preventDefault();
            if (!find(ev.changedTouches, t.joyId)) return;
            t.joyId = null;
            e.joyBase.classList.add('hidden');
            this._setJoy(0, 0);
        };
        e.joyZone.addEventListener('touchend', joyEnd, { passive: false });
        e.joyZone.addEventListener('touchcancel', joyEnd, { passive: false });

        // --- Сачок (удержание) ---
        e.btnSwing.addEventListener('touchstart', (ev) => {
            ev.preventDefault();
            if (t.swingId !== null) return;
            t.swingId = ev.changedTouches[0].identifier;
            e.btnSwing.classList.add('pressed');
            const inp = this._input(); if (inp) inp.swingHeld = true;
        }, { passive: false });
        const swingEnd = (ev) => {
            ev.preventDefault();
            if (!find(ev.changedTouches, t.swingId)) return;
            t.swingId = null;
            e.btnSwing.classList.remove('pressed');
            const inp = this._input(); if (inp) inp.swingHeld = false;
        };
        e.btnSwing.addEventListener('touchend', swingEnd, { passive: false });
        e.btnSwing.addEventListener('touchcancel', swingEnd, { passive: false });

        // --- Рывок ---
        e.btnDash.addEventListener('touchstart', (ev) => {
            ev.preventDefault();
            if (t.dashId !== null) return;
            t.dashId = ev.changedTouches[0].identifier;
            e.btnDash.classList.add('pressed');
            this.game.requestDash();
        }, { passive: false });
        const dashEnd = (ev) => {
            ev.preventDefault();
            if (!find(ev.changedTouches, t.dashId)) return;
            t.dashId = null;
            e.btnDash.classList.remove('pressed');
        };
        e.btnDash.addEventListener('touchend', dashEnd, { passive: false });
        e.btnDash.addEventListener('touchcancel', dashEnd, { passive: false });
    }
}
