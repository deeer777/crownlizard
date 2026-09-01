import assert from 'node:assert/strict';

const listeners = new Map();
globalThis.addEventListener = (type, listener) => {
  if (!listeners.has(type)) listeners.set(type, []);
  listeners.get(type).push(listener);
};
const emit = (type, event = {}) => listeners.get(type)?.forEach(listener => listener(event));

const { Input } = await import('../src/input.js');
const element = () => ({
  classList: { add() {}, remove() {} },
  style: { setProperty() {} },
  addEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0 }),
});
const input = new Input(element(), element(), element());

let prevented = 0;
const movementEvent = { code: 'ArrowLeft', target: { matches: () => false }, preventDefault: () => { prevented += 1; } };
emit('keydown', movementEvent);
assert.equal(prevented, 1, 'arrow movement prevents simultaneous browser scrolling');
assert.deepEqual(input.movement({ x: 0, y: 0 }), { x: -1, y: 0 }, 'a held arrow moves exactly once in its intended direction');
emit('keyup', movementEvent);
assert.equal(prevented, 2, 'arrow release also suppresses browser navigation behavior');
assert.deepEqual(input.movement({ x: 0, y: 0 }), { x: 0, y: 0 }, 'arrow release cannot leave movement latched');

emit('keydown', { code: 'ArrowUp', target: { matches: () => false }, preventDefault() {} });
emit('blur');
assert.deepEqual(input.movement({ x: 0, y: 0 }), { x: 0, y: 0 }, 'focus loss clears every held movement key');

let editablePrevented = false;
emit('keydown', { code: 'ArrowRight', target: { matches: () => true }, preventDefault: () => { editablePrevented = true; } });
assert.equal(editablePrevented, false, 'text fields retain native caret controls');
assert.deepEqual(input.movement({ x: 0, y: 0 }), { x: 0, y: 0 }, 'typing inside an editable field never steers the ship');

const interactiveElement = () => {
  const elementListeners = new Map();
  return {
    listeners: elementListeners,
    classList: { add() {}, remove() {} },
    style: { setProperty() {} },
    addEventListener(type, listener) { elementListeners.set(type, listener); },
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setPointerCapture() {},
    releasePointerCapture() {},
  };
};
const touchCanvas = interactiveElement();
const touchInput = new Input(touchCanvas, interactiveElement(), interactiveElement());
const touchEvent = (pointerId, x, y) => ({ pointerId, pointerType: 'touch', clientX: x, clientY: y });
globalThis.innerWidth = 390;
globalThis.innerHeight = 844;
touchCanvas.listeners.get('pointerdown')(touchEvent(1, 100, 200));
touchCanvas.listeners.get('pointermove')(touchEvent(1, 126, 200));
const preciseMovement = touchInput.movement({ x: 0, y: 0 });
assert.ok(preciseMovement.x > .4 && preciseMovement.x < .5, 'the touch curve preserves precise mid-stick steering');

touchCanvas.listeners.get('pointerdown')(touchEvent(2, 300, 500));
touchCanvas.listeners.get('pointermove')(touchEvent(2, 300, 550));
assert.deepEqual(touchInput.movement({ x: 0, y: 0 }), preciseMovement, 'a second finger cannot hijack the active movement pointer');
touchCanvas.listeners.get('pointerup')(touchEvent(2, 300, 550));
assert.deepEqual(touchInput.movement({ x: 0, y: 0 }), preciseMovement, 'releasing an unrelated finger cannot cancel steering');
touchCanvas.listeners.get('lostpointercapture')(touchEvent(1, 126, 200));
assert.deepEqual(touchInput.movement({ x: 0, y: 0 }), { x: 0, y: 0 }, 'lost pointer capture always releases mobile steering');

console.log('Keyboard and focus-release input tests passed');
