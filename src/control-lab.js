import { Input } from './input.js?v=20260902-106-control-lab4';
import { FLIGHT_PROFILES, FLIGHT_PROFILE_ORDER, stepFlightMotion } from './flight-control.js?v=20260905-109-adsense-verification';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const formatMs = value => Number.isFinite(value) ? `${Math.round(value)} MS` : '—';

class ControlLab {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dashButton = document.getElementById('dashButton');
    this.joystick = document.getElementById('joystick');
    this.touchPreview = new URLSearchParams(location.search).has('touch');
    this.input = new Input(canvas, this.dashButton, this.joystick, { forceTouch: this.touchPreview });
    this.profileId = localStorage.getItem('cl:control-lab-profile') || 'arcade';
    if (!FLIGHT_PROFILES[this.profileId]) this.profileId = 'arcade';
    this.player = { x: innerWidth / 2, y: innerHeight * .68, vx: 0, vy: 0, radius: 18 };
    this.trail = [];
    this.previous = performance.now();
    this.accumulator = 0;
    this.step = 1 / 120;
    this.measure = { acceleration: NaN, braking: NaN, reversal: NaN };
    this.sample = { phase: 'idle', startedAt: 0, peakSpeed: 0, priorIntentX: 0, priorIntentY: 0, reversalX: 0, reversalY: 0 };
    this.sprite = new Image();
    this.sprite.decoding = 'async';
    this.sprite.src = new URL('../assets/runtime/sprites/crown-lizard-player-v1.png', import.meta.url).href;
    this.frame = this.frame.bind(this);
    this.resize = this.resize.bind(this);
    this.buildUi();
    this.bind();
    this.resize();
    this.reset();
    requestAnimationFrame(this.frame);
  }

  get profile() { return FLIGHT_PROFILES[this.profileId]; }

  buildUi() {
    document.body.classList.add('control-lab-active');
    document.body.classList.toggle('control-lab-touch', this.touchPreview);
    document.body.insertAdjacentHTML('beforeend', `
      <main id="controlLab" class="control-lab" style="--control-accent:${this.profile.color}">
        <header class="control-lab-header">
          <div><small>BUILD 106 · INTERNAL TEST</small><h1>CONTROL LAB</h1></div>
          <button type="button" data-control-exit><i>♛</i> BACK TO MENU</button>
        </header>
        <section class="control-profile-selector" aria-label="Flight model">
          ${FLIGHT_PROFILE_ORDER.map(id => {
            const profile = FLIGHT_PROFILES[id];
            return `<button type="button" data-control-profile="${id}"><small>${profile.shortcut}</small><strong>${profile.name}</strong><span>${profile.feel}</span></button>`;
          }).join('')}
        </section>
        <section class="control-readout" aria-live="polite">
          <div><small>INPUT</small><strong data-control-input>0%</strong></div>
          <div><small>SPEED</small><strong data-control-speed>000</strong></div>
          <div><small>0 → 90%</small><strong data-control-accel>—</strong></div>
          <div><small>RELEASE</small><strong data-control-brake>—</strong></div>
          <div><small>REVERSAL</small><strong data-control-reverse>—</strong></div>
        </section>
        <div class="control-profile-copy"><strong data-control-name></strong><span data-control-copy></span></div>
        <div class="control-course-label"><span>PRECISION COURSE</span><small>PASS BETWEEN THE GATES · RELEASE INSIDE THE STOP BOX</small></div>
        <footer class="control-lab-footer">
          <span class="control-touch-hint">DRAG ANYWHERE TO STEER</span>
          <span class="control-key-hint">WASD / ARROWS · 1 2 3 SELECT · R RESET</span>
          <button type="button" data-control-reset><i>↻</i> RESET TEST</button>
        </footer>
      </main>
    `);
    this.ui = document.getElementById('controlLab');
    this.readout = {
      input: this.ui.querySelector('[data-control-input]'),
      speed: this.ui.querySelector('[data-control-speed]'),
      acceleration: this.ui.querySelector('[data-control-accel]'),
      braking: this.ui.querySelector('[data-control-brake]'),
      reversal: this.ui.querySelector('[data-control-reverse]'),
      name: this.ui.querySelector('[data-control-name]'),
      copy: this.ui.querySelector('[data-control-copy]'),
    };
    this.selectProfile(this.profileId, false);
  }

  bind() {
    addEventListener('resize', this.resize);
    this.ui.querySelectorAll('[data-control-profile]').forEach(button => {
      button.addEventListener('click', () => this.selectProfile(button.dataset.controlProfile));
    });
    this.ui.querySelector('[data-control-reset]').addEventListener('click', () => this.reset());
    this.ui.querySelector('[data-control-exit]').addEventListener('click', () => {
      const url = new URL(location.href);
      url.searchParams.delete('controls');
      url.searchParams.delete('touch');
      url.searchParams.delete('debug');
      location.href = `${url.pathname}${url.search}${url.hash}`;
    });
    addEventListener('keydown', event => {
      const profileId = FLIGHT_PROFILE_ORDER[Number(event.key) - 1];
      if (profileId) this.selectProfile(profileId);
      if (event.code === 'KeyR') this.reset();
      if (event.code === 'Escape') this.ui.querySelector('[data-control-exit]').click();
    });
  }

  selectProfile(id, shouldReset = true) {
    if (!FLIGHT_PROFILES[id]) return;
    this.profileId = id;
    localStorage.setItem('cl:control-lab-profile', id);
    this.ui?.style.setProperty('--control-accent', this.profile.color);
    this.ui?.querySelectorAll('[data-control-profile]').forEach(button => {
      const active = button.dataset.controlProfile === id;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (this.readout) {
      this.readout.name.textContent = this.profile.name;
      this.readout.copy.textContent = this.profile.description;
    }
    if (shouldReset) this.reset();
  }

  resize() {
    this.width = innerWidth;
    this.height = innerHeight;
    this.dpr = Math.min(2, Math.max(1, devicePixelRatio || 1));
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.player.x = clamp(this.player.x, 28, this.width - 28);
    this.player.y = clamp(this.player.y, 128, this.height - 78);
  }

  reset() {
    this.input.clear();
    this.player.x = this.width / 2;
    this.player.y = Math.max(220, this.height * .68);
    this.player.vx = 0;
    this.player.vy = 0;
    this.trail = [];
    this.measure = { acceleration: NaN, braking: NaN, reversal: NaN };
    this.sample = { phase: 'idle', startedAt: 0, peakSpeed: 0, priorIntentX: 0, priorIntentY: 0, reversalX: 0, reversalY: 0 };
    this.renderReadout({ x: 0, y: 0 });
  }

  trackMeasurements(movement, speed, now) {
    const magnitude = Math.hypot(movement.x, movement.y);
    const previousMagnitude = Math.hypot(this.sample.priorIntentX, this.sample.priorIntentY);
    const target90 = this.profile.measurementSpeed * .9;

    if (magnitude > .8 && previousMagnitude <= .8) {
      this.sample.phase = 'accelerating';
      this.sample.startedAt = now;
    }
    if (this.sample.phase === 'accelerating' && speed >= target90) {
      this.measure.acceleration = now - this.sample.startedAt;
      this.sample.phase = 'steady';
    }

    if (magnitude < .08 && previousMagnitude > .35 && speed > 35) {
      this.sample.phase = 'braking';
      this.sample.startedAt = now;
      this.sample.peakSpeed = speed;
    }
    if (this.sample.phase === 'braking' && speed <= Math.max(5, this.sample.peakSpeed * .1)) {
      this.measure.braking = now - this.sample.startedAt;
      this.sample.phase = 'idle';
    }

    const intentDot = movement.x * this.sample.priorIntentX + movement.y * this.sample.priorIntentY;
    if (magnitude > .8 && previousMagnitude > .8 && intentDot < -.55 && speed > 35) {
      this.sample.phase = 'reversing';
      this.sample.startedAt = now;
      this.sample.reversalX = movement.x;
      this.sample.reversalY = movement.y;
    }
    if (this.sample.phase === 'reversing') {
      const alongNewDirection = this.player.vx * this.sample.reversalX + this.player.vy * this.sample.reversalY;
      if (alongNewDirection >= target90) {
        this.measure.reversal = now - this.sample.startedAt;
        this.sample.phase = 'steady';
      }
    }

    this.sample.priorIntentX = movement.x;
    this.sample.priorIntentY = movement.y;
  }

  update(dt, now) {
    const movement = this.input.movement(this.player);
    const velocity = stepFlightMotion(this.player, movement, this.profile, dt);
    this.player.vx = velocity.vx;
    this.player.vy = velocity.vy;
    this.player.x = clamp(this.player.x + this.player.vx * dt, 25, this.width - 25);
    this.player.y = clamp(this.player.y + this.player.vy * dt, 126, this.height - 72);
    const speed = Math.hypot(this.player.vx, this.player.vy);
    this.trackMeasurements(movement, speed, now);
    if (speed > 18 && Math.floor(now / 35) !== Math.floor((now - dt * 1000) / 35)) {
      this.trail.push({ x: this.player.x, y: this.player.y + 25, life: .42 });
    }
    this.trail.forEach(point => { point.life -= dt; });
    this.trail = this.trail.filter(point => point.life > 0);
    this.renderReadout(movement);
  }

  renderReadout(movement) {
    if (!this.readout) return;
    this.readout.input.textContent = `${Math.round(Math.hypot(movement.x, movement.y) * 100)}%`;
    this.readout.speed.textContent = String(Math.round(Math.hypot(this.player.vx, this.player.vy))).padStart(3, '0');
    this.readout.acceleration.textContent = formatMs(this.measure.acceleration);
    this.readout.braking.textContent = formatMs(this.measure.braking);
    this.readout.reversal.textContent = formatMs(this.measure.reversal);
  }

  drawCourse(ctx) {
    ctx.fillStyle = '#03090d';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.strokeStyle = 'rgba(91, 213, 181, .08)';
    ctx.lineWidth = 1;
    const grid = 48;
    for (let x = (this.width % grid) / 2; x < this.width; x += grid) { ctx.beginPath(); ctx.moveTo(x, 112); ctx.lineTo(x, this.height); ctx.stroke(); }
    for (let y = 112; y < this.height; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.width, y); ctx.stroke(); }

    const courseWidth = Math.min(440, this.width - 48);
    const left = (this.width - courseWidth) / 2;
    const right = left + courseWidth;
    const gateYs = [this.height * .3, this.height * .48, this.height * .66];
    ctx.lineWidth = 3;
    gateYs.forEach((y, index) => {
      const center = index % 2 ? right - courseWidth * .28 : left + courseWidth * .28;
      ctx.strokeStyle = index === 1 ? '#ffd36b' : '#6fffd2';
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(center - 52, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(center + 52, y); ctx.lineTo(right, y); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillRect(center - 55, y - 6, 6, 12);
      ctx.fillRect(center + 49, y - 6, 6, 12);
    });

    const boxY = this.height - 118;
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = this.profile.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(this.width / 2 - 62, boxY - 28, 124, 56);
    ctx.setLineDash([]);
    ctx.fillStyle = this.profile.color;
    ctx.globalAlpha = .08;
    ctx.fillRect(this.width / 2 - 62, boxY - 28, 124, 56);
    ctx.globalAlpha = 1;
  }

  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawCourse(ctx);
    this.trail.forEach(point => {
      ctx.globalAlpha = point.life / .42 * .28;
      ctx.fillStyle = this.profile.color;
      ctx.fillRect(Math.round(point.x - 4), Math.round(point.y - 4), 8, 8);
    });
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(Math.round(this.player.x), Math.round(this.player.y));
    const lean = clamp(this.player.vx / this.profile.maxSpeed, -1, 1) * .08;
    ctx.rotate(lean);
    ctx.imageSmoothingEnabled = false;
    if (this.sprite.complete && this.sprite.naturalWidth) ctx.drawImage(this.sprite, -34, -36, 68, 72);
    else { ctx.fillStyle = this.profile.color; ctx.fillRect(-12, -16, 24, 32); }
    ctx.restore();
  }

  frame(now) {
    const elapsed = Math.min(.1, (now - this.previous) / 1000);
    this.previous = now;
    this.accumulator += elapsed;
    let updates = 0;
    while (this.accumulator >= this.step && updates < 12) {
      this.update(this.step, now - this.accumulator * 1000);
      this.accumulator -= this.step;
      updates += 1;
    }
    if (updates === 12) this.accumulator = 0;
    this.render();
    requestAnimationFrame(this.frame);
  }
}

new ControlLab(document.getElementById('game'));
