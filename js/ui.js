'use strict';

/**
 * Интерфейс поверх холста: HUD, титул, итоги дня, магазин, пауза, тач-управление.
 */
class UI {
    constructor(game) {
        this.game = game;
        const $ = (id) => document.getElementById(id);
        this.el = {
            hud: $('hud'), day: $('hud-day'), icons: $('hud-icons'), caught: $('hud-caught'),
            timer: $('hud-timer'), fill: $('timer-fill'), secs: $('timer-secs'),
            coinChip: $('chip-coins'), coins: $('hud-coins'),
            btnShop: $('btn-shop'), btnPause: $('btn-pause'),
            toasts: $('toasts'), banner: $('banner'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
            title: $('title-screen'), titlePlay: $('title-play'), titleShop: $('title-shop'), titleStats: $('title-stats'),
            result: $('result'), resTitle: $('res-title'), resStars: $('res-stars'), resCaught: $('res-caught'),
            resLines: $('res-lines'), resQuest: $('res-quest'), resEarned: $('res-earned'), resCombo: $('res-combo'),
            resPrestige: $('res-prestige'), resNext: $('res-next'), resShop: $('res-shop'),
            shop: $('shop-modal'), shopClose: $('shop-close'),
            pause: $('pause-modal'), pauseResume: $('pause-resume'), pauseSound: $('pause-sound'),
            pauseMusic: $('pause-music'), pauseReset: $('pause-reset'),
            touch: $('touch-ui'), joyZone: $('joy-zone'), joyBase: $('joy-base'), joyStick: $('joy-stick'),
            btnSwing: $('btn-swing'), btnDash: $('btn-dash')
        };

        this.shop = new Shop(game, this);
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
        window.addEventListener('resize', () => { this._coinRect = null; });
        window.addEventListener('orientationchange', () => { this._coinRect = null; });
    }

    /* ============================================================
     *  Состояние окон
     * ============================================================ */
    _vis(el) { return !el.classList.contains('hidden'); }

    get modalOpen() {
        return this._vis(this.el.title) || this._vis(this.el.result) || this.shop.isOpen || this._vis(this.el.pause);
    }

    _syncPause() {
        const need = this.shop.isOpen || this._vis(this.el.pause);
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

        // Клик по затемнению закрывает магазин / паузу
        e.shop.addEventListener('click', (ev) => { if (ev.target === e.shop) this.closeShop(); });
        e.pause.addEventListener('click', (ev) => { if (ev.target === e.pause) this.closePause(); });
    }

    _bindKeys() {
        window.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape') {
                if (this.shop.isOpen) { this.closeShop(); ev.preventDefault(); }
                else if (this._vis(this.el.pause)) { this.closePause(); ev.preventDefault(); }
                return;
            }
            // Окно итогов: Enter / Пробел жмёт главную кнопку (но не пока открыт магазин / пауза)
            if ((ev.key === 'Enter' || ev.code === 'Space') && this._vis(this.el.result) && !this.shop.isOpen && !this._vis(this.el.pause)) {
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
