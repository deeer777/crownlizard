export class Input {
  constructor(canvas, dashButton, joystick) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pointer = { active: false, x: 0, y: 0, originX: 0, originY: 0, type: 'mouse' };
    this.joystick = joystick;
    this.dashQueued = false;

    addEventListener('keydown', event => {
      this.keys.add(event.code);
      if (event.code === 'Space' || event.code.startsWith('Shift')) {
        event.preventDefault();
        this.dashQueued = true;
      }
    });
    addEventListener('keyup', event => this.keys.delete(event.code));
    addEventListener('blur', () => { this.keys.clear(); this.pointer.active = false; });

    const point = event => {
      const rect = canvas.getBoundingClientRect();
      this.pointer.x = event.clientX - rect.left;
      this.pointer.y = event.clientY - rect.top;
      if (this.pointer.type !== 'mouse') {
        const dx = this.pointer.x - this.pointer.originX;
        const dy = this.pointer.y - this.pointer.originY;
        const length = Math.hypot(dx, dy) || 1;
        const scale = Math.min(1, 42 / length);
        joystick.style.setProperty('--stick-x', `${dx * scale}px`);
        joystick.style.setProperty('--stick-y', `${dy * scale}px`);
      }
    };
    canvas.addEventListener('pointerdown', event => {
      this.pointer.active = true;
      this.pointer.type = event.pointerType || 'mouse';
      const rect = canvas.getBoundingClientRect();
      this.pointer.originX = event.clientX - rect.left;
      this.pointer.originY = event.clientY - rect.top;
      point(event);
      if (this.pointer.type !== 'mouse') {
        joystick.style.left = `${event.clientX}px`;
        joystick.style.top = `${event.clientY}px`;
        joystick.classList.remove('hidden');
      }
      canvas.setPointerCapture?.(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => { if (this.pointer.active) point(event); });
    canvas.addEventListener('pointerup', event => {
      this.pointer.active = false;
      joystick.classList.add('hidden');
      joystick.style.setProperty('--stick-x', '0px');
      joystick.style.setProperty('--stick-y', '0px');
      canvas.releasePointerCapture?.(event.pointerId);
    });
    canvas.addEventListener('pointercancel', () => { this.pointer.active = false; joystick.classList.add('hidden'); });
    dashButton.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      this.dashQueued = true;
    });
  }

  movement(player) {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (this.pointer.active) {
      const dx = this.pointer.type === 'mouse' ? this.pointer.x - player.x : this.pointer.x - this.pointer.originX;
      const dy = this.pointer.type === 'mouse' ? this.pointer.y - player.y : this.pointer.y - this.pointer.originY;
      const distance = Math.hypot(dx, dy);
      const deadZone = this.pointer.type === 'mouse' ? 10 : 7;
      if (distance > deadZone) {
        const strength = this.pointer.type === 'mouse' ? 1 : Math.min(1, (distance - deadZone) / 38);
        x = dx / distance * strength;
        y = dy / distance * strength;
      }
    }
    const length = Math.hypot(x, y);
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
  }

  consumeDash() {
    const queued = this.dashQueued;
    this.dashQueued = false;
    return queued;
  }

  clear() {
    this.keys.clear();
    this.pointer.active = false;
    this.dashQueued = false;
    this.joystick.classList.add('hidden');
    this.joystick.style.setProperty('--stick-x', '0px');
    this.joystick.style.setProperty('--stick-y', '0px');
  }
}
