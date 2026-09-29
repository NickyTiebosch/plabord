# Plan fase 1: "vervangt de Excel"

**Status: voorstel, wacht op je akkoord.** Er is nog geen applicatiecode geschreven. Dit plan hoort bij de opdracht in `docs/SPEC.md`. De vaste afspraken staan in `CLAUDE.md`.

## Wat ik van je nodig heb
1. Beantwoord de vijf vragen in §1. "Akkoord met je voorstellen" mag ook.
2. Kijk de keuzes in §2 door. Zeg het als je iets anders wilt; anders bouw ik het zo.
3. Zeg daarna "akkoord, bouw fase 1".

---

## 1. Vragen over bedrijfsregels

### V1. Gelden de feestdagen ook voor Logistiek, Backoffice en Overig?
Volgens de spec zijn sluitingsdagen aanpasbaar "per vestiging". Er staat niet of de ondersteunende groepen op Koningsdag of 2e Pinksterdag ook vrij zijn.
- **Voorstel:** een feestdag geldt voor iedereen. Per jaar kun je per groep afwijken, bij vestigingen én ondersteunende groepen. Twee voorbeelden:
  - "Logistiek werkt wél op 2e Pinksterdag";
  - "Breda is extra dicht op vr 15 mei".

### V2. Wat zijn de standaardtijden op zaterdag?
Een vaste dienst zonder tijden wordt 07:30–18:00. De balietijden in de spec gaan alleen over ma–vr; over zaterdag staat er niets.
- **Voorstel:** een aparte instelling "standaarddienst zaterdag". Geef je me de tijden, dan zet ik die als seed. Zonder antwoord wordt het ook 07:30–18:00.

### V3. Wat telt de teller "x van y afwezig" per week per vestiging?
- **Voorstel:**
  - y = het aantal actieve medewerkers met die vestiging als groep;
  - x = hoeveel van hen in die week (ma–za) minstens één dagdeel afwezig zijn, aangevraagd of goedgekeurd.
- **Alternatief:** x = het hoogste aantal dat op één dag tegelijk afwezig is. Dat laat beter zien hoe krap de drukste dag is.

### V4. Mag de secret key ook voor accountbeheer, niet alleen voor aanmaken?
Twee dingen kunnen alleen via dezelfde admin-API als het aanmaken:
- het e-mailadres wijzigen van iemand die al een account heeft;
- het inloggen blokkeren als je iemand op inactief zet.

Opties:
- **Voorstel:** reken beide tot "accounts aanmaken".
- **Alternatief:** niet toestaan. Dan geldt het volgende:
  - een e-mailadres wijzigen kan niet; je verwijdert het oude account in het Supabase-dashboard;
  - iemand die op inactief staat, kan nog wel een code aanvragen, maar ziet na het inloggen niets. Dat regelt RLS.

### V5. Een agendalink is maar één keer te zien. Is dat goed?
De spec zegt: bewaar alleen een hash van het token. De app kan een link daarom alleen direct na het aanmaken tonen.
- Kwijt? Dan maak je een nieuwe link, en de oude stopt.
- In de praktijk voeg je hem één keer toe (op de iPhone met één tik). iCloud en Google zetten hem daarna zelf op je andere apparaten.

Opties:
- **Voorstel:** zo doen, volgens de spec.
- **Alternatief:** het token versleuteld bewaren, zodat de link altijd opnieuw te tonen is. Dat is iets minder veilig en wijkt af van de spec.

---

## 2. Keuzes die ik maak
Dit volgt uit de spec of is gewoon handig. Zeg het als je iets anders wilt.

**Rooster**
- Per medewerker geldt per weekdag maximaal één vaste dienst: één groep en één rol per dag, zoals in de spec. Een gesplitste dag (ochtend balie, middag backoffice) kan dus niet.
- Is alleen de begin- óf de eindtijd leeg, dan valt alleen dat veld terug op de standaard. Begin 09:00 en eind leeg wordt dus 09:00–18:00.
- Wijzig je een vaste dienst "vanaf" een datum, dan eindigt de oude dienst de dag ervoor. Het verleden blijft zoals het was.
- Is iemand een halve dag afwezig, dan tonen we de dienst ingekort tot de dagdeelgrens, ook in de agenda. Ochtend afwezig wordt dus 13:00–18:00.
- Feestdagen:
  - Koningsdag is op 26 april als 27 april op een zondag valt (zoals in 2031);
  - Bevrijdingsdag is elk jaar een sluitingsdag, zoals de spec zegt;
  - Goede Vrijdag staat niet in je lijst en is dus een gewone werkdag.
- De roosters tonen ma–za met weeknummers. Zondag laten we weg, want er zijn geen zondagdiensten.
- Mijn rooster begint vandaag en toont 42 dagen. Een dag zonder dienst staat er klein bij als "Vrij".

**Medewerkers en accounts**
- Namen zijn uniek; hoofdletters tellen niet mee. Anders kan de import rooster- en verlofregels niet aan de juiste persoon koppelen. Twee keer "Sanne" wordt dus bijvoorbeeld "Sanne de Vries" en "Sanne Jansen".
- Zet je iemand op inactief, dan:
  - kan die persoon niet meer inloggen;
  - verdwijnt die uit de roosters, het verlofoverzicht en de feeds;
  - stoppen de agendalinks van die persoon;
  - blijven de gegevens bewaard. Volledig verwijderen komt in fase 3.
- Er blijft altijd minstens één beheerder over. Je kunt jezelf niet als laatste beheerder uitzetten.

**Afwezigheid**
- Afwezigheden mogen overlappen, bijvoorbeeld ochtend en middag op dezelfde dag. Het formulier waarschuwt wel.
- Aangevraagd is gestreept, goedgekeurd een volle balk. Goedkeuren is één klik.

**Import**
- Alles of niets: zolang de voorvertoning fouten toont, kun je niet opslaan. Je past de Excel aan en uploadt hem opnieuw.
- De import voegt toe en werkt bij, maar verwijdert of deactiveert nooit iets:
  - een lege e-mailcel wist geen bestaand adres;
  - een vaste dienst die niet in het bestand staat, blijft staan. Die beëindig je in de app.
- Staat er in het bestand een vaste dienst op dezelfde weekdag met een latere "Geldig vanaf", dan eindigt de oude dienst de dag ervoor. Dat is dezelfde regel als in de app.
- Lege cellen krijgen deze waarde; de voorvertoning laat zien wat er is ingevuld:

  | Cel | Leeg betekent |
  |---|---|
  | Rol | geen rol |
  | Dagdeel | hele dag |
  | Status | goedgekeurd |
  | Beheerder | nee |
  | Groep of Rol in "Vaste roosters" | de groep en standaardrol van de medewerker |
- "Inzetbaar aan de balie in" vervangt de huidige lijst van die medewerker.
- De import kan de beheerder die importeert geen beheerdersrechten afnemen.

**Logboek**
- We loggen wie, wat en wanneer, en welke velden veranderden.
  - Waarden loggen we alleen als ze niet persoonlijk zijn: datums, dagdeel, status, groep, rol en tijden.
  - Nooit e-mailadressen, namen of tokens. Het logboek verwijst naar id's en toont de huidige naam erbij.
- Bewaartermijn: 12 maanden. Oudere regels worden automatisch verwijderd.

**Overig**
- Excel: ik gebruik `read-excel-file` en `write-excel-file` in plaats van `exceljs`.
  - `exceljs` heeft sinds oktober 2023 geen release gehad, en `npm audit` geeft er een waarschuwing op.
  - De twee alternatieven zijn in 2026 nog bijgewerkt.
  - Getest: Excel-datums, Excel-tijden, e-mails als hyperlink en meerdere tabbladen werken goed.
- Agendafeeds:
  - per persoon per feed is er één actieve link; "Nieuwe link" trekt de oude in;
  - er zijn vestigingsfeeds voor Den Bosch, Eindhoven en Breda, zoals in de spec. Niet voor Ondersteunend.
- Fase 2 voorbereiden:
  - de tabel voor invallen komt in fase 2, maar de roosterberekening kan er nu al mee overweg;
  - normen en invalvolgorde staan al in de database en op het instellingenscherm, met de waarden uit de spec. Ze doen pas iets vanaf fase 2.
- De URL's zijn Nederlands, bijvoorbeeld `/rooster/den-bosch`, `/verlof` en `/beheer/medewerkers`.

---

## 3. Wat fase 1 oplevert

**Wel in fase 1**
- Inloggen met een e-mailcode, de rollen medewerker en beheerder, en RLS.
- Groepen, instellingen met seed, medewerkers en accounts.
- Vaste diensten en de roosterberekening.
- Afwezigheid met status.
- Sluitingsdagen: berekend en aanpasbaar.
- Schermen voor iedereen: Mijn rooster, Vestigingsrooster, Verlofoverzicht en Agenda.
- Beheerschermen:
  - Overzicht, nog zonder "Nog te regelen";
  - afwezigheid;
  - medewerkers met accounts en vaste diensten;
  - sluitingsdagen en instellingen;
  - Excel-import met sjabloon;
  - logboek.
- Agendafeeds: persoonlijk, per vestiging en team-verlof.
- Installeerbaar op het beginscherm, en noindex.

**Niet in fase 1** (volgens de spec)
- Fase 2:
  - bezetting tegen de norm, gaten en "Nog te regelen";
  - voorstellen, invallen en de impactcheck;
  - roosterwijzigingen voor één dag.
- Fase 3: e-mailmeldingen, zelf verlof aanvragen, export en een medewerker volledig verwijderen.

---

## 4. Techniek

| Onderdeel | Keuze |
|---|---|
| Framework | Next.js 16.3 (App Router), React 19.3 |
| Taal | TypeScript 6.0 in strict-modus. TypeScript 7 mist nog de JS-API die Next.js en typescript-eslint gebruiken. |
| Opmaak | Tailwind CSS 4.3 met het systeemlettertype, dus geen externe fonts |
| Database en inloggen | Supabase in de EU, met `@supabase/supabase-js` 2.117 en `@supabase/ssr` 0.12 |
| Invoercontrole | zod 4 |
| Excel | read-excel-file 9 en write-excel-file 4 |
| Tests | Vitest 5, en PGlite 0.5 (Postgres 18 in het geheugen) |
| Lint | ESLint 10 met eslint-config-next |
| Hosting | Netlify op Node 22; Netlify herkent Next.js zelf |

Ik gebruik geen UI-bibliotheek en geen datumbibliotheek. Een paar eigen componenten en eigen pure datumfuncties zijn kleiner, voorspelbaarder en makkelijk te testen.

---

## 5. Mappenstructuur

```
.
├── CLAUDE.md
├── README.md                     installatie stap voor stap
├── .env.example
├── netlify.toml
├── next.config.ts                headers: noindex en beveiliging
├── docs/
│   ├── SPEC.md
│   └── PLAN-fase-1.md
├── public/icons/                 app-iconen (192, 512, maskable, apple-touch)
├── scripts/
│   └── bundle-sql.ts             migraties → supabase/setup/fase-1.sql
├── supabase/
│   ├── migrations/               één bestand per onderwerp (zie §7)
│   ├── setup/fase-1.sql          gegenereerde bundel om te plakken
│   └── tests/                    PGlite: auth-mock, RLS, constraints, seed, bundel
└── src/
    ├── proxy.ts                  sessie verversen; niet ingelogd → /inloggen
    ├── app/
    │   ├── layout.tsx, manifest.ts, robots.ts, globals.css
    │   ├── inloggen/             e-mailadres → code
    │   ├── (app)/                alles achter het inloggen
    │   │   ├── layout.tsx        navigatie + toegangscontrole
    │   │   ├── page.tsx          Mijn rooster
    │   │   ├── rooster/[group]/  Vestigingsrooster
    │   │   ├── verlof/           Verlofoverzicht
    │   │   ├── agenda/           Agendalinks
    │   │   └── beheer/           alleen beheerders
    │   │       ├── page.tsx      Overzicht
    │   │       ├── afwezigheid/
    │   │       ├── medewerkers/
    │   │       ├── sluitingsdagen/
    │   │       ├── instellingen/
    │   │       ├── import/       (+ sjabloon/route.ts)
    │   │       └── logboek/
    │   └── feed/[file]/route.ts  ICS-feed op token, zonder inloggen
    ├── components/               knoppen, kaarten, tabs, velden, dagkaart, tijdlijn
    └── lib/
        ├── engine/               PUUR: datums, feestdagen, sluitingsdagen, rooster, verlofoverzicht
        │   └── __fixtures__/team.ts
        ├── ics/                  PUUR: iCalendar-opbouw
        ├── import/               PUUR: Excel lezen, controleren, importplan
        ├── db/                   Supabase-clients (browser, server, admin), queries, types
        ├── auth/                 huidige medewerker, beheerderscheck
        └── env.ts                omgevingsvariabelen, pas bij gebruik gelezen
```

---

## 6. Datamodel

### 6.1 Tabellen

**`groups`**: de zes groepen, vast via de seed.

| Kolom | Inhoud |
|---|---|
| `id` | `den_bosch`, `eindhoven`, `breda`, `logistics`, `backoffice`, `other` |
| `name` | "Den Bosch" … "Overig" |
| `has_counter` | `true` voor de drie vestigingen |
| `sort_order` | volgorde op het scherm |
| `substitution_rank` | invalvolgorde (fase 2). Seed: Backoffice 1, Overig 2, de vestigingen 3, Logistiek 4 |

**`settings`**: één rij.
- `standard_shift_start` 07:30 en `standard_shift_end` 18:00.
- `saturday_shift_start` en `saturday_shift_end`, afhankelijk van V2.
- `day_part_boundary`: 13:00.
- `lookahead_weeks`: 8.

**`staffing_norms`**: de norm per vestiging, weekdag en dagdeel. Fase 2 gebruikt ze.
- Kolommen: `group_id` (alleen vestigingen), `weekday` (1–6), `day_part` (`morning`/`afternoon`), `min_staff`.
- Seed: ma–vr 2, za 0.

**`employees`**
- Kolommen: `id`, `name`, `group_id`, `default_role`, `is_admin`, `is_active`, plus tijdstempels.
- `name` is uniek; hoofdletters tellen niet mee.
- `default_role` is een van: `counter`, `backoffice`, `transport`, `cleaning`, `none`.

**`employee_accounts`**: de werkmail en de koppeling met het inlogaccount.
- Een aparte tabel, zodat alleen de beheerder en de medewerker zelf het adres kunnen zien.
- Kolommen: `employee_id`, `email` (uniek, in kleine letters) en `user_id`.
  - `user_id` verwijst naar `auth.users`. Het is uniek en mag leeg zijn.
- Geen rij betekent: geen e-mailadres, dus (nog) niet inloggen.

**`counter_eligibility`**: "inzetbaar aan de balie in".
- Kolommen: `employee_id` en `group_id`.
- Een foreign key zorgt dat hier alleen vestigingen in kunnen.

**`recurring_shifts`**: de vaste diensten.
- Kolommen:
  - `employee_id`, `weekday` (1 = ma … 6 = za), `group_id`, `role`;
  - `start_time` en `end_time`; leeg betekent de standaardtijd;
  - `valid_from` en `valid_to`; een lege `valid_to` betekent onbepaald.
- Controles: de eindtijd ligt na de begintijd, en tot ligt niet vóór vanaf.
- Een exclusion constraint voorkomt twee vaste diensten voor dezelfde medewerker op dezelfde weekdag in overlappende periodes.

**`absences`**
- Kolommen: `employee_id`, `start_date`, `end_date`, `day_part` en `status`.
  - `day_part` is `full_day`, `morning` of `afternoon`;
  - `status` is `requested` of `approved`.
- Controles:
  - tot ligt niet vóór van;
  - een halve dag kan alleen als van en tot gelijk zijn.
- Uniek op (medewerker, van, tot, dagdeel). Dat is ook de sleutel voor de import.
- Geen reden, geen soort en geen tekstveld.

**`closure_days`**: afwijkingen op de berekende feestdagen.
- Kolommen:
  - `date`;
  - `group_id` (leeg = alle groepen);
  - `is_closed`: `true` = extra dicht, `false` = toch open;
  - `label`: kort, maximaal 60 tekens, bijvoorbeeld "Bedrijfsuitje".
- Uniek op (datum, groep).
- De feestdagen zelf berekenen we en slaan we niet op. Zo werkt elk jaar vanzelf.

**`calendar_feeds`**
- Kolommen:
  - `employee_id`: de eigenaar;
  - `kind`: `personal`, `location` of `absences`;
  - `group_id`: alleen bij `location`;
  - `token_hash`: SHA-256, uniek;
  - `created_at` en `revoked_at`.
- Per eigenaar is er per feed maximaal één actieve link.

**`audit_log`**: het logboek.
- Kolommen:
  - `occurred_at`;
  - `actor_user_id` en `actor_employee_id`: wie de wijziging deed;
  - `action`: `insert`, `update` of `delete`;
  - `entity` en `entity_id`: welk record;
  - `employee_id`: om welke medewerker het gaat;
  - `changed_fields` en `details`: wat er veranderde; `details` bevat alleen niet-persoonlijke waarden;
  - `source`: bijvoorbeeld "import".
- Triggers op elke tabel vullen het logboek, dus ook wijzigingen via de import komen erin.

Fase 2 voegt de tabel `substitutions` (invallen) toe.

### 6.2 Rechten (RLS en GRANTs)
"Medewerker" betekent hieronder: ingelogd en gekoppeld aan een actieve medewerker. De functie `private.current_employee_id()` bepaalt dat.

| Tabel | Lezen | Wijzigen |
|---|---|---|
| `groups`, `settings`, `staffing_norms` | medewerker | beheerder |
| `employees`, `counter_eligibility` | medewerker | beheerder |
| `employee_accounts` (e-mail) | beheerder of de medewerker zelf | beheerder |
| `recurring_shifts`, `absences`, `closure_days` | medewerker | beheerder |
| `calendar_feeds` | eigen links; beheerder alles | eigen link maken of intrekken; beheerder kan intrekken |
| `audit_log` | beheerder | niemand; alleen de triggers schrijven |

- `anon` krijgt op geen enkele tabel rechten.
  - Inloggen loopt via Supabase Auth.
  - De feeds lopen via de server.
- `authenticated` krijgt per tabel precies de grants uit de tabel hierboven. RLS beperkt ze tot de juiste rijen.
- `service_role`, de secret key, gebruiken we alleen voor accounts aanmaken (en wat je bij V4 kiest) en voor het serveren van feeds.
- De hulpfuncties `private.current_employee_id()` en `private.is_admin()` staan in schema `private`. Dat schema is niet via de API te bereiken.
- Er komen twee RPC's:
  - **`claim_account()`** koppelt je inlogaccount aan je medewerker, via het geverifieerde e-mailadres in je sessie. Handig voor de eerste beheerder, en voor als het koppelen ooit misging.
  - **`apply_import(plan)`** voert een import in één transactie uit. Alleen een beheerder kan hem gebruiken.

### 6.3 Seed
- De 6 groepen.
- Instellingen: dienst 07:30–18:00, dagdeelgrens 13:00, vooruitkijken 8 weken, en de zaterdagtijden uit V2.
- Normen per vestiging per dagdeel: 2 op ma–vr, 0 op zaterdag.
- Invalvolgorde: Backoffice, Overig, een andere vestiging, Logistiek.
- Geen medewerkers. De eerste beheerder maak je aan met een SQL-snippet uit de README.

---

## 7. Migraties en SQL-bundel

```
supabase/migrations/
  20261001000100_extensions_and_helpers.sql   btree_gist, schema private, updated_at-trigger
  20261001000200_groups_settings.sql          groups, settings, staffing_norms
  20261001000300_employees.sql                employees, employee_accounts, counter_eligibility, hulpfuncties
  20261001000400_recurring_shifts.sql
  20261001000500_absences_closures.sql
  20261001000600_calendar_feeds.sql
  20261001000700_audit_log.sql                logboek, triggers, bewaartermijn
  20261001000800_rpc.sql                      claim_account, apply_import
  20261001000900_seed.sql
supabase/setup/fase-1.sql                     alle migraties hierboven op volgorde, met uitleg bovenaan
```

- Alles is herhaalbaar. Twee keer plakken geeft geen fouten en geen dubbele seed.
- Elke tabel krijgt:
  - RLS aan;
  - `revoke all` voor `anon` en `authenticated`;
  - daarna expliciete grants.
- Een test controleert dat `fase-1.sql` precies overeenkomt met de migraties. `npm run db:bundle` maakt de bundel opnieuw.

---

## 8. Roosterberekening (engine)
De engine bestaat uit pure functies in `src/lib/engine/`.
- **Invoer:**
  - een momentopname: instellingen, groepen, actieve medewerkers, vaste diensten, afwezigheid en sluitingsafwijkingen. Vanaf fase 2 ook invallen;
  - een datumbereik.
- **Uitvoer:** per datum de diensten, met hun dagdelen en afwezigheid.

Regels per medewerker per datum:
1. Zoek de vaste dienst voor die weekdag met `valid_from ≤ datum ≤ valid_to`. Is er geen, dan staat de medewerker die dag niet in het rooster.
2. Lege tijden worden de standaarddienst (voor zaterdag: zie V2).
3. Is de groep van die dienst die dag gesloten, dan is er geen dienst. Mijn rooster toont dan bijvoorbeeld "Gesloten (Koningsdag)".
4. Afwezigheid telt mee als die op die datum valt, of hij nu aangevraagd of goedgekeurd is:
   - een hele dag maakt de hele dag afwezig;
   - ochtend of middag maakt alleen dat dagdeel afwezig.
5. Dagdelen:
   - ochtend is vóór de grens (13:00), middag vanaf de grens;
   - iemand werkt in een dagdeel als de dienst dat dagdeel overlapt en die persoon dan niet afwezig is.
6. Elke dienst krijgt de vlag "telt mee aan de balie": rol balie in een vestiging. Daarmee rekent fase 2 de bezetting uit.

**Sluitingsdagen**
- De feestdagen worden per jaar berekend. Pasen gaat met het algoritme van Meeus/Jones/Butcher.
- Voorbeeld voor 2026: do 1 jan, zo 5 en ma 6 apr, ma 27 apr, di 5 mei, do 14 mei, zo 24 en ma 25 mei, vr 25 en za 26 dec.
- Of een groep op een datum dicht is, bepaalt de app in deze volgorde:
  1. een afwijking voor die groep;
  2. anders een afwijking voor alle groepen;
  3. anders: is het een feestdag?

**Verlofoverzicht**: een pure functie berekent per medewerker de balken, en per vestiging per week de teller.

**Sortering** ligt altijd vast: eerst op groepvolgorde, dan op naam, dan op id. Dezelfde gegevens geven zo altijd dezelfde volgorde.

---

## 9. Schermen en routes
Alle schermen zijn mobile-first. Onderaan staat een tabbalk: Mijn rooster · Rooster · Verlof · Agenda · Beheer. Beheer zien alleen beheerders.

**Voor iedereen**

| Route | Scherm |
|---|---|
| `/inloggen` | E-mailadres invullen, dan de 6-cijferige code. |
| `/` | **Mijn rooster:** 6 weken vanaf vandaag, per week en per dag. |
| `/rooster/den-bosch`, `/eindhoven`, `/breda`, `/ondersteunend` | **Vestigingsrooster:** een week per keer. |
| `/verlof` | **Verlofoverzicht:** een tijdlijn per maand, kwartaal of jaar. |
| `/agenda` | **Agenda:** je agendalinks, uitleg en uitloggen. |

- **Mijn rooster** toont per dag de vestiging of groep, de rol, de tijden, je eigen afwezigheid en sluitingsdagen. Afwijkingen vallen op: een andere groep dan je eigen, een halve of hele dag afwezig, of gesloten.
- **Vestigingsrooster**
  - Tabs per vestiging en Ondersteunend. Ondersteunend is Logistiek, Backoffice en Overig samen.
  - Je bladert een week vooruit of terug (`?week=2026-W42`).
  - Per dag zie je wie er werkt (rol en tijden) en wie afwezig is (aangevraagd gestreept), en of de vestiging gesloten is.
- **Verlofoverzicht**
  - Kies de weergave met `?weergave=maand|kwartaal|jaar&datum=…`.
  - Rijen per medewerker, gegroepeerd per groep.
  - Balken: aangevraagd gestreept, een halve dag half hoog.
  - Weekenden en sluitingsdagen zijn grijs.
  - Per vestiging per week de teller "x van y afwezig".
  - Op de telefoon scroll je horizontaal.
- **Agenda**
  - Links maken en intrekken: persoonlijk, per vestiging en team-verlof.
  - Een knop "Toevoegen aan agenda" (webcal), plus de https-link om te kopiëren.
  - Uitleg voor iPhone, Outlook en Google Agenda.

**Voor beheerders**

| Route | Scherm |
|---|---|
| `/beheer` | **Overzicht:** openstaande aanvragen en wie deze week afwezig is. |
| `/beheer/afwezigheid` (+ `/nieuw`, `/[id]`) | **Afwezigheid** invoeren en bijhouden. |
| `/beheer/medewerkers` (+ `/nieuw`, `/[id]`) | **Medewerkers**, accounts en vaste diensten. |
| `/beheer/sluitingsdagen?jaar=2027` | **Sluitingsdagen** per jaar. |
| `/beheer/instellingen` | **Instellingen**. |
| `/beheer/import` | **Excel-import**. |
| `/beheer/logboek` | **Logboek**. |

- **Overzicht:** een openstaande aanvraag keur je met één klik goed. "Nog te regelen" komt in fase 2.
- **Afwezigheid**
  - Een snel formulier: medewerker, van, tot, dagdeel (alleen bij één dag) en status.
  - Een lijst waarin je kunt wijzigen, verwijderen en goedkeuren.
- **Medewerkers**
  - Gegevens, e-mailadres met accountstatus, en waar iemand aan de balie inzetbaar is.
  - Vaste diensten: wijzigen vanaf een datum, beëindigen, en de geschiedenis bekijken.
  - Agendalinks van de medewerker intrekken.
- **Sluitingsdagen:** de berekende feestdagen, met per groep open of dicht. Je kunt ook extra sluitingsdagen toevoegen.
- **Instellingen:** standaarddienst(en), dagdeelgrens, vooruitkijktermijn, normen en invalvolgorde.
- **Excel-import**
  - Uploaden, voorvertoning bekijken (nieuw, bijgewerkt, ongewijzigd en fouten per regel) en bevestigen.
  - Het lege sjabloon downloaden.
- **Logboek:** wie deed wat en wanneer, te filteren op soort en medewerker.

**Zonder scherm**

| Route | Wat het is |
|---|---|
| `/feed/<token>.ics` | De ICS-feed voor de agenda-app. Werkt zonder inloggen; het token geeft toegang. |
| `/manifest.webmanifest`, `/robots.txt`, iconen | Installeren op het beginscherm, en niets laten indexeren. |

**Techniek:** de pagina's zijn server components. Ze halen één momentopname op en rekenen die door met de engine. Schrijven gaat via server actions.

---

## 10. Inloggen en accounts
- **Inloggen**
  1. Je vult je e-mailadres in. De app vraagt een code aan met `signInWithOtp` en `shouldCreateUser: false`.
  2. Je vult de code in; de app controleert hem met `verifyOtp`.
  - We tonen altijd dezelfde melding: "Als dit adres bekend is, krijg je een code." Zo kan niemand uitproberen welke adressen bestaan.
- **Lang ingelogd blijven**
  - De sessiecookie blijft 400 dagen geldig; dat is het maximum van de browser.
  - `proxy.ts` ververst de sessie bij elk bezoek.
  - In Supabase zet je geen sessielimiet aan; dat staat in de README.
- **Account aanmaken** gaat via een server action, door een beheerder:
  1. de app slaat het e-mailadres op;
  2. de admin-API maakt het account aan met `createUser` en `email_confirm: true`;
  3. de app koppelt het account aan de medewerker.
  - Mislukt dat koppelen, dan doet `claim_account()` het alsnog bij de eerste keer inloggen.
- **De eerste beheerder** maak je in twee stappen:
  1. maak in het Supabase-dashboard een gebruiker aan, met "Auto Confirm" aan;
  2. voer een SQL-snippet uit die de medewerker toevoegt met `is_admin = true` en het e-mailadres.

  Daarna log je in met de code.
- Ben je ingelogd maar niet gekoppeld aan een actieve medewerker, dan zie je: "Geen toegang, vraag de beheerder".

---

## 11. Excel-import
1. **Uploaden.** De beheerder kiest een .xlsx-bestand. Limieten: maximaal 2 MB en maximaal 5.000 regels per tabblad.
2. **Tabbladen en kolommen.** De server leest alle tabbladen, maar gebruikt alleen "Medewerkers", "Vaste roosters" en "Afwezigheid".
   - Hoofdletters in de namen van tabbladen tellen niet mee.
   - Andere tabbladen en kolommen met "(info)" in de kop slaat de import over.
   - Ontbreekt een verplichte kolom, dan krijg je een duidelijke foutmelding.
3. **Cellen lezen.**
   - Datums: een Excel-datum of d-m-jjjj.
   - Tijden: een Excel-tijd of uu:mm.
   - Namen, groepen, rollen en dagen: hoofdletters en spaties aan het begin of eind tellen niet mee.
   - E-mailadressen worden ook gelezen als Excel er een hyperlink van heeft gemaakt.
4. **Voorvertoning.** De pure functie `planImport(bestand, huidige gegevens)` maakt per tabblad een voorvertoning:
   - wat nieuw, bijgewerkt en ongewijzigd is;
   - de fouten per regel, bijvoorbeeld "Afwezigheid, regel 14: onbekende naam 'Sane'".
5. **Bevestigen.**
   - Het bestand gaat nog een keer mee. De server leest het opnieuw en controleert dat het plan niet veranderd is.
   - `apply_import` voert alles uit in één transactie.
   - Daarna maakt de app accounts aan voor iedereen met een e-mailadres die nog geen account heeft.
   - Mislukte accounts worden gemeld. Opnieuw importeren herstelt dat.
6. **Geen dubbelingen.** De import herkent bestaande regels zo:

   | Soort | Uniek op |
   |---|---|
   | Medewerker | e-mail, of naam als de e-mail leeg is |
   | Vaste dienst | naam + dag + geldig vanaf |
   | Afwezigheid | naam + van + tot + dagdeel |

   Importeer je hetzelfde bestand een tweede keer, dan is alles "ongewijzigd".
7. **Sjabloon.** Via `/beheer/import/sjabloon` download je hetzelfde bestand, maar leeg. Het heeft de exacte kopnamen en een tabblad "Uitleg", dat de import overslaat.

---

## 12. Agendafeeds
**Soorten**
- Persoonlijk: je eigen diensten en afwezigheid. Invallen komen erbij vanaf fase 2.
- Per vestiging: wie werkt wanneer.
- Team-verlof: wie is afwezig.

**Bereik:** van 30 dagen terug tot 26 weken vooruit.

**Token**
- 32 willekeurige bytes, als base64url van 43 tekens.
- In de database staat alleen de SHA-256-hash.
- Bij een onbekend of ingetrokken token geeft de feed een 404.

**Inhoud**, zo kort mogelijk en nooit met e-mailadressen:

| Feed | Voorbeelden |
|---|---|
| Persoonlijk | "Dienst Den Bosch 07:30–18:00", "Afwezig", "Afwezig (ochtend)" |
| Vestiging | "Sanne (balie)" in de dienstijden. Wie afwezig is, staat er niet in. |
| Team-verlof | "Afwezig: Sanne", waar nodig met "(ochtend)", "(middag)" of "(aangevraagd)" |

**Techniek**
- Tijdzone: een `VTIMEZONE` voor Europe/Amsterdam, en tijden met `TZID`.
- Afwezigheid is een hele-dag-event; `DTEND` telt niet mee (exclusief).
- `UID`'s zijn stabiel, bijvoorbeeld `shift-<medewerker>-<datum>@planbord`.
- `DTSTAMP` is de laatste wijziging van de onderliggende gegevens. Die blijft dus gelijk tussen twee keer ophalen.
- Opmaak:
  - escaping van `\`, `;`, `,` en regeleinden;
  - CRLF als regeleinde;
  - lange regels afgebroken op 75 octets, zonder een teken middendoor te breken.
- Kalenderkop: `X-WR-CALNAME`, `REFRESH-INTERVAL;VALUE=DURATION:PT1H` en `X-PUBLISHED-TTL:PT1H`.
- HTTP-headers: `Content-Type: text/calendar; charset=utf-8` en `Cache-Control: private, no-store`.
- De links beginnen met `SITE_URL` als die is ingesteld, en anders met het adres van de site zelf.

---

## 13. Testaanpak

**Unit-tests** (Vitest). Ze gebruiken een fictief team in `__fixtures__/team.ts`:
- 3 vestigingen, elk met 3–4 baliemedewerkers en een poetser;
- iemand die alleen op zaterdag werkt;
- Logistiek, met één persoon die di/do aan de balie in Den Bosch staat en wo/vr transport doet;
- 1 backoffice-medewerker en 4 mensen in Overig;
- 1 medewerker zonder vaste diensten.

| Onderdeel | Gevallen in fase 1 |
|---|---|
| Datums | ISO-weken en weekdagen; de notatie "di 14 okt" en 24-uurstijden; "vandaag" rond de wissel van zomer- naar wintertijd |
| Feestdagen | Pasen voor een reeks jaren; Hemelvaart en Pinksteren; Koningsdag op 26 april als 27 april op zondag valt; Oudjaarsdag is een werkdag; afwijkingen per groep en voor alle groepen |
| Rooster | zie de lijst hieronder |
| Verlofoverzicht | balken, groepering en de teller "x van y" |
| ICS | geldige structuur (BEGIN/END en verplichte velden); escaping; regelafbreking op 75 octets, ook met é en –; `VTIMEZONE`; hele-dag-events; dezelfde invoer geeft byte voor byte dezelfde uitvoer |
| Import | zie de lijst hieronder |

Rooster:
- vaste diensten met geldig vanaf/tot; een nieuwe dienst laat het verleden ongemoeid;
- lege tijden worden de standaarddienst;
- de medewerker met di/do balie en wo/vr transport staat alleen op di/do in Den Bosch, en telt alleen dan mee aan de balie;
- de zaterdagwerker;
- iemand zonder vaste diensten staat niet in de roosters;
- een sluitingsdag geeft geen diensten;
- een halve dag afwezig telt per dagdeel; aangevraagd en goedgekeurd tellen allebei als afwezig;
- een inactieve medewerker telt niet mee;
- de volgorde ligt altijd vast.

Import:
- Excel-datums worden goed gelezen, zowel een echte datumcel als een getal, en ook d-m-jjjj;
- Excel-tijden en uu:mm worden goed gelezen;
- een ongeldige datum zoals 31-2 geeft een fout;
- "(info)"-kolommen en andere tabbladen worden overgeslagen;
- fouten verschijnen per regel, met het regelnummer;
- namen matchen zonder op hoofdletters of spaties te letten;
- opnieuw importeren geeft geen dubbelingen;
- een nieuwe vaste dienst beëindigt de oude.

De tests maken hun eigen .xlsx-bestanden met write-excel-file. Er staan dus geen Excel-bestanden met gegevens in de repo.

**Databasetests** draaien op PGlite met een nagebootst `auth`-schema. Ik heb vooraf getest dat rollen, RLS-policies en exclusion constraints daarin werken. Deze tests controleren:
- dat de migraties draaien, dat de bundel twee keer zonder fouten draait, en dat de seed klopt;
- de rechten:
  - `anon` mag niets;
  - een medewerker leest de roosters, maar niet andermans e-mailadres (dat van zichzelf wel);
  - een medewerker kan niets wijzigen, een beheerder wel;
  - een inactieve medewerker ziet niets;
- het logboek: wijzigingen worden gelogd zonder e-mailadressen, en alleen een beheerder kan het lezen;
- de constraints:
  - overlappende vaste diensten worden geweigerd;
  - een halve dag over meerdere dagen wordt geweigerd;
  - een dubbele afwezigheid wordt geweigerd;
- dat je in `calendar_feeds` alleen je eigen links ziet;
- dat `apply_import` twee keer hetzelfde resultaat geeft.

**Wat hier niet te testen is:** echte Supabase Auth (de codes), Netlify, en de schermen in een browser. Die test jij via de preview, met het testlijstje uit de PR.

---

## 14. Bouwvolgorde (kleine commits)
1. **Basis:**
   - Next.js, TypeScript, Tailwind, ESLint, Vitest en de scripts;
   - `netlify.toml` en `.env.example`;
   - noindex en de beveiligingsheaders.
2. **Engine, deel 1:** datums, feestdagen en sluitingsdagen, met tests.
3. **Engine, deel 2:** roosterberekening en de teamfixture, met tests.
4. **Database:**
   - migraties, RLS, grants, seed, logboek en RPC's;
   - PGlite-tests en het bundelscript.
5. **Inloggen:** Supabase-clients, proxy, inlogscherm en toegangscontrole.
6. **Schermen:** Mijn rooster en Vestigingsrooster.
7. **Verlofoverzicht.**
8. **Beheer, deel 1:** medewerkers, accounts en vaste diensten.
9. **Beheer, deel 2:** afwezigheid en het Overzicht.
10. **Beheer, deel 3:** sluitingsdagen en instellingen.
11. **Agenda:** ICS-opbouw met tests, de feedroute en het Agendascherm.
12. **Excel-import:** lezen, plan, voorvertoning, opslaan en sjabloon, met tests.
13. **Logboekscherm.**
14. **Installeerbaar:** manifest en iconen.
15. **Afronden:** README, `supabase/setup/fase-1.sql`, en de PR-tekst met handmatige stappen en testlijst.

---

## 15. Oplevering
De pull request van fase 1 bevat:
- een samenvatting;
- de handmatige stappen:
  1. **Supabase-project** aanmaken in een EU-regio. Plak `supabase/setup/fase-1.sql` in de SQL-editor en voer het uit.
  2. **Auth instellen:**
     - registratie uit;
     - inloggen met e-mailcode aan; controleer dat de code 6 cijfers heeft;
     - een e-mailsjabloon dat `{{ .Token }}` toont;
     - geen sessielimiet.
  3. **Site URL en redirect-URL's** instellen.
  4. **Eigen SMTP**, bijvoorbeeld Resend.
  5. **De eerste beheerder** aanmaken.
  6. **Netlify:**
     - de repo koppelen;
     - omgevingsvariabelen instellen: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` en optioneel `SITE_URL`;
     - deploy previews aanzetten;
- een testlijstje dat je in de preview afvinkt.

---

## 16. Risico's en aandachtspunten
- **Next.js 16 op Netlify.** Tijdens de bouw controleer ik of Netlify `proxy.ts` ondersteunt. Zo niet, dan gebruik ik de oudere `middleware.ts`. Aan de werking van de app verandert dat niets.
- **Supabase gratis.**
  - De ingebouwde mail is alleen om te testen: weinig mails per uur, en alleen naar leden van je Supabase-team. Voor echte collega's heb je dus eigen SMTP nodig.
  - Een gratis project pauzeert na een week zonder gebruik. Met dagelijks gebruik en agendafeeds gebeurt dat niet.
- **Agenda-apps.** Google en Outlook halen een feed soms pas na uren, tot een dag, opnieuw op. Dat leggen we in de app uit; sneller kan niet.
- **Branch.** In deze sessie werk ik op `claude/planbord-rooster-verlof-acetqh`. Voor fase 2 komt er een nieuwe branch.
