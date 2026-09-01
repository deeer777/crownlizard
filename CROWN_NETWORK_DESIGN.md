# Crown Network — låsta designregler

Detta dokument är källan för kommande implementation av **Crown Duel (PvP)** och **Global Serverboss**. Reglerna ska följas om inte ett senare uttryckligt produktbeslut ändrar dem.

## Gemensam grund: Crown Profile

PvP, serverboss, Store och framtida Market ska återanvända samma publika spelarprofil.

Profilen får visa:

- callsign;
- utrustat skepp, trail och dash-effekt;
- Crown Rank och framtida Arsenal Rank;
- vald titel eller badge;
- Duel-statistik;
- personligt serverboss-bidrag;
- föremål som spelaren uttryckligen valt att visa upp.

Profilen får aldrig exponera e-postadress, autentiseringsuppgifter eller andra privata kontodata. Kosmetik ska vara socialt synlig men får aldrig ge gameplay-fördelar.

## Crown Duel — PvP MVP

### Lobby och presentation

- PvP ska ha en visuell tvåspelar-lobby, inte bara en tabell eller matchmaking-dialog.
- Varje plats visar callsign, utrustat skeppsskin, Crown Rank, vald titel/badge och Ready-status.
- En ensam spelare ser sitt eget animerade skepp och en tydlig `WAITING FOR CHALLENGER`-plats.
- `QUICK MATCH` placerar spelaren i en publik kö.
- `CREATE CHALLENGE` skapar en privat lobby och en delbar länk/kod.
- Den som öppnar länken ser motståndarens profil och skepp innan `JOIN CHALLENGE`.
- När två spelare är Ready visas en gemensam arcade-countdown.
- Resultatvyn visar båda skeppen sida vid sida och presenterar vinnaren tydligt.

### Matchmodell

- MVP:n är ett synkroniserat 1v1-scorelopp, inte två skepp med kollisionsbaserad realtidsstrid i samma arena.
- Båda spelarna kör lokalt men får samma serverutfärdade seed, crateordning, fiender, formationer, startvillkor och svårighetsgrad.
- Ett Durable Object per match äger lobby-state och senare begränsad realtidsstatus: score, liv, zone, Warden-status och anslutning. Supabase används som säker katalog för öppna utmaningar och beständig matchhistorik.
- Duel-HUD ska vara diskret och visa scoreavstånd utan att skymma spelet.
- Frånkoppling får en kort återanslutningsperiod. Timeout och eventuell async-fallback bestäms före ranked release.

### Rättvisa och progression

- Ranked Crown Duel ska vara gameplay-normaliserat.
- Permanenta damage-, health- eller fire-rate-bonusar får inte användas i ranked PvP.
- Skins, trails, titlar och badges visas men är alltid kosmetiska.
- Servern äger seed, starttid, godkänd loadout och slutresultat; klienten får aldrig själv utse vinnaren.
- Slump som påverkar matchen ska flyttas från `Math.random()` till en reproducerbar seedad generator.
- PvP-resultat hålls separat från den vanliga globala highscorelistan.
- Första MVP:n får inte innehålla shard-wager, betting eller direkt värdeöverföring mellan spelare.
- En begränsad daglig segerbonus är tillåten men får inte kunna farmas obegränsat mellan två konton.
- En framtida o-rankad `Open Challenge` kan ha friare regler men får inte påverka Ranked Duel.

### Säkerhet

- Lobby-ID och invite-token skapas server-side och ska vara svåra att gissa.
- Matchen startar först när servern låst båda deltagarna, seed och villkor.
- Score och run-data verifieras mot serverägd match och rimliga gränser.
- Ranked release kräver starkare run-verifiering än dagens highscoreflöde, helst deterministisk input/event-digest eller replayvalidering.

### Implementeringspass

1. **Serverägd lobbygrund:** separat Cloudflare Worker med ett SQLite-backed Durable Object per duell, Supabase-katalog för öppna utmaningar, kryptografiska åttateckenskoder, invite-länkar, en atomisk gästplats och tio minuters timeout. Endast permanenta konton med callsign får skapa eller ansluta. Ingen reward, rating eller gameplay kopplas in.
2. **Visuell lobby:** mobile-first tvåspelarvy med Pilot Cards, utrustade skins, host/guest-status, Ready, reconnect och tydlig invite/copy/share-UX.
3. **Speglad duell:** 90 sekunders scorelopp med serverutfärdad seed, identiska vågor och tre normaliserade tillfälliga blueprint-val samt ett diskret realtids-HUD.
4. **Verifierat resultat:** serverägd vinnare, replay-/telemetrykontroll, rematch, historik och lanseringspolish. Shards, rating och daglig bonus förblir avstängda tills missbruksgränserna är verifierade.

Status Build 101: Pass 1–3 är implementerade lokalt. Båda Ready-signalerna och presence/reconnect ägs av Durable Object. Servern erbjuder tre normaliserade tillfälliga blueprints, låser loadouts och utfärdar kryptografisk seed samt gemensam start- och sluttid. Klienterna spelar samma deterministiska 90-sekunders vågplan och skickar endast begränsade, monotona preliminära poängsignaler. Matchen kan inte förlängas genom paus eller bakgrundsläge. Pass 4 ska göra vinnare och resultat auktoritativa genom replay-/telemetryverifiering; rating och rewards är fortsatt avstängda.

## Global Serverboss — MVP

### Eventmodell

- Serverbossen är ett tidsbegränsat globalt samarbets-event, exempelvis 48 timmar.
- Bossens globala HP och återstående tid visas på startsidan och eventskärmen.
- Ett försök är en separat verifierad `Boss Assault` med serverutfärdat event-ID, run-ID, seed och godkänd loadout.
- Striden körs lokalt. Varje skott ska inte skickas till servern.
- Godkänt bidrag registreras efter avslutat försök och dras atomiskt från global boss-HP.
- Supabase Realtime kan visa periodiska globala HP-uppdateringar men databasen är sanningskällan.
- Om bossen besegras medan en spelare är i ett redan startat giltigt försök ska bidraget kunna räknas enligt den fastställda eventregeln.

### Crown Armory och vapen

- Serverbossen använder en permanent, serverägd `CROWN ARMORY`.
- När en inloggad spelare når MK5 och väljer en mastery under en verifierad singleplayer-run kan mastery-varianten låsas upp som permanent blueprint.
- Inför Boss Assault väljer spelaren bland sina upplåsta blueprints.
- Nya spelare har alltid minst ett standardvapen och ett roterande trial-vapen så eventet aldrig låses bakom lång progression.
- Mer singleplayer-erfarenhet ger fler taktiska val, inte obegränsad rå styrka.
- Bossen måste ha faser där single-target-, crowd-control-, defence-, piercing- och chain-builds har relevanta roller.
- En enda hög-DPS-mastery får inte vara det självklara valet i alla faser.

### Veteranbonus utan pay-to-win

- Veteraner får vara måttligt starkare i serverbossen eftersom läget är kooperativt.
- Framtida `ARSENAL RANK` tjänas endast genom verifierat spel och achievements.
- Permanent boss-damagebonus bör ligga omkring +2 % per rank med ett hårt tak omkring +20–25 %.
- Arsenal Rank får inte köpas för shards, annonser eller riktiga pengar.
- Fler blueprints, skicklighet och fler genomförda försök är den primära veteranfördelen.
- Många försök ska ha mjukt avtagande effektivitet. Preliminär modell: försök 1–3 på 100 %, 4–6 på 75 % och senare försök på 50 %.
- Exakta nivåer balanseras med riktig eventdata utan att grundprincipen tas bort.

### Bossdesign och belöningar

- Serverbossen får inte vara en ensam HP-svamp.
- Den kombinerar damage-faser, adds, sköldgeneratorer eller bossdelar, projektiltryck och överlevnadsfaser.
- Global segerbelöning ges till verifierade deltagare som nått ett tydligt minsta personligt bidrag.
- Personliga milestones får ge mindre kosmetiska belöningar eller shards.
- Topplaceringar får ge titlar, badges eller prestige men aldrig exklusiv gameplay-kraft.
- Serverbossbelöningar får inte påverka normal highscore-ranking.

### Säkerhet

- Boss-event, loadout, blueprintägande, Arsenal Rank, starttid och bidrag ägs av servern.
- Klientrapporterad skada valideras och klampas mot maximal rimlig skada för loadout, tid och eventfas.
- Bidrag skrivs med idempotency key och atomisk databasfunktion så replay inte kan ge dubbel skada eller belöning.
- Misstänkta bidrag ska kunna flaggas och exkluderas utan att hela eventet stoppas.

## Serverboss — beslutad MVP-form

- Ett event pågår normalt i 48 timmar. Första liveprovet kan vara kortare och manuellt styrt.
- Ett Boss Assault är en fristående, tidsbegränsad run på cirka 90 sekunder.
- Spelaren väljer en permanent upplåst mastery-blueprint före start. Inga vanliga weapon crates eller slumpmässiga Crown Powers används under försöket.
- Nya spelare får alltid ett standardalternativ och en eventroterande trial-blueprint.
- Global boss-HP visas separat från försöksrunens fas- och damagepresentation.
- Ett försök fortsätter genom flera tydliga faser; spelaren bidrar med den godkända skadan efter avslutad run.
- Bossen ska ha minst tre mekaniska faser: exponerad kärna för focus damage, add/relay-fas för crowd och chain, samt sköld/pylon-fas för piercing och multi-target. Överlevnad och projektiltryck används genom hela striden.
- Alla tio mastery-former ska ha minst en relevant styrka i eventet. Ingen blueprint får dominera samtliga faser.
- Arsenal Rank 0–10 ger preliminärt +2 % godkänd boss damage per rank, högst +20 %. Den tjänas endast från serververifierad singleplayer-progression.
- Försök 1–3 per event räknas preliminärt till 100 %, försök 4–6 till 75 % och senare försök till 50 %. Modellen ska vara serverägd och konfigurerbar.
- Ett giltigt minsta personligt bidrag krävs för global eventbelöning. Topplaceringar ger bara prestige, titel eller badge.
- MVP:n använder polling efter assault och med lugnt intervall på eventskärmen. Realtime får läggas till senare om det ger tydlig visuell nytta.

## Serverboss — implementeringspass

### Pass 1 — Serverägd progression och Crown Armory

Mål: skapa den permanenta progression som gör att erfarna spelare får fler val och en måttlig styrkefördel.

Innehåll:

- datamodell för spelarprogression, Arsenal XP, Arsenal Rank och upplåsta weapon blueprints;
- serverägd katalog över de tio mastery-blueprints som redan finns i spelet;
- ett kostnadsfritt standardvapen och stöd för en roterande trial-blueprint;
- utökad verifierad run-settlement som kan ge Arsenal XP och godkänna en mastery-upplåsning;
- serverkontroller för minsta rimliga run-tid, crateantal, Warden-resultat och spelversion innan blueprint kan låsas upp;
- idempotenta XP- och unlock-transaktioner så samma run aldrig kan ge progression två gånger;
- möjlighet att beräkna/backfilla rimlig start-rank från befintliga server-settled runs utan att importera lokalt manipulerbar data;
- RLS/grants där klienten får läsa sin Armory men aldrig skriva rank eller unlocks direkt.

Klart när:

- en verifierad singleplayer-run kan ge exakt en serverägd progressionstransaktion;
- en mastery-blueprint kan låsas upp permanent och återläsas på en annan enhet;
- replay, annat konto och orimliga run-resultat avvisas;
- standard- och trial-loadout alltid finns även för ett nytt konto.

### Pass 2 — Crown Armory UX och event-entry

Mål: spelaren ska förstå vad som är upplåst, hur det låstes upp och vad som kan användas mot serverbossen.

Innehåll:

- en mobile-first `CROWN ARMORY`-skärm i samma arkadstil som Vault;
- blueprint-grid per vapen med locked, unlocked, selected och trial-status;
- stor pixelart-preview, rollbeskrivning och tydliga styrkor per mastery;
- Arsenal Rank, aktuell bonus och begriplig progress mot nästa rank;
- unlock-feedback efter en kvalificerad singleplayer-run utan störande toastspam;
- en `GLOBAL WARDEN`-signal på huvudmenyn när ett event är aktivt;
- eventskärm med global HP, tid kvar, personligt bidrag, försöksnivå och vald blueprint;
- inga e-postuppgifter eller privata profilfält i offentlig presentation.

Klart när:

- en ny respektive erfaren spelare ser korrekta och begripliga loadoutalternativ på mobil och desktop;
- locked blueprints inte kan väljas genom DOM- eller requestmanipulation;
- selected blueprint bevaras server-side mellan enheter;
- event-entry förklarar trial, Arsenal-bonus och avtagande bidrag innan start.

### Pass 3 — Lokal Boss Assault och bossmekanik

Mål: göra själva 90-sekundersstriden rolig innan global ekonomi eller belöningar kopplas in.

Innehåll:

- separat Boss Assault-spelläge som inte påverkar normal highscore;
- start direkt med vald mastery-blueprint och servergodkänd Arsenal-multiplikator;
- en ny serverboss-presentation med egna pixelart-assets, intro, impacts, phase transitions och wreck/completion state;
- exponerad kärnfas för focus-vapen;
- add/relay-fas för crowd-, chain- och defence-builds;
- pylon/sköldfas för piercing och multi-target;
- tydlig lokal assault damage, fasstatus, tid kvar och global HP-snapshot i HUD;
- liv, dash och reduced-effects fungerar enligt spelets befintliga mobile-first-regler;
- automatiserade damage-budgettester för alla tio blueprints så ingen dominerar hela försöket;
- lokal debugväg för fasbyte, loadoutbyte och full 90-sekunders simulering.

Klart när:

- alla tio mastery-former har minst en mätbar styrka och en tydlig tradeoff;
- ett standardkonto kan bidra men ett erfaret konto märker sin begränsade bonus;
- försöket håller stabil bildfrekvens på mobil och slutar med ett deterministiskt damage-resultat;
- död, timeout och avslutat försök alltid landar i samma säkra result state.

### Pass 4 — Global eventmotor och säker contribution settlement

Mål: koppla den färdiga striden till ett verkligt globalt boss-event utan att lita på klienten.

Innehåll:

- datamodeller för boss-event, assaults, contributions, attempts och event rewards;
- adminstyrd eventrad med starttid, sluttid, global max/current HP, trial-blueprint och balanskonfiguration;
- endpoint som startar assault och låser event, spelare, blueprint, Arsenal Rank, seed, starttid och spelversion;
- final endpoint som tar idempotency key och run telemetry men räknar godkänt bidrag server-side;
- serverberäknat damage ceiling per blueprint, aktiv tid och fas; rapporterad skada klampas eller avvisas;
- atomisk databasfunktion som låser assault/event, skriver contribution och minskar global HP exakt en gång;
- serverägd diminishing-returns-multiplikator per försök;
- hantering av event som avslutas medan ett redan giltigt assault pågår;
- auditfält och flaggning för misstänkt bidrag;
- polling av global HP med cache- och rate-limit-säkra intervall.
- serverägd damage-ranking per event där varje konto får en rad med summerad godkänd contribution, antal godkända assaults och callsign;
- en kompakt Top 10 på eventskärmen samt en full ranking med spelarens egen placering, även när spelaren ligger utanför Top 100;
- stabil rangordning på godkänd damage, därefter tidpunkten då totalskadan först uppnåddes; lokalt rapporterad raw damage får aldrig styra listan;
- endast slutförda och atomiskt verifierade contributions får påverka damage-topplistan.

Klart när:

- dubbla requests ger samma svar utan dubbel skada;
- annat konto, fel blueprint, utgånget assault och orimlig skada avvisas;
- samtidiga contributions aldrig kan sänka global HP under noll eller tappa uppdateringar;
- en klient kan vara offline kort och återuppta exakt samma pending settlement.
- samma spelare kan göra flera assaults men visas bara en gång med sin verifierade totalskada och korrekta personliga placering.

### Pass 5 — Milestones, eventresultat och lanseringspolish

Mål: göra eventet begripligt, belönande och driftbart från signal till avslut.

Innehåll:

- personliga damage milestones och kvalifikationsgräns för global reward;
- global victory, failed event och event expired som separata visuella states;
- serverägd, atomisk och idempotent reward claim;
- eventbelöning som kosmetik/badge samt begränsade shards, aldrig gameplay-kraft eller highscorebonus;
- contributor-lista och prestige-ranking utan exklusiv power reward;
- resultatkort som visar raw damage, godkänt bidrag, attempt multiplier, total contribution och nästa milestone;
- återhämtning från nätfel, gammal PWA-cache och eventversion som ändrats;
- telemetry för participation, completion, blueprint pick rate, phase damage, deaths och avvisade settlements;
- ett internt kort testevent före första publika 48-timmarseventet;
- säkerhets-, mobil-, PWA- och belastningstest samt dokumenterad rollback/disable-flagga.

Klart när:

- en spelare kan gå från huvudmenysignal till Armory, assault, settlement, milestone och reward utan oklar state;
- eventet kan pausas eller stängas server-side utan ny frontenddeploy;
- belöningar kan varken dubbelclaimas eller hämtas av okvalificerat konto;
- eventmetrics räcker för att balansera nästa boss utan att samla privata uppgifter.

## Reviderad byggordning

1. Serverboss Pass 1: Crown Armory och serverägd progression.
2. Serverboss Pass 2: Armory UX och event-entry.
3. Serverboss Pass 3: lokal Boss Assault.
4. Serverboss Pass 4: global eventmotor och contribution settlement.
5. Serverboss Pass 5: milestones, rewards och lanseringspolish.
6. Crown Profile och återanvändbart visuellt Player Card.
7. Crown Store med direkta shardköp och socialt synlig kosmetik.
8. PvP-lobby med vänteläge, invite-länk och två synliga skepp.
9. Seedad invite-only Crown Duel.
10. Quick Match och Ranked PvP när spelarbas och verifiering är redo.
11. Market MVP när spelarbas och inventory-likviditet är tillräckliga.

## Icke-mål för första versionerna

- Ingen realtids-PvP med två kolliderande skepp i samma arena.
- Ingen gameplay-kraft från cosmetics.
- Ingen shard-wager eller betting i PvP.
- Inga riktiga pengar, uttag eller konvertering av shards.
- Ingen klientauktoritativ vinnare, inventory, boss-HP eller eventbelöning.
