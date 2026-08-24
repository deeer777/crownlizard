import { CONFIG } from './config.js?v=20260824-42';
import { Engine } from './engine.js?v=20260820-18';
import { Input } from './input.js?v=20260820-26';
import { Music, SoundFx } from './audio.js?v=20260820-26';
import { Game } from './game.js?v=20260824-42';
import { ShardWallet } from './economy.js?v=20260824-42';
import { leaderboard, normalizeInitials } from './leaderboard.js?v=20260824-42';

const $ = id => document.getElementById(id);
const ui = {
  menu: $('menu'), gameover: $('gameover'), hud: $('hud'), play: $('play'), retry: $('retry'), home: $('home'),
  perkOverlay: $('perkOverlay'), perkCards: $('perkCards'),
  tutorialOverlay: $('tutorialOverlay'), tutorialDone: $('tutorialDone'), pauseOverlay: $('pauseOverlay'), pauseReason: $('pauseReason'),
  settingsOverlay: $('settingsOverlay'), resume: $('resume'), quitRun: $('quitRun'), pauseSettings: $('pauseSettings'),
  menuSettings: $('menuSettings'), menuLeaderboard: $('menuLeaderboard'), closeSettings: $('closeSettings'), resetTutorial: $('resetTutorial'), settingButtons: [...document.querySelectorAll('[data-setting]')],
  leaderboardOverlay: $('leaderboardOverlay'), leaderboardList: $('leaderboardList'), leaderboardPlayerResult: $('leaderboardPlayerResult'), leaderboardStatus: $('leaderboardStatus'), closeLeaderboard: $('closeLeaderboard'),
  leaderboardTabs: [...document.querySelectorAll('[data-board-difficulty]')],
  menuChoices: [...document.querySelectorAll('[data-menu-choice]')],
  resultChoices: [...document.querySelectorAll('[data-result-choice]')],
  gameVersion: $('gameVersion'), menuShards: $('menuShards'),
  score: $('score'), finalScore: $('finalScore'), best: $('best'), menuBest: $('menuBest'), combo: $('combo'), hearts: $('hearts'),
  weaponHud: $('weaponHud'), weaponIcon: $('weaponIcon'), weaponName: $('weaponName'), weaponLevel: $('weaponLevel'), weaponUpgrade: $('weaponUpgrade'), weaponPips: $('weaponPips'),
  dashFill: $('dashFill'), dashButton: $('dashButton'), dashChargePips: [...document.querySelectorAll('#dashCharge b')], pauseButton: $('pauseButton'), joystick: $('joystick'), sound: $('sound'), toast: $('toast'),
  stageName: $('stageName'), stageFill: $('stageFill'), runMeta: $('runMeta'), difficultyButtons: [...document.querySelectorAll('[data-difficulty]')],
  recordMessage: $('recordMessage'), resultTitle: $('resultTitle'), runSummary: $('runSummary'), shardReward: $('shardReward'),
  scoreEntry: $('scoreEntry'), playerInitials: $('playerInitials'), initialsSlots: [...$('initialsSlots').children], submitScore: $('submitScore'), scoreSubmitStatus: $('scoreSubmitStatus'),
};

let selectedDifficulty = localStorage.getItem('crownlizard:difficulty') || 'arcade';
if (!CONFIG.difficulties[selectedDifficulty]) selectedDifficulty = 'arcade';
const bestKey = difficulty => `crownlizard:best:v3:${difficulty}`;
let best = Number(localStorage.getItem(bestKey(selectedDifficulty)) || 0);
ui.best.textContent = best.toLocaleString('en-US');
ui.menuBest.textContent = String(best).padStart(6, '0');
ui.gameVersion.textContent = `VER ${CONFIG.version.release} · BUILD ${CONFIG.version.build}`;
ui.difficultyButtons.forEach(button => button.classList.toggle('selected', button.dataset.difficulty === selectedDifficulty));

const music = new Music();
const sfx = new SoundFx();
let hapticsEnabled = localStorage.getItem('cl:haptics') !== 'off';
let reducedEffects = localStorage.getItem('cl:reduced-effects') === 'on';
let dashSide = localStorage.getItem('cl:dash-side') === 'left' ? 'left' : 'right';
const tutorialKey = 'cl:tutorial:v1';
const tutorialForced = new URLSearchParams(location.search).has('tutorial');
let tutorialForcedUsed = false;
let settingsReturn = 'menu';
let leaderboardReturn = 'menu';
let leaderboardDifficulty = selectedDifficulty;
let runGeneration = 0;
let currentRunPromise = Promise.resolve(null);
let pendingScore = null;
let economyRunId = '';
let selectedMenuChoice = 0;
let selectedResultChoice = 0;
ui.sound.classList.toggle('off', !music.enabled);
const input = new Input($('game'), ui.dashButton, ui.joystick);
const shardWallet = new ShardWallet();
const createEconomyRunId = () => globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const renderShardBalance = () => { ui.menuShards.textContent = `◆ ${shardWallet.getBalance().toLocaleString('en-US')} SHARDS`; };
renderShardBalance();
let toastTimer = 0;
let toastPriority = -1;
const toastPriorities = { debug: 0, event: 1, threat: 2, weapon: 3, critical: 4 };
const toastDurations = { debug: 950, event: 1350, threat: 1550, weapon: 1650, critical: 2300 };

const hideToast = () => {
  clearTimeout(toastTimer);
  ui.toast.classList.add('hidden');
  toastPriority = -1;
};

const showToast = (message, kind = 'event', color = '') => {
  const priority = toastPriorities[kind] ?? toastPriorities.event;
  if (!ui.toast.classList.contains('hidden') && priority < toastPriority) return;
  clearTimeout(toastTimer);
  toastPriority = priority;
  const duration = toastDurations[kind] ?? toastDurations.event;
  ui.toast.textContent = message;
  ui.toast.className = `toast notice-${kind}`;
  ui.toast.style.setProperty('--notice-color', color || 'currentColor');
  ui.toast.style.setProperty('--toast-duration', `${duration}ms`);
  void ui.toast.offsetWidth;
  toastTimer = setTimeout(hideToast, duration + 40);
};

const applyEffectsSetting = () => {
  document.documentElement.classList.toggle('reduced-effects', reducedEffects);
};

const renderSettings = () => {
  const values = { music: music.enabled, sfx: sfx.enabled, haptics: hapticsEnabled, reduced: reducedEffects };
  ui.settingButtons.forEach(button => {
    if (button.dataset.setting === 'dashSide') {
      button.setAttribute('aria-pressed', String(dashSide === 'left'));
      button.querySelector('b').textContent = dashSide.toUpperCase();
      return;
    }
    const enabled = values[button.dataset.setting];
    button.setAttribute('aria-pressed', String(enabled));
    button.querySelector('b').textContent = enabled ? 'ON' : 'OFF';
  });
  ui.sound.classList.toggle('off', !music.enabled);
  document.documentElement.classList.toggle('dash-left', dashSide === 'left');
};

const selectMenuChoice = (index, focus = false) => {
  selectedMenuChoice = (index + ui.menuChoices.length) % ui.menuChoices.length;
  ui.menuChoices.forEach((button, buttonIndex) => button.classList.toggle('menu-selected', buttonIndex === selectedMenuChoice));
  if (focus) ui.menuChoices[selectedMenuChoice].focus({ preventScroll: true });
};

const selectResultChoice = (index, focus = false) => {
  const choices = ui.resultChoices.filter(button => !button.classList.contains('hidden') && !button.disabled);
  if (!choices.length) return;
  selectedResultChoice = (index + choices.length) % choices.length;
  ui.resultChoices.forEach(button => button.classList.toggle('result-selected', button === choices[selectedResultChoice]));
  if (focus) choices[selectedResultChoice].focus({ preventScroll: true });
};

ui.menuChoices.forEach((button, index) => {
  button.addEventListener('pointerenter', () => selectMenuChoice(index));
  button.addEventListener('focus', () => selectMenuChoice(index));
});
ui.resultChoices.forEach(button => {
  const selectButton = () => {
    const choices = ui.resultChoices.filter(choice => !choice.classList.contains('hidden') && !choice.disabled);
    const index = choices.indexOf(button);
    if (index >= 0) selectResultChoice(index);
  };
  button.addEventListener('pointerenter', selectButton);
  button.addEventListener('focus', selectButton);
});

const renderInitialSlots = value => {
  const initials = normalizeInitials(value);
  ui.initialsSlots.forEach((slot, index) => { slot.textContent = initials[index] || '–'; });
};

const selectLeaderboardDifficulty = difficulty => {
  leaderboardDifficulty = CONFIG.difficulties[difficulty] ? difficulty : 'arcade';
  ui.leaderboardTabs.forEach(button => {
    const selected = button.dataset.boardDifficulty === leaderboardDifficulty;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-selected', String(selected));
  });
};

const renderLeaderboard = (scores, highlightId = '', personal = null) => {
  ui.leaderboardList.replaceChildren();
  Array.from({ length: 10 }, (_, index) => scores[index] || null).forEach((entry, index) => {
    const row = document.createElement('li');
    if (!entry) row.classList.add('leaderboard-empty');
    if (entry?.id === highlightId) {
      row.classList.add('leaderboard-highlight');
      row.setAttribute('aria-current', 'true');
    }
    const values = entry
      ? [String(index + 1).padStart(2, '0'), entry.initials, Number(entry.score).toLocaleString('en-US'), String(entry.zone)]
      : [String(index + 1).padStart(2, '0'), '---', '------', '-'];
    values.forEach((value, cellIndex) => {
      const cell = document.createElement('span');
      cell.textContent = value;
      if (cellIndex === 1 && entry?.id === highlightId) {
        const marker = document.createElement('small');
        marker.textContent = 'YOU';
        cell.append(marker);
      }
      row.append(cell);
    });
    ui.leaderboardList.append(row);
  });
  const personalOutsideTopTen = personal?.entry && !scores.some(entry => entry.id === personal.entry.id);
  ui.leaderboardPlayerResult.classList.toggle('hidden', !personalOutsideTopTen);
  ui.leaderboardPlayerResult.replaceChildren();
  if (personalOutsideTopTen) {
    const rank = document.createElement('b');
    rank.textContent = `#${personal.rank || '—'}`;
    const label = document.createElement('span');
    label.textContent = 'YOUR SCORE';
    const initials = document.createElement('strong');
    initials.textContent = personal.entry.initials;
    const score = document.createElement('em');
    score.textContent = Number(personal.entry.score).toLocaleString('en-US');
    ui.leaderboardPlayerResult.append(rank, label, initials, score);
  }
  ui.leaderboardStatus.textContent = scores.length ? 'TOP 10 · ALL-TIME' : 'NO SCORES YET · CLAIM THE CROWN';
};

const loadLeaderboard = async (difficulty = leaderboardDifficulty, silent = false) => {
  selectLeaderboardDifficulty(difficulty);
  if (!silent) {
    renderLeaderboard([]);
    ui.leaderboardStatus.textContent = 'CONNECTING...';
  }
  try {
    const result = await leaderboard.list(difficulty);
    if (difficulty === leaderboardDifficulty) renderLeaderboard(result.scores || []);
    if (difficulty === selectedDifficulty && result.scores?.length) ui.menuBest.textContent = String(result.scores[0].score).padStart(6, '0');
    return result;
  } catch {
    if (!silent && difficulty === leaderboardDifficulty) {
      renderLeaderboard([]);
      ui.leaderboardStatus.textContent = 'GLOBAL BOARD OFFLINE · LOCAL RECORD SAFE';
    }
    return null;
  }
};

const openLeaderboard = (origin = 'menu', difficulty = selectedDifficulty, result = null) => {
  leaderboardReturn = origin;
  selectLeaderboardDifficulty(difficulty);
  ui.leaderboardOverlay.classList.remove('hidden');
  if (result?.scores) {
    renderLeaderboard(result.scores, result.entry?.id || '', { entry: result.entry, rank: result.rank });
  } else {
    loadLeaderboard(difficulty);
  }
};

const closeLeaderboard = () => {
  ui.leaderboardOverlay.classList.add('hidden');
  if (leaderboardReturn === 'menu') selectMenuChoice(1, true);
};

const prepareScoreEntry = (score, summary) => {
  const scoreTicket = { score, summary, difficulty: game.difficulty, generation: runGeneration, run: null };
  pendingScore = scoreTicket;
  ui.scoreEntry.classList.add('hidden');
  ui.submitScore.classList.add('hidden');
  ui.scoreSubmitStatus.textContent = '';
  ui.submitScore.disabled = false;
  Promise.resolve(currentRunPromise).then(run => {
    if ((!run && !debugMode) || pendingScore !== scoreTicket || scoreTicket.generation !== runGeneration) return;
    scoreTicket.run = run;
    const savedInitials = normalizeInitials(localStorage.getItem('cl:initials') || '');
    ui.playerInitials.value = savedInitials.length === 3 ? savedInitials : '';
    renderInitialSlots(ui.playerInitials.value);
    ui.playerInitials.dataset.pristine = 'true';
    ui.scoreEntry.classList.remove('hidden');
    ui.submitScore.classList.remove('hidden');
    selectResultChoice(0);
  });
};

const renderRunSummary = summary => {
  if (!summary) { ui.runSummary.innerHTML = ''; return; }
  const powers = summary.powers.length ? summary.powers.map(power => `${power.name} ${power.level > 1 ? `LV${power.level}` : ''}`.trim()).join(' · ') : 'NONE';
  ui.runSummary.innerHTML = `
    <div class="summary-stat"><span>ZONE</span><b>${summary.zone}</b></div>
    <div class="summary-stat"><span>WARDENS</span><b>${summary.wardens}</b></div>
    <div class="summary-stat"><span>CRATES</span><b>${summary.crates}</b></div>
    <div class="summary-stat"><span>BEST COMBO</span><b>x${summary.bestCombo}</b></div>
    <div class="summary-loadout"><span>FINAL WEAPON <b>${summary.weapon} MK ${summary.weaponLevel}</b></span><span>CROWN POWERS <b>${powers}</b></span><span>ENEMIES DEFEATED <b>${summary.enemies}</b></span></div>
  `;
};

const renderShardReward = result => {
  if (!result?.reward) { ui.shardReward.innerHTML = ''; return; }
  const { reward, balance } = result;
  if (!reward.qualified) {
    ui.shardReward.className = 'shard-reward shard-unqualified';
    ui.shardReward.innerHTML = `
      <div class="shard-reward-head"><span>◆ SHARD PAYOUT</span><b>NO SHARDS</b></div>
      <p>RUN TOO SHORT · ${reward.reason}</p>
      <div class="shard-balance">BALANCE <b>${balance.toLocaleString('en-US')}</b></div>
    `;
    return;
  }
  const rows = [
    ['SURVIVAL', reward.breakdown.survival],
    ['ENEMIES', reward.breakdown.enemies],
    ['ZONE BONUS', reward.breakdown.zones],
    ['WARDENS', reward.breakdown.wardens],
  ];
  ui.shardReward.className = 'shard-reward shard-qualified';
  ui.shardReward.innerHTML = `
    <div class="shard-reward-head"><span>◆ SHARDS EARNED</span><b>+${reward.total}</b></div>
    <div class="shard-breakdown">${rows.map(([label, value]) => `<span>${label}<b>+${value}</b></span>`).join('')}</div>
    <div class="shard-balance">NEW BALANCE <b>${balance.toLocaleString('en-US')}</b></div>
  `;
};

const game = new Game($('game'), input, {
  hud: state => {
    ui.score.textContent = state.score.toLocaleString('en-US');
    ui.combo.textContent = `x${Math.max(1, Math.floor(state.combo))}`;
    ui.hearts.innerHTML = Array.from({ length: state.maxHealth }, (_, index) => index < state.health ? '♥' : '<span class="lost">♥</span>').join(' ');
    ui.dashFill.style.transform = `scaleX(${state.dash})`;
    const chargedSegments = Math.min(4, Math.floor(state.dash * 4 + .001));
    ui.dashChargePips.forEach((pip, index) => pip.classList.toggle('active', index < chargedSegments));
    ui.stageName.textContent = state.boss ? `${state.bossName || 'WARDEN'} · PHASE ${state.bossPhase}` : `ZONE ${state.stage} · ${state.stageName}`;
    ui.stageFill.style.transform = `scaleX(${state.boss ? state.bossHealth : state.stageProgress})`;
    ui.stageFill.classList.toggle('boss', state.boss);
    ui.weaponName.textContent = state.weapon;
    ui.weaponIcon.textContent = '';
    ui.weaponIcon.style.backgroundImage = `url("./assets/weapons/${state.weapon.toLowerCase()}-mount-v1.png")`;
    ui.weaponLevel.textContent = state.weaponLevel;
    ui.weaponUpgrade.textContent = state.weaponUpgrade;
    ui.weaponHud.querySelector('.weapon-rank').setAttribute('aria-label', `Weapon level ${state.weaponLevel} of 5`);
    ui.weaponHud.setAttribute('aria-label', `${state.weapon}, level ${state.weaponLevel} of 5, ${state.weaponUpgrade}`);
    [...ui.weaponPips.children].forEach((pip, index) => pip.classList.toggle('active', index < state.weaponLevel));
    ui.weaponHud.style.setProperty('--weapon-color', state.weaponColor);
    ui.dashButton.classList.toggle('ready', state.dash >= .999);
  },
  combo: () => {
    ui.combo.classList.remove('bump');
    void ui.combo.offsetWidth;
    ui.combo.classList.add('bump');
    setTimeout(() => ui.combo.classList.remove('bump'), 130);
  },
  toast: showToast,
  gameover: (score, summary) => {
    hideToast();
    ui.finalScore.textContent = score.toLocaleString('en-US');
    const record = score > best;
    if (record) { best = score; localStorage.setItem(bestKey(game.difficulty), String(best)); }
    ui.resultTitle.textContent = record ? 'NEW HIGH SCORE' : 'THE CROWN FELL';
    ui.recordMessage.textContent = record ? `New local record: ${best.toLocaleString('en-US')} points!` : `Local best: ${best.toLocaleString('en-US')}`;
    ui.runMeta.textContent = `ZONE ${game.stageIndex + 1} · ${CONFIG.difficulties[game.difficulty].name}`;
    renderRunSummary(summary);
    const shardResult = shardWallet.awardRun(economyRunId, summary);
    renderShardReward(shardResult);
    renderShardBalance();
    prepareScoreEntry(score, summary);
    selectResultChoice(0);
    ui.gameover.classList.remove('hidden');
    ui.perkOverlay.classList.add('hidden');
    ui.dashButton.classList.add('hidden');
    ui.pauseButton.classList.add('hidden');
    music.pause();
  },
  stage: stage => {
    document.documentElement.style.setProperty('--stage-accent', stage.palette.accent);
    sfx.play('stage');
  },
  perk: choices => {
    ui.perkCards.innerHTML = choices.map(perk => `
      <button class="perk-card${perk.cursed ? ' cursed' : ''}" data-perk="${perk.key}" style="--perk-color:${perk.color}">
        <small>${perk.cursed ? 'CURSED' : `LEVEL ${perk.stack}/${perk.maxStacks}`}</small>
        <span class="perk-icon"><img src="./assets/perks/${perk.sprite}" alt="" decoding="async" draggable="false"></span>
        <b>${perk.name}</b>
        <p>${perk.description}</p>
      </button>
    `).join('');
    ui.perkCards.querySelectorAll('[data-perk]').forEach(card => card.addEventListener('click', () => game.selectPerk(card.dataset.perk), { once: true }));
    ui.perkOverlay.classList.remove('hidden');
    ui.dashButton.classList.add('hidden');
    ui.pauseButton.classList.add('hidden');
  },
  perkApplied: () => {
    ui.perkOverlay.classList.add('hidden');
    ui.dashButton.classList.remove('hidden');
    ui.pauseButton.classList.remove('hidden');
  },
  haptic: pattern => { if (hapticsEnabled) navigator.vibrate?.(pattern); },
  sfx: type => sfx.play(type),
});

game.reducedEffects = reducedEffects;
applyEffectsSetting();
renderSettings();

const engine = new Engine({ update: dt => game.update(dt), render: () => game.render(), step: 1 / CONFIG.simulationHz });
engine.start();

const runVisible = () => ui.menu.classList.contains('hidden') && ui.gameover.classList.contains('hidden') && ui.tutorialOverlay.classList.contains('hidden') && game.player.health > 0;

const resumeRun = () => {
  if (!game.active || game.awaitingPerk) return;
  game.paused = false;
  ui.pauseOverlay.classList.add('hidden');
  ui.pauseButton.classList.remove('hidden');
  ui.dashButton.classList.remove('hidden');
  music.play();
};

const pauseRun = automatic => {
  if (!game.active || game.paused || game.awaitingPerk || !runVisible()) return;
  game.paused = true;
  input.clear();
  hideToast();
  ui.pauseReason.textContent = automatic ? 'RUN SAFELY PAUSED' : 'RUN PAUSED';
  ui.pauseOverlay.classList.remove('hidden');
  ui.pauseButton.classList.add('hidden');
  ui.dashButton.classList.add('hidden');
  music.pause();
};

const returnToMenu = () => {
  game.stop();
  economyRunId = '';
  input.clear();
  [ui.gameover, ui.perkOverlay, ui.pauseOverlay, ui.settingsOverlay, ui.tutorialOverlay].forEach(element => element.classList.add('hidden'));
  ui.hud.classList.add('hidden');
  ui.dashButton.classList.add('hidden');
  ui.pauseButton.classList.add('hidden');
  ui.menu.classList.remove('hidden');
  selectMenuChoice(0);
  ui.best.textContent = best.toLocaleString('en-US');
  ui.menuBest.textContent = String(best).padStart(6, '0');
  loadLeaderboard(selectedDifficulty, true);
  music.play();
};

const openSettings = origin => {
  settingsReturn = origin;
  renderSettings();
  if (origin === 'pause') ui.pauseOverlay.classList.add('hidden');
  ui.settingsOverlay.classList.remove('hidden');
};

const closeSettings = () => {
  ui.settingsOverlay.classList.add('hidden');
  if (settingsReturn === 'pause' && game.paused) ui.pauseOverlay.classList.remove('hidden');
};

const openTutorial = () => {
  game.paused = true;
  input.clear();
  hideToast();
  ui.tutorialOverlay.classList.remove('hidden');
  ui.pauseButton.classList.add('hidden');
  ui.dashButton.classList.add('hidden');
};

const finishTutorial = () => {
  localStorage.setItem(tutorialKey, 'seen');
  tutorialForcedUsed = true;
  ui.tutorialOverlay.classList.add('hidden');
  game.paused = false;
  ui.pauseButton.classList.remove('hidden');
  ui.dashButton.classList.remove('hidden');
  sfx.play('confirm');
};

const start = () => {
  [ui.menu, ui.gameover, ui.perkOverlay, ui.pauseOverlay, ui.settingsOverlay, ui.tutorialOverlay].forEach(element => element.classList.add('hidden'));
  ui.hud.classList.remove('hidden');
  ui.dashButton.classList.remove('hidden');
  ui.pauseButton.classList.remove('hidden');
  game.start(selectedDifficulty);
  economyRunId = createEconomyRunId();
  const generation = ++runGeneration;
  pendingScore = null;
  ui.scoreEntry.classList.add('hidden');
  ui.submitScore.classList.add('hidden');
  currentRunPromise = leaderboard.beginRun(selectedDifficulty, `${CONFIG.version.release}-${CONFIG.version.build}`)
    .then(run => generation === runGeneration ? run : null)
    .catch(() => null);
  game.reducedEffects = reducedEffects;
  music.play();
  const needsTutorial = localStorage.getItem(tutorialKey) !== 'seen' || (tutorialForced && !tutorialForcedUsed);
  if (needsTutorial) openTutorial();
};

ui.play.addEventListener('click', start);
ui.retry.addEventListener('click', start);
ui.home.addEventListener('click', returnToMenu);
ui.quitRun.addEventListener('click', returnToMenu);
ui.resume.addEventListener('click', resumeRun);
ui.pauseButton.addEventListener('click', () => pauseRun(false));
ui.tutorialDone.addEventListener('click', finishTutorial);
ui.menuSettings.addEventListener('click', () => openSettings('menu'));
ui.menuLeaderboard.addEventListener('click', () => openLeaderboard('menu', selectedDifficulty));
ui.pauseSettings.addEventListener('click', () => openSettings('pause'));
ui.closeSettings.addEventListener('click', closeSettings);
ui.closeLeaderboard.addEventListener('click', closeLeaderboard);
ui.leaderboardTabs.forEach(button => button.addEventListener('click', () => loadLeaderboard(button.dataset.boardDifficulty)));
ui.playerInitials.addEventListener('input', () => {
  ui.playerInitials.dataset.pristine = 'false';
  const normalized = normalizeInitials(ui.playerInitials.value);
  if (ui.playerInitials.value !== normalized) ui.playerInitials.value = normalized;
  renderInitialSlots(normalized);
});
ui.playerInitials.addEventListener('focus', () => {
  if (ui.playerInitials.dataset.pristine === 'true' && ui.playerInitials.value) {
    ui.playerInitials.select();
    ui.playerInitials.dataset.pristine = 'false';
  }
});
ui.scoreEntry.addEventListener('submit', async event => {
  event.preventDefault();
  if (!pendingScore?.run) return;
  const initials = normalizeInitials(ui.playerInitials.value);
  if (initials.length !== 3) {
    ui.scoreSubmitStatus.textContent = 'ENTER EXACTLY 3 INITIALS';
    ui.playerInitials.focus();
    return;
  }
  ui.submitScore.disabled = true;
  ui.scoreSubmitStatus.textContent = 'TRANSMITTING...';
  try {
    const summary = pendingScore.summary;
    const result = await leaderboard.submit({
      runId: pendingScore.run.id,
      initials,
      score: pendingScore.score,
      difficulty: pendingScore.difficulty,
      durationMs: summary.durationMs,
      zone: summary.zone,
      wardens: summary.wardens,
      enemies: summary.enemies,
      crates: summary.crates,
      bestCombo: summary.bestCombo,
      gameVersion: `${CONFIG.version.release}-${CONFIG.version.build}`,
    });
    localStorage.setItem('cl:initials', initials);
    ui.scoreSubmitStatus.textContent = `SCORE ACCEPTED · RANK ${result.rank || '—'}`;
    ui.scoreEntry.classList.add('hidden');
    ui.submitScore.classList.add('hidden');
    sfx.play('confirm');
    openLeaderboard('gameover', pendingScore.difficulty, result);
    pendingScore = null;
  } catch (error) {
    ui.scoreSubmitStatus.textContent = error.message || 'TRANSMISSION FAILED · TRY AGAIN';
    ui.submitScore.disabled = false;
  }
});
ui.sound.addEventListener('click', () => { music.toggle(); renderSettings(); });
ui.resetTutorial.addEventListener('click', () => {
  localStorage.removeItem(tutorialKey);
  ui.resetTutorial.textContent = 'TUTORIAL READY FOR NEXT RUN';
  setTimeout(() => { ui.resetTutorial.textContent = 'SHOW TUTORIAL AGAIN'; }, 1400);
});
ui.settingButtons.forEach(button => button.addEventListener('click', () => {
  const key = button.dataset.setting;
  if (key === 'music') {
    music.toggle();
    if (game.paused) music.pause();
  } else if (key === 'sfx') sfx.toggle();
  else if (key === 'haptics') {
    hapticsEnabled = !hapticsEnabled;
    localStorage.setItem('cl:haptics', hapticsEnabled ? 'on' : 'off');
    if (hapticsEnabled) navigator.vibrate?.(20);
  } else if (key === 'dashSide') {
    dashSide = dashSide === 'right' ? 'left' : 'right';
    localStorage.setItem('cl:dash-side', dashSide);
  } else if (key === 'reduced') {
    reducedEffects = !reducedEffects;
    localStorage.setItem('cl:reduced-effects', reducedEffects ? 'on' : 'off');
    game.reducedEffects = reducedEffects;
    applyEffectsSetting();
  }
  renderSettings();
}));
ui.difficultyButtons.forEach(button => button.addEventListener('click', () => {
  selectedDifficulty = button.dataset.difficulty;
  localStorage.setItem('crownlizard:difficulty', selectedDifficulty);
  ui.difficultyButtons.forEach(item => item.classList.toggle('selected', item === button));
  best = Number(localStorage.getItem(bestKey(selectedDifficulty)) || 0);
  ui.best.textContent = best.toLocaleString('en-US');
  ui.menuBest.textContent = String(best).padStart(6, '0');
  loadLeaderboard(selectedDifficulty, true);
}));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { input.clear(); pauseRun(true); }
});
addEventListener('blur', () => pauseRun(true));
addEventListener('keydown', event => {
  if (event.code !== 'Escape') return;
  event.preventDefault();
  if (!ui.leaderboardOverlay.classList.contains('hidden')) closeLeaderboard();
  else if (!ui.settingsOverlay.classList.contains('hidden')) closeSettings();
  else if (!ui.pauseOverlay.classList.contains('hidden')) resumeRun();
  else pauseRun(false);
});
addEventListener('keydown', event => {
  if (ui.gameover.classList.contains('hidden') || !ui.leaderboardOverlay.classList.contains('hidden') || document.activeElement === ui.playerInitials) return;
  if (event.code === 'ArrowDown' || event.code === 'KeyS') {
    event.preventDefault();
    selectResultChoice(selectedResultChoice + 1, true);
    sfx.play('confirm');
  } else if (event.code === 'ArrowUp' || event.code === 'KeyW') {
    event.preventDefault();
    selectResultChoice(selectedResultChoice - 1, true);
    sfx.play('confirm');
  } else if (event.code === 'Enter' || event.code === 'Space') {
    event.preventDefault();
    const choices = ui.resultChoices.filter(button => !button.classList.contains('hidden') && !button.disabled);
    choices[selectedResultChoice]?.click();
  }
});
addEventListener('keydown', event => {
  if (ui.menu.classList.contains('hidden') || !ui.settingsOverlay.classList.contains('hidden') || !ui.leaderboardOverlay.classList.contains('hidden')) return;
  if (event.code === 'ArrowDown' || event.code === 'KeyS') {
    event.preventDefault();
    input.clear();
    selectMenuChoice(selectedMenuChoice + 1, true);
    sfx.play('confirm');
  } else if (event.code === 'ArrowUp' || event.code === 'KeyW') {
    event.preventDefault();
    input.clear();
    selectMenuChoice(selectedMenuChoice - 1, true);
    sfx.play('confirm');
  } else if (event.code === 'Enter' || event.code === 'Space') {
    event.preventDefault();
    input.clear();
    ui.menuChoices[selectedMenuChoice].click();
  }
});

loadLeaderboard(selectedDifficulty, true);

// Local provspelningsgenväg; finns inte när spelet körs på crownlizard.com.
const debugMode = new URLSearchParams(location.search).has('debug') || location.hostname === '127.0.0.1' || location.hostname === 'localhost';
document.documentElement.classList.toggle('touch-preview', debugMode && new URLSearchParams(location.search).has('touch'));
if (debugMode) {
  globalThis.__crownLizardDebug = game;
  const debugWeapons = { Digit1: 'blaster', Digit2: 'spread', Digit3: 'pulse', Digit4: 'laser', Digit5: 'tesla' };
  const debugEnemies = ['chaser', 'shooter', 'tank', 'weaver', 'skimmer'];
  const debugEnemyNames = { chaser: 'RIPPER', shooter: 'HEX MOTH', tank: 'IRON SCARAB', weaver: 'CROWN WEAVER', skimmer: 'VOID SKIMMER' };
  let debugEnemyIndex = 0;
  addEventListener('keydown', event => {
    if (event.code === 'KeyP' || event.key?.toLowerCase() === 'p') {
      event.preventDefault();
      if (!game.active && ui.menu.classList.contains('hidden') === false) start();
      if (!ui.tutorialOverlay.classList.contains('hidden') || game.paused) return;
      const debugRunVisible = ui.menu.classList.contains('hidden') && ui.gameover.classList.contains('hidden') && game.player.health > 0;
      if (game.awaitingPerk) ui.perkOverlay.classList.remove('hidden');
      else if (debugRunVisible) {
        game.active = true;
        game.offerPerks();
      }
    }
    if (event.code === 'KeyZ' && game.active) {
      game.time = (game.stageIndex + 1) * CONFIG.stageDuration + .05;
      showToast('DEBUG · NEXT ZONE', 'debug');
    }
    if (event.code === 'KeyG' && game.active) {
      game.hazards.push({ type: 'poison', x: game.player.x, y: game.player.y, radius: 44, age: 0, warning: .65, life: 5.15 });
      showToast('DEBUG · POISON POOL', 'debug');
    }
    if (event.code === 'KeyV' && game.active) {
      game.spawnFormation('weaverIntro');
      showToast('DEBUG · CROWN WEAVER', 'debug');
    }
    if (event.code === 'KeyX' && game.active) {
      game.spawnFormation('skimmerCross');
      showToast('DEBUG · VOID SKIMMER', 'debug');
    }
    if (event.code === 'KeyO' && game.active) {
      game.player.health = 1;
      game.player.invulnerable = 0;
      game.player.dashTime = 0;
      game.hitPlayer(game.player.x, game.player.y - 1);
    }
    if (event.code === 'KeyJ' && game.active) {
      ui.joystick.style.left = '82px';
      ui.joystick.style.top = `${Math.max(190, innerHeight - 190)}px`;
      ui.joystick.style.setProperty('--stick-x', '20px');
      ui.joystick.style.setProperty('--stick-y', '-14px');
      ui.joystick.classList.remove('hidden');
      setTimeout(() => {
        if (!input.pointer.active) ui.joystick.classList.add('hidden');
      }, 1800);
      showToast('DEBUG · TOUCH STICK', 'debug');
    }
    if (event.code === 'KeyK' && game.active) {
      const type = debugEnemies[debugEnemyIndex++ % debugEnemies.length];
      game.spawnEnemy(type);
      const enemy = game.enemies.at(-1);
      enemy.x = game.player.x;
      enemy.y = Math.max(115, game.player.y - 145);
      game.damageEnemy(enemy, enemy.health + 1, false, game.weapon);
      showToast(`DEBUG WRECK · ${debugEnemyNames[type]}`, 'debug');
    }
    if (event.code === 'KeyB') {
      if (!game.active && ui.menu.classList.contains('hidden') === false) start();
      if (!game.active) return;
      game.enemies = [];
      game.enemyBullets = [];
      game.bossWarnings = [];
      game.hazards = [];
      game.bossStage = game.stageIndex;
      game.spawnEnemy('boss');
      showToast('DEBUG · THE WARDEN', 'debug');
    }
    const weapon = debugWeapons[event.code];
    if (weapon && game.active) {
      game.weaponLevels[weapon] = Math.max(1, game.weaponLevels[weapon]);
      game.weapon = weapon;
      game.weaponTimer = 0;
      showToast(`DEBUG WEAPON · ${CONFIG.weapons[weapon].name}`, 'debug');
    }
  });
}
