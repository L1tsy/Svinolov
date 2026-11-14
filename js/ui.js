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
    },
    {
        id: 'battleWins',
        icon: '⚔️',
        title: '1v1 Победы',
        header: 'По победам в битвах 1v1',
        col: 'Побед',
        fmt: (v) => `${v} ⚔️`,
        desc: 'Побед в состязаниях ловцов по сети'
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
            btnFullscreen: $('btn-fullscreen'), titleFullscreen: $('title-fullscreen'), pauseFullscreen: $('pause-fullscreen'),
            toasts: $('toasts'), banner: $('banner'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
            title: $('title-screen'), titlePlay: $('title-play'), titleShop: $('title-shop'),
            titleLeaderboard: $('title-leaderboard'), titleMode: $('title-mode'), titleModeWrap: $('title-mode-wrap'),
            titleModeDual: $('title-mode-dual'), titleModeSolo: $('title-mode-solo'), titleModeCoop: $('title-mode-coop'),
            titleModeText: $('title-mode-text'), titleModeIcon: $('title-mode-icon'),
            titleStats: $('title-stats'), helpSolo: $('help-solo'), helpCoop: $('help-coop'),
            result: $('result'), resTitle: $('res-title'), resStars: $('res-stars'), resCaught: $('res-caught'),
            resCoopCard: $('res-coop-card'), resP1Caught: $('res-p1-caught'), resP2Caught: $('res-p2-caught'),
            resP1Coins: $('res-p1-coins'), resP2Coins: $('res-p2-coins'),
            resP1Badge: $('res-p1-badge'), resP2Badge: $('res-p2-badge'), resCoopCombo: $('res-coop-combo'),
            resLines: $('res-lines'), resQuest: $('res-quest'), resEarned: $('res-earned'), resCombo: $('res-combo'),
            resPrestige: $('res-prestige'), resNext: $('res-next'), resShop: $('res-shop'), resMenuBtn: $('res-menu-btn'),
            shop: $('shop-modal'), shopClose: $('shop-close'),
            pause: $('pause-modal'), pauseResume: $('pause-resume'), pauseSound: $('pause-sound'),
            pauseMusic: $('pause-music'), pauseReset: $('pause-reset'), pauseMenuBtn: $('pause-menu-btn'),
            pauseLeaderboard: $('pause-leaderboard'), pauseMode: $('pause-mode'), pauseSwitchSolo: $('pause-switch-solo'),
            pauseHelpSolo: $('pause-help-solo'), pauseHelpCoop: $('pause-help-coop'),
            touch: $('touch-ui'), joyZone: $('joy-zone'), joyBase: $('joy-base'), joyStick: $('joy-stick'),
            btnSwing: $('btn-swing'), btnDash: $('btn-dash'),
            btnHudSoloSwitch: $('btn-hud-solo-switch'), hudCoopToSolo: $('hud-coop-to-solo'),
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
            btnModeCoop: $('btn-mode-coop'), btnModeBattle: $('btn-mode-battle'),
            contentHost: $('content-host'), contentJoin: $('content-join'),
            hostCodeDisplay: $('host-code-display'), btnCopyCode: $('btn-copy-code'), btnCopyLink: $('btn-copy-link'),
            btnStartHost: $('btn-start-host'), hostStatusBox: $('host-status-box'),
            hostStatusText: $('host-status-text'), hostSpinner: $('host-spinner'),
            joinCodeInput: $('join-code-input'), btnJoinRoom: $('btn-join-room'),
            joinStatusBox: $('join-status-box'), joinStatusText: $('join-status-text'),
            hudOnlineChip: $('hud-online-chip'), hudOnlineRole: $('hud-online-role'),
            hudOnlineCode: $('hud-online-code'),
            // 1v1 Battle HUD & Result Modal
            hudBattleBar: $('hud-battle-bar'),
            battleTimerSecs: $('battle-timer-secs'),
            battleP1Score: $('battle-p1-score'), battleP2Score: $('battle-p2-score'),
            battleP1Name: $('battle-p1-name'), battleP2Name: $('battle-p2-name'),
            battleResultModal: $('battle-result-modal'),
            battleResultIcon: $('battle-result-icon'),
            battleResultTitle: $('battle-result-title'),
            battleResultDesc: $('battle-result-desc'),
            battleResCardP1: $('battle-res-card-p1'), battleResCardP2: $('battle-res-card-p2'),
            battleResNameP1: $('battle-res-name-p1'), battleResNameP2: $('battle-res-name-p2'),
            battleResScoreP1: $('battle-res-score-p1'), battleResScoreP2: $('battle-res-score-p2'),
            battleResBadgeP1: $('battle-res-badge-p1'), battleResBadgeP2: $('battle-res-badge-p2'),
            battleRewardText: $('battle-reward-text'),
            battleStatsSummary: $('battle-stats-summary'),
            btnBattleRematch: $('btn-battle-rematch'), btnBattleExit: $('btn-battle-exit')
        };

        this.shop = new Shop(game, this);
        this.lbCriteria = 'prestige';
        this.onlineTab = 'host';
        this.selectedOnlineMode = 'coop';
        this.currentRoomCode = '';
        this._hc = {};                 // кэш HUD
        this._coinRect = null;
        this._pausedByUi = false;
        this._resultFailed = false;
        this._resultShownAt = 0;
        this._timers = [];
        this._toastCount = 0;

        if (this.isMobileDevice()) {
            document.body.classList.add('touch');
        }

        if (this.game && typeof this.game.returnToTitle !== 'function') {
            this.game.returnToTitle = () => this.returnToTitle();
        }

        this._bindButtons();
        this._bindKeys();
        this._bindTouch();
        this._checkUrlJoinParam();
        window.addEventListener('resize', () => { this._coinRect = null; });
        window.addEventListener('orientationchange', () => { this._coinRect = null; });
    }

    returnToTitle() {
        if (this.game && typeof this.game.returnToTitle === 'function' && this.game.returnToTitle !== this._boundReturnToTitle) {
            try {
                this.game.returnToTitle();
                return;
            } catch (err) {
                console.error('Error calling game.returnToTitle:', err);
            }
        }
        try { if (this.game) this.game.persist(); } catch (err) {}
        if (this.game && this.game.network && typeof this.game.network.disconnect === 'function') {
            try { this.game.network.disconnect(); } catch (err) {}
        }
        this.hideResult();
        this.hidePause();
        if (typeof this.hideBattleResult === 'function') this.hideBattleResult();
        if (this.shop && this.shop.isOpen) this.shop.close(true);
        if (this.isLeaderboardOpen) this.hideLeaderboard();
        if (this.isOnlineOpen) this.hideOnline();
        if (this.game && typeof this.game.enterTitle === 'function') {
            this.game.enterTitle();
        } else {
            this.showTitle();
        }
    }

    /* ============================================================
     *  Состояние окон и устройство
     * ============================================================ */
    _vis(el) { return el && !el.classList.contains('hidden'); }

    get modalOpen() {
        return this._vis(this.el.title) || this._vis(this.el.result) || this.shop.isOpen || this._vis(this.el.pause) || this.isLeaderboardOpen || this.isOnlineOpen || this.isBattleResultOpen;
    }

    get isBattleResultOpen() {
        return this._vis(this.el.battleResultModal);
    }

    _syncPause() {
        const need = this.shop.isOpen || this._vis(this.el.pause) || this.isLeaderboardOpen || this.isOnlineOpen || this.isBattleResultOpen;
        if (need === this._pausedByUi) return;
        this._pausedByUi = need;
        if (need) this._resetTouchInput();
        this.game.setPaused(need);
    }

    isMobileDevice() {
        return (
            ('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        );
    }

    toggleFullscreen() {
        try {
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                const el = document.documentElement;
                if (el.requestFullscreen) {
                    el.requestFullscreen().catch(() => {});
                } else if (el.webkitRequestFullscreen) {
                    el.webkitRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {});
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                }
            }
        } catch (e) {
            console.warn('[UI] Fullscreen toggle error:', e);
        }
    }

    /* ============================================================
     *  Кнопки и общие обработчики
     * ============================================================ */
    _bindButtons() {
        const e = this.el;
        const sfx = () => this.game.sfx;
        const initAudio = () => { try { sfx().init(); } catch (err) { /* звук необязателен */ } };
        ['pointerdown', 'touchend', 'keydown'].forEach((t) => document.addEventListener(t, initAudio, true));

        // Полноэкранный режим
        const toggleFs = () => this.toggleFullscreen();
        if (e.btnFullscreen) e.btnFullscreen.addEventListener('click', toggleFs);
        if (e.titleFullscreen) e.titleFullscreen.addEventListener('click', toggleFs);
        if (e.pauseFullscreen) e.pauseFullscreen.addEventListener('click', toggleFs);

        const onFsChange = () => {
            const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
            if (e.btnFullscreen) e.btnFullscreen.textContent = isFs ? '🗗' : '⛶';
            if (e.titleFullscreen) e.titleFullscreen.textContent = isFs ? '🗗' : '⛶';
            if (e.pauseFullscreen) e.pauseFullscreen.textContent = isFs ? '🗗 Оконный режим' : '⛶ Полный экран';
        };
        document.addEventListener('fullscreenchange', onFsChange);
        document.addEventListener('webkitfullscreenchange', onFsChange);

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
        if (e.resMenuBtn) e.resMenuBtn.addEventListener('click', () => this.returnToTitle());
        e.pauseResume.addEventListener('click', () => this.closePause());
        if (e.pauseMenuBtn) e.pauseMenuBtn.addEventListener('click', () => this.returnToTitle());
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
        if (e.titleModeSolo) e.titleModeSolo.addEventListener('click', () => this.setGameMode('solo'));
        if (e.titleModeCoop) e.titleModeCoop.addEventListener('click', () => this.setGameMode('coop'));
        if (e.titleMode) e.titleMode.addEventListener('click', () => this.toggleGameMode());
        if (e.pauseMode) e.pauseMode.addEventListener('click', () => this.toggleGameMode());
        if (e.pauseSwitchSolo) e.pauseSwitchSolo.addEventListener('click', () => {
            this.setGameMode('solo');
            this.closePause();
        });
        if (e.hudCoopToSolo) e.hudCoopToSolo.addEventListener('click', () => this.setGameMode('solo'));
        if (e.btnHudSoloSwitch) e.btnHudSoloSwitch.addEventListener('click', () => this.setGameMode('solo'));

        // Онлайн мультиплеер кнопки
        if (e.titleOnline) e.titleOnline.addEventListener('click', () => this.openOnlineModal('host'));
        if (e.pauseOnline) e.pauseOnline.addEventListener('click', () => this.openOnlineModal('host'));
        if (e.onlineClose) e.onlineClose.addEventListener('click', () => this.closeOnlineModal());
        if (e.tabHost) e.tabHost.addEventListener('click', () => this.setOnlineTab('host'));
        if (e.tabJoin) e.tabJoin.addEventListener('click', () => this.setOnlineTab('join'));

        // Режим онлайн игры: Кооп vs 1v1 Битва
        if (e.btnModeCoop) {
            e.btnModeCoop.addEventListener('click', () => {
                this.selectedOnlineMode = 'coop';
                e.btnModeCoop.classList.add('active');
                if (e.btnModeBattle) e.btnModeBattle.classList.remove('active');
            });
        }
        if (e.btnModeBattle) {
            e.btnModeBattle.addEventListener('click', () => {
                this.selectedOnlineMode = 'battle';
                e.btnModeBattle.classList.add('active');
                if (e.btnModeCoop) e.btnModeCoop.classList.remove('active');
            });
        }

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

        // Битва 1v1 окно итогов кнопки
        if (e.btnBattleRematch) {
            e.btnBattleRematch.addEventListener('click', () => {
                this.hideBattleResult();
                if (typeof this.onBattleRematch === 'function') {
                    this.onBattleRematch();
                } else if (this.game.network && typeof this.game.network.requestBattleRematch === 'function') {
                    this.game.network.requestBattleRematch();
                } else if (typeof this.game.restartBattle === 'function') {
                    this.game.restartBattle();
                }
            });
        }
        if (e.btnBattleExit) {
            e.btnBattleExit.addEventListener('click', () => {
                this.returnToTitle();
            });
        }

        // Клик по затемнению закрывает магазин / паузу / лидерборд / онлайн / итоги битвы
        e.shop.addEventListener('click', (ev) => { if (ev.target === e.shop) this.closeShop(); });
        e.pause.addEventListener('click', (ev) => { if (ev.target === e.pause) this.closePause(); });
        if (e.leaderboard) {
            e.leaderboard.addEventListener('click', (ev) => { if (ev.target === e.leaderboard) this.closeLeaderboard(); });
        }
        if (e.onlineModal) {
            e.onlineModal.addEventListener('click', (ev) => { if (ev.target === e.onlineModal) this.closeOnlineModal(); });
        }
        if (e.battleResultModal) {
            e.battleResultModal.addEventListener('click', (ev) => { if (ev.target === e.battleResultModal) this.hideBattleResult(); });
        }
    }

    _bindKeys() {
        window.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape') {
                if (this.isBattleResultOpen) { this.hideBattleResult(); ev.preventDefault(); }
                else if (this.isOnlineOpen) { this.closeOnlineModal(); ev.preventDefault(); }
                else if (this.isLeaderboardOpen) { this.closeLeaderboard(); ev.preventDefault(); }
                else if (this.shop.isOpen) { this.closeShop(); ev.preventDefault(); }
                else if (this._vis(this.el.pause)) { this.closePause(); ev.preventDefault(); }
                return;
            }
            // Окно итогов: Enter / Пробел жмёт главную кнопку (но не пока открыт магазин / пауза / лидерборд / онлайн / итоги битвы)
            if ((ev.key === 'Enter' || ev.code === 'Space') && this._vis(this.el.result) && !this.shop.isOpen && !this._vis(this.el.pause) && !this.isLeaderboardOpen && !this.isOnlineOpen && !this.isBattleResultOpen) {
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
        const isBattle = (this.game.mode === 'battle' || this.game.onlineMode === 'battle');
        if (this.el.coopBar) {
            const isCoop = (this.game.mode === 'coop') && !isBattle;
            this.el.coopBar.classList.toggle('hidden', !visible || !isCoop);
        }
        if (this.el.btnHudSoloSwitch) {
            const isCoop = (this.game.mode === 'coop') && !isBattle;
            this.el.btnHudSoloSwitch.classList.toggle('hidden', !visible || !isCoop);
        }
        if (this.el.hudBattleBar) {
            this.el.hudBattleBar.classList.toggle('hidden', !visible || !isBattle);
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

        // Строгая проверка истинного 2P Коопа (локального или сетевого)
        // В одиночной игре (mode === 'solo') карточка коопа ВСЕГДА строго скрыта!
        const isGameCoop = this.game && (this.game.mode === 'coop' || (this.game.isOnline && this.game.onlineMode === 'coop'));
        const isTrueCoop = (r.isCoop === true || (r.mode === 'coop' && isGameCoop)) && (!this.game || this.game.mode !== 'solo');

        if (r.failed) {
            e.resTitle.textContent = '😵 Свиньи разбежались…';
        } else if (isTrueCoop) {
            e.resTitle.textContent = `🎉 День ${r.day} пройден командой!`;
        } else {
            e.resTitle.textContent = `🎉 День ${r.day} пройден!`;
        }

        e.resCaught.textContent = `🐷 Поймано ${r.caught}/${r.total}`;

        // Совместный кооп-итог (ТОЛЬКО в настоящем 2P Коопе)
        if (e.resCoopCard) {
            if (isTrueCoop) {
                e.resCoopCard.classList.remove('hidden');
                e.resCoopCard.style.display = '';
                const p1 = Math.max(0, r.p1Caught || 0);
                const p2 = Math.max(0, r.p2Caught || 0);
                if (e.resP1Caught) e.resP1Caught.textContent = p1;
                if (e.resP2Caught) e.resP2Caught.textContent = p2;

                const totalEarned = r.earned || 0;
                let c1 = Math.round(totalEarned / 2);
                let c2 = totalEarned - c1;
                if (p1 + p2 > 0) {
                    c1 = Math.round((totalEarned * p1) / (p1 + p2));
                    c2 = totalEarned - c1;
                }
                if (e.resP1Coins) e.resP1Coins.textContent = (r.p1Coins !== undefined) ? r.p1Coins : c1;
                if (e.resP2Coins) e.resP2Coins.textContent = (r.p2Coins !== undefined) ? r.p2Coins : c2;

                if (e.resP1Badge && e.resP2Badge) {
                    if (p1 > p2) {
                        e.resP1Badge.classList.remove('hidden');
                        e.resP1Badge.textContent = '👑 MVP ДНЯ';
                        e.resP2Badge.classList.add('hidden');
                    } else if (p2 > p1) {
                        e.resP2Badge.classList.remove('hidden');
                        e.resP2Badge.textContent = '👑 MVP ДНЯ';
                        e.resP1Badge.classList.add('hidden');
                    } else if (p1 === p2 && p1 > 0) {
                        e.resP1Badge.classList.remove('hidden');
                        e.resP1Badge.textContent = '🤝 СЛАЖЕННАЯ КОМАНДА';
                        e.resP2Badge.classList.remove('hidden');
                        e.resP2Badge.textContent = '🤝 СЛАЖЕННАЯ КОМАНДА';
                    } else {
                        e.resP1Badge.classList.add('hidden');
                        e.resP2Badge.classList.add('hidden');
                    }
                }

                if (e.resCoopCombo) {
                    e.resCoopCombo.textContent = 'x' + (r.coopCombo || 0);
                }
            } else {
                e.resCoopCard.classList.add('hidden');
                e.resCoopCard.style.display = 'none';
            }
        }

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
        if (this.el.shop) this.el.shop.classList.remove('shop-closing');
        this.shop.open(tab);
        this._syncPause();
    }

    closeShop(immediate = false) {
        this.shop.close(immediate, () => {
            this._syncPause();
        });
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

    getPlayerNickname() {
        if (this.game && this.game.storage && typeof this.game.storage.getLocalProfile === 'function') {
            const p = this.game.storage.getLocalProfile();
            if (p && p.name) return p.name;
        }
        if (this.game && this.game.save && this.game.save.nickname) {
            return this.game.save.nickname;
        }
        try {
            const stored = localStorage.getItem('svinolov_player_nickname');
            if (stored) return stored;
        } catch (e) {}
        return 'Фермер';
    }

    savePlayerNickname(name) {
        const trimmed = (name || '').trim().slice(0, 15) || 'Фермер';
        if (this.game && this.game.save) {
            this.game.save.nickname = trimmed;
        }
        if (this.game && this.game.storage) {
            if (typeof this.game.storage.savePlayerNickname === 'function') {
                this.game.storage.savePlayerNickname(trimmed);
            } else {
                this.game.storage.save(this.game.save);
            }
        }
        try {
            localStorage.setItem('svinolov_player_nickname', trimmed);
        } catch (e) {}
        this.renderLeaderboard();
        this.toast('✏️', 'Никнейм сохранён', `Ваше имя: ${trimmed}`);
    }

    _getLeaderboardEntries() {
        const s = this.game.save || {};
        const st = s.stats || {};
        const bst = s.battleStats || (this.game.storage && this.game.storage.data && this.game.storage.data.battleStats) || {};
        const playerName = this.getPlayerNickname();
        const playerPrestige = Math.max(0, s.prestige || 0);
        const playerDay = Math.max(1, s.day || 1);
        const playerBestDay = Math.max(playerDay, st.bestDay || 1);
        const playerTotalCoins = Math.max(0, st.totalCoins || 0);
        const playerCoins = Math.max(0, Math.round(this.game.shownCoins ?? s.coins ?? 0));
        const playerTotalPigs = Math.max(0, st.totalPigs || 0);
        const playerBestCombo = Math.max(0, st.bestCombo || 0);
        const playerPerfectDays = Math.max(0, st.perfectDays || 0);
        const playerBattleWins = Math.max(0, bst.wins || 0);

        const playerHatId = s.hat || 'straw';
        const playerHatDef = LEADERBOARD_HATS[playerHatId] || { name: 'Соломенная', icon: '🌾' };

        const playerEntry = {
            id: 'local_player',
            isPlayer: true,
            name: playerName,
            farm: 'Ваше хозяйство',
            title: playerBattleWins > 0 ? `Гроза свиней (${playerBattleWins} ⚔️)` : 'Хозяин фермы',
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
                perfectDays: playerPerfectDays,
                battleWins: playerBattleWins
            }
        };

        // Реальные соперники из сетевых игр (Кооп и Битвы 1v1)
        let opponents = [];
        if (this.game && this.game.storage && typeof this.game.storage.getRealLeaderboard === 'function') {
            const raw = this.game.storage.getRealLeaderboard(this.lbCriteria) || [];
            opponents = raw.filter(r => r.id !== 'local_player' && r.name !== playerName);
        } else if (s.realLeaderboard && Array.isArray(s.realLeaderboard)) {
            opponents = s.realLeaderboard.filter(r => r.name !== playerName);
        } else {
            try {
                const stored = localStorage.getItem('svinolov_real_players');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (Array.isArray(parsed)) opponents = parsed.filter(r => r.name !== playerName);
                }
            } catch (e) {}
        }

        const formattedOpponents = opponents.map((r, i) => {
            const hatDef = LEADERBOARD_HATS[r.hat] || { name: 'Соломенная', icon: '🌾' };
            const wins = r.battleWins || 0;
            return {
                id: r.id || `opponent_${i}`,
                isPlayer: false,
                name: r.name || 'Сетевой игрок',
                farm: r.farm || 'Сетевой соперник',
                title: wins > 0 ? `Соперник в 1v1 (${wins} ⚔️)` : 'Сетевой фермер',
                hat: r.hat || 'straw',
                hatName: hatDef.name,
                hatIcon: hatDef.icon,
                avatar: r.avatar || (i % 2 === 0 ? '👩‍🌾' : '🤠'),
                stats: {
                    prestige: r.prestige || 0,
                    totalCoins: r.totalCoins || 0,
                    coins: r.coins || 0,
                    bestDay: r.bestDay || 1,
                    totalPigs: r.totalPigs || 0,
                    bestCombo: r.bestCombo || 0,
                    perfectDays: r.perfectDays || 0,
                    battleWins: wins
                }
            };
        });

        return [playerEntry, ...formattedOpponents];
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

        // 4. Профиль игрока (Моя карточка с возможностью редактирования ника)
        if (this.el.lbPlayerCard && playerEntry) {
            const valFmt = curCrit.fmt(playerEntry.stats[curCrit.id] || 0);
            let rankClass = 'rank-other';
            let rankBadge = `#${playerRank}`;
            if (playerRank === 1) { rankClass = 'rank-gold'; rankBadge = '🥇 1'; }
            else if (playerRank === 2) { rankClass = 'rank-silver'; rankBadge = '🥈 2'; }
            else if (playerRank === 3) { rankClass = 'rank-bronze'; rankBadge = '🥉 3'; }

            const bst = (this.game && this.game.save && this.game.save.battleStats) || {};
            const battlePill = `⚔️ 1v1: ${bst.wins || 0}W / ${bst.losses || 0}L`;

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
                    <div class="lb-nick-edit-row">
                        <label for="lb-nickname-input">Ваш ник:</label>
                        <div class="lb-nick-input-wrap">
                            <input type="text" id="lb-nickname-input" class="lb-nickname-input" maxlength="15" value="${playerEntry.name}" placeholder="Введите имя...">
                            <button class="btn btn-small green lb-nick-save-btn" id="lb-nickname-save-btn" type="button" title="Сохранить имя">💾</button>
                        </div>
                    </div>
                    <div class="lb-my-quick-stats">
                        <span class="lb-stat-pill" title="Престижей">🐽 ${playerEntry.stats.prestige}</span>
                        <span class="lb-stat-pill" title="Монет">🪙 ${U.fmt(playerEntry.stats.coins)}</span>
                        <span class="lb-stat-pill" title="Поймано свиней">🐷 ${U.fmt(playerEntry.stats.totalPigs)}</span>
                        <span class="lb-stat-pill" title="Рекорд дня">📅 День ${playerEntry.stats.bestDay}</span>
                        <span class="lb-stat-pill" title="Лучшее комбо">🔥 x${playerEntry.stats.bestCombo}</span>
                        <span class="lb-stat-pill" title="Победы в битвах 1v1">${battlePill}</span>
                    </div>
                </div>
                <div class="lb-my-rank-col">
                    <div class="lb-my-rank-badge ${rankClass}">${rankBadge}</div>
                    <div class="lb-my-metric-label">${curCrit.title}</div>
                    <div class="lb-my-metric-val">${valFmt}</div>
                </div>
            `;

            const nickInput = this.el.lbPlayerCard.querySelector('#lb-nickname-input');
            const nickSave = this.el.lbPlayerCard.querySelector('#lb-nickname-save-btn');
            if (nickInput && nickSave) {
                nickSave.addEventListener('click', () => this.savePlayerNickname(nickInput.value));
                nickInput.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') this.savePlayerNickname(nickInput.value);
                });
            }
        }

        // 5. Заголовок колонки
        if (this.el.lbScoreColHeader) {
            this.el.lbScoreColHeader.textContent = curCrit.col;
        }

        // 6. Таблица лидеров (только реальные игроки)
        if (this.el.lbTableBody) {
            const rowsHtml = entries.map((entry, idx) => {
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

            const emptyNoticeHtml = entries.length <= 1 ? `
                <tr class="lb-empty-row">
                    <td colspan="4">
                        <div class="lb-empty-notice">
                            <b>💡 Здесь соревнуются только реальные игроки (без ботов).</b><br>
                            Сыграйте по сети с друзьями через кнопку «🌐 Онлайн игра» (Кооп или Битву 1v1), чтобы сохранить их профили и рекорды в таблице лидеров!
                        </div>
                    </td>
                </tr>
            ` : '';

            this.el.lbTableBody.innerHTML = rowsHtml + emptyNoticeHtml;
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
        const isMobile = this.isMobileDevice();
        const isCoop = (this.game.mode === 'coop');

        // Кнопки на титульном экране
        if (this.el.titleModeWrap) this.el.titleModeWrap.classList.remove('hidden');
        if (this.el.titleModeSolo) {
            this.el.titleModeSolo.classList.toggle('active', !isCoop);
        }
        if (this.el.titleModeCoop) {
            this.el.titleModeCoop.classList.toggle('active', isCoop);
        }

        // Одиночная кнопка (для совместимости)
        const text = isCoop ? 'Режим: 👥 Кооп на 1 устройстве' : 'Режим: 👤 1 Игрок';
        const icon = isCoop ? '👥' : '👤';
        if (this.el.titleModeText) this.el.titleModeText.textContent = text;
        if (this.el.titleModeIcon) this.el.titleModeIcon.textContent = icon;
        if (this.el.titleMode) {
            this.el.titleMode.classList.toggle('coop-active', isCoop);
        }

        // Кнопки в меню паузы
        if (this.el.pauseMode) {
            this.el.pauseMode.textContent = `${icon} ${text}`;
            this.el.pauseMode.classList.toggle('is-on', isCoop);
            this.el.pauseMode.classList.toggle('is-off', !isCoop);
            this.el.pauseMode.classList.remove('hidden');
        }

        // Заметная кнопка «Переключить в Соло» в меню паузы (ВСЕГДА доступна при коопе, включая мобильные устройства!)
        if (this.el.pauseSwitchSolo) {
            this.el.pauseSwitchSolo.classList.toggle('hidden', !isCoop);
            this.el.pauseSwitchSolo.style.display = isCoop ? 'block' : 'none';
        }

        // Быстрые кнопки возврата в Соло в HUD
        if (this.el.hudCoopToSolo) {
            this.el.hudCoopToSolo.classList.toggle('hidden', !isCoop);
        }
        if (this.el.btnHudSoloSwitch) {
            this.el.btnHudSoloSwitch.classList.toggle('hidden', !isCoop);
        }

        // Подсказки управления
        if (this.el.helpSolo) this.el.helpSolo.classList.toggle('hidden', isCoop);
        if (this.el.helpCoop) this.el.helpCoop.classList.toggle('hidden', !isCoop);
        if (this.el.pauseHelpSolo) this.el.pauseHelpSolo.classList.toggle('hidden', isCoop);
        if (this.el.pauseHelpCoop) this.el.pauseHelpCoop.classList.toggle('hidden', !isCoop);

        if (this.el.coopBar) {
            const isBattle = (this.game.mode === 'battle' || this.game.onlineMode === 'battle');
            this.el.coopBar.classList.toggle('hidden', !isCoop || isBattle || !this._vis(this.el.hud));
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
        const mode = this.selectedOnlineMode || 'coop';
        if (typeof this.onHostRoom === 'function') {
            this.onHostRoom(mode);
            return;
        }
        if (this.game.network && typeof this.game.network.hostRoom === 'function') {
            this.game.network.hostRoom(mode);
            return;
        }
        if (typeof this.game.hostOnlineGame === 'function') {
            this.game.hostOnlineGame(mode);
            return;
        }
        // Заглушка, пока сетевой модуль инициализируется
        const fallbackCode = 'PIG-' + Math.floor(1000 + Math.random() * 9000);
        this.setHostRoomCode(fallbackCode);
        this.setHostStatus(mode === 'battle' ? 'Ожидание соперника для 1v1 Битвы...' : 'Ожидание подключения второго игрока (Фермерши)...');
        this.toast('🌐', 'Комната создана!', `Режим: ${mode === 'battle' ? '1v1 Битва' : 'Кооператив'} · Код: ${fallbackCode}`);
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
     *  1v1 Битва ловцов (Battle Mode)
     * ============================================================ */
    setBattleHudVisible(visible) {
        if (this.el.hudBattleBar) {
            this.el.hudBattleBar.classList.toggle('hidden', !visible);
        }
        if (visible && this.el.coopBar) {
            this.el.coopBar.classList.add('hidden');
        }
    }

    updateBattleHud(secs, p1Score, p2Score, p1Name, p2Name) {
        const e = this.el;
        if (e.battleTimerSecs) {
            const s = Math.max(0, Math.ceil(secs));
            e.battleTimerSecs.textContent = s;
            if (s <= 10) e.battleTimerSecs.parentElement.classList.add('danger');
            else e.battleTimerSecs.parentElement.classList.remove('danger');
        }
        if (e.battleP1Score) e.battleP1Score.textContent = p1Score ?? 0;
        if (e.battleP2Score) e.battleP2Score.textContent = p2Score ?? 0;
        if (p1Name && e.battleP1Name) e.battleP1Name.textContent = p1Name;
        if (p2Name && e.battleP2Name) e.battleP2Name.textContent = p2Name;
    }

    showBattleResult(data = {}) {
        const e = this.el;
        if (!e.battleResultModal) return;

        const winner = data.winner || 'draw'; // 'p1' | 'p2' | 'draw'
        const isHost = (data.role === 'host' || data.isHost);
        const p1Score = data.p1Score || 0;
        const p2Score = data.p2Score || 0;
        const p1Name = data.p1Name || 'Фермер';
        const p2Name = data.p2Name || 'Фермерша';
        const reward = data.reward ?? 10;

        const isWinner = (isHost && winner === 'p1') || (!isHost && winner === 'p2');
        const isLoser = (isHost && winner === 'p2') || (!isHost && winner === 'p1');
        const isDraw = (winner === 'draw');

        if (e.battleResultTitle) {
            if (isDraw) {
                e.battleResultTitle.textContent = 'НИЧЬЯ!';
                if (e.battleResultIcon) e.battleResultIcon.textContent = '🤝';
                if (e.battleResultDesc) e.battleResultDesc.textContent = `Боевая ничья! Оба ловца поймали по ${p1Score} свиней.`;
            } else if (isWinner) {
                e.battleResultTitle.textContent = '👑 ПОБЕДА!';
                if (e.battleResultIcon) e.battleResultIcon.textContent = '👑';
                if (e.battleResultDesc) e.battleResultDesc.textContent = 'Великолепно! Вы поймали больше свиней за 60 секунд!';
            } else {
                e.battleResultTitle.textContent = 'ПОРАЖЕНИЕ';
                if (e.battleResultIcon) e.battleResultIcon.textContent = '🐷';
                if (e.battleResultDesc) e.battleResultDesc.textContent = 'Соперник оказался быстрее в этот раз. Возьмите реванш!';
            }
        }

        if (e.battleResNameP1) e.battleResNameP1.textContent = p1Name;
        if (e.battleResNameP2) e.battleResNameP2.textContent = p2Name;
        if (e.battleResScoreP1) e.battleResScoreP1.textContent = p1Score;
        if (e.battleResScoreP2) e.battleResScoreP2.textContent = p2Score;

        if (e.battleResCardP1 && e.battleResCardP2) {
            e.battleResCardP1.classList.toggle('winner', winner === 'p1');
            e.battleResCardP2.classList.toggle('winner', winner === 'p2');
        }

        if (e.battleResBadgeP1 && e.battleResBadgeP2) {
            if (winner === 'p1') {
                e.battleResBadgeP1.className = 'battle-res-badge winner';
                e.battleResBadgeP1.textContent = '👑 ПОБЕДИТЕЛЬ';
                e.battleResBadgeP2.className = 'battle-res-badge';
                e.battleResBadgeP2.textContent = '2 МЕСТО';
            } else if (winner === 'p2') {
                e.battleResBadgeP2.className = 'battle-res-badge winner';
                e.battleResBadgeP2.textContent = '👑 ПОБЕДИТЕЛЬ';
                e.battleResBadgeP1.className = 'battle-res-badge';
                e.battleResBadgeP1.textContent = '2 МЕСТО';
            } else {
                e.battleResBadgeP1.className = 'battle-res-badge';
                e.battleResBadgeP1.textContent = '🤝 НИЧЬЯ';
                e.battleResBadgeP2.className = 'battle-res-badge';
                e.battleResBadgeP2.textContent = '🤝 НИЧЬЯ';
            }
        }

        if (e.battleRewardText) {
            e.battleRewardText.textContent = `+${reward} 🪙`;
        }

        const bst = (this.game && this.game.save && this.game.save.battleStats) || {};
        if (e.battleStatsSummary) {
            const wins = bst.wins || 0;
            const losses = bst.losses || 0;
            const ties = bst.ties || 0;
            e.battleStatsSummary.textContent = `Ваш рекорд в 1v1: ⚔️ ${wins} побед · ${losses} поражений · ${ties} ничьих`;
        }

        try {
            if (isWinner && this.game.sfx) this.game.sfx.win();
            else if (isLoser && this.game.sfx) this.game.sfx.fail();
        } catch (err) {}

        e.battleResultModal.classList.remove('hidden');
        this._syncPause();
        this._resetTouchInput();
    }

    hideBattleResult() {
        if (this.el.battleResultModal) {
            this.el.battleResultModal.classList.add('hidden');
        }
        this._syncPause();
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
