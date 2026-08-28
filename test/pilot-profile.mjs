import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BossNetwork } from '../src/boss-network.js';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');

assert.match(index, /id="pilotProfileOverlay"[\s\S]*id="pilotProfileShip"[\s\S]*id="pilotBestArcade"[\s\S]*id="pilotBossTotal"/, 'Pilot Card exposes the agreed identity and verified stat hierarchy');
assert.match(index, /id="profileVisibility"[\s\S]*PUBLIC PILOT PROFILE/, 'signed-in pilots can control public profile visibility from Settings');
assert.match(index, /id="openOwnProfile"[\s\S]*MY PILOT FILE/, 'a signed-in pilot can open their own file from the full-size Settings menu');
assert.match(index, /id="sharePilotProfile"[\s\S]*SHARE PILOT FILE[\s\S]*id="closePilotProfile"/, 'sharing and back navigation use equal arcade actions');
assert.match(main, /createPilotProfileLink[\s\S]*publicProfileId[\s\S]*openPilotProfile/, 'registered leaderboard identities open the public Pilot Card');
assert.match(main, /renderBossEvent[\s\S]*createPilotProfileLink\(entry, 'boss'\)/, 'registered boss pilots use the same profile interaction');
assert.match(main, /pilotProfileGeneration[\s\S]*generation !== pilotProfileGeneration/, 'stale profile requests cannot overwrite the current card');
assert.match(main, /playerAccount\.setProfileVisibility\(nextVisibility\)/, 'profile privacy control persists through the authenticated server endpoint');
assert.match(main, /pilotProfileTrigger\?\.isConnected[\s\S]*pilotProfileTriggerLabel/, 'focus returns even when a live boss ranking rerenders behind the Pilot Card');
assert.match(main, /publicProfileIdPattern[\s\S]*requestedPilotProfileId[\s\S]*openPilotProfile\(requestedPilotProfileId, null, 'direct'\)/, 'only validated public IDs can open a direct Pilot File route');
assert.match(main, /profilePreviewMode = localPreview[\s\S]*publicId: 'preview:you'/, 'own-profile browser QA remains strictly localhost-only');
assert.match(main, /pilotProfileUrl[\s\S]*url\.searchParams\.set\('pilot', publicId\)[\s\S]*navigator\.share[\s\S]*copyPilotProfileUrl/, 'mobile sharing and clipboard fallback use the same safe public link');
assert.match(styles, /\.pilot-profile-panel[\s\S]*\.pilot-profile-hero[\s\S]*\.pilot-profile-stats/, 'Pilot Card has a dedicated arcade layout');
assert.match(styles, /\.pilot-profile-actions[\s\S]*\.pilot-profile-actions \.system-action/, 'Pilot Card actions remain full-size arcade menu choices');
assert.match(styles, /\.pilot-profile-hero \{ grid-template-columns: 112px 1fr/, 'the Pilot Card collapses to a compact mobile-first hero');

const secureBossMigration = schema.slice(schema.lastIndexOf('-- Replace the legacy event ranking response'));
assert.doesNotMatch(secureBossMigration, /'playerId'/, 'the final boss ranking never serializes an auth user ID');
assert.match(secureBossMigration, /'publicProfileId'[\s\S]*'isCurrent'/, 'boss rows expose only public identity and own-row state');

const previewRanking = new BossNetwork({ preview: true }).previewRanking();
assert.ok(previewRanking.leaders.every(entry => String(entry.publicProfileId).startsWith('preview:')), 'local boss preview includes inspectable registered pilots');

console.log('Arcade Pilot Card interaction and privacy tests passed');
