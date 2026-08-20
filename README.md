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

Vid lokal provspelning byter tangenterna 1–5 direkt mellan Blaster, Spread, Pulse, Laser och Tesla. `P` startar vid behov spelet och öppnar ett perk-val, `Z` hoppar till nästa zon, `G` skapar en giftpöl, `V` skapar ett Crown Weaver-möte, `X` skapar en Void Skimmer, `K` visar nästa wreck-animation och `B` startar vid behov spelet och ett Warden-möte direkt. Lägg till `?debug=1` i adressen för att aktivera provläget även på andra värdnamn.

Warden möter spelaren med en egen entré och tre läsbara stridsfaser. Varje fas kombinerar förvarnade salvor, säkra luckor i projektilringarna och – i de senare faserna – markerade Crown Beams. HUD:ens zonmätare växlar till bossens hälsa under striden.

Kronkrafterna använder elva egna transparenta pixelart-emblem. Vapenlådorna visar den faktiska vapenspriten för Blaster, Spread, Pulse, Laser eller Tesla i stället för en ritad teckensymbol.

## Global highscore

Version 0.10 har en mobile-first global topplista med separata tabeller för Chill, Arcade och Crowned. Spelaren skickar tre arkadinitialer efter rundan. Klienten får ett engångs-ID när rundan startar och Cloudflare Pages Function validerar tid, zon, run-statistik, versionsnummer och en generös poänggräns innan något sparas.

Databasen skapas genom att köra `supabase/schema.sql` i Supabase SQL Editor. Lägg därefter följande i Cloudflare Pages under **Settings → Variables and Secrets** för både Production och Preview:

- `SUPABASE_URL` som vanlig variabel.
- `SUPABASE_SECRET_KEY` som krypterad hemlighet. Använd Supabases nya server-side `sb_secret_...`-nyckel, aldrig en nyckel i frontendkoden.
- `SCORE_HASH_SALT` som en lång, slumpmässig krypterad hemlighet.

Pages Functions exponeras endast under `/api/*` via `_routes.json`; statiska spelresurser fortsätter att serveras utan Function-anrop. Om API:t eller databasen är otillgänglig fungerar spelet och de lokala rekorden fortfarande.
