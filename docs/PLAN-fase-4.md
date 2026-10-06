# Plan fase 4: pushmeldingen

**Status: goedgekeurd op 2 oktober 2026** ("akkoord met je voorstellen"). Na fase 3 vroeg je om pushmeldingen op de telefoon ("ik wil wel de pushmelding"). Dit plan bouwt voort op fase 1 tot en met 3. De vaste afspraken staan in `CLAUDE.md`.

## Besluiten
Alle voorstellen uit §1 (V23–V29) zijn aangenomen:

| Vraag | Besluit |
|---|---|
| V23 | Een service worker, alleen om meldingen te tonen: geen cache en geen offline-modus. De regel in `CLAUDE.md` is daarop aangepast. |
| V24 | Push op dezelfde momenten als de mails (V14 en V15), naast de mail. De mail blijft het betrouwbare kanaal. |
| V25 | Iedere medewerker zet meldingen zelf aan, per toestel, via Mijn rooster. Op een iPhone kan dat alleen vanaf het beginscherm (iOS 16.4 of nieuwer). |
| V26 | Een korte tekst met datum en plaats, alleen over jezelf. Een tik opent Mijn rooster. |
| V27 | De schakelaar heet Meldingen versturen en geldt voor mail én push. Plus een knop Testmelding naar mij. |
| V28 | Een push-abonnement per toestel: alleen zichtbaar voor de medewerker zelf (beheerders zien aantallen), weg bij uitzetten, verlopen of volledig verwijderen. |
| V29 | Een VAPID-sleutelpaar, dat de eigenaar één keer maakt en in Netlify zet. De herinneringen via push vallen onder V17. |
| V30 | Aanvulling na de oplevering: een uitleg voor collega's met korte video's, op een pagina `/uitleg` zonder inloggen, plus een PDF. Zie §10. |
| V31 | Aanvulling: Planbord sneller. Een laadscherm, minder wachten op de database en de server overdag warm houden. Een snellere serverregio is een keuze voor de eigenaar. Zie §11. |
| V32 | Aanvulling: overstap van Netlify naar Vercel, in het betaalde team van 22labs, met de server in Frankfurt. Geen eigen domein: het adres is `planbord-ten.vercel.app`. Zie §12. |
| V33 | Aanvulling: een knop Uitnodiging sturen, per medewerker en voor iedereen tegelijk. De uitnodiging gaat ook als Meldingen versturen uit staat. Zie §13. |
| V34 | Aanvulling: Nog te regelen toont bovenaan een overzicht per week, en de gaten staan per week. Zie §13. |
| V35 | Aanvulling: de agenda koppelen op Android. Op de agendapagina, in de uitleg en in de PDF staan eigen stappen voor Android, en op een Android-telefoon is Kopieer link de knop. Zie §14. |
| V36 | Aanvulling: inloggen bij te veel codes. Een duidelijke melding met de wachttijd, de code die al onderweg is meteen invullen, en een knop Ik heb al een code. Op Android staat overal: Chrome, niet Samsung Internet. Zie §15. |
| V37 | Aanvulling: de uitnodiging legt ook uit hoe je Planbord op je beginscherm zet (iPhone en Android) en vraagt om de meldingen aan te zetten. Zie §16. |
| V38 | Aanvulling: beheerders zien wie er is ingelogd (met datum en tijd van de laatste keer) en wie meldingen aan heeft. Planbord slaat daar niets extra voor op. Zie §17. |
| V39 | Aanvulling: een mislukte uitnodiging heet ook zo. Iedereen uitnodigen neemt die collega's opnieuw mee, zonder dat iemand hem twee keer krijgt. De testmail zegt wat er mis is. Zie §18. |

De keuzes in §2 gelden zoals ze er staan, met twee uitwerkingen tijdens de bouw:
- **Sleutels maken.** Je maakt het sleutelpaar in Planbord zelf, onder Beheer → Instellingen, in plaats van met PowerShell. Je browser maakt het, en het wordt nergens bewaard. Je kopieert het daarna naar Netlify.
- **De publieke sleutel heet `VAPID_PUBLIC_KEY`**, zonder `NEXT_PUBLIC_`. De server geeft hem door aan de pagina, dus hij hoeft niet in de build te zitten.
- **De service worker wordt geregistreerd zodra de knop Meldingen aanzetten zichtbaar is**, en niet pas bij de tik. Een iPhone vraagt alleen om toestemming als dat direct op een tik volgt, en dan moet de service worker al klaarstaan. Hij doet verder niets.

Fase 4 levert één ding: **pushmeldingen** op de telefoon of computer van een medewerker, op dezelfde momenten als de mails van fase 3. Er komt geen app in de App Store of de Play Store. Het werkt via Planbord op het beginscherm, met *web push*: een open standaard die iPhone (vanaf iOS 16.4), Android en de gewone browsers ondersteunen.

Wat niet in fase 4 komt:
- een app in een appwinkel;
- meldingen over iets anders dan je eigen rooster;
- een offline-modus.

---

## 1. Vragen over bedrijfsregels

De nummering loopt door vanaf fase 3 (V13–V22). Bij elke vraag staat een voorstel. "Akkoord met je voorstellen" is genoeg.

### V23. Een service worker, alleen voor meldingen
- In `CLAUDE.md` staat nu: geen offline-modus en geen service worker. De spec zegt alleen dat een offline-modus niet nodig is.
- Pushmeldingen kunnen niet zonder service worker. Dat is een klein script dat de telefoon bewaart en dat de melding toont, ook als Planbord dicht is.
- **Voorstel:**
  - een service worker die alleen een melding toont en bij een tik Planbord opent;
  - hij bewaart niets: geen cache en geen offline-modus. Het rooster komt altijd vers van de server;
  - de regel in `CLAUDE.md` wordt: "Geen offline-modus. Een service worker alleen voor pushmeldingen, zonder cache."

### V24. Welke meldingen?
- **Voorstel:** dezelfde momenten als de mails (V14 en V15):
  - je wordt ingezet als invaller;
  - je inval gaat niet door;
  - je rooster voor één dag verandert;
  - om 16:00 de herinnering als je rooster morgen afwijkt.
- De push komt **naast** de mail, niet in plaats daarvan. De mail blijft het betrouwbare kanaal. Een push kan verloren gaan, bijvoorbeeld als de telefoon lang uit staat of als iemand de melding wegveegt.

### V25. Wie zet het aan?
Een telefoon vraagt altijd zelf om toestemming. Een beheerder kan meldingen dus niet voor iemand aanzetten.
- **Voorstel:**
  - op **Mijn rooster** komt een blok **Meldingen op dit toestel**, met de knop **Meldingen aanzetten**;
  - wie wil, zet het aan op elk eigen toestel: telefoon, en eventueel computer. Uitzetten kan op dezelfde plek.
- **iPhone:** het werkt alleen vanuit Planbord op het beginscherm, en vanaf iOS 16.4. Opent iemand Planbord gewoon in Safari, dan legt het blok uit hoe je Planbord op het beginscherm zet.

### V26. Wat staat er in de melding?
Een melding is ook zichtbaar op het vergrendelscherm.
- **Voorstel:** kort, met datum en plaats, en alleen over jezelf. Bijvoorbeeld:
  - "Je valt in op wo 14 okt in Eindhoven (07:30–18:00)";
  - "Je inval op wo 14 okt gaat niet door";
  - "Je rooster voor di 13 okt is gewijzigd";
  - "Morgen wijkt je rooster af: Eindhoven 07:30–18:00".
- Een tik op de melding opent Mijn rooster.
- **Alternatief:** zonder details, alleen "Je rooster is gewijzigd". Dat is iets privéer op het vergrendelscherm, maar dan moet je de app openen om te zien wat er is.

### V27. Eén schakelaar voor mail en push
- **Voorstel:**
  - de schakelaar **Mails versturen** heet voortaan **Meldingen versturen** en geldt voor mail én push. De reden is dezelfde als bij V18: de preview en de gewone app delen één database;
  - in Instellingen komt naast de testmail een knop **Testmelding naar mij**. Die gaat naar al je eigen toestellen met meldingen aan, ook als de schakelaar uit staat.

### V28. Nieuwe gegevens: een abonnement per toestel
- Voor elk toestel met meldingen aan bewaart Planbord een *push-abonnement*: een adres bij de pushdienst van Apple, Google, Mozilla of Microsoft, met twee sleutels. Daarmee kan Planbord dat ene toestel een melding sturen.
- De pushdienst kan de inhoud niet lezen, want Planbord versleutelt elke melding voor dat ene toestel. De pushdienst ziet wel dát er een melding is, en wanneer.
- **Voorstel:**
  - een medewerker ziet en beheert alleen de eigen toestellen. Beheerders kunnen de abonnementen lezen om te versturen, maar zien in de app alleen hoeveel toestellen iemand heeft;
  - een abonnement verdwijnt bij uitzetten, als de pushdienst meldt dat het niet meer bestaat, en bij volledig verwijderen;
  - de gegevensexport van een medewerker (V20) noemt het aantal toestellen en sinds wanneer, maar niet het adres en de sleutels;
  - in `CLAUDE.md` komt "push-abonnementen van eigen toestellen" bij wat Planbord mag bewaren.

### V29. Sleutels voor push
- Pushmeldingen vragen een eigen sleutelpaar, de *VAPID-sleutels*. De publieke sleutel staat in de app. De privésleutel staat alleen op de server, in Netlify.
- **Voorstel:**
  - jij maakt het sleutelpaar één keer met een PowerShell-opdracht uit de README, en zet het in Netlify. Net als bij `CRON_SECRET` stuur je het nooit via chat of mail;
  - de geplande taak verstuurt de herinneringen van 16:00 ook als push. Dat valt onder het doel van de geheime sleutel uit V17; er komt geen nieuw doel bij.

---

## 2. Keuzes die ik maak

**Versturen**
- **Zelf gebouwd, zonder het pakket `web-push`.**
  - Het versturen volgt de open standaarden: RFC 8030 (web push), RFC 8291 (versleuteling) en RFC 8292 (VAPID).
  - Ik bouw het met de ingebouwde crypto van Node. Het bekende pakket `web-push` heeft sinds januari 2024 geen nieuwe versie gehad, en `CLAUDE.md` vraagt om actief onderhouden pakketten.
  - De versleuteling test ik met het voorbeeld uit RFC 8291. Met vaste sleutels moet daar precies dezelfde uitkomst uitkomen.
- **Tegelijk met de mail.** Een push gaat tegelijk met de mail weg, met de tekst van dat moment.
  - Een mislukte push wordt niet opnieuw geprobeerd: een late push heeft weinig zin, en de mail probeert het al opnieuw.
- **Opruimen.** Meldt de pushdienst dat een abonnement niet meer bestaat (404 of 410), dan verwijdert Planbord het.
- **Inactieve medewerkers** krijgen geen push, net zoals ze geen mail krijgen.
- **Alleen bekende pushdiensten.** De server stuurt alleen naar https-adressen van Apple, Google, Mozilla en Microsoft, en de database weigert andere adressen. Zo kan niemand de server een ander adres laten aanroepen.
- **Beheer → Mails** toont bij elke mail ook naar hoeveel toestellen de push is gegaan.

**Service worker**
- `public/sw.js`, met alleen een `push`- en een `notificationclick`-handler: geen cache en geen `fetch`-handler.
- Hij wordt pas geregistreerd als iemand meldingen aanzet.

**Logboek**
- Aan- en uitzetten op een toestel komt niet in het logboek. Het is een instelling van je eigen toestel en geen planning, net als de mailwachtrij (fase 3).

**Branch:** fase 4 staat op een eigen branch, `claude/planbord-fase-4`, met een eigen pull request.

---

## 3. Datamodel

RLS staat aan op elke nieuwe tabel. Eerst `revoke all` voor `anon` en `authenticated`, daarna expliciete grants. `anon` krijgt niets.

**Nieuwe tabel `push_subscriptions`**

| Kolom | Type | Uitleg |
|---|---|---|
| `id` | uuid | |
| `employee_id` | uuid | van wie het toestel is. Verdwijnt mee bij volledig verwijderen |
| `endpoint` | text | het adres bij de pushdienst; uniek, alleen bekende pushdiensten |
| `p256dh`, `auth` | text | de sleutels van het toestel |
| `created_at` | timestamptz | sinds wanneer de meldingen aan staan |
| `last_success_at` | timestamptz | de laatste keer dat een push aankwam |

- **Rechten:**
  - een medewerker leest, maakt en verwijdert alleen de eigen rijen;
  - beheerders lezen alles, om te kunnen versturen;
  - niemand wijzigt een rij. Alleen de server werkt `last_success_at` bij.

**`mail_queue`:** een nieuwe kolom `push_devices`, het aantal toestellen dat de push kreeg.

**Instellingen:** de kolom `mail_enabled` blijft. Alleen de tekst in de app wordt "Meldingen versturen".

**Migraties en bundel:**
- nieuwe bestanden in `supabase/migrations/`, en de bundel `supabase/setup/fase-4.sql`;
- hij is herhaalbaar en voegt alleen toe. Je kunt hem dus al vóór de merge draaien.

---

## 4. Code

| Waar | Wat |
|---|---|
| `src/lib/push/` (puur) | de tekst van elke melding, het VAPID-token en de versleuteling |
| `src/lib/push/send.ts` | versturen naar de pushdienst; begint met `import 'server-only'` |
| `src/lib/mail/dispatch.ts` | push naast de mail, bij directe meldingen en in de geplande taak |
| `public/sw.js` | de service worker (V23) |
| `src/components/client/push-toggle.tsx` | het blok Meldingen op dit toestel (V25) |

- **Nieuwe omgevingsvariabelen:**
  - `VAPID_PUBLIC_KEY`;
  - `VAPID_PRIVATE_KEY`, geheim;
  - `VAPID_SUBJECT`, bijvoorbeeld `mailto:info@22labs.nl`.
- Geen nieuwe pakketten.
- Na je akkoord werk ik `CLAUDE.md` bij: de service worker (V23), de push-abonnementen (V28) en de nieuwe omgevingsvariabelen.

---

## 5. Schermen

**Voor iedereen**
- **Mijn rooster:** het blok **Meldingen op dit toestel**, met **Aanzetten** of **Uitzetten**. Er staat uitleg bij voor de iPhone, en voor als je eerder op "Niet toestaan" hebt getikt.

**Voor beheerders**
- **Instellingen:** de schakelaar **Meldingen versturen** (mail en push), en de knoppen **Testmail naar mij** en **Testmelding naar mij**.
- **Beheer → Mails:** bij elke mail ook bijvoorbeeld "push: 2 toestellen".
- **Pagina van een medewerker:** "Meldingen aan op 2 toestellen".

---

## 6. Testaanpak

**Pure functies** (Vitest):
- de tekst van elke melding: alleen eigen gegevens, geen namen van anderen;
- het VAPID-token, gecontroleerd met de publieke sleutel;
- de versleuteling, met het voorbeeld uit RFC 8291.

**Database** (PGlite):
- RLS en grants van `push_subscriptions`: alleen eigen rijen, de beheerder leest, en `anon` kan niets;
- alleen adressen van bekende pushdiensten;
- de cascade bij volledig verwijderen;
- `fase-4.sql` twee keer achter elkaar.

**Versturen:** tegen een nagebootste pushdienst, ook met een 410: dan verdwijnt het abonnement. In de tests gaat nooit een echte melding weg.

**Schermen:**
- Zelf loop ik ze door in een browser, met een nagebootste pushdienst.
- Echte toestellen test jij via de preview: een iPhone vanaf het beginscherm, en Android in Chrome.

---

## 7. Bouwvolgorde (kleine commits)
1. Plan op goedgekeurd zetten en `CLAUDE.md` bijwerken.
2. Migratie, de bundel en de databasetests.
3. Pure pushfuncties met tests: tekst, VAPID en versleuteling.
4. Versturen, en dat koppelen aan de mails en de geplande taak.
5. De service worker en het blok op Mijn rooster.
6. Instellingen, Beheer → Mails, de medewerkerspagina en de gegevensexport.
7. Afronden: README, `supabase/setup/fase-4.sql`, en de PR met handmatige stappen en testlijst.

---

## 8. Oplevering: handmatige stappen voor jou
1. **Supabase → SQL Editor:** draai `supabase/setup/fase-4.sql`.
2. **VAPID-sleutels:** maak het sleutelpaar in Planbord, onder Beheer → Instellingen → Sleutels voor meldingen.
3. **Netlify → Environment variables:**
   - `VAPID_PUBLIC_KEY`;
   - `VAPID_PRIVATE_KEY`, met **Contains secret values**;
   - `VAPID_SUBJECT` = `mailto:info@22labs.nl`.

   Bouw daarna de preview opnieuw.
4. **Op je eigen telefoon:**
   1. Zet Planbord op het beginscherm en open het daar.
   2. Ga naar Mijn rooster → **Meldingen aanzetten**.
   3. Ga naar Instellingen → **Testmelding naar mij**.
5. **Collega's:** de README krijgt een korte uitleg die je kunt doorsturen.

---

## 9. Risico's en aandachtspunten
- **iPhone.**
  - Push werkt alleen vanuit Planbord op het beginscherm, en vanaf iOS 16.4.
  - Apple kan een abonnement zonder melding laten verlopen. Daarom blijft de mail.
- **Android.** Batterijbesparing kan een melding vertragen.
- **"Niet toestaan".** Wie dat kiest, kan het alleen in de instellingen van de telefoon terugdraaien. Het blok legt uit hoe.
- **Pushdiensten buiten de EU.** De pushdiensten van Apple en Google staan buiten de EU. Ze kunnen niet lezen wat er in een melding staat, wel dat er een melding is. Noem dat in de uitleg aan het team.
- **Een vastzittende service worker.** Een fout in de service worker kan op toestellen blijven hangen. Daarom doet hij bijna niets, en vervangt een nieuwe versie hem vanzelf.

---

## 10. Aanvulling: uitleg met video's (V30)
De eigenaar wil een duidelijke uitleg meesturen naar collega's: korte video's die laten zien waar je op tikt, plus een pagina in Planbord en een PDF.

**Wat er komt**
- **Negen korte video's** (20 tot 40 seconden, samen zo'n 4 minuten), elk over één onderwerp:
  - welkom;
  - op je beginscherm (iPhone en Android);
  - inloggen met je code;
  - je rooster lezen;
  - meldingen aanzetten (iPhone en Android);
  - je rooster in je agenda;
  - vakantie of afwezig.
- **De pagina `/uitleg`**, met per onderwerp de video('s), de stappen en eventuele tips. Er is een link naar op de inlogpagina ("Nieuw hier? Bekijk de uitleg") en in de kop van de app ("Uitleg").
- **Een PDF van vijf pagina's** met dezelfde stappen, stilstaande beelden uit de video's en een QR-code naar `/uitleg`.

**Keuzes**
- **Voor collega's.** Een serie voor beheerders kan later.
- **Staand formaat, zonder geluid.** Grote ondertitels, zodat je ze ook op het werk kunt kijken.
- **De echte schermen van Planbord, met een verzonnen team.** De schermen zijn vastgelegd met de fictieve teamfixture; nooit met echte collega's. De telefoononderdelen (beginscherm, Safari, Chrome, dialogen) zijn eenvoudige eigen nabootsingen.
- **Zelf gebouwd, geen AI-video.** Animaties in HTML, beeld voor beeld gerenderd naar MP4 (H.264). De bron staat in `tools/uitleg-video/`, zodat een video opnieuw te maken is als een scherm verandert. Die map hoort niet bij de app en de build.
- **Te openen zonder inloggen.** Zo kun je de link sturen voordat iemand een account heeft. De pagina bevat geen gegevens uit de database. Net als de rest wordt ze niet geïndexeerd (noindex, `X-Robots-Tag` en `robots.txt`).
- **Niet op YouTube of Vimeo.** Die brengen trackers mee. De video's staan in `public/uitleg` en laden pas als je op afspelen tikt.
- **Op de pagina lichtere versies** (720 × 1280), zodat ze snel laden. De eigenaar krijgt de video's ook los in 1080 × 1920, om bijvoorbeeld in de groepsapp te zetten.
- **Afwezigheid doorgeven:** de video zegt "Geef het door aan de beheerder, zoals je gewend bent. Zelf invullen kan niet." De eigenaar heeft geen andere zin opgegeven; aanpassen is één regel.
- **De teksten staan op één plek** (`src/lib/guide/topics.ts`). De pagina en de PDF gebruiken ze allebei. Een test controleert dat elke video en de PDF bestaan, en dat er geen e-mailadressen in de teksten staan.

---

## 11. Aanvulling: snelheid (V31)
De eigenaar merkte dat Planbord traag aanvoelt. Op het voorstel kwam akkoord: "ga door met snelheid".

**Waar de tijd zat**
- **Ver weg.** De server van de app draait bij Netlify standaard in de VS (Ohio), de database in Frankfurt. Elke vraag aan de database gaat over de oceaan en terug: zo'n 0,1 seconde.
- **Na elkaar.** Per pagina gingen vier vragen na elkaar: de inlog controleren, het account opzoeken, de medewerker opzoeken, en dan pas de gegevens van de pagina.
- **In slaap.** Na een rustige periode legt Netlify de server stil. De eerste pagina daarna duurt een paar seconden, omdat de server eerst moet opstarten.
- **Geen reactie.** Na een tik op de tabbalk gebeurde er niets zichtbaars tot de hele pagina klaar was.

**Wat er is gebouwd**
- **Een laadscherm** (`src/app/(app)/loading.tsx`). Na een tik zie je meteen een grijze opzet van de pagina. De kop en de tabbalk blijven staan.
- **Minder wachten op de database:**
  - het account en de medewerker in één vraag in plaats van twee;
  - de gegevens van een pagina laden tegelijk met de controle wie er kijkt, niet erna (`requireViewerWith` en `requireAdminWith`). De pagina krijgt ze pas als die controle slaagt, en RLS schermt ze hoe dan ook af. Alleen *Agenda* wacht nog: die heeft eerst de kijker nodig.
- **Warm houden** (`netlify/functions/wakker-houden.mts`). Van 's ochtends vroeg tot 's avonds laat (5:00 tot 23:00, in de zomer 6:00 tot 24:00) vraagt een geplande taak elke 5 minuten de lege route `/taken/wakker` op. Die doet niets, geeft niets terug en raakt de database niet. Daarom is er geen geheim nodig. Dit draait alleen op de gepubliceerde site.

**Gemeten.** Lokaal nagebootst, met 0,1 seconde per databasevraag zoals nu tussen de VS en Frankfurt. Het opstarten na een rustige periode zit hier niet in; dat lost het warm houden op.

| Pagina | Voor | Na |
|---|---|---|
| Mijn rooster | 0,59 s | 0,35 s |
| Rooster (Den Bosch) | 0,58 s | 0,34 s |
| Verlofoverzicht | 0,57 s | 0,35 s |
| Agenda | 0,55 s | 0,44 s |
| Beheer | 0,70 s | 0,38 s |
| Beheer → Medewerkers | 0,56 s | 0,34 s |
| Beheer → Regelen | 0,69 s | 0,37 s |

Met de database vlakbij (zo'n 3 ms per vraag, zoals bij een server in Frankfurt) duurt dezelfde pagina 0,04 tot 0,10 seconde.

**Keuzes voor de eigenaar** (geen code nodig)
- **De server naar Frankfurt.** Dit heeft het grootste effect, maar Netlify laat de regio alleen kiezen met een betaald abonnement. Dan staan de app en de database naast elkaar.
- **Nieuwe inlogsleutels in Supabase.** Werkt het project nog met het oude "Legacy JWT secret", dan vraagt Planbord bij elke pagina Supabase of de inlog klopt. Met de nieuwe sleutels controleert Planbord dat zelf. Het is gratis en niemand wordt uitgelogd. De stappen staan in de README (stap 9).

**Gevolgen**
- **Een collega op een beheerpagina** ziet heel even het laadscherm en komt dan op Mijn rooster. Door het laadscherm is de pagina al onderweg; de omleiding gebeurt daarom in de browser in plaats van op de server. Er gaan geen beheergegevens mee. Dat is getest: geen namen, geen e-mailadressen.
- **Warm houden** gebeurt 216 keer per dag, zo'n 6.500 keer per maand. Elke keer zijn dat twee korte aanroepen bij Netlify (de taak en de app), van een paar milliseconden.
- **De nagebootste Supabase** (`tools/uitleg-video/mock`) kan nu ook een gekoppelde rij meesturen, zoals "het account met de medewerker erbij". Met `MOCK_DELAY_MS` en `MOCK_LOG` meet je zelf hoeveel vragen een pagina doet en hoe lang dat duurt.

---

## 12. Aanvulling: overstap naar Vercel (V32)
De eigenaar heeft via 22labs al een betaald abonnement bij Vercel. In de opdracht stond "niet op Vercel", omdat het gratis plan daar alleen voor niet-commercieel gebruik is. Met het betaalde team geldt dat niet meer. Akkoord van de eigenaar: "Ja overstappen, nog niemand gebruikt hem, domein volgt later."

**Waarom**
- **De server staat in Frankfurt**, naast de database, zonder extra kosten. Dat is de grootste stap uit §11: lokaal nagebootst gaat een pagina van zo'n 0,35 naar 0,05 tot 0,1 seconde.
- **Nu is het goede moment.** Nog niemand gebruikt de app, dus niemand hoeft iets opnieuw in te stellen.

**Wat er verandert**
- **`vercel.json`** zet:
  - de regio op `fra1` (Frankfurt);
  - het bouwen zonder telemetrie van Next.js;
  - de geplande taken via Vercel Cron:
    - elk uur `/taken/herinneringen`. Vercel roept die aan met GET en stuurt `CRON_SECRET` mee als Bearer-token. De route accepteert daarom ook GET; met POST start je hem nog steeds met de hand;
    - overdag elke 5 minuten `/taken/wakker` (V31). Op Vercel is dat misschien minder nodig, maar het kost vrijwel niets.
- **Weg:** `netlify.toml` en `netlify/functions/`.
- **`middleware.ts` heet nu `proxy.ts`**, zoals Next.js 16 wil. Op Netlify kon dat niet (§16 van het plan van fase 1).
- **Node 22 staat vast** in `package.json` (`22.x`). Anders kiest Vercel vanzelf de nieuwste versie.
- **Teksten in de app** die naar Netlify verwezen (sleutels, testmail en de inlogpagina zonder Supabase) noemen nu Vercel.
- **Een test controleert `vercel.json`:** de regio, de geplande taken, dat elke taak een route met GET heeft, en dat de taken buiten de proxy blijven.

**Keuzes**
- **Geen meetdiensten.** Geen Vercel Analytics en geen Speed Insights; zoals altijd geen trackers. De Vercel Toolbar op previews zet de eigenaar uit; onze beveiligingsregels (CSP) blokkeren hem toch.
- **Eén database.** Previews en productie delen nog steeds één database, net als bij Netlify.
- **Geen eigen domein.** Na de overstap koos de eigenaar ervoor om bij het adres van Vercel te blijven: "Blijf bij vercel.app, maak de video's opnieuw." Het adres is `https://planbord-ten.vercel.app`.
  - Komt er later toch een eigen domein, dan veranderen alleen `SITE_URL`, de Site URL in Supabase en het adres in de uitleg (`UITLEG_ADRES`).
  - Doe dat dan vóórdat collega's de app gebruiken. Het adres zit vast aan het icoon op het beginscherm, de meldingen en de agendalinks.
- **De uitleg.** De video's en de PDF tonen `planbord-ten.vercel.app`.
  - Het adres komt op één plek binnen: `UITLEG_ADRES` (`tools/uitleg-video/address.mjs`). Het geldt voor de video's, voor de PDF (tekst, QR-code en beelden) en als controle bij het vastleggen van de schermen.
  - Eerst kreeg alleen de tekst van de PDF het nieuwe adres. De beelden in de PDF komen uit de video's en toonden nog het oude adres; dat is nu ook goed.
  - De schermen van Planbord zijn opnieuw vastgelegd, op maandag 5 oktober 2026, de dag van de teksten in de video's (`clock.cjs`). Daardoor tonen zeven video's nu ook de link "Uitleg" in de kop en "Bekijk de uitleg" op de inlogpagina. De twee video's over meldingen zijn niet veranderd.
  - De stappen op de pagina `/uitleg` tonen altijd het goede adres (`SITE_URL`).

**Gevolgen**
- **Opzetten.** De eigenaar maakt het project aan in Vercel en zet de omgevingsvariabelen over. De stappen staan in de pull request en in de README (stap 4).
- **Netlify opruimen.** Daarna verwijdert de eigenaar de site bij Netlify. Na de merge draaien daar al geen geplande taken meer, dus dubbele herinneringen komen er niet.
- **De eigen telefoon:**
  - zet eerst in de oude app de meldingen uit;
  - haal het oude icoon weg;
  - zet de nieuwe app op het beginscherm;
  - log opnieuw in en zet de meldingen weer aan.

---

## 13. Aanvulling: uitnodiging sturen en een overzicht per week (V33, V34)
De eigenaar vroeg: "Maak die knop Uitnodiging sturen maar. En kan ik ook in een overzicht zien op welke datum's/weken ik nog vervanging moet regelen?" Op de vraag of de uitnodiging een uitzondering mag zijn op Meldingen versturen: "Ja, uitnodiging mag altijd". Op de vraag over een overzicht per week: "Ja, maak het erbij".

**Uitnodiging sturen (V33)**
- **Waar:**
  - Bij een medewerker, in het blok Inloggen: **Uitnodiging sturen**, met de stand ("Uitgenodigd op di 6 okt"). Daarna kun je hem opnieuw sturen.
  - In de lijst met medewerkers: **Iedereen uitnodigen**. Dat stuurt een uitnodiging aan iedere actieve medewerker met een inlogaccount die er nog geen kreeg, behalve aan jezelf. Je bevestigt eerst, met het aantal erbij.
- **De mail:**
  - Alleen naar de eigen werkmail, met "Hoi" en de voornaam.
  - Wat Planbord is, een link naar de app en naar `/uitleg`, en hoe inloggen gaat: werkmail invullen, de code van 6 cijfers uit de mail invullen, geen wachtwoord.
  - Geen inloglink (zie de opdracht: mailscanners maken die ongeldig), geen plaatjes of trackers en geen namen van anderen. Geen push: wie nog niet heeft ingelogd, heeft ook geen toestel met meldingen.
- **Ook als Meldingen versturen uit staat.** Zo kan de eigenaar iedereen uitnodigen voordat herinneringen en meldingen aan gaan. `CLAUDE.md` is daarop aangepast.
- **Via de wachtrij:**
  - Een nieuwe soort mail, `invite`, zonder datums.
  - Mislukt het versturen, dan probeert de geplande taak het elk uur opnieuw, ook als meldingen uit staan. Dat gebeurt hooguit drie keer, in de eerste week.
  - Beheer → Mails toont elke uitnodiging.
  - Bij Iedereen uitnodigen gaan de mails één voor één. Duurt dat te lang, dan staan de rest al klaar in de wachtrij en verstuurt de geplande taak ze.
- **De stand komt uit de wachtrij.** Er komt geen nieuw gegeven over medewerkers bij.
  - Uitgenodigd is wie een uitnodiging heeft die verstuurd is, klaarstaat of nog opnieuw geprobeerd wordt.
  - Sinds V39 telt een mislukte uitnodiging niet meer als uitgenodigd; zie §18.
  - Na 90 dagen ruimt Planbord de wachtrij op; daarna telt iemand weer als niet uitgenodigd. Iedereen uitnodigen is vooral voor de start; een nieuwe collega nodig je los uit.
- **Rechten:** alleen beheerders, in de server action én via de bestaande RLS van de wachtrij. De mail gaat met de sessie van de beheerder. Alleen het opnieuw proberen gebeurt in de geplande taak, met de secret key, zoals bij de andere mails (V17).
- **Logboek:** een uitnodiging verandert geen gegevens, dus er komt niets in het logboek. Beheer → Mails laat zien wanneer welke uitnodiging ging.
- **Database:** één migratie, die de soort `invite` toestaat in de wachtrij. De eigenaar draait de SQL van fase 4 opnieuw (`supabase/setup/fase-4.sql`); dat is veilig.

**Een overzicht per week in Nog te regelen (V34)**
- Bovenaan staat per week in de periode één regel, bijvoorbeeld "Week 42 · 12–18 okt · 3 gaten · di 13 · do 15 · vr 16". Weken zonder gat staan er ook, als "niets te regelen".
- Een tik op een week springt naar die week. Daaronder staan de gaten per week, met de week als kopje.
- Het indelen per week is een pure functie met tests (`gapWeeks` in `src/lib/admin/planning.ts`).

---

## 14. Aanvulling: de agenda koppelen op Android (V35)
Een collega met een Android-telefoon kreeg het rooster niet in de agenda. De eigenaar: "ik zie ook niks over hoe het werkt op android. alleen op iphones en ipads". Op het voorstel: "ja maak het zo".

**Waarom het niet werkte**
- De knop Toevoegen aan agenda is een webcal-link. Een iPhone opent daarmee de app Agenda; op Android opent zo'n link niets.
- De app Google Agenda kan geen agenda via een link toevoegen. Dat kan alleen op de website calendar.google.com: op een computer, of op de telefoon in Chrome met Desktopsite aan. Daarna zet je de agenda in de app aan bij Synchroniseren.

**Wat er verandert**
- **Agendapagina:** een eigen blok Android (Google Agenda) met de stappen. Het vervangt het blok Google Agenda, met een regel voor wie het liever op een computer doet.
- **Op een Android-telefoon:**
  - staat dat blok bovenaan en is het open;
  - is bij een nieuwe link Kopieer link de grote knop, zonder Toevoegen aan agenda, met een verwijzing naar de stappen.
- **Herkennen:**
  - De server kijkt naar de kopteksten van het verzoek: `Sec-CH-UA-Platform` (Chrome en Samsung Internet) en de user-agent (ook Firefox).
  - Een pure functie met tests: `isAndroid` in `src/lib/feeds/device.ts`.
  - Planbord bewaart daar niets van.
  - Herkent Planbord een Android-telefoon niet, bijvoorbeeld met Desktopsite aan, dan staat het blok Android er gewoon, alleen dicht.
- **Uitleg en PDF:** bij Je rooster in je agenda staan de stappen voor iPhone en Android apart. De video blijft die van de iPhone; de stappen voor Android staan er als tekst bij. In de PDF staan ze naast elkaar. De PDF telt daardoor zes pagina's in plaats van vijf.
- **Opdracht:** in `docs/SPEC.md` staat bij Agenda nu ook Android, met een verwijzing naar dit besluit.
- Geen nieuwe gegevens, geen migratie en geen handmatige stappen.

---

## 15. Aanvulling: te veel inlogcodes, en Chrome op Android (V36)
Een collega kreeg bij het inloggen de melding "Te veel pogingen". De eigenaar daarnaast: "Er moet ook staan dat ze moeten openen in chrome want samsung internet werkt het niet".

**Waarom "Te veel pogingen"**
- Supabase stuurt per mailadres hooguit één code per minuut. Elke nieuwe code maakt de vorige ongeldig.
- Daarnaast gelden grenzen voor het hele team: een maximum aantal mails per uur, en grenzen per IP-adres. Alle aanvragen komen van de server van Planbord, dus ook die laatste tellen voor het hele team samen.
- Wie op Android van browser wisselt, moet opnieuw inloggen: Chrome en Samsung Internet onthouden de inlog los van elkaar. Zo vraag je snel een paar codes aan.
- Planbord toonde in al die gevallen "Te veel pogingen. Wacht even en probeer het dan opnieuw." en bleef bij het invullen van de werkmail. De code die al onderweg was, kon je dan niet invullen.

**Wat er verandert**
- **Binnen de minuut opnieuw een code aanvragen:** Planbord gaat door naar het invullen van de code, met "Je hebt net al een code gekregen. Vul de code uit de nieuwste mail in. Geen mail? Over 42 seconden kun je een nieuwe aanvragen."
- **Een grens voor het hele team bereikt:** "Er zijn net te veel inlogcodes aangevraagd. Probeer het over een paar minuten opnieuw." Met een verwijzing naar Ik heb al een code en naar de beheerder. In de logs van Vercel staat welke grens het was, zonder e-mailadres.
- **Een knop Ik heb al een code**, onder het invullen van de werkmail. Handig als de telefoon het scherm opnieuw laadde terwijl je de mail opzocht. Er gaat dan geen nieuwe code uit.
- **Bij het controleren van de code:** bij te veel pogingen staat er niet meer dat de code niet klopt, maar dat je een minuut wacht en dezelfde code opnieuw probeert.
- De uitkomsten staan in een pure functie met tests: `src/lib/auth/login.ts`.

**Chrome op Android**
- In de stappen voor Android staat nu: Chrome, niet Samsung Internet. Dat geldt voor de agendapagina, de uitleg (beginscherm, inloggen en agenda), de PDF en de README.
- In de uitnodiging staat: "Open Planbord op je telefoon (op Android in Chrome, niet in Samsung Internet)".
- De stappen zijn voor Chrome geschreven; in Samsung Internet heten de menu's anders.

**Verder**
- Geen nieuwe gegevens, geen migratie.
- Advies in de README: zet in Supabase het aantal mails per uur op bijvoorbeeld 100 (Authentication → Rate Limits). Eerder stond daar 60.

---

## 16. Aanvulling: de uitnodiging met beginscherm en meldingen (V37)
De eigenaar: "wellicht goed om bij de mail die we gaan versturen ook vermelden dat ze niet moeten vergeten de meldingen aan te zetten en een instructie hoe ze de app op hun telefoon zetten."

**De stappen in de uitnodiging**
1. Open Planbord op je telefoon: op een iPhone in Safari, op Android in Chrome (niet in Samsung Internet).
2. Zet Planbord op je beginscherm, met de stappen voor iPhone en Android. Dat zijn dezelfde stappen als in de uitleg.
3. Open Planbord voortaan via het icoon en log in met de code uit de mail.
4. "Vergeet niet de meldingen aan te zetten", met waar je dat doet. In de html staat die zin vet.

**Keuzes**
- **Eerst het beginscherm, dan inloggen.** Op een iPhone onthouden Safari en de app je inlog los van elkaar, en meldingen werken alleen in de app. Zo log je maar één keer in.
- **Alleen tekst:** geen plaatjes, geen inloglink en geen namen van anderen, zoals bij V33. Voor beelden staat de link naar de uitleg eronder.
- Geen nieuwe gegevens, geen migratie en geen handmatige stappen. Wie al een uitnodiging kreeg, krijgt de nieuwe alleen als je hem opnieuw stuurt.

---

## 17. Aanvulling: wie is er al begonnen (V38)
De eigenaar: "Ik wil graag ook zien of er mensen zijn ingelogd, op de telefoon hebben gezet of voor het laatst hebben ingelogd indien dat mogelijk is?" Op de vragen: de laatste keer inloggen met "Datum en tijd", en voor de telefoon "Meldingen aan als teken".

**Wat de beheerder ziet**
- **Beheer → Medewerkers**, bovenaan: "8 van de 12 collega's met een inlogaccount zijn ingelogd. 5 hebben meldingen aan." Dat telt alleen actieve collega's met een inlogaccount.
- **Per collega in de lijst:** *nog niet ingelogd*, of *ingelogd di 6 okt*, en dan *meldingen aan* of *meldingen uit*. Wie nog niet is ingelogd maar wel is uitgenodigd, houdt het label *uitgenodigd*. Sinds V39 staat er *uitnodiging mislukt* als die niet aankwam (§18). Bij inactieve collega's verandert er niets.
- **Bij een collega**, in het blok Inloggen: "Laatst ingelogd op di 6 okt om 14:05." of "Nog niet ingelogd.", in Nederlandse tijd.
- **In de export van een medewerker** (inzageverzoek): een regel *Laatst ingelogd*.

**Wat het wel en niet zegt**
- Het tijdstip komt uit Supabase Auth: de laatste keer dat iemand een code invulde. Collega's blijven daarna ingelogd. Het zegt dus niet wanneer iemand de app voor het laatst opende; dat houdt Planbord bewust niet bij.
- Of iemand Planbord op het beginscherm heeft gezet, ziet de server niet. *Meldingen aan* is het teken: op een iPhone kan dat alleen vanaf het beginscherm, op Android ook in Chrome zelf. Iets nieuws vastleggen (zoals het openen via het icoon) is niet gekozen.

**Privacy**
- Planbord slaat niets extra op. Het tijdstip staat al in Supabase Auth; het aantal toestellen met meldingen zagen beheerders al bij een medewerker (V28).
- Een nieuwe functie `public.employee_sign_ins()`: `security definer` met `set search_path = ''`. Alleen een beheerder mag haar aanroepen (anders een foutmelding), en ze geeft alleen de medewerker-id en het tijdstip, geen e-mailadressen. Geen secret key nodig.
- Alleen beheerders zien het. Het komt niet in het logboek: er verandert niets.
- Geen regel hierover in de uitleg; dat wilde de eigenaar niet ("Deze regel wil ik niet"). `CLAUDE.md` en de README zijn bijgewerkt.

**Handmatige stap**
- Draai `supabase/setup/fase-4.sql` opnieuw; dat is veilig. Tot dan toont Planbord deze gegevens niet, en de rest werkt gewoon.

---

## 18. Aanvulling: een eerlijke stand van de uitnodiging, en de oorzaak bij de testmail (V39)
De uitnodigingen kwamen niet aan, omdat de mailserver het app-wachtwoord weigerde. Planbord liet dat niet goed zien:
- in de lijst stond *uitgenodigd*;
- bij de collega stond "Planbord probeert het elk uur opnieuw", ook toen Planbord na drie pogingen was gestopt;
- **Iedereen uitnodigen** sloeg deze collega's over;
- de testmail noemde alleen alle instellingen tegelijk.

De eigenaar op het voorstel om dat te verbeteren: "ja bouw maar".

**De stand van de uitnodiging**
- Per collega telt de laatste uitnodiging.
- In de lijst met medewerkers:
  - verstuurd of klaar om te versturen: *uitgenodigd*;
  - mislukt: *uitnodiging mislukt*, in oranje.
- Bij de collega, als het mislukt is:
  - probeert Planbord het nog: "De uitnodiging is nog niet gelukt. Planbord probeert het elk uur opnieuw (nog 2 keer).";
  - is Planbord gestopt: "De uitnodiging is niet gelukt en Planbord probeert het niet meer. Doe eerst een testmail (Beheer → Instellingen); lukt die, stuur hem dan opnieuw."
- Planbord stopt na drie pogingen, of als de uitnodiging ouder is dan een week. Dat blijft zoals het was.

**Iedereen uitnodigen**
- Neemt nu ook wie een mislukte uitnodiging heeft, ook als Planbord het nog probeert. Na een storing hoef je dan niet per collega op **Opnieuw sturen** te drukken of op de volgende poging te wachten.
- Het blok noemt beide groepen, bijvoorbeeld: "2 collega's kunnen inloggen maar hebben nog geen uitnodiging gehad. Bij 3 collega's is de uitnodiging mislukt."
- Wie een uitnodiging heeft die verstuurd is of klaarstaat, krijgt geen nieuwe. Een nieuwe collega nodig je nog steeds los uit.

**Niemand krijgt hem twee keer**
- Stuur je een nieuwe uitnodiging, met Iedereen uitnodigen of met Opnieuw sturen, dan vervalt een oudere die nog openstond. Zo verstuurt de geplande taak de oude niet alsnog.
- Beheer → Mails toont de oude als *niet verstuurd: vervangen door een nieuwe*.
- Tot nu toe kon dat wel: wie tijdens een storing op Opnieuw sturen drukte, kreeg er later twee.

**De testmail zegt wat er mis is**
- Er ontbreekt een instelling in Vercel: de melding noemt welke, bijvoorbeeld `SMTP_PASSWORD`.
- De mailserver weigert het inloggen: maak een nieuw app-wachtwoord en zet het bij `SMTP_PASSWORD`.
- De mailserver is niet bereikbaar: controleer `SMTP_HOST` en `SMTP_PORT` (bij Google `smtp.gmail.com` en `465`).
- De mailserver weigert de mail: controleer `MAIL_FROM` en je eigen werkmail in Planbord.
- Gaat het om een instelling in Vercel, dan zegt de melding er ook bij dat je daarna een nieuwe deploy start (Redeploy). Pas dan gebruikt Planbord de nieuwe waarde.
- In Beheer → Mails staat bij een mislukte mail voortaan ook de oorzaak, bijvoorbeeld *inloggen bij mailserver geweigerd*.
- Nooit een adres, wachtwoord of de letterlijke melding van de mailserver: alleen het soort fout.

**Geen nieuwe gegevens**
- Geen migratie en geen handmatige stappen. De wachtrij had alles al: de stand, het aantal pogingen en een korte oorzaak.
- Een uitnodiging verandert geen gegevens, dus er komt niets in het logboek, zoals bij V33.
