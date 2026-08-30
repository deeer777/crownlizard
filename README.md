# Crown Lizard: Dash — engine rebuild

Detta är en separat, moderniserad spelbar version. Originalet finns orört i `../legacy-import`.

## Spelkänsla i version 2

- Fast simulering på 60 Hz: samma svårighetsgrad oavsett skärmens uppdateringsfrekvens.
- Accelerationsbaserad rörelse med tydlig maxhastighet och konsekvent friktion.
- Dash på Space/Shift eller mobilknappen, med kort osårbarhet och kollisionsskada.
- Tre liv, träff-osårbarhet, knockback, screen shake och tydligare partikeleffekter.
- Kombokedja som belönar aggressivt spel. Dash-kills ger 50 % extra poäng.
- Fem automatiska vapen som roterar via pickups; Laser penetrerar led och Tesla fäster kortvariga blixtar som förgrenar sig till närliggande mål.
- Ny visuell identitet: krönt ödleskepp, Rippers, Hex Moths och Iron Scarabs.
- Vapnen syns på skeppet och har egna projektilformer, färger och effekter.
- Blaster, Spread, Pulse, Laser och Tesla har egna transparenta pixelart-mounts på skeppet och egna kortlivade träffsprites. Assets laddas först när vapnet används.
- Mobile-first flytande joystick med analog styrka, separat dashknapp och haptisk respons.
- Samma balanserade spelbredd på mobil och en centrerad arena på stora desktopskärmar.
- Fem riktiga transparenta pixelart-sprites ersätter de tidigare canvas-siluetterna.
- Högupplöst DPR-canvas håller spelplanen skarp medan sprites ritas utan bildutjämning.
- Fyra tvåminuterszoner med egna paletter, introduktionsfas, pressfas, fiendeblandningar och parallaxmiljöer.
- Varje zon har två egna transparenta miljösprites: ett större mark-/energispår och ett tydligare relikobjekt. De rör sig i parallella top-down-lager och endast aktuell zons bilder laddas in.
- En zonunik Warden-boss avslutar varje zon; Verdant, Ember, Crystal och Crown Warden har egna sprites, wrecks, fasnamn och signaturattacker. Zonscykeln fortsätter oändligt med stigande styrka.
- Fiender introduceras gradvis: Rippers och Hex Moths i första zonen, Iron Scarabs och Crown Weaver i den andra samt flankande Void Skimmers i den tredje.
- Crown Weaver skyddar upp till två närliggande fiender med synliga energilänkar. Void Skimmer förvarnar från skärmkanten innan den korsar arenan och skjuter diagonala salvor.
- Formationer kombinerar redan introducerade fiender i bland annat Ripper-V, Weaver-eskort och korsande Skimmers.
- Chill, Arcade och Crowned har olika tryck, antal liv och poängmultiplikatorer.
- Lokala rekord sparas separat per svårighetsgrad inför den globala highscore-integrationen.
- Varje vapenlåda visar vapnets egen färg och symbol innan den plockas upp.
- Vapennamnet visas när spelaren närmar sig och aktivt vapen ligger permanent i HUD:en.
- En stängd och en öppen pixelart-lådsprite bildar en kort pickup-animation där vapenikonen lyfter ur lådan.
- Varje vapen har fem permanenta nivåer inom rundan; lådan visar målnivå och uppgraderingsnamn före pickup.
- Blaster utvecklar tvillingskott, penetration och rikoschett; Spread får fler vinklar och bakåtskott; Pulse får explosioner; Laser blir en trippel prismalans och Tesla får fem kedjehopp.
- En besegrad Warden pausar rundan och visar tre mobile-first perk-kort; valet kan staplas och gäller resten av rundan.
- Perks påverkar dash, liv, pickup-magnet, eldhastighet, skada, rörelse, kombo eller poäng.
- Varje Warden-val innehåller ett förbannat risk–belöningskort: Glass Crown, Cursed Overdrive eller Royal Debt.
- Zonerna har egna spelregler: varnade giftfält med gradvis exponering, varnade meteorer, varnade laserlinjer och elitvågor.
- Giftpölar har egna pixelart-sprites, 0,65 sekunders förvarning och en exponeringsmätare. Ett liv förloras först efter 1,35 sekunders sammanhängande kontakt; mätaren sjunker när spelaren lämnar pölen och samma kontakt kan aldrig ta mer än ett liv.
- Elitfiender kan vara snabba, bepansrade, delande eller explosiva och markeras med en tydlig aura.
- Fiender har typunika idle- och träffreaktioner med recoil, squash och ljusflash. Varje grundfiende samt Warden har en egen transparent wreck-sprite och kort dödssekvens som laddas först när den behövs.
- All grafik använder CSS-pixlar oavsett device pixel ratio.
- En enda motorloop uppdaterar fysik, partiklar och rendering.

## Lokal körning

Servera mappen med valfri statisk webbserver och öppna `index.html` via HTTP.

Vid lokal provspelning byter tangenterna 1–5 direkt mellan Blaster, Spread, Pulse, Laser och Tesla. `M` maxar det aktiva vapnet för balansprov. `P` startar vid behov spelet och öppnar ett perk- eller mastery-val, `Z` hoppar till nästa zon, `L` hoppar till en sen världscykel och visar nästa late-game-formation, `G` skapar en giftpöl, `V` skapar ett Crown Weaver-möte, `X` skapar en Void Skimmer, `K` visar nästa wreck-animation och `B` startar vid behov spelet och ett Warden-möte direkt. Lägg till `?debug=1` i adressen för att aktivera provläget även på andra värdnamn.

Warden möter spelaren med en egen entré och tre läsbara stridsfaser. Varje fas kombinerar förvarnade salvor, säkra luckor i projektilringarna och – i de senare faserna – markerade Crown Beams. HUD:ens zonmätare växlar till bossens hälsa under striden.

Kronkrafterna använder elva egna transparenta pixelart-emblem. Vapenlådorna visar den faktiska vapenspriten för Blaster, Spread, Pulse, Laser eller Tesla i stället för en ritad teckensymbol.

## Global highscore

Version 0.10 har en mobile-first global topplista med separata tabeller för Chill, Arcade och Crowned. Spelaren skickar tre arkadinitialer efter rundan. Klienten får ett engångs-ID när rundan startar och Cloudflare Pages Function validerar tid, zon, run-statistik, versionsnummer och en generös poänggräns innan något sparas.

Databasen skapas genom att köra `supabase/schema.sql` i Supabase SQL Editor. Lägg därefter följande i Cloudflare Pages under **Settings → Variables and Secrets** för både Production och Preview:

- `SUPABASE_URL` som vanlig variabel.
- `SUPABASE_SECRET_KEY` som krypterad hemlighet. Använd Supabases nya server-side `sb_secret_...`-nyckel, aldrig en nyckel i frontendkoden.
- `SCORE_HASH_SALT` som en lång, slumpmässig krypterad hemlighet.

Pages Functions exponeras endast under `/api/*` via `_routes.json`; statiska spelresurser fortsätter att serveras utan Function-anrop. Om API:t eller databasen är otillgänglig fungerar spelet och de lokala rekorden fortfarande.

## Shard economy MVP

Version 0.11 introducerar grunden för Crown Vault och den framtida cosmetic-marknaden. En reward-run kräver minst 30 sekunders överlevnad och fem besegrade fiender. Shards beräknas separat från highscore utifrån överlevnad, fiender, nådda zoner och besegrade Wardens.

Utbetalningen sker endast vid verklig Game Over. `END RUN`, omladdning och övergivna rundor betalar ingenting, och varje lokalt run-ID kan bara lösas in en gång. Wallet och en begränsad transaktionshistorik sparas under `cl:economy:v1`.

Efter minst 90 sekunder eller en besegrad Warden sparas ett frivilligt erbjudande om en kosmetisk crate. Build 45 använder en simulerad rewarded-adapter för att prova UX och balans innan en riktig annonsleverantör ansluts. Högst en Sponsored Signal kan ligga väntande; den överlever score-submit, huvudmeny och omladdning och kan öppnas senare från Crown Vault. Erbjudandet kan användas en gång och högst tre rewarded crates får öppnas per UTC-dygn. Avbruten visning ger ingen belöning och förbrukar inte erbjudandet. Craten påverkar aldrig score, ranking eller run-prestanda.

Crown Vault använder en gemensam crate-station för både shard- och annonsöppningar, så spelaren ser att odds och innehåll är identiska. Crown Crate har separata pixelart-sprites för closed, saved-signal och open state.
Öppningssekvensens strålar, partiklar och screen burst färgas efter den rullade rariteten. En beständig `OPENING ANIMATION`-switch i Vault låter spelaren hoppa direkt till belöningen vid många öppningar.

### Säkerhetsmodell för Vault

Build 45 använder kryptografisk slump för vanliga crateöppningar och testkommandon kan endast aktiveras på `localhost`; en publik `?debug=1` ger inga genvägar. Highscore skickas via en engångs-run från Cloudflare-funktionen och valideras separat från kosmetiken.

Shards, inventory och cratehistorik är fortfarande lokal progression i denna MVP. En spelare med utvecklarverktyg kan därför ändra sin egen Vault-data. Detta ger ingen gameplay- eller rankingfördel, men innan cosmetics får bytesvärde, konton eller riktiga annonsbelöningar måste ekonomi, annonsverifiering och crate-RNG flyttas till en serverauktoritativ tjänst.

### Server wallet – pågående Build 45-migrering

Supabase-schemat innehåller nu `player_wallets`, `player_inventory` och en append-only grund för `economy_transactions`. Alla tabeller har RLS, saknar publik skrivpolicy och nås endast via Cloudflare-funktionen. En spelare skapas först som ett riktigt anonymt Supabase Auth-konto och kan senare länka e-post eller OAuth utan att dess `user_id` och inventory byts.

Aktivera **Anonymous Sign-Ins** i Supabase Auth och lägg `SUPABASE_PUBLISHABLE_KEY` som vanlig Cloudflare-variabel. En tidsbegränsad import av befintlig lokal Vault kan öppnas med `ECONOMY_MIGRATION_DEADLINE`; utan ett giltigt framtida ISO-datum är importen stängd. Importen kan bara göras en gång till en tom serverwallet, godkänner endast spelets riktiga cosmetic-ID:n och accepterar högst 50 000 legacy-shards.

Frontendens kontoklient i `src/player-account.js` är nu den aktiva walletvägen utanför localhost. Vid första anslutningen importeras den gamla lokala Vaulten en gång om serverwalleten är tom. Därefter kommer saldo, inventory, pity och equipped ship endast från Supabase. Localhost behåller `ShardWallet` för isolerad provspelning.

### Permanent player login

Build 60 adds the production account callback used by `PLAYER ACCOUNT` in Settings. An anonymous player can link an email to the existing Supabase Auth user, verify it and then create a password. Because the Auth user ID is preserved, shards, inventory, pity and equipped cosmetics stay on the same server wallet. `SIGN IN` restores an existing account and its Vault on another device; temporary guest progress is intentionally not merged into an existing account.

The Change email address and Reset password templates must use the server callback so email clients and link tracking cannot lose the verification fragment:

`{{ .SiteURL }}api/player/account/callback?token_hash={{ .TokenHash }}&amp;type=email_change`

`{{ .SiteURL }}api/player/account/callback?token_hash={{ .TokenHash }}&amp;type=recovery`

The callback first renders a branded, non-consuming confirmation page. Only the player's explicit POST consumes the token. Build 63 renders Create Password directly on that same server response instead of redirecting through the game client. A narrowly scoped, ten-minute `HttpOnly`, `Secure`, `SameSite=Strict` cookie authorizes the password form once and is cleared after success. Build 64 then creates a fresh password session, replaces the stale guest session in first-party browser storage under a nonce-protected, no-store completion page and returns the player to the game already signed in. Build 65 added a server-rendered sign-in fallback. Build 66 guarantees a valid expiry timestamp at both sides of the account boundary, repairs older stored sessions that lack it and never silently replaces an expired permanent account with a guest. Build 67 moves ordinary sign-in back into the in-game account screen using the now-normalized JSON contract, removes abrupt success redirects, derives every account label from one tested state model and never treats a query parameter as proof of authentication. Password completion and ordinary sign-in have distinct, accurate copy. No session credentials are placed in a URL.

All secondary overlay navigation now uses the same full-size Press Start arcade typography and touch target as primary system actions. Smaller text remains reserved for tabs, field labels and explanatory copy—not menu choices such as `BACK TO SETTINGS`, `SETTINGS`, `END RUN`, `FORGOT PASSWORD?` or `SHOW TUTORIAL AGAIN`.

Before enabling Build 55 in production, configure Supabase Auth:

- Enable manual identity linking under Authentication settings.
- Set the Site URL to `https://crownlizard.com/` and allow the same exact production redirect URL.
- Keep email confirmation enabled. Password creation is rejected until the email identity is verified.

Passwords are never written to the game database or logs. The Cloudflare account endpoints validate size and format, forward credentials only to Supabase Auth and return a generic error for failed sign-in attempts.

### Player callsigns — Pass 1

Build 70 adds the server-authoritative foundation for persistent player names. A signed-in permanent account may claim one free, unique callsign of 3–10 characters. Callsigns are normalized to uppercase, may contain `A–Z`, `0–9` and `_`, must contain at least one letter and are checked against reserved and moderated terms. Guests cannot reserve names.

The browser can only request a name. Cloudflare derives the player from the verified bearer session and Supabase performs the unique claim atomically. `player_profiles` and the moderation list have RLS enabled and no direct browser access. The API exposes `GET /api/player/profile` and `POST /api/player/profile/callsign`; the callsign picker and leaderboard presentation are intentionally the next UI pass.

The schema also prepares future renames without using real money: `PUT /api/player/profile/callsign` calls one atomic database operation that charges exactly 500 server-owned shards, enforces a seven-day cooldown and writes an idempotent economy transaction. The client cannot choose the price, bypass the cooldown or debit another player.

Build 71 completes Pass 2 with the in-game callsign UX. After password setup or sign-in, a permanent account without a profile is taken directly to one focused `CHOOSE YOUR CALLSIGN` step. The arcade ID is previewed live, the authenticated API performs the claim, and the chosen callsign replaces generic `SIGNED IN` copy in both Settings and the account summary. Login and verification controls are never shown alongside the callsign form. A profile service error is shown as offline and never misrepresented as a missing name.

Build 72 connects permanent player identity to global scores. A run started with an authenticated account is submitted without an initials field. Cloudflare verifies that the bearer owns the run and resolves the callsign directly from `player_profiles`; a browser-supplied name or initials value is ignored. The score stores both `user_id` and a validated callsign snapshot, while leaderboard reads prefer the account's current callsign so a future legitimate rename can update older entries. Unauthenticated guest runs keep the three-initial arcade fallback.

Build 73 adds short arcade closing beats without changing run results. A lethal hit now freezes on impact, breaks the equipped ship into crisp sprite fragments, continues visual effects in slow motion and presents `RUN OVER` before the result interface. Defeating a Warden similarly holds on its wreck and announces `CROWN POWER ACQUIRED` before perk cards appear. Both sequences can be skipped after their opening impact and respect reduced-effects mode.

Build 74 refocuses the title screen around the logo and one navigable arcade menu. Player identity, high score and shard balance share one compact status line; difficulty is now a full-size `GAME MODE` choice instead of three small cards. Redundant enemy decoration, control hints and difficulty copy are removed. The supplied `menu-theme.mp3` loops throughout menu overlays and crossfades into the existing gameplay playlist when a run starts.

Build 75 turns Crown Lizard into an installable PWA with a dedicated pixel-art icon family, standalone launch metadata, Apple Home Screen support and an install action inside Settings. The versioned service worker caches only the app shell and static same-origin assets. Navigation remains network-first; `/api/`, non-GET requests, media and range requests are never intercepted, so login, wallet, crates, scores and ads cannot be replayed from an offline cache. Offline production sessions may inspect the cached menu but cannot start ranked runs.

Future builds install in a waiting state and present `NEW BUILD READY` only outside active gameplay. The player explicitly activates the update, preventing a service-worker takeover or reload in the middle of a run. Cloudflare serves the worker and manifest with revalidation headers so stale app infrastructure is not pinned at the edge.

Build 76 begins the weapon mastery balance pass. New weapons still arrive during the opening minute, while repeat upgrades now use a slower 27–35 second cadence and the first crate waits eight seconds so the opening combat can breathe. Laser MK4–MK5 no longer multiplies beam count, damage, speed and penetration at once: its direct MK1–MK5 DPS curve is capped near 2.7×, with two beams and three pierce at maximum rank. Weapon-specific fire-rate floors contain extreme perk stacks, Overclock and Heavy Crown have smaller stacking gains, and Cursed Overdrive now carries substantially higher enemy pressure. Normal enemy health gains an additional step each complete four-zone cycle so Rippers remain fragile while Moths and Scarabs retain distinct time-to-kill profiles deep into an endless run.

Build 77 completes weapon mastery. Every MK5 weapon queues one of two mutually exclusive final forms for the next Warden reward, creating ten specialized end builds across crowd control, focused damage, defence and boss pressure. The selected form replaces that Warden's normal Crown Power, appears in the live weapon HUD and is preserved in the run summary.

Build 78 completes the late-game balance pass. The opening four zones keep their learning curve; later world cycles unlock Armored Advance, Crossfire and Royal Escort formations, raise special-enemy and elite pressure within strict limits, and scale Warden health separately from normal enemies. A capped encounter director prevents endless runs from degrading into raw enemy spam or mobile slowdown. Royal Barrage is also brought inside the mastery direct-damage budget, and the tall Laser sprite receives its own card dimensions so it no longer crosses the mastery title.

Build 88 introduces public Arcade Pilot Cards. Registered names in High Scores and Global Warden rankings open a mobile-first profile containing the equipped ship, Arsenal Rank and server-verified run and boss statistics. Public profiles use a random identifier separate from `auth.users.id`; guests remain plain initials, and hidden or missing profiles return the same response. Signed-in players control visibility from the full-size Settings menu.

Build 89 completes the Pilot Files MVP. A signed-in player can open `MY PILOT FILE` from Settings and share a clean `?pilot=<public-id>` link. A valid shared link opens directly into the same card and returns cleanly to the title menu; invalid identifiers are ignored client-side and still rejected server-side. Mobile share sheets are used when available, with a clipboard fallback on desktop. No account session, email address or internal user ID is placed in the URL.

Build 90 establishes the public search and publisher-readiness layer without crowding the arcade title screen. The game now publishes canonical, Open Graph, Twitter and `VideoGame` + `WebApplication` structured metadata alongside a sitemap and API-safe robots policy. Original mobile-first About, How to Play, Updates, Privacy and Terms pages form a crawlable information graph, while Settings exposes one full-size `GAME GUIDE & INFO` route. Informational navigation remains network-first and receives a page-specific offline fallback instead of incorrectly returning the game shell.

Build 95 closes the Crown Market MVP loop. Listings expire server-side after seven days and unsold cosmetics return automatically from escrow. Seller payouts remain immediate and atomic; a persistent Market Signal merely confirms completed sales and can be acknowledged without claiming value twice. A private Activity view records recent purchases, sales, cancellations and expirations using public callsigns only—internal account identifiers are never included in the browser contract.

Build 96 gives Global Warden a fixed, server-owned weekly rhythm. Each event opens Friday at 18:00 UTC and closes Sunday at 18:00 UTC; defeating the boss early ends that event but never advances the next start. The title menu now exposes `LIVE`, `CLAIM`/`RESULTS`, `NEXT` or `OFFLINE` with a countdown, while Crown Armory shows the next start in the player's local time. The Cloudflare API invokes one locked, idempotent Supabase scheduler before event reads and assault starts, so clients cannot create events or manipulate the clock.

Build 97 corrects the Global Warden title choice on narrow phones. The event name and status now form one centered, non-wrapping arcade row with the countdown on a deliberate second line. The mobile control remains one full-width touch target and no longer distorts the alignment of the surrounding title-menu choices.

Build 98 completes persistent acquisition signals in Collection. Cosmetics bought through Crown Market or Crown Store retain a server-backed `NEW` label across sessions, their Ship or Weapon category reports the number waiting to be inspected, and the signal clears only when that cosmetic's detail view is opened. A new shell cache identity ensures installed PWAs receive the feature rather than retaining Build 97 JavaScript.

Server-side shard settlement är också förberedd. En Auth-verifierad run binds till spelarens `user_id` när den startar. Vid Game Over räknar Cloudflare om belöningen, jämför rapporterad tid med serverns starttid och avvisar orimliga zon-, Warden- och fiendevärden. Databasfunktionen `settle_run_reward` låser run-raden och uppdaterar run, wallet och transaktionslogg atomiskt. Kombinationen av row lock, `economy_settled_at` och ett unikt `(user_id, external_id)` gör replay idempotent.

Atomic server crates används via `/api/vault/open` på live. Klienten skickar endast ett beständigt UUID som idempotency key. Cloudflare skapar två unbiased Web Crypto-rolls; `open_crown_crate` låser wallet och bestämmer kostnad, aktuell pity, tier, katalogskin, duplicate salvage, inventory, nytt saldo och transaktion i samma databasoperation. Klientfält som påstår tier eller saldo ignoreras. Samma UUID returnerar den lagrade öppningen utan ny debitering. Duplicate salvage krediteras atomiskt direkt men presenteras fortfarande i revealen.

Serverägda runs startas innan gameplay börjar. Game Over settlement sparas lokalt som enbart ett väntande request-underlag tills servern bekräftat det, så en omladdning efter nätverksfel kan återuppta samma idempotenta utbetalning. Equip verifierar ägarskap i databasen. Simulerade rewarded ads är avstängda utanför localhost tills en riktig annonsleverantör kan verifieras server-side.

## Crown Vault MVP

Version 0.12 lägger till Crown Vault med en Crown Crate för 150 shards. Craten innehåller åtta kosmetiska skeppschassin i fem tydligt redovisade tiers: Uncommon, Rare, Royal, Mythic och Sovereign. Den första öppningen garanterar ett nytt föremål, och efter 199 öppningar utan Sovereign blir öppning 200 garanterad Sovereign.

Duplicates omvandlas direkt till den shard-mängd som visas i revealen. En väntande duplicate sparas lokalt innan den visas och återställs efter omladdning, så belöningen kan inte förloras genom att sidan stängs. Inventory-poster sparar kosmetiskt ID, tidpunkt och källa som grund för en framtida Supabase-baserad marknad. Build 43 använder tillfälliga färgvarianter av spelarskeppet; riktiga skins och equip-system hör till nästa pass.

Samlingen visas i en skalbar grid med två kolumner på mobil och fyra på desktop. Kategorigrunden för skepp, trails, dash-effekter och vapenskins finns redan, och varje cosmetic har en egen detaljvy som Pass 3 kan komplettera med preview och equip utan en ny layoutombyggnad.

## Ship cosmetics och equip

Version 0.13 ersätter de tillfälliga färgfiltren med åtta individuella transparenta pixelart-skepp: Verdant Scout, Ember Runner, Crystal Dart, Void Hunter, Solar Guard, Royal Vanguard, Rift Phantom och Crown Sovereign. Originalskeppet Crown Lizard finns alltid tillgängligt som Standard.

Ägda skins kan utrustas från detaljvyn. Det aktiva valet markeras i samlingen, sparas i samma lokala inventory och laddas av spelmotorn vid nästa run. Låsta skins kan inte utrustas. Alla nio skepp använder separata optimerade spritefiler och behåller samma gameplay-hitbox; skins är helt kosmetiska och påverkar därför inte highscore-balansen.
