import { PLATFORM_BUILD } from './platform-config.js?v=20260907-crazygames-data-pass2';

const PLATFORM_IDS = new Set(['crownlizard', 'crazygames']);
const CAPABILITY_KEYS = [
  'crownServices',
  'accounts',
  'supportPages',
  'pwa',
  'portalSdk',
  'rewardedAds',
  'progressSave',
  'localProgression',
  'vault',
  'store',
  'market',
];

const normalizePlatform = value => {
  if (!value || !PLATFORM_IDS.has(value.id)) throw new Error('INVALID_PLATFORM_BUILD');
  const capabilities = Object.fromEntries(CAPABILITY_KEYS.map(key => [key, value.capabilities?.[key] === true]));
  return Object.freeze({
    id: value.id,
    label: String(value.label || value.id),
    capabilities: Object.freeze(capabilities),
  });
};

export const PLATFORM = normalizePlatform(PLATFORM_BUILD);

export const applyPlatformCapabilities = (root = document) => {
  document.documentElement.dataset.platform = PLATFORM.id;
  root.querySelectorAll('[data-platform-capability]').forEach(element => {
    const capability = element.dataset.platformCapability;
    if (PLATFORM.capabilities[capability] === true) return;
    element.hidden = true;
    element.classList.add('hidden');
  });
};
