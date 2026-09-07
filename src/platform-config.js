// Local source preview always uses the Crown Lizard profile.
// Production bundles overwrite this file from platforms/<id>.json at build time.
export const PLATFORM_BUILD = Object.freeze({
  id: 'crownlizard',
  label: 'Crown Lizard Web',
  capabilities: Object.freeze({
    crownServices: true,
    accounts: true,
    supportPages: true,
    pwa: true,
    portalSdk: false,
    rewardedAds: false,
    progressSave: false,
    localProgression: true,
    vault: true,
    store: true,
    market: true,
  }),
});
