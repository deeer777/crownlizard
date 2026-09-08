export class AsyncSignalLoop {
  constructor(callback, delayMs, scheduler = globalThis) {
    if (typeof callback !== 'function') throw new TypeError('AsyncSignalLoop requires a callback.');
    this.callback = callback;
    this.delayMs = Math.max(0, Number(delayMs) || 0);
    this.setTimer = scheduler.setTimeout.bind(scheduler);
    this.clearTimer = scheduler.clearTimeout.bind(scheduler);
    this.timer = null;
    this.generation = 0;
    this.started = false;
    this.paused = false;
    this.inFlight = new Set();
  }

  start({ immediate = false } = {}) {
    this.stop();
    this.started = true;
    this.paused = false;
    if (immediate) this.run(this.generation);
    else this.schedule(this.generation);
  }

  stop() {
    this.started = false;
    this.paused = false;
    this.generation += 1;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
  }

  pause() {
    if (!this.started || this.paused) return;
    this.paused = true;
    this.generation += 1;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
  }

  resume({ immediate = true } = {}) {
    if (!this.started || !this.paused) return;
    this.paused = false;
    if (immediate) this.run(this.generation);
    else this.schedule(this.generation);
  }

  trigger() {
    if (!this.started || this.paused) return;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    this.run(this.generation);
  }

  current(generation) {
    return this.started && !this.paused && generation === this.generation;
  }

  schedule(generation) {
    if (!this.current(generation) || this.timer !== null) return;
    this.timer = this.setTimer(() => {
      this.timer = null;
      this.run(generation);
    }, this.delayMs);
  }

  async run(generation) {
    if (!this.current(generation) || this.inFlight.has(generation)) return;
    this.inFlight.add(generation);
    const isCurrent = () => this.current(generation);
    try {
      await this.callback({ isCurrent });
    } finally {
      this.inFlight.delete(generation);
      this.schedule(generation);
    }
  }
}
