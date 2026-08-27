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
- Supabase Realtime används endast för lobby-state och begränsad matchstatus: score, liv, zone, Warden-status och anslutning.
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

## Beslutad byggordning

1. Crown Profile och återanvändbart visuellt Player Card.
2. PvP-lobby med vänteläge, Quick Match, invite-länk och två synliga skepp.
3. Seedad och serverbunden 1v1 Crown Duel.
4. Permanent Crown Armory och blueprint-upplåsning från verifierad singleplayer.
5. Global Serverboss MVP.
6. Crown Store och därefter Market ovanpå samma profil-, katalog- och inventorygrund.

## Icke-mål för första versionerna

- Ingen realtids-PvP med två kolliderande skepp i samma arena.
- Ingen gameplay-kraft från cosmetics.
- Ingen shard-wager eller betting i PvP.
- Inga riktiga pengar, uttag eller konvertering av shards.
- Ingen klientauktoritativ vinnare, inventory, boss-HP eller eventbelöning.
