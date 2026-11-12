# Plan fase 5: fundament voor registraties, en de uitleen

**Status: goedgekeurd op 10 november 2026** ("verder akkoord"), met de aanpassingen hieronder. Gebouwd op 12 november 2026; zie de pull request. Dit plan bouwt voort op fase 1 tot en met 4. Het geheel staat in `docs/ROUTEKAART.md`; de vaste afspraken in `CLAUDE.md`.

## Besluiten
Alle voorstellen uit §1 (V41–V51) zijn aangenomen. Vier zijn aangevuld of aangepast:

| Vraag | Besluit |
|---|---|
| V42 | De eigenaar maakt het testproject zelf aan, in het Supabase-account van Planbord. Het moet gratis blijven: het gratis plan staat een tweede actief project toe als er in dat account nog plaats is. Supabase toont de prijs vóór het aanmaken. |
| V43 | De teamleider mag ook in het rooster helpen: afwezigheid invoeren, wijzigen en goedkeuren, en gaten regelen onder Nog te regelen. Vaste diensten, medewerkers en instellingen blijven bij de beheerder. |
| V45 | Bevestigd: verhuur geeft de auto's mee en registreert zelf. De werkplaats en Mobiliteit krijgen geen account. |
| V48 | Den Bosch, Eindhoven en Breda geven alle drie dagelijks auto's mee aan Mobiliteit. De 2 is een ondergrens voor de controle, geen maximum: verhuur kan altijd meer auto's aanmelden. De werkplaats krijgt voor spoedjes op zaterdag ook meerdere auto's mee. |

De tekst hieronder is op deze besluiten aangepast.

### Uitwerkingen tijdens de bouw (12 november 2026)
Keuzes die tijdens het bouwen zijn gemaakt, naast het plan:
- **Retour: tijdstip aanpasbaar.** Bij Retour · ingezet staan datum en tijd op nu, maar je kunt ze aanpassen, net als bij aanmelden. Retour · niet ingezet blijft één tik, met nu als tijdstip.
- **Opmerking bij retour apart.** De database bewaart de opmerking bij het meegeven (`note`) en die bij retour (`return_note`) los. In de export staan ze samen in de kolom Reden / opmerking.
- **Mails na een actie van een teamleider** verstuurt de server met de secret key. Een teamleider mag de werkmails en toestellen van collega's niet lezen, maar de collega moet wel de mail en de push krijgen. De actie zelf gaat met de sessie van de teamleider. `CLAUDE.md` noemt deze uitzondering.
- **Bij Let op** ziet de teamleider, net als de beheerder, of de mail over een vervallen inval nog wacht of mislukte. Daarvoor mag hij de mailwachtrij lezen; die bewaart geen adressen en geen tekst. De pagina Mails blijft voor de beheerder.
- **Roosterwijziging voor één dag** kan de teamleider ook via de naam in het rooster, zoals de beheerder. Dat hoort bij gaten regelen.
- **De controle telt pas vanaf de eerste uitleen** van een vestiging in Planbord. Dagen daarvoor staan als streepje, niet als rood. Zo staat bij de start niet alles rood.
- **De controle zet vandaag vooraan**, zodat op de telefoon zonder scrollen in beeld staat wat er nu speelt.
- **Corrigeren slaat alleen op wat echt verandert.** Een tijdstip zonder seconden geldt als ongewijzigd. Zo staat in het logboek alleen wat de teamleider aanpaste.
- **In het archief** kan de teamleider een retour ook ongedaan maken, bijvoorbeeld als een auto per ongeluk retour is gemeld.
- **Op een tablet** (smal scherm) staat in de kop, net als op de telefoon, Meer in plaats van Agenda (en voor de teamleider en beheerder ook Controle en Beheer). Op een breed scherm staat alles los.
- **De gegevensexport van een medewerker** (inzageverzoek) heeft een tabblad Uitleen: wat die medewerker meegaf of retour meldde, zonder aan wie en zonder opmerkingen. En een regel Teamleider.
- **De uitleg** heeft een onderwerp Een auto uitlenen, met alleen stappen. De PDF is niet opnieuw gemaakt; daar staat het nog niet in.
- **Open punt voor de test:** een collega die een verkeerd kenteken aanmeldt, kan dat niet zelf herstellen; dat doet de teamleider. Blijkt dat in de praktijk lastig, dan kunnen we degene die aanmeldde dat op dezelfde dag zelf laten corrigeren.

Fase 5 levert vier dingen:
1. een **aparte testomgeving**, zodat het live Planbord niet verandert tot jij akkoord geeft;
2. de rol **Teamleider**;
3. de tab **Registraties**, met als eerste onderdeel **Uitleen**: auto's die worden meegegeven aan Mobiliteit of aan de werkplaats voor het weekend;
4. de **export** van de uitleen en het **overdrachtsdocument**.

Wat niet in fase 5 komt:
- binnenvallers, meldingen en de invulcontrole per vestiging (fase 6);
- rapporten, signalen, de Uitloop en KPI's (fase 7 en 9 tot en met 11);
- accounts voor de werkplaats of voor Mobiliteit.

---

## 1. Vragen over bedrijfsregels

De nummering loopt door vanaf fase 4 (V23–V40). Bij elke vraag staat een voorstel. "Akkoord met je voorstellen" is genoeg; noem alleen de vragen waar je het anders wilt.

### V41. Planbord wordt breder dan rooster en verlof
- De spec en `CLAUDE.md` zeggen nu: Planbord is de rooster- en verlofapp, en "sla alleen op wat de planning nodig heeft".
- **Voorstel:**
  - de spec krijgt een hoofdstuk **Registraties** en een verwijzing naar de routekaart;
  - de privacyregel wordt: "Sla alleen op wat de planning en de registraties van het verhuurwerk nodig hebben." Voor de uitleen is dat: kenteken, model, kilometerstand, bestemming, aan wie de auto is meegegeven, wie hem meegaf en terugnam, de tijdstippen, ingezet ja of nee, en een korte opmerking;
  - nooit klantnamen of andere klantgegevens. Bij de opmerking staat: "Klantgegevens zijn niet nodig."

### V42. Een aparte testomgeving
- Nu delen de testlinks van Vercel en het live Planbord één database. Wat je op een testlink invoert, staat ook echt in live.
- **Voorstel:**
  - een tweede Supabase-project, **Planbord test**, alleen voor de testlinks;
  - de sleutels van dat project staan in Vercel alleen bij **Preview**. Production blijft wijzen naar de live database;
  - de testdatabase krijgt een verzonnen team (`supabase/setup/testdata.sql`), plus jouw eigen account als beheerder. Geen echte collega's;
  - de database-opzet van fase 5 draai je eerst alleen op de testdatabase. Pas bij de livegang draai je hem op live. De bundel voegt alleen toe, dus de huidige app merkt er niets van.
- **Gratis houden.** Het gratis plan van Supabase staat een tweede actief project toe als er in het account van Planbord nog plaats is. Supabase toont de prijs vóór het aanmaken. Een gratis project pauzeert na ongeveer een week zonder gebruik; je zet het met één klik weer aan.
- Het aanmaken is een handmatige stap voor jou (§8).

### V43. De rol Teamleider
- Nu bestaat alleen beheerder ja of nee. Een beheerder mag alles.
- **Voorstel:** een derde niveau, **Teamleider**, aan te vinken bij een medewerker. Een teamleider:

  | Mag wel | Mag niet |
  |---|---|
  | de controle zien, voor alle vestigingen | medewerkers, accounts en rechten beheren |
  | het archief en de export van de registraties | instellingen wijzigen |
  | een registratie van een collega corrigeren of verwijderen (komt in het logboek) | vaste diensten en sluitingsdagen wijzigen |
  | afwezigheid invoeren, wijzigen en goedkeuren | import, export van de planning, mails en logboek openen |
  | gaten regelen onder Nog te regelen: een invaller toewijzen, schuiven, zelf inspringen, een gat negeren | |
  | vanaf fase 7: de rapporten zien | |

- De regel "nooit toewijzen zonder akkoord van een beheerder" wordt: zonder akkoord van een beheerder of teamleider.
- De teamleider ziet daarvoor een beperkt Beheer: Overzicht, Afwezigheid en Invallen.
- Alleen een beheerder kan iemand teamleider maken.

### V44. De navigatie
- De tabbalk op de telefoon heeft nu vier tabs, plus Beheer voor beheerders. Een zesde tab past niet.
- **Voorstel:** de tabbalk wordt **Mijn rooster · Rooster · Verlof · Registraties · Meer**.
  - Onder **Meer** staan Agenda, Uitleg, en voor wie het mag: Controle en Beheer.
  - Agenda verhuist dus één tik verder. Collega's openen die pagina zelden: de agenda koppel je één keer.
- **Alternatief:** Agenda blijft een tab en Registraties komt onder Meer. Dan is de registratie een tik verder, terwijl die juist de hele dag wordt gebruikt.
- De wijziging is voor collega's pas zichtbaar bij de livegang.

### V45. Wie registreert de uitleen?
- Ik ga ervan uit dat verhuur de auto meegeeft en dus ook registreert: op een werkdag de twee auto's voor Mobiliteit, op vrijdag de auto's voor de werkplaats in het weekend. Na terugkomst meldt verhuur de auto retour.
- **Voorstel:**
  - iedere ingelogde collega kan een auto aanmelden en retour melden, ook voor een auto die een collega heeft aangemeld;
  - de werkplaats en Mobiliteit krijgen geen account. Wie een account heeft, ziet nu ook alle roosters en al het verlof, en dat is niet voor hen bedoeld.
- Klopt de aanname niet, en moet de werkplaats in het weekend zelf kunnen registreren? Dan wordt dat een aparte, beperkte rol in een latere fase.

### V46. Wat leg je vast bij het aanmelden?
Dit zijn de kolommen uit je omschrijving voor Copilot, met twee aanvullingen: het retourmoment en de kilometerstand bij retour.

| Veld | Hoe |
|---|---|
| Vestiging | staat op je eigen vestiging; aanpasbaar. Wie in een ondersteunende groep zit, kiest |
| Kenteken | vrij invullen. De app zet het in hoofdletters en haalt streepjes en spaties weg |
| Model auto | vrij invullen, bijvoorbeeld Polo of Transporter |
| Kilometerstand | vrij invullen, heel getal, mag leeg blijven |
| Datum en tijd | staan op nu; aanpasbaar |
| Bestemming | twee grote knoppen: **Mobiliteit** of **Werkplaats (weekend)** |
| Meegegeven aan | vrij invullen: de naam van de persoon of de afdeling |
| Meegegeven door | vult de app in: wie is ingelogd |
| Reden / opmerking | vrij invullen, kort, mag leeg blijven |

- **Opnieuw uitgeven.** Boven het formulier staan de auto's die de afgelopen 14 dagen door jouw vestiging zijn uitgeleend. Een tik vult kenteken, model, bestemming en "meegegeven aan" in. Voor de twee dagelijkse auto's van Mobiliteit is aanmelden dan twee tikken per auto.
- **Meerdere auto's.** Er is geen maximum. Na het opslaan staat er **Nog een auto aanmelden**: bestemming en "meegegeven aan" blijven dan ingevuld. Zo meld je op vrijdag in één keer de auto's aan die de werkplaats voor spoedjes op zaterdag meekrijgt.
- **Dubbel.** Een kenteken dat nog uitgeleend staat, kun je niet nog een keer aanmelden. De app zegt bij wie de auto staat.

### V47. Retour melden, ook als de auto niet is ingezet
- **Voorstel:** bij elke uitgeleende auto staan twee knoppen.
  - **Retour · ingezet:** de app vraagt de kilometerstand (mag leeg) en eventueel een opmerking, bijvoorbeeld "Pech onderweg".
  - **Retour · niet ingezet:** één tik, en klaar.
- Het tijdstip van retour staat op nu. Wie retour meldt, legt de app vast.
- Na retour staat de auto in het archief. Zowel ingezette als niet-ingezette auto's blijven bewaard.
- **Vergissing?** Wie retour meldde, kan dat dezelfde dag ongedaan maken of aanpassen. Daarna kan alleen een teamleider of beheerder corrigeren. Elke correctie komt in het logboek.

### V48. De controle op de uitleen
Voor beheerder en teamleider, onder Meer → Controle.
- **Voorstel:**
  - per vestiging stel je in hoeveel auto's Mobiliteit per werkdag minstens krijgt. Dat staat voor Den Bosch, Eindhoven en Breda op 2. Het is een ondergrens: "1 uitgegeven, minstens 2" is rood, 2 of meer is groen. Zet je het op 0, dan is er geen controle;
  - voor de werkplaats in het weekend geldt geen ondergrens: het aantal auto's wisselt;
  - een auto staat **te lang uit** als hij aan het eind van de eerstvolgende werkdag nog niet retour is gemeld. Voor Mobiliteit is dat de volgende werkdag, voor de werkplaats de maandag na het weekend. Sluitingsdagen tellen niet als werkdag;
  - de controle toont de laatste twee weken per vestiging, en bovenaan wat nu openstaat.

### V49. Hoe lang bewaren?
- **Voorstel:** een uitleenregistratie blijft 24 maanden bewaard en wordt daarna automatisch verwijderd. Zo kun je een jaar met het jaar ervoor vergelijken. Het logboek blijft op 12 maanden.
- Wil je langer of korter, noem het aantal maanden.

### V50. De export (de gratis versie)
- **Voorstel:** onder Beheer → Export, en voor de teamleider onder Registraties → Archief, een knop **Uitleen downloaden**. Het Excel-bestand heeft de opbouw uit je omschrijving:
  - tabblad **Registratie**: de auto's die nu uitgeleend zijn;
  - tabblad **Archief**: alles wat retour is, ingezet en niet ingezet;
  - de kolommen in jouw volgorde, met retourdatum, retourtijd en kilometerstand retour erachter;
  - blauwe koppen, datums als dd-mm-jjjj, tijden als uu:mm, geen keuzelijsten in vrije velden.
- Met dat bestand kan iemand zonder Planbord in Excel verder.

### V51. Overdraagbaarheid
- **Voorstel:** `docs/OVERDRACHT.md` beschrijft twee routes.
  - **Route A, de projecten overdragen.** Het Vercel-project, het Supabase-project en de GitHub-repository gaan naar accounts van het bedrijf. Gegevens en inlogaccounts blijven staan.
  - **Route B, opnieuw opzetten.** Het bedrijf maakt eigen projecten aan, zet de repository erop en zet een kopie van de database terug. Dat laatste is werk voor hun IT of leverancier.
  - Bij beide: de mailbox voor inlogcodes en meldingen, het adres van de app en de sleutels voor pushmeldingen vervangen door die van het bedrijf. Het document noemt elke instelling.
- **Dit wijkt af van wat ik eerder zei.** Ik noemde een eigen knop "Alles importeren". Die stel ik niet meer voor: een kopie van de database is betrouwbaarder dan een zelfgebouwde import, en neemt ook de inlogaccounts mee. De Excel-exports blijven, als gratis versie.
- De precieze stappen bij Vercel en Supabase controleer ik tegen hun actuele documentatie op het moment dat ik het document schrijf.

---

## 2. Keuzes die ik maak
Geen bedrijfsregels, wel goed om te weten. Zeg het als je iets anders wilt.

- **Namen.** In de app heet het onderdeel **Uitleen**. De adressen zijn `/registraties`, `/registraties/uitleen`, `/controle` en `/meer`.
- **Kenteken.** Opgeslagen zonder streepjes en in hoofdletters, zodat `GHP-39-K` en `ghp39k` dezelfde auto zijn. Zoeken werkt met en zonder streepjes. Buitenlandse kentekens kunnen ook: 2 tot 10 letters en cijfers.
- **Geen wagenlijst.** Er komt geen lijst van de vloot. Het model typ je, of je neemt het over via Opnieuw uitgeven.
- **Iedereen ziet alle uitgeleende auto's**, van alle vestigingen. Je eigen vestiging staat bovenaan.
- **Geen meldingen.** Fase 5 stuurt geen mail of push over de uitleen. De herinneringen komen in fase 6.
- **Logboek.** Aanmelden, retour en elke correctie komen in het logboek, zoals alles. Het logboek bewaart geen vrije tekst: niet de naam bij "meegegeven aan" en niet de opmerking.
- **De rol Teamleider.** Er komt een tweede controle bij, "beheerder of teamleider". Die geldt voor de nieuwe onderdelen en voor afwezigheid en invallen (V43). Alle andere controles op beheerder blijven zoals ze zijn.

---

## 3. Datamodel
Nieuwe migraties, gebundeld als `supabase/setup/fase-5.sql`. Alles is toevoegen; bestaande tabellen krijgen alleen een kolom erbij.

- **`employees.is_team_lead`** (boolean, standaard nee).
  - Alleen een beheerder mag de kolom zetten.
  - Nieuwe hulpfunctie `private.is_lead()`: beheerder of teamleider.
- **`groups.mobility_loans_per_day`** (klein getal, standaard 0, 0 tot 20): de ondergrens voor de controle. De seed zet Den Bosch, Eindhoven en Breda op 2. Alleen een beheerder wijzigt het.
- **`vehicle_loans`**, één rij per uitleen:

  | Kolom | Inhoud |
  |---|---|
  | `id` | uuid |
  | `group_id` | de vestiging; alleen vestigingen met een balie |
  | `license_plate` | genormaliseerd, 2–10 tekens |
  | `model` | tekst, 1–40 tekens |
  | `destination` | `mobility` of `workshop_weekend` |
  | `handed_to` | tekst, 1–60 tekens |
  | `handed_out_by` | medewerker |
  | `handed_out_at` | tijdstip |
  | `odometer_out` | heel getal of leeg |
  | `returned_at`, `returned_by` | leeg zolang de auto uit staat |
  | `odometer_in` | heel getal of leeg |
  | `was_used` | ja, nee, of leeg zolang de auto uit staat |
  | `note` | tekst, hooguit 200 tekens |

  - Regels in de database: retour kan niet vóór de uitgifte liggen; `was_used` is gevuld precies als `returned_at` gevuld is; de kilometerstand bij retour is niet lager dan bij uitgifte; per kenteken hooguit één open uitleen.
  - Wordt een medewerker volledig verwijderd, dan blijven zijn registraties staan zonder naam.
- **Rechten (RLS):**
  - lezen: iedere actieve medewerker;
  - aanmelden: iedere actieve medewerker, altijd op eigen naam;
  - retour melden: iedere actieve medewerker, via een functie die alleen de retourvelden zet op een open uitleen;
  - retour ongedaan maken of aanpassen: wie retour meldde, dezelfde dag; anders teamleider of beheerder;
  - overige correcties en verwijderen: teamleider of beheerder.
- **Rechten van de teamleider in het rooster (V43):** de policies voor schrijven op afwezigheid, invallen, roosterwijzigingen voor één dag en genegeerde gaten gaan van "beheerder" naar "beheerder of teamleider". Dat geldt ook voor de functies die bij Nog te regelen horen. De policies op medewerkers, accounts, vaste diensten, sluitingsdagen, instellingen en normen blijven alleen voor beheerders.
- **Logboek:** een trigger op `vehicle_loans` en de nieuwe kolommen bij `employees` en `groups`.
- **Opruimen:** registraties ouder dan 24 maanden verdwijnen in dezelfde opruimstap als het logboek.

---

## 4. Code
- **`src/lib/loans/`**, puur en getest, zonder database:
  - kenteken normaliseren en controleren;
  - invoer van aanmelden en retour valideren;
  - de status van een uitleen, en "te lang uit" met werkdagen en sluitingsdagen uit de bestaande engine;
  - de dagcontrole per vestiging;
  - de lijst voor Opnieuw uitgeven;
  - de rijen van de export.
- **`src/lib/auth/session.ts`**: `Viewer.isTeamLead`, en `requireLead()` en `requireLeadWith()` naast de bestaande functies. De pagina's en actions van Afwezigheid, Invallen en Nog te regelen gaan van `requireAdmin` naar `requireLead`; de rest van Beheer blijft `requireAdmin`.
- **`src/lib/db/`**: queries voor de uitleen en de controle; de typen bijgewerkt.
- **`src/lib/export/`**: het Excel-bestand van de uitleen.
- **Server actions** voor aanmelden, retour, ongedaan maken, corrigeren en verwijderen. Rechten twee keer gecontroleerd: in de action en via RLS.
- **Navigatie**: de tabbalk en de nieuwe pagina Meer.
- **Uitleg**: een onderwerp "Auto uitlenen" in `/uitleg`, alleen tekst. Een video kan later.

---

## 5. Schermen
Eerst ontworpen voor de telefoon, met grote knoppen.

- **Registraties → Uitleen** (`/registraties/uitleen`)
  - bovenaan de knop **Auto aanmelden**;
  - **Nu uitgeleend**: per auto het kenteken, het model, de bestemming, aan wie en sinds wanneer, met de twee retourknoppen. Je eigen vestiging eerst. Een auto die te lang uit staat, valt op;
  - **Vandaag retour**: wat vandaag is teruggekomen, met Ongedaan maken;
  - een link naar het archief.
- **Auto aanmelden** (`/registraties/uitleen/nieuw`): Opnieuw uitgeven bovenaan, daaronder het formulier uit V46.
- **Retour · ingezet** (`/registraties/uitleen/[id]/retour`): kilometerstand, opmerking, opslaan.
- **Archief** (`/registraties/uitleen/archief`): zoeken op kenteken, filteren op periode, vestiging, bestemming en ingezet. Voor teamleider en beheerder ook corrigeren, verwijderen en downloaden.
- **Meer** (`/meer`): Agenda, Uitleg, en voor wie het mag Controle en Beheer.
- **Controle** (`/controle`), voor teamleider en beheerder: de uitleen per vestiging per werkdag (V48).
- **Beheer**
  - voor de teamleider alleen Overzicht, Afwezigheid en Invallen;
  - Medewerkers: het vinkje Teamleider;
  - Instellingen: per vestiging het aantal auto's voor Mobiliteit per werkdag;
  - Export: Uitleen downloaden.

---

## 6. Testaanpak
- **Unit-tests** voor alles in `src/lib/loans/` en voor de export, met in ieder geval:
  - een kenteken met streepjes, spaties en kleine letters wordt hetzelfde kenteken;
  - retour ingezet en retour niet ingezet;
  - te lang uit: Mobiliteit op een gewone werkdag, de werkplaats over het weekend, en over een sluitingsdag heen;
  - de dagcontrole met norm 0, norm 2 en een dag met te weinig auto's;
  - Opnieuw uitgeven toont geen auto die nog uit staat;
  - de export heeft de afgesproken tabbladen en kolommen.
- **Databasetests** op PGlite:
  - RLS en grants van `vehicle_loans`, voor medewerker, teamleider, beheerder en niet-ingelogd;
  - een teamleider kan afwezigheid invoeren en een invaller toewijzen, maar geen medewerkers, accounts, instellingen, normen, sluitingsdagen of vaste diensten wijzigen;
  - een gewone medewerker kan nog steeds niets wijzigen in het rooster;
  - één open uitleen per kenteken;
  - de bundel `fase-5.sql` kan twee keer achter elkaar draaien;
  - de bestaande tests van fase 1 tot en met 4 blijven slagen.
- **Schermen:** ik loop ze door in een browser tegen een nagebootste Supabase. Jij test op de testlink, met het testlijstje uit de pull request.

---

## 7. Bouwvolgorde (kleine commits)
1. Spec, `CLAUDE.md` en README bijwerken (V41, V42).
2. `testdata.sql` met het verzonnen team.
3. Migratie en tests voor de rol Teamleider, met de rechten in het rooster (V43); het vinkje en het beperkte Beheer.
4. Navigatie: tabbalk en Meer.
5. Migratie en tests voor `vehicle_loans`.
6. `src/lib/loans/` met tests.
7. Schermen: uitleen, aanmelden, retour.
8. Archief, corrigeren en verwijderen.
9. Controle en de instelling per vestiging.
10. Export.
11. `docs/OVERDRACHT.md` en het onderwerp in de uitleg.
12. Bundel `fase-5.sql`, alle vier de controles, pull request.

---

## 8. Oplevering: handmatige stappen voor jou
Vóórdat je de testlink opent:
1. **Supabase:** een tweede project **Planbord test** aanmaken, in het account waar Planbord staat en in dezelfde EU-regio. Kies het gratis plan. De Auth-instellingen overnemen van live: registratie uit, inloggen met e-mailcode, het e-mailsjabloon en de SMTP-gegevens.
2. **SQL-editor van het testproject:** `fase-1.sql` tot en met `fase-5.sql` draaien, daarna `testdata.sql`.
3. **Jezelf beheerder maken** in het testproject, zoals in stap 5 van de README.
4. **Vercel → Environment Variables:** de drie Supabase-waarden van het testproject invullen bij **Preview**. Production niet aanraken.
5. De testlink uit de pull request openen en het testlijstje aflopen.

Bij de livegang, pas na jouw akkoord:
1. `fase-5.sql` draaien op de live database.
2. De pull request mergen.
3. Per vestiging het aantal auto's voor Mobiliteit instellen, en de teamleider aanvinken.

---

## 9. Risico's en aandachtspunten
- **Tot stap 4 van §8 wijzen testlinks nog naar live.** Open tot die tijd geen testlink om iets in te voeren.
- **De rol Teamleider raakt bestaande rechten.** De policies op afwezigheid en invallen worden vervangen. De bestaande tests van fase 1 tot en met 4 moeten blijven slagen, en er komen tests bij die bewijzen dat een gewone medewerker niets extra mag.
- **De navigatie verandert voor iedereen** bij de livegang (V44). Een korte mededeling aan het team volstaat.
- **Vrije tekst.** "Meegegeven aan" en de opmerking zijn vrije velden. De app kan niet tegenhouden dat iemand er iets in zet wat er niet hoort; de hint bij het veld en de bewaartermijn beperken dat.
- **Twee databases bijhouden.** Elke volgende fase draai je eerst op test en later op live. De pull request noemt steeds beide.
