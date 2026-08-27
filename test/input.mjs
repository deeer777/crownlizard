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

console.log('Keyboard and focus-release input tests passed');
