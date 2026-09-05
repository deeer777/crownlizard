import { CONFIG } from './config.js?v=20260905-110-privacy-support';
import { Engine } from './engine.js?v=20260820-18';
import { Input } from './input.js?v=20260905-110-privacy-support';
import { Music, SoundFx } from './audio.js?v=20260828-91-weapon-skins4';
import { Game } from './game.js?v=20260905-110-privacy-support';
import { ShardWallet } from './economy.js?v=20260830-95-score-fix';
import { COLLECTION_COSMETICS, COSMETICS, COSMETIC_BY_ID, COSMETIC_TIERS, CRATE_COSMETICS, CROWN_CRATE_COST, RARITY_BY_KEY, SOVEREIGN_GUARANTEE, STORE_PRODUCTS } from './cosmetics.js?v=20260828-91-weapon-skins4';
import { leaderboard, normalizeInitials } from './leaderboard.js?v=20260831-99-security';
import { PlayerAccount } from './player-account.js?v=20260901-102-duel-verified-final';
import { buildAccountPresentation } from './account-presentation.js?v=20260826-73-cinematic-endings';
import { REWARDED_AD_STATUS, SimulatedRewardedAdAdapter } from './rewarded-ad.js?v=20260824-45';
import { PwaManager } from './pwa.js?v=20260827-79-crown-store-final6';
import { armoryAccessLabel, armoryRankProgress, previewArmory, weaponMountUrl } from './armory.js?v=20260828-91-weapon-skins4';
import { ASSAULT_DURATION, BOSS_BLUEPRINTS } from './boss-assault.js?v=20260828-91-weapon-skins4';
import { BossNetwork } from './boss-network.js?v=20260831-99-security';
import { CosmeticPreferences } from './cosmetic-preferences.js?v=20260828-91-weapon-skins4';
import { DUEL_BLUEPRINT_BY_ID, duelTimeLabel } from './duel-match.js?v=20260901-102-duel-verified-final';

const $ = id => document.getElementById(id);
const cosmeticSpriteUrl = cosmetic => cosmetic.slot?.startsWith('weapon_')
  ? `./assets/weapons/${cosmetic.sprite}`
  : cosmetic.id === 'ship_default'
    ? './assets/runtime/sprites/crown-lizard-player-v1.png'
    : `./assets/sprites/${cosmetic.sprite}`;
const crateSpriteUrl = state => `./assets/runtime/sprites/crown-crate-${state}-v1.png`;
const debugParams = new URLSearchParams(location.search);
const localPreview = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
const publicProfileIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requestedPilotParam = String(debugParams.get('pilot') || '');
const requestedPilotProfileId = publicProfileIdPattern.test(requestedPilotParam)
  || (localPreview && /^preview:[a-z0-9_]{3,24}$/i.test(requestedPilotParam))
  ? requestedPilotParam
  : '';
const duelInvitePattern = /^[A-HJ-NP-Z2-9]{8}$/;
const requestedDuelParam = String(debugParams.get('duel') || '').trim().toUpperCase();
const requestedDuelCode = duelInvitePattern.test(requestedDuelParam) ? requestedDuelParam : '';
const callsignPreviewMode = localPreview && debugParams.has('debug') && debugParams.has('callsign');
const profilePreviewMode = localPreview && debugParams.has('debug') && debugParams.has('profile');
const pwaPreviewMode = localPreview && debugParams.has('debug') && debugParams.has('pwa');
const campaignPreviewMode = localPreview && debugParams.has('debug') && debugParams.has('admin');
const duelPreviewMode = localPreview && debugParams.has('debug') && debugParams.has('duel');
const serverEconomy = !localPreview;
const ui = {
  menu: $('menu'), gameover: $('gameover'), assaultResult: $('assaultResult'), hud: $('hud'), play: $('play'), retry: $('retry'), home: $('home'),
  perkOverlay: $('perkOverlay'), perkCards: $('perkCards'), perkEyebrow: $('perkEyebrow'), perkTitle: $('perkTitle'), perkSubtitle: $('perkSubtitle'), perkSwipeHint: $('perkSwipeHint'),
  tutorialOverlay: $('tutorialOverlay'), tutorialDone: $('tutorialDone'), pauseOverlay: $('pauseOverlay'), pauseReason: $('pauseReason'),
  settingsOverlay: $('settingsOverlay'), resume: $('resume'), quitRun: $('quitRun'), pauseSettings: $('pauseSettings'), installApp: $('installApp'), updateApp: $('updateApp'), openRedeem: $('openRedeem'), openAdmin: $('openAdmin'),
  menuSettings: $('menuSettings'), menuLeaderboard: $('menuLeaderboard'), menuVault: $('menuVault'), menuWarden: $('menuWarden'), menuWardenState: $('menuWardenState'), menuDuel: $('menuDuel'), menuMode: $('menuMode'), menuModeValue: $('menuModeValue'), menuStatus: $('menuStatus'), menuPlayer: $('menuPlayer'), closeSettings: $('closeSettings'), resetTutorial: $('resetTutorial'), settingButtons: [...document.querySelectorAll('[data-setting]')],
  accountOverlay: $('accountOverlay'), openAccount: $('openAccount'), closeAccount: $('closeAccount'), accountBadge: $('accountBadge'), openOwnProfile: $('openOwnProfile'), profileVisibility: $('profileVisibility'), accountTitle: $('accountTitle'), accountStatePanel: document.querySelector('.account-state'), accountIdentity: $('accountIdentity'), accountDescription: $('accountDescription'), accountTabs: $('accountTabs'), accountSecureTab: $('accountSecureTab'), accountLoginTab: $('accountLoginTab'), accountForm: $('accountForm'), accountEmailField: $('accountEmailField'), accountEmail: $('accountEmail'), accountPasswordField: $('accountPasswordField'), accountPassword: $('accountPassword'), accountFormStatus: $('accountFormStatus'), accountSubmit: $('accountSubmit'), accountRecovery: $('accountRecovery'), accountWarning: $('accountWarning'), callsignForm: $('callsignForm'), callsignInput: $('callsignInput'), callsignPreview: $('callsignPreview'), callsignSubmit: $('callsignSubmit'), accountSignedInActions: $('accountSignedInActions'), accountLogout: $('accountLogout'), accountLogoutConfirm: $('accountLogoutConfirm'), confirmAccountLogout: $('confirmAccountLogout'), cancelAccountLogout: $('cancelAccountLogout'),
  redeemOverlay: $('redeemOverlay'), redeemForm: $('redeemForm'), redeemCode: $('redeemCode'), redeemSubmit: $('redeemSubmit'), redeemReward: $('redeemReward'), redeemRewardAmount: $('redeemRewardAmount'), redeemRewardCampaign: $('redeemRewardCampaign'), redeemStatus: $('redeemStatus'), closeRedeem: $('closeRedeem'),
  adminOverlay: $('adminOverlay'), adminCreateTab: $('adminCreateTab'), adminCampaignsTab: $('adminCampaignsTab'), adminCreatePanel: $('adminCreatePanel'), adminCampaignsPanel: $('adminCampaignsPanel'), adminCodeForm: $('adminCodeForm'), adminCampaignName: $('adminCampaignName'), adminRewardType: $('adminRewardType'), adminRewardAmount: $('adminRewardAmount'), adminMaxRedemptions: $('adminMaxRedemptions'), adminExpiresAt: $('adminExpiresAt'), adminNote: $('adminNote'), adminCreateCode: $('adminCreateCode'), adminCodeReveal: $('adminCodeReveal'), adminCreatedCode: $('adminCreatedCode'), adminCopyCode: $('adminCopyCode'), adminCampaignCount: $('adminCampaignCount'), adminCampaignList: $('adminCampaignList'), adminStatus: $('adminStatus'), closeAdmin: $('closeAdmin'),
  leaderboardOverlay: $('leaderboardOverlay'), leaderboardList: $('leaderboardList'), leaderboardPlayerResult: $('leaderboardPlayerResult'), leaderboardStatus: $('leaderboardStatus'), closeLeaderboard: $('closeLeaderboard'),
  leaderboardTabs: [...document.querySelectorAll('[data-board-difficulty]')],
  duelOverlay: $('duelOverlay'), duelBrowser: $('duelBrowser'), duelRoom: $('duelRoom'), duelCreate: $('duelCreate'), duelRefresh: $('duelRefresh'), duelChallengeList: $('duelChallengeList'), duelRoomState: $('duelRoomState'), duelRoomTimer: $('duelRoomTimer'), duelBlueprintPicker: $('duelBlueprintPicker'), duelBlueprintList: $('duelBlueprintList'), duelHostCard: $('duelHostCard'), duelHostShip: $('duelHostShip'), duelHostName: $('duelHostName'), duelHostState: $('duelHostState'), duelGuestCard: $('duelGuestCard'), duelGuestShip: $('duelGuestShip'), duelGuestName: $('duelGuestName'), duelGuestState: $('duelGuestState'), duelShare: $('duelShare'), duelRoomNote: $('duelRoomNote'), duelReady: $('duelReady'), duelLeave: $('duelLeave'), duelStatus: $('duelStatus'), closeDuel: $('closeDuel'),
  duelHud: $('duelHud'), duelLiveOwnScore: $('duelLiveOwnScore'), duelLiveRivalName: $('duelLiveRivalName'), duelLiveRivalScore: $('duelLiveRivalScore'), duelLiveTime: $('duelLiveTime'), duelLiveSignal: $('duelLiveSignal'), duelCountdown: $('duelCountdown'), duelCountdownValue: $('duelCountdownValue'), duelCountdownLoadout: $('duelCountdownLoadout'), duelResult: $('duelResult'), duelResultEyebrow: $('duelResultEyebrow'), duelResultTitle: $('duelResultTitle'), duelResultOwn: $('duelResultOwn'), duelResultRival: $('duelResultRival'), duelResultGap: $('duelResultGap'), duelResultMessage: $('duelResultMessage'), duelRematch: $('duelRematch'), duelResultBack: $('duelResultBack'),
  pilotProfileOverlay: $('pilotProfileOverlay'), pilotProfileLoading: $('pilotProfileLoading'), pilotProfileContent: $('pilotProfileContent'), pilotProfileShip: $('pilotProfileShip'), pilotProfileName: $('pilotProfileName'), pilotProfileJoined: $('pilotProfileJoined'), pilotProfileArsenal: $('pilotProfileArsenal'), pilotBestChill: $('pilotBestChill'), pilotBestArcade: $('pilotBestArcade'), pilotBestCrowned: $('pilotBestCrowned'), pilotHighestZone: $('pilotHighestZone'), pilotQualifiedRuns: $('pilotQualifiedRuns'), pilotBossBest: $('pilotBossBest'), pilotBossTotal: $('pilotBossTotal'), pilotDuelHistory: $('pilotDuelHistory'), pilotProfileStatus: $('pilotProfileStatus'), pilotProfileShareStatus: $('pilotProfileShareStatus'), sharePilotProfile: $('sharePilotProfile'), closePilotProfile: $('closePilotProfile'),
  vaultOverlay: $('vaultOverlay'), vaultBalance: $('vaultBalance'), vaultSyncStatus: $('vaultSyncStatus'), vaultGuarantee: $('vaultGuarantee'), vaultGuaranteeFill: $('vaultGuaranteeFill'), vaultOdds: $('vaultOdds'), vaultOddsToggle: $('vaultOddsToggle'), vaultCollectionTitle: $('vaultCollectionTitle'), vaultOwned: $('vaultOwned'), vaultCollection: $('vaultCollection'), vaultStatus: $('vaultStatus'), openCrate: $('openCrate'), closeVault: $('closeVault'), crownCrate: document.querySelector('.crown-crate'), crownCrateSprite: $('crownCrateSprite'), vaultSponsoredSignal: $('vaultSponsoredSignal'), vaultSponsoredStatus: $('vaultSponsoredStatus'), vaultWatchAd: $('vaultWatchAd'), vaultAnimationToggle: $('vaultAnimationToggle'), vaultCratesTab: $('vaultCratesTab'), vaultStoreTab: $('vaultStoreTab'), vaultMarketTab: $('vaultMarketTab'), vaultBody: $('vaultBody'), vaultStore: $('vaultStore'), vaultMarket: $('vaultMarket'), storeCatalog: $('storeCatalog'), storeStatus: $('storeStatus'), cosmeticCategoryTabs: [...document.querySelectorAll('[data-cosmetic-category]')],
  marketBrowseTab: $('marketBrowseTab'), marketSellTab: $('marketSellTab'), marketMineTab: $('marketMineTab'), marketActivityTab: $('marketActivityTab'), marketCatalog: $('marketCatalog'), marketActivity: $('marketActivity'), marketStatus: $('marketStatus'), marketConfirm: $('marketConfirm'), marketConfirmForm: $('marketConfirmForm'), marketConfirmImage: $('marketConfirmImage'), marketConfirmTitle: $('marketConfirmTitle'), marketConfirmCopy: $('marketConfirmCopy'), marketPriceLabel: $('marketPriceLabel'), marketPriceInput: $('marketPriceInput'), marketConfirmHint: $('marketConfirmHint'), marketConfirmStatus: $('marketConfirmStatus'), marketConfirmSubmit: $('marketConfirmSubmit'), closeMarketConfirm: $('closeMarketConfirm'),
  marketFilters: $('marketFilters'), marketCategoryFilter: $('marketCategoryFilter'), marketRarityFilter: $('marketRarityFilter'), marketSortFilter: $('marketSortFilter'), marketHideOwned: $('marketHideOwned'),
  marketSignalBadge: $('marketSignalBadge'), marketSaleSignal: $('marketSaleSignal'), marketSaleSignalImage: $('marketSaleSignalImage'), marketSaleSignalTitle: $('marketSaleSignalTitle'), marketSaleSignalCopy: $('marketSaleSignalCopy'), marketSaleSignalAmount: $('marketSaleSignalAmount'), acknowledgeMarketSignal: $('acknowledgeMarketSignal'),
  storeRename: $('storeRename'), storeRenameForm: $('storeRenameForm'), storeCurrentCallsign: $('storeCurrentCallsign'), storeCallsignInput: $('storeCallsignInput'), storeRenameStatus: $('storeRenameStatus'), storeRenameSubmit: $('storeRenameSubmit'), closeStoreRename: $('closeStoreRename'),
  storePurchaseReveal: $('storePurchaseReveal'), storePurchaseImage: $('storePurchaseImage'), storePurchaseTier: $('storePurchaseTier'), storePurchaseName: $('storePurchaseName'), storePurchaseContinue: $('storePurchaseContinue'),
  wardenOverlay: $('wardenOverlay'), closeWarden: $('closeWarden'), wardenAssault: $('wardenAssault'), wardenAssaultHint: $('wardenAssaultHint'), wardenSignalLabel: $('wardenSignalLabel'), wardenSignalState: $('wardenSignalState'), wardenBriefingEyebrow: $('wardenBriefingEyebrow'), wardenBriefingTitle: $('wardenBriefingTitle'), wardenBriefingCopy: $('wardenBriefingCopy'), wardenSchedule: $('wardenSchedule'), wardenNextDate: $('wardenNextDate'), wardenNextCountdown: $('wardenNextCountdown'), bossEventHp: $('bossEventHp'), bossRankingList: $('bossRankingList'), bossPlayerRank: $('bossPlayerRank'), bossRewardGrid: $('bossRewardGrid'), bossRewardProgress: $('bossRewardProgress'), bossRewardStatus: $('bossRewardStatus'), armoryRank: $('armoryRank'), armoryBonus: $('armoryBonus'), armoryXpLabel: $('armoryXpLabel'), armoryXpRemaining: $('armoryXpRemaining'), armoryXpFill: $('armoryXpFill'), armorySelected: $('armorySelected'), armorySelectedImage: $('armorySelectedImage'), armorySelectedName: $('armorySelectedName'), armorySelectedRole: $('armorySelectedRole'), armorySelectedDescription: $('armorySelectedDescription'), armoryOwned: $('armoryOwned'), armoryGrid: $('armoryGrid'), armoryStatus: $('armoryStatus'),
  assaultHud: $('assaultHud'), assaultTime: $('assaultTime'), assaultPhaseLabel: $('assaultPhaseLabel'), assaultPhaseName: $('assaultPhaseName'), assaultPhaseRole: $('assaultPhaseRole'), assaultDamage: $('assaultDamage'), assaultGlobalHp: $('assaultGlobalHp'), assaultResultEyebrow: $('assaultResultEyebrow'), assaultDamageLabel: $('assaultDamageLabel'), assaultResultTitle: $('assaultResultTitle'), assaultFinalDamage: $('assaultFinalDamage'), assaultFinalTime: $('assaultFinalTime'), assaultFinalTargets: $('assaultFinalTargets'), assaultFinalRank: $('assaultFinalRank'), assaultFinalMultiplier: $('assaultFinalMultiplier'), assaultFinalGlobalHp: $('assaultFinalGlobalHp'), assaultFinalEventRank: $('assaultFinalEventRank'), assaultMilestone: $('assaultMilestone'), assaultMilestoneLabel: $('assaultMilestoneLabel'), assaultMilestoneFill: $('assaultMilestoneFill'), assaultResultMessage: $('assaultResultMessage'), assaultRetry: $('assaultRetry'), assaultArmory: $('assaultArmory'),
  crateReveal: $('crateReveal'), revealEyebrow: $('revealEyebrow'), revealTier: $('revealTier'), revealShip: $('revealShip'), revealName: $('revealName'), revealMessage: $('revealMessage'), revealContinue: $('revealContinue'),
  crateOpeningCinematic: $('crateOpeningCinematic'), cinematicCrateSprite: $('cinematicCrateSprite'), crateCinematicText: $('crateCinematicText'),
  cosmeticDetail: $('cosmeticDetail'), cosmeticDetailTier: $('cosmeticDetailTier'), cosmeticDetailPreview: $('cosmeticDetailPreview'), cosmeticDetailImage: $('cosmeticDetailImage'), cosmeticDetailName: $('cosmeticDetailName'), cosmeticDetailStatus: $('cosmeticDetailStatus'), cosmeticDetailHint: $('cosmeticDetailHint'), favoriteCosmetic: $('favoriteCosmetic'), equipCosmetic: $('equipCosmetic'), closeCosmeticDetail: $('closeCosmeticDetail'), randomFavoriteToggle: $('randomFavoriteToggle'),
  menuChoices: [...document.querySelectorAll('[data-menu-choice]')],
  resultChoices: [...document.querySelectorAll('[data-result-choice]')],
  gameVersion: $('gameVersion'), menuShards: $('menuShards'), sponsoredReward: $('sponsoredReward'), watchAd: $('watchAd'),
  score: $('score'), finalScore: $('finalScore'), best: $('best'), menuBest: $('menuBest'), combo: $('combo'), hearts: $('hearts'),
  weaponHud: $('weaponHud'), weaponIcon: $('weaponIcon'), weaponName: $('weaponName'), weaponLevel: $('weaponLevel'), weaponUpgrade: $('weaponUpgrade'), weaponPips: $('weaponPips'),
  dashFill: $('dashFill'), dashButton: $('dashButton'), dashChargePips: [...document.querySelectorAll('#dashCharge b')], pauseButton: $('pauseButton'), joystick: $('joystick'), sound: $('sound'), toast: $('toast'),
  stageName: $('stageName'), stageFill: $('stageFill'), runMeta: $('runMeta'),
  recordMessage: $('recordMessage'), personalBestChase: $('personalBestChase'), resultTitle: $('resultTitle'), runSummary: $('runSummary'), shardReward: $('shardReward'),
  scoreEntry: $('scoreEntry'), scoreIdentity: $('scoreIdentity'), scoreCallsign: $('scoreCallsign'), guestInitials: $('guestInitials'), playerInitials: $('playerInitials'), initialsSlots: [...$('initialsSlots').children], submitScore: $('submitScore'), scoreSubmitStatus: $('scoreSubmitStatus'),
  rewardedAdOverlay: $('rewardedAdOverlay'), rewardedAdMessage: $('rewardedAdMessage'), rewardedAdFill: $('rewardedAdFill'), rewardedAdCountdown: $('rewardedAdCountdown'), cancelRewardedAd: $('cancelRewardedAd'),
  networkStatus: $('networkStatus'), pwaInstallOverlay: $('pwaInstallOverlay'), closePwaInstall: $('closePwaInstall'), pwaUpdateOverlay: $('pwaUpdateOverlay'), pwaUpdateVersion: $('pwaUpdateVersion'), pwaReleaseTitle: $('pwaReleaseTitle'), pwaReleaseNotes: $('pwaReleaseNotes'), applyPwaUpdate: $('applyPwaUpdate'), laterPwaUpdate: $('laterPwaUpdate'),
};

let selectedDifficulty = localStorage.getItem('crownlizard:difficulty') || 'arcade';
if (!CONFIG.difficulties[selectedDifficulty]) selectedDifficulty = 'arcade';
const bestKey = difficulty => `crownlizard:best:v3:${difficulty}`;
let best = Number(localStorage.getItem(bestKey(selectedDifficulty)) || 0);
ui.best.textContent = best.toLocaleString('en-US');
ui.menuBest.textContent = String(best).padStart(6, '0');
ui.gameVersion.textContent = `VER ${CONFIG.version.release} · BUILD ${CONFIG.version.build}`;
ui.menuModeValue.textContent = CONFIG.difficulties[selectedDifficulty].name;

const music = new Music();
const sfx = new SoundFx();
music.playMenu();
const unlockMenuMusic = () => music.playMenu();
addEventListener('pointerdown', unlockMenuMusic, { once: true, capture: true });
addEventListener('keydown', unlockMenuMusic, { once: true, capture: true });
let hapticsEnabled = localStorage.getItem('cl:haptics') !== 'off';
const hapticsSupported = typeof navigator.vibrate === 'function';
const triggerHaptic = pattern => {
  if (!hapticsEnabled || !hapticsSupported) return false;
  navigator.vibrate(pattern);
  return true;
};
let reducedEffects = localStorage.getItem('cl:reduced-effects') === 'on';
let vaultAnimationEnabled = localStorage.getItem('cl:vault-animation') !== 'off';
let dashSide = localStorage.getItem('cl:dash-side') === 'left' ? 'left' : 'right';
const tutorialKey = 'cl:tutorial:v1';
const tutorialForced = new URLSearchParams(location.search).has('tutorial');
let tutorialForcedUsed = false;
let settingsReturn = 'menu';
let pwaManager = null;
let pwaUpdateReady = false;
let pwaUpdateDeferred = false;
let pwaOverlayReturn = 'menu';
let pwaReleaseInfo = null;
let accountMode = 'secure';
let accountBusy = false;
let logoutConfirming = false;
let adminAccess = campaignPreviewMode;
let adminAccessChecked = campaignPreviewMode;
let adminAccessLoading = false;
let adminMode = 'create';
let adminBusy = false;
let adminCampaigns = campaignPreviewMode ? [{
  id: 'preview-launch-code', codeHint: 'CROWN-****-****-7K9M', campaignName: 'LAUNCH REWARD',
  rewardType: 'shards', rewardAmount: 250, startsAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 6 * 86_400_000).toISOString(), maxRedemptions: 500,
  redeemedCount: 142, status: 'active', note: 'Preview campaign', createdAt: new Date().toISOString(),
}] : [];
let lastCreatedRewardCode = '';
let redeemBusy = false;
let leaderboardReturn = 'menu';
let leaderboardDifficulty = selectedDifficulty;
let pilotProfileOrigin = 'leaderboard';
let pilotProfileTrigger = null;
let pilotProfileTriggerLabel = '';
let pilotProfileGeneration = 0;
let activePilotProfile = null;
let pilotDeepLinkActive = false;
let runGeneration = 0;
let currentRunPromise = Promise.resolve(null);
let pendingScore = null;
let runCheckpointSequence = 0;
let runCheckpointTimer = 0;
let runCheckpointChain = Promise.resolve();
let economyRunId = '';
let selectedMenuChoice = 0;
let selectedResultChoice = 0;
ui.sound.classList.toggle('off', !music.enabled);
const gameCanvas = $('game');
const input = new Input(gameCanvas, ui.dashButton, ui.joystick);
const focusGameInput = () => {
  const focus = () => {
    const gameplayVisible = ui.menu.classList.contains('hidden')
      && ui.gameover.classList.contains('hidden')
      && ui.assaultResult.classList.contains('hidden')
      && ui.pauseOverlay.classList.contains('hidden')
      && ui.tutorialOverlay.classList.contains('hidden');
    if (gameplayVisible) gameCanvas.focus({ preventScroll: true });
  };
  requestAnimationFrame(focus);
  setTimeout(focus, 120);
};
gameCanvas.addEventListener('pointerenter', focusGameInput);
const shardWallet = new ShardWallet();
const cosmeticPreferences = new CosmeticPreferences();
try {
  const walletResetKey = 'cl:wallet-session-reset:v51';
  if (localStorage.getItem(walletResetKey) !== 'done') {
    localStorage.removeItem('cl:player-session:v1');
    localStorage.removeItem('cl:pending-settlement:v1');
    localStorage.setItem(walletResetKey, 'done');
  }
} catch {}
const playerAccount = new PlayerAccount();
let accountPreviewSignedOut = false;
const currentAccountState = () => (profilePreviewMode || campaignPreviewMode || duelPreviewMode) && accountPreviewSignedOut ? 'guest' : callsignPreviewMode || profilePreviewMode || campaignPreviewMode || duelPreviewMode ? 'signed-in' : localPreview ? 'preview' : playerAccount.getAccountState();
let playerProfile = profilePreviewMode || campaignPreviewMode || duelPreviewMode ? { publicId: 'preview:you', isPublic: true, displayName: campaignPreviewMode ? 'OWNER' : duelPreviewMode ? 'CROWNACE' : 'PREVIEW' } : null;
const bossNetwork = new BossNetwork({
  preview: localPreview,
  accessToken: () => playerAccount.getAccessToken(),
  playerName: () => playerProfile?.displayName || 'YOU',
  previewDamage: debugParams.has('rewards') ? 5_400 : 0,
  previewStatus: debugParams.has('victory') ? 'victory' : debugParams.has('failed') ? 'failed' : 'active',
});
let profileStatus = localPreview ? 'ready' : 'loading';
const accountPresentation = () => buildAccountPresentation({
  state: currentAccountState(),
  mode: accountMode,
  email: playerAccount.getPlayer()?.email,
  callsign: playerProfile?.displayName,
  profileStatus,
});
const renderMenuIdentity = () => {
  const account = accountPresentation();
  const labels = { guest: 'GUEST', preview: 'PREVIEW', setup: 'SET PASSWORD', expired: 'SIGN IN' };
  ui.menuPlayer.textContent = playerProfile?.displayName || labels[account.state] || account.badge;
  ui.menuStatus.dataset.accountState = account.state;
};
renderMenuIdentity();
const rewardedAd = new SimulatedRewardedAdAdapter();
let serverWallet = null;
let serverEconomyReady = false;
let serverEconomyConnecting = false;
let playerReadyPromise = Promise.resolve();
const createEconomyRunId = () => {
  if (!globalThis.crypto?.randomUUID) throw new Error('Secure run identifiers are unavailable.');
  return globalThis.crypto.randomUUID();
};
const emptyWalletView = () => ({
  balance: 0,
  transactions: [],
  inventory: { cosmetics: {}, equipped: { ship: 'ship_default', weapons: { laser: 'weapon_laser_default', tesla: 'weapon_tesla_default', pulse: 'weapon_pulse_default' } } },
  vault: { opens: 0, sinceSovereign: 0, freeCrateCredits: 0, pendingReward: null },
  sponsored: { pendingRunId: '' },
});
const serverWalletView = wallet => ({
  balance: Number(wallet?.balance) || 0,
  transactions: [],
  inventory: {
    cosmetics: Object.fromEntries((wallet?.inventory || []).map(item => [item.cosmeticId, { acquiredAt: item.acquiredAt, source: item.source, seenAt: item.seenAt || null }])),
    equipped: {
      ship: wallet?.equippedShip || 'ship_default',
      weapons: {
        laser: wallet?.equippedWeapons?.laser || 'weapon_laser_default',
        tesla: wallet?.equippedWeapons?.tesla || 'weapon_tesla_default',
        pulse: wallet?.equippedWeapons?.pulse || 'weapon_pulse_default',
      },
    },
  },
  vault: { opens: Number(wallet?.opens) || 0, sinceSovereign: Number(wallet?.sinceSovereign) || 0, freeCrateCredits: Math.max(0, Number(wallet?.freeCrateCredits) || 0), pendingReward: null },
  sponsored: { pendingRunId: '' },
});
const walletState = () => localPreview ? shardWallet.getState() : serverWallet || emptyWalletView();
const acceptServerWallet = payload => {
  serverWallet = serverWalletView(payload?.wallet);
  serverEconomyReady = true;
  return serverWallet;
};
const refreshServerWallet = async () => acceptServerWallet(await playerAccount.getWallet());
const refreshPlayerProfile = async () => {
  if (currentAccountState() !== 'signed-in') {
    playerProfile = null;
    profileStatus = 'ready';
    renderMenuIdentity();
    return null;
  }
  profileStatus = 'loading';
  renderMenuIdentity();
  try {
    const payload = await playerAccount.getProfile();
    playerProfile = payload.profile || null;
    profileStatus = 'ready';
    renderMenuIdentity();
    return playerProfile;
  } catch (error) {
    profileStatus = 'error';
    renderMenuIdentity();
    throw error;
  }
};
const refreshAdminAccess = async () => {
  if (currentAccountState() !== 'signed-in') {
    adminAccess = false;
    adminAccessChecked = false;
    adminAccessLoading = false;
    renderSettings();
    return false;
  }
  if (campaignPreviewMode) {
    adminAccess = true;
    adminAccessChecked = true;
    renderSettings();
    return true;
  }
  if (adminAccessLoading) return adminAccess;
  adminAccessLoading = true;
  const playerId = playerAccount.getPlayer()?.id;
  try {
    const payload = await playerAccount.getAdminSession();
    adminAccess = Boolean(payload?.admin) && playerAccount.getPlayer()?.id === playerId;
  } catch {
    adminAccess = false;
  } finally {
    adminAccessChecked = true;
    adminAccessLoading = false;
    renderSettings();
  }
  return adminAccess;
};
const renderShardBalance = () => {
  if (serverEconomy && !serverEconomyReady) {
    ui.menuShards.textContent = 'CONNECTING...';
    return;
  }
  ui.menuShards.textContent = walletState().balance.toLocaleString('en-US');
};
renderShardBalance();
const renderNetworkStatus = () => {
  const offline = navigator.onLine === false;
  ui.networkStatus.classList.toggle('hidden', !offline);
  document.documentElement.classList.toggle('offline', offline);
};
addEventListener('online', renderNetworkStatus);
addEventListener('offline', renderNetworkStatus);
renderNetworkStatus();
let crateOpening = false;
let vaultOddsExpanded = false;
let vaultMode = 'crates';
let vaultCategory = 'ship';
let storeCatalog = localPreview ? [...STORE_PRODUCTS] : [];
let storeCatalogLoaded = localPreview;
let storeCatalogLoading = false;
let storeBusySku = '';
let storeMessage = '';
let marketData = { rules: { feePercent: 10, maxActiveListings: 5, listingDays: 7 }, listings: [], myListings: [], activity: [], signals: [] };
let marketLoaded = false;
let marketLoading = false;
let marketMode = 'browse';
let marketBusy = false;
let marketOrder = null;
let marketCategoryFilter = 'all';
let marketRarityFilter = 'all';
let marketSortFilter = 'newest';
let marketHideOwned = false;
let selectedCosmeticDetailId = '';
let selectedCosmeticOrigin = 'collection';
let crateRevealReturn = 'vault';
let purchaseRevealReturn = 'store';
let rewardedAdViewing = false;
let currentSponsoredOffer = null;
let lastSponsoredClaimedRunId = '';
let crownCrateOpenPreload = null;
let armory = null;
let armoryLoading = false;
let armorySelecting = '';
let bossEvent = null;
let bossRanking = { leaders: [], player: null };
let bossRewardsState = { playerDamage: 0, qualified: false, rewards: [] };
let bossEventLoading = false;
let activeBossAssault = null;
let bossCheckpointChain = Promise.resolve();
let bossAssaultStarting = false;
let bossSettlementPending = false;
let bossRewardClaiming = '';
let bossRewardMessage = '';
let bossNextEvent = null;
let bossServerOffsetMs = 0;
let bossScheduleLoaded = false;
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const bossNow = () => Date.now() + bossServerOffsetMs;
const bossEventIsLive = event => event?.status === 'active'
  && Number(event.currentHp) > 0
  && Date.parse(event.startsAt) <= bossNow()
  && Date.parse(event.endsAt) > bossNow();
const formatBossCountdown = milliseconds => {
  const seconds = Math.max(0, Math.ceil(Number(milliseconds) / 1000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor(seconds % 86_400 / 3_600);
  const minutes = Math.floor(seconds % 3_600 / 60);
  if (days) return `${days}D ${hours}H`;
  if (hours) return `${hours}H ${minutes}M`;
  return `${minutes}M ${String(seconds % 60).padStart(2, '0')}S`;
};
const formatBossLocalStart = value => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'SCHEDULE CALIBRATING';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  }).format(date).replace(',', '').toUpperCase();
};
const syncBossServerClock = serverTime => {
  const parsed = Date.parse(String(serverTime || ''));
  if (Number.isFinite(parsed)) bossServerOffsetMs = parsed - Date.now();
};
const renderMenuWarden = () => {
  const live = bossEventIsLive(bossEvent);
  const nextStarts = Date.parse(bossNextEvent?.startsAt || '');
  const hasNext = Number.isFinite(nextStarts) && nextStarts > bossNow();
  const claimable = (bossRewardsState.rewards || []).some(reward => reward.claimable);
  let state = 'OFFLINE';
  let detail = 'SIGNAL UNAVAILABLE';
  let className = 'event-offline';
  if (bossEventLoading && !bossScheduleLoaded) {
    state = 'SYNC'; detail = 'CHECKING SIGNAL'; className = 'event-sync';
  } else if (live) {
    state = 'LIVE'; detail = `${formatBossCountdown(Date.parse(bossEvent.endsAt) - bossNow())} LEFT`; className = 'event-live';
  } else if (bossEvent && ['victory', 'failed'].includes(bossEvent.status)) {
    state = claimable ? 'CLAIM' : 'RESULTS';
    detail = hasNext ? `NEXT ${formatBossCountdown(nextStarts - bossNow())}` : 'EVENT COMPLETE';
    className = 'event-results';
  } else if (hasNext) {
    state = 'NEXT'; detail = formatBossCountdown(nextStarts - bossNow()); className = 'event-next';
  }
  ui.menuWarden.classList.remove('event-sync', 'event-live', 'event-next', 'event-results', 'event-offline');
  ui.menuWarden.classList.add(className);
  ui.menuWardenState.textContent = state;
  ui.menuWarden.setAttribute('aria-label', `Global Warden ${state.toLowerCase()}. ${detail.toLowerCase()}.`);
};
const renderWardenSchedule = () => {
  const nextStarts = Date.parse(bossNextEvent?.startsAt || '');
  const visible = !bossEventIsLive(bossEvent) && Number.isFinite(nextStarts) && nextStarts > bossNow();
  ui.wardenSchedule.classList.toggle('hidden', !visible);
  if (!visible) return;
  ui.wardenNextDate.textContent = formatBossLocalStart(bossNextEvent.startsAt);
  ui.wardenNextCountdown.textContent = `IN ${formatBossCountdown(nextStarts - bossNow())}`;
};

const armoryBlueprintColor = blueprint => CONFIG.weapons[blueprint?.weaponKey]?.color || CONFIG.weapons.blaster.color;

const setArmoryStatus = (message = '', error = false) => {
  ui.armoryStatus.textContent = message;
  ui.armoryStatus.classList.toggle('error', error);
};

const nextBossMilestone = () => (bossRewardsState.rewards || [])
  .filter(reward => reward.type === 'milestone' && !reward.earned)
  .sort((a, b) => Number(a.threshold) - Number(b.threshold))[0] || null;

const renderAssaultMilestone = () => {
  const damage = Number(bossRewardsState.playerDamage) || 0;
  const next = nextBossMilestone();
  if (!next) {
    ui.assaultMilestoneLabel.textContent = 'ALL PERSONAL MILESTONES COMPLETE';
    ui.assaultMilestoneFill.style.width = '100%';
    return;
  }
  ui.assaultMilestoneLabel.textContent = `${next.name} · ${damage.toLocaleString('en-US')} / ${Number(next.threshold).toLocaleString('en-US')}`;
  ui.assaultMilestoneFill.style.width = `${Math.min(100, damage / Number(next.threshold) * 100)}%`;
};

const renderBossRewards = () => {
  const damage = Number(bossRewardsState.playerDamage) || 0;
  ui.bossRewardProgress.textContent = `${damage.toLocaleString('en-US')} VERIFIED DAMAGE`;
  const cards = (bossRewardsState.rewards || []).map(reward => {
    const card = document.createElement('article');
    card.className = `boss-reward${reward.earned ? ' earned' : ''}${reward.claimed ? ' claimed' : ''}`;
    const icon = document.createElement('span');
    icon.className = 'boss-reward-icon';
    icon.innerHTML = `<i>${reward.type === 'global_victory' ? '♛' : '◆'}</i>`;
    const copy = document.createElement('div');
    copy.className = 'boss-reward-copy';
    const name = Object.assign(document.createElement('strong'), { textContent: reward.name });
    const description = Object.assign(document.createElement('span'), { textContent: reward.description });
    const prize = Object.assign(document.createElement('b'), { textContent: `◆ ${reward.shards} SHARDS${reward.badgeName ? ` · ${reward.badgeName} BADGE` : ''}` });
    copy.append(name, description, prize);
    const button = document.createElement('button');
    button.type = 'button';
    button.disabled = Boolean(bossRewardClaiming) || !reward.claimable;
    button.textContent = reward.claimed ? 'CLAIMED' : bossRewardClaiming === reward.key ? 'CLAIMING...' : reward.claimable ? 'CLAIM' : reward.earned && reward.type === 'global_victory' ? 'AWAIT VICTORY' : 'LOCKED';
    if (reward.claimable) button.addEventListener('click', () => claimBossReward(reward.key));
    card.append(icon, copy, button);
    return card;
  });
  if (!cards.length) cards.push(Object.assign(document.createElement('p'), { textContent: bossEventLoading ? 'SYNCING REWARDS...' : 'REWARD SIGNAL UNAVAILABLE' }));
  ui.bossRewardGrid.replaceChildren(...cards);
  ui.bossRewardStatus.textContent = bossRewardClaiming ? 'VERIFYING REWARD CLAIM...' : bossRewardMessage || 'REWARDS ARE COSMETIC OR SHARDS · NEVER GAMEPLAY POWER';
  renderAssaultMilestone();
};

const claimBossReward = async rewardKey => {
  if (!bossEvent || bossRewardClaiming) return;
  bossRewardClaiming = rewardKey;
  bossRewardMessage = '';
  renderBossRewards();
  try {
    const payload = await bossNetwork.claimReward({ eventId: bossEvent.id, rewardKey });
    bossRewardsState = payload.rewards || bossRewardsState;
    if (localPreview) {
      const state = shardWallet.getState();
      if (!state.transactions.some(transaction => transaction.id === `boss:${bossEvent.id}:${rewardKey}`)) {
        state.balance += Number(payload.claim?.shards) || 0;
        state.transactions.push({ id: `boss:${bossEvent.id}:${rewardKey}`, kind: 'boss_reward', rewardKey, amount: Number(payload.claim?.shards) || 0, createdAt: new Date().toISOString() });
        shardWallet.write(state);
      }
    } else if (payload.wallet) acceptServerWallet(payload);
    renderShardBalance();
    sfx.play('confirm');
    triggerHaptic([20, 25, 45]);
    bossRewardMessage = `${payload.claim?.badgeName ? `${payload.claim.badgeName} BADGE · ` : ''}+${payload.claim?.shards || 0} SHARDS CLAIMED`;
  } catch (error) {
    bossRewardMessage = String(error?.message || 'REWARD CLAIM FAILED').toUpperCase();
  } finally {
    bossRewardClaiming = '';
    renderBossRewards();
  }
};

const renderBossEvent = () => {
  ui.wardenOverlay.classList.toggle('event-victory', bossEvent?.status === 'victory');
  ui.wardenOverlay.classList.toggle('event-failed', bossEvent?.status === 'failed');
  renderMenuWarden();
  renderWardenSchedule();
  if (!bossEvent) {
    const nextStarts = Date.parse(bossNextEvent?.startsAt || '');
    const hasNext = Number.isFinite(nextStarts) && nextStarts > bossNow();
    ui.wardenSignalState.textContent = bossEventLoading ? 'CONNECTING' : hasNext ? `NEXT · ${formatBossCountdown(nextStarts - bossNow())}` : 'OFFLINE';
    ui.wardenBriefingEyebrow.textContent = hasNext ? 'NEXT COOPERATIVE ASSAULT' : 'GLOBAL SIGNAL OFFLINE';
    ui.wardenBriefingTitle.textContent = hasNext ? 'THE SIGNAL RETURNS' : 'THE CROWN IS SILENT';
    ui.wardenBriefingCopy.textContent = hasNext
      ? `GLOBAL WARDEN OPENS ${formatBossLocalStart(bossNextEvent.startsAt)}. PREPARE A BLUEPRINT IN CROWN ARMORY.`
      : 'NO VERIFIED GLOBAL WARDEN EVENT IS CURRENTLY SCHEDULED.';
    ui.bossEventHp.textContent = bossEventLoading ? 'CONNECTING...' : hasNext ? `EVENT OPENS ${formatBossLocalStart(bossNextEvent.startsAt)}` : 'NO ACTIVE EVENT';
    ui.bossRankingList.replaceChildren(Object.assign(document.createElement('li'), { className: 'empty', textContent: bossEventLoading ? 'SYNCING GLOBAL DAMAGE...' : 'NO VERIFIED EVENT DATA' }));
    ui.bossPlayerRank.textContent = 'YOUR PLACEMENT APPEARS AFTER YOUR FIRST VERIFIED ASSAULT';
    renderBossRewards();
    return;
  }
  const remainingMs = Math.max(0, Date.parse(bossEvent.endsAt) - bossNow());
  ui.wardenSignalState.textContent = bossEventIsLive(bossEvent) ? `LIVE · ${formatBossCountdown(remainingMs)}` : bossEvent.status === 'victory' ? 'VICTORY' : 'SIGNAL LOST';
  ui.wardenBriefingEyebrow.textContent = bossEvent.status === 'victory' ? 'GLOBAL EVENT COMPLETE' : bossEvent.status === 'failed' ? 'TRANSMISSION ENDED' : 'INCOMING COOPERATIVE ASSAULT';
  ui.wardenBriefingTitle.textContent = bossEvent.status === 'victory' ? 'THE WARDEN HAS FALLEN' : bossEvent.status === 'failed' ? 'THE SIGNAL HAS FADED' : 'THE CROWN STIRS';
  ui.wardenBriefingCopy.textContent = bossEvent.status === 'victory'
    ? 'GLOBAL VICTORY CONFIRMED. QUALIFIED PILOTS MAY CLAIM THE FINAL EVENT REWARD.'
    : bossEvent.status === 'failed'
      ? 'THE EVENT HAS ENDED. EARNED PERSONAL MILESTONES REMAIN CLAIMABLE.'
      : 'PREPARE ONE BLUEPRINT. YOUR ARSENAL RANK WILL POWER EVERY VERIFIED STRIKE.';
  ui.bossEventHp.textContent = `${Number(bossEvent.currentHp).toLocaleString('en-US')} / ${Number(bossEvent.maxHp).toLocaleString('en-US')} HP`;
  const rows = (bossRanking.leaders || []).map(entry => {
    const item = document.createElement('li');
    item.classList.toggle('top-three', Number(entry.rank) <= 3);
    item.classList.toggle('own', Boolean(entry.isCurrent));
    const rank = Object.assign(document.createElement('span'), { className: 'rank', textContent: `#${entry.rank}` });
    const name = document.createElement('strong');
    const profileLink = createPilotProfileLink(entry, 'boss');
    if (profileLink) name.append(profileLink);
    else name.textContent = String(entry.playerName || 'CROWN PILOT').slice(0, 16);
    const damage = Object.assign(document.createElement('span'), { className: 'damage', textContent: Number(entry.damage).toLocaleString('en-US') });
    const attempts = Object.assign(document.createElement('span'), { className: 'attempts', textContent: `${entry.assaults} RUN${entry.assaults === 1 ? '' : 'S'}` });
    item.append(rank, name, damage, attempts);
    return item;
  });
  if (!rows.length) rows.push(Object.assign(document.createElement('li'), { className: 'empty', textContent: 'BE THE FIRST VERIFIED PILOT' }));
  ui.bossRankingList.replaceChildren(...rows);
  ui.bossPlayerRank.textContent = bossRanking.player
    ? `YOUR RANK #${bossRanking.player.rank} · ${Number(bossRanking.player.damage).toLocaleString('en-US')} VERIFIED DAMAGE`
    : 'YOUR PLACEMENT APPEARS AFTER YOUR FIRST VERIFIED ASSAULT';
  renderBossRewards();
};

const loadBossEvent = async () => {
  if (bossEventLoading) return;
  bossEventLoading = true;
  renderBossEvent();
  renderArmory();
  try {
    const recovered = await bossNetwork.resumePending().catch(() => null);
    if (recovered) {
      bossEvent = recovered.event || bossEvent;
      bossRanking = recovered.ranking || bossRanking;
      bossRewardsState = recovered.rewards || bossRewardsState;
    }
    const payload = await bossNetwork.getEvent();
    bossEvent = payload.event || null;
    bossNextEvent = payload.nextEvent || null;
    syncBossServerClock(payload.serverTime);
    bossScheduleLoaded = true;
    bossRanking = payload.ranking || { leaders: [], player: null };
    bossRewardsState = payload.rewards || { playerDamage: 0, qualified: false, rewards: [] };
  } catch {
    if (!bossScheduleLoaded) {
      bossEvent = null;
      bossNextEvent = null;
      bossRanking = { leaders: [], player: null };
      bossRewardsState = { playerDamage: 0, qualified: false, rewards: [] };
    }
  } finally {
    bossEventLoading = false;
    renderBossEvent();
    renderArmory();
  }
};

setInterval(() => {
  const scheduleVisible = !ui.menu.classList.contains('hidden') || !ui.wardenOverlay.classList.contains('hidden');
  if (scheduleVisible && document.visibilityState === 'visible' && !bossEventLoading && !game.active) void loadBossEvent();
}, 30_000);

setInterval(() => {
  if (ui.menu.classList.contains('hidden') && ui.wardenOverlay.classList.contains('hidden')) return;
  renderMenuWarden();
  renderWardenSchedule();
  if (!ui.wardenOverlay.classList.contains('hidden')) {
    const nextStarts = Date.parse(bossNextEvent?.startsAt || '');
    if (bossEventIsLive(bossEvent)) ui.wardenSignalState.textContent = `LIVE · ${formatBossCountdown(Date.parse(bossEvent.endsAt) - bossNow())}`;
    else if (!bossEvent && Number.isFinite(nextStarts) && nextStarts > bossNow()) ui.wardenSignalState.textContent = `NEXT · ${formatBossCountdown(nextStarts - bossNow())}`;
  }
}, 1_000);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !game.active && !bossEventLoading) void loadBossEvent();
});

const renderArmory = () => {
  if (!armory) {
    ui.armoryGrid.replaceChildren();
    ui.armoryOwned.textContent = '0 / 11 AVAILABLE';
    ui.armoryXpFill.style.width = '0%';
    ui.wardenAssault.disabled = true;
    ui.wardenAssault.innerHTML = `<i>♛</i> ${armoryLoading ? 'CONNECTING ARMORY' : 'ARMORY OFFLINE'}`;
    setArmoryStatus(armoryLoading ? 'CONNECTING TO CROWN ARMORY...' : 'ARMORY LINK UNAVAILABLE', !armoryLoading);
    return;
  }
  const progress = armoryRankProgress(armory.progression);
  const selected = armory.blueprints.find(item => item.id === armory.progression.selectedBlueprintId)
    || armory.blueprints.find(item => item.id === armory.standardBlueprintId)
    || armory.blueprints[0];
  const available = armory.blueprints.filter(item => item.access !== 'locked');
  const eventReady = bossEventIsLive(bossEvent);
  const nextStarts = Date.parse(bossNextEvent?.startsAt || '');
  const hasNext = Number.isFinite(nextStarts) && nextStarts > bossNow();
  ui.wardenAssault.disabled = Boolean(armorySelecting || armoryLoading || bossEventLoading || bossAssaultStarting || !selected || !eventReady);
  const eventButtonLabel = bossEvent?.status === 'victory' ? 'VICTORY CONFIRMED' : bossEvent?.status === 'failed' ? 'EVENT ENDED' : hasNext ? 'NEXT EVENT SCHEDULED' : 'EVENT OFFLINE';
  ui.wardenAssault.innerHTML = `<i>♛</i> ${armorySelecting ? 'EQUIPPING...' : bossAssaultStarting ? 'OPENING SIGNAL...' : bossEventLoading ? 'CONNECTING EVENT...' : eventReady ? 'START BOSS ASSAULT' : eventButtonLabel}`;
  ui.wardenAssaultHint.textContent = eventReady
    ? '90 SECOND STRIKE · VERIFIED DAMAGE COUNTS TOWARD GLOBAL HP'
    : bossEvent?.status === 'victory'
      ? 'ASSAULTS CLOSED · CLAIM EARNED EVENT REWARDS BELOW'
      : hasNext
        ? `NEXT ASSAULT · ${formatBossLocalStart(bossNextEvent.startsAt)} · IN ${formatBossCountdown(nextStarts - bossNow())}`
        : 'ASSAULTS CLOSED · EARNED PERSONAL REWARDS REMAIN AVAILABLE';
  ui.armoryRank.textContent = String(progress.rank).padStart(2, '0');
  ui.armoryBonus.textContent = `+${Math.round((Number(armory.progression.damageBonus) || 0) * 100)}% BOSS DMG`;
  ui.armoryXpLabel.textContent = progress.rank >= 10 ? `${progress.xp} XP · MAX RANK` : `${progress.xp} / ${progress.ceiling} XP`;
  ui.armoryXpRemaining.textContent = progress.rank >= 10 ? 'ARSENAL COMPLETE' : `${progress.remaining} TO RANK ${progress.rank + 1}`;
  ui.armoryXpFill.style.width = `${progress.percent}%`;
  ui.armoryOwned.textContent = `${available.length} / ${armory.blueprints.length} AVAILABLE`;
  if (selected) {
    const color = armoryBlueprintColor(selected);
    ui.armorySelected.style.setProperty('--weapon-color', color);
    ui.armorySelectedImage.src = weaponMountUrl(selected.weaponKey);
    ui.armorySelectedImage.alt = `${selected.name} weapon mount`;
    ui.armorySelectedName.textContent = selected.name;
    ui.armorySelectedRole.textContent = selected.role;
    ui.armorySelectedDescription.textContent = selected.description || 'MASTERY BLUEPRINT PREPARED FOR BOSS ASSAULTS.';
  }
  const cards = armory.blueprints.map(blueprint => {
    const card = document.createElement('button');
    const locked = blueprint.access === 'locked';
    const selectedCard = blueprint.id === selected?.id;
    card.type = 'button';
    card.className = `armory-card ${blueprint.access}${locked ? ' locked' : ''}${selectedCard ? ' selected' : ''}`;
    card.style.setProperty('--weapon-color', armoryBlueprintColor(blueprint));
    card.disabled = Boolean(armorySelecting) || locked;
    card.dataset.blueprintId = blueprint.id;
    card.setAttribute('aria-pressed', String(selectedCard));
    card.setAttribute('aria-label', `${blueprint.name}, ${armoryAccessLabel(blueprint.access)}${selectedCard ? ', equipped' : ''}`);
    const image = document.createElement('img');
    image.src = weaponMountUrl(blueprint.weaponKey);
    image.alt = '';
    const copy = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = blueprint.name;
    const role = document.createElement('b');
    role.textContent = blueprint.role;
    const access = document.createElement('small');
    access.textContent = selectedCard ? 'EQUIPPED' : armoryAccessLabel(blueprint.access);
    copy.append(name, role, access);
    card.append(image, copy);
    if (!locked) card.addEventListener('click', () => selectArmoryBlueprint(blueprint.id));
    return card;
  });
  ui.armoryGrid.replaceChildren(...cards);
  if (!armorySelecting) {
    const trialEnds = armory.trial?.endsAt ? new Date(armory.trial.endsAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase() : '';
    setArmoryStatus(trialEnds ? `WEEKLY TRIAL ACTIVE UNTIL ${trialEnds} · MASTER WEAPONS IN ARCADE TO KEEP THEM` : 'MASTER WEAPONS IN ARCADE TO UNLOCK PERMANENT BLUEPRINTS');
  }
};

async function selectArmoryBlueprint(blueprintId) {
  if (!armory || armorySelecting || blueprintId === armory.progression.selectedBlueprintId) return;
  armorySelecting = blueprintId;
  setArmoryStatus('EQUIPPING BLUEPRINT...');
  renderArmory();
  try {
    if (!localPreview) await playerAccount.selectArmoryBlueprint(blueprintId);
    armory.progression.selectedBlueprintId = blueprintId;
    sfx.play('confirm');
    triggerHaptic(18);
    armorySelecting = '';
    renderArmory();
    setArmoryStatus(`${armory.blueprints.find(item => item.id === blueprintId)?.name || 'BLUEPRINT'} EQUIPPED`, false);
  } catch (error) {
    armorySelecting = '';
    renderArmory();
    setArmoryStatus(String(error?.message || 'BLUEPRINT COULD NOT BE EQUIPPED').toUpperCase(), true);
  }
}

const loadArmory = async () => {
  if (armoryLoading) return;
  armoryLoading = true;
  renderArmory();
  try {
    armory = localPreview ? previewArmory() : (await playerAccount.getArmory()).armory;
    renderArmory();
  } catch (error) {
    armory = null;
    setArmoryStatus(String(error?.message || 'ARMORY LINK UNAVAILABLE').toUpperCase(), true);
  } finally {
    armoryLoading = false;
    renderArmory();
  }
};

const openWarden = () => {
  if (!localPreview) armory = null;
  ui.wardenOverlay.classList.remove('hidden');
  renderBossEvent();
  renderArmory();
  void Promise.allSettled([loadArmory(), loadBossEvent()]);
  ui.closeWarden.focus({ preventScroll: true });
};

const closeWarden = () => {
  ui.wardenOverlay.classList.add('hidden');
  selectMenuChoice(ui.menuChoices.indexOf(ui.menuWarden), true);
};

const formatAssaultTime = seconds => {
  const total = Math.max(0, Math.ceil(Number(seconds) || 0));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const selectedAssaultLoadout = () => {
  const blueprint = armory?.blueprints.find(item => item.id === armory?.progression?.selectedBlueprintId);
  const loadout = blueprint && BOSS_BLUEPRINTS[blueprint.id];
  return blueprint && loadout ? { blueprint, loadout } : null;
};

const startBossAssault = async () => {
  const selection = selectedAssaultLoadout();
  if (!selection || !bossEvent || game.active || bossAssaultStarting || bossSettlementPending) return;
  const { blueprint, loadout } = selection;
  bossAssaultStarting = true;
  renderArmory();
  try {
    const payload = await bossNetwork.start({
      eventId: bossEvent.id,
      blueprintId: blueprint.id,
      gameVersion: `${CONFIG.version.release}-${CONFIG.version.build}`,
      arsenalRank: armory.progression.rank,
    });
    activeBossAssault = payload.assault;
    bossNetwork.activeAssault = activeBossAssault;
    bossCheckpointChain = Promise.resolve();
    bossEvent = payload.event || bossEvent;
    bossRanking = payload.ranking || bossRanking;
    renderBossEvent();
  } catch (error) {
    setArmoryStatus(String(error?.message || 'BOSS SIGNAL COULD NOT BE OPENED').toUpperCase(), true);
    bossAssaultStarting = false;
    renderArmory();
    return;
  }
  bossAssaultStarting = false;
  input.clear();
  [ui.menu, ui.gameover, ui.assaultResult, ui.wardenOverlay, ui.pauseOverlay, ui.settingsOverlay, ui.accountOverlay, ui.redeemOverlay, ui.adminOverlay, ui.vaultOverlay, ui.pwaUpdateOverlay, ui.pwaInstallOverlay].forEach(element => element.classList.add('hidden'));
  ui.hud.classList.remove('hidden');
  ui.assaultHud.classList.remove('hidden');
  ui.dashButton.classList.remove('hidden');
  ui.pauseButton.classList.remove('hidden');
  document.documentElement.classList.add('assault-active');
  applyRunShip();
  game.startAssault({
    blueprintId: blueprint.id,
    weaponKey: loadout.weaponKey,
    masteryKey: loadout.masteryKey,
    arsenalRank: activeBossAssault.arsenalRank,
    damageBonus: activeBossAssault.damageBonus,
    globalHp: activeBossAssault.globalHp,
  });
  focusGameInput();
  music.playGame();
  showToast(`${blueprint.name} · ASSAULT READY`, 'weapon', armoryBlueprintColor(blueprint));
};

const showAssaultResult = async result => {
  let retryBlocked = false;
  hideToast();
  ui.assaultHud.classList.add('hidden');
  document.documentElement.classList.remove('assault-active');
  ui.hud.classList.add('hidden');
  ui.dashButton.classList.add('hidden');
  ui.pauseButton.classList.add('hidden');
  ui.assaultResultEyebrow.textContent = 'CROWN NETWORK · VERIFYING STRIKE';
  ui.assaultDamageLabel.textContent = 'REPORTED DAMAGE';
  ui.assaultResultTitle.textContent = result.outcome === 'destroyed' ? 'SIGNAL LOST' : result.outcome === 'breach' ? 'CORE BREACHED' : 'ASSAULT COMPLETE';
  ui.assaultFinalDamage.textContent = Number(result.damage).toLocaleString('en-US');
  ui.assaultFinalTime.textContent = formatAssaultTime(result.elapsed);
  ui.assaultFinalTargets.textContent = String(result.targetsDestroyed);
  ui.assaultFinalRank.textContent = String(result.arsenalRank).padStart(2, '0');
  ui.assaultFinalMultiplier.textContent = 'VERIFYING';
  ui.assaultFinalGlobalHp.textContent = 'SYNCING';
  ui.assaultFinalEventRank.textContent = '—';
  renderAssaultMilestone();
  ui.assaultResultMessage.textContent = 'VERIFYING PHASE DAMAGE · KEEP THIS SCREEN OPEN';
  ui.assaultRetry.disabled = true;
  ui.assaultRetry.innerHTML = '<i>♛</i> TRY AGAIN';
  ui.assaultArmory.disabled = true;
  ui.assaultRetry.classList.add('result-selected');
  ui.assaultArmory.classList.remove('result-selected');
  ui.assaultResult.classList.remove('hidden');
  music.pause();
  ui.assaultRetry.focus({ preventScroll: true });
  if (!activeBossAssault) {
    ui.assaultResultEyebrow.textContent = 'CROWN NETWORK · UNVERIFIED';
    ui.assaultResultMessage.textContent = 'NO SERVER ASSAULT WAS ISSUED · DAMAGE NOT ADDED';
    ui.assaultRetry.disabled = false;
    ui.assaultArmory.disabled = false;
    return;
  }
  bossSettlementPending = true;
  try {
    await bossCheckpointChain;
    const payload = await bossNetwork.settle({
      assaultId: activeBossAssault.assaultId,
      checkpointToken: activeBossAssault.checkpointToken,
      requestId: crypto.randomUUID(),
      elapsedMs: Math.round(result.elapsed * 1000),
      phaseDamage: result.phaseDamage,
      outcome: result.outcome,
      targetsDestroyed: result.targetsDestroyed,
    });
    const settlement = payload.settlement;
    bossEvent = payload.event || bossEvent;
    bossRanking = payload.ranking || bossRanking;
    bossRewardsState = payload.rewards || bossRewardsState;
    ui.assaultResultEyebrow.textContent = 'CROWN NETWORK · STRIKE VERIFIED';
    ui.assaultDamageLabel.textContent = 'VERIFIED DAMAGE';
    ui.assaultFinalDamage.textContent = Number(settlement.effectiveDamage).toLocaleString('en-US');
    ui.assaultFinalMultiplier.textContent = `×${Number(settlement.attemptMultiplier).toFixed(2)}`;
    ui.assaultFinalGlobalHp.textContent = Number(settlement.globalHp).toLocaleString('en-US');
    ui.assaultFinalEventRank.textContent = bossRanking.player ? `#${bossRanking.player.rank}` : '—';
    renderAssaultMilestone();
    ui.assaultResultMessage.textContent = settlement.eventDefeated
      ? 'THE GLOBAL WARDEN HAS FALLEN · EVENT VICTORY CONFIRMED'
      : `${Number(settlement.playerTotalDamage).toLocaleString('en-US')} TOTAL EVENT DAMAGE · ATOMIC SETTLEMENT COMPLETE`;
    renderBossEvent();
  } catch (error) {
    ui.assaultResultEyebrow.textContent = 'CROWN NETWORK · VERIFICATION FAILED';
    retryBlocked = !error?.status;
    ui.assaultResultMessage.textContent = retryBlocked
      ? 'STRIKE SAVED ON THIS DEVICE · RETURN TO ARMORY TO RETRY THE SAME SETTLEMENT'
      : `${String(error?.message || 'STRIKE NOT SETTLED').toUpperCase()} · DAMAGE NOT ADDED`;
    if (retryBlocked) ui.assaultRetry.innerHTML = '<i>♛</i> WAITING FOR NETWORK';
  } finally {
    activeBossAssault = null;
    bossSettlementPending = false;
    ui.assaultRetry.disabled = retryBlocked;
    ui.assaultArmory.disabled = false;
    if (retryBlocked) {
      ui.assaultRetry.classList.remove('result-selected');
      ui.assaultArmory.classList.add('result-selected');
      ui.assaultArmory.focus({ preventScroll: true });
    }
  }
};

const renderVaultOddsVisibility = () => {
  ui.vaultOdds.classList.toggle('hidden', !vaultOddsExpanded);
  ui.vaultOddsToggle.setAttribute('aria-expanded', String(vaultOddsExpanded));
  ui.vaultOddsToggle.querySelector('b').textContent = vaultOddsExpanded ? 'HIDE · ▲' : 'VIEW · ▼';
};

const storeProductForCosmetic = cosmeticId => storeCatalog.find(product => product.type === 'cosmetic' && product.cosmeticId === cosmeticId);
const isDefaultCosmetic = cosmetic => Boolean(cosmetic?.source?.includes('default'));
const equippedCosmeticId = (state, cosmetic) => cosmetic?.slot === 'ship'
  ? state.inventory.equipped.ship
  : cosmetic?.weaponKey ? state.inventory.equipped.weapons?.[cosmetic.weaponKey] : '';
const cosmeticCategory = cosmetic => cosmetic?.slot === 'ship' ? 'ship' : cosmetic?.slot?.startsWith('weapon_') ? 'weapon' : '';

const renderVaultMode = () => {
  const storeSelected = vaultMode === 'store';
  const marketSelected = vaultMode === 'market';
  ui.vaultCratesTab.classList.toggle('selected', !storeSelected && !marketSelected);
  ui.vaultStoreTab.classList.toggle('selected', storeSelected);
  ui.vaultMarketTab.classList.toggle('selected', marketSelected);
  ui.vaultCratesTab.setAttribute('aria-selected', String(!storeSelected && !marketSelected));
  ui.vaultStoreTab.setAttribute('aria-selected', String(storeSelected));
  ui.vaultMarketTab.setAttribute('aria-selected', String(marketSelected));
  ui.vaultBody.classList.toggle('hidden', storeSelected || marketSelected);
  ui.vaultStore.classList.toggle('hidden', !storeSelected);
  ui.vaultMarket.classList.toggle('hidden', !marketSelected);
};

const renameAvailability = () => {
  const renamedAt = playerProfile?.lastRenamedAt ? new Date(playerProfile.lastRenamedAt).getTime() : 0;
  const availableAt = renamedAt ? renamedAt + 7 * 24 * 60 * 60 * 1000 : 0;
  return { available: !availableAt || availableAt <= Date.now(), availableAt };
};

const openStoreRename = () => {
  if (currentAccountState() !== 'signed-in' || !playerProfile) {
    storeMessage = 'SECURE YOUR PLAYER ACCOUNT AND CLAIM A CALLSIGN FIRST';
    ui.storeStatus.textContent = storeMessage;
    return;
  }
  const availability = renameAvailability();
  if (!availability.available) {
    storeMessage = `CALLSIGN CHANGE AVAILABLE ${new Date(availability.availableAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}`;
    ui.storeStatus.textContent = storeMessage;
    return;
  }
  ui.storeCurrentCallsign.textContent = playerProfile.displayName;
  ui.storeCallsignInput.value = '';
  ui.storeRenameStatus.textContent = '';
  ui.storeRename.classList.remove('hidden');
  ui.storeCallsignInput.focus({ preventScroll: true });
};

const renderStore = () => {
  const state = walletState();
  if (!storeCatalogLoaded && !localPreview) {
    ui.storeCatalog.replaceChildren();
    ui.storeStatus.textContent = storeCatalogLoading ? 'STORE LINK CONNECTING...' : 'STORE CATALOG UNAVAILABLE';
    return;
  }
  const cards = storeCatalog.map(product => {
    const tier = RARITY_BY_KEY[product.rarity] || RARITY_BY_KEY.standard;
    const cosmetic = product.cosmeticId ? COSMETIC_BY_ID[product.cosmeticId] : null;
    const owned = cosmetic ? Boolean(state.inventory.cosmetics[cosmetic.id]) : false;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `store-product${owned ? ' owned' : ''}${product.type === 'service' ? ' service' : ''}`;
    card.dataset.storeSku = product.sku;
    if (cosmetic) card.dataset.cosmeticId = cosmetic.id;
    card.style.setProperty('--tier-color', tier.color);
    const visual = cosmetic ? document.createElement('img') : document.createElement('span');
    if (cosmetic) {
      visual.src = cosmeticSpriteUrl(cosmetic);
      visual.alt = '';
    } else {
      visual.className = 'store-service-mark';
      visual.innerHTML = '<b>ABC</b><i>↻</i>';
    }
    const copy = document.createElement('span');
    const rarity = document.createElement('small');
    rarity.textContent = product.type === 'service' ? 'PLAYER SERVICE' : `${tier.name} · STORE EXCLUSIVE`;
    const name = document.createElement('strong');
    name.textContent = product.name;
    const description = document.createElement('em');
    description.textContent = product.description;
    const action = document.createElement('b');
    if (owned) action.textContent = 'OWNED · VIEW';
    else if (product.type === 'service') {
      const availability = renameAvailability();
      action.textContent = currentAccountState() !== 'signed-in'
        ? 'ACCOUNT REQUIRED'
        : availability.available ? `CHANGE · ◆ ${product.price.toLocaleString('en-US')}` : 'COOLDOWN ACTIVE';
    } else action.textContent = `VIEW · ◆ ${product.price.toLocaleString('en-US')}`;
    copy.append(rarity, name, description, action);
    card.append(visual, copy);
    card.disabled = storeBusySku === product.sku;
    card.setAttribute('aria-label', `${product.name}, ${owned ? 'owned' : `${product.price} shards`}`);
    card.addEventListener('click', () => cosmetic ? showCosmeticDetail(cosmetic.id, 'store') : openStoreRename());
    return card;
  });
  ui.storeCatalog.replaceChildren(...cards);
  if (!storeBusySku) ui.storeStatus.textContent = storeMessage || 'SELECT AN ITEM TO INSPECT BEFORE PURCHASE';
};

const loadCrownStore = async () => {
  if (localPreview || storeCatalogLoading || storeCatalogLoaded) return;
  storeCatalogLoading = true;
  renderStore();
  try {
    const payload = await playerAccount.getStore();
    acceptServerWallet(payload);
    storeCatalog = (payload.products || []).filter(product => product.type === 'service' || COSMETIC_BY_ID[product.cosmeticId]);
    storeCatalogLoaded = true;
  } catch {
    storeMessage = 'STORE LINK FAILED · TRY AGAIN';
  } finally {
    storeCatalogLoading = false;
    renderVault();
  }
};

const marketBounds = rarity => ({ uncommon: [50, 750], rare: [100, 1500], royal: [200, 3000], mythic: [400, 6000], sovereign: [1000, 15000] }[rarity] || [50, 15000]);
const previewMarket = () => {
  const now = Date.now();
  const expiresAt = new Date(now + 7 * 86400000).toISOString();
  return {
    rules: { feePercent: 10, maxActiveListings: 5, listingDays: 7 },
    listings: [
      { id: 'preview-1', cosmeticId: 'ship_void_hunter', price: 430, rarity: 'rare', sellerName: 'NOVA_7', createdAt: new Date(now - 3200000).toISOString(), expiresAt },
      { id: 'preview-2', cosmeticId: 'weapon_laser_void_lance', price: 3250, rarity: 'mythic', sellerName: 'RIFTKING', createdAt: new Date(now - 7300000).toISOString(), expiresAt },
      { id: 'preview-3', cosmeticId: 'ship_royal_vanguard', price: 1750, rarity: 'royal', sellerName: 'PIXELFOX', createdAt: new Date(now - 9200000).toISOString(), expiresAt },
    ],
    myListings: [],
    activity: [
      { id: 'preview-activity-1', kind: 'sold', cosmeticId: 'ship_ember_runner', amount: 675, fee: 75, counterparty: 'BYTEFOX', occurredAt: new Date(now - 5400000).toISOString() },
      { id: 'preview-activity-2', kind: 'bought', cosmeticId: 'weapon_tesla_storm_crown', amount: -980, fee: 0, counterparty: 'NOVA_7', occurredAt: new Date(now - 86400000).toISOString() },
      { id: 'preview-activity-3', kind: 'expired', cosmeticId: 'ship_crystal_dart', amount: 0, fee: 0, counterparty: null, occurredAt: new Date(now - 172800000).toISOString() },
    ],
    signals: [
      { id: '123e4567-e89b-42d3-a456-426614174010', cosmeticId: 'ship_ember_runner', price: 750, fee: 75, sellerPayout: 675, buyerName: 'BYTEFOX', createdAt: new Date(now - 5400000).toISOString() },
    ],
  };
};

const marketTimeLeft = expiresAt => {
  const remaining = Date.parse(expiresAt || '') - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) return 'EXPIRING';
  if (remaining >= 86400000) return `${Math.ceil(remaining / 86400000)}D LEFT`;
  return `${Math.max(1, Math.ceil(remaining / 3600000))}H LEFT`;
};

const marketAge = occurredAt => {
  const elapsed = Math.max(0, Date.now() - Date.parse(occurredAt || ''));
  if (!Number.isFinite(elapsed) || elapsed < 3600000) return 'JUST NOW';
  if (elapsed < 86400000) return `${Math.floor(elapsed / 3600000)}H AGO`;
  return `${Math.floor(elapsed / 86400000)}D AGO`;
};

const renderMarketSignal = () => {
  const signals = marketData.signals || [];
  const latest = signals.at(-1);
  const visible = Boolean(latest);
  ui.marketSaleSignal.classList.toggle('hidden', !visible);
  ui.marketSignalBadge.classList.toggle('hidden', !visible);
  if (!latest) return;
  const cosmetic = COSMETIC_BY_ID[latest.cosmeticId];
  const payout = signals.reduce((sum, signal) => sum + Math.max(0, Number(signal.sellerPayout) || 0), 0);
  ui.marketSaleSignal.style.setProperty('--tier-color', RARITY_BY_KEY[cosmetic?.rarity]?.color || '#ffd36b');
  ui.marketSaleSignalImage.src = cosmetic ? cosmeticSpriteUrl(cosmetic) : '';
  ui.marketSaleSignalImage.alt = cosmetic?.name || 'Sold cosmetic';
  ui.marketSaleSignalTitle.textContent = signals.length === 1 ? `${cosmetic?.name || 'ITEM'} SOLD` : `${signals.length} ITEMS SOLD`;
  ui.marketSaleSignalCopy.textContent = signals.length === 1
    ? `PILOT ${latest.buyerName} · ◆ ${latest.fee.toLocaleString('en-US')} MARKET FEE`
    : `LATEST: ${cosmetic?.name || 'ITEM'} · ALL PAYOUTS ALREADY SECURED`;
  ui.marketSaleSignalAmount.textContent = `+ ◆ ${payout.toLocaleString('en-US')}`;
  ui.acknowledgeMarketSignal.disabled = marketBusy;
  ui.acknowledgeMarketSignal.innerHTML = `<i>♛</i> ${marketBusy ? 'SYNCING...' : 'ACKNOWLEDGE'}`;
};

const renderMarketActivity = () => {
  const labels = { bought: 'BOUGHT', sold: 'SOLD', cancelled: 'CANCELLED', expired: 'EXPIRED' };
  const rows = (marketData.activity || []).map(item => {
    const cosmetic = COSMETIC_BY_ID[item.cosmeticId]; if (!cosmetic) return null;
    const row = document.createElement('article'); row.className = `market-activity-row ${item.kind}`;
    row.style.setProperty('--tier-color', RARITY_BY_KEY[cosmetic.rarity]?.color || '#9dfbe0');
    const image = document.createElement('img'); image.src = cosmeticSpriteUrl(cosmetic); image.alt = '';
    const copy = document.createElement('div');
    const label = document.createElement('small'); label.textContent = labels[item.kind] || 'MARKET';
    const name = document.createElement('strong'); name.textContent = cosmetic.name;
    const detail = document.createElement('span');
    detail.textContent = item.kind === 'sold' ? `TO ${item.counterparty || 'PILOT'} · FEE ◆ ${item.fee.toLocaleString('en-US')}`
      : item.kind === 'bought' ? `FROM ${item.counterparty || 'PILOT'}`
        : item.kind === 'expired' ? 'ITEM RETURNED TO COLLECTION' : 'ITEM RETURNED';
    copy.append(label, name, detail);
    const value = document.createElement('div'); value.className = 'market-activity-value';
    const amount = document.createElement('b'); amount.textContent = item.amount ? `${item.amount > 0 ? '+' : '−'} ◆ ${Math.abs(item.amount).toLocaleString('en-US')}` : '◆ 0';
    const age = document.createElement('em'); age.textContent = marketAge(item.occurredAt);
    value.append(amount, age); row.append(image, copy, value); return row;
  }).filter(Boolean);
  ui.marketActivity.replaceChildren(...rows);
};

const openMarketOrder = (type, item) => {
  const cosmetic = COSMETIC_BY_ID[item.cosmeticId];
  if (!cosmetic) return;
  marketOrder = { type, item };
  const tier = RARITY_BY_KEY[cosmetic.rarity];
  ui.marketConfirmImage.src = cosmeticSpriteUrl(cosmetic);
  ui.marketConfirmImage.alt = cosmetic.name;
  ui.marketConfirmTitle.textContent = type === 'list' ? `LIST ${cosmetic.name}` : type === 'cancel' ? `CANCEL ${cosmetic.name}` : `BUY ${cosmetic.name}`;
  ui.marketConfirmCopy.textContent = type === 'list' ? 'SET A SHARD PRICE. THE ITEM IS RESERVED FOR 7 DAYS OR UNTIL SOLD OR CANCELLED.' : type === 'cancel' ? 'RETURN THIS ITEM TO YOUR COLLECTION?' : `BUY FROM ${item.sellerName} FOR ◆ ${item.price.toLocaleString('en-US')}?`;
  ui.marketPriceLabel.classList.toggle('hidden', type !== 'list');
  const [minimum, maximum] = marketBounds(cosmetic.rarity);
  ui.marketPriceInput.min = String(minimum); ui.marketPriceInput.max = String(maximum); ui.marketPriceInput.value = String(Math.round((minimum + maximum) / 2));
  ui.marketConfirmHint.textContent = type === 'list' ? `${tier.name} RANGE · ◆ ${minimum.toLocaleString('en-US')}–${maximum.toLocaleString('en-US')} · 10% FEE ON SALE` : type === 'buy' ? 'PURCHASES ARE FINAL · COSMETICS ONLY' : 'NO FEE · NO SHARDS SPENT';
  ui.marketConfirmStatus.textContent = '';
  ui.marketConfirmSubmit.innerHTML = `<i>♛</i> ${type === 'list' ? 'CREATE LISTING' : type === 'buy' ? `BUY · ◆ ${item.price.toLocaleString('en-US')}` : 'CANCEL LISTING'}`;
  ui.marketConfirm.classList.remove('hidden');
  (type === 'list' ? ui.marketPriceInput : ui.marketConfirmSubmit).focus({ preventScroll: true });
};

const renderMarket = () => {
  const state = walletState();
  [ui.marketBrowseTab, ui.marketSellTab, ui.marketMineTab, ui.marketActivityTab].forEach((tab, index) => {
    const selected = ['browse', 'sell', 'mine', 'activity'][index] === marketMode;
    tab.classList.toggle('selected', selected); tab.setAttribute('aria-selected', String(selected));
  });
  ui.marketFilters.classList.toggle('hidden', marketMode !== 'browse');
  ui.marketCatalog.classList.toggle('hidden', marketMode === 'activity');
  ui.marketActivity.classList.toggle('hidden', marketMode !== 'activity');
  ui.marketCategoryFilter.value = marketCategoryFilter;
  ui.marketRarityFilter.value = marketRarityFilter;
  ui.marketSortFilter.value = marketSortFilter;
  ui.marketHideOwned.setAttribute('aria-checked', String(marketHideOwned));
  ui.marketHideOwned.querySelector('b').textContent = marketHideOwned ? 'ON' : 'OFF';
  let items = [...marketData.listings];
  if (marketMode === 'browse') {
    items = items.filter(item => {
      const cosmetic = COSMETIC_BY_ID[item.cosmeticId];
      if (!cosmetic) return false;
      const category = cosmetic.slot === 'ship' ? 'ship' : 'weapon';
      return (marketCategoryFilter === 'all' || category === marketCategoryFilter)
        && (marketRarityFilter === 'all' || cosmetic.rarity === marketRarityFilter)
        && (!marketHideOwned || !state.inventory.cosmetics[cosmetic.id]);
    });
    const newestFirst = (a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0);
    items.sort(marketSortFilter === 'price-low'
      ? (a, b) => a.price - b.price || newestFirst(a, b)
      : marketSortFilter === 'price-high'
        ? (a, b) => b.price - a.price || newestFirst(a, b)
        : newestFirst);
  }
  if (marketMode === 'sell') items = CRATE_COSMETICS.filter(cosmetic => state.inventory.cosmetics[cosmetic.id]).map(cosmetic => ({ cosmeticId: cosmetic.id, rarity: cosmetic.rarity, sellable: true }));
  if (marketMode === 'mine') items = marketData.myListings.filter(item => item.status === 'active');
  if (marketMode === 'activity') items = [];
  const cards = items.map(item => {
    const cosmetic = COSMETIC_BY_ID[item.cosmeticId]; if (!cosmetic) return null;
    const tier = RARITY_BY_KEY[cosmetic.rarity]; const card = document.createElement('button'); card.type = 'button';
    const active = item.status ? item.status === 'active' : true;
    const owned = Boolean(state.inventory.cosmetics[cosmetic.id]);
    card.className = `market-card${active ? '' : ' market-final'}${marketMode === 'browse' && owned ? ' owned' : ''}`; card.style.setProperty('--tier-color', tier.color); card.dataset.cosmeticId = cosmetic.id;
    const mine = marketMode === 'mine'; const equipped = equippedCosmeticId(state, cosmetic) === cosmetic.id;
    const descriptor = item.sellerName ? `PILOT ${item.sellerName}` : cosmetic.slot === 'ship' ? 'SHIP CHASSIS' : `${cosmetic.weaponKey.toUpperCase()} SKIN`;
    const expiry = item.expiresAt ? marketTimeLeft(item.expiresAt) : '';
    card.innerHTML = `<img src="${cosmeticSpriteUrl(cosmetic)}" alt=""><span><small>${tier.name}${item.status ? ` · ${item.status.toUpperCase()}` : ''}</small><strong>${cosmetic.name}</strong><em>${descriptor}${expiry ? ` · ${expiry}` : ''}</em><b>${item.sellable ? equipped ? 'EQUIPPED · UNEQUIP TO SELL' : 'SET YOUR PRICE' : mine ? active ? `CANCEL · ◆ ${item.price.toLocaleString('en-US')}` : `◆ ${item.price.toLocaleString('en-US')}` : owned ? 'OWNED · NOT AVAILABLE' : `BUY · ◆ ${item.price.toLocaleString('en-US')}`}</b></span>`;
    card.disabled = marketBusy || (item.sellable && equipped) || (mine && !active) || (marketMode === 'browse' && owned);
    card.addEventListener('click', () => openMarketOrder(item.sellable ? 'list' : mine ? 'cancel' : 'buy', item));
    return card;
  }).filter(Boolean);
  ui.marketCatalog.replaceChildren(...cards);
  renderMarketActivity();
  renderMarketSignal();
  const filtersActive = marketCategoryFilter !== 'all' || marketRarityFilter !== 'all' || marketHideOwned;
  const activityCount = marketData.activity?.length || 0;
  ui.marketStatus.textContent = marketLoading ? 'MARKET SIGNAL CONNECTING...'
    : marketMode === 'activity' ? (activityCount ? `${activityCount} RECENT MARKET EVENTS · SERVER VERIFIED` : 'NO MARKET ACTIVITY YET')
      : !cards.length ? (marketMode === 'sell' ? 'NO UNEQUIPPED CRATE COSMETICS READY TO SELL' : marketMode === 'mine' ? 'YOU HAVE NO ACTIVE LISTINGS' : filtersActive ? 'NO LISTINGS MATCH THESE FILTERS' : 'NO ACTIVE LISTINGS · CHECK BACK SOON')
        : marketMode === 'browse' ? `${cards.length} OF ${marketData.listings.length} LISTINGS · THE MARKET SETS THE PRICE`
          : marketMode === 'sell' ? 'SELECT AN ITEM · LISTINGS EXPIRE AFTER 7 DAYS' : 'ACTIVE LISTINGS CAN BE CANCELLED AT ANY TIME';
};

const loadCrownMarket = async () => {
  if (marketLoading) return;
  if (localPreview) { if (!marketLoaded) marketData = previewMarket(); marketLoaded = true; renderMarket(); return; }
  marketLoading = true; renderMarket();
  try { const payload = await playerAccount.getMarket(); if (payload.wallet) acceptServerWallet(payload); marketData = payload.market; marketLoaded = true; }
  catch { ui.marketStatus.textContent = 'MARKET LINK FAILED · TRY AGAIN'; }
  finally { marketLoading = false; renderMarket(); }
};

const renderVault = () => {
  const state = walletState();
  const preferences = cosmeticPreferences.getState();
  const favoriteIds = new Set(preferences.favorites);
  const account = accountPresentation();
  const categoryCosmetics = COLLECTION_COSMETICS.filter(cosmetic => cosmeticCategory(cosmetic) === vaultCategory);
  const collectibleCosmetics = categoryCosmetics.filter(cosmetic => !isDefaultCosmetic(cosmetic));
  const owned = collectibleCosmetics.filter(cosmetic => Boolean(state.inventory.cosmetics[cosmetic.id]));
  ui.vaultBalance.textContent = `◆ ${state.balance.toLocaleString('en-US')}`;
  ui.vaultSyncStatus.dataset.state = account.state;
  ui.vaultSyncStatus.textContent = serverEconomy && !serverEconomyReady ? 'CLOUD VAULT · CONNECTING' : account.vaultStatus;
  ui.vaultCollectionTitle.textContent = vaultCategory === 'weapon' ? 'WEAPON SKINS' : 'SHIP COLLECTION';
  ui.vaultOwned.textContent = `${owned.length} / ${collectibleCosmetics.length}`;
  ui.cosmeticCategoryTabs.forEach(tab => {
    const category = tab.dataset.cosmeticCategory;
    const selected = category === vaultCategory;
    const newCount = COLLECTION_COSMETICS.filter(cosmetic => {
      if (cosmeticCategory(cosmetic) !== category) return false;
      const acquisition = state.inventory.cosmetics[cosmetic.id];
      return ['shop', 'market'].includes(acquisition?.source) && !acquisition.seenAt;
    }).length;
    const categoryStatus = tab.querySelector('[data-category-status]');
    const statusText = newCount ? `${newCount} NEW` : (tab.dataset.categoryMeta || '');
    tab.classList.toggle('selected', selected);
    tab.classList.toggle('has-new', newCount > 0);
    tab.setAttribute('aria-selected', String(selected));
    tab.setAttribute('aria-label', `${tab.dataset.categoryLabel || category}${newCount ? `, ${newCount} new` : ''}`);
    if (categoryStatus) {
      categoryStatus.textContent = statusText;
      categoryStatus.classList.toggle('hidden', !statusText);
    }
  });
  ui.vaultGuarantee.textContent = `${state.vault.sinceSovereign} / ${SOVEREIGN_GUARANTEE}`;
  ui.vaultGuaranteeFill.style.width = `${state.vault.sinceSovereign / SOVEREIGN_GUARANTEE * 100}%`;
  ui.vaultOdds.replaceChildren(...COSMETIC_TIERS.map(tier => {
    const row = document.createElement('div');
    row.style.setProperty('--tier-color', tier.color);
    const name = document.createElement('span');
    name.textContent = tier.name;
    const odds = document.createElement('b');
    odds.textContent = `${tier.odds}%`;
    row.append(name, odds);
    return row;
  }));
  ui.vaultCollection.replaceChildren(...categoryCosmetics.map(cosmetic => {
    const acquired = isDefaultCosmetic(cosmetic) || Boolean(state.inventory.cosmetics[cosmetic.id]);
    const equipped = equippedCosmeticId(state, cosmetic) === cosmetic.id;
    const storeExclusive = STORE_PRODUCTS.some(product => product.cosmeticId === cosmetic.id);
    const acquisition = state.inventory.cosmetics[cosmetic.id];
    const isNew = ['shop', 'market'].includes(acquisition?.source) && !acquisition.seenAt;
    const favorite = cosmetic.slot === 'ship' && acquired && favoriteIds.has(cosmetic.id);
    const tier = RARITY_BY_KEY[cosmetic.rarity];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `vault-cosmetic ${acquired ? 'owned' : 'locked'}${equipped ? ' equipped' : ''}${storeExclusive ? ' store-exclusive' : ''}${isNew ? ' new' : ''}`;
    card.dataset.cosmeticId = cosmetic.id;
    card.setAttribute('aria-label', `${cosmetic.name}, ${tier.name}, ${acquired ? 'owned' : 'locked'}${favorite ? ', favorite' : ''}${isNew ? ', new' : ''}`);
    card.style.setProperty('--tier-color', tier.color);
    const image = document.createElement('img');
    image.src = cosmeticSpriteUrl(cosmetic);
    image.alt = '';
    const copy = document.createElement('span');
    const name = document.createElement('b');
    name.textContent = cosmetic.name;
    const rarity = document.createElement('small');
    rarity.textContent = equipped ? 'EQUIPPED' : !acquired && storeExclusive ? 'CROWN STORE' : tier.name;
    copy.append(name, rarity);
    card.append(image, copy);
    if (favorite) {
      const marker = document.createElement('em');
      marker.className = 'favorite-mark';
      marker.textContent = '★';
      marker.setAttribute('aria-hidden', 'true');
      card.append(marker);
    }
    card.addEventListener('click', () => showCosmeticDetail(cosmetic.id, 'collection'));
    return card;
  }));
  ui.randomFavoriteToggle.classList.toggle('hidden', vaultCategory !== 'ship');
  ui.randomFavoriteToggle.setAttribute('aria-checked', String(preferences.randomFavorite));
  ui.randomFavoriteToggle.querySelector('b').textContent = preferences.randomFavorite ? 'ON' : 'OFF';
  ui.randomFavoriteToggle.disabled = !preferences.favorites.some(id => id === 'ship_default' || Boolean(state.inventory.cosmetics[id]));
  const freeCrateCredits = Math.max(0, Number(state.vault.freeCrateCredits) || 0);
  const hasFreeCrate = freeCrateCredits > 0;
  const missing = Math.max(0, CROWN_CRATE_COST - state.balance);
  ui.openCrate.disabled = crateOpening || (serverEconomy && !serverEconomyReady) || Boolean(state.vault.pendingReward) || (!hasFreeCrate && missing > 0);
  ui.openCrate.innerHTML = hasFreeCrate
    ? `<i>♛</i> OPEN FREE CRATE · ${freeCrateCredits} SAVED`
    : missing
      ? `<i>♛</i> NEED ◆ ${missing.toLocaleString('en-US')}`
      : `<i>♛</i> OPEN WITH ◆ ${CROWN_CRATE_COST}`;
  ui.vaultStatus.textContent = serverEconomy && !serverEconomyReady
    ? 'PLAYER WALLET CONNECTING'
    : hasFreeCrate
    ? 'REWARD CREDIT READY · STANDARD ODDS AND PITY'
    : missing
    ? 'EARN SHARDS BY COMPLETING QUALIFIED RUNS'
    : state.vault.opens === 0
      ? 'FIRST OPENING GUARANTEED NEW'
      : state.vault.sinceSovereign >= SOVEREIGN_GUARANTEE - 1
        ? 'NEXT CRATE GUARANTEED SOVEREIGN'
        : 'DUPLICATES SALVAGE AUTOMATICALLY';
  const sponsoredOffer = localPreview ? shardWallet.getPendingSponsoredOffer() : null;
  ui.crownCrate.classList.toggle('signal-ready', Boolean(sponsoredOffer));
  ui.crownCrateSprite.src = crateOpening
    ? crateSpriteUrl('open')
    : sponsoredOffer
      ? crateSpriteUrl('signal')
      : crateSpriteUrl('closed');
  ui.vaultSponsoredSignal.classList.toggle('hidden', !sponsoredOffer);
  ui.vaultWatchAd.classList.toggle('hidden', !sponsoredOffer?.eligible);
  ui.vaultWatchAd.disabled = rewardedAdViewing || !sponsoredOffer?.eligible;
  if (sponsoredOffer?.eligible) {
    ui.vaultSponsoredStatus.textContent = `1 FREE OPEN SAVED · ${sponsoredOffer.remainingToday} OF ${sponsoredOffer.dailyLimit} LEFT TODAY`;
  } else if (sponsoredOffer?.reason === 'DAILY_LIMIT_REACHED') {
    ui.vaultSponsoredStatus.textContent = '1 FREE OPEN SAVED · AVAILABLE TOMORROW';
  } else if (sponsoredOffer) {
    ui.vaultSponsoredStatus.textContent = '1 FREE OPEN SAVED · FINISH CURRENT REVEAL';
  }
  ui.vaultAnimationToggle.setAttribute('aria-checked', String(vaultAnimationEnabled));
  ui.vaultAnimationToggle.querySelector('b').textContent = vaultAnimationEnabled ? 'ON' : 'OFF';
  renderVaultMode();
  renderStore();
  renderMarket();
  renderShardBalance();
};

const acknowledgeNewCosmetic = cosmeticId => {
  const acquisition = walletState().inventory.cosmetics[cosmeticId];
  if (!['shop', 'market'].includes(acquisition?.source) || acquisition.seenAt) return;
  if (localPreview) {
    shardWallet.markCosmeticSeen(cosmeticId);
    renderVault();
    return;
  }
  acquisition.seenAt = new Date().toISOString();
  renderVault();
  void playerAccount.markCosmeticSeen(cosmeticId).catch(() => {
    acquisition.seenAt = null;
    renderVault();
  });
};

const showCosmeticDetail = (cosmeticId, origin = vaultMode === 'store' ? 'store' : 'collection') => {
  const cosmetic = COSMETIC_BY_ID[cosmeticId];
  if (!cosmetic) return;
  const tier = RARITY_BY_KEY[cosmetic.rarity];
  const state = walletState();
  const acquired = isDefaultCosmetic(cosmetic) || Boolean(state.inventory.cosmetics[cosmetic.id]);
  const equipped = equippedCosmeticId(state, cosmetic) === cosmetic.id;
  const weaponSkin = cosmetic.slot.startsWith('weapon_');
  const favorite = cosmeticPreferences.getState().favorites.includes(cosmetic.id);
  const storeProduct = storeProductForCosmetic(cosmetic.id);
  const storeExclusive = Boolean(storeProduct);
  selectedCosmeticDetailId = cosmetic.id;
  selectedCosmeticOrigin = origin;
  ui.cosmeticDetail.style.setProperty('--tier-color', tier.color);
  ui.cosmeticDetailImage.src = cosmeticSpriteUrl(cosmetic);
  ui.cosmeticDetailPreview.classList.toggle('weapon-preview', weaponSkin);
  ui.cosmeticDetailPreview.dataset.weapon = cosmetic.weaponKey || '';
  ui.cosmeticDetailPreview.style.setProperty('--weapon-primary', cosmetic.palette?.primary || tier.color);
  ui.cosmeticDetailPreview.style.setProperty('--weapon-core', cosmetic.palette?.core || '#ffffff');
  ui.cosmeticDetailPreview.style.setProperty('--weapon-glow', cosmetic.palette?.glow || tier.color);
  ui.cosmeticDetailTier.textContent = tier.name;
  ui.cosmeticDetailName.textContent = cosmetic.name;
  ui.cosmeticDetailStatus.textContent = acquired ? 'OWNED' : storeExclusive ? 'DIRECT SALE' : 'LOCKED';
  ui.cosmeticDetailStatus.classList.toggle('owned', acquired);
  ui.cosmeticDetail.classList.toggle('detail-owned', acquired);
  ui.cosmeticDetail.classList.toggle('detail-store', storeExclusive);
  ui.cosmeticDetailHint.textContent = acquired
    ? (equipped ? (weaponSkin ? `ACTIVE ${cosmetic.weaponKey.toUpperCase()} SKIN` : 'ACTIVE SHIP CHASSIS') : 'READY FOR YOUR NEXT RUN')
    : storeExclusive ? 'STORE EXCLUSIVE · NEVER DROPS FROM CRATES' : 'AVAILABLE IN CROWN CRATES';
  ui.equipCosmetic.classList.toggle('hidden', !acquired && !storeExclusive);
  ui.favoriteCosmetic.classList.toggle('hidden', !acquired || weaponSkin);
  ui.favoriteCosmetic.setAttribute('aria-pressed', String(favorite));
  ui.favoriteCosmetic.innerHTML = favorite ? '<i>★</i> REMOVE FAVORITE' : '<i>☆</i> ADD FAVORITE';
  if (!acquired && storeProduct) {
    const missing = Math.max(0, storeProduct.price - state.balance);
    ui.equipCosmetic.disabled = Boolean(storeBusySku) || missing > 0 || (serverEconomy && !serverEconomyReady);
    ui.equipCosmetic.innerHTML = missing
      ? `<i>♛</i> NEED ◆ ${missing.toLocaleString('en-US')}`
      : `<i>♛</i> BUY · ◆ ${storeProduct.price.toLocaleString('en-US')}`;
  } else {
    ui.equipCosmetic.disabled = equipped;
    ui.equipCosmetic.innerHTML = equipped ? '<i>♛</i> EQUIPPED' : '<i>♛</i> EQUIP';
  }
  ui.closeCosmeticDetail.innerHTML = origin === 'store' ? '<i>♛</i> BACK TO STORE' : '<i>♛</i> BACK TO COLLECTION';
  ui.cosmeticDetail.classList.remove('hidden');
  (acquired ? (weaponSkin ? ui.equipCosmetic : ui.favoriteCosmetic) : storeExclusive ? ui.equipCosmetic : ui.closeCosmeticDetail).focus({ preventScroll: true });
  if (origin === 'collection') acknowledgeNewCosmetic(cosmetic.id);
};

const closeCosmeticDetail = () => {
  ui.cosmeticDetail.classList.add('hidden');
  const origin = selectedCosmeticOrigin === 'store' ? ui.storeCatalog : ui.vaultCollection;
  origin.querySelector(`[data-cosmetic-id="${selectedCosmeticDetailId}"]`)?.focus({ preventScroll: true });
};

const showStorePurchaseReveal = (cosmeticId, source = 'store') => {
  const cosmetic = COSMETIC_BY_ID[cosmeticId];
  const tier = cosmetic ? RARITY_BY_KEY[cosmetic.rarity] : null;
  if (!cosmetic || !tier) return;
  ui.cosmeticDetail.classList.add('hidden');
  ui.storePurchaseReveal.style.setProperty('--tier-color', tier.color);
  ui.storePurchaseImage.src = cosmeticSpriteUrl(cosmetic);
  ui.storePurchaseImage.alt = `Purchased ${cosmetic.slot.startsWith('weapon_') ? `${cosmetic.weaponKey} weapon skin` : 'ship chassis'}: ${cosmetic.name}`;
  purchaseRevealReturn = source;
  ui.storePurchaseTier.textContent = `${tier.name} · ${source === 'market' ? 'CROWN MARKET ACQUISITION' : 'STORE EXCLUSIVE'}`;
  ui.storePurchaseName.textContent = cosmetic.name;
  ui.storePurchaseReveal.classList.remove('hidden');
  void ui.storePurchaseReveal.offsetWidth;
  ui.storePurchaseContinue.focus({ preventScroll: true });
};

const closeStorePurchaseReveal = () => {
  ui.storePurchaseReveal.classList.add('hidden');
  ui.cosmeticDetail.classList.add('hidden');
  renderVault();
  const returnGrid = purchaseRevealReturn === 'market' ? ui.marketCatalog : ui.storeCatalog;
  returnGrid.querySelector(`[data-cosmetic-id="${selectedCosmeticDetailId}"]`)?.focus({ preventScroll: true });
};

const playCrateOpeningCinematic = async ({ signal = false, tier = 'uncommon' } = {}) => {
  if (!vaultAnimationEnabled) return;
  const tierColor = RARITY_BY_KEY[tier]?.color || '#ffd36b';
  ui.crateOpeningCinematic.style.setProperty('--crate-tier-color', tierColor);
  ui.cinematicCrateSprite.src = signal
    ? crateSpriteUrl('signal')
    : crateSpriteUrl('closed');
  ui.crateCinematicText.textContent = signal ? 'SPONSORED SIGNAL CHARGING' : 'VAULT SEAL CHARGING';
  ui.crateOpeningCinematic.className = 'crate-opening-cinematic charging';
  void ui.crateOpeningCinematic.offsetWidth;
  await wait(reducedEffects ? 90 : 720);
  ui.cinematicCrateSprite.src = crateSpriteUrl('open');
  ui.crateCinematicText.textContent = 'CROWN CRATE OPEN';
  ui.crateOpeningCinematic.className = 'crate-opening-cinematic bursting';
  void ui.crateOpeningCinematic.offsetWidth;
  await wait(reducedEffects ? 100 : 390);
  ui.crateCinematicText.textContent = 'REWARD IDENTIFIED';
  ui.crateOpeningCinematic.className = 'crate-opening-cinematic receding';
  void ui.crateOpeningCinematic.offsetWidth;
  await wait(reducedEffects ? 90 : 480);
  ui.crateOpeningCinematic.className = 'crate-opening-cinematic hidden';
};

const showCrateReveal = outcome => {
  const cosmetic = COSMETIC_BY_ID[outcome.cosmeticId];
  const tier = RARITY_BY_KEY[outcome.tier];
  if (!cosmetic || !tier) return;
  ui.crateReveal.classList.remove(...COSMETIC_TIERS.map(item => `tier-${item.key}`));
  ui.crateReveal.classList.add(`tier-${tier.key}`);
  ui.crateReveal.style.setProperty('--tier-color', tier.color);
  ui.revealShip.src = cosmeticSpriteUrl(cosmetic);
  const weaponSkin = cosmetic.slot.startsWith('weapon_');
  ui.revealShip.alt = `Unlocked ${weaponSkin ? `${cosmetic.weaponKey} weapon skin` : 'ship chassis'}: ${cosmetic.name}`;
  ui.revealEyebrow.textContent = outcome.duplicate
    ? 'DUPLICATE DETECTED'
    : outcome.guaranteedSovereign
      ? 'SOVEREIGN GUARANTEE'
      : outcome.freeCredit ? 'REWARD CRATE' : outcome.source === 'sponsored' ? 'SPONSORED CRATE' : 'CRATE OPENED';
  ui.revealTier.textContent = tier.name;
  ui.revealName.textContent = cosmetic.name;
  ui.revealMessage.textContent = outcome.duplicate
    ? `SALVAGE VALUE · ◆ ${outcome.salvageValue}`
    : weaponSkin ? 'NEW WEAPON SKIN ACQUIRED' : 'NEW CHASSIS ACQUIRED';
  ui.revealContinue.innerHTML = outcome.duplicate ? `<i>♛</i> SALVAGE · +◆ ${outcome.salvageValue}` : '<i>♛</i> CONTINUE';
  ui.crateReveal.classList.remove('hidden');
  void ui.crateReveal.offsetWidth;
  sfx.play(`vault-${tier.key}`);
  if (hapticsEnabled && hapticsSupported) {
    const patterns = { rare: [28], royal: [35, 35, 45], mythic: [45, 30, 70], sovereign: [45, 35, 45, 35, 100] };
    if (patterns[tier.key]) triggerHaptic(patterns[tier.key]);
  }
  ui.revealContinue.focus({ preventScroll: true });
};

const closeCrateReveal = () => {
  if (localPreview) shardWallet.salvagePending();
  ui.crateReveal.classList.add('hidden');
  renderVault();
  if (crateRevealReturn === 'gameover') {
    const offer = localPreview && lastSponsoredClaimedRunId
      ? shardWallet.getSponsoredOffer(lastSponsoredClaimedRunId)
      : localPreview ? shardWallet.getPendingSponsoredOffer() : null;
    renderSponsoredOffer(offer);
    const balance = ui.shardReward.querySelector('.shard-balance b');
    if (balance) balance.textContent = walletState().balance.toLocaleString('en-US');
    selectResultChoice(0, true);
  } else {
    const vaultFocus = !ui.vaultWatchAd.classList.contains('hidden') ? ui.vaultWatchAd : ui.openCrate;
    vaultFocus.focus({ preventScroll: true });
  }
  crateRevealReturn = 'vault';
};

const openVault = () => {
  crateRevealReturn = 'vault';
  if (!crownCrateOpenPreload) {
    crownCrateOpenPreload = new Image();
    crownCrateOpenPreload.src = crateSpriteUrl('open');
  }
  vaultOddsExpanded = false;
  renderVault();
  renderVaultOddsVisibility();
  ui.vaultOverlay.classList.remove('hidden');
  if (serverEconomy && !serverEconomyReady) void connectServerEconomy().then(() => renderVault());
  if (serverEconomy && !storeCatalogLoaded) void loadCrownStore();
  const pending = walletState().vault.pendingReward;
  if (pending) showCrateReveal(pending);
  else ui.openCrate.focus({ preventScroll: true });
};

const closeVault = () => {
  if (crateOpening) return;
  if (localPreview) shardWallet.salvagePending();
  ui.crateReveal.classList.add('hidden');
  ui.cosmeticDetail.classList.add('hidden');
  ui.vaultOverlay.classList.add('hidden');
  renderShardBalance();
  selectMenuChoice(ui.menuChoices.indexOf(ui.menuVault), true);
};
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
    if (button.dataset.setting === 'haptics' && !hapticsSupported) {
      button.disabled = true;
      button.setAttribute('aria-pressed', 'false');
      button.querySelector('b').textContent = 'UNAVAILABLE';
      return;
    }
    const enabled = values[button.dataset.setting];
    button.setAttribute('aria-pressed', String(enabled));
    button.querySelector('b').textContent = enabled ? 'ON' : 'OFF';
  });
  ui.sound.classList.toggle('off', !music.enabled);
  document.documentElement.classList.toggle('dash-left', dashSide === 'left');
  ui.accountBadge.textContent = accountPresentation().badge;
  const profileVisibilityAvailable = currentAccountState() === 'signed-in' && Boolean(playerProfile?.publicId);
  ui.openOwnProfile.classList.toggle('hidden', !profileVisibilityAvailable);
  ui.openOwnProfile.querySelector('b').textContent = playerProfile?.isPublic === false ? 'PRIVATE' : 'VIEW';
  ui.profileVisibility.classList.toggle('hidden', !profileVisibilityAvailable);
  ui.profileVisibility.disabled = profileStatus === 'loading';
  ui.profileVisibility.setAttribute('aria-pressed', String(playerProfile?.isPublic !== false));
  ui.profileVisibility.querySelector('b').textContent = profileStatus === 'loading' ? 'SYNCING' : playerProfile?.isPublic === false ? 'OFF' : 'ON';
  const permanentAccount = currentAccountState() === 'signed-in';
  ui.openRedeem.classList.toggle('hidden', !permanentAccount);
  ui.openAdmin.classList.toggle('hidden', !permanentAccount || !adminAccess);
  ui.installApp.classList.toggle('hidden', !pwaManager?.installAvailable);
  ui.updateApp.classList.toggle('hidden', !pwaUpdateReady);
  renderMenuIdentity();
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

const previewPilotProfile = publicProfileId => {
  const slug = String(publicProfileId || '').split(':').at(-1).replace(/[^a-z0-9_]/gi, '').toUpperCase() || 'CROWN_PILOT';
  const seeds = [...slug].reduce((total, character) => total + character.charCodeAt(0), 0);
  const ships = ['ship_void_hunter', 'ship_solar_guard', 'ship_royal_vanguard', 'ship_rift_phantom', 'ship_crown_sovereign'];
  return {
    publicId: publicProfileId,
    displayName: slug.slice(0, 10),
    joined: '2026-08',
    equippedShip: ships[seeds % ships.length],
    arsenalRank: Math.min(10, 3 + seeds % 8),
    duelHistory: [
      { outcome: 'win', score: 68420, rivalScore: 63110, opponent: 'VOIDLIZARD' },
      { outcome: 'loss', score: 51980, rivalScore: 54200, opponent: 'PIXELACE' },
      { outcome: 'draw', score: 47750, rivalScore: 47750, opponent: 'NOVA_KING' },
    ],
    stats: {
      bestScores: {
        chill: { score: 72000 + seeds * 31, zone: 5 },
        arcade: { score: 118000 + seeds * 73, zone: 8 },
        crowned: { score: 43000 + seeds * 19, zone: 4 },
      },
      highestZone: 8 + seeds % 5,
      qualifiedRuns: 12 + seeds % 47,
      bossBestDamage: 8000 + seeds * 17,
      bossTotalDamage: 42000 + seeds * 89,
    },
  };
};

const renderPilotProfile = profile => {
  activePilotProfile = profile;
  const stats = profile.stats || {};
  const bestScores = stats.bestScores || {};
  const cosmetic = COSMETIC_BY_ID[profile.equippedShip] || COSMETIC_BY_ID.ship_default;
  ui.pilotProfileShip.src = cosmeticSpriteUrl(cosmetic);
  ui.pilotProfileShip.alt = `${profile.displayName} ship, ${cosmetic.name}`;
  ui.pilotProfileName.textContent = profile.displayName || 'CROWN PILOT';
  ui.pilotProfileJoined.textContent = profile.joined ? `JOINED ${profile.joined}` : 'REGISTERED PILOT';
  ui.pilotProfileArsenal.textContent = `ARSENAL RANK ${String(Number(profile.arsenalRank) || 0).padStart(2, '0')}`;
  [['chill', ui.pilotBestChill], ['arcade', ui.pilotBestArcade], ['crowned', ui.pilotBestCrowned]].forEach(([difficulty, element]) => {
    const score = Number(bestScores[difficulty]?.score) || 0;
    element.textContent = score ? score.toLocaleString('en-US') : '—';
  });
  ui.pilotHighestZone.textContent = String(Number(stats.highestZone) || 0).padStart(2, '0');
  ui.pilotQualifiedRuns.textContent = Number(stats.qualifiedRuns || 0).toLocaleString('en-US');
  ui.pilotBossBest.textContent = Number(stats.bossBestDamage || 0).toLocaleString('en-US');
  ui.pilotBossTotal.textContent = Number(stats.bossTotalDamage || 0).toLocaleString('en-US');
  const duels = Array.isArray(profile.duelHistory) ? profile.duelHistory : [];
  ui.pilotDuelHistory.replaceChildren(...(duels.length ? duels.map(duel => {
    const row = document.createElement('div');
    row.dataset.outcome = duel.outcome || 'no_contest';
    const outcome = document.createElement('b');
    outcome.textContent = duel.outcome === 'win' ? 'W' : duel.outcome === 'loss' ? 'L' : duel.outcome === 'draw' ? 'D' : '—';
    const rival = document.createElement('span');
    rival.textContent = `VS ${duel.opponent || 'CROWN PILOT'}`;
    const score = document.createElement('strong');
    score.textContent = `${Number(duel.score || 0).toLocaleString('en-US')} · ${Number(duel.rivalScore || 0).toLocaleString('en-US')}`;
    row.append(outcome, rival, score);
    return row;
  }) : [Object.assign(document.createElement('p'), { textContent: 'NO VERIFIED DUELS YET' })]));
  ui.pilotProfileLoading.classList.add('hidden');
  ui.pilotProfileContent.classList.remove('hidden');
  ui.pilotProfileStatus.textContent = `${cosmetic.name} · VERIFIED CROWN NETWORK STATS`;
  ui.pilotProfileShareStatus.textContent = '';
  ui.sharePilotProfile.classList.toggle('hidden', !profile.publicId);
};

const closePilotProfile = () => {
  pilotProfileGeneration += 1;
  ui.pilotProfileOverlay.classList.add('hidden');
  activePilotProfile = null;
  if (pilotDeepLinkActive) {
    const cleanUrl = new URL(location.href);
    cleanUrl.searchParams.delete('pilot');
    history.replaceState(null, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
    debugParams.delete('pilot');
    pilotDeepLinkActive = false;
  }
  if (pilotProfileOrigin === 'settings') ui.settingsOverlay.classList.remove('hidden');
  const triggerRoot = pilotProfileOrigin === 'boss' ? ui.bossRankingList : ui.leaderboardList;
  const restoredTrigger = pilotProfileTrigger?.isConnected
    ? pilotProfileTrigger
    : pilotProfileOrigin === 'settings'
      ? ui.openOwnProfile
      : [...triggerRoot.querySelectorAll('.pilot-profile-link')].find(button => button.getAttribute('aria-label') === pilotProfileTriggerLabel);
  if (restoredTrigger) requestAnimationFrame(() => restoredTrigger.focus({ preventScroll: true }));
  pilotProfileTrigger = null;
  pilotProfileTriggerLabel = '';
};

const openPilotProfile = async (publicProfileId, trigger, origin = 'leaderboard') => {
  if (!publicProfileId) return;
  const generation = ++pilotProfileGeneration;
  pilotProfileOrigin = origin;
  pilotProfileTrigger = trigger || null;
  pilotProfileTriggerLabel = trigger?.getAttribute?.('aria-label') || '';
  ui.pilotProfileContent.classList.add('hidden');
  ui.pilotProfileLoading.classList.remove('hidden');
  ui.pilotProfileLoading.textContent = 'LOCATING PILOT SIGNAL...';
  ui.pilotProfileStatus.textContent = '';
  ui.pilotProfileShareStatus.textContent = '';
  ui.sharePilotProfile.classList.add('hidden');
  ui.closePilotProfile.innerHTML = `<i>♛</i> ${origin === 'boss' ? 'BACK TO WARDEN' : origin === 'settings' ? 'BACK TO SETTINGS' : origin === 'direct' ? 'BACK TO MENU' : 'BACK TO SCORES'}`;
  ui.pilotProfileOverlay.classList.remove('hidden');
  try {
    const payload = String(publicProfileId).startsWith('preview:')
      ? { profile: previewPilotProfile(publicProfileId) }
      : await playerAccount.getPublicProfile(publicProfileId);
    if (generation !== pilotProfileGeneration) return;
    renderPilotProfile(payload.profile);
    triggerHaptic(18);
  } catch {
    if (generation !== pilotProfileGeneration) return;
    ui.pilotProfileLoading.textContent = 'PILOT SIGNAL UNAVAILABLE';
    ui.pilotProfileStatus.textContent = 'THE PROFILE IS PRIVATE OR TEMPORARILY OFFLINE';
  }
  ui.closePilotProfile.focus({ preventScroll: true });
};

const pilotProfileUrl = publicId => {
  const url = new URL(location.origin + location.pathname);
  url.searchParams.set('pilot', publicId);
  return url.toString();
};

const copyPilotProfileUrl = async url => {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(url);
  const field = document.createElement('textarea');
  field.value = url;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.append(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  if (!copied) throw new Error('Clipboard unavailable');
};

const sharePilotProfile = async () => {
  if (!activePilotProfile?.publicId) return;
  const url = pilotProfileUrl(activePilotProfile.publicId);
  ui.sharePilotProfile.disabled = true;
  try {
    if (navigator.share && !localPreview) {
      await navigator.share({ title: `${activePilotProfile.displayName} · Crown Lizard`, text: 'View my Crown Lizard Pilot File.', url });
      ui.pilotProfileShareStatus.textContent = 'PILOT LINK SHARED';
    } else {
      await copyPilotProfileUrl(url);
      ui.pilotProfileShareStatus.textContent = 'PILOT LINK COPIED';
    }
    triggerHaptic(18);
  } catch (error) {
    ui.pilotProfileShareStatus.textContent = error?.name === 'AbortError' ? '' : 'SHARING UNAVAILABLE · TRY AGAIN';
  } finally {
    ui.sharePilotProfile.disabled = false;
  }
};

const pilotProfileIdFor = entry => entry?.publicProfileId
  || (localPreview && String(entry?.playerName || entry?.initials || '').length > 3
    ? `preview:${String(entry.playerName || entry.initials).toLowerCase()}`
    : null);

const createPilotProfileLink = (entry, origin) => {
  const profileId = pilotProfileIdFor(entry);
  if (!profileId) return null;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pilot-profile-link';
  button.textContent = entry.playerName || entry.initials || 'CROWN PILOT';
  button.setAttribute('aria-label', `View ${button.textContent} pilot profile`);
  button.addEventListener('click', () => openPilotProfile(profileId, button, origin));
  return button;
};

const DUEL_RECONNECT_KEY = 'cl:duel-room:v1';
let duelChallenge = null;
let duelChallenges = [];
let duelBusy = false;
let duelPollTimer = 0;
let duelHeartbeatTimer = 0;
let duelClockTimer = 0;
let duelCountdownTimer = 0;
let duelProgressTimer = 0;
let duelGameplayActive = false;
let duelRunComplete = false;
let duelFinalScore = 0;
let duelFinishPending = null;

const duelAccountReady = () => currentAccountState() === 'signed-in' && Boolean(playerProfile?.displayName);
const duelShipUrl = shipId => cosmeticSpriteUrl(COSMETIC_BY_ID[shipId] || COSMETIC_BY_ID.ship_default || { id: 'ship_default' });
const duelInviteUrl = code => {
  const url = new URL(location.origin + location.pathname);
  url.searchParams.set('duel', code);
  return url.toString();
};
const duelTimeLeft = expiresAt => formatBossCountdown(Date.parse(expiresAt || '') - Date.now());
const setDuelStatus = (message = '', error = false) => {
  ui.duelStatus.textContent = message;
  ui.duelStatus.classList.toggle('error', error);
};
const setDuelBusy = busy => {
  duelBusy = busy;
  [ui.duelCreate, ui.duelRefresh, ui.duelReady, ui.duelLeave, ui.duelRematch].forEach(button => { button.disabled = busy; });
};
const saveDuelReconnect = challenge => {
  try {
    if (challenge?.challengeId && ['waiting', 'matched'].includes(challenge.status) && challenge.viewerRole !== 'spectator') {
      localStorage.setItem(DUEL_RECONNECT_KEY, JSON.stringify({ challengeId: challenge.challengeId, inviteCode: challenge.inviteCode || '' }));
    } else localStorage.removeItem(DUEL_RECONNECT_KEY);
  } catch {}
};
const readDuelReconnect = () => {
  try {
    const value = JSON.parse(localStorage.getItem(DUEL_RECONNECT_KEY) || 'null');
    return publicProfileIdPattern.test(String(value?.challengeId || '')) ? value : null;
  } catch { return null; }
};
const stopDuelSignals = () => {
  clearInterval(duelPollTimer);
  clearInterval(duelHeartbeatTimer);
  clearInterval(duelClockTimer);
  clearInterval(duelCountdownTimer);
  clearInterval(duelProgressTimer);
  duelPollTimer = duelHeartbeatTimer = duelClockTimer = duelCountdownTimer = duelProgressTimer = 0;
};
const renderDuelPilot = (card, image, name, state, pilot, waiting = false) => {
  const connected = Boolean(pilot?.connected ?? true);
  card.classList.toggle('waiting', waiting || !pilot);
  card.classList.toggle('ready', Boolean(pilot?.ready));
  card.dataset.state = !pilot || waiting ? 'waiting' : connected ? 'connected' : 'offline';
  image.src = duelShipUrl(pilot?.equippedShip || 'ship_default');
  name.textContent = pilot?.callsign || 'OPEN SEAT';
  state.textContent = !pilot || waiting ? 'AWAITING SIGNAL' : pilot.ready ? 'READY' : connected ? 'CONNECTED' : 'RECONNECTING';
};
const renderDuelBlueprints = challenge => {
  const offer = Array.isArray(challenge?.blueprintOffer) ? challenge.blueprintOffer : [];
  ui.duelBlueprintList.replaceChildren(...offer.map(blueprintId => {
    const blueprint = DUEL_BLUEPRINT_BY_ID[blueprintId];
    if (!blueprint) return document.createTextNode('');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `duel-blueprint${challenge.selectedBlueprint === blueprintId ? ' selected' : ''}`;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(challenge.selectedBlueprint === blueprintId));
    button.disabled = duelBusy || Boolean(challenge.match);
    const image = document.createElement('img');
    image.src = `./assets/weapons/${blueprint.weaponKey}-mount-v1.png`;
    image.alt = '';
    const name = Object.assign(document.createElement('strong'), { textContent: blueprint.name });
    const role = Object.assign(document.createElement('small'), { textContent: blueprint.role });
    button.append(image, name, role);
    button.addEventListener('click', () => { void selectDuelBlueprint(blueprintId); });
    return button;
  }));
  ui.duelBlueprintPicker.classList.toggle('hidden', !offer.length);
};
const updateDuelClock = () => {
  if (!duelChallenge) return;
  ui.duelRoomTimer.textContent = duelTimeLeft(duelChallenge.expiresAt);
};
const renderDuelRoom = () => {
  const challenge = duelChallenge;
  ui.duelBrowser.classList.toggle('hidden', Boolean(challenge));
  ui.duelRoom.classList.toggle('hidden', !challenge);
  if (!challenge) return;
  renderDuelPilot(ui.duelHostCard, ui.duelHostShip, ui.duelHostName, ui.duelHostState, challenge.host);
  renderDuelPilot(ui.duelGuestCard, ui.duelGuestShip, ui.duelGuestName, ui.duelGuestState, challenge.guest, !challenge.guest);
  renderDuelBlueprints(challenge);
  ui.duelRoomState.textContent = challenge.match?.phase === 'countdown' ? 'MATCH SIGNAL LOCKED'
    : challenge.match?.phase === 'active' ? 'DUEL IN PROGRESS'
      : challenge.match?.phase === 'finished' ? 'DUEL SIGNAL COMPLETE'
        : challenge.status === 'matched' ? challenge.allReady ? 'BOTH PILOTS READY' : 'RIVAL SIGNAL LOCKED' : 'WAITING FOR RIVAL';
  ui.duelShare.classList.toggle('hidden', !challenge.inviteCode);
  const ownPilot = challenge.viewerRole === 'guest' ? challenge.guest : challenge.host;
  ui.duelReady.setAttribute('aria-pressed', String(Boolean(ownPilot?.ready)));
  ui.duelReady.innerHTML = ownPilot?.ready ? '<i>♛</i> READY · STAND BY' : '<i>♛</i> READY UP';
  ui.duelReady.disabled = duelBusy || !challenge.selectedBlueprint || Boolean(challenge.match) || !['waiting', 'matched'].includes(challenge.status);
  ui.duelRoomNote.textContent = challenge.match?.phase === 'countdown' ? 'MIRRORED WAVE SIGNAL LOCKED · PREPARE TO LAUNCH'
    : challenge.match?.phase === 'active' ? '90-SECOND SCORE RACE IN PROGRESS'
      : challenge.match?.phase === 'finished' ? 'PROVISIONAL SIGNAL COMPLETE · PASS 4 WILL VERIFY THE WINNER'
        : challenge.guest ? 'CHOOSE A BLUEPRINT · BOTH PILOTS READY TO LAUNCH' : 'SHARE THE LINK OR WAIT FOR AN OPEN CHALLENGER';
  ui.duelLeave.innerHTML = challenge.match ? '<i>♛</i> BACK TO MENU'
    : challenge.viewerRole === 'host' ? '<i>♛</i> CLOSE CHALLENGE' : '<i>♛</i> LEAVE LOBBY';
  updateDuelClock();
  saveDuelReconnect(challenge);
  if (challenge.match && !duelGameplayActive && !duelRunComplete) queueMicrotask(() => syncDuelMatch(challenge));
};
const renderDuelResult = challenge => {
  const match = challenge?.match;
  if (!match || !duelRunComplete) return;
  const own = Number(match.yourScore ?? duelFinalScore) || 0;
  const rival = Number(match.rivalScore) || 0;
  ui.duelResultOwn.textContent = own.toLocaleString('en-US');
  ui.duelResultRival.textContent = rival.toLocaleString('en-US');
  if (match.verification !== 'final') {
    ui.duelResultEyebrow.textContent = 'CROWN NETWORK · VERIFYING';
    ui.duelResultTitle.textContent = 'VERIFYING DUEL';
    ui.duelResultGap.textContent = match.rivalVerification === 'pending' ? 'WAITING FOR RIVAL SIGNAL' : 'CHECKING RUN TELEMETRY';
    ui.duelResultMessage.textContent = 'YOUR SCORE IS FROZEN · NETWORK RECOVERY IS ACTIVE';
    ui.duelRematch.classList.add('hidden');
    return;
  }
  const invalid = match.yourVerification === 'invalid';
  const gap = Math.abs(own - rival).toLocaleString('en-US');
  ui.duelResultEyebrow.textContent = invalid ? 'CROWN NETWORK · NO CONTEST' : 'CROWN NETWORK · VERIFIED';
  ui.duelResultTitle.textContent = invalid ? 'RUN INVALID' : match.winner === 'draw' ? 'DRAW' : match.winner === 'you' ? 'VICTORY' : 'DEFEAT';
  ui.duelResultGap.textContent = invalid ? 'RESULT NOT RANKED' : match.winner === 'draw' ? 'PERFECT SCORE TIE' : `${match.winner === 'you' ? 'WIN' : 'LOSS'} BY ${gap}`;
  ui.duelResultMessage.textContent = invalid ? 'THE SERVER COULD NOT VERIFY ENOUGH RUN TELEMETRY' : `ROUND ${String(match.round || 1).padStart(2, '0')} · BOTH RUNS VERIFIED`;
  ui.duelRematch.classList.remove('hidden');
  ui.duelRematch.innerHTML = match.yourRematch ? '<i>♛</i> REMATCH SENT · WAITING' : '<i>♛</i> REMATCH';
  ui.duelRematch.disabled = duelBusy || Boolean(match.yourRematch);
};
const setDuelChallenge = challenge => {
  duelChallenge = challenge && ['waiting', 'matched'].includes(challenge.status) ? challenge : null;
  renderDuelRoom();
  renderDuelResult(duelChallenge);
};
const previewDuelHost = (callsign, ship = 'ship_void_hunter') => ({ callsign, publicId: `preview:${callsign.toLowerCase()}`, equippedShip: ship, ready: false, connected: true });
const previewDuelBlueprintOffer = ['blaster_royal_barrage', 'pulse_comet_cores', 'tesla_storm_web'];
const previewDuelOpenChallenges = () => {
  const expiresAt = new Date(Date.now() + 9 * 60_000).toISOString();
  return [
    { challengeId: 'b1000000-0000-4000-8000-000000000001', status: 'waiting', expiresAt, host: previewDuelHost('VOIDLIZARD', 'ship_void_hunter') },
    { challengeId: 'b1000000-0000-4000-8000-000000000002', status: 'waiting', expiresAt, host: previewDuelHost('PIXELACE', 'ship_royal_vanguard') },
    { challengeId: 'b1000000-0000-4000-8000-000000000003', status: 'waiting', expiresAt, host: previewDuelHost('NOVA_KING', 'ship_solar_guard') },
  ];
};
const renderDuelChallenges = () => {
  ui.duelChallengeList.replaceChildren();
  if (!duelChallenges.length) {
    const empty = document.createElement('div');
    empty.className = 'duel-challenge-empty';
    empty.textContent = 'NO OPEN SIGNALS · CREATE THE FIRST CHALLENGE';
    ui.duelChallengeList.append(empty);
    return;
  }
  duelChallenges.forEach(challenge => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'duel-challenge';
    button.disabled = duelBusy || !duelAccountReady();
    const image = document.createElement('img');
    image.src = duelShipUrl(challenge.host?.equippedShip || 'ship_default');
    image.alt = '';
    const identity = document.createElement('span');
    const callsign = document.createElement('strong');
    callsign.textContent = challenge.host?.callsign || 'CROWN PILOT';
    const rule = document.createElement('small');
    rule.textContent = 'UNRANKED · NORMALIZED';
    identity.append(callsign, rule);
    const action = document.createElement('b');
    action.textContent = `JOIN · ${duelTimeLeft(challenge.expiresAt)}`;
    button.append(image, identity, action);
    button.addEventListener('click', () => joinDuelChallenge(challenge.challengeId, false));
    ui.duelChallengeList.append(button);
  });
};
const refreshDuelChallenges = async (quiet = false) => {
  if (!quiet) setDuelStatus('SCANNING CROWN NETWORK...');
  try {
    duelChallenges = duelPreviewMode ? previewDuelOpenChallenges() : (await playerAccount.listPvpChallenges()).challenges || [];
    renderDuelChallenges();
    if (!quiet) setDuelStatus(duelAccountReady() ? 'SELECT A SIGNAL OR CREATE YOUR OWN' : 'SIGN IN AND CHOOSE A CALLSIGN TO ENTER');
  } catch { if (!quiet) setDuelStatus('DUEL SIGNALS TEMPORARILY UNAVAILABLE', true); }
};
const previewJoinedDuel = host => ({
  challengeId: host.challengeId, inviteCode: 'CRWNDUEL', status: 'matched', viewerRole: 'guest',
  createdAt: new Date().toISOString(), expiresAt: host.expiresAt,
  host: { ...host.host, ready: false, connected: true },
  guest: { callsign: playerProfile?.displayName || 'CROWNACE', publicId: playerProfile?.publicId, equippedShip: walletState().inventory?.equipped?.ship || 'ship_default', ready: false, connected: true },
  allReady: false, blueprintOffer: previewDuelBlueprintOffer, selectedBlueprint: null, opponentBlueprint: 'pulse_comet_cores', match: null,
});
const updateDuelLiveHud = state => {
  if (!state?.duel) return;
  ui.duelLiveOwnScore.textContent = Number(state.score || 0).toLocaleString('en-US');
  ui.duelLiveTime.textContent = duelTimeLabel(state.duel.remaining);
  ui.duelLiveRivalScore.textContent = Number(duelChallenge?.match?.rivalScore || 0).toLocaleString('en-US');
  const rivalSignalAt = Date.parse(duelChallenge?.match?.rivalSignalAt || '');
  const signalAge = Date.now() - rivalSignalAt;
  ui.duelLiveSignal.textContent = duelPreviewMode || !Number.isFinite(rivalSignalAt) || signalAge < 7_000 ? 'LIVE SIGNAL'
    : signalAge < 20_000 ? 'SIGNAL DELAY' : 'RIVAL OFFLINE';
};
const transmitDuelProgress = async final => {
  if (!duelChallenge?.match || !game.duel) return;
  const score = Math.max(0, Math.floor(game.score || duelFinalScore || 0));
  const elapsedMs = Math.max(0, Math.min(90_000, Math.round(game.duel.elapsed * 1000)));
  try {
    if (duelPreviewMode) {
      const elapsed = elapsedMs / 1000;
      const rivalScore = Math.floor(elapsed * 680 + Math.pow(elapsed, 1.32) * 43);
      duelChallenge = { ...duelChallenge, match: { ...duelChallenge.match, yourScore: score, rivalScore, phase: final || elapsedMs >= 90_000 ? 'finished' : 'active' } };
    } else {
      const payload = await playerAccount.submitPvpProgress(duelChallenge.challengeId, score, elapsedMs, game.runStats?.enemies || 0);
      if (payload.challenge) duelChallenge = payload.challenge;
    }
    ui.duelLiveRivalScore.textContent = Number(duelChallenge.match?.rivalScore || 0).toLocaleString('en-US');
    updateDuelLiveHud(game.snapshot());
  } catch { ui.duelLiveSignal.textContent = 'RECONNECTING'; }
};
const beginDuelGameplay = challenge => {
  if (duelGameplayActive || !challenge?.match?.seed || !challenge.selectedBlueprint) return;
  clearInterval(duelCountdownTimer);
  duelCountdownTimer = 0;
  const elapsedSeconds = Math.max(0, Math.min(89.5, (Date.now() - Date.parse(challenge.match.startAt)) / 1000));
  duelGameplayActive = true;
  duelRunComplete = false;
  duelFinalScore = 0;
  input.clear();
  ui.duelCountdown.classList.add('hidden');
  ui.duelOverlay.classList.add('hidden');
  ui.duelResult.classList.add('hidden');
  ui.menu.classList.add('hidden');
  ui.gameover.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  ui.duelHud.classList.remove('hidden');
  ui.assaultHud.classList.add('hidden');
  ui.dashButton.classList.remove('hidden');
  ui.pauseButton.classList.add('hidden');
  document.documentElement.classList.add('duel-active');
  applyRunShip();
  ui.duelLiveRivalName.textContent = (challenge.viewerRole === 'guest' ? challenge.host : challenge.guest)?.callsign || 'RIVAL';
  ui.duelLiveRivalScore.textContent = Number(challenge.match.rivalScore || 0).toLocaleString('en-US');
  game.reducedEffects = reducedEffects;
  game.startDuel({ seed: challenge.match.seed, blueprintId: challenge.selectedBlueprint, elapsedSeconds, endAt: Date.parse(challenge.match.endAt) });
  clearInterval(duelProgressTimer);
  duelProgressTimer = setInterval(() => { void transmitDuelProgress(false); }, 1800);
  music.playGame();
  focusGameInput();
};
function syncDuelMatch(challenge) {
  if (!challenge?.match || duelGameplayActive || duelRunComplete || duelCountdownTimer) return;
  const startAt = Date.parse(challenge.match.startAt || '');
  const endAt = Date.parse(challenge.match.endAt || '');
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) return;
  if (Date.now() >= endAt || challenge.match.phase === 'finished') return;
  if (Date.now() >= startAt || challenge.match.phase === 'active') return beginDuelGameplay(challenge);
  const blueprint = DUEL_BLUEPRINT_BY_ID[challenge.selectedBlueprint];
  ui.duelCountdownLoadout.textContent = `${blueprint?.name || 'NORMALIZED LOADOUT'} · SAME WAVES`;
  ui.duelCountdown.classList.remove('hidden');
  const tick = () => {
    const remaining = startAt - Date.now();
    ui.duelCountdownValue.textContent = remaining <= 550 ? 'GO' : String(Math.max(1, Math.ceil(remaining / 1000)));
    if (remaining <= 0) {
      clearInterval(duelCountdownTimer);
      duelCountdownTimer = 0;
      beginDuelGameplay(challenge);
    }
  };
  tick();
  duelCountdownTimer = setInterval(tick, 100);
}
const completeDuelRun = async summary => {
  duelFinalScore = Math.max(0, Math.floor(summary?.score || game.score || 0));
  clearInterval(duelProgressTimer);
  duelProgressTimer = 0;
  duelFinishPending = {
    score: duelFinalScore,
    elapsedMs: Math.max(0, Math.min(90_000, Math.round(Number(summary?.elapsedMs) || game.duel?.elapsed * 1000 || 0))),
    enemies: Math.max(0, Math.floor(Number(summary?.enemies) || 0)),
    outcome: summary?.outcome === 'destroyed' ? 'destroyed' : 'timeout',
  };
  try {
    if (duelPreviewMode) {
      await transmitDuelProgress(true);
      duelChallenge = { ...duelChallenge, match: { ...duelChallenge.match, verification: 'final', yourVerification: 'verified', rivalVerification: 'verified', winner: duelFinalScore >= Number(duelChallenge.match.rivalScore || 0) ? 'you' : 'rival', finalizedAt: new Date().toISOString() } };
    } else {
      const payload = await playerAccount.finishPvpRun(duelChallenge.challengeId, duelFinishPending);
      if (payload.challenge) duelChallenge = payload.challenge;
    }
    duelFinishPending = null;
  } catch { ui.duelLiveSignal.textContent = 'RECONNECTING'; }
  duelGameplayActive = false;
  duelRunComplete = true;
  input.clear();
  ui.hud.classList.add('hidden');
  ui.duelHud.classList.add('hidden');
  ui.dashButton.classList.add('hidden');
  ui.pauseButton.classList.add('hidden');
  document.documentElement.classList.remove('duel-active');
  ui.duelResult.classList.remove('hidden');
  renderDuelResult(duelChallenge);
  music.playMenu();
  ui.duelResultBack.focus({ preventScroll: true });
};
const scheduleDuelSignals = () => {
  stopDuelSignals();
  if (!duelChallenge) return;
  duelClockTimer = setInterval(updateDuelClock, 1000);
  if (duelPreviewMode) return;
  duelPollTimer = setInterval(async () => {
    if (document.hidden || !duelChallenge || duelBusy) return;
    try {
      if (duelFinishPending) {
        const finished = await playerAccount.finishPvpRun(duelChallenge.challengeId, duelFinishPending);
        if (finished.challenge) setDuelChallenge(finished.challenge);
        duelFinishPending = null;
      }
      const payload = await playerAccount.getPvpChallenge(duelChallenge.challengeId);
      if (!payload.challenge || !['waiting', 'matched'].includes(payload.challenge.status)) throw new Error('Lobby closed');
      setDuelChallenge(payload.challenge);
    } catch (error) {
      if ([404, 410].includes(error?.status)) {
        stopDuelSignals();
        setDuelChallenge(null);
        setDuelStatus('THIS DUEL SIGNAL HAS EXPIRED', true);
        void refreshDuelChallenges(true);
      } else setDuelStatus('LOBBY SIGNAL INTERRUPTED · RECONNECTING', true);
    }
  }, 3000);
  duelHeartbeatTimer = setInterval(async () => {
    if (document.hidden || !duelChallenge || duelBusy) return;
    try {
      const payload = await playerAccount.heartbeatPvpChallenge(duelChallenge.challengeId);
      if (payload.challenge) setDuelChallenge(payload.challenge);
    } catch {}
  }, 9000);
};
const requestDuelRematch = async () => {
  if (!duelChallenge?.match || duelBusy || duelChallenge.match.verification !== 'final') return;
  setDuelBusy(true);
  try {
    if (duelPreviewMode) {
      duelChallenge = { ...duelChallenge, match: { ...duelChallenge.match, yourRematch: true, rivalRematch: false } };
    } else {
      const payload = await playerAccount.requestPvpRematch(duelChallenge.challengeId);
      if (payload.challenge) duelChallenge = payload.challenge;
    }
    if (!duelChallenge.match) {
      duelRunComplete = false;
      duelFinalScore = 0;
      ui.duelResult.classList.add('hidden');
      ui.duelOverlay.classList.remove('hidden');
    }
    renderDuelRoom();
    renderDuelResult(duelChallenge);
  } catch (error) { ui.duelResultMessage.textContent = error?.message || 'REMATCH SIGNAL FAILED'; }
  finally { setDuelBusy(false); renderDuelResult(duelChallenge); }
};
const enterDuelRoom = challenge => {
  setDuelChallenge(challenge);
  setDuelStatus(challenge.status === 'matched' ? 'RIVAL CONNECTED · READY SIGNAL OPEN' : 'CHALLENGE LIVE · SHARE YOUR INVITE');
  scheduleDuelSignals();
  ui.duelOverlay.scrollTop = 0;
  ui.duelReady.focus({ preventScroll: true });
  if (!duelPreviewMode) {
    const challengeId = challenge.challengeId;
    void playerAccount.heartbeatPvpChallenge(challengeId).then(payload => {
      if (duelChallenge?.challengeId === challengeId && payload.challenge) setDuelChallenge(payload.challenge);
    }).catch(() => {});
  }
};
const createDuelChallenge = async () => {
  if (duelBusy) return;
  if (!duelAccountReady()) return setDuelStatus('SIGN IN AND CHOOSE A CALLSIGN FIRST', true);
  setDuelBusy(true);
  setDuelStatus('OPENING SECURE DUEL ROOM...');
  try {
    const challenge = duelPreviewMode ? {
      challengeId: 'b1000000-0000-4000-8000-000000000099', inviteCode: 'CRWNDUEL', status: 'waiting', viewerRole: 'host',
      createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      host: { callsign: playerProfile.displayName, publicId: playerProfile.publicId, equippedShip: walletState().inventory?.equipped?.ship || 'ship_default', ready: false, connected: true }, guest: null, allReady: false,
      blueprintOffer: previewDuelBlueprintOffer, selectedBlueprint: null, opponentBlueprint: null, match: null,
    } : (await playerAccount.createPvpChallenge()).challenge;
    enterDuelRoom(challenge);
    triggerHaptic([16, 35, 20]);
  } catch (error) { setDuelStatus(error?.message || 'CHALLENGE COULD NOT BE CREATED', true); }
  finally { setDuelBusy(false); renderDuelRoom(); }
};
async function joinDuelChallenge(locator, invite = false) {
  if (duelBusy) return;
  if (!duelAccountReady()) return setDuelStatus('SIGN IN AND CHOOSE A CALLSIGN FIRST', true);
  setDuelBusy(true);
  setDuelStatus('CLAIMING CHALLENGER SEAT...');
  try {
    let challenge;
    if (duelPreviewMode) {
      const host = duelChallenges.find(item => item.challengeId === locator) || previewDuelOpenChallenges()[0];
      challenge = previewJoinedDuel(host);
    } else challenge = (await playerAccount.joinPvpChallenge(locator, invite)).challenge;
    enterDuelRoom(challenge);
    triggerHaptic([16, 35, 20]);
  } catch (error) { setDuelStatus(error?.message || 'CHALLENGE COULD NOT BE JOINED', true); }
  finally { setDuelBusy(false); renderDuelRoom(); }
}
async function selectDuelBlueprint(blueprintId) {
  if (!duelChallenge || duelBusy || duelChallenge.match || !DUEL_BLUEPRINT_BY_ID[blueprintId]) return;
  setDuelBusy(true);
  setDuelStatus('LOCKING NORMALIZED BLUEPRINT...');
  try {
    duelChallenge = duelPreviewMode
      ? { ...duelChallenge, selectedBlueprint: blueprintId, host: duelChallenge.viewerRole === 'host' ? { ...duelChallenge.host, ready: false } : duelChallenge.host, guest: duelChallenge.viewerRole === 'guest' ? { ...duelChallenge.guest, ready: false } : duelChallenge.guest }
      : (await playerAccount.selectPvpBlueprint(duelChallenge.challengeId, blueprintId)).challenge;
    setDuelStatus(`${DUEL_BLUEPRINT_BY_ID[blueprintId].name} · MATCH LOADOUT SELECTED`);
    triggerHaptic(14);
  } catch (error) { setDuelStatus(error?.message || 'BLUEPRINT SIGNAL FAILED', true); }
  finally { setDuelBusy(false); renderDuelRoom(); }
}
const toggleDuelReady = async () => {
  if (!duelChallenge || duelBusy) return;
  const ownPilot = duelChallenge.viewerRole === 'guest' ? duelChallenge.guest : duelChallenge.host;
  const ready = !ownPilot?.ready;
  setDuelBusy(true);
  setDuelStatus(ready ? 'TRANSMITTING READY SIGNAL...' : 'STANDING DOWN...');
  try {
    if (duelPreviewMode) {
      const key = duelChallenge.viewerRole === 'guest' ? 'guest' : 'host';
      duelChallenge = { ...duelChallenge, [key]: { ...duelChallenge[key], ready } };
      if (ready && duelChallenge.guest) {
        const rivalKey = key === 'guest' ? 'host' : 'guest';
        duelChallenge[rivalKey] = { ...duelChallenge[rivalKey], ready: true };
      }
      duelChallenge.allReady = Boolean(duelChallenge.guest && duelChallenge.host.ready && duelChallenge.guest.ready);
      if (duelChallenge.allReady && !duelChallenge.match) {
        const startAt = Date.now() + 3200;
        duelChallenge.match = {
          phase: 'countdown', seed: 'crown-duel-preview-seed-100', startAt: new Date(startAt).toISOString(),
          endAt: new Date(startAt + 90_000).toISOString(), durationMs: 90_000, yourScore: 0, rivalScore: 0,
        };
      }
    } else duelChallenge = (await playerAccount.setPvpReady(duelChallenge.challengeId, ready)).challenge;
    setDuelStatus(ready ? 'READY SIGNAL LOCKED' : 'READY SIGNAL CLEARED');
    triggerHaptic(18);
  } catch (error) { setDuelStatus(error?.message || 'READY SIGNAL FAILED', true); }
  finally { setDuelBusy(false); renderDuelRoom(); }
};
const leaveDuelRoom = async () => {
  if (!duelChallenge || duelBusy) return;
  setDuelBusy(true);
  setDuelStatus('CLOSING DUEL SIGNAL...');
  try {
    if (!duelPreviewMode) {
      if (duelChallenge.viewerRole === 'guest') await playerAccount.leavePvpChallenge(duelChallenge.challengeId);
      else await playerAccount.cancelPvpChallenge(duelChallenge.challengeId);
    }
    stopDuelSignals();
    setDuelChallenge(null);
    setDuelStatus('DUEL LOBBY CLOSED');
    await refreshDuelChallenges(true);
  } catch (error) { setDuelStatus(error?.message || 'LOBBY COULD NOT BE CLOSED', true); }
  finally { setDuelBusy(false); renderDuelChallenges(); }
};
const shareDuel = async forceCopy => {
  if (!duelChallenge?.inviteCode) return;
  const url = duelInviteUrl(duelChallenge.inviteCode);
  try {
    if (!forceCopy && navigator.share && !localPreview) await navigator.share({ title: 'Crown Duel · Crown Lizard', text: `Challenge ${duelChallenge.host?.callsign || 'a Crown pilot'} in Crown Duel.`, url });
    else await copyPilotProfileUrl(url);
    setDuelStatus(forceCopy || !navigator.share ? 'DUEL LINK COPIED' : 'DUEL INVITE SHARED');
    triggerHaptic(18);
  } catch (error) { if (error?.name !== 'AbortError') setDuelStatus('SHARING UNAVAILABLE · TRY AGAIN', true); }
};
const closeDuel = () => {
  stopDuelSignals();
  ui.duelCountdown.classList.add('hidden');
  ui.duelOverlay.classList.add('hidden');
  selectMenuChoice(ui.menuChoices.indexOf(ui.menuDuel), true);
};
const loadDuelInvite = async code => {
  setDuelStatus('LOCATING INVITE SIGNAL...');
  try {
    const challenge = duelPreviewMode ? previewDuelOpenChallenges()[0] : (await playerAccount.getPvpInvite(code)).challenge;
    duelChallenges = challenge ? [challenge] : [];
    renderDuelChallenges();
    setDuelStatus(challenge ? `INVITE FROM ${challenge.host?.callsign || 'CROWN PILOT'} · PRESS JOIN` : 'INVITE NOT FOUND', !challenge);
  } catch (error) { setDuelStatus(error?.message || 'INVITE SIGNAL UNAVAILABLE', true); }
};
const openDuel = async (inviteCode = '') => {
  ui.duelOverlay.classList.remove('hidden');
  ui.duelOverlay.scrollTop = 0;
  duelRunComplete = false;
  setDuelChallenge(null);
  setDuelBusy(false);
  const accountReady = duelAccountReady();
  ui.duelCreate.disabled = !accountReady;
  setDuelStatus(accountReady ? 'SCANNING CROWN NETWORK...' : 'SIGN IN AND CHOOSE A CALLSIGN TO ENTER', !accountReady);
  const reconnect = accountReady && !inviteCode && !duelPreviewMode ? readDuelReconnect() : null;
  if (reconnect) {
    try {
      const payload = await playerAccount.getPvpChallenge(reconnect.challengeId);
      if (payload.challenge && ['waiting', 'matched'].includes(payload.challenge.status)) return enterDuelRoom(payload.challenge);
      saveDuelReconnect(null);
    } catch { saveDuelReconnect(null); }
  }
  if (inviteCode) await loadDuelInvite(inviteCode);
  else await refreshDuelChallenges();
  (accountReady ? ui.duelCreate : ui.closeDuel).focus({ preventScroll: true });
};

const previewLeaderboardScores = difficulty => {
  const multiplier = { chill: .72, arcade: 1, crowned: 1.38 }[difficulty] || 1;
  return [
    ['NOVA_KING', 'preview:nova_king', 248900, 14],
    ['VOIDLIZARD', 'preview:voidlizard', 221450, 12],
    ['PIXELACE', 'preview:pixelace', 194820, 11],
    ['ACE', null, 172300, 10],
    ['RIFTFOX', 'preview:riftfox', 149780, 9],
  ].map(([playerName, publicProfileId, score, zone], index) => ({
    id: `preview-${difficulty}-${index}`,
    playerName,
    initials: playerName,
    publicProfileId,
    score: Math.round(score * multiplier),
    difficulty,
    zone: Math.max(1, Math.round(zone * (.8 + multiplier * .2))),
    wardens: Math.max(0, zone - 1),
  }));
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
      ? [String(index + 1).padStart(2, '0'), entry.playerName || entry.initials, Number(entry.score).toLocaleString('en-US'), String(entry.zone)]
      : [String(index + 1).padStart(2, '0'), '---', '------', '-'];
    values.forEach((value, cellIndex) => {
      const cell = document.createElement('span');
      const profileLink = cellIndex === 1 && entry ? createPilotProfileLink(entry, 'leaderboard') : null;
      if (profileLink) cell.append(profileLink);
      else cell.textContent = value;
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
    const personalProfileLink = createPilotProfileLink(personal.entry, 'leaderboard');
    if (personalProfileLink) initials.append(personalProfileLink);
    else initials.textContent = personal.entry.playerName || personal.entry.initials;
    const score = document.createElement('em');
    score.textContent = Number(personal.entry.score).toLocaleString('en-US');
    ui.leaderboardPlayerResult.append(rank, label, initials, score);
  }
  const personalRank = Number(personal?.rank) || 0;
  const nextEntry = personalRank > 1 && personalRank <= 11 ? scores[personalRank - 2] : null;
  const gap = nextEntry && personal?.entry ? Math.max(0, Number(nextEntry.score) - Number(personal.entry.score) + 1) : 0;
  ui.leaderboardStatus.textContent = personalRank === 1
    ? 'YOU HOLD THE CROWN · DEFEND #1'
    : gap > 0
      ? `${gap.toLocaleString('en-US')} POINTS TO RANK #${personalRank - 1}`
      : scores.length ? 'TOP 10 · ALL-TIME' : 'NO SCORES YET · CLAIM THE CROWN';
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
    if (localPreview) {
      const scores = previewLeaderboardScores(difficulty);
      if (difficulty === leaderboardDifficulty) renderLeaderboard(scores);
      if (difficulty === selectedDifficulty) ui.menuBest.textContent = String(scores[0].score).padStart(6, '0');
      return { difficulty, scores, preview: true };
    }
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
  if (leaderboardReturn === 'menu') selectMenuChoice(ui.menuChoices.indexOf(ui.menuLeaderboard), true);
};

const prepareScoreEntry = (score, summary) => {
  const scoreTicket = { score, summary, difficulty: game.difficulty, generation: runGeneration, run: null };
  pendingScore = scoreTicket;
  ui.scoreEntry.classList.add('hidden');
  ui.submitScore.classList.add('hidden');
  ui.scoreSubmitStatus.textContent = '';
  ui.submitScore.disabled = false;
  Promise.resolve(currentRunPromise).then(async run => {
    const scoreRun = run || (callsignPreviewMode ? { id: 'local-callsign-preview', walletBound: true, preview: true } : null);
    if ((!scoreRun && !debugMode) || pendingScore !== scoreTicket || scoreTicket.generation !== runGeneration) return;
    scoreTicket.run = scoreRun;
    if (scoreRun?.walletBound && !playerProfile) await refreshPlayerProfile().catch(() => null);
    if (pendingScore !== scoreTicket || scoreTicket.generation !== runGeneration) return;
    const accountCallsign = scoreRun?.walletBound ? String(playerProfile?.displayName || '') : '';
    if (scoreRun?.walletBound && !accountCallsign) {
      ui.scoreIdentity.classList.add('hidden');
      ui.guestInitials.classList.add('hidden');
      ui.playerInitials.required = false;
      ui.scoreEntry.classList.remove('hidden');
      ui.scoreSubmitStatus.textContent = 'CHOOSE A CALLSIGN IN PLAYER ACCOUNT TO SUBMIT';
      return;
    }
    scoreTicket.callsign = accountCallsign;
    ui.scoreIdentity.classList.toggle('hidden', !accountCallsign);
    ui.guestInitials.classList.toggle('hidden', Boolean(accountCallsign));
    ui.playerInitials.required = !accountCallsign;
    ui.scoreCallsign.textContent = accountCallsign || 'PLAYER';
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
    <div class="summary-loadout"><span>FINAL WEAPON <b>${summary.weapon} MK ${summary.weaponLevel}${summary.weaponMastery ? ` · ${summary.weaponMastery}` : ''}</b></span><span>CROWN POWERS <b>${powers}</b></span><span>ENEMIES DEFEATED <b>${summary.enemies}</b></span></div>
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

const difficultyOrder = Object.keys(CONFIG.difficulties);
const renderMenuMode = () => {
  const difficulty = CONFIG.difficulties[selectedDifficulty];
  ui.menuModeValue.textContent = difficulty.name;
  ui.menuMode.setAttribute('aria-label', `Game mode ${difficulty.name}. ${difficulty.health} lives. ${difficulty.score} times score.`);
};
const setDifficulty = difficulty => {
  if (!CONFIG.difficulties[difficulty]) return;
  selectedDifficulty = difficulty;
  localStorage.setItem('crownlizard:difficulty', selectedDifficulty);
  best = Number(localStorage.getItem(bestKey(selectedDifficulty)) || 0);
  ui.best.textContent = best.toLocaleString('en-US');
  ui.menuBest.textContent = String(best).padStart(6, '0');
  renderMenuMode();
  loadLeaderboard(selectedDifficulty, true);
};
const cycleDifficulty = direction => {
  const currentIndex = difficultyOrder.indexOf(selectedDifficulty);
  setDifficulty(difficultyOrder[(currentIndex + direction + difficultyOrder.length) % difficultyOrder.length]);
};
renderMenuMode();

const renderSponsoredOffer = offer => {
  currentSponsoredOffer = offer;
  ui.watchAd.classList.add('hidden');
  ui.watchAd.disabled = rewardedAdViewing;
  ui.sponsoredReward.className = 'sponsored-reward hidden';
  ui.sponsoredReward.textContent = '';
  if (!offer || offer.reason === 'RUN_NOT_ELIGIBLE') return;

  ui.sponsoredReward.classList.remove('hidden');
  if (offer.claimed) {
    ui.sponsoredReward.classList.add('sponsored-claimed');
    ui.sponsoredReward.innerHTML = '<b>♛ SPONSORED CRATE CLAIMED</b><span>COSMETIC REWARD SECURED · SCORE UNCHANGED</span>';
    return;
  }
  if (offer.reason === 'DAILY_LIMIT_REACHED') {
    ui.sponsoredReward.classList.add('sponsored-limit');
    ui.sponsoredReward.innerHTML = '<b>DAILY SIGNAL LIMIT REACHED</b><span>MORE OPTIONAL CRATES AVAILABLE TOMORROW</span>';
    return;
  }
  if (!offer.eligible) return;
  ui.sponsoredReward.innerHTML = `<b>♛ OPTIONAL COSMETIC CRATE</b><span>WATCH ONE AD · ${offer.remainingToday} / ${offer.dailyLimit} AVAILABLE TODAY · NO SCORE ADVANTAGE</span>`;
  ui.watchAd.classList.remove('hidden');
  ui.watchAd.disabled = rewardedAdViewing;
};

const renderRewardedAdProgress = progress => {
  const percent = Math.max(0, Math.min(100, Math.floor(progress * 100)));
  ui.rewardedAdFill.style.transform = `scaleX(${percent / 100})`;
  ui.rewardedAdCountdown.textContent = percent >= 100 ? 'REWARD GRANTED' : `SIGNAL ${percent}%`;
};

const closeRewardedAdOverlay = () => {
  ui.rewardedAdOverlay.classList.add('hidden');
  renderRewardedAdProgress(0);
};

const showRewardedCrate = async () => {
  if (serverEconomy) return;
  const offer = shardWallet.getPendingSponsoredOffer();
  if (rewardedAdViewing || !offer?.eligible || !rewardedAd.isReady()) return;
  const origin = !ui.vaultOverlay.classList.contains('hidden') ? 'vault' : 'gameover';
  rewardedAdViewing = true;
  if (origin === 'gameover') renderSponsoredOffer(offer);
  renderVault();
  ui.rewardedAdMessage.textContent = 'KEEP THIS SIGNAL OPEN TO RECEIVE ONE COSMETIC CRATE.';
  renderRewardedAdProgress(0);
  ui.rewardedAdOverlay.classList.remove('hidden');
  ui.cancelRewardedAd.focus({ preventScroll: true });
  const result = await rewardedAd.show({ onProgress: renderRewardedAdProgress });
  rewardedAdViewing = false;
  closeRewardedAdOverlay();
  if (result.status !== REWARDED_AD_STATUS.granted) {
    const pendingOffer = shardWallet.getPendingSponsoredOffer();
    renderVault();
    if (origin === 'vault') {
      ui.vaultSponsoredStatus.textContent = 'SIGNAL CANCELLED · THE FREE CRATE IS STILL WAITING';
      ui.vaultWatchAd.focus({ preventScroll: true });
    } else {
      renderSponsoredOffer(pendingOffer);
      ui.sponsoredReward.classList.remove('hidden');
      ui.sponsoredReward.innerHTML = '<b>SIGNAL CANCELLED · NO REWARD USED</b><span>THE OPTIONAL CRATE IS STILL AVAILABLE</span>';
      const visibleChoices = ui.resultChoices.filter(button => !button.classList.contains('hidden') && !button.disabled);
      selectResultChoice(Math.max(0, visibleChoices.indexOf(ui.watchAd)), true);
    }
    return;
  }
  try {
    const crate = shardWallet.openSponsoredCrate(offer.runId);
    lastSponsoredClaimedRunId = offer.runId;
    crateOpening = true;
    renderVault();
    if (origin === 'gameover') renderSponsoredOffer(shardWallet.getSponsoredOffer(offer.runId));
    crateRevealReturn = origin;
    await playCrateOpeningCinematic({ signal: true, tier: crate.outcome.tier });
    crateOpening = false;
    renderVault();
    showCrateReveal(crate.outcome);
  } catch {
    crateOpening = false;
    ui.crateOpeningCinematic.className = 'crate-opening-cinematic hidden';
    renderVault();
    if (origin === 'vault') ui.vaultSponsoredStatus.textContent = 'REWARD LINK FAILED · THE SIGNAL REMAINS SAVED';
    else {
      renderSponsoredOffer(shardWallet.getPendingSponsoredOffer());
      ui.sponsoredReward.classList.remove('hidden');
      ui.sponsoredReward.innerHTML = '<b>REWARD LINK FAILED</b><span>NO OFFER WAS CONSUMED · TRY AGAIN</span>';
    }
  }
};

const renderShardVerification = message => {
  ui.shardReward.className = 'shard-reward shard-unqualified';
  ui.shardReward.innerHTML = `<div class="shard-reward-head"><span>◆ SERVER PAYOUT</span><b>${message}</b></div>`;
};

const settleServerReward = async summary => {
  try {
    clearInterval(runCheckpointTimer);
    await runCheckpointChain.catch(() => null);
    const run = await currentRunPromise;
    if (!run?.id || !run.walletBound || !serverEconomyReady) throw new Error('WALLET_NOT_BOUND');
    const result = await playerAccount.settleRun(run.id, { ...summary, score: game.score }, run.checkpointToken, runCheckpointSequence || 1);
    if (serverWallet) serverWallet.balance = Number(result.balance) || serverWallet.balance;
    await refreshServerWallet();
    renderShardReward(result);
    renderShardBalance();
  } catch {
    renderShardVerification(serverEconomyReady ? 'PENDING' : 'VAULT OFFLINE');
    const balance = document.createElement('p');
    balance.textContent = serverEconomyReady
      ? 'REWARD SAVED · WILL RETRY ON YOUR NEXT VISIT'
      : 'RUN COUNTS FOR HIGH SCORE · NO SHARDS CREDITED';
    ui.shardReward.append(balance);
  }
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
    const hudWeaponKey = state.weapon.toLowerCase();
    const hudSkinId = walletState().inventory.equipped.weapons?.[hudWeaponKey];
    const hudSkin = COSMETIC_BY_ID[hudSkinId];
    ui.weaponIcon.style.backgroundImage = `url("./assets/weapons/${hudSkin?.sprite || `${hudWeaponKey}-mount-v1.png`}")`;
    ui.weaponLevel.textContent = state.weaponLevel;
    ui.weaponUpgrade.textContent = state.weaponUpgrade;
    ui.weaponHud.classList.toggle('mastered', Boolean(state.weaponMastery));
    ui.weaponHud.classList.toggle('mastery-ready', Boolean(state.masteryReady));
    ui.weaponHud.querySelector('.weapon-rank').setAttribute('aria-label', `Weapon level ${state.weaponLevel} of 5`);
    ui.weaponHud.setAttribute('aria-label', `${state.weapon}, level ${state.weaponLevel} of 5, ${state.weaponUpgrade}`);
    [...ui.weaponPips.children].forEach((pip, index) => pip.classList.toggle('active', index < state.weaponLevel));
    ui.weaponHud.style.setProperty('--weapon-color', state.weaponColor);
    ui.dashButton.classList.toggle('ready', state.dash >= .999);
    if (state.assault) {
      ui.assaultTime.textContent = formatAssaultTime(state.assault.remaining);
      ui.assaultPhaseLabel.textContent = `PHASE ${state.assault.phase}`;
      ui.assaultPhaseName.textContent = state.assault.phaseInfo.name;
      ui.assaultPhaseRole.textContent = state.assault.phaseInfo.role;
      ui.assaultDamage.textContent = state.assault.damage.toLocaleString('en-US');
      ui.assaultGlobalHp.textContent = state.assault.globalHp.toLocaleString('en-US');
      ui.assaultHud.style.setProperty('--assault-phase-color', state.assault.phaseInfo.color);
    }
    if (state.duel) updateDuelLiveHud(state);
  },
  combo: () => {
    ui.combo.classList.remove('bump');
    void ui.combo.offsetWidth;
    ui.combo.classList.add('bump');
    setTimeout(() => ui.combo.classList.remove('bump'), 130);
  },
  toast: showToast,
  cinematic: type => {
    input.clear();
    hideToast();
    ui.dashButton.classList.add('hidden');
    ui.pauseButton.classList.add('hidden');
    if (type === 'death') music.pause();
  },
  gameover: (score, summary) => {
    clearInterval(runCheckpointTimer);
    hideToast();
    ui.finalScore.textContent = score.toLocaleString('en-US');
    const previousBest = best;
    const record = score > previousBest;
    if (record) { best = score; localStorage.setItem(bestKey(game.difficulty), String(best)); }
    ui.resultTitle.textContent = record ? 'NEW PERSONAL BEST' : 'THE CROWN FELL';
    ui.personalBestChase.classList.toggle('record', record);
    ui.personalBestChase.textContent = record
      ? previousBest > 0 ? `+${(score - previousBest).toLocaleString('en-US')} OVER YOUR PREVIOUS BEST` : 'FIRST PERSONAL BEST SECURED'
      : `${Math.max(0, previousBest - score).toLocaleString('en-US')} POINTS TO YOUR PERSONAL BEST`;
    ui.recordMessage.textContent = `PERSONAL BEST · ${best.toLocaleString('en-US')}`;
    ui.runMeta.textContent = `ZONE ${game.stageIndex + 1} · ${CONFIG.difficulties[game.difficulty].name}`;
    renderRunSummary(summary);
    if (localPreview) {
      const shardResult = shardWallet.awardRun(economyRunId, summary);
      renderShardReward(shardResult);
      renderSponsoredOffer(shardWallet.getPendingSponsoredOffer());
    } else {
      renderShardVerification('VERIFYING...');
      renderSponsoredOffer(null);
      void settleServerReward(summary);
    }
    renderShardBalance();
    prepareScoreEntry(score, summary);
    selectResultChoice(0);
    ui.gameover.classList.remove('hidden');
    ui.perkOverlay.classList.add('hidden');
    ui.dashButton.classList.add('hidden');
    ui.pauseButton.classList.add('hidden');
    music.pause();
  },
  duelover: summary => { void completeDuelRun(summary); },
  assaultPhase: phase => {
    showToast(`PHASE ${phase.number} · ${phase.name}`, 'threat', phase.color);
    sfx.play('stage');
    if (phase.number > 1 && activeBossAssault) {
      const completedPhase = phase.number - 1;
      const damage = Math.max(0, Math.round(game.assault?.phaseDamage?.[completedPhase - 1] || 0));
      bossCheckpointChain = bossCheckpointChain.then(() => bossNetwork.checkpoint({
        phase: completedPhase, elapsedMs: Math.round((game.assault?.elapsed || completedPhase * 30) * 1000), damage,
      }));
    }
  },
  assaultover: showAssaultResult,
  stage: stage => {
    document.documentElement.style.setProperty('--stage-accent', stage.palette.accent);
    sfx.play('stage');
  },
  perk: choices => {
    ui.perkOverlay.classList.remove('mastery-mode');
    ui.perkEyebrow.textContent = 'WARDEN DEFEATED';
    ui.perkTitle.textContent = 'CHOOSE A CROWN POWER';
    ui.perkSubtitle.textContent = 'Your choice lasts for the rest of the run.';
    ui.perkSwipeHint.textContent = '◀ SWIPE TO VIEW · TAP TO CHOOSE ▶';
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
  mastery: (weapon, choices) => {
    ui.perkOverlay.classList.add('mastery-mode');
    ui.perkEyebrow.textContent = `${weapon.name} · MK 5`;
    ui.perkTitle.textContent = 'CHOOSE YOUR FINAL FORM';
    ui.perkSubtitle.textContent = 'The paths are permanent and mutually exclusive for this run.';
    ui.perkSwipeHint.textContent = '◀ SWIPE · CHOOSE ONE PATH ▶';
    const sprite = `./assets/weapons/${weapon.name.toLowerCase()}-mount-v1.png`;
    ui.perkCards.innerHTML = choices.map(mastery => `
      <button class="perk-card mastery-card weapon-${weapon.name.toLowerCase()}" data-mastery="${mastery.key}" style="--perk-color:${mastery.color}">
        <small>FINAL FORM · 1 OF 2</small>
        <span class="perk-icon"><img src="${sprite}" alt="" decoding="async" draggable="false"></span>
        <b>${mastery.name}</b>
        <strong>${mastery.role}</strong>
        <p>${mastery.description}</p>
      </button>
    `).join('');
    ui.perkCards.querySelectorAll('[data-mastery]').forEach(card => card.addEventListener('click', () => game.selectMastery(card.dataset.mastery), { once: true }));
    ui.perkOverlay.classList.remove('hidden');
    ui.dashButton.classList.add('hidden');
    ui.pauseButton.classList.add('hidden');
  },
  masteryApplied: (weapon, mastery) => {
    ui.perkOverlay.classList.add('hidden');
    ui.perkOverlay.classList.remove('mastery-mode');
    ui.dashButton.classList.remove('hidden');
    ui.pauseButton.classList.remove('hidden');
    showToast(`MASTERED · ${mastery.name}`, 'weapon', weapon.color);
  },
  haptic: triggerHaptic,
  sfx: type => sfx.play(type),
});

const applyEquippedCosmetics = () => {
  const state = walletState();
  const equippedId = state.inventory.equipped.ship;
  const cosmetic = COSMETIC_BY_ID[equippedId] || COSMETIC_BY_ID.ship_default;
  game.setPlayerSkin(cosmetic.sprite);
  game.setWeaponSkins(Object.fromEntries(['laser', 'tesla', 'pulse'].map(weaponKey => {
    const skinId = state.inventory.equipped.weapons?.[weaponKey] || `weapon_${weaponKey}_default`;
    return [weaponKey, COSMETIC_BY_ID[skinId] || COSMETIC_BY_ID[`weapon_${weaponKey}_default`]];
  })));
};

const applyRunShip = () => {
  const state = walletState();
  const selectedId = cosmeticPreferences.chooseShip(Object.keys(state.inventory.cosmetics), state.inventory.equipped.ship);
  const cosmetic = COSMETIC_BY_ID[selectedId] || COSMETIC_BY_ID.ship_default;
  game.setPlayerSkin(cosmetic.sprite);
  return cosmetic;
};

const authRedirectReady = playerAccount.redirectResult?.pending
  ? playerAccount.completeAuthRedirect()
  : Promise.resolve(playerAccount.redirectResult);

const bootstrapServerEconomy = async () => {
  ui.menuShards.textContent = 'CONNECTING...';
  await authRedirectReady;
  const snapshot = await playerAccount.bootstrapWallet();
  acceptServerWallet(snapshot);
  await Promise.allSettled([refreshPlayerProfile(), refreshAdminAccess()]);
  renderShardBalance();
  renderVault();
  applyEquippedCosmetics();
  renderSettings();
  return snapshot;
};

applyEquippedCosmetics();
game.reducedEffects = reducedEffects;
applyEffectsSetting();
renderSettings();

const connectServerEconomy = () => {
  if (serverEconomyConnecting) return playerReadyPromise;
  serverEconomyConnecting = true;
  playerReadyPromise = bootstrapServerEconomy()
    .catch(error => {
      serverEconomyReady = false;
      ui.menuShards.textContent = 'OFFLINE';
      renderSettings();
      if (!ui.accountOverlay.classList.contains('hidden')) {
        renderAccount();
        if (currentAccountState() === 'expired') setAccountStatus('SESSION EXPIRED · SIGN IN AGAIN', 'error');
        else if (!playerAccount.redirectResult?.pending) setAccountStatus(String(error?.message || 'VAULT CONNECTION FAILED').toUpperCase(), 'error');
      }
      return null;
    })
    .finally(() => { serverEconomyConnecting = false; });
  return playerReadyPromise;
};

if (serverEconomy) {
  const connection = connectServerEconomy();
  const redirect = playerAccount.redirectResult;
  const shouldPresentAccount = Boolean(redirect?.pending || redirect?.signIn || redirect?.error || redirect?.confirmed || redirect?.verified);
  if (shouldPresentAccount) {
    queueMicrotask(() => {
      openSettings('menu');
      openAccount(redirect?.signIn ? 'login' : 'secure');
      if (redirect?.pending) setAccountStatus('VERIFYING EMAIL...', '');
    });
    const redirectPresentation = redirect.pending ? authRedirectReady : connection;
    void redirectPresentation.then(() => {
      renderAccount();
      if (redirect?.error) setAccountStatus(redirect.error.toUpperCase(), 'error');
      else if (redirect?.signIn) setAccountStatus('ENTER YOUR PASSWORD TO SIGN IN', '');
      else if (currentAccountState() === 'setup') setAccountStatus('EMAIL VERIFIED · CREATE YOUR PASSWORD', 'success');
      else if (currentAccountState() === 'signed-in' && accountPresentation().showCallsign) {
        setAccountStatus('ACCOUNT SECURED · CHOOSE YOUR CALLSIGN', 'success');
        ui.callsignInput.focus({ preventScroll: true });
      } else if (currentAccountState() === 'signed-in' && profileStatus === 'error') setAccountStatus('SIGNED IN · PLAYER ID TEMPORARILY OFFLINE', 'error');
      else if (currentAccountState() === 'signed-in') setAccountStatus('SIGNED IN · VAULT RESTORED', 'success');
      else setAccountStatus('EMAIL VERIFIED · SIGN IN TO FINISH SETUP', 'error');
    }).catch(error => {
      renderAccount();
      setAccountStatus(String(error?.message || 'EMAIL VERIFICATION FAILED').toUpperCase(), 'error');
    });
  }
  void connection.then(() => {
    if (shouldPresentAccount || !accountPresentation().showCallsign) return;
    openSettings('menu');
    openAccount('secure');
    setAccountStatus('CHOOSE YOUR PLAYER ID TO FINISH', 'success');
    ui.callsignInput.focus({ preventScroll: true });
  });
  if (redirect?.sessionReturn) {
    void connection.then(() => {
      if (currentAccountState() === 'signed-in') return;
      openSettings('menu');
      openAccount('login');
      setAccountStatus('SIGN-IN WAS NOT RESTORED · PLEASE SIGN IN AGAIN', 'error');
    });
  }
}

const engine = new Engine({ update: dt => game.update(dt), render: () => { if (game.active) game.render(); }, step: 1 / CONFIG.simulationHz });
engine.start();

const requestCinematicSkip = event => {
  if (!game.skipCinematic()) return false;
  event?.preventDefault?.();
  input.clear();
  return true;
};

$('game').addEventListener('pointerdown', requestCinematicSkip);
addEventListener('keydown', event => {
  if (!['Enter', 'Space', 'Escape'].includes(event.code)) return;
  requestCinematicSkip(event);
});

const runVisible = () => ui.menu.classList.contains('hidden') && ui.gameover.classList.contains('hidden') && ui.assaultResult.classList.contains('hidden') && ui.tutorialOverlay.classList.contains('hidden') && game.player.health > 0;

const resumeRun = () => {
  if (!game.active || game.awaitingPerk) return;
  game.paused = false;
  ui.pauseOverlay.classList.add('hidden');
  ui.pauseButton.classList.remove('hidden');
  ui.dashButton.classList.remove('hidden');
  focusGameInput();
  music.playGame();
};

const pauseRun = automatic => {
  if (game.mode === 'duel' || !game.active || game.paused || game.awaitingPerk || !runVisible()) return;
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
  rewardedAd.cancel();
  rewardedAdViewing = false;
  closeRewardedAdOverlay();
  game.stop();
  duelGameplayActive = false;
  duelRunComplete = false;
  duelFinalScore = 0;
  economyRunId = '';
  input.clear();
  stopDuelSignals();
  [ui.gameover, ui.assaultResult, ui.perkOverlay, ui.pauseOverlay, ui.settingsOverlay, ui.accountOverlay, ui.redeemOverlay, ui.adminOverlay, ui.tutorialOverlay, ui.vaultOverlay, ui.wardenOverlay, ui.duelOverlay, ui.duelCountdown, ui.duelResult, ui.duelHud, ui.pilotProfileOverlay].forEach(element => element.classList.add('hidden'));
  ui.crateReveal.classList.add('hidden');
  ui.crateOpeningCinematic.className = 'crate-opening-cinematic hidden';
  ui.cosmeticDetail.classList.add('hidden');
  ui.storeRename.classList.add('hidden');
  ui.storePurchaseReveal.classList.add('hidden');
  ui.hud.classList.add('hidden');
  ui.assaultHud.classList.add('hidden');
  document.documentElement.classList.remove('assault-active', 'duel-active');
  ui.dashButton.classList.add('hidden');
  ui.pauseButton.classList.add('hidden');
  ui.menu.classList.remove('hidden');
  selectMenuChoice(0);
  ui.best.textContent = best.toLocaleString('en-US');
  ui.menuBest.textContent = String(best).padStart(6, '0');
  loadLeaderboard(selectedDifficulty, true);
  music.playMenu();
  queueMicrotask(() => presentPwaUpdate('menu'));
};

const openSettings = origin => {
  settingsReturn = origin;
  renderSettings();
  if (currentAccountState() === 'signed-in' && !adminAccessChecked && !adminAccessLoading) void refreshAdminAccess();
  if (origin === 'pause') ui.pauseOverlay.classList.add('hidden');
  ui.settingsOverlay.classList.remove('hidden');
};

const closeSettings = () => {
  ui.settingsOverlay.classList.add('hidden');
  if (settingsReturn === 'pause' && game.paused) ui.pauseOverlay.classList.remove('hidden');
};

const setRedeemStatus = (message = '', kind = '') => {
  ui.redeemStatus.textContent = message;
  ui.redeemStatus.className = `redeem-status${kind ? ` ${kind}` : ''}`;
};

const formatRewardCodeInput = value => {
  const compact = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17);
  const token = compact.startsWith('CROWN') ? compact.slice(5) : compact;
  const groups = [token.slice(0, 4), token.slice(4, 8), token.slice(8, 12)].filter(Boolean);
  return `${compact.startsWith('CROWN') ? 'CROWN-' : ''}${groups.join('-')}`;
};

const openRedeem = () => {
  if (currentAccountState() !== 'signed-in') return;
  ui.settingsOverlay.classList.add('hidden');
  ui.redeemOverlay.classList.remove('hidden');
  ui.redeemReward.classList.add('hidden');
  ui.redeemCode.value = '';
  setRedeemStatus();
  ui.redeemCode.focus({ preventScroll: true });
};

const closeRedeem = () => {
  if (redeemBusy) return;
  ui.redeemOverlay.classList.add('hidden');
  ui.settingsOverlay.classList.remove('hidden');
  ui.redeemCode.value = '';
  ui.redeemReward.classList.add('hidden');
  setRedeemStatus();
  ui.openRedeem.focus({ preventScroll: true });
};

const setAdminStatus = (message = '', kind = '') => {
  ui.adminStatus.textContent = message;
  ui.adminStatus.className = `admin-status${kind ? ` ${kind}` : ''}`;
};

const localDateTimeValue = timestamp => {
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const resetAdminForm = () => {
  ui.adminCampaignName.value = '';
  ui.adminRewardType.value = 'shards';
  ui.adminRewardAmount.min = '25';
  ui.adminRewardAmount.max = '2500';
  ui.adminRewardAmount.value = '100';
  ui.adminMaxRedemptions.value = '100';
  ui.adminExpiresAt.min = localDateTimeValue(Date.now() + 60_000);
  ui.adminExpiresAt.max = localDateTimeValue(Date.now() + 90 * 86_400_000);
  ui.adminExpiresAt.value = localDateTimeValue(Date.now() + 7 * 86_400_000);
  ui.adminNote.value = '';
};

const renderAdminCampaigns = () => {
  ui.adminCampaignCount.textContent = String(adminCampaigns.length);
  if (!adminCampaigns.length) {
    ui.adminCampaignList.replaceChildren(Object.assign(document.createElement('p'), {
      className: 'admin-campaign-empty', textContent: adminBusy ? 'SYNCING SERVER CAMPAIGNS...' : 'NO CAMPAIGNS CREATED YET',
    }));
    return;
  }
  ui.adminCampaignList.replaceChildren(...adminCampaigns.map(campaign => {
    const card = document.createElement('article');
    card.className = `admin-campaign ${campaign.status}`;
    const copy = document.createElement('div');
    copy.className = 'admin-campaign-copy';
    const title = Object.assign(document.createElement('strong'), { textContent: campaign.campaignName });
    const reward = campaign.rewardType === 'crate_credit'
      ? `${campaign.rewardAmount} FREE CRATE${campaign.rewardAmount === 1 ? '' : 'S'}`
      : `◆ ${Number(campaign.rewardAmount).toLocaleString('en-US')} SHARDS`;
    const expires = new Date(campaign.expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    const detail = Object.assign(document.createElement('span'), {
      textContent: `${campaign.codeHint} · ${reward}\n${campaign.redeemedCount} / ${campaign.maxRedemptions} USED · EXPIRES ${expires}`,
    });
    copy.append(title, detail);
    const state = Object.assign(document.createElement('b'), { className: 'admin-campaign-state', textContent: String(campaign.status).toUpperCase() });
    card.append(copy, state);
    if (!['revoked', 'exhausted'].includes(campaign.status)) {
      const actions = document.createElement('div');
      actions.className = 'admin-campaign-actions';
      const toggle = Object.assign(document.createElement('button'), {
        type: 'button', textContent: campaign.status === 'paused' ? 'ACTIVATE' : 'PAUSE',
      });
      toggle.disabled = adminBusy;
      toggle.addEventListener('click', () => void changeAdminCampaignStatus(campaign.id, campaign.status === 'paused' ? 'active' : 'paused'));
      const revoke = Object.assign(document.createElement('button'), { type: 'button', className: 'danger-link', textContent: 'REVOKE' });
      revoke.disabled = adminBusy;
      revoke.addEventListener('click', () => {
        if (revoke.dataset.confirm !== 'true') {
          revoke.dataset.confirm = 'true';
          revoke.textContent = 'CONFIRM REVOKE';
          setAdminStatus('REVOKE IS FINAL · PRESS AGAIN TO CONFIRM', 'error');
          return;
        }
        void changeAdminCampaignStatus(campaign.id, 'revoked');
      });
      actions.append(toggle, revoke);
      card.append(actions);
    }
    return card;
  }));
};

const renderAdminMode = () => {
  const campaignsSelected = adminMode === 'campaigns';
  ui.adminCreateTab.classList.toggle('selected', !campaignsSelected);
  ui.adminCreateTab.setAttribute('aria-selected', String(!campaignsSelected));
  ui.adminCampaignsTab.classList.toggle('selected', campaignsSelected);
  ui.adminCampaignsTab.setAttribute('aria-selected', String(campaignsSelected));
  ui.adminCreatePanel.classList.toggle('hidden', campaignsSelected);
  ui.adminCampaignsPanel.classList.toggle('hidden', !campaignsSelected);
  renderAdminCampaigns();
};

const loadAdminCampaigns = async () => {
  if (!adminAccess || adminBusy) return;
  if (campaignPreviewMode) {
    renderAdminCampaigns();
    return;
  }
  adminBusy = true;
  setAdminStatus('SYNCING SERVER CAMPAIGNS...');
  renderAdminCampaigns();
  try {
    const payload = await playerAccount.getRewardCodes();
    adminCampaigns = Array.isArray(payload?.codes) ? payload.codes : [];
    setAdminStatus(`${adminCampaigns.length} CAMPAIGN${adminCampaigns.length === 1 ? '' : 'S'} LOADED`, 'success');
  } catch (error) {
    setAdminStatus(String(error?.message || 'CAMPAIGN LINK FAILED').toUpperCase(), 'error');
  } finally {
    adminBusy = false;
    renderAdminCampaigns();
  }
};

const changeAdminCampaignStatus = async (campaignId, status) => {
  if (!adminAccess || adminBusy) return;
  adminBusy = true;
  setAdminStatus(`${status === 'revoked' ? 'REVOKING' : 'UPDATING'} CAMPAIGN...`);
  renderAdminCampaigns();
  try {
    if (campaignPreviewMode) await wait(260);
    else await playerAccount.setRewardCodeStatus(campaignId, status);
    adminCampaigns = adminCampaigns.map(campaign => campaign.id === campaignId ? { ...campaign, status } : campaign);
    setAdminStatus(`CAMPAIGN ${status.toUpperCase()}`, 'success');
    sfx.play('confirm');
  } catch (error) {
    setAdminStatus(String(error?.message || 'CAMPAIGN UPDATE FAILED').toUpperCase(), 'error');
  } finally {
    adminBusy = false;
    renderAdminCampaigns();
  }
};

const openAdmin = async () => {
  if (!adminAccess || currentAccountState() !== 'signed-in') return;
  adminMode = 'create';
  lastCreatedRewardCode = '';
  ui.adminCodeReveal.classList.add('hidden');
  resetAdminForm();
  setAdminStatus();
  ui.settingsOverlay.classList.add('hidden');
  ui.adminOverlay.classList.remove('hidden');
  renderAdminMode();
  ui.adminCampaignName.focus({ preventScroll: true });
  await loadAdminCampaigns();
};

const closeAdmin = () => {
  if (adminBusy) return;
  lastCreatedRewardCode = '';
  ui.adminCreatedCode.textContent = 'CROWN-XXXX-XXXX-XXXX';
  ui.adminCodeReveal.classList.add('hidden');
  ui.adminOverlay.classList.add('hidden');
  ui.settingsOverlay.classList.remove('hidden');
  setAdminStatus();
  ui.openAdmin.focus({ preventScroll: true });
};

const previewRewardCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const token = [...bytes].map(value => alphabet[value % alphabet.length]).join('');
  return `CROWN-${token.slice(0, 4)}-${token.slice(4, 8)}-${token.slice(8)}`;
};

const openPwaInstallHelp = () => {
  ui.settingsOverlay.classList.add('hidden');
  ui.pwaInstallOverlay.classList.remove('hidden');
  ui.closePwaInstall.focus({ preventScroll: true });
};

const closePwaInstallHelp = () => {
  ui.pwaInstallOverlay.classList.add('hidden');
  ui.settingsOverlay.classList.remove('hidden');
  ui.installApp.focus({ preventScroll: true });
};

const renderPwaReleaseInfo = () => {
  const info = pwaReleaseInfo;
  ui.pwaUpdateVersion.textContent = info?.build
    ? `SYSTEM UPDATE · VER ${info.release || '?'} · BUILD ${info.build}`
    : 'SYSTEM UPDATE';
  ui.pwaReleaseTitle.textContent = info?.title || "WHAT'S NEW";
  ui.pwaReleaseNotes.replaceChildren(...(info?.notes || ['NEW ARCADE CONTENT AND POLISH']).map(note => {
    const item = document.createElement('li');
    item.textContent = note;
    return item;
  }));
};

const presentPwaUpdate = (origin = 'menu') => {
  if (!pwaUpdateReady || (origin === 'menu' && pwaUpdateDeferred) || game.active) return;
  pwaOverlayReturn = origin;
  renderPwaReleaseInfo();
  ui.settingsOverlay.classList.add('hidden');
  ui.pwaUpdateOverlay.classList.remove('hidden');
  ui.applyPwaUpdate.focus({ preventScroll: true });
};

const deferPwaUpdate = () => {
  pwaUpdateDeferred = true;
  ui.pwaUpdateOverlay.classList.add('hidden');
  if (pwaOverlayReturn === 'settings') ui.settingsOverlay.classList.remove('hidden');
};

const setAccountStatus = (message = '', kind = '') => {
  ui.accountFormStatus.textContent = message;
  ui.accountFormStatus.className = `account-form-status${kind ? ` ${kind}` : ''}`;
};

const renderAccount = () => {
  const presentation = accountPresentation();
  const passwordSetup = presentation.state === 'setup';
  const signedIn = presentation.state === 'signed-in';
  ui.accountStatePanel.dataset.state = presentation.state;
  ui.accountTitle.textContent = presentation.title;
  ui.accountIdentity.textContent = presentation.identity;
  ui.accountDescription.textContent = presentation.description;
  ui.accountTabs.classList.toggle('hidden', !presentation.showTabs);
  ui.accountForm.classList.toggle('hidden', !presentation.showForm);
  ui.callsignForm.classList.toggle('hidden', !presentation.showCallsign);
  ui.accountSignedInActions.classList.toggle('hidden', !signedIn || logoutConfirming);
  ui.accountLogoutConfirm.classList.toggle('hidden', !signedIn || !logoutConfirming);
  ui.accountEmailField.classList.toggle('hidden', !presentation.showEmail);
  ui.accountPasswordField.classList.toggle('hidden', !presentation.showPassword);
  ui.accountWarning.classList.toggle('hidden', !presentation.showWarning);
  ui.accountRecovery.classList.toggle('hidden', !presentation.showRecovery);
  ui.accountSecureTab.classList.toggle('selected', accountMode === 'secure');
  ui.accountSecureTab.setAttribute('aria-selected', String(accountMode === 'secure'));
  ui.accountLoginTab.classList.toggle('selected', accountMode === 'login');
  ui.accountLoginTab.setAttribute('aria-selected', String(accountMode === 'login'));
  ui.accountEmail.required = !passwordSetup;
  ui.accountPassword.required = passwordSetup || accountMode === 'login';
  ui.accountPassword.autocomplete = passwordSetup ? 'new-password' : 'current-password';
  ui.accountSubmit.disabled = accountBusy || localPreview;
  ui.callsignSubmit.disabled = accountBusy || (localPreview && !callsignPreviewMode);
  ui.accountRecovery.disabled = accountBusy || localPreview;
  ui.accountLogout.disabled = accountBusy || (localPreview && !profilePreviewMode);
  ui.confirmAccountLogout.disabled = accountBusy || (localPreview && !profilePreviewMode);
  ui.cancelAccountLogout.disabled = accountBusy;
  ui.accountSubmit.innerHTML = `<i>♛</i> ${presentation.action}`;
  renderSettings();
};

const openAccount = (mode = 'secure') => {
  logoutConfirming = false;
  accountMode = mode === 'login' || currentAccountState() === 'expired' ? 'login' : 'secure';
  setAccountStatus(playerAccount.redirectResult?.error || '');
  ui.settingsOverlay.classList.add('hidden');
  ui.accountOverlay.classList.remove('hidden');
  renderAccount();
  const target = accountPresentation().showCallsign ? ui.callsignInput : currentAccountState() === 'setup' ? ui.accountPassword : currentAccountState() === 'signed-in' ? null : ui.accountEmail;
  if (target && !target.closest('.hidden')) target.focus({ preventScroll: true });
};

const closeAccount = () => {
  if (accountBusy) return;
  logoutConfirming = false;
  ui.accountOverlay.classList.add('hidden');
  ui.settingsOverlay.classList.remove('hidden');
  ui.accountPassword.value = '';
  setAccountStatus();
  renderSettings();
  ui.openAccount.focus({ preventScroll: true });
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
  focusGameInput();
  sfx.play('confirm');
};

let startingRun = false;
const start = async () => {
  if (startingRun) return;
  if (serverEconomy && navigator.onLine === false) {
    showToast('ONLINE CONNECTION REQUIRED · RANKED RUN NOT STARTED', 'critical');
    return;
  }
  startingRun = true;
  clearInterval(runCheckpointTimer);
  runCheckpointSequence = 0;
  runCheckpointChain = Promise.resolve();
  ui.play.disabled = true;
  ui.retry.disabled = true;
  const generation = ++runGeneration;
  currentRunPromise = (async () => {
    let accessToken = '';
    if (serverEconomy) {
      if (!serverEconomyReady) await playerReadyPromise.catch(() => null);
      if (serverEconomyReady) accessToken = await playerAccount.getAccessToken().catch(() => '');
    }
    const run = await leaderboard.beginRun(selectedDifficulty, `${CONFIG.version.release}-${CONFIG.version.build}`, accessToken);
    return generation === runGeneration ? { ...run, walletBound: Boolean(accessToken) } : null;
  })().catch(() => null);
  rewardedAd.cancel();
  rewardedAdViewing = false;
  lastSponsoredClaimedRunId = '';
  closeRewardedAdOverlay();
  [ui.menu, ui.gameover, ui.assaultResult, ui.perkOverlay, ui.pauseOverlay, ui.settingsOverlay, ui.accountOverlay, ui.redeemOverlay, ui.adminOverlay, ui.tutorialOverlay, ui.vaultOverlay, ui.wardenOverlay, ui.pwaUpdateOverlay, ui.pwaInstallOverlay].forEach(element => element.classList.add('hidden'));
  ui.assaultHud.classList.add('hidden');
  document.documentElement.classList.remove('assault-active');
  ui.crateReveal.classList.add('hidden');
  ui.crateOpeningCinematic.className = 'crate-opening-cinematic hidden';
  ui.cosmeticDetail.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  ui.dashButton.classList.remove('hidden');
  ui.pauseButton.classList.remove('hidden');
  applyRunShip();
  game.start(selectedDifficulty);
  runCheckpointTimer = setInterval(() => {
    runCheckpointChain = runCheckpointChain.then(async () => {
      const run = await currentRunPromise;
      if (!run?.id || !run.checkpointToken) return;
      const summary = game.runSummary();
      const sequence = runCheckpointSequence + 1;
      const accessToken = run.walletBound ? await playerAccount.getAccessToken().catch(() => '') : '';
      const accepted = await leaderboard.checkpoint({
        runId: run.id, checkpointToken: run.checkpointToken, sequence,
        score: Math.max(0, Math.floor(game.score || 0)), ...summary,
      }, accessToken);
      run.checkpointToken = accepted.checkpointToken;
      runCheckpointSequence = sequence;
    }).catch(() => null);
  }, 20_000);
  economyRunId = createEconomyRunId();
  pendingScore = null;
  ui.scoreEntry.classList.add('hidden');
  ui.submitScore.classList.add('hidden');
  ui.watchAd.classList.add('hidden');
  ui.sponsoredReward.className = 'sponsored-reward hidden';
  game.reducedEffects = reducedEffects;
  music.playGame();
  const needsTutorial = localStorage.getItem(tutorialKey) !== 'seen' || (tutorialForced && !tutorialForcedUsed);
  if (needsTutorial) openTutorial();
  else focusGameInput();
  ui.play.disabled = false;
  ui.retry.disabled = false;
  startingRun = false;
};

ui.play.addEventListener('click', start);
ui.retry.addEventListener('click', start);
ui.home.addEventListener('click', returnToMenu);
ui.quitRun.addEventListener('click', returnToMenu);
ui.resume.addEventListener('click', resumeRun);
ui.pauseButton.addEventListener('click', () => pauseRun(false));
ui.tutorialDone.addEventListener('click', finishTutorial);
ui.menuSettings.addEventListener('click', () => openSettings('menu'));
ui.menuMode.addEventListener('click', () => { cycleDifficulty(1); sfx.play('confirm'); });
ui.menuLeaderboard.addEventListener('click', () => openLeaderboard('menu', selectedDifficulty));
ui.menuVault.addEventListener('click', openVault);
ui.menuWarden.addEventListener('click', openWarden);
ui.menuDuel.addEventListener('click', () => { void openDuel(); });
ui.closeDuel.addEventListener('click', closeDuel);
ui.duelCreate.addEventListener('click', createDuelChallenge);
ui.duelRefresh.addEventListener('click', () => { void refreshDuelChallenges(); });
ui.duelReady.addEventListener('click', toggleDuelReady);
ui.duelRematch.addEventListener('click', () => { void requestDuelRematch(); });
ui.duelResultBack.addEventListener('click', () => {
  ui.duelResult.classList.add('hidden');
  ui.duelOverlay.classList.remove('hidden');
  renderDuelRoom();
  ui.duelLeave.focus({ preventScroll: true });
});
ui.duelLeave.addEventListener('click', () => {
  if (duelChallenge?.match) closeDuel();
  else void leaveDuelRoom();
});
ui.duelShare.addEventListener('click', () => { void shareDuel(false); });
ui.openOwnProfile.addEventListener('click', () => {
  if (!playerProfile?.publicId) return;
  ui.settingsOverlay.classList.add('hidden');
  void openPilotProfile(playerProfile.publicId, ui.openOwnProfile, 'settings');
});
ui.closeWarden.addEventListener('click', closeWarden);
ui.wardenAssault.addEventListener('click', startBossAssault);
ui.assaultRetry.addEventListener('click', startBossAssault);
ui.assaultArmory.addEventListener('click', () => {
  returnToMenu();
  openWarden();
});
[ui.assaultRetry, ui.assaultArmory].forEach(button => {
  const select = () => {
    ui.assaultRetry.classList.toggle('result-selected', button === ui.assaultRetry);
    ui.assaultArmory.classList.toggle('result-selected', button === ui.assaultArmory);
  };
  button.addEventListener('focus', select);
  button.addEventListener('pointerenter', select);
});
ui.pauseSettings.addEventListener('click', () => openSettings('pause'));
ui.closeSettings.addEventListener('click', closeSettings);
ui.openRedeem.addEventListener('click', openRedeem);
ui.closeRedeem.addEventListener('click', closeRedeem);
ui.redeemCode.addEventListener('input', () => {
  const formatted = formatRewardCodeInput(ui.redeemCode.value);
  if (ui.redeemCode.value !== formatted) ui.redeemCode.value = formatted;
  ui.redeemReward.classList.add('hidden');
  setRedeemStatus();
});
ui.redeemForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (redeemBusy || currentAccountState() !== 'signed-in') return;
  const code = formatRewardCodeInput(ui.redeemCode.value);
  if (!/^CROWN-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
    setRedeemStatus('ENTER THE COMPLETE CROWN CODE', 'error');
    ui.redeemCode.focus({ preventScroll: true });
    return;
  }
  redeemBusy = true;
  ui.redeemSubmit.disabled = true;
  ui.redeemSubmit.innerHTML = '<i>♛</i> VERIFYING CODE...';
  ui.redeemReward.classList.add('hidden');
  setRedeemStatus('CONTACTING CROWN NETWORK...');
  try {
    let payload;
    if (campaignPreviewMode) {
      await wait(420);
      const state = shardWallet.getState();
      state.balance += 250;
      state.transactions.push({ id: `promo-preview:${Date.now()}`, kind: 'promo_shards', amount: 250, createdAt: new Date().toISOString() });
      shardWallet.write(state);
      payload = { redemption: { campaignName: 'LAUNCH REWARD', rewardType: 'shards', rewardAmount: 250 } };
    } else payload = await playerAccount.redeemRewardCode(code);
    if (payload.wallet) acceptServerWallet(payload);
    const reward = payload.redemption || {};
    ui.redeemRewardAmount.textContent = reward.rewardType === 'crate_credit'
      ? `+${reward.rewardAmount} FREE CRATE${reward.rewardAmount === 1 ? '' : 'S'}`
      : `+◆ ${Number(reward.rewardAmount).toLocaleString('en-US')} SHARDS`;
    ui.redeemRewardCampaign.textContent = `${reward.campaignName || 'CROWN NETWORK'} · DELIVERY COMPLETE`;
    ui.redeemReward.classList.remove('hidden');
    ui.redeemCode.value = '';
    setRedeemStatus('REWARD ADDED TO YOUR SECURE VAULT', 'success');
    renderShardBalance();
    renderVault();
    sfx.play('confirm');
    triggerHaptic([25, 35, 55]);
  } catch (error) {
    setRedeemStatus(String(error?.message || 'CODE COULD NOT BE REDEEMED').toUpperCase(), 'error');
  } finally {
    redeemBusy = false;
    ui.redeemSubmit.disabled = false;
    ui.redeemSubmit.innerHTML = '<i>♛</i> CLAIM REWARD';
  }
});
ui.openAdmin.addEventListener('click', () => void openAdmin());
ui.closeAdmin.addEventListener('click', closeAdmin);
ui.adminCreateTab.addEventListener('click', () => {
  adminMode = 'create';
  setAdminStatus();
  renderAdminMode();
  ui.adminCampaignName.focus({ preventScroll: true });
});
ui.adminCampaignsTab.addEventListener('click', () => {
  adminMode = 'campaigns';
  setAdminStatus();
  renderAdminMode();
  ui.adminCampaignList.querySelector('button')?.focus({ preventScroll: true });
});
ui.adminRewardType.addEventListener('change', () => {
  const crate = ui.adminRewardType.value === 'crate_credit';
  ui.adminRewardAmount.min = crate ? '1' : '25';
  ui.adminRewardAmount.max = crate ? '5' : '2500';
  ui.adminRewardAmount.value = crate ? '1' : '100';
});
ui.adminCodeForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!adminAccess || adminBusy) return;
  const expiryMs = Date.parse(ui.adminExpiresAt.value);
  if (!Number.isFinite(expiryMs)) {
    setAdminStatus('CHOOSE A VALID EXPIRY TIME', 'error');
    ui.adminExpiresAt.focus({ preventScroll: true });
    return;
  }
  adminBusy = true;
  ui.adminCreateCode.disabled = true;
  ui.adminCreateCode.innerHTML = '<i>♛</i> GENERATING...';
  ui.adminCodeReveal.classList.add('hidden');
  setAdminStatus('CREATING SERVER CAMPAIGN...');
  const campaign = {
    campaignName: ui.adminCampaignName.value,
    rewardType: ui.adminRewardType.value,
    rewardAmount: Number(ui.adminRewardAmount.value),
    maxRedemptions: Number(ui.adminMaxRedemptions.value),
    expiresAt: new Date(expiryMs).toISOString(),
    note: ui.adminNote.value,
  };
  try {
    let payload;
    if (campaignPreviewMode) {
      await wait(420);
      const code = previewRewardCode();
      payload = {
        code,
        promo: {
          id: crypto.randomUUID(), codeHint: `CROWN-****-****-${code.slice(-4)}`,
          ...campaign, campaignName: campaign.campaignName.trim().toUpperCase(),
          startsAt: new Date().toISOString(), redeemedCount: 0, status: 'active', createdAt: new Date().toISOString(),
        },
      };
    } else payload = await playerAccount.createRewardCode(campaign);
    lastCreatedRewardCode = String(payload.code || '');
    ui.adminCreatedCode.textContent = lastCreatedRewardCode;
    ui.adminCodeReveal.classList.remove('hidden');
    if (payload.promo) adminCampaigns.unshift(payload.promo);
    setAdminStatus('CAMPAIGN LIVE · CODE WILL NOT BE SHOWN AGAIN AFTER YOU LEAVE', 'success');
    resetAdminForm();
    renderAdminCampaigns();
    sfx.play('confirm');
    triggerHaptic([25, 30, 45]);
    ui.adminCopyCode.focus({ preventScroll: true });
  } catch (error) {
    lastCreatedRewardCode = '';
    setAdminStatus(String(error?.message || 'CODE COULD NOT BE CREATED').toUpperCase(), 'error');
  } finally {
    adminBusy = false;
    ui.adminCreateCode.disabled = false;
    ui.adminCreateCode.innerHTML = '<i>♛</i> GENERATE CODE';
  }
});
ui.adminCopyCode.addEventListener('click', async () => {
  if (!lastCreatedRewardCode) return;
  try {
    await navigator.clipboard.writeText(lastCreatedRewardCode);
    setAdminStatus('CODE COPIED · STORE IT SOMEWHERE SAFE', 'success');
    ui.adminCopyCode.innerHTML = '<i>♛</i> CODE COPIED';
  } catch {
    setAdminStatus('COPY BLOCKED · SELECT THE CODE ABOVE', 'error');
  }
});
ui.installApp.addEventListener('click', async () => {
  const result = await pwaManager?.install();
  if (result === 'instructions') openPwaInstallHelp();
  renderSettings();
});
ui.updateApp.addEventListener('click', () => { pwaUpdateDeferred = false; presentPwaUpdate('settings'); });
ui.closePwaInstall.addEventListener('click', closePwaInstallHelp);
ui.laterPwaUpdate.addEventListener('click', deferPwaUpdate);
ui.applyPwaUpdate.addEventListener('click', async () => {
  ui.applyPwaUpdate.disabled = true;
  ui.applyPwaUpdate.innerHTML = '<i>♛</i> UPDATING...';
  const started = await pwaManager?.applyUpdate();
  if (!started) {
    ui.applyPwaUpdate.disabled = false;
    ui.applyPwaUpdate.innerHTML = '<i>♛</i> TRY AGAIN';
  }
});
ui.openAccount.addEventListener('click', () => openAccount());
ui.closeAccount.addEventListener('click', closeAccount);
ui.accountLogout.addEventListener('click', () => {
  if (accountBusy || (localPreview && !profilePreviewMode) || currentAccountState() !== 'signed-in') return;
  logoutConfirming = true;
  setAccountStatus();
  renderAccount();
  ui.confirmAccountLogout.focus({ preventScroll: true });
});
ui.cancelAccountLogout.addEventListener('click', () => {
  if (accountBusy) return;
  logoutConfirming = false;
  renderAccount();
  ui.accountLogout.focus({ preventScroll: true });
});
ui.confirmAccountLogout.addEventListener('click', async () => {
  if (accountBusy || (localPreview && !profilePreviewMode) || currentAccountState() !== 'signed-in') return;
  accountBusy = true;
  setAccountStatus('LOGGING OUT ON THIS DEVICE...');
  renderAccount();
  if (profilePreviewMode) {
    await wait(320);
    accountPreviewSignedOut = true;
    playerProfile = null;
    profileStatus = 'ready';
    logoutConfirming = false;
    accountBusy = false;
    setAccountStatus('SIGNED OUT · YOUR CLOUD VAULT IS SAFE', 'success');
    renderAccount();
    return;
  }
  const logoutPromise = playerAccount.logout();
  playerProfile = null;
  profileStatus = 'ready';
  serverWallet = null;
  serverEconomyReady = false;
  armory = null;
  storeCatalog = [];
  storeCatalogLoaded = false;
  adminAccess = false;
  adminAccessChecked = false;
  adminCampaigns = [];
  lastCreatedRewardCode = '';
  logoutConfirming = false;
  renderShardBalance();
  renderVault();
  applyEquippedCosmetics();
  renderSettings();
  renderAccount();
  try {
    await logoutPromise;
    if (serverEconomy) await connectServerEconomy();
    setAccountStatus('SIGNED OUT · YOUR CLOUD VAULT IS SAFE', 'success');
    sfx.play('confirm');
  } catch {
    setAccountStatus('SIGNED OUT · GUEST VAULT TEMPORARILY OFFLINE', 'error');
  } finally {
    accountBusy = false;
    renderAccount();
  }
});
ui.accountSecureTab.addEventListener('click', () => {
  accountMode = 'secure';
  ui.accountPassword.value = '';
  setAccountStatus();
  renderAccount();
  ui.accountEmail.focus({ preventScroll: true });
});
ui.accountLoginTab.addEventListener('click', () => {
  accountMode = 'login';
  setAccountStatus();
  renderAccount();
  ui.accountEmail.focus({ preventScroll: true });
});
ui.accountForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (accountBusy || localPreview) return;
  accountBusy = true;
  setAccountStatus('CONTACTING CROWN NETWORK...');
  renderAccount();
  try {
    const passwordSetup = currentAccountState() === 'setup';
    if (passwordSetup) {
      await playerAccount.setPassword(ui.accountPassword.value);
      await Promise.allSettled([refreshPlayerProfile(), refreshAdminAccess()]);
      ui.accountPassword.value = '';
      setAccountStatus(profileStatus === 'error' ? 'ACCOUNT SECURED · PLAYER ID TEMPORARILY OFFLINE' : accountPresentation().showCallsign ? 'ACCOUNT SECURED · CHOOSE YOUR CALLSIGN' : 'ACCOUNT SECURED · PASSWORD SAVED', profileStatus === 'error' ? 'error' : 'success');
    } else if (accountMode === 'login') {
      const snapshot = await playerAccount.login(ui.accountEmail.value, ui.accountPassword.value);
      acceptServerWallet(snapshot);
      serverEconomyReady = true;
      await Promise.allSettled([refreshPlayerProfile(), refreshAdminAccess()]);
      ui.accountPassword.value = '';
      renderShardBalance();
      renderVault();
      applyEquippedCosmetics();
      setAccountStatus(profileStatus === 'error' ? 'SIGNED IN · PLAYER ID TEMPORARILY OFFLINE' : accountPresentation().showCallsign ? 'SIGNED IN · CHOOSE YOUR CALLSIGN' : 'SIGNED IN · VAULT RESTORED', profileStatus === 'error' ? 'error' : 'success');
    } else {
      const result = await playerAccount.linkEmail(ui.accountEmail.value);
      setAccountStatus(`VERIFY LINK SENT TO ${result.email}`, 'success');
    }
  } catch (error) {
    setAccountStatus(String(error.message || 'ACCOUNT SERVICE UNAVAILABLE').toUpperCase(), 'error');
  } finally {
    accountBusy = false;
    renderAccount();
    if (accountPresentation().showCallsign) queueMicrotask(() => ui.callsignInput.focus({ preventScroll: true }));
  }
});
const normalizeClientCallsign = value => String(value || '').toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 10);
ui.callsignInput.addEventListener('input', () => {
  const callsign = normalizeClientCallsign(ui.callsignInput.value);
  if (ui.callsignInput.value !== callsign) ui.callsignInput.value = callsign;
  ui.callsignPreview.textContent = callsign || 'PLAYER_1';
});
ui.callsignForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (accountBusy || (localPreview && !callsignPreviewMode) || !accountPresentation().showCallsign) return;
  const callsign = normalizeClientCallsign(ui.callsignInput.value);
  if (callsign.length < 3 || !/[A-Z]/.test(callsign) || callsign.startsWith('_') || callsign.endsWith('_')) {
    setAccountStatus('USE 3–10 CHARACTERS · INCLUDE A LETTER · NO _ AT THE ENDS', 'error');
    ui.callsignInput.focus({ preventScroll: true });
    return;
  }
  accountBusy = true;
  setAccountStatus('CHECKING CALLSIGN...');
  renderAccount();
  try {
    const result = callsignPreviewMode ? { profile: { displayName: callsign } } : await playerAccount.claimCallsign(callsign);
    playerProfile = result.profile || null;
    profileStatus = 'ready';
    ui.callsignInput.value = '';
    ui.callsignPreview.textContent = 'PLAYER_1';
    setAccountStatus(`CALLSIGN SECURED · WELCOME ${playerProfile?.displayName || callsign}`, 'success');
    sfx.play('confirm');
  } catch (error) {
    setAccountStatus(String(error.message || 'CALLSIGN SERVICE UNAVAILABLE').toUpperCase(), 'error');
  } finally {
    accountBusy = false;
    renderAccount();
  }
});
ui.accountRecovery.addEventListener('click', async () => {
  if (accountBusy || localPreview) return;
  accountBusy = true;
  setAccountStatus('REQUESTING RECOVERY LINK...');
  renderAccount();
  try {
    await playerAccount.requestPasswordRecovery(ui.accountEmail.value);
    setAccountStatus('IF THAT ACCOUNT EXISTS, A RECOVERY LINK IS ON ITS WAY', 'success');
  } catch (error) {
    setAccountStatus(String(error.message || 'ACCOUNT SERVICE UNAVAILABLE').toUpperCase(), 'error');
  } finally {
    accountBusy = false;
    renderAccount();
  }
});
ui.closeLeaderboard.addEventListener('click', closeLeaderboard);
ui.closePilotProfile.addEventListener('click', closePilotProfile);
ui.sharePilotProfile.addEventListener('click', sharePilotProfile);
ui.closeVault.addEventListener('click', closeVault);
ui.vaultCratesTab.addEventListener('click', () => {
  vaultMode = 'crates';
  renderVault();
  ui.openCrate.focus({ preventScroll: true });
  sfx.play('confirm');
});
ui.vaultStoreTab.addEventListener('click', () => {
  vaultMode = 'store';
  renderVault();
  if (serverEconomy && !storeCatalogLoaded) void loadCrownStore();
  ui.storeCatalog.querySelector('button')?.focus({ preventScroll: true });
  sfx.play('confirm');
});
ui.vaultMarketTab.addEventListener('click', () => {
  vaultMode = 'market';
  renderVault();
  void loadCrownMarket();
  ui.marketBrowseTab.focus({ preventScroll: true });
  sfx.play('confirm');
});
[ui.marketBrowseTab, ui.marketSellTab, ui.marketMineTab, ui.marketActivityTab].forEach((tab, index) => tab.addEventListener('click', () => {
  marketMode = ['browse', 'sell', 'mine', 'activity'][index];
  renderMarket();
  if (marketMode !== 'activity') ui.marketCatalog.querySelector('button')?.focus({ preventScroll: true });
  sfx.play('confirm');
}));
ui.marketCategoryFilter.addEventListener('change', () => {
  marketCategoryFilter = ui.marketCategoryFilter.value;
  renderMarket();
});
ui.marketRarityFilter.addEventListener('change', () => {
  marketRarityFilter = ui.marketRarityFilter.value;
  renderMarket();
});
ui.marketSortFilter.addEventListener('change', () => {
  marketSortFilter = ui.marketSortFilter.value;
  renderMarket();
});
ui.marketHideOwned.addEventListener('click', () => {
  marketHideOwned = !marketHideOwned;
  renderMarket();
  sfx.play('confirm');
});
ui.acknowledgeMarketSignal.addEventListener('click', async () => {
  const saleIds = (marketData.signals || []).map(signal => signal.id);
  if (marketBusy || !saleIds.length) return;
  try {
    marketBusy = true; renderMarketSignal();
    if (!localPreview) await playerAccount.acknowledgeMarketSignals(saleIds);
    marketData.signals = [];
    renderMarket(); sfx.play('confirm'); triggerHaptic(35);
  } catch {
    ui.acknowledgeMarketSignal.innerHTML = '<i>♛</i> TRY AGAIN';
  } finally {
    marketBusy = false; renderMarketSignal();
  }
});
ui.cosmeticCategoryTabs.forEach(tab => tab.addEventListener('click', () => {
  vaultCategory = tab.dataset.cosmeticCategory;
  renderVault();
  ui.vaultCollection.querySelector('button')?.focus({ preventScroll: true });
  sfx.play('confirm');
}));
ui.vaultOddsToggle.addEventListener('click', () => {
  vaultOddsExpanded = !vaultOddsExpanded;
  renderVaultOddsVisibility();
  sfx.play('confirm');
});
ui.vaultAnimationToggle.addEventListener('click', () => {
  vaultAnimationEnabled = !vaultAnimationEnabled;
  localStorage.setItem('cl:vault-animation', vaultAnimationEnabled ? 'on' : 'off');
  renderVault();
  sfx.play('confirm');
});
ui.revealContinue.addEventListener('click', closeCrateReveal);
ui.watchAd.addEventListener('click', showRewardedCrate);
ui.vaultWatchAd.addEventListener('click', showRewardedCrate);
ui.cancelRewardedAd.addEventListener('click', () => rewardedAd.cancel());
ui.closeCosmeticDetail.addEventListener('click', closeCosmeticDetail);
ui.storePurchaseContinue.addEventListener('click', closeStorePurchaseReveal);
ui.closeStoreRename.addEventListener('click', () => {
  if (storeBusySku) return;
  ui.storeRename.classList.add('hidden');
  ui.storeCatalog.querySelector('[data-store-sku="service_callsign_rename"]')?.focus({ preventScroll: true });
});
ui.closeMarketConfirm.addEventListener('click', () => {
  if (marketBusy) return;
  ui.marketConfirm.classList.add('hidden'); marketOrder = null;
  ui.marketCatalog.querySelector('button')?.focus({ preventScroll: true });
});
ui.marketConfirmForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (marketBusy || !marketOrder) return;
  const { type, item } = marketOrder;
  let purchaseCompleted = false;
  try {
    marketBusy = true; ui.marketConfirmSubmit.disabled = true; ui.marketConfirmStatus.textContent = 'VERIFYING MARKET ORDER...';
    if (type === 'list') {
      const price = Number(ui.marketPriceInput.value);
      if (!ui.marketPriceInput.reportValidity()) throw Object.assign(new Error('Price outside rarity range.'), { code: 'PRICE_OUT_OF_RANGE' });
      if (localPreview) {
        shardWallet.previewMarketList(item.cosmeticId);
        marketData.myListings.unshift({ id: `preview-mine-${Date.now()}`, cosmeticId: item.cosmeticId, price, status: 'active', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() });
      } else {
        const result = await playerAccount.createMarketListing(item.cosmeticId, price); acceptServerWallet(result); marketData = result.market;
      }
      ui.marketConfirmStatus.textContent = `LISTED FOR ◆ ${price.toLocaleString('en-US')}`;
    } else if (type === 'buy') {
      if (localPreview) {
        shardWallet.previewMarketBuy(item.cosmeticId, item.price); marketData.listings = marketData.listings.filter(listing => listing.id !== item.id);
        marketData.activity.unshift({ id: `preview-buy-${Date.now()}`, kind: 'bought', cosmeticId: item.cosmeticId, amount: -item.price, fee: 0, counterparty: item.sellerName, occurredAt: new Date().toISOString() });
      }
      else { const result = await playerAccount.buyMarketListing(item.id); acceptServerWallet(result); marketData = result.market; }
      ui.marketConfirmStatus.textContent = 'PURCHASE COMPLETE · ADDED TO COLLECTION';
      purchaseCompleted = true;
    } else {
      if (localPreview) {
        shardWallet.previewMarketCancel(item.cosmeticId); item.status = 'cancelled';
        marketData.activity.unshift({ id: `preview-cancel-${Date.now()}`, kind: 'cancelled', cosmeticId: item.cosmeticId, amount: 0, fee: 0, counterparty: null, occurredAt: new Date().toISOString() });
      }
      else { const result = await playerAccount.cancelMarketListing(item.id); acceptServerWallet(result); marketData = result.market; }
      ui.marketConfirmStatus.textContent = 'LISTING CANCELLED · ITEM RETURNED';
    }
    renderVault(); sfx.play('perk'); triggerHaptic([30, 20, 55]);
    if (purchaseCompleted) {
      selectedCosmeticDetailId = item.cosmeticId;
      ui.marketConfirm.classList.add('hidden'); marketOrder = null;
      showStorePurchaseReveal(item.cosmeticId, 'market');
    } else setTimeout(() => { ui.marketConfirm.classList.add('hidden'); marketOrder = null; renderMarket(); }, 650);
  } catch (error) {
    const messages = { ITEM_EQUIPPED: 'UNEQUIP THIS ITEM BEFORE SELLING', NOT_ENOUGH_SHARDS: 'NOT ENOUGH SHARDS', ALREADY_OWNED: 'YOU ALREADY OWN THIS ITEM', LISTING_UNAVAILABLE: 'THIS LISTING IS NO LONGER AVAILABLE', PRICE_OUT_OF_RANGE: 'PRICE OUTSIDE THE RARITY RANGE' };
    ui.marketConfirmStatus.textContent = messages[error?.code] || 'MARKET ORDER FAILED · NO VALUE MOVED';
  } finally { marketBusy = false; ui.marketConfirmSubmit.disabled = false; renderMarket(); }
});
ui.storeCallsignInput.addEventListener('input', () => {
  const normalized = ui.storeCallsignInput.value.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 10);
  if (ui.storeCallsignInput.value !== normalized) ui.storeCallsignInput.value = normalized;
});
ui.storeRenameForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (storeBusySku || localPreview || currentAccountState() !== 'signed-in') return;
  const callsign = ui.storeCallsignInput.value.trim().toUpperCase();
  if (!ui.storeRenameForm.reportValidity() || callsign === playerProfile?.displayName) {
    ui.storeRenameStatus.textContent = callsign === playerProfile?.displayName ? 'CHOOSE A NEW CALLSIGN' : 'CHECK THE CALLSIGN FORMAT';
    return;
  }
  try {
    storeBusySku = 'service_callsign_rename';
    ui.storeRenameSubmit.disabled = true;
    ui.storeRenameStatus.textContent = 'SECURING NEW ARCADE ID...';
    const result = await playerAccount.renameCallsign(callsign);
    playerProfile = result.profile || playerProfile;
    await refreshServerWallet();
    storeMessage = `CALLSIGN CHANGED · WELCOME ${playerProfile.displayName}`;
    ui.storeCurrentCallsign.textContent = playerProfile.displayName;
    ui.storeCallsignInput.value = '';
    ui.storeRenameStatus.textContent = `CALLSIGN SECURED · ◆ ${Number(result.cost || 500).toLocaleString('en-US')} SPENT`;
    renderMenuIdentity();
    renderVault();
    sfx.play('perk');
    triggerHaptic([35, 25, 55]);
  } catch (error) {
    const messages = {
      CALLSIGN_TAKEN: 'THAT CALLSIGN IS ALREADY TAKEN',
      RENAME_COOLDOWN: 'CALLSIGN CHANGE IS STILL ON COOLDOWN',
      NOT_ENOUGH_SHARDS: 'NOT ENOUGH SHARDS',
    };
    ui.storeRenameStatus.textContent = messages[error?.code] || String(error?.message || 'CALLSIGN SERVICE UNAVAILABLE').toUpperCase();
  } finally {
    storeBusySku = '';
    ui.storeRenameSubmit.disabled = false;
    renderVault();
  }
});
ui.randomFavoriteToggle.addEventListener('click', () => {
  try {
    cosmeticPreferences.toggleRandom(Object.keys(walletState().inventory.cosmetics));
    triggerHaptic(18);
    renderVault();
  } catch {
    ui.vaultStatus.textContent = 'MARK AT LEAST ONE OWNED SHIP AS FAVORITE';
  }
});
ui.favoriteCosmetic.addEventListener('click', () => {
  try {
    const state = cosmeticPreferences.toggleFavorite(selectedCosmeticDetailId, Object.keys(walletState().inventory.cosmetics));
    triggerHaptic(state.favorites.includes(selectedCosmeticDetailId) ? [18, 24, 30] : 18);
    renderVault();
    showCosmeticDetail(selectedCosmeticDetailId, selectedCosmeticOrigin);
  } catch {
    ui.cosmeticDetailHint.textContent = 'ONLY OWNED SHIPS CAN BE FAVORITES';
  }
});
ui.equipCosmetic.addEventListener('click', async () => {
  const state = walletState();
  const selectedCosmetic = COSMETIC_BY_ID[selectedCosmeticDetailId];
  const acquired = isDefaultCosmetic(selectedCosmetic) || Boolean(state.inventory.cosmetics[selectedCosmeticDetailId]);
  const storeProduct = storeProductForCosmetic(selectedCosmeticDetailId);
  let purchased = false;
  try {
    ui.equipCosmetic.disabled = true;
    if (!acquired && storeProduct) {
      storeBusySku = storeProduct.sku;
      storeMessage = 'AUTHORIZING STORE PURCHASE...';
      ui.storeStatus.textContent = storeMessage;
      if (localPreview) shardWallet.purchaseStoreItem(storeProduct.sku);
      else acceptServerWallet(await playerAccount.purchaseStoreItem(storeProduct.sku));
      purchased = true;
      storeMessage = `${storeProduct.name} ACQUIRED · READY TO EQUIP`;
      ui.storeStatus.textContent = storeMessage;
      sfx.play('vault-royal');
      triggerHaptic([35, 30, 70]);
    } else if (localPreview) shardWallet.equipCosmetic(selectedCosmeticDetailId);
    else acceptServerWallet(await playerAccount.equipCosmetic(selectedCosmeticDetailId));
    applyEquippedCosmetics();
    renderVault();
    if (purchased) showStorePurchaseReveal(selectedCosmeticDetailId);
    else showCosmeticDetail(selectedCosmeticDetailId, selectedCosmeticOrigin);
    if (acquired) {
      sfx.play('perk');
      triggerHaptic([35, 25, 55]);
    }
  } catch (error) {
    ui.cosmeticDetailHint.textContent = error?.code === 'NOT_ENOUGH_SHARDS'
      ? 'NOT ENOUGH SHARDS FOR THIS ACQUISITION'
      : error?.code === 'ALREADY_OWNED'
        ? 'ITEM ALREADY OWNED · INVENTORY REFRESHED'
        : 'STORE LINK FAILED · NO SHARDS WERE SPENT';
    ui.equipCosmetic.disabled = false;
  } finally {
    storeBusySku = '';
    renderVault();
  }
});
ui.openCrate.addEventListener('click', async () => {
  if (crateOpening) return;
  try {
    crateOpening = true;
    const result = localPreview ? shardWallet.openCrate() : await playerAccount.openCrate();
    if (serverEconomy) await refreshServerWallet();
    renderVault();
    sfx.play('confirm');
    await playCrateOpeningCinematic({ tier: result.outcome.tier });
    crateOpening = false;
    renderVault();
    showCrateReveal(result.outcome);
  } catch (error) {
    crateOpening = false;
    ui.crateOpeningCinematic.className = 'crate-opening-cinematic hidden';
    renderVault();
    ui.vaultStatus.textContent = error?.code === 'NOT_ENOUGH_SHARDS' || error?.status === 409 ? 'NOT ENOUGH SHARDS' : 'VAULT LINK FAILED · TRY AGAIN';
  }
});
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
  if (pendingScore.run.preview) {
    ui.scoreSubmitStatus.textContent = 'LOCAL PREVIEW · LIVE SCORES USE YOUR ACCOUNT';
    return;
  }
  const accountCallsign = pendingScore.run.walletBound ? String(playerProfile?.displayName || pendingScore.callsign || '') : '';
  const initials = accountCallsign ? '' : normalizeInitials(ui.playerInitials.value);
  if (pendingScore.run.walletBound && !accountCallsign) {
    ui.scoreSubmitStatus.textContent = 'CALLSIGN REQUIRED · OPEN PLAYER ACCOUNT';
    return;
  }
  if (!accountCallsign && initials.length !== 3) {
    ui.scoreSubmitStatus.textContent = 'ENTER EXACTLY 3 INITIALS';
    ui.playerInitials.focus();
    return;
  }
  ui.submitScore.disabled = true;
  ui.scoreSubmitStatus.textContent = 'TRANSMITTING...';
  try {
    const summary = pendingScore.summary;
    await runCheckpointChain.catch(() => null);
    const accessToken = serverEconomy && serverEconomyReady ? await playerAccount.getAccessToken().catch(() => '') : '';
    const result = await leaderboard.submit({
      runId: pendingScore.run.id,
      checkpointToken: pendingScore.run.checkpointToken,
      sequence: runCheckpointSequence || 1,
      ...(accountCallsign ? {} : { initials }),
      score: pendingScore.score,
      difficulty: pendingScore.difficulty,
      durationMs: summary.durationMs,
      zone: summary.zone,
      wardens: summary.wardens,
      enemies: summary.enemies,
      crates: summary.crates,
      bestCombo: summary.bestCombo,
      gameVersion: `${CONFIG.version.release}-${CONFIG.version.build}`,
    }, accessToken);
    if (!accountCallsign) localStorage.setItem('cl:initials', initials);
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
ui.profileVisibility.addEventListener('click', async () => {
  if (ui.profileVisibility.disabled || !playerProfile?.publicId) return;
  const nextVisibility = playerProfile.isPublic === false;
  ui.profileVisibility.disabled = true;
  ui.profileVisibility.querySelector('b').textContent = 'SAVING';
  try {
    const payload = await playerAccount.setProfileVisibility(nextVisibility);
    playerProfile = payload.profile || { ...playerProfile, isPublic: nextVisibility };
    triggerHaptic(18);
  } catch {
    ui.profileVisibility.querySelector('b').textContent = 'TRY AGAIN';
    setTimeout(renderSettings, 1200);
    return;
  }
  renderSettings();
});
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
    if (!hapticsSupported) return;
    hapticsEnabled = !hapticsEnabled;
    localStorage.setItem('cl:haptics', hapticsEnabled ? 'on' : 'off');
    triggerHaptic(20);
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
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { input.clear(); pauseRun(true); }
});
addEventListener('blur', () => pauseRun(true));
addEventListener('keydown', event => {
  if (event.code !== 'Escape') return;
  event.preventDefault();
  if (!ui.crateOpeningCinematic.classList.contains('hidden')) return;
  if (!ui.pilotProfileOverlay.classList.contains('hidden')) closePilotProfile();
  else if (!ui.pwaUpdateOverlay.classList.contains('hidden')) deferPwaUpdate();
  else if (!ui.pwaInstallOverlay.classList.contains('hidden')) closePwaInstallHelp();
  else if (!ui.rewardedAdOverlay.classList.contains('hidden')) rewardedAd.cancel();
  else if (!ui.storePurchaseReveal.classList.contains('hidden')) closeStorePurchaseReveal();
  else if (!ui.storeRename.classList.contains('hidden') && !storeBusySku) ui.closeStoreRename.click();
  else if (!ui.cosmeticDetail.classList.contains('hidden')) closeCosmeticDetail();
  else if (!ui.crateReveal.classList.contains('hidden')) closeCrateReveal();
  else if (!ui.assaultResult.classList.contains('hidden')) returnToMenu();
  else if (!ui.duelOverlay.classList.contains('hidden')) closeDuel();
  else if (!ui.wardenOverlay.classList.contains('hidden')) closeWarden();
  else if (!ui.vaultOverlay.classList.contains('hidden')) closeVault();
  else if (!ui.leaderboardOverlay.classList.contains('hidden')) closeLeaderboard();
  else if (!ui.adminOverlay.classList.contains('hidden')) closeAdmin();
  else if (!ui.redeemOverlay.classList.contains('hidden')) closeRedeem();
  else if (!ui.accountOverlay.classList.contains('hidden')) closeAccount();
  else if (!ui.settingsOverlay.classList.contains('hidden')) closeSettings();
  else if (!ui.pauseOverlay.classList.contains('hidden')) resumeRun();
  else pauseRun(false);
});
addEventListener('keydown', event => {
  if (ui.assaultResult.classList.contains('hidden')) return;
  if (['ArrowDown', 'ArrowUp', 'KeyW', 'KeyS'].includes(event.code)) {
    event.preventDefault();
    const next = ui.assaultRetry.classList.contains('result-selected') ? ui.assaultArmory : ui.assaultRetry;
    next.focus({ preventScroll: true });
    sfx.play('confirm');
  } else if (event.code === 'Enter' || event.code === 'Space') {
    event.preventDefault();
    (ui.assaultRetry.classList.contains('result-selected') ? ui.assaultRetry : ui.assaultArmory).click();
  }
});
addEventListener('keydown', event => {
  if (ui.gameover.classList.contains('hidden') || !ui.leaderboardOverlay.classList.contains('hidden') || !ui.vaultOverlay.classList.contains('hidden') || !ui.rewardedAdOverlay.classList.contains('hidden') || !ui.crateOpeningCinematic.classList.contains('hidden') || !ui.crateReveal.classList.contains('hidden') || document.activeElement === ui.playerInitials) return;
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
  if (ui.menu.classList.contains('hidden') || !ui.settingsOverlay.classList.contains('hidden') || !ui.accountOverlay.classList.contains('hidden') || !ui.redeemOverlay.classList.contains('hidden') || !ui.adminOverlay.classList.contains('hidden') || !ui.leaderboardOverlay.classList.contains('hidden') || !ui.vaultOverlay.classList.contains('hidden') || !ui.wardenOverlay.classList.contains('hidden') || !ui.duelOverlay.classList.contains('hidden')) return;
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
  } else if ((event.code === 'ArrowLeft' || event.code === 'KeyA' || event.code === 'ArrowRight' || event.code === 'KeyD') && ui.menuChoices[selectedMenuChoice] === ui.menuMode) {
    event.preventDefault();
    input.clear();
    cycleDifficulty(event.code === 'ArrowLeft' || event.code === 'KeyA' ? -1 : 1);
    sfx.play('confirm');
  } else if (event.code === 'Enter' || event.code === 'Space') {
    event.preventDefault();
    input.clear();
    ui.menuChoices[selectedMenuChoice].click();
  }
});

pwaManager = new PwaManager({
  preview: pwaPreviewMode,
  onInstallChange: renderSettings,
  onUpdateReady: ({ releaseInfo } = {}) => {
    pwaReleaseInfo = releaseInfo || pwaReleaseInfo;
    pwaUpdateReady = true;
    renderSettings();
    if (!requestedPilotProfileId && !requestedDuelCode && !duelPreviewMode && !game.active && !ui.menu.classList.contains('hidden') && ui.settingsOverlay.classList.contains('hidden') && ui.duelOverlay.classList.contains('hidden')) presentPwaUpdate('menu');
  },
});
pwaManager.register();
renderSettings();
if (pwaPreviewMode && debugParams.has('update')) {
  pwaUpdateReady = true;
  pwaManager.getReleaseInfo().then(releaseInfo => {
    pwaReleaseInfo = releaseInfo;
    renderSettings();
    presentPwaUpdate('menu');
  });
}
loadLeaderboard(selectedDifficulty, true);
void (serverEconomy ? playerReadyPromise : Promise.resolve()).then(() => loadBossEvent(), () => loadBossEvent());
if (requestedPilotProfileId) {
  void (serverEconomy ? playerReadyPromise : Promise.resolve()).finally(() => {
    pilotDeepLinkActive = true;
    openPilotProfile(requestedPilotProfileId, null, 'direct');
  });
}
if (requestedDuelCode) {
  void (serverEconomy ? playerReadyPromise : Promise.resolve()).finally(() => { void openDuel(requestedDuelCode); });
} else if (duelPreviewMode) {
  void (serverEconomy ? playerReadyPromise : Promise.resolve()).finally(() => { void openDuel(); });
}

// Local provspelningsgenväg; finns inte när spelet körs på crownlizard.com.
// Never let a query string enable test controls on the public site.
const debugMode = localPreview && debugParams.has('debug');
document.documentElement.classList.toggle('touch-preview', debugMode && debugParams.has('touch'));
if (localPreview && debugParams.has('vault')) {
  const previewState = shardWallet.getState();
  const previewBatch = debugParams.get('vault') || '1';
  const previewTarget = Math.min(50_000, Math.max(600, Math.floor(Number(debugParams.get('shards')) || 600)));
  const previewId = `debug:vault-preview:${previewBatch}:${previewTarget}`;
  if (!previewState.transactions.some(transaction => transaction.id === previewId)) {
    const credit = Math.max(0, previewTarget - previewState.balance);
    previewState.balance += credit;
    previewState.transactions.push({ id: previewId, kind: 'debug_credit', amount: credit, createdAt: new Date().toISOString() });
    shardWallet.write(previewState);
    renderShardBalance();
  }
}
if (localPreview && debugParams.has('sovereign')) {
  const sovereignState = shardWallet.getState();
  const sovereignPreviewId = `debug:sovereign-preview:${debugParams.get('sovereign') || '1'}`;
  if (!sovereignState.transactions.some(transaction => transaction.id === sovereignPreviewId)) {
    sovereignState.vault.sinceSovereign = SOVEREIGN_GUARANTEE - 1;
    sovereignState.transactions.push({ id: sovereignPreviewId, kind: 'debug_guarantee', amount: 0, createdAt: new Date().toISOString() });
    shardWallet.write(sovereignState);
    renderShardBalance();
  }
}
if (debugMode) {
  globalThis.__crownLizardDebug = game;
  const debugWeapons = { Digit1: 'blaster', Digit2: 'spread', Digit3: 'pulse', Digit4: 'laser', Digit5: 'tesla' };
  const debugBossBlueprints = Object.entries(BOSS_BLUEPRINTS);
  const debugEnemies = ['chaser', 'shooter', 'tank', 'weaver', 'skimmer'];
  const debugEnemyNames = { chaser: 'RIPPER', shooter: 'HEX MOTH', tank: 'IRON SCARAB', weaver: 'CROWN WEAVER', skimmer: 'VOID SKIMMER' };
  let debugEnemyIndex = 0;
  let debugLateFormationIndex = 0;
  let debugBossBlueprintIndex = Math.max(0, debugBossBlueprints.findIndex(([id]) => id === armory?.progression?.selectedBlueprintId));
  addEventListener('keydown', event => {
    if (['F1', 'F2', 'F3'].includes(event.code) && game.mode === 'assault' && game.active) {
      event.preventDefault();
      const phase = Number(event.code.slice(1));
      game.debugAssaultPhase(phase);
      showToast(`DEBUG ASSAULT · PHASE ${phase}`, 'debug');
    }
    if ((event.code === 'BracketLeft' || event.code === 'BracketRight') && game.mode === 'assault' && game.active) {
      event.preventDefault();
      debugBossBlueprintIndex = (debugBossBlueprintIndex + (event.code === 'BracketRight' ? 1 : -1) + debugBossBlueprints.length) % debugBossBlueprints.length;
      const [blueprintId, loadout] = debugBossBlueprints[debugBossBlueprintIndex];
      game.debugAssaultLoadout({ blueprintId, ...loadout });
      showToast(`DEBUG LOADOUT · ${blueprintId.replaceAll('_', ' ').toUpperCase()}`, 'debug');
    }
    if (event.code === 'KeyT' && game.mode === 'assault' && game.active) {
      event.preventDefault();
      game.assault.elapsed = ASSAULT_DURATION - .2;
      showToast('DEBUG ASSAULT · FINAL SECONDS', 'debug');
    }
    if (event.code === 'KeyP' || event.key?.toLowerCase() === 'p') {
      event.preventDefault();
      if (!game.active && ui.menu.classList.contains('hidden') === false) start();
      if (!ui.tutorialOverlay.classList.contains('hidden') || game.paused) return;
      const debugRunVisible = ui.menu.classList.contains('hidden') && ui.gameover.classList.contains('hidden') && game.player.health > 0;
      if (game.awaitingPerk || game.awaitingMastery) ui.perkOverlay.classList.remove('hidden');
      else if (debugRunVisible) {
        game.active = true;
        game.offerWardenReward();
      }
    }
    if (event.code === 'KeyZ' && game.active) {
      game.time = (game.stageIndex + 1) * CONFIG.stageDuration + .05;
      showToast('DEBUG · NEXT ZONE', 'debug');
    }
    if (event.code === 'KeyL' && game.active) {
      const formations = ['armoredAdvance', 'crossfire', 'royalEscort'];
      const minimumStage = debugLateFormationIndex >= 2 ? 8 : 4;
      game.time = minimumStage * CONFIG.stageDuration + 58;
      game.stageIndex = minimumStage;
      game.lastStageIndex = minimumStage;
      game.introducedThreats.add('weaver');
      game.introducedThreats.add('skimmer');
      game.enemies = [];
      game.enemyBullets = [];
      const formation = formations[debugLateFormationIndex++ % formations.length];
      game.spawnFormation(formation);
      game.events.stage?.(game.stageInfo());
      showToast(`DEBUG LATE · ${formation.replace(/([A-Z])/g, ' $1').toUpperCase()}`, 'debug');
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
    if (event.code === 'KeyR' && game.active && ui.tutorialOverlay.classList.contains('hidden')) {
      game.time = Math.max(game.time, 95);
      game.score = Math.max(game.score, 5000);
      game.runStats.enemies = Math.max(game.runStats.enemies, 24);
      game.runStats.wardens = Math.max(game.runStats.wardens, 1);
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
    if ((event.code === 'KeyM' || event.key?.toLowerCase() === 'm') && game.active) {
      game.weaponLevels[game.weapon] = 5;
      game.queueWeaponMastery(game.weapon);
      game.weaponTimer = 0;
      showToast(`DEBUG MAX · ${CONFIG.weapons[game.weapon].name} MK 5`, 'debug');
    }
    const weapon = debugWeapons[event.code];
    if (weapon && game.active) {
      game.weaponLevels[weapon] = Math.max(1, game.weaponLevels[weapon]);
      game.weapon = weapon;
      game.weaponTimer = 0;
      showToast(`DEBUG WEAPON · ${CONFIG.weapons[weapon].name}`, 'debug');
    }
  });

  if (debugParams.has('assault')) {
    void (async () => {
      openWarden();
      await Promise.allSettled([loadArmory(), loadBossEvent()]);
      const requestedBlueprint = debugParams.get('blueprint');
      if (requestedBlueprint && BOSS_BLUEPRINTS[requestedBlueprint] && armory?.progression) {
        armory.progression.selectedBlueprintId = requestedBlueprint;
        renderArmory();
      }
    })();
  }
  if (debugParams.has('duelresult')) {
    setTimeout(() => {
      duelRunComplete = true;
      duelFinalScore = 68420;
      duelChallenge = {
        challengeId: 'preview-duel-result', status: 'matched', viewerRole: 'host',
        host: previewDuelHost('CROWNACE'), guest: previewDuelHost('VOIDLIZARD', 'ship_void_hunter'),
        match: { phase: 'finished', round: 1, yourScore: 68420, rivalScore: 63110, verification: 'final',
          yourVerification: 'verified', rivalVerification: 'verified', winner: debugParams.get('duelresult') || 'you',
          finalizedAt: new Date().toISOString(), yourRematch: false, rivalRematch: false },
      };
      ui.duelOverlay.classList.add('hidden');
      ui.menu.classList.add('hidden');
      ui.duelResult.classList.remove('hidden');
      renderDuelResult(duelChallenge);
    }, 1_200);
  }
}
