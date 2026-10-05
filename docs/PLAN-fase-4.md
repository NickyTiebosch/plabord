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
