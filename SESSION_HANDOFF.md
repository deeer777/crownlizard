# Crown Lizard — session handoff

Current production version: **44** (`VER 0.13.0`)
Latest completed local version: **46** (`VER 0.14.1`)
Test URL: `http://127.0.0.1:4174/?debug=1&touch=1&reload=45-security`

Build 45 deployed the server-wallet cutover. Build 46 fixes live anonymous-session bootstrap by accepting successful empty Supabase REST responses. Real ad verification and permanent identity linking remain before monetization or a player market. See `SECURITY.md`.

Server-wallet Pass 1 provides Supabase Auth anonymous sessions, `player_wallets`, `player_inventory`, `economy_transactions`, RLS/revoked client grants, authenticated wallet reads, refresh flow and a deadline-gated one-time legacy import. Required setup before deployment: run the updated `supabase/schema.sql`, enable Anonymous Sign-Ins, add `SUPABASE_PUBLISHABLE_KEY`, and set a short `ECONOMY_MIGRATION_DEADLINE` only for the cutover window.

Server settlement Pass 2: authenticated `/api/runs` requests bind the run to `user_id`; `/api/economy/settle` validates owner, server elapsed time and plausible run stats; `settle_run_reward` locks the run and atomically writes wallet balance, settlement timestamp and transaction. Replay returns the original result and another player receives 403.

Atomic crate Pass 3: `cosmetic_catalog` is server-owned; `/api/vault/open` accepts only an idempotency UUID and generates tier/cosmetic rolls with Worker Web Crypto; `open_crown_crate` locks the wallet and atomically handles ◆150 cost, current Sovereign pity, first-open-new behavior, inventory, duplicate salvage and transaction history. Reusing the UUID returns the stored outcome without another debit.

Frontend cutover Pass 4 is implemented: production bootstraps Auth and legacy import, refuses to start without an owned server run, settles shards with a retryable stored request, reads Vault state from Supabase, opens crates and equips ships through authenticated APIs, and never calls local wallet mutations. Localhost keeps local economy plus simulated ads for testing. Production ads are hidden until provider verification exists.

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
- Runs lasting 90 seconds or defeating a Warden bank one optional simulated rewarded-ad crate. At most one Sponsored Signal can wait at a time; it survives score submission, menus and reloads and is claimable later in Crown Vault. It is cosmetic-only, limited to three rewarded openings per UTC day, and cancellation consumes nothing.
- Crown Vault presents one shared crate station with clear `OPEN WITH SHARDS` and `WATCH AD · FREE OPEN` choices. The former CSS chest has been replaced by dedicated closed, signal-charged and open Crown Crate pixel sprites.
- Crate opening now has a short arcade cinematic: seal charge and shake, a large golden open burst, then the opened chest recedes before the rarity reveal. Reduced Effects uses a shortened version.
- Cinematic rays, particles and the screen burst inherit the rolled rarity color. A persisted `OPENING ANIMATION` switch in Vault can skip the cinematic entirely for rapid openings.
- Pass 2 Crown Vault: 150-shard Crown Crates, eight ship cosmetics across five visible rarity tiers, first-opening new-item guarantee and a Sovereign guarantee on opening 200.
- Duplicate cosmetics are held as a durable pending reward and salvaged for their displayed shard value, including safely after a page reload.
- The inventory records cosmetic ID, acquisition time and source so the same collection can later move to Supabase and support a direct-purchase market.
- The Vault collection uses a scalable two-column mobile/four-column desktop grid, category scaffolding for ships/trails/dash effects/weapon skins, and a focused cosmetic detail view ready for Pass 3 equip actions.
- Pass 3 includes eight distinct transparent pixel-art ship sprites plus the original Crown Lizard, a persistent equip system, active-skin markers, locked/owned detail states and actual in-run rendering of the selected chassis.
- Generated ship sources were mechanically reduced with nearest-neighbor scaling for mobile delivery; the eight production assets total under 800 KB instead of roughly 11 MB raw.

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

1. Let the user playtest Build 45 locally, especially the optional ad placement, cancellation and post-ad crate reveal on mobile.
2. Tune the daily cap or qualification threshold only if the experience calls for it.
3. Replace the simulated adapter with a production rewarded-ad provider only after UX approval.
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
- `src/cosmetics.js` — cosmetic catalog, tier odds, crate price and Sovereign guarantee.
