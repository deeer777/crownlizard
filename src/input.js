export class Input {
  constructor(canvas, dashButton, joystick) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pointer = { active: false, id: null, x: 0, y: 0, originX: 0, originY: 0, type: 'mouse' };
    this.joystick = joystick;
    this.dashQueued = false;

    const gameplayKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'ShiftLeft', 'ShiftRight']);
    const editableTarget = target => Boolean(target?.matches?.('input, textarea, select, [contenteditable="true"]'));
    const resetPointer = () => {
      this.pointer.active = false;
      this.pointer.id = null;
      joystick.classList.add('hidden');
      joystick.style.setProperty('--stick-x', '0px');
      joystick.style.setProperty('--stick-y', '0px');
    };
    const clearHeldInput = () => {
      this.keys.clear();
      resetPointer();
      this.dashQueued = false;
    };

    addEventListener('keydown', event => {
      if (editableTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (gameplayKeys.has(event.code)) event.preventDefault();
      this.keys.add(event.code);
      if (event.code === 'Space' || event.code.startsWith('Shift')) {
        this.dashQueued = true;
      }
    });
    addEventListener('keyup', event => {
      if (gameplayKeys.has(event.code) && !editableTarget(event.target)) event.preventDefault();
      this.keys.delete(event.code);
    });
    addEventListener('blur', clearHeldInput);
    addEventListener('pagehide', clearHeldInput);
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') clearHeldInput();
    });

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
      if (this.pointer.active && event.pointerId !== this.pointer.id) return;
      this.pointer.active = true;
      this.pointer.id = event.pointerId;
      this.pointer.type = event.pointerType || 'mouse';
      const rect = canvas.getBoundingClientRect();
      this.pointer.originX = event.clientX - rect.left;
      this.pointer.originY = event.clientY - rect.top;
      point(event);
      if (this.pointer.type !== 'mouse') {
        const visualRadius = 56;
        const edgePadding = 8;
        const hudFloor = 126;
        const visualX = Math.max(visualRadius + edgePadding, Math.min(innerWidth - visualRadius - edgePadding, event.clientX));
        const visualY = Math.max(hudFloor, Math.min(innerHeight - visualRadius - edgePadding, event.clientY));
        joystick.style.left = `${visualX}px`;
        joystick.style.top = `${visualY}px`;
        joystick.classList.remove('hidden');
      }
      canvas.setPointerCapture?.(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      if (this.pointer.active && event.pointerId === this.pointer.id) point(event);
    });
    canvas.addEventListener('pointerup', event => {
      if (event.pointerId !== this.pointer.id) return;
      resetPointer();
      canvas.releasePointerCapture?.(event.pointerId);
    });
    canvas.addEventListener('pointercancel', event => {
      if (event.pointerId === this.pointer.id) resetPointer();
    });
    canvas.addEventListener('lostpointercapture', event => {
      if (event.pointerId === this.pointer.id) resetPointer();
    });
    dashButton.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      this.dashQueued = true;
      dashButton.classList.add('pressed');
    });
    const releaseDash = () => dashButton.classList.remove('pressed');
    dashButton.addEventListener('pointerup', releaseDash);
    dashButton.addEventListener('pointercancel', releaseDash);
    dashButton.addEventListener('pointerleave', releaseDash);
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
      const deadZone = this.pointer.type === 'mouse' ? 10 : 6;
      if (distance > deadZone) {
        const normalized = Math.min(1, (distance - deadZone) / 36);
        const strength = this.pointer.type === 'mouse' ? 1 : normalized ** .72;
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
    this.pointer.id = null;
    this.dashQueued = false;
    this.joystick.classList.add('hidden');
    this.joystick.style.setProperty('--stick-x', '0px');
    this.joystick.style.setProperty('--stick-y', '0px');
  }
}
