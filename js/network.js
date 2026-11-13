'use strict';

/**
 * «Свинолов» — Сетевой модуль WebRTC P2P (PeerJS).
 * Обеспечивает онлайн-мультиплеер на GitHub Pages без выделенного бэкенд-сервера.
 *
 * Архитектура:
 * - Хост (Player 1): Красный амбар №1, авторитетная физика свиней, синхронизация мира.
 * - Гость (Player 2): Бирюзовый амбар №2, локальная камера на P2, передача ввода.
 */
class NetworkManager {
    constructor(game) {
        this.game = game;
        this.peer = null;
        this.conn = null;
        this.isHost = false;
        this.isGuest = false;
        this.isConnected = false;
        this.roomCode = null;
        this.status = 'idle'; // idle | connecting | waiting | connected | error

        this.lastPing = 0;
        this.pingMs = 0;
        this.syncInterval = null;
        this.inputInterval = null;

        this.PEER_PREFIX = 'svin-room-';
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
     * Инициализация Хоста (Игрок 1 / Амбар 1)
     */
    hostRoom(customCode) {
        this.disconnect();
        const code = NetworkManager.cleanCode(customCode) || NetworkManager.generateRoomCode();
        this.roomCode = code;
        this.isHost = true;
        this.isGuest = false;
        this.status = 'connecting';

        if (this.game.ui) {
            this.game.ui.setHostStatus('Создание комнаты...', false);
        }

        const peerId = this.PEER_PREFIX + code;
        try {
            this.peer = new Peer(peerId, {
                debug: 1,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });
        } catch (e) {
            console.error('[Network] Peer init error:', e);
            this._handleError('Не удалось запустить сетевой сервис PeerJS');
            return false;
        }

        this.peer.on('open', (id) => {
            this.status = 'waiting';
            if (this.game.ui) {
                this.game.ui.setHostRoomCode(code);
                this.game.ui.setHostStatus('Ожидание подключения второго игрока (Фермерши)...', false);
            }
        });

        this.peer.on('connection', (conn) => {
            if (this.conn) {
                // Если второй игрок уже подключен, отклоняем лишние подключения
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
                this.hostRoom(nextCode);
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

        if (this.game.ui) {
            this.game.ui.setJoinStatus(`Подключение к комнате ${code}...`, false, false);
        }

        try {
            this.peer = new Peer({
                debug: 1,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });
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
            this._handleError('Ошибка подключения: ' + (err.message || err.type));
        });

        return true;
    }

    _setupConnection() {
        if (!this.conn) return;

        this.conn.on('open', () => {
            this.isConnected = true;
            this.status = 'connected';

            if (this.game.ui) {
                if (this.isHost) {
                    this.game.ui.setHostStatus('Напарник подключился! Входим на ферму...', true);
                } else {
                    this.game.ui.setJoinStatus('Напарник найден! Входим на ферму...', true, false);
                }
                this.game.ui.setOnlineHudStatus(true, this.isHost ? 'P1 Хост (Амбар 1)' : 'P2 Гость (Амбар 2)', this.roomCode);

                setTimeout(() => {
                    if (this.game.ui && typeof this.game.ui.closeOnlineModal === 'function') {
                        this.game.ui.closeOnlineModal();
                    }
                }, 600);
            }

            if (this.isHost) {
                // Хост отправляет приветственный инициализирующий пакет
                this.sendPacket({
                    type: 'INIT_WORLD',
                    day: this.game.day,
                    tier: this.game.world ? this.game.world.tier : 0,
                    seasonIdx: this.game.world ? this.game.world.seasonIdx : 0,
                    coopMapIdx: this.game.world ? (this.game.world.coopMapIdx || 0) : 0,
                    mode: 'online_coop',
                    upgrades: this.game.save.upgrades
                });

                // Запуск онлайн-игры у Хоста
                this.game.startOnlineGame('host');
                this._startHostSyncLoop();
            } else {
                // Гость отправляет подтверждение готовности
                this.sendPacket({
                    type: 'GUEST_READY',
                    name: 'Фермерша'
                });
                this._startGuestInputLoop();
            }

            // Пинг-понг для замера задержки
            this._startPingLoop();
        });

        this.conn.on('data', (data) => {
            this._handlePacket(data);
        });

        this.conn.on('close', () => {
            this._handleDisconnect('Напарник покинул игру');
        });

        this.conn.on('error', (err) => {
            console.error('[Network] Connection error:', err);
            this._handleDisconnect('Разрыв соединения');
        });
    }

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

    _handlePacket(pkt) {
        if (!pkt || !pkt.type) return;

        switch (pkt.type) {
            case 'PING':
                this.sendPacket({ type: 'PONG', t: pkt.t });
                break;

            case 'PONG':
                this.pingMs = Math.round(performance.now() - pkt.t);
                break;

            case 'INIT_WORLD':
                if (this.isGuest) {
                    this.game.startOnlineGame('guest', pkt);
                }
                break;

            case 'GUEST_READY':
                if (this.isHost) {
                    if (this.game.ui && typeof this.game.ui.toast === 'function') {
                        this.game.ui.toast('🤝', 'Напарник в игре!', 'Фермерша заняла Амбар №2');
                    }
                }
                break;

            case 'GUEST_INPUT':
                if (this.isHost) {
                    this.game.receiveGuestInput(pkt);
                }
                break;

            case 'HOST_STATE':
                if (this.isGuest) {
                    this.game.receiveHostState(pkt);
                }
                break;

            case 'NET_EVENT':
                this.game.receiveNetEvent(pkt.event, pkt.payload);
                break;

            default:
                break;
        }
    }

    _startHostSyncLoop() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        // Синхронизация авторитетного состояния мира Хостом с частотой ~25Hz (каждые 40мс)
        this.syncInterval = setInterval(() => {
            if (!this.isConnected || !this.isHost) return;
            const snapshot = this.game.createNetworkSnapshot();
            if (snapshot) {
                this.sendPacket({
                    type: 'HOST_STATE',
                    ...snapshot
                });
            }
        }, 40);
    }

    _startGuestInputLoop() {
        if (this.inputInterval) clearInterval(this.inputInterval);
        // Передача локального положения и действий Гостя Хосту (~30Hz)
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

    _startPingLoop() {
        setInterval(() => {
            if (this.isConnected) {
                this.sendPacket({ type: 'PING', t: performance.now() });
            }
        }, 3000);
    }

    /**
     * Отправляет дискретное игровое событие (взмах, рывок, поимка, оглушение)
     */
    broadcastEvent(event, payload = {}) {
        this.sendPacket({
            type: 'NET_EVENT',
            event,
            payload
        });
    }

    _handleError(msg) {
        this.status = 'error';
        if (this.game.ui) {
            if (this.isGuest) {
                if (typeof this.game.ui.setJoinStatus === 'function') {
                    this.game.ui.setJoinStatus(msg, false, true);
                }
            } else {
                if (typeof this.game.ui.setHostStatus === 'function') {
                    this.game.ui.setHostStatus(msg, false);
                }
            }
            if (typeof this.game.ui.toast === 'function') {
                this.game.ui.toast('⚠️', 'Ошибка сети', msg);
            }
        }
    }

    _handleDisconnect(reason) {
        const wasConnected = this.isConnected;
        this.isConnected = false;
        this.status = 'idle';
        if (this.syncInterval) clearInterval(this.syncInterval);
        if (this.inputInterval) clearInterval(this.inputInterval);

        if (this.game && this.game.ui) {
            this.game.ui.setOnlineHudStatus(false);
            this.game.ui.toast('⚠️', 'Связь потеряна', reason || 'Напарник покинул игру');
        }

        if (wasConnected && this.game && typeof this.game.onOnlinePartnerDisconnected === 'function') {
            this.game.onOnlinePartnerDisconnected(reason);
        }
    }

    disconnect() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        if (this.inputInterval) clearInterval(this.inputInterval);
        this.syncInterval = null;
        this.inputInterval = null;

        if (this.conn) {
            try { this.conn.close(); } catch (e) { /* ignore */ }
            this.conn = null;
        }
        if (this.peer) {
            try { this.peer.destroy(); } catch (e) { /* ignore */ }
            this.peer = null;
        }

        this.isConnected = false;
        this.isHost = false;
        this.isGuest = false;
        this.roomCode = null;
        this.status = 'idle';
    }
}
