export const DUEL_DURATION_SECONDS = 90;

export const DUEL_BLUEPRINTS = Object.freeze([
  Object.freeze({ id: 'blaster_royal_barrage', weaponKey: 'blaster', masteryKey: 'royalBarrage', name: 'ROYAL BARRAGE', role: 'LANE CONTROL', damageScale: .88, color: '#9dfbe0' }),
  Object.freeze({ id: 'blaster_crownrail', weaponKey: 'blaster', masteryKey: 'crownrail', name: 'CROWNRAIL', role: 'PRECISION', damageScale: .7, color: '#f4fff9' }),
  Object.freeze({ id: 'spread_guillotine_fan', weaponKey: 'spread', masteryKey: 'guillotineFan', name: 'GUILLOTINE FAN', role: 'FORWARD BURST', damageScale: .8, color: '#ffd36b' }),
  Object.freeze({ id: 'pulse_comet_cores', weaponKey: 'pulse', masteryKey: 'cometCores', name: 'COMET CORES', role: 'AREA PRESSURE', damageScale: .68, color: '#ff8ddb' }),
  Object.freeze({ id: 'laser_prism_array', weaponKey: 'laser', masteryKey: 'prismArray', name: 'PRISM ARRAY', role: 'MULTI TARGET', damageScale: .9, color: '#63e8ff' }),
  Object.freeze({ id: 'tesla_storm_web', weaponKey: 'tesla', masteryKey: 'stormWeb', name: 'STORM WEB', role: 'CHAIN CONTROL', damageScale: .82, color: '#b99cff' }),
]);

export const DUEL_BLUEPRINT_BY_ID = Object.freeze(Object.fromEntries(DUEL_BLUEPRINTS.map(blueprint => [blueprint.id, blueprint])));

const hashSeed = value => {
  let hash = 2166136261;
  for (const character of String(value || '')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 0x9e3779b9;
};

export const seededRandom = seed => {
  let state = hashSeed(seed);
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
};

export const buildDuelWavePlan = seed => {
  const random = seededRandom(seed);
  const events = [];
  let at = 1.35;
  let index = 0;
  while (at < DUEL_DURATION_SECONDS - .35) {
    const progress = at / DUEL_DURATION_SECONDS;
    const pool = progress < .22
      ? ['chaser', 'chaser', 'shooter']
      : progress < .5
        ? ['chaser', 'shooter', 'shooter', 'tank']
        : progress < .76
          ? ['chaser', 'shooter', 'tank', 'weaver']
          : ['shooter', 'tank', 'weaver', 'skimmer'];
    const groupSize = progress < .2 ? 1 : progress < .52 ? 1 + Number(index % 4 === 0) : 2 + Number(index % 5 === 0);
    for (let group = 0; group < groupSize; group += 1) {
      const type = pool[Math.floor(random() * pool.length)];
      events.push(Object.freeze({
        at: Number((at + group * .16).toFixed(3)),
        type,
        xRatio: Number((.1 + random() * .8).toFixed(5)),
        yRatio: Number((.2 + random() * .32).toFixed(5)),
        side: random() < .5 ? -1 : 1,
        shoot: Number((1.15 + random() * .7).toFixed(4)),
        phase: Number((random() * Math.PI * 2).toFixed(5)),
        holdRatio: Number((.2 + random() * .16).toFixed(5)),
      }));
    }
    index += 1;
    at += Math.max(.72, 1.48 - progress * .56) + random() * .28;
  }
  return Object.freeze(events);
};

export const duelTimeLabel = seconds => {
  const total = Math.max(0, Math.ceil(Number(seconds) || 0));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
