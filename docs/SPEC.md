# Opdracht: bouw "Planbord", een rooster- en verlofapp voor ons verhuurteam

Doel: een webapp waarin medewerkers inloggen en hun eigen rooster, de roosters van de vestigingen en het verlofoverzicht zien. Ik ben beheerder en voer afwezigheid in. De app rekent het rooster uit, ziet waar te weinig mensen aan de balie staan en stelt een invaller voor. Dit vervangt onze Excel-vakantieplanning.

## Werkwijze (lees eerst)
1. Sla deze opdracht letterlijk op als `docs/SPEC.md`. Maak een `CLAUDE.md` met de vaste afspraken: stack, commando's, privacyregels, teststrategie en wat wel en niet mag.
2. Maak een plan voor **fase 1**: mappenstructuur, datamodel en migraties, schermen en routes, en testaanpak. Leg het voor en wacht op mijn akkoord voordat je code schrijft. Is een bedrijfsregel onduidelijk, vraag het dan; maak geen stille aannames.
3. Werk per fase op een eigen branch, in kleine commits. De scripts `lint`, `typecheck`, `test` en `build` moeten alle vier slagen vóór elke push.
4. Sluit elke fase af met een pull request. Zet daarin een samenvatting, de handmatige stappen voor mij (SQL, instellingen, omgevingsvariabelen) en een testlijstje. Stop dan en wacht tot ik zeg "ga verder met fase X".

## Ons team
- Zes groepen:
  - **vestigingen met een balie:** Den Bosch, Eindhoven en Breda;
  - **ondersteunend, zonder balie:** Logistiek, Backoffice en Overig (onder meer leidinggevenden).
- Ongeveer 20 medewerkers. Iedereen mag alle roosters en alle afwezigheid zien; alleen beheerders wijzigen iets. Er komt een tweede beheerder.
- De balie is ma–vr open van 07:30 tot 18:00, op alle drie de vestigingen.
- Norm: minimaal 2 mensen aan de balie per vestiging, ma–vr, 's ochtends én 's middags. Op zaterdag geldt geen norm.
- Rollen: balie, backoffice, transport, poets, of geen rol. **Alleen de rol balie telt mee** voor de bezetting.
- Verlof wordt officieel geregistreerd in MyHR, ons HR-systeem. Deze app is de planning ernaast en koppelt niet met MyHR.
- De app wordt vooral op de telefoon gebruikt. Simpel, snel en betrouwbaar gaat voor alles.

## Techniek
- Next.js (App Router), TypeScript (strict) en Tailwind CSS, in actuele stabiele versies.
- Supabase voor Auth, Postgres en Row Level Security, in een EU-regio.
- Hosting op Vercel, in het betaalde team van 22labs, gekoppeld aan deze repo, met de server in Frankfurt. Eerder stond hier Netlify, omdat het gratis plan van Vercel alleen voor niet-commercieel gebruik is; met het betaalde team geldt dat niet (gewijzigd op 6 oktober 2026, besluit V32).
- Code, tabel- en variabelenamen in het Engels; alle tekst in de app in het Nederlands.
- Tijdzone overal Europe/Amsterdam. Datums als "di 14 okt", tijden 24-uurs.
- Mobile-first en installeerbaar op het beginscherm (manifest en iconen). Een offline-modus is niet nodig.
- Geen trackers of analytics, en geen AI of taalmodel in de roosterlogica.
- Laat pagina's niet indexeren (noindex).

## Beperkingen van deze ontwikkelomgeving
- Je werkt in een cloudomgeving zonder toegang tot mijn Supabase-database. Ik test via de previewlink van Vercel.
- Schrijf databasewijzigingen als migraties in `supabase/migrations/`.
- Lever per fase ook één gebundeld bestand, bijvoorbeeld `supabase/setup/fase-1.sql`, dat ik in één keer in de SQL-editor kan plakken. Maak de SQL waar mogelijk herhaalbaar (`if not exists`).
- Geef in de migraties expliciet GRANTs aan `authenticated`, en aan `anon` alleen waar echt nodig. Vertrouw niet op standaardrechten.
- Zet alle rooster- en vervangingslogica in pure TypeScript-functies zonder databasetoegang (`src/lib/engine/`), zodat je ze hier volledig kunt testen met Vitest.
- De build moet ook slagen zonder echte sleutels: lees omgevingsvariabelen pas uit op het moment dat je ze gebruikt.

## Privacy (harde regels)
- Sla alleen op wat de planning nodig heeft: naam, werkmail, groep, rol, waar iemand mag invallen, vaste diensten, afwezigheid en invallen.
- Afwezigheid heeft géén reden of soort. Vakantie, training en ziekte heten allemaal "Afwezig". Geen vrij tekstveld bij afwezigheid.
- E-mailadressen zijn alleen zichtbaar voor beheerders en voor de medewerker zelf.
- RLS op élke tabel.
- De service-role/secret key staat alleen op de server, nooit in de client-bundel. Gebruik hem alleen voor: accounts aanmaken, agendafeeds serveren en een medewerker volledig verwijderen.
- Echte medewerkergegevens komen nooit in de repo. Testdata en fixtures zijn fictief.
- Houd een logboek van wijzigingen bij (wie, wat, wanneer), zonder gevoelige inhoud en alleen zichtbaar voor beheerders.

## Domeinmodel
- **Rooster = vaste diensten + uitzonderingen.** Weekroosters worden nooit opgeslagen of gekopieerd, maar per datum berekend.
- **Vaste dienst**:
  - medewerker en weekdag (ma–za);
  - groep én rol voor die dag. Iemand kan dus di/do aan de balie in Den Bosch staan en wo/vr transport doen;
  - begin- en eindtijd. Leeg betekent de standaarddienst 07:30–18:00;
  - geldig vanaf/tot. Een nieuwe vaste dienst vanaf een datum verandert het verleden niet.
- **Medewerker**:
  - naam en werkmail. De werkmail mag leeg zijn: dan staat iemand wel in de roosters, maar kan hij nog niet inloggen;
  - groep en standaardrol;
  - **inzetbaar aan de balie in**: een lijst vestigingen;
  - beheerder ja/nee en actief ja/nee.

  Iemand zonder vaste diensten staat wel in het verlofoverzicht, maar niet in de roosters.
- **Afwezigheid**:
  - medewerker en van–tot;
  - dagdeel: hele dag, ochtend of middag. Een halve dag kan alleen bij één dag;
  - **status**: aangevraagd (nog niet verwerkt in MyHR) of goedgekeurd. Beide tellen als afwezig. Toon aangevraagd lichter of gestreept; de beheerder zet het met één klik op goedgekeurd.
- **Sluitingsdagen**, elk jaar:
  - Nieuwjaarsdag, 1e en 2e paasdag, Koningsdag, Bevrijdingsdag, Hemelvaartsdag, 1e en 2e Pinksterdag, 1e en 2e kerstdag;
  - bereken ze, ook de dagen die van Pasen afhangen;
  - Oudjaarsdag is een gewone werkdag;
  - aanpasbaar per jaar en per vestiging.
- **Dagdelen**: ochtend en middag, met een instelbare grens (standaard 13:00). Iemand telt mee in een dagdeel als zijn dienst dat dagdeel overlapt en hij dan niet afwezig is.
- **Inval**: medewerker, datum, dagdeel(en) en vestiging. In die dagdelen staat hij gemarkeerd als "ingeleend" in het rooster van die vestiging en telt hij daar mee aan de balie. Bij zijn eigen groep telt hij dan niet mee.
- **Instellingen**:
  - norm per vestiging, per weekdag, per dagdeel;
  - standaarddienst en dagdeelgrens;
  - invalvolgorde per groep;
  - vooruitkijktermijn van "Nog te regelen" (standaard 8 weken).

  Zet de waarden uit deze opdracht als seed.

## Schermen
**Voor iedereen (na inloggen)**
- **Mijn rooster** (startpagina): de komende 6 weken per dag, met groep of vestiging, tijden en eigen afwezigheid. Afwijkingen vallen op, bijvoorbeeld "Invallen in Eindhoven".
- **Vestigingsrooster**: weekweergave met tabs Den Bosch, Eindhoven, Breda en Ondersteunend. Toont per dag wie er werkt, wie is ingeleend en wie afwezig is. Vanaf fase 2 ook de bezetting per dagdeel tegen de norm, met onderbezetting in rood.
- **Verlofoverzicht**: tijdlijn per maand, kwartaal of jaar.
  - Rijen per medewerker, gegroepeerd per groep, met balken voor afwezigheid (aangevraagd gestreept).
  - Per week per vestiging een teller "x van y afwezig".
- **Agenda**: de persoonlijke agendalink, plus knoppen voor de vestigingsagenda's en de verlofagenda. Met korte uitleg voor iPhone, Outlook en Google Agenda.

**Voor beheerders**
- **Overzicht**: "Nog te regelen" (gaten in de komende weken, met voorstellen), openstaande aanvragen en wie er deze week afwezig is.
- Afwezigheid invoeren, wijzigen en verwijderen via een snel formulier. Vanaf fase 2 met impactcheck.
- Beheer van medewerkers (inclusief accounts), vaste diensten, sluitingsdagen en instellingen.
- Excel-import, logboek en export.

## Inloggen
- Inloggen met een 6-cijferige code per e-mail (e-mail-OTP), géén magic link. Bedrijfsmailscanners openen links soms automatisch en maken ze dan ongeldig.
- Geen open registratie. Alleen adressen die een beheerder heeft toegevoegd kunnen inloggen (`shouldCreateUser: false`).
- Accounts maak je aan via de admin-API in een server action, met een bevestigd e-mailadres.
- Op je eigen telefoon lang ingelogd blijven.

## Excel-import
Eén .xlsx-bestand met drie tabbladen. De app biedt hetzelfde bestand leeg aan als sjabloon. De kopnamen zijn precies:
- **Medewerkers**: Naam, E-mail, Groep, Rol, Inzetbaar aan de balie in (vestigingen, gescheiden door komma's), Beheerder (ja/nee).
- **Vaste roosters**: Naam, Dag (ma–za), Groep, Rol, Begintijd, Eindtijd, Geldig vanaf. Lege tijden betekent de standaarddienst.
- **Afwezigheid**: Naam, Van, Tot, Dagdeel (hele dag/ochtend/middag), Status (goedgekeurd/aangevraagd).

Regels voor de import:
- Negeer andere tabbladen (zoals Uitleg en Controle) en kolommen met "(info)" in de kop.
- Datums zijn echte Excel-datums of d-m-jjjj. Tijden zijn een Excel-tijd of uu:mm.
- Match namen zonder op hoofdletters te letten en zonder spaties aan het begin of eind.
- Toon eerst een voorvertoning met fouten per regel. Sla pas op na bevestiging.
- Maak accounts aan voor iedereen met een e-mailadres.
- Opnieuw importeren maakt geen dubbelingen. Een medewerker is uniek op e-mail (of op naam als de e-mail leeg is), een afwezigheid op naam + van + tot + dagdeel.
- Lees het bestand op de server in, maximaal 2 MB, met een onderhouden bibliotheek (bijvoorbeeld exceljs).

## Agendakoppeling (ICS-feeds)
- Drie soorten feeds:
  - persoonlijk: eigen diensten, invallen en afwezigheid;
  - per vestiging: wie werkt wanneer;
  - team-verlof: wie is afwezig.
- Bereik: 30 dagen terug tot 26 weken vooruit.
- De URL bevat een geheim token van minstens 32 willekeurige bytes. Sla alleen een hash op. Medewerker en beheerder kunnen een link intrekken en een nieuwe maken.
- Geldige iCalendar-uitvoer:
  - `VTIMEZONE` voor Europe/Amsterdam;
  - stabiele `UID`'s en `DTSTAMP`;
  - correcte escaping en regelafbreking op 75 octets;
  - `X-WR-CALNAME`, en `REFRESH-INTERVAL` en `X-PUBLISHED-TTL` van 1 uur;
  - Content-Type `text/calendar; charset=utf-8`;
  - afwezigheid als hele-dag-event.
- Minimale inhoud, zoals "Dienst Den Bosch 07:30–18:00", "Invallen Eindhoven" of "Afwezig: Sanne". Geen e-mailadressen.
- Knop "Toevoegen aan agenda" met een `webcal://`-link (op de iPhone één tik) en de https-link om te kopiëren.
- Leg in de app uit dat je de link in Google Agenda en Outlook één keer via de computer toevoegt, en dat die apps wijzigingen soms pas na uren tonen.

## Vervangingsengine (fase 2)
De engine werkt voorspelbaar en kan elke keuze uitleggen: dezelfde gegevens geven altijd dezelfde uitkomst. Hij krijgt een momentopname van alle gegevens en levert het berekende rooster, de bezetting, de gaten en de voorstellen.
1. **Gat**: een vestiging zit in een dagdeel onder de norm. Geen gat betekent geen actie.
2. **Kandidaat**: iemand voldoet aan alle voorwaarden:
   - inzetbaar aan de balie in die vestiging;
   - die dag de hele dag ingeroosterd, niet (ook niet half) afwezig en nog niet ergens ingeleend;
   - nooit rol poets;
   - komt hij uit een andere vestiging, dan moet die vestiging zonder hem nog aan de norm voldoen in de dagdelen van de inval.

   Voor de volgorde en de normcheck tellen de groep en rol van die dag, uit de vaste dienst.
3. **Volgorde**, per groep instelbaar. Standaard zoals het team nu werkt:
   1. Backoffice;
   2. Overig;
   3. baliemedewerker van een andere vestiging;
   4. Logistiek.

   Binnen een groep eerst wie in de laatste 90 dagen het minst is ingevallen, daarna op naam.
4. **Voorstel**: de top-3 kandidaten, elk met een Nederlandse uitlegregel. Bijvoorbeeld: "Danique (backoffice): werkt die dag en mag in Eindhoven invallen; 1× ingevallen in 90 dagen."
5. **Stroom**:
   1. De beheerder kiest een voorstel of een andere geldige kandidaat, of negeert het gat.
   2. De inval staat daarna meteen in beide roosters.

   Wijs nooit toe zonder akkoord van de beheerder.
6. **Impactcheck**: bij het invoeren of wijzigen van afwezigheid draait de engine vóór het opslaan. Hij toont welke dagdelen onder de norm zakken en of er een voorstel is. Opslaan mag altijd.
7. **Achterhaalde invallen**: wordt een afwezigheid gewijzigd of verwijderd, dan krijgt de inval de status "niet meer nodig". Is de invaller zelf afwezig, dan wordt het "opnieuw regelen" en komt het gat terug in Nog te regelen. Verwijder nooit iets stilletjes.

## Fasering
**Fase 1: vervangt de Excel**
- Inloggen, rollen en RLS.
- Groepen, instellingen (met seed), medewerkers en accounts.
- Vaste diensten en roosterberekening.
- Afwezigheid met status, en sluitingsdagen.
- De schermen Mijn rooster, Vestigingsrooster, Verlofoverzicht en Agenda.
- Excel-import met sjabloon, agendafeeds en logboek.
- Installeerbaar op het beginscherm.

**Fase 2: het brein**
- Dagdelen en norm, bezetting in het vestigingsrooster, gaten en Nog te regelen.
- Vervangingsengine, voorstellen en invallen toewijzen, impactcheck.
- Handmatige roosterwijzigingen: een dienst toevoegen, verwijderen of verplaatsen.

**Fase 3: extra's**
- E-mailmeldingen via Resend bij roosterwijzigingen en invallen.
- Medewerkers vragen zelf afwezigheid aan (aangevraagd → goedgekeurd of afgewezen), met een directe check of er ruimte is.
- Export en het volledig verwijderen van een medewerker.

## Tests (minimaal)
Unit-tests voor de engine, de roosterberekening en de import, met in ieder geval deze gevallen:
- vaste diensten met geldig vanaf/tot; een nieuwe dienst laat het verleden ongemoeid;
- alleen de rol balie telt mee; iemand met di/do balie en wo/vr transport telt alleen op di/do mee;
- een halve dag afwezig telt per dagdeel; beide statussen tellen als afwezig;
- een sluitingsdag geeft geen diensten en geen gaten; Oudjaarsdag is een gewone werkdag;
- afwezigheid geeft alleen een gat als de norm echt wordt onderschreden;
- de kandidaatvolgorde klopt;
- rol poets wordt nooit voorgesteld;
- iemand die niet inzetbaar is op die vestiging valt af;
- een kandidaat uit een andere vestiging komt alleen in aanmerking als die vestiging op norm blijft;
- een inval telt mee op de nieuwe vestiging en niet bij de eigen groep;
- gelijkwaardige kandidaten staan altijd in dezelfde volgorde;
- een gewijzigde afwezigheid maakt de inval "niet meer nodig";
- import: Excel-datums en d-m-jjjj worden goed gelezen, "(info)"-kolommen genegeerd, fouten per regel getoond, en opnieuw importeren maakt geen dubbelingen;
- de ICS-uitvoer heeft een geldige structuur, escaping, regelafbreking en tijdzone.

Gebruik fictieve testdata met dezelfde opbouw als ons team:
- 3 vestigingen met elk 3–4 baliemedewerkers en één poetser;
- iemand die alleen op zaterdag werkt;
- Logistiek, waarvan één persoon di/do aan de balie staat;
- één backoffice-medewerker en vier mensen in Overig;
- één medewerker zonder vaste diensten.

Test de migraties als het lukt ook op een tijdelijke database die alleen in het geheugen draait, bijvoorbeeld PGlite, met een minimaal nagebootst `auth`-schema.

## README (installatie voor mij)
Stap voor stap, voor iemand met alleen een browser:
- **Supabase**:
  - project aanmaken in een EU-regio en de SQL uitvoeren;
  - Auth instellen: registratie uit, inloggen met e-mailcode aan, en een e-mailsjabloon dat de code toont;
  - Site URL en redirect-URL's instellen;
  - eigen SMTP instellen (bijvoorbeeld Resend), zodat de inlogmails bij collega's aankomen;
  - de eerste beheerder aanmaken met een SQL-snippet.
- **Vercel**: repo koppelen, omgevingsvariabelen instellen (zie `.env.example`) en previews voor pull requests.
- Hoe ik een fase test, live zet en de Excel importeer.

## Niet doen
- Geen verlofsaldo's, ziekteverzuim, urenregistratie of salaris.
- Niet lezen of schrijven in iemands eigen agenda, en geen koppeling met Microsoft 365, Outlook of MyHR.
- Niets toewijzen zonder akkoord van de beheerder.
- Geen secrets of echte persoonsgegevens in de repo.

Begin met stap 1 en 2 van de werkwijze.
