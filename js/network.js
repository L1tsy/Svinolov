'use strict';

/**
 * «Свинолов» — Сетевой модуль WebRTC P2P (PeerJS) v2.2.
 * Обеспечивает стабильный онлайн-мультиплеер на GitHub Pages без выделенного бэкенд-сервера.
 *
 * Архитектура:
 * - Хост (Player 1): Авторитетная физика, мир, таймер битвы, синхронизация снапшотов (~25Hz).
 * - Гость (Player 2): Локальная камера, передача ввода (~30Hz) и событий.
 *
 * Ключевые возможности v2.2:
 * 1. Надёжный WebRTC: 4 публичных STUN-сервера Google и Cloudflare.
 * 2. Активный Heartbeat / Ping-pong (каждые 500мс): замер RTT, цветной индикатор задержки в HUD.
 * 3. Graceful Auto-Reconnect: при разрыве или зависании соединения автоподключение до 5 попыток.
 * 4. Устранение фризов ввода: Input smoothing & Dead reckoning с плавным замедлением до 250мс.
 * 5. Гарантированная доставка с подтверждением (ACK) для критических событий (старт, смена режима, конец дня, битва, реванш).
 * 6. Поддержка онлайн-режимов: 'coop' (Ферма) и 'battle' (Битва ловцов 1v1 на 60 сек).
 * 7. Обмен профилями игроков (никнейм, шляпа, статы) для записи реальных игроков в таблицу рекордов.
 */

// Список надежных публичных STUN-серверов
const STUN_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
];

const PEER_CONFIG = {
    debug: 1,
    config: {
        iceServers: STUN_SERVERS,
        sdpSemantics: 'unified-plan'
    }
};

class NetworkManager {
    constructor(game) {
        this.game = game;
        NetworkManager.instance = this;

        this.peer = null;
        this.conn = null;
        this.isHost = false;
        this.isGuest = false;
        this.isConnected = false;
        this.roomCode = null;
        this.status = 'idle'; // idle | connecting | waiting | connected | reconnecting | error

        // Режимы игры: 'coop' (Кооперативная ферма) | 'battle' (Битва 1v1 на 60 сек)
        this.onlineMode = 'coop';

        // Heartbeat / Latency
        this.pingMs = 0;
        this.lastPingSent = 0;
        this.lastPongReceived = performance.now();
        this.isStalled = false;
        this._pingInterval = null;

        // Циклы синхронизации
        this.syncInterval = null;
        this.inputInterval = null;

        // Авто-переподключение (Auto-reconnect)
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectTimer = null;
        this.isReconnecting = false;

        // Гарантированная доставка с подтверждением (ACK)
        this._msgSeq = 0;
        this._pendingAcks = new Map(); // msgId -> { pkt, msgType, payload, lastSend, retries, maxRetries, callback }
        this._receivedMsgIds = new Set(); // Кэш дедупликации полученных ID
        this._ackInterval = null;

        // Dead Reckoning & Input Smoothing для удаленного игрока
        this._drLastPacketTime = 0;
        this._drLastVx = 0;
        this._drLastVy = 0;

        // Профили игроков
        this.localProfile = null;
        this.remoteProfile = null;
        this.remoteNickname = null;

        this.PEER_PREFIX = 'svin-room-';

        // Запуск глобального цикла ACK повторов
        this._startAckRetryLoop();
    }

    /**
     * Генерирует читаемый 4-значный код комнаты (например 4821)
     */
    static generateRoomCode() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }

    /**
     * Нормализует код комнаты (удаляет пробелы, спецсимволы, переводит в верхний регистр)
     */
    static cleanCode(raw) {
        if (!raw) return '';
        return raw.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    /**
     * Возвращает прямую ссылку-приглашение для подключения
     */
    getShareableLink(code) {
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('join', code);
            return url.toString();
        } catch (e) {
            return window.location.origin + window.location.pathname + '?join=' + encodeURIComponent(code);
        }
    }

    /**
     * Возвращает ссылку на удаленного игрока
     */
    getRemotePlayer() {
        if (!this.game) return null;
        return this.isHost ? this.game.player2 : this.game.player;
    }

    /**
     * Возвращает ссылку на локального игрока
     */
    getLocalPlayer() {
        if (!this.game) return null;
        return this.isHost ? this.game.player : this.game.player2;
    }

    /**
     * Возвращает никнейм локального игрока
     */
    getLocalNickname() {
        if (this.game && this.game.save && this.game.save.nickname) {
            return this.game.save.nickname;
        }
        try {
            const stored = localStorage.getItem('svin_player_nickname') || localStorage.getItem('svin_nickname');
            if (stored && stored.trim()) return stored.trim();
        } catch (e) {}
        return this.isHost ? 'Фермер' : 'Фермерша';
    }

    /**
     * Установка сетевого режима игры ('coop' | 'battle')
     */
    setOnlineMode(mode) {
        const nextMode = (mode === 'battle') ? 'battle' : 'coop';
        this.onlineMode = nextMode;
        if (this.game && typeof this.game.setMode === 'function') {
            this.game.setMode(nextMode);
        }
        if (this.isHost && this.isConnected) {
            this.broadcastReliableEvent('MODE_CHANGE', { mode: nextMode });
        }
    }

    /**
     * Инициализация Хоста (Игрок 1 / Амбар 1)
     */
    hostRoom(customCode, mode = 'coop') {
        this.disconnect();
        const code = NetworkManager.cleanCode(customCode) || NetworkManager.generateRoomCode();
        this.roomCode = code;
        this.onlineMode = mode || 'coop';
        this.isHost = true;
        this.isGuest = false;
        this.status = 'connecting';
        this.reconnectAttempts = 0;
        this.isReconnecting = false;

        if (this.game.ui) {
            this.game.ui.setHostStatus('Создание комнаты WebRTC...', false);
        }

        const peerId = this.PEER_PREFIX + code;
        try {
            this.peer = new Peer(peerId, PEER_CONFIG);
        } catch (e) {
            console.error('[Network] Peer init error:', e);
            this._handleError('Не удалось запустить сетевой сервис PeerJS');
            return false;
        }

        this.peer.on('open', (id) => {
            this.status = 'waiting';
            if (this.game.ui) {
                this.game.ui.setHostRoomCode(code);
                const roleLabel = this.onlineMode === 'battle'
                    ? 'Ожидание подключения соперника для Битвы 1v1...'
                    : 'Ожидание подключения второго игрока (Фермерши)...';
                this.game.ui.setHostStatus(roleLabel, false);
            }
        });

        this.peer.on('connection', (conn) => {
            if (this.conn && this.isConnected) {
                // Если соединение уже активно, отклоняем лишние
                conn.close();
                return;
            }
            this.conn = conn;
            this._setupConnection();
        });

        this.peer.on('error', (err) => {
            console.error('[Network] Host peer error:', err);
            if (err.type === 'unavailable-id') {
                // Если ID занят, генерируем новый код
                const nextCode = NetworkManager.generateRoomCode();
                this.hostRoom(nextCode, this.onlineMode);
            } else if (err.type === 'disconnected' || err.type === 'network') {
                if (this.peer && !this.peer.destroyed) {
                    try { this.peer.reconnect(); } catch (e) {}
                }
            } else {
                this._handleError('Ошибка сети: ' + (err.message || err.type));
            }
        });

        return code;
    }

    /**
     * Инициализация Гостя (Игрок 2 / Амбар 2)
     */
    joinRoom(rawCode) {
        this.disconnect();
        const code = NetworkManager.cleanCode(rawCode);
        if (!code) {
            this._handleError('Введите корректный код комнаты');
            return false;
        }
        this.roomCode = code;
        this.isHost = false;
        this.isGuest = true;
        this.status = 'connecting';
        this.reconnectAttempts = 0;
        this.isReconnecting = false;

        if (this.game.ui) {
            this.game.ui.setJoinStatus(`Подключение к комнате ${code}...`, false, false);
        }

        try {
            this.peer = new Peer(PEER_CONFIG);
        } catch (e) {
            console.error('[Network] Peer init error:', e);
            this._handleError('Не удалось запустить сетевой сервис PeerJS');
            return false;
        }

        this.peer.on('open', () => {
            const hostPeerId = this.PEER_PREFIX + code;
            this.conn = this.peer.connect(hostPeerId, {
                reliable: true
            });
            this._setupConnection();
        });

        this.peer.on('error', (err) => {
            console.error('[Network] Guest peer error:', err);
            if (err.type === 'peer-unavailable') {
                this._handleError(`Комната ${code} не найдена. Проверьте код.`);
            } else {
                this._handleError('Ошибка подключения: ' + (err.message || err.type));
            }
        });

        return true;
    }

    /**
     * Настройка DataConnection обработчиков
     */
    _setupConnection() {
        if (!this.conn) return;

        this.conn.on('open', () => {
            this.isConnected = true;
            this.status = 'connected';
            this.isStalled = false;
            this.reconnectAttempts = 0;
            this.isReconnecting = false;
            this.lastPongReceived = performance.now();

            const isBattle = this.onlineMode === 'battle';
            const roleName = this.isHost
                ? (isBattle ? 'P1 Хост (Битва 1v1)' : 'P1 Хост (Амбар 1)')
                : (isBattle ? 'P2 Гость (Битва 1v1)' : 'P2 Гость (Амбар 2)');

            if (this.game.ui) {
                if (this.isHost) {
                    this.game.ui.setHostStatus(isBattle ? 'Соперник в игре! Начинаем битву...' : 'Напарник подключился! Входим на ферму...', true);
                } else {
                    this.game.ui.setJoinStatus(isBattle ? 'Соперник найден! Начинаем битву...' : 'Напарник найден! Входим на ферму...', true, false);
                }
                this.game.ui.setOnlineHudStatus(true, roleName, this.roomCode);

                setTimeout(() => {
                    if (this.game.ui && typeof this.game.ui.closeOnlineModal === 'function') {
                        this.game.ui.closeOnlineModal();
                    }
                }, 600);
            }

            // 1. Отправляем профиль игрока для таблицы лидеров
            this.sendProfilePayload();

            // 2. Инициализация игрового режима
            if (this.isHost) {
                // Хост отправляет гарантированный пакет инициализации мира
                this.sendReliable('INIT_WORLD', {
                    day: this.game.day,
                    tier: this.game.world ? this.game.world.tier : 0,
                    seasonIdx: this.game.world ? this.game.world.seasonIdx : 0,
                    coopMapIdx: this.game.world ? (this.game.world.coopMapIdx || 0) : 0,
                    mode: this.onlineMode,
                    upgrades: this.game.save ? this.game.save.upgrades : {}
                });

                // Запуск онлайн-игры у Хоста
                this.game.startOnlineGame('host', { mode: this.onlineMode });
                this._startHostSyncLoop();
            } else {
                // Гость подтверждает готовность
                this.sendReliable('GUEST_READY', {
                    name: this.getLocalNickname(),
                    mode: this.onlineMode
                });
                this._startGuestInputLoop();
            }

            // 3. Запуск активного Heartbeat (каждые 500мс)
            this._startPingLoop();
        });

        this.conn.on('data', (data) => {
            this._handlePacket(data);
        });

        this.conn.on('close', () => {
            this._handleDisconnect('Связь с игроком прервана');
        });

        this.conn.on('error', (err) => {
            console.error('[Network] Connection error:', err);
            this._handleDisconnect('Сетевая ошибка соединения');
        });
    }

    /**
     * Отправка профиля игрока через надежный протокол
     */
    sendProfilePayload() {
        let profile = null;
        if (this.game && this.game.storage && typeof this.game.storage.getLocalProfile === 'function') {
            profile = this.game.storage.getLocalProfile();
        }
        if (!profile) {
            profile = {
                id: 'p_' + (this.isHost ? 'host' : 'guest'),
                name: this.getLocalNickname(),
                hat: (this.game && this.game.save) ? (this.game.save.hat || 'straw') : 'straw',
                prestige: (this.game && this.game.save) ? (this.game.save.prestige || 0) : 0,
                totalCoins: (this.game && this.game.save) ? (this.game.save.totalCoins || this.game.save.coins || 0) : 0,
                bestDay: (this.game && this.game.save) ? (this.game.save.bestDay || this.game.save.day || 1) : 1,
                totalPigs: (this.game && this.game.save && this.game.save.stats) ? (this.game.save.stats.totalPigs || this.game.save.stats.pigsCaughtTotal || 0) : 0,
                bestCombo: (this.game && this.game.save && this.game.save.stats) ? (this.game.save.stats.bestCombo || this.game.save.stats.maxCombo || 0) : 0,
                perfectDays: (this.game && this.game.save && this.game.save.stats) ? (this.game.save.stats.perfectDays || 0) : 0,
                battleWins: (this.game && this.game.save && this.game.save.battleStats) ? (this.game.save.battleStats.wins || 0) : 0
            };
        }
        this.localProfile = profile;
        return this.sendReliable('PLAYER_PROFILE', profile);
    }

    /**
     * Обработка профиля напарника/соперника и запись в локальную таблицу рекордов
     */
    _handleProfilePacket(profile) {
        if (!profile) return;
        this.remoteProfile = profile;
        this.remoteNickname = profile.name || profile.nickname || (this.isHost ? 'Фермерша' : 'Фермер');

        // Сохраняем реального игрока в хранилище (без ботов!)
        if (this.game && this.game.storage && typeof this.game.storage.upsertRealPlayer === 'function') {
            this.game.storage.upsertRealPlayer({
                id: profile.id || ('peer_' + (this.isHost ? 'p2' : 'p1') + '_' + this.remoteNickname),
                name: this.remoteNickname,
                hat: profile.hat || 'straw',
                prestige: profile.prestige || 0,
                totalCoins: profile.totalCoins || 0,
                bestDay: profile.bestDay || 1,
                totalPigs: profile.totalPigs || 0,
                bestCombo: profile.bestCombo || 0,
                perfectDays: profile.perfectDays || 0,
                battleWins: profile.battleWins || 0,
                updatedAt: Date.now()
            });
        }

        // Обновляем визуальную шляпу удаленного игрока
        const remoteP = this.getRemotePlayer();
        if (remoteP && profile.hat && profile.hat !== 'none') {
            remoteP.hat = profile.hat;
        }

        if (this.game && this.game.ui && typeof this.game.ui.toast === 'function') {
            const role = this.onlineMode === 'battle' ? 'Соперник готов!' : 'Напарник в игре!';
            this.game.ui.toast('🤝', role, `${this.remoteNickname} вошел на ферму`);
        }
    }

    /**
     * Базовая отправка сетевого пакета
     */
    sendPacket(pkt) {
        if (!this.conn || !this.isConnected) return false;
        try {
            this.conn.send(pkt);
            return true;
        } catch (e) {
            console.warn('[Network] Send packet error:', e);
            return false;
        }
    }

    /**
     * Гарантированная отправка сообщения с подтверждением (ACK) и автоповтором
     */
    sendReliable(msgType, payload = {}, callback = null) {
        if (!this.conn || !this.isConnected) {
            if (callback) callback(false);
            return false;
        }
        const msgId = 'rel_' + Date.now() + '_' + (++this._msgSeq) + '_' + Math.floor(Math.random() * 10000);
        const pkt = {
            type: 'RELIABLE_MSG',
            reliable: true,
            msgType,
            msgId,
            payload,
            t: performance.now()
        };

        this._pendingAcks.set(msgId, {
            pkt,
            msgType,
            payload,
            lastSend: performance.now(),
            retries: 0,
            maxRetries: 15,
            callback
        });

        this.sendPacket(pkt);
        return msgId;
    }

    /**
     * Отправляет дискретное гарантированное игровое событие с подтверждением
     */
    broadcastReliableEvent(event, payload = {}, callback = null) {
        return this.sendReliable('NET_EVENT', { event, payload }, callback);
    }

    /**
     * Отправляет дискретное игровое событие (автоматически использует ACK для критических)
     */
    broadcastEvent(event, payload = {}) {
        const CRITICAL_EVENTS = [
            'NEXT_DAY', 'RETRY_DAY', 'DAY_END', 'MODE_CHANGE',
            'BATTLE_START', 'BATTLE_END', 'BATTLE_REMATCH', 'REMATCH',
            'SCORE_SYNC', 'PLAYER_PROFILE', 'COOP_PIN'
        ];

        if (CRITICAL_EVENTS.includes(event)) {
            return this.broadcastReliableEvent(event, payload);
        }

        return this.sendPacket({
            type: 'NET_EVENT',
            event,
            payload,
            t: performance.now()
        });
    }

    /**
     * Цикл повторов неподтвержденных надежных сообщений (каждые 100мс)
     */
    _startAckRetryLoop() {
        if (this._ackInterval) clearInterval(this._ackInterval);
        this._ackInterval = setInterval(() => {
            if (!this.isConnected || !this.conn || this._pendingAcks.size === 0) return;
            const now = performance.now();
            for (const [msgId, entry] of this._pendingAcks) {
                if (now - entry.lastSend > 220) {
                    if (entry.retries < entry.maxRetries) {
                        entry.retries++;
                        entry.lastSend = now;
                        this.sendPacket(entry.pkt);
                    } else {
                        console.warn(`[Network] Reliable message ${msgId} (${entry.msgType}) timed out after ${entry.maxRetries} retries`);
                        if (entry.callback) {
                            try { entry.callback(false); } catch (e) {}
                        }
                        this._pendingAcks.delete(msgId);
                    }
                }
            }
        }, 100);
    }

    /**
     * Центральный диспетчер входящих пакетов
     */
    _handlePacket(pkt) {
        if (!pkt || !pkt.type) return;

        switch (pkt.type) {
            // --- Heartbeat Ping / Pong ---
            case 'PING':
                this.sendPacket({ type: 'PONG', t: pkt.t });
                break;

            case 'PONG':
                this.lastPongReceived = performance.now();
                this.pingMs = Math.max(1, Math.round(this.lastPongReceived - (pkt.t || this.lastPingSent)));
                if (this.isStalled) {
                    this.isStalled = false;
                    if (this.game && this.game.ui && typeof this.game.ui.toast === 'function') {
                        this.game.ui.toast('🟢', 'Связь стабильна', `Пинг: ${this.pingMs}мс`);
                    }
                }
                this._updatePingStatusUI();
                break;

            // --- Гарантированная доставка с подтверждением (ACK) ---
            case 'RELIABLE_MSG': {
                // 1. Мгновенно отправляем ACK обратно
                if (pkt.msgId) {
                    this.sendPacket({
                        type: 'ACK',
                        ackId: pkt.msgId,
                        t: performance.now()
                    });
                }

                // 2. Дедупликация (защита от повторного выполнения одного события)
                if (pkt.msgId && this._receivedMsgIds.has(pkt.msgId)) {
                    return;
                }
                if (pkt.msgId) {
                    this._receivedMsgIds.add(pkt.msgId);
                    if (this._receivedMsgIds.size > 400) {
                        const first = this._receivedMsgIds.values().next().value;
                        this._receivedMsgIds.delete(first);
                    }
                }

                // 3. Выполнение надежного сообщения
                this._handleReliableMessage(pkt.msgType, pkt.payload);
                break;
            }

            case 'ACK': {
                if (pkt.ackId && this._pendingAcks.has(pkt.ackId)) {
                    const entry = this._pendingAcks.get(pkt.ackId);
                    this._pendingAcks.delete(pkt.ackId);
                    if (entry.callback) {
                        try { entry.callback(true); } catch (e) { console.warn(e); }
                    }
                }
                break;
            }

            // --- Ввод гостя (Guest Input ~30Hz) ---
            case 'GUEST_INPUT':
                if (this.isHost) {
                    this._drLastPacketTime = performance.now();
                    this._drLastVx = pkt.vx || 0;
                    this._drLastVy = pkt.vy || 0;
                    this.game.receiveGuestInput(pkt);
                }
                break;

            // --- Снимок состояния хоста (Host State ~25Hz) ---
            case 'HOST_STATE':
                if (this.isGuest) {
                    this._drLastPacketTime = performance.now();
                    if (pkt.p1) {
                        this._drLastVx = pkt.p1.vx || 0;
                        this._drLastVy = pkt.p1.vy || 0;
                    }
                    if (pkt.mode) {
                        this.onlineMode = pkt.mode;
                    }
                    // Синхронизация Битвы 1v1
                    if (pkt.mode === 'battle') {
                        if (pkt.bt !== undefined) this.game.battleTimer = pkt.bt;
                        if (pkt.p1s !== undefined) this.game.battleScoreP1 = pkt.p1s;
                        if (pkt.p2s !== undefined) this.game.battleScoreP2 = pkt.p2s;
                        if (this.game.ui && typeof this.game.ui.updateBattleScore === 'function') {
                            this.game.ui.updateBattleScore(pkt.p1s, pkt.p2s, pkt.bt);
                        }
                    }
                    this.game.receiveHostState(pkt);
                }
                break;

            // --- Дискретные события ---
            case 'NET_EVENT':
                if (this.game && typeof this.game.receiveNetEvent === 'function') {
                    this.game.receiveNetEvent(pkt.event, pkt.payload);
                }
                break;

            default:
                break;
        }
    }

    /**
     * Обработка надежных сообщений, доставленных с гарантией
     */
    _handleReliableMessage(msgType, payload) {
        if (!msgType) return;

        switch (msgType) {
            case 'PLAYER_PROFILE':
                this._handleProfilePacket(payload);
                break;

            case 'MODE_CHANGE':
                if (payload && payload.mode) {
                    this.onlineMode = payload.mode;
                    if (this.game && typeof this.game.setMode === 'function') {
                        this.game.setMode(payload.mode);
                    }
                    if (this.game && this.game.ui && typeof this.game.ui.toast === 'function') {
                        const title = payload.mode === 'battle' ? '⚔️ Битва 1v1 (60 сек)' : '🌾 Кооперативная ферма';
                        this.game.ui.toast('🎮', 'Режим изменён', title);
                    }
                    if (this.game && typeof this.game.receiveNetEvent === 'function') {
                        this.game.receiveNetEvent('MODE_CHANGE', payload);
                    }
                }
                break;

            case 'INIT_WORLD':
                if (this.isGuest) {
                    this.onlineMode = (payload && payload.mode) || 'coop';
                    this.game.startOnlineGame('guest', payload);
                }
                break;

            case 'GUEST_READY':
                if (this.isHost) {
                    if (payload && payload.name) {
                        this.remoteNickname = payload.name;
                    }
                    if (this.game && this.game.ui && typeof this.game.ui.toast === 'function') {
                        const label = this.onlineMode === 'battle' ? 'Соперник готов к битве!' : 'Фермерша заняла Амбар №2';
                        this.game.ui.toast('🤝', 'Напарник в игре!', label);
                    }
                }
                break;

            case 'BATTLE_START':
                if (this.game) {
                    this.onlineMode = 'battle';
                    if (typeof this.game.startBattleMatch === 'function') {
                        this.game.startBattleMatch(payload);
                    } else if (typeof this.game.receiveNetEvent === 'function') {
                        this.game.receiveNetEvent('BATTLE_START', payload);
                    }
                }
                break;

            case 'BATTLE_END':
                this._handleBattleEnd(payload);
                break;

            case 'REMATCH':
            case 'BATTLE_REMATCH':
                if (this.game) {
                    if (typeof this.game.restartBattleMatch === 'function') {
                        this.game.restartBattleMatch(payload);
                    } else if (typeof this.game.startDay === 'function') {
                        if (this.game.ui) this.game.ui.hideResult();
                        this.game.startDay(payload.day || this.game.day);
                    }
                }
                break;

            case 'DAY_END':
                if (this.isGuest && this.game && typeof this.game.finishDay === 'function') {
                    this.game.finishDay(payload);
                }
                break;

            case 'NET_EVENT':
                if (payload && this.game && typeof this.game.receiveNetEvent === 'function') {
                    this.game.receiveNetEvent(payload.event, payload.payload);
                }
                break;

            default:
                if (this.game && typeof this.game.receiveNetEvent === 'function') {
                    this.game.receiveNetEvent(msgType, payload);
                }
                break;
        }
    }

    /**
     * Обработка завершения Битвы 1v1
     */
    _handleBattleEnd(payload) {
        if (!payload) return;
        const winner = payload.winner; // 1 (P1), 2 (P2), 0 (Ничья)
        const p1Score = payload.p1Score || 0;
        const p2Score = payload.p2Score || 0;

        // Фиксация результата в локальном профиле через storage
        if (this.game && this.game.storage && typeof this.game.storage.recordBattleResult === 'function') {
            const myPigs = this.isHost ? p1Score : p2Score;
            const oppPigs = this.isHost ? p2Score : p1Score;
            const myResult = (winner === 0) ? 'tie' : ((winner === (this.isHost ? 1 : 2)) ? 'win' : 'loss');
            this.game.storage.recordBattleResult(myResult, myPigs, oppPigs, this.remoteNickname || 'Соперник');
        }

        // Передача события игре и UI
        if (this.game) {
            this.game.battleEnded = true;
            this.game.battleWinner = winner;
            this.game.battleScoreP1 = p1Score;
            this.game.battleScoreP2 = p2Score;

            if (typeof this.game.finishBattle === 'function') {
                this.game.finishBattle(payload);
            } else if (this.game.ui && typeof this.game.ui.showBattleResult === 'function') {
                this.game.ui.showBattleResult(payload);
            } else if (typeof this.game.receiveNetEvent === 'function') {
                this.game.receiveNetEvent('BATTLE_END', payload);
            }
        }
    }

    /**
     * Запуск вещания авторитетного состояния Хостом (~25Hz, 40мс)
     */
    _startHostSyncLoop() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        this.syncInterval = setInterval(() => {
            if (!this.isConnected || !this.isHost) return;
            const snapshot = this.game.createNetworkSnapshot ? this.game.createNetworkSnapshot() : null;
            if (snapshot) {
                // Если активна Битва 1v1, добавляем синхронизацию таймера и очков
                if (this.onlineMode === 'battle') {
                    snapshot.mode = 'battle';
                    snapshot.bt = this.game.battleTimer !== undefined ? Math.round(this.game.battleTimer * 10) / 10 : 60;
                    snapshot.p1s = this.game.battleScoreP1 !== undefined ? this.game.battleScoreP1 : (this.game.dayCaughtP1 || 0);
                    snapshot.p2s = this.game.battleScoreP2 !== undefined ? this.game.battleScoreP2 : (this.game.dayCaughtP2 || 0);
                } else {
                    snapshot.mode = 'coop';
                }

                this.sendPacket({
                    type: 'HOST_STATE',
                    t: performance.now(),
                    ...snapshot
                });
            }
        }, 40);
    }

    /**
     * Запуск передачи локального ввода Гостем Хосту (~30Hz, 33мс)
     */
    _startGuestInputLoop() {
        if (this.inputInterval) clearInterval(this.inputInterval);
        this.inputInterval = setInterval(() => {
            if (!this.isConnected || !this.isGuest) return;
            const p2 = this.game.player2;
            if (!p2) return;

            const swingBuf = (this.game.swingBuf2 > 0 || this.game.swingBuf1 > 0 || this.game.keys.space || this.game.keys.enter);
            this.sendPacket({
                type: 'GUEST_INPUT',
                x: Math.round(p2.x * 10) / 10,
                y: Math.round(p2.y * 10) / 10,
                vx: Math.round(p2.vx),
                vy: Math.round(p2.vy),
                facing: p2.facing,
                moving: p2.moving,
                walk: p2.walk,
                dashT: p2.dashT,
                dashCdT: p2.dashCdT,
                stun: p2.stun,
                swingT: p2.swingT,
                swingBuf: swingBuf,
                t: performance.now()
            });

            if (swingBuf) {
                this.game.swingBuf1 = 0;
                this.game.swingBuf2 = 0;
            }
        }, 33);
    }

    /**
     * Активный Heartbeat / Ping-pong loop (каждые 500мс)
     */
    _startPingLoop() {
        if (this._pingInterval) clearInterval(this._pingInterval);
        this.lastPingSent = 0;
        this.lastPongReceived = performance.now();

        this._pingInterval = setInterval(() => {
            if (!this.isConnected || !this.conn) return;
            const now = performance.now();
            this.lastPingSent = now;
            this.sendPacket({ type: 'PING', t: now });

            // Сторожевой таймер зависания (Heartbeat Stall > 3.5 сек без ответа)
            if (now - this.lastPongReceived > 3500 && !this.isStalled) {
                this._handleStall();
            }
        }, 500);
    }

    /**
     * Отображение задержки и статуса пинга в интерфейсе
     */
    _updatePingStatusUI() {
        const chip = document.getElementById('hud-online-chip');
        if (chip) {
            let pingEl = document.getElementById('hud-online-ping');
            if (!pingEl) {
                pingEl = document.createElement('span');
                pingEl.id = 'hud-online-ping';
                pingEl.className = 'online-chip-ping';
                pingEl.style.fontSize = '11px';
                pingEl.style.fontWeight = 'bold';
                pingEl.style.marginLeft = '6px';
                pingEl.style.padding = '1px 6px';
                pingEl.style.borderRadius = '6px';
                pingEl.style.background = 'rgba(0, 0, 0, 0.4)';
                pingEl.style.display = 'inline-flex';
                pingEl.style.alignItems = 'center';
                chip.appendChild(pingEl);
            }

            let color = '#4ade80'; // Зеленый (<80ms)
            let icon = '⚡';
            if (this.pingMs >= 80 && this.pingMs < 180) {
                color = '#facc15'; // Желтый (80-180ms)
                icon = '📶';
            } else if (this.pingMs >= 180) {
                color = '#f87171'; // Красный (>180ms)
                icon = '⚠️';
            }

            pingEl.style.color = color;
            pingEl.innerHTML = `${icon} ${this.pingMs}ms`;
            chip.title = `Сетевое подключение P2P (Пинг: ${this.pingMs}мс)`;
        }

        if (this.game && this.game.ui && typeof this.game.ui.updatePingDisplay === 'function') {
            this.game.ui.updatePingDisplay(this.pingMs);
        }
    }

    /**
     * Обработка задержки / зависания канала
     */
    _handleStall() {
        this.isStalled = true;
        console.warn('[Network] Connection heartbeat stalled (>3.5s without response)');

        const pingEl = document.getElementById('hud-online-ping');
        if (pingEl) {
            pingEl.style.color = '#f87171';
            pingEl.textContent = '⚠️ лаг...';
        }

        if (this.game && this.game.ui && typeof this.game.ui.toast === 'function') {
            this.game.ui.toast('⚠️', 'Задержка сети', 'Связь с напарником задерживается...');
        }

        // Если зависание продолжается более 6 секунд, инициируем плавный реконнект
        setTimeout(() => {
            if (this.isStalled && this.isConnected) {
                console.warn('[Network] Stall exceeded 6s, initiating graceful reconnect');
                this._handleDisconnect('Связь прервана (таймаут)');
            }
        }, 2500);
    }

    /**
     * Обработка ошибок при подключении
     */
    _handleError(msg) {
        this.status = 'error';
        if (this.game.ui) {
            if (this.isGuest && typeof this.game.ui.setJoinStatus === 'function') {
                this.game.ui.setJoinStatus(msg, false, true);
            } else if (this.isHost && typeof this.game.ui.setHostStatus === 'function') {
                this.game.ui.setHostStatus(msg, false);
            }
            if (typeof this.game.ui.toast === 'function') {
                this.game.ui.toast('⚠️', 'Ошибка сети', msg);
            }
        }
    }

    /**
     * Плавная обработка обрыва соединения с запуском Auto-Reconnect
     */
    _handleDisconnect(reason) {
        const wasConnected = this.isConnected;
        this.isConnected = false;
        this.isStalled = false;

        if (this.syncInterval) clearInterval(this.syncInterval);
        if (this.inputInterval) clearInterval(this.inputInterval);
        if (this._pingInterval) clearInterval(this._pingInterval);

        if (this.conn) {
            try { this.conn.close(); } catch (e) {}
            this.conn = null;
        }

        // Авто-переподключение (Graceful Auto-Reconnect)
        if (wasConnected && this.roomCode && this.reconnectAttempts < this.maxReconnectAttempts) {
            this._startAutoReconnect(reason);
            return;
        }

        // Окончательное отключение при исчерпании попыток
        this.status = 'idle';
        this.reconnectAttempts = 0;
        this.isReconnecting = false;

        const pingEl = document.getElementById('hud-online-ping');
        if (pingEl && pingEl.parentNode) pingEl.parentNode.removeChild(pingEl);

        if (this.game && this.game.ui) {
            this.game.ui.setOnlineHudStatus(false);
            this.game.ui.toast('⚠️', 'Связь потеряна', reason || 'Напарник покинул игру');
        }

        if (wasConnected && this.game && typeof this.game.onOnlinePartnerDisconnected === 'function') {
            this.game.onOnlinePartnerDisconnected(reason);
        }
    }

    /**
     * Попытка переподключения с плавным backoff
     */
    _startAutoReconnect(reason) {
        this.isReconnecting = true;
        this.reconnectAttempts++;
        this.status = 'reconnecting';

        const attempt = this.reconnectAttempts;
        const max = this.maxReconnectAttempts;
        const delay = Math.min(1000 * Math.pow(1.4, attempt - 1), 4000);

        console.log(`[Network] Auto-reconnecting attempt ${attempt}/${max} in ${delay}ms...`);

        if (this.game && this.game.ui && typeof this.game.ui.toast === 'function') {
            this.game.ui.toast('🔄', 'Переподключение...', `Попытка ${attempt} из ${max} (${reason || 'восстановление'})`);
        }

        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            if (this.isConnected) return;

            if (this.isHost) {
                // Хост сохраняет комнату и пир открытыми
                if (this.peer && this.peer.disconnected && !this.peer.destroyed) {
                    try { this.peer.reconnect(); } catch (e) {}
                }
                this.status = 'waiting';
                if (this.game && this.game.ui && typeof this.game.ui.setHostStatus === 'function') {
                    this.game.ui.setHostStatus(`Ожидание переподключения напарника (${attempt}/${max})...`, false);
                }
            } else if (this.isGuest) {
                // Гость переподключается к Хосту по сохраненному коду комнаты
                const hostPeerId = this.PEER_PREFIX + this.roomCode;
                if (this.peer && !this.peer.destroyed) {
                    if (this.peer.disconnected) {
                        try { this.peer.reconnect(); } catch (e) {}
                    }
                    try {
                        this.conn = this.peer.connect(hostPeerId, { reliable: true });
                        this._setupConnection();
                    } catch (e) {
                        console.error('[Network] Reconnect error:', e);
                        this._startAutoReconnect('Ошибка соединения');
                    }
                } else {
                    this.joinRoom(this.roomCode);
                }
            }
        }, delay);
    }

    /**
     * Полное отключение и сброс состояния
     */
    disconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
        this.reconnectAttempts = 0;
        this.isReconnecting = false;

        if (this.syncInterval) clearInterval(this.syncInterval);
        if (this.inputInterval) clearInterval(this.inputInterval);
        if (this._pingInterval) clearInterval(this._pingInterval);
        this.syncInterval = null;
        this.inputInterval = null;
        this._pingInterval = null;

        if (this.conn) {
            try { this.conn.close(); } catch (e) {}
            this.conn = null;
        }
        if (this.peer) {
            try { this.peer.destroy(); } catch (e) {}
            this.peer = null;
        }

        const pingEl = document.getElementById('hud-online-ping');
        if (pingEl && pingEl.parentNode) pingEl.parentNode.removeChild(pingEl);

        this._pendingAcks.clear();
        this._receivedMsgIds.clear();

        this.isConnected = false;
        this.isHost = false;
        this.isGuest = false;
        this.roomCode = null;
        this.status = 'idle';
        this.isStalled = false;
    }
}

// Экспорт списка STUN серверов и конфига
NetworkManager.STUN_SERVERS = STUN_SERVERS;
NetworkManager.PEER_CONFIG = PEER_CONFIG;

/* =========================================================================================
 * Встраивание Dead Reckoning & Input Smoothing в прототип Player
 * Устраняет микрофризы при потере пакетов: игрок продолжает движение по прогнозу до 250мс
 * с плавным квадратичным замедлением, а затем останавливается без рывков.
 * ========================================================================================= */
if (typeof Player !== 'undefined' && Player.prototype) {
    const _origApplyNetworkState = Player.prototype.applyNetworkState;
    Player.prototype.applyNetworkState = function(s) {
        if (!s) return;
        this._netLastTime = performance.now();
        this._netVx = s.vx || 0;
        this._netVy = s.vy || 0;

        _origApplyNetworkState.call(this, s);
    };

    const _origPlayerUpdate = Player.prototype.update;
    Player.prototype.update = function(dt, g, ix, iy) {
        if (this.isRemote) {
            const now = performance.now();
            const elapsed = this._netLastTime ? (now - this._netLastTime) : 0;

            // Если сетевой пакет задержался или потерян (> 35мс):
            // НЕ замораживаем игрока на месте! Продолжаем движение с прогнозируемой скоростью до 250мс.
            if (elapsed > 35 && elapsed <= 250) {
                const progress = (elapsed - 35) / (250 - 35); // от 0 до 1
                const decel = Math.max(0, 1 - progress);
                const decelFactor = decel * decel; // Плавное квадратичное замедление (ease-out)

                const predVx = (this._netVx || this.vx) * decelFactor;
                const predVy = (this._netVy || this.vy) * decelFactor;

                if (Math.hypot(predVx, predVy) > 5) {
                    this.targetX = (this.targetX !== undefined ? this.targetX : this.x) + predVx * dt;
                    this.targetY = (this.targetY !== undefined ? this.targetY : this.y) + predVy * dt;
                    this.moving = true;
                    this.walk += dt * (this.dashT > 0 ? 26 : 13);
                } else {
                    this.moving = false;
                }
            } else if (elapsed > 250) {
                // После 250мс без новых пакетов игрок плавно завершает движение
                this.moving = false;
                this.vx = 0;
                this.vy = 0;
            }
        }
        return _origPlayerUpdate.call(this, dt, g, ix, iy);
    };
}
