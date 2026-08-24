# Crown Lizard — session handoff

Current production version: **41** (`VER 0.10.3`)
Latest completed local version: **42** (`VER 0.11.0`)
Test URL: `http://127.0.0.1:4174/?debug=1&touch=1&reload=42`

## Product direction

- Mobile-first endless arcade survival game, also fully playable on desktop.
- English player-facing UI.
- Genuine pixel-art presentation with no modern rounded web panels.
- The menu is inspired by classic arcade title screens, but retains Crown Lizard's own identity.
- Local fonts: Press Start 2P for display text and Silkscreen for readable UI text.
- Pixel sprites should remain crisp with `image-rendering: pixelated` where appropriate.

## Implemented systems

- Endless zones with escalating difficulty and Warden bosses.
- Four zone-specific Wardens with dedicated sprites, wrecks, presentation names and attacks: Verdant/Toxic Bloom, Ember/meteor barrage, Crystal/prism lanes and Crown/Crown Beams.
- Gradual enemy introductions: Rippers before Hex Moths in zone one, Iron Scarabs and Crown Weaver in zone two, and Void Skimmer in zone three. Later cycles remix all types.
- Crown Weaver protects up to two nearby allies through visible energy links; Void Skimmer announces its side entry before crossing the arena with diagonal volleys.
- Formation director for Ripper-V waves, Weaver escorts and crossed Skimmer attacks.
- Five weapons with five upgrade levels: Blaster, Spread, Pulse, Laser and Tesla.
- Tesla attaches, chains and branches between nearby enemies.
- Enlarged weapon-crate sprites with dynamic weapon information.
- Crown Power selection after Wardens, including cursed powers and a mobile swipe carousel.
- Dash, multiple lives, combo, difficulty modes and persistent local best scores.
- Pause with Escape or the in-game pause button, plus automatic pause on visibility loss or window blur.
- First-run tutorial; force it with `?tutorial=1` or reset it in Settings.
- Settings for music, 8-bit sound effects, vibration and reduced effects.
- Run Summary with zone, Wardens, crates, best combo, final weapon, Crown Powers and defeated enemies.
- Filtered arcade event feed: only new threats, elite waves, collected weapon upgrades and rare critical errors interrupt play; debug feedback stays in a quiet corner.
- Pixel-arcade logo with crown, stepped shading, battle damage, lizard-tail signature and reduced-motion support.
- Player-visible semantic version and build number on the title screen.
- Pass 1 shard economy: qualified-run rules, performance-based payout, local wallet/ledger, one-time settlement and a full Run Over breakdown.
- Immediate deaths, idle runs, `END RUN`, reloads and repeated game-over callbacks cannot farm shards.
- Runs lasting 90 seconds or defeating a Warden already record eligibility for the future sponsored crate, without exposing an ad flow yet.

## Menu and UI decisions

- `START GAME` and `SETTINGS` are equal-sized stacked retro menu choices.
- `TRY AGAIN` and `BACK TO MENU` are equal-sized stacked retro choices with Arrow/WASD navigation and Enter/Space confirmation.
- Main-menu navigation supports Arrow Up/Down or W/S, with Enter/Space to confirm; touch remains supported.
- Settings has a mobile touch target of at least 44 px while retaining small visual text.
- Selected difficulty is indicated only by gold text, with no arrows or modern button box.
- Game Over, pause, tutorial and settings use text-driven arcade layouts without modern cards.

## Debug shortcuts

- `P`: open Crown Power choices.
- `O`: end the current run and show Run Summary.
- `B`: spawn the Warden.
- `1`–`5`: switch to Blaster, Spread, Pulse, Laser or Tesla.
- `Z`: advance to the next zone.
- `G`: create a poison pool.
- `K`: spawn and destroy a test enemy/wreck.
- `V`: spawn a Crown Weaver introduction encounter.
- `X`: spawn a Void Skimmer crossing.

## Verification

- Primary smoke test: `node test/smoke.mjs`
- Run `node --check` on changed JavaScript source files.
- The latest flows were visually checked on mobile and desktop: menu, tutorial, HUD, pause, settings, Crown Power cards, Game Over and Run Summary.

## Likely next priorities

1. Build Pass 2: Crown Vault, one Crown Crate, rarity odds, first-crate guarantee and duplicate salvage.
2. Build Pass 3: eight ship skins, preview/equip flow and the Sovereign cosmetic.
3. Add the simulated rewarded-ad adapter only after crate balance is proven.
4. Move wallet, inventory and purchases to Supabase before any real-money market launches.
5. Do final real-device QA on iOS Safari and Android Chrome.

## Important files

- `index.html` — menu and overlays.
- `styles.css` — visual system and responsive layouts.
- `src/main.js` — UI flow, pause, tutorial, settings and Run Summary.
- `src/game.js` — gameplay, progression, weapons, bosses, pickups and statistics.
- `src/audio.js` — music and synthesized 8-bit sound effects.
- `src/config.js` — balancing, stages, weapons and Crown Powers.
- `src/economy.js` — shard qualification, reward calculation and local wallet ledger.
