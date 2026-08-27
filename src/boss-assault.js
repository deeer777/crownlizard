export const ASSAULT_DURATION = 90;
export const ASSAULT_PHASE_DURATION = 30;
export const ASSAULT_BOSS_HEALTH = 7200;
export const ASSAULT_GLOBAL_HP_SNAPSHOT = 68_420_000;

export const ASSAULT_PHASES = Object.freeze([
  Object.freeze({ number: 1, key: 'core', name: 'EXPOSED CORE', role: 'FOCUS WINDOW', color: '#ff647d' }),
  Object.freeze({ number: 2, key: 'relay', name: 'CROWN RELAY', role: 'CHAIN · CROWD · DEFENCE', color: '#6fffd2' }),
  Object.freeze({ number: 3, key: 'pylon', name: 'AEGIS PYLONS', role: 'PIERCE · MULTI-TARGET', color: '#ffd36b' }),
]);

export const BOSS_BLUEPRINTS = Object.freeze({
  blaster_standard: { weaponKey: 'blaster', masteryKey: '', phase: 'balanced' },
  blaster_royal_barrage: { weaponKey: 'blaster', masteryKey: 'royalBarrage', phase: 'relay' },
  blaster_crownrail: { weaponKey: 'blaster', masteryKey: 'crownrail', phase: 'pylon' },
  spread_halo_guard: { weaponKey: 'spread', masteryKey: 'haloGuard', phase: 'relay' },
  spread_guillotine_fan: { weaponKey: 'spread', masteryKey: 'guillotineFan', phase: 'pylon' },
  pulse_singularity: { weaponKey: 'pulse', masteryKey: 'singularity', phase: 'relay' },
  pulse_comet_cores: { weaponKey: 'pulse', masteryKey: 'cometCores', phase: 'pylon' },
  laser_sovereign_lance: { weaponKey: 'laser', masteryKey: 'sovereignLance', phase: 'core' },
  laser_prism_array: { weaponKey: 'laser', masteryKey: 'prismArray', phase: 'pylon' },
  tesla_storm_web: { weaponKey: 'tesla', masteryKey: 'stormWeb', phase: 'relay' },
  tesla_thunder_anchor: { weaponKey: 'tesla', masteryKey: 'thunderAnchor', phase: 'core' },
});

const PHASE_MULTIPLIERS = Object.freeze({
  '': [1, 1, 1],
  royalBarrage: [.82, 1.34, .92],
  crownrail: [1.02, .74, 1.3],
  haloGuard: [.72, 1.28, .86],
  guillotineFan: [.96, .8, 1.28],
  singularity: [.68, 1.46, .78],
  cometCores: [.92, 1.04, 1.25],
  sovereignLance: [1.46, .58, .72],
  prismArray: [.7, 1.08, 1.42],
  stormWeb: [.6, 1.5, .78],
  thunderAnchor: [1.34, .56, .88],
});

export const assaultPhaseAt = elapsed => ASSAULT_PHASES[Math.min(2, Math.max(0, Math.floor(Math.max(0, Number(elapsed) || 0) / ASSAULT_PHASE_DURATION)))];

export const assaultDamageMultiplier = (masteryKey, phaseNumber, targetType = 'boss') => {
  const phaseIndex = Math.max(0, Math.min(2, Number(phaseNumber) - 1));
  const affinity = (PHASE_MULTIPLIERS[masteryKey] || PHASE_MULTIPLIERS[''])[phaseIndex];
  if (targetType === 'boss') return affinity * (phaseNumber === 1 ? 1 : phaseNumber === 2 ? .24 : .38);
  if (targetType === 'assaultRelay') return affinity * (phaseNumber === 2 ? 1.12 : .5);
  if (targetType === 'assaultPylon') return affinity * (phaseNumber === 3 ? 1.08 : .5);
  return affinity * (phaseNumber === 2 ? 1 : .78);
};

export const assaultDamageBudget = masteryKey => {
  const baseDps = {
    royalBarrage: 20.7, crownrail: 13.5, haloGuard: 23.5, guillotineFan: 22.7,
    singularity: 12.1, cometCores: 20.2, sovereignLance: 21.6, prismArray: 18.3,
    stormWeb: 17.2, thunderAnchor: 12.2,
  }[masteryKey] || 7;
  return (PHASE_MULTIPLIERS[masteryKey] || PHASE_MULTIPLIERS['']).map(multiplier => Math.round(baseDps * multiplier * ASSAULT_PHASE_DURATION));
};

export const assaultResult = assault => ({
  outcome: assault?.outcome || 'timeout',
  damage: Math.max(0, Math.round(Number(assault?.damage) || 0)),
  phaseDamage: Array.isArray(assault?.phaseDamage)
    ? assault.phaseDamage.slice(0, 3).map(value => Math.max(0, Math.round(Number(value) || 0)))
    : [Math.max(0, Math.round(Number(assault?.damage) || 0)), 0, 0],
  elapsed: Math.max(0, Math.min(ASSAULT_DURATION, Number(assault?.elapsed) || 0)),
  phase: Math.max(1, Math.min(3, Number(assault?.phase) || 1)),
  targetsDestroyed: Math.max(0, Math.floor(Number(assault?.targetsDestroyed) || 0)),
  blueprintId: String(assault?.blueprintId || 'blaster_standard'),
  arsenalRank: Math.max(0, Math.min(10, Math.floor(Number(assault?.arsenalRank) || 0))),
});
