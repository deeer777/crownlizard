import { CONFIG } from './config.js?v=20260828-90-search-signal';

export class Music {
  constructor() {
    this.enabled = localStorage.getItem('cl:music') !== 'off';
    this.index = 0;
    this.mode = 'menu';
    this.fadeGeneration = 0;
    this.menuPlayer = new Audio(CONFIG.audio.menuTrack);
    this.gamePlayer = new Audio();
    this.menuPlayer.loop = true;
    this.menuPlayer.preload = 'metadata';
    this.gamePlayer.preload = 'none';
    this.menuPlayer.volume = CONFIG.audio.menuVolume;
    this.gamePlayer.volume = CONFIG.audio.volume;
    this.gamePlayer.addEventListener('ended', () => this.next());
  }

  play() {
    if (!this.enabled) return;
    this.activePlayer().play().catch(() => {});
  }

  activePlayer() { return this.mode === 'menu' ? this.menuPlayer : this.gamePlayer; }

  playMenu() { this.switchTo('menu'); }

  playGame() { this.switchTo('game'); }

  switchTo(mode) {
    if (!this.enabled) { this.mode = mode; return; }
    if (mode === this.mode) { this.play(); return; }
    const outgoing = this.activePlayer();
    this.mode = mode;
    const incoming = this.activePlayer();
    if (mode === 'game' && !incoming.src) incoming.src = CONFIG.audio.gameTracks[this.index];
    this.crossfade(outgoing, incoming, mode === 'menu' ? CONFIG.audio.menuVolume : CONFIG.audio.volume);
  }

  crossfade(outgoing, incoming, targetVolume) {
    const generation = ++this.fadeGeneration;
    const outgoingVolume = outgoing.volume;
    let frame = 0;
    const totalFrames = 26;
    incoming.volume = 0;
    incoming.play().catch(() => { incoming.volume = targetVolume; });
    const step = () => {
      if (generation !== this.fadeGeneration) return;
      frame += 1;
      const progress = Math.min(1, frame / totalFrames);
      outgoing.volume = outgoingVolume * (1 - progress);
      incoming.volume = targetVolume * progress;
      if (progress < 1) requestAnimationFrame(step);
      else {
        outgoing.pause();
        outgoing.volume = outgoing === this.menuPlayer ? CONFIG.audio.menuVolume : CONFIG.audio.volume;
      }
    };
    requestAnimationFrame(step);
  }

  pause() {
    this.fadeGeneration += 1;
    this.menuPlayer.pause();
    this.gamePlayer.pause();
    this.menuPlayer.volume = CONFIG.audio.menuVolume;
    this.gamePlayer.volume = CONFIG.audio.volume;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    localStorage.setItem('cl:music', this.enabled ? 'on' : 'off');
    if (this.enabled) this.play(); else this.pause();
    return this.enabled;
  }

  next() {
    this.index = (this.index + 1) % CONFIG.audio.gameTracks.length;
    this.gamePlayer.src = CONFIG.audio.gameTracks[this.index];
    if (this.mode === 'game') this.play();
  }

  toggle() {
    return this.setEnabled(!this.enabled);
  }
}

export class SoundFx {
  constructor() {
    this.enabled = localStorage.getItem('cl:sfx') !== 'off';
    this.context = null;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    localStorage.setItem('cl:sfx', this.enabled ? 'on' : 'off');
    if (this.enabled) this.play('confirm');
    return this.enabled;
  }

  toggle() { return this.setEnabled(!this.enabled); }

  play(type = 'confirm') {
    if (!this.enabled) return;
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) return;
    this.context ||= new Context();
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    const sounds = {
      confirm: [440, 660, .08, 'square', .035],
      dash: [170, 430, .09, 'square', .04],
      pickup: [520, 920, .13, 'square', .045],
      hit: [150, 65, .16, 'sawtooth', .05],
      boss: [120, 48, .32, 'square', .055],
      perk: [390, 760, .2, 'triangle', .045],
      stage: [280, 560, .18, 'square', .035],
      'vault-uncommon': [460, 720, .12, 'square', .035],
      'vault-rare': [420, 980, .24, 'triangle', .045],
      'vault-royal': [330, 1180, .34, 'square', .045],
      'vault-mythic': [190, 1380, .48, 'sawtooth', .04],
      'vault-sovereign': [220, 1680, .65, 'triangle', .055],
    };
    const [from, to, duration, wave, volume] = sounds[type] || sounds.confirm;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }
}
