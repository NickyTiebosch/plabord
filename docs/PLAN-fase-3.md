# Plan fase 3: de extra's

**Status: goedgekeurd op 2 oktober 2026** ("akkoord met je voorstellen"). Dit plan hoort bij de opdracht in `docs/SPEC.md` (fase 3) en bouwt voort op fase 1 en 2. De vaste afspraken staan in `CLAUDE.md`.

## Besluiten
V13 was al besloten. Alle voorstellen uit §1 (V14–V21) zijn aangenomen:

| Vraag | Besluit |
|---|---|
| V13 | Zelf afwezigheid aanvragen valt af: aanvragen gaan via MyHR. Geen status "afgewezen". |
| V14 | Directe mails bij een inval (ingezet of gaat niet door) en bij een roosterwijziging voor één dag, plus een herinnering de dag ervoor bij een afwijking. Geen mail bij afwezigheid, vaste diensten, sluitingsdagen of het verleden. Hooguit één mail per persoon per actie. |
| V15 | De herinnering komt om 16:00 de dag ervoor (maandag: zondag; zaterdag: vrijdag). Niet bij afwezigheid de hele dag of een gesloten vestiging. |
| V16 | Mailen via de Google Workspace-mailbox `info@22labs.nl` met een eigen app-wachtwoord, niet via Resend. |
| V17 | De geheime sleutel mag ook gebruikt worden voor de herinneringen. Directe mails gaan met de sessie van de beheerder. |
| V18 | Schakelaar "Mails versturen" in Instellingen, standaard uit. Testmail naar jezelf en een voorbeeld van de herinneringen voor morgen. |
| V19 | Is de mail aan de invaller verstuurd, dan is een vervallen inval vanzelf afgehandeld. |
| V20 | Twee exports in Excel: de planning (importformaat plus invallen en roosterwijzigingen) en de gegevens van één medewerker. Elke export in het logboek. |
| V21 | Volledig verwijderen alleen bij een inactieve medewerker, met een overzicht vooraf en de naam overtypen. Niet jezelf. Het logboek houdt alleen id's. |

De keuzes in §2 gelden zoals ze er staan.

Fase 3 levert drie dingen:
1. **Mails over je rooster.** Je krijgt een mail zodra je ergens invalt of je rooster voor een dag verandert. De dag ervoor krijg je een herinnering als je rooster die dag afwijkt van je vaste rooster.
2. **Export.** De planning downloaden als Excel-bestand, en alle gegevens van één medewerker.
3. **Een medewerker volledig verwijderen**, inclusief het inlogaccount.

Wat niet in fase 3 komt: **zelf afwezigheid aanvragen** (V13).

---

## 1. Vragen over bedrijfsregels

De nummering loopt door vanaf fase 2 (V6–V12). Bij elke vraag staat een voorstel. "Akkoord met je voorstellen" is genoeg.

### V13. Zelf afwezigheid aanvragen
De spec noemt het voor fase 3: medewerkers vragen zelf afwezigheid aan, en de beheerder keurt goed of af.
- **Besluit van de eigenaar (2 oktober 2026):** dit valt af. Aanvragen gaan via MyHR.
- In Planbord voert alleen een beheerder afwezigheid in, zoals nu. De statussen blijven "aangevraagd" en "goedgekeurd"; "afgewezen" komt er niet bij.

### V14. Welke mails, en wanneer?
De spec zegt: "e-mailmeldingen bij roosterwijzigingen en invallen". Jij vroeg ook om een mail de dag van tevoren.
- **Voorstel:** twee soorten mails.
  1. **Direct**, zodra een beheerder iets opslaat:
     - je wordt ingezet als invaller;
     - je inval gaat niet door, omdat hij is ingetrokken, niet meer nodig is of opnieuw geregeld moet worden. Ben je die dag zelf afwezig, dan krijg je deze mail niet;
     - je rooster voor één dag verandert: geen dienst, een andere dienst, verplaatst naar een andere dag, of terug naar je vaste dienst.
  2. **Een herinnering de dag ervoor** (V15), als je rooster die dag afwijkt van je vaste rooster: je valt ergens in, je hebt een andere dienst, of je hebt door een wijziging geen dienst.
- **Geen mail** bij:
  - afwezigheid, want die vraag je zelf aan in MyHR;
  - een andere vaste dienst, want die bespreek je vooraf;
  - sluitingsdagen;
  - wijzigingen voor een dag in het verleden.
- Eén actie geeft hooguit één mail per persoon. Verplaats je iemands dienst van maandag naar woensdag, dan krijgt die één mail met beide dagen.

### V15. Wanneer komt de herinnering?
- **Voorstel:**
  - om 16:00 de dag ervoor. Voor maandag is dat zondag, voor zaterdag vrijdag;
  - geen herinnering als je die dag de hele dag afwezig bent, of als je vestiging dicht is;
  - verandert er na 16:00 nog iets voor morgen, dan krijg je de directe mail uit V14.

### V16. Via welke mailserver?
De spec noemt Resend. Daarvoor moet je DNS-records toevoegen bij een domein, en dat wil je liever niet.
- **Voorstel:** de Google Workspace-mailbox `info@22labs.nl`, die nu ook de inlogcodes verstuurt.
  - Er verandert niets aan de DNS.
  - Je maakt een apart app-wachtwoord voor Planbord en zet dat in Netlify. Trek je het in, dan stopt alleen Planbord met mailen.
  - De daglimiet van Google ligt ver boven wat wij versturen: hooguit enkele tientallen mails per dag.

### V17. De geheime sleutel voor de herinnering
- Een directe mail verstuurt de app tijdens jouw actie, met jouw sessie als beheerder. Beheerders mogen werkmails al zien, dus de geheime sleutel is daarvoor niet nodig.
- De herinnering van 16:00 draait zonder dat iemand is ingelogd. Om de werkmails te lezen, heeft de server dan de geheime sleutel nodig.
- Dat is een nieuw doel. De privacyregels noemen nu alleen accounts, agendafeeds en een medewerker volledig verwijderen.
- **Voorstel:** sta het toe, alleen voor de herinnering. Ik zet het in `CLAUDE.md`. De sleutel blijft op de server.

### V18. Mails aan of uit, en eerst testen
De preview en de gewone app delen één database. Een wijziging die je in de preview test, zou dus een echte mail naar een collega sturen.
- **Voorstel:**
  - onder **Instellingen** komt een schakelaar **Mails versturen**. Na de installatie staat hij uit;
  - zolang hij uit staat, gaat er geen enkele mail naar een collega. De app houdt wel bij wat hij verstuurd zou hebben;
  - een knop **Testmail naar mij**. Die gaat alleen naar je eigen werkmail, ook als de schakelaar uit staat;
  - een voorbeeld van de herinneringen voor morgen: wie er een krijgt, en met welke tekst.

### V19. "Let op" en Afgehandeld
In fase 2 blijft een vervallen inval in **Let op** staan tot jij op **Afgehandeld** klikt. Dat was nodig omdat jij het de invaller zelf moest laten weten.
- **Voorstel:** is de mail aan de invaller verstuurd, dan is de inval vanzelf afgehandeld en verdwijnt hij uit Let op.
- Lukt de mail niet, of heeft de invaller geen werkmail, dan blijft hij staan, met de reden erbij.

### V20. Wat moet "export" doen?
De spec noemt export bij het beheer, naast de import en het logboek, maar zegt niet wat erin moet.
- **Voorstel:** twee downloads, allebei een Excel-bestand.
  1. **Planning exporteren** (Beheer → Export). Handig als reservekopie of om in Excel te bekijken.
     - De tabbladen en koppen van de import: Medewerkers, Vaste roosters en Afwezigheid. Daarnaast de tabbladen Invallen en Roosterwijzigingen.
     - Bij Vaste roosters staan de diensten die nu gelden en die nog komen. Een extra kolom "Geldig tot (info)" zegt tot wanneer.
     - De werkmail staat erin, want die hoort bij het importformaat. Bewaar het bestand daarom zorgvuldig.
  2. **Gegevens van één medewerker** (op de pagina van die medewerker). Daarin staat alles wat Planbord over die persoon bewaart, ook eerdere vaste diensten en de logboekregels over hem.
     - Zo kun je een inzageverzoek volgens de AVG beantwoorden.
     - Agendalinks staan erin als "actief sinds …", zonder de geheime link zelf.
- Alleen beheerders kunnen exporteren. Elke export komt in het logboek: wie, wanneer en welke export.

### V21. Een medewerker volledig verwijderen
- **Voorstel:**
  - het kan alleen als de medewerker eerst op **inactief** staat. Zo verwijder je nooit per ongeluk iemand die nog werkt;
  - je ziet eerst wat er verdwijnt: vaste diensten, afwezigheid, invallen, roosterwijzigingen, agendalinks en het inlogaccount. Staan er nog invallen in de toekomst, dan zie je dat die gaten terugkomen in Nog te regelen;
  - je kunt eerst de gegevens downloaden (V20);
  - je bevestigt door de naam over te typen;
  - het logboek houdt zijn regels. Daarin staan alleen id's, geen namen. Bij die regels staat daarna "verwijderde medewerker";
  - er komt één logboekregel bij: wie de medewerker wanneer verwijderde;
  - jezelf verwijderen kan niet.

---

## 2. Keuzes die ik maak

**Inhoud van de mails**
- Alleen je eigen rooster: geen namen van collega's, geen reden en geen andere e-mailadressen.
- Onderwerp bijvoorbeeld: "Planbord: je rooster voor wo 15 okt".
- De mail zegt wat er veranderd is en hoe die dag er nu uitziet, in de woorden van Mijn rooster. Bijvoorbeeld: "wo 15 okt: invallen in Eindhoven, 13:00–18:00". Met een link naar Mijn rooster.
- Gewone tekst met een eenvoudige opmaak. Geen plaatjes, geen trackers en geen leesbevestiging.
- De afzender is "Planbord", met het adres uit `MAIL_FROM`.
- Wie geen werkmail heeft, krijgt geen mail.

**Versturen**
- De app zet een mail eerst in een wachtrij en verstuurt hem meteen. Mislukt dat, dan probeert hij het elk uur opnieuw, hooguit drie keer.
- In de wachtrij staan geen e-mailadressen en geen tekst. Er staat alleen in voor wie, over welke dag(en), welk soort mail en de status.
- De tekst maakt de app pas bij het versturen, met het rooster van dat moment. Een nieuwe poging stuurt dus nooit verouderde informatie.
- Een herinnering gaat per persoon per dag hooguit één keer weg. De database bewaakt dat.
- Elk uur draait een geplande taak op Netlify. Die verstuurt om 16:00 de herinneringen en probeert mislukte mails opnieuw.
  - Zo'n taak draait alleen op de gewone app, niet op een preview.
  - De taak roept een beveiligde route in de app aan, met het geheim `CRON_SECRET`. Zonder dat geheim gebeurt er niets.
- De taak ruimt regels in de wachtrij op die ouder zijn dan 90 dagen. Het is geen planning, dus we bewaren het niet langer dan nodig. Dit is de enige automatische opruiming, en ze staat hier expliciet.

**Beheer → Mails**
- Een lijst van de mails van de laatste 30 dagen: wanneer, aan wie, over welke dag en de status. De status is "verstuurd", "mislukt" of "niet verstuurd" (mails uit, of geen werkmail).
- Er staan namen in, geen e-mailadressen en geen inhoud.

**Export**
- Gemaakt met `write-excel-file`, net als het sjabloon van de import.
- Datums als d-m-jjjj en tijden als uu:mm, zoals in de import.
- De opbouw van de rijen zit in pure functies met tests.

**Volledig verwijderen**
- Eerst het inlogaccount bij Supabase, met de geheime sleutel; de spec staat dat toe. Daarna de medewerker met alles wat erbij hoort, in één transactie. Lukt het eerste niet, dan gebeurt er niets.
- De rechten worden twee keer gecontroleerd: in de server action en in de databasefunctie.

**Wie ziet wat**
- De wachtrij, Beheer → Mails, de exports en het verwijderen zijn alleen voor beheerders.
- Een medewerker ziet zijn eigen mails in zijn mailbox, en verder niets nieuws.

**Branch:** fase 3 staat op een eigen branch, `claude/planbord-fase-3`, met een eigen pull request.

---

## 3. Datamodel

RLS staat aan op elke nieuwe tabel. Eerst `revoke all` voor `anon` en `authenticated`, daarna expliciete grants. `anon` krijgt niets.

**Nieuwe tabel `mail_queue`** (de wachtrij)

| Kolom | Type | Uitleg |
|---|---|---|
| `id` | uuid | |
| `employee_id` | uuid | de ontvanger. Verdwijnt mee als de medewerker wordt verwijderd |
| `kind` | text | `substitution`, `day_change`, `reminder` of `test` |
| `dates` | date[] | de dag of dagen waar de mail over gaat |
| `status` | text | `pending`, `sent`, `failed` of `skipped` (mails uit, of geen werkmail) |
| `attempts` | smallint | het aantal pogingen |
| `last_error` | text | een korte foutcode, zonder adres of inhoud |
| `created_at`, `sent_at` | timestamptz | |

- Een herinnering is uniek per medewerker per dag.
- Lezen: alleen beheerders. Schrijven: beheerders via hun sessie, en de geplande taak via de geheime sleutel (V17).
- Geen logboektrigger: een mail is geen wijziging van de planning. Beheer → Mails laat ze zien.

**Instellingen:** een nieuwe kolom `mail_enabled`, standaard uit (V18). Aan- en uitzetten komt in het logboek.

**Functies**
- `delete_employee(employee_id)` verwijdert een medewerker. Hij controleert eerst drie dingen: jij bent beheerder, de medewerker is inactief, en het ben je niet zelf. Al het andere gaat mee via de bestaande `on delete cascade`. Daarna schrijft hij één logboekregel.
- `log_export(kind, employee_id)` schrijft een logboekregel voor een export.

**Migraties en bundel**
- Nieuwe bestanden in `supabase/migrations/`, vanaf `20261003000100_…`.
- De bundel `supabase/setup/fase-3.sql` draai je ná `fase-1.sql` en `fase-2.sql`. Hij is herhaalbaar en voegt alleen toe. Je kunt hem dus al draaien vóór de merge; de app van fase 2 merkt er niets van.

---

## 4. Code

| Waar | Wat |
|---|---|
| `src/lib/mail/` (puur) | wie er een mail of herinnering krijgt, de tekst van elke mail, en wanneer een herinnering aan de beurt is: 16:00 in Europe/Amsterdam, ook rond de wisseling van zomer- en wintertijd |
| `src/lib/mail/send.ts` | versturen via SMTP met `nodemailer`. Leest de instellingen pas bij het versturen en begint met `import 'server-only'` |
| `src/lib/export/` (puur) | de rijen van beide exports |
| `src/app/taken/herinneringen/route.ts` | de beveiligde route die de geplande taak elk uur aanroept |
| `netlify/functions/herinneringen.mts` | de geplande taak zelf: elk uur, roept de route aan met `CRON_SECRET` |

- Nieuwe afhankelijkheid: `nodemailer`. Die wordt actief onderhouden en heeft zelf geen afhankelijkheden.
- De pure functies hebben geen databasetoegang en geen `Date.now()`. "Nu" komt binnen als parameter.
- Na je akkoord werk ik `CLAUDE.md` bij: de stack, de nieuwe omgevingsvariabelen, het extra doel van de geheime sleutel (V17) en de regels voor mails.

---

## 5. Schermen

**Voor beheerders**
- **Instellingen:** de schakelaar Mails versturen, de knop Testmail naar mij, en het voorbeeld van de herinneringen voor morgen (V18).
- **Beheer → Mails:** de lijst van de laatste 30 dagen.
- **Beheer → Export:** de knop Planning exporteren.
- **Pagina van een medewerker:** Gegevens downloaden, en onderaan Volledig verwijderen. Die knop staat er alleen bij een inactieve medewerker.
- **Overzicht → Let op:** bij een vervallen inval staat of de mail is verstuurd (V19).
- Na inzetten of een roosterwijziging zegt de melding of de mail is verstuurd, bijvoorbeeld "Inval opgeslagen. Mail verstuurd naar Danique."

**Voor iedereen** verandert er niets in de app. De mails komen in je eigen mailbox.

---

## 6. Testaanpak

**Pure functies** (Vitest, met de fictieve teamfixture):
- wie morgen een afwijking heeft: invallen, een andere dienst, geen dienst of verplaatst. Niet bij afwezigheid of een gesloten vestiging;
- het tijdstip: 16:00 in Amsterdam, ook rond de wisseling van zomer- en wintertijd, en maandag via zondag;
- de tekst van elke mail: alleen eigen gegevens, geen namen of adressen van anderen;
- één mail per persoon per actie;
- de rijen van beide exports, en dat de planning-export dezelfde koppen heeft als de import;
- het overzicht van wat er verdwijnt bij volledig verwijderen.

**Database** (PGlite):
- RLS en grants van `mail_queue`. Een medewerker ziet de wachtrij niet, en `anon` kan niets;
- een herinnering kan maar één keer per persoon per dag;
- `delete_employee`: alleen beheerders, alleen inactieve medewerkers, en niet jezelf. Alles verdwijnt via cascade, en het logboek houdt alleen id's;
- `fase-1.sql`, `fase-2.sql` en `fase-3.sql`, elk twee keer achter elkaar, met en zonder automatische rechten.

**Versturen:** tegen een nagebootste mailserver. In de tests gaat nooit een echte mail weg.

**Schermen:** zoals in fase 1 en 2. Zelf loop ik ze door in een browser, tegen een nagebootste Supabase en een nagebootste mailserver. Jij test via de preview, met Mails versturen uit.

---

## 7. Bouwvolgorde (kleine commits)
1. Migraties, de bundel en de databasetests.
2. Pure mailfuncties: afwijkingen, teksten en het tijdstip.
3. De wachtrij en het versturen. Directe mails bij inzetten, intrekken, de controle op invallen en roosterwijzigingen. Let op (V19).
4. Herinneringen: de route en de geplande taak.
5. Instellingen (schakelaar, testmail en voorbeeld) en Beheer → Mails.
6. Export: de planning en de gegevens van één medewerker.
7. Volledig verwijderen.
8. Afronden: README, `CLAUDE.md`, `supabase/setup/fase-3.sql`, en de PR met handmatige stappen en testlijst.

---

## 8. Oplevering: handmatige stappen voor jou
1. **Supabase → SQL Editor:** draai `supabase/setup/fase-3.sql`.
2. **Google:** maak een app-wachtwoord voor `info@22labs.nl`, alleen voor Planbord. De README legt uit waar.
3. **Netlify → Environment variables:**
   - `SMTP_HOST` = `smtp.gmail.com` en `SMTP_PORT` = `465`;
   - `SMTP_USER` = `info@22labs.nl` en `SMTP_PASSWORD` = het app-wachtwoord;
   - `MAIL_FROM` = `Planbord <info@22labs.nl>`;
   - `CRON_SECRET` = een lange willekeurige tekst. De README legt uit hoe je die maakt;
   - `SITE_URL` = het adres van de app, voor de link in de mail.
4. **In Planbord:** stuur eerst een testmail naar jezelf en bekijk het voorbeeld voor morgen. Zet daarna pas **Mails versturen** aan.

---

## 9. Risico's en aandachtspunten
- **Eén database voor preview en productie.** Daarom staan mails standaard uit (V18).
- **De geplande taak draait alleen op de gewone app.** In de preview test je met de testmail en het voorbeeld. De echte herinnering zie je pas na de merge.
- **Google kan het versturen blokkeren**, bijvoorbeeld als het app-wachtwoord is ingetrokken. Dan mislukken de mails: Beheer → Mails laat dat zien, en een vervallen inval blijft in Let op staan.
- **Spam.** Mails van een eigen Google Workspace-adres komen meestal goed aan. Belandt er toch een in de spam, vraag collega's dan het adres aan hun contacten toe te voegen.
- **Volledig verwijderen kan niet ongedaan worden gemaakt.** Daarom kan het alleen bij een inactieve medewerker, met een overzicht vooraf en de naam overtypen. Download eventueel eerst de gegevens.
