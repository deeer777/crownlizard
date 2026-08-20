export class Engine {
  constructor({ update, render, step = 1 / 60 }) {
    this.update = update;
    this.render = render;
    this.step = step;
    this.running = false;
    this.accumulator = 0;
    this.previous = 0;
    this.frame = this.frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.previous = performance.now();
    requestAnimationFrame(this.frame);
  }

  stop() { this.running = false; }

  frame(now) {
    if (!this.running) return;
    const elapsed = Math.min(.1, (now - this.previous) / 1000);
    this.previous = now;
    this.accumulator += elapsed;

    let updates = 0;
    while (this.accumulator >= this.step && updates < 6) {
      this.update(this.step);
      this.accumulator -= this.step;
      updates += 1;
    }

    if (updates === 6) this.accumulator = 0;
    this.render(this.accumulator / this.step);
    requestAnimationFrame(this.frame);
  }
}
