const LN_10 = Math.log(10);

export const FLIGHT_PROFILES = Object.freeze({
  current: Object.freeze({
    id: 'current', shortcut: '1', name: 'A · CURRENT', feel: 'INERTIAL BASELINE',
    description: 'BUILD 105 FLIGHT · ACCELERATION + DRAG', model: 'inertia',
    acceleration: 2280, drag: 9, maxSpeed: 365, measurementSpeed: 2280 / 9, color: '#ffd36b',
  }),
  arcade: Object.freeze({
    id: 'arcade', shortcut: '2', name: 'B · ARCADE', feel: 'FAST + CONTROLLED',
    description: 'TARGET VELOCITY · QUICK BRAKE · CLEAN REVERSAL', model: 'target',
    maxSpeed: 365, accelerationT90: .12, brakingT90: .085, reversalT90: .145,
    measurementSpeed: 365, color: '#6fffd2',
  }),
  direct: Object.freeze({
    id: 'direct', shortcut: '3', name: 'C · DIRECT', feel: 'NEAR INSTANT',
    description: 'UPPER RESPONSIVENESS LIMIT · MINIMAL INERTIA', model: 'target',
    maxSpeed: 365, accelerationT90: .055, brakingT90: .045, reversalT90: .075,
    measurementSpeed: 365, color: '#62c8ff',
  }),
});

export const FLIGHT_PROFILE_ORDER = Object.freeze(['current', 'arcade', 'direct']);

const approach = (value, target, t90, dt) => {
  const alpha = 1 - Math.exp(-LN_10 * dt / Math.max(.001, t90));
  return value + (target - value) * alpha;
};

export function stepFlightMotion(velocity, movement, profile, dt, maxSpeed = profile.maxSpeed, responseScale = 1) {
  let vx = Number(velocity?.vx) || 0;
  let vy = Number(velocity?.vy) || 0;
  const inputX = Number(movement?.x) || 0;
  const inputY = Number(movement?.y) || 0;

  if (profile.model === 'inertia') {
    vx += inputX * profile.acceleration * dt;
    vy += inputY * profile.acceleration * dt;
    const drag = Math.exp(-profile.drag * dt);
    vx *= drag;
    vy *= drag;
  } else {
    const targetX = inputX * maxSpeed;
    const targetY = inputY * maxSpeed;
    const inputMagnitude = Math.hypot(inputX, inputY);
    const speed = Math.hypot(vx, vy);
    const reversing = inputMagnitude > .08 && speed > 8 && vx * targetX + vy * targetY < 0;
    const baseT90 = inputMagnitude <= .08
      ? profile.brakingT90
      : reversing ? profile.reversalT90 : profile.accelerationT90;
    const t90 = baseT90 * Math.max(.5, Math.min(1.5, responseScale));
    vx = approach(vx, targetX, t90, dt);
    vy = approach(vy, targetY, t90, dt);
  }

  const speed = Math.hypot(vx, vy);
  if (speed > maxSpeed) {
    const scale = maxSpeed / speed;
    vx *= scale;
    vy *= scale;
  }
  return { vx, vy };
}
