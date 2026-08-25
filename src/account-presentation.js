export const ACCOUNT_STATES = Object.freeze({
  PREVIEW: 'preview',
  GUEST: 'guest',
  SETUP: 'setup',
  EXPIRED: 'expired',
  SIGNED_IN: 'signed-in',
});

export const buildAccountPresentation = ({ state, mode = 'secure', email = '' }) => {
  const normalizedState = Object.values(ACCOUNT_STATES).includes(state) ? state : ACCOUNT_STATES.GUEST;
  const loginMode = mode === 'login';
  const signedIn = normalizedState === ACCOUNT_STATES.SIGNED_IN;
  const setup = normalizedState === ACCOUNT_STATES.SETUP;
  const expired = normalizedState === ACCOUNT_STATES.EXPIRED;
  const preview = normalizedState === ACCOUNT_STATES.PREVIEW;
  const playerEmail = String(email || '').trim().toUpperCase();

  return {
    state: normalizedState,
    badge: preview ? 'LIVE ONLY' : signedIn ? 'SIGNED IN' : setup ? 'SET PASSWORD' : expired ? 'SIGN IN' : 'GUEST',
    identity: preview ? 'LIVE FEATURE' : signedIn ? 'SIGNED IN' : setup ? 'EMAIL VERIFIED' : expired ? 'SIGN IN REQUIRED' : 'GUEST PLAYER',
    description: preview
      ? 'PLAYER ACCOUNTS ARE AVAILABLE ON CROWNLIZARD.COM.'
      : signedIn
        ? `${playerEmail || 'CROWN PLAYER'} · VAULT SYNCED ACROSS DEVICES.`
        : setup
          ? `${playerEmail || 'EMAIL VERIFIED'} · CREATE A PASSWORD TO FINISH.`
          : expired
            ? `${playerEmail || 'CROWN ACCOUNT'} · YOUR VAULT IS SAFE. SIGN IN AGAIN.`
            : loginMode
              ? 'SIGN IN TO RESTORE YOUR EXISTING CROWN VAULT.'
              : 'CREATE AN ACCOUNT TO PROTECT THIS VAULT ON OTHER DEVICES.',
    vaultStatus: preview
      ? 'LOCAL PREVIEW'
      : signedIn
        ? 'CLOUD VAULT · SYNCED'
        : setup
          ? 'CLOUD VAULT · FINISH SETUP'
          : expired
            ? 'CLOUD VAULT · SIGN IN REQUIRED'
            : 'DEVICE VAULT · GUEST',
    showTabs: !signedIn && !setup,
    showForm: !signedIn,
    showEmail: !setup,
    showPassword: setup || loginMode,
    showWarning: !signedIn && !setup && loginMode,
    showRecovery: !signedIn && !setup && loginMode,
    action: setup ? 'CREATE PASSWORD' : loginMode ? 'SIGN IN' : 'SEND VERIFY LINK',
  };
};
