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

const needsCallsign = buildAccountPresentation({ state: 'signed-in', mode: 'secure', email: 'pilot@example.com', profileStatus: 'ready' });
assert.equal(needsCallsign.title, 'CHOOSE YOUR CALLSIGN');
assert.equal(needsCallsign.badge, 'SET CALLSIGN');
assert.equal(needsCallsign.identity, 'PLAYER ID REQUIRED');
assert.equal(needsCallsign.showCallsign, true, 'a permanent account without a profile receives one focused next step');
assert.equal(needsCallsign.showForm, false, 'login controls never remain visible behind the callsign step');

const profileOffline = buildAccountPresentation({ state: 'signed-in', mode: 'secure', email: 'pilot@example.com', profileStatus: 'error' });
assert.equal(profileOffline.badge, 'ID OFFLINE');
assert.equal(profileOffline.showCallsign, false, 'a profile outage is never mistaken for a missing callsign');

const signedIn = buildAccountPresentation({ state: 'signed-in', mode: 'secure', email: 'pilot@example.com', callsign: 'PILOT_ONE', profileStatus: 'ready' });
assert.equal(signedIn.badge, 'PILOT_ONE');
assert.equal(signedIn.identity, 'PILOT_ONE');
assert.match(signedIn.description, /PILOT@EXAMPLE\.COM · VAULT SYNCED/);
assert.equal(signedIn.showTabs, false);
assert.equal(signedIn.showForm, false);
assert.equal(signedIn.showRecovery, false, 'signed-in players never see verification or recovery controls');
assert.equal(signedIn.showCallsign, false);
assert.equal(signedIn.vaultStatus, 'CLOUD VAULT · SYNCED');

console.log('Account presentation state test passed');
