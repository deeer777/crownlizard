import assert from 'node:assert/strict';
import { buildAccountPresentation } from '../src/account-presentation.js';

const guest = buildAccountPresentation({ state: 'guest', mode: 'secure' });
assert.equal(guest.badge, 'GUEST');
assert.equal(guest.identity, 'GUEST PLAYER');
assert.equal(guest.action, 'SEND VERIFY LINK');
assert.equal(guest.vaultStatus, 'DEVICE VAULT · GUEST');
assert.equal(guest.showRecovery, false, 'account creation never shows password recovery');

const preview = buildAccountPresentation({ state: 'preview', mode: 'secure' });
assert.equal(preview.vaultStatus, 'LOCAL PREVIEW');

const login = buildAccountPresentation({ state: 'guest', mode: 'login' });
assert.equal(login.action, 'SIGN IN');
assert.equal(login.showPassword, true);
assert.equal(login.showRecovery, true, 'password recovery only appears in sign-in mode');

const setup = buildAccountPresentation({ state: 'setup', mode: 'secure', email: 'pilot@example.com' });
assert.equal(setup.identity, 'EMAIL VERIFIED');
assert.equal(setup.action, 'CREATE PASSWORD');
assert.equal(setup.showTabs, false);
assert.equal(setup.vaultStatus, 'CLOUD VAULT · FINISH SETUP');

const expired = buildAccountPresentation({ state: 'expired', mode: 'login', email: 'pilot@example.com' });
assert.equal(expired.badge, 'SIGN IN');
assert.equal(expired.identity, 'SIGN IN REQUIRED');
assert.match(expired.description, /YOUR VAULT IS SAFE/);
assert.equal(expired.vaultStatus, 'CLOUD VAULT · SIGN IN REQUIRED');

const signedIn = buildAccountPresentation({ state: 'signed-in', mode: 'secure', email: 'pilot@example.com' });
assert.equal(signedIn.badge, 'SIGNED IN');
assert.equal(signedIn.identity, 'SIGNED IN');
assert.match(signedIn.description, /PILOT@EXAMPLE\.COM · VAULT SYNCED/);
assert.equal(signedIn.showTabs, false);
assert.equal(signedIn.showForm, false);
assert.equal(signedIn.showRecovery, false, 'signed-in players never see verification or recovery controls');
assert.equal(signedIn.vaultStatus, 'CLOUD VAULT · SYNCED');

console.log('Account presentation state test passed');
