const RANK_THRESHOLDS = Object.freeze([0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000]);

const PREVIEW_BLUEPRINTS = Object.freeze([
  { id: 'blaster_standard', weaponKey: 'blaster', name: 'STANDARD BLASTER', role: 'RELIABLE ALL-ROUNDER', description: 'Royal issue armament. Stable, precise and always available.', sortOrder: 0, access: 'standard' },
  { id: 'blaster_royal_barrage', weaponKey: 'blaster', name: 'ROYAL BARRAGE', role: 'CROWD CONTROL', description: 'Four rapid rounds sweep lanes and ricochet through the swarm.', sortOrder: 10, access: 'unlocked' },
  { id: 'blaster_crownrail', weaponKey: 'blaster', name: 'CROWNRAIL', role: 'ELITE BREAKER', description: 'One colossal round punches through armor and entire enemy lines.', sortOrder: 20, access: 'locked' },
  { id: 'spread_halo_guard', weaponKey: 'spread', name: 'HALO GUARD', role: 'FULL DEFENCE', description: 'Twin seven-shot fans guard both the bow and stern.', sortOrder: 30, access: 'locked' },
  { id: 'spread_guillotine_fan', weaponKey: 'spread', name: 'GUILLOTINE FAN', role: 'FORWARD BURST', description: 'A tight five-shot fan cuts deeply through targets ahead.', sortOrder: 40, access: 'locked' },
  { id: 'pulse_singularity', weaponKey: 'pulse', name: 'SINGULARITY', role: 'AREA DAMAGE', description: 'A slow royal core detonates into a screen-clearing gravity blast.', sortOrder: 50, access: 'trial' },
  { id: 'pulse_comet_cores', weaponKey: 'pulse', name: 'COMET CORES', role: 'BOSS PRESSURE', description: 'Three compact cores strike often and rebound between targets.', sortOrder: 60, access: 'locked' },
  { id: 'laser_sovereign_lance', weaponKey: 'laser', name: 'SOVEREIGN LANCE', role: 'FOCUS DAMAGE', description: 'One precise beam gains damage while locked to the same target.', sortOrder: 70, access: 'locked' },
  { id: 'laser_prism_array', weaponKey: 'laser', name: 'PRISM ARRAY', role: 'MULTI TARGET', description: 'Three lighter beams refract once toward nearby enemies.', sortOrder: 80, access: 'locked' },
  { id: 'tesla_storm_web', weaponKey: 'tesla', name: 'STORM WEB', role: 'CHAIN CONTROL', description: 'Twin arcs branch across a vast web of nearby enemies.', sortOrder: 90, access: 'locked' },
  { id: 'tesla_thunder_anchor', weaponKey: 'tesla', name: 'THUNDER ANCHOR', role: 'WARDEN HUNTER', description: 'One brutal arc deals extra damage to elites and Wardens.', sortOrder: 100, access: 'locked' },
]);

export const weaponMountUrl = weaponKey => `./assets/weapons/${String(weaponKey || 'blaster')}-mount-v1.png`;

export const armoryRankProgress = progression => {
  const rank = Math.max(0, Math.min(10, Math.floor(Number(progression?.rank) || 0)));
  const xp = Math.max(0, Math.floor(Number(progression?.xp) || 0));
  const floor = RANK_THRESHOLDS[rank];
  const ceiling = rank < 10 ? RANK_THRESHOLDS[rank + 1] : floor;
  const percent = rank >= 10 ? 100 : Math.max(0, Math.min(100, ((xp - floor) / (ceiling - floor)) * 100));
  return { rank, xp, floor, ceiling, percent, remaining: Math.max(0, ceiling - xp) };
};

export const armoryAccessLabel = access => ({
  standard: 'STANDARD', unlocked: 'OWNED', trial: 'WEEKLY TRIAL', locked: 'LOCKED',
}[access] || 'LOCKED');

export const previewArmory = (now = Date.now()) => {
  const week = 7 * 86_400_000;
  const startsAt = Math.floor(now / week) * week;
  return {
    progression: { xp: 450, rank: 3, damageBonus: .06, nextRankXp: 700, selectedBlueprintId: 'blaster_standard', backfilled: true },
    standardBlueprintId: 'blaster_standard',
    trial: { blueprintId: 'pulse_singularity', startsAt: new Date(startsAt).toISOString(), endsAt: new Date(startsAt + week).toISOString() },
    blueprints: PREVIEW_BLUEPRINTS.map(item => ({ ...item })),
  };
};
