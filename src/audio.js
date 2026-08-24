import { CONFIG } from './config.js?v=20260820-18';

export class Music {
  constructor() {
    this.enabled = localStorage.getItem('cl:music') !== 'off';
    this.index = 0;
    this.player = new Audio();
    this.player.volume = CONFIG.audio.volume;
    this.player.preload = 'none';
    this.player.addEventListener('ended', () => this.next());
  }

  play() {
    if (!this.enabled) return;
    if (!this.player.src) this.player.src = CONFIG.audio.tracks[this.index];
    this.player.play().catch(() => {});
  }

  pause() { this.player.pause(); }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    localStorage.setItem('cl:music', this.enabled ? 'on' : 'off');
    if (this.enabled) this.play(); else this.pause();
    return this.enabled;
  }

  next() {
    this.index = (this.index + 1) % CONFIG.audio.tracks.length;
    this.player.src = CONFIG.audio.tracks[this.index];
    this.play();
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
