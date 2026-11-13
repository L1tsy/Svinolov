'use strict';

/**
 * Процедурный звук и музыка на Web Audio API — без единого аудиофайла
 */
class Sfx {
    constructor(settings = {}) {
        this.ctx = null;
        this.muted = !!settings.muted;
        this.musicOn = settings.music !== false;
        this.musicTimer = null;
        this.step = 0;
        this.nextTime = 0;
        this.tempoMul = 1;
    }

    init() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return;
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try {
            this.ctx = new AC();
            this.master = this.ctx.createGain();
            this.master.gain.value = this.muted ? 0 : 0.85;
            this.master.connect(this.ctx.destination);
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = this.musicOn ? 0.5 : 0;
            this.musicGain.connect(this.master);

            const len = this.ctx.sampleRate;
            this.noiseBuf = this.ctx.createBuffer(1, len, len);
            const d = this.noiseBuf.getChannelData(0);
            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

            this.startMusic();
        } catch (e) {
            this.ctx = null;
        }
    }

    setMuted(m) {
        this.muted = m;
        if (this.master) this.master.gain.value = m ? 0 : 0.85;
    }

    setMusic(on) {
        this.musicOn = on;
        if (this.musicGain) this.musicGain.gain.value = on ? 0.5 : 0;
    }

    tone(freq, dur, o = {}) {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime + (o.delay || 0);
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = o.type || 'sine';
        osc.frequency.setValueAtTime(freq, t);
        if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
        const vol = o.vol === undefined ? 0.18 : o.vol;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + (o.attack || 0.006));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g);
        g.connect(o.dest || this.master);
        osc.start(t);
        osc.stop(t + dur + 0.03);
    }

    noise(dur, o = {}) {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime + (o.delay || 0);
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const f = this.ctx.createBiquadFilter();
        f.type = o.type || 'bandpass';
        f.frequency.setValueAtTime(o.freq || 1200, t);
        if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
        f.Q.value = o.q || 1;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(o.vol === undefined ? 0.2 : o.vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(this.master);
        src.start(t, Math.random() * 0.5);
        src.stop(t + dur + 0.03);
    }

    /* ---------- Игровые звуки ---------- */
    swing() { this.noise(0.16, { freq: 700, to: 2800, q: 1.2, vol: 0.2 }); }

    catch(combo = 1) {
        const k = Math.pow(2, Math.min(combo - 1, 14) / 12);
        this.tone(320, 0.09, { to: 760, vol: 0.2, type: 'sine' });
        this.tone(880 * k, 0.12, { type: 'square', vol: 0.07, delay: 0.03 });
        this.tone(1320 * k, 0.22, { type: 'square', vol: 0.07, delay: 0.09 });
        this.tone(1320 * k, 0.3, { type: 'sine', vol: 0.12, delay: 0.09 });
    }

    multi(n) {
        for (let i = 0; i < Math.min(n, 5); i++) {
            this.tone(660 * Math.pow(1.26, i), 0.16, { type: 'triangle', vol: 0.16, delay: 0.1 + i * 0.07 });
        }
    }

    oink() {
        const f = U.rand(190, 260);
        this.tone(f, 0.09, { type: 'sawtooth', to: f * 0.7, vol: 0.06 });
        this.tone(f * 1.05, 0.1, { type: 'sawtooth', to: f * 0.65, vol: 0.06, delay: 0.11 });
    }

    squeal() {
        const f = U.rand(620, 820);
        this.tone(f, 0.22, { type: 'sawtooth', to: f * 1.5, vol: 0.05 });
        this.tone(f * 1.5, 0.14, { type: 'sawtooth', to: f * 0.9, vol: 0.04, delay: 0.2 });
    }

    dash() { this.noise(0.22, { freq: 3200, to: 500, q: 0.8, vol: 0.22 }); }

    powerup() {
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, { type: 'triangle', vol: 0.16, delay: i * 0.055 }));
    }

    gold() {
        [1568, 2093, 2637, 3136].forEach((f, i) => this.tone(f, 0.25, { type: 'sine', vol: 0.09, delay: i * 0.07 }));
    }

    hit() {
        this.tone(170, 0.2, { to: 55, vol: 0.32, type: 'sine' });
        this.noise(0.12, { freq: 900, q: 0.7, vol: 0.2 });
    }

    stun() {
        this.tone(420, 0.4, { to: 110, type: 'square', vol: 0.12 });
        this.noise(0.2, { freq: 400, q: 0.6, vol: 0.25 });
    }

    roar() {
        this.tone(95, 0.7, { to: 55, type: 'sawtooth', vol: 0.22 });
        this.tone(142, 0.7, { to: 70, type: 'sawtooth', vol: 0.12 });
        this.noise(0.6, { freq: 300, q: 0.5, vol: 0.14 });
    }

    warn() {
        this.tone(660, 0.1, { type: 'square', vol: 0.08 });
        this.tone(660, 0.1, { type: 'square', vol: 0.08, delay: 0.16 });
    }

    poof() { this.noise(0.3, { type: 'lowpass', freq: 1500, to: 200, vol: 0.3 }); }

    bark() {
        this.tone(380, 0.07, { type: 'sawtooth', to: 230, vol: 0.09 });
        this.tone(420, 0.09, { type: 'sawtooth', to: 220, vol: 0.09, delay: 0.12 });
    }

    splat() { this.noise(0.14, { type: 'lowpass', freq: 500, vol: 0.2 }); }

    tick() { this.tone(1000, 0.05, { type: 'square', vol: 0.07 }); }

    coin() { this.tone(1760, 0.07, { type: 'sine', vol: 0.05 }); }

    click() { this.tone(520, 0.05, { type: 'triangle', vol: 0.1 }); }

    buy() {
        this.tone(988, 0.09, { type: 'square', vol: 0.08 });
        this.tone(1319, 0.3, { type: 'square', vol: 0.08, delay: 0.08 });
        this.tone(1319, 0.4, { type: 'sine', vol: 0.12, delay: 0.08 });
    }

    error() { this.tone(160, 0.16, { type: 'sawtooth', vol: 0.09 }); }

    comboBreak() { this.tone(330, 0.22, { to: 150, type: 'triangle', vol: 0.1 }); }

    star(i) { this.tone([784, 988, 1319][i] || 784, 0.3, { type: 'triangle', vol: 0.2 }); }

    win() {
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
            this.tone(f, i === 5 ? 0.5 : 0.14, { type: 'triangle', vol: 0.18, delay: i * 0.11 }));
    }

    fail() {
        [392, 370, 349, 262].forEach((f, i) =>
            this.tone(f, i === 3 ? 0.6 : 0.22, { type: 'sawtooth', vol: 0.09, delay: i * 0.22 }));
    }

    achievement() {
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', vol: 0.15, delay: i * 0.08 }));
    }

    /* ---------- Музыка: бодрый деревенский луп ---------- */
    startMusic() {
        if (!this.ctx || this.musicTimer) return;
        const N = {
            C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
            C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
            C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77, C6: 1046.5, D6: 1174.66
        };
        const chords = [
            ['C3', 'G3', ['E4', 'G4']], ['F3', 'C3', ['F4', 'A4']], ['G3', 'D3', ['G4', 'B4']], ['C3', 'G3', ['E4', 'G4']],
            ['A3', 'E3', ['E4', 'A4']], ['F3', 'C3', ['F4', 'A4']], ['G3', 'D3', ['G4', 'B4']], ['C3', 'G3', ['E4', 'G4']]
        ];
        const melody = [
            'E5', 'G5', 0, 'E5', 'G5', 'A5', 'G5', 0,
            'F5', 'A5', 0, 'F5', 'A5', 'C6', 'A5', 0,
            'G5', 'B5', 0, 'G5', 'D6', 'B5', 'G5', 0,
            'E5', 'G5', 'C6', 'G5', 'E5', 0, 'C5', 0,
            'A5', 'C6', 0, 'A5', 'E5', 0, 'A5', 0,
            'F5', 'A5', 'C6', 'A5', 'F5', 0, 'A5', 0,
            'G5', 0, 'B5', 0, 'D6', 'B5', 'G5', 'D5',
            'C5', 'E5', 'G5', 'C6', 0, 0, 0, 0
        ];
        this.nextTime = this.ctx.currentTime + 0.1;
        this.step = 0;

        const schedule = () => {
            if (!this.ctx) return;
            if (this.ctx.state !== 'running') { this.nextTime = this.ctx.currentTime + 0.1; return; }
            if (this.nextTime < this.ctx.currentTime - 0.3) this.nextTime = this.ctx.currentTime + 0.05;
            while (this.nextTime < this.ctx.currentTime + 0.25) {
                const eighth = 60 / (124 * this.tempoMul) / 2;
                if (this.musicOn && !this.muted) {
                    const s = this.step % 64;
                    const bar = Math.floor(s / 8);
                    const pos = s % 8;
                    const ch = chords[bar];
                    const delay = this.nextTime - this.ctx.currentTime;
                    const dest = this.musicGain;
                    if (pos === 0) this.tone(N[ch[0]], eighth * 1.6, { type: 'triangle', vol: 0.2, delay, dest });
                    if (pos === 4) this.tone(N[ch[1]], eighth * 1.6, { type: 'triangle', vol: 0.17, delay, dest });
                    if (pos === 2 || pos === 6) {
                        for (const n of ch[2]) this.tone(N[n], eighth * 0.7, { type: 'triangle', vol: 0.055, delay, dest });
                    }
                    const m = melody[s];
                    if (m) {
                        this.tone(N[m], eighth * 0.9, { type: 'square', vol: 0.03, delay, dest });
                        this.tone(N[m], eighth * 1.2, { type: 'sine', vol: 0.05, delay, dest });
                    }
                }
                this.nextTime += eighth;
                this.step++;
            }
        };
        this.musicTimer = setInterval(schedule, 60);
    }
}
