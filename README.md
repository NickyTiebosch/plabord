# Planbord

De rooster- en verlofapp van het verhuurteam. Planbord vervangt de Excel: wie werkt wanneer en waar, wie is afwezig, en welke dagen zijn we dicht.

De opdracht staat in [`docs/SPEC.md`](docs/SPEC.md). Het plan per fase staat in [`docs/PLAN-fase-1.md`](docs/PLAN-fase-1.md) en [`docs/PLAN-fase-2.md`](docs/PLAN-fase-2.md). De vaste afspraken voor de code staan in [`CLAUDE.md`](CLAUDE.md).

## Wat kan Planbord

### Fase 1: de basis

**Voor iedereen**
- **Mijn rooster:** je eigen diensten, afwezigheid en sluitingsdagen.
- **Rooster:** per vestiging de week: wie er werkt, met tijden, en wie afwezig is. De ondersteunende groepen staan samen onder *Ondersteunend*.
- **Verlof:** wie is wanneer afwezig, per maand, kwartaal of jaar.
- **Agenda:** je rooster in de agenda van je telefoon of computer (Outlook, Google, Apple).
- Inloggen met een code van 6 cijfers per e-mail. Geen wachtwoorden, geen inloglinks.
- Installeerbaar op het beginscherm van je telefoon.

**Voor beheerders** (onder **Beheer**)
- Afwezigheid invoeren, wijzigen en goedkeuren.
- Medewerkers en hun vaste diensten. Met een werkmail krijgt iemand meteen een inlogaccount.
- Sluitingsdagen: feestdagen per groep open of dicht, en extra sluitingsdagen.
- Instellingen: standaarddienst, zaterdagdienst, grens ochtend/middag, normen en invalvolgorde.
- Excel-import van medewerkers, vaste roosters en afwezigheid.
- Logboek: wie wat wanneer wijzigde.

### Fase 2: het brein

**Voor iedereen**
- **Rooster:** per vestiging eerst de balie, daaronder hiker/buitendienst, elk in een eigen kleur. Staan er te weinig mensen aan de balie, dan zie je een rode melding, bijvoorbeeld *1 te weinig aan de balie*. Invallers staan erbij als *ingeleend*. Een roosterwijziging voor één dag heet *gewijzigd*.
- **Mijn rooster:** je ziet waar je invalt en wanneer je rooster voor één dag anders is.

**Voor beheerders**
- **Nog te regelen** op het overzicht: elk gat per vestiging en dagdeel.
  - Je ziet de drie beste invallers, met de reden in gewone taal.
  - Met **Inzetten** wijs je iemand toe. Planbord wijst nooit zelf iemand toe.
  - Een gat kun je **negeren**. Het komt terug als het tekort groter wordt.
- **Impactcheck:** bij nieuwe of gewijzigde afwezigheid zie je eerst welke gaten ontstaan en welke invallen vervallen. Opslaan mag altijd.
- **Let op:** invallen die niet meer nodig zijn, of opnieuw geregeld moeten worden omdat de invaller zelf afwezig is. Ze blijven staan tot je op **Afgehandeld** klikt. Na een wijziging van een vaste dienst of sluitingsdag toont het overzicht welke invallen niet meer kloppen; met **Invallen bijwerken** pas je ze aan.
- **Rooster voor één dag:** geen dienst, een andere dienst, of de dienst verplaatsen naar een andere dag. Klik in het rooster op een naam.
- **Invallen:** de lijst van komende en recente invallen. **Intrekken** verwijdert niets: de inval krijgt de status *niet meer nodig*.

---

## Eenmalig: de app in de lucht zetten

Volg de stappen op volgorde. Reken op ongeveer een uur. De namen in de dashboards van Supabase en Netlify kunnen iets afwijken van wat hier staat; ze veranderen af en toe.

### Stap 1. Supabase-project

1. Ga naar [supabase.com](https://supabase.com) en maak een nieuw project. Een koppeling met GitHub is niet nodig.
   - **Project name:** bijvoorbeeld `Planbord`.
   - **Region:** kies een regio in de EU, bijvoorbeeld *Central EU (Frankfurt)*.
   - Bewaar het databasewachtwoord in je wachtwoordkluis.
   - **Security:**
     - laat **Enable Data API** aan; Planbord gebruikt die;
     - **Automatically expose new tables** mag uit, zoals Supabase aanraadt. Planbord geeft elke tabel zelf de juiste rechten. Aan werkt ook;
     - **Enable automatic RLS** maakt niet uit: de scripts zetten RLS op elke tabel zelf aan.
2. Open **SQL Editor → New query**.
3. Plak de hele inhoud van [`supabase/setup/fase-1.sql`](supabase/setup/fase-1.sql) en klik op **Run**.
   - Je ziet *Success. No rows returned*.
   - Het script nog een keer draaien kan geen kwaad: bestaande tabellen en gegevens blijven staan.
4. Doe daarna hetzelfde met [`supabase/setup/fase-2.sql`](supabase/setup/fase-2.sql), in een nieuwe query. Altijd na fase 1.

### Stap 2. Inloggen instellen

Open in Supabase **Authentication**.

1. **Sign In / Providers**
   - Zet **Allow new users to sign up** uit. Alleen een beheerder maakt accounts aan.
   - Zet bij **Email** de provider aan.
   - **Email OTP Length:** `6`.
   - **Email OTP Expiration:** advies `600` seconden (10 minuten). Korter is veiliger; langer is makkelijker als de mail traag is.
2. **Emails → SMTP Settings:** stel een eigen mailserver in. Doe dit vóór het sjabloon hieronder:
   - zonder eigen mailserver laat Supabase je het sjabloon niet aanpassen;
   - met het standaardsjabloon krijgt een collega alleen een inloglink, en daarmee werkt Planbord niet;
   - de ingebouwde mail van Supabase is alleen om te testen: hij mailt alleen leden van je Supabase-team en maar een paar keer per uur.

   Voorbeeld met [Resend](https://resend.com):
   - maak een account en verifieer je domein. Dat zijn een paar DNS-records; vraag ze zo nodig aan wie de DNS van je domein beheert. Een subdomein zoals `mail.jouwdomein.nl` kan ook;
   - maak een API-sleutel;
   - vul in Supabase in: host `smtp.resend.com`, poort `465`, gebruikersnaam `resend`, wachtwoord = de API-sleutel;
   - afzender bijvoorbeeld `planbord@jouwdomein.nl`, naam `Planbord`.

   Kun of wil je niets aan je DNS veranderen? Gebruik dan de mailserver van een mailbox die je al hebt, bijvoorbeeld bij je hostingbedrijf. Je DNS blijft dan zoals hij is.
   - Bij TransIP: host `smtp.transip.email`, poort `465`, gebruikersnaam en afzender = het mailadres, wachtwoord = het wachtwoord van die mailbox.
   - Bij Google Workspace: host `smtp.gmail.com`, poort `465`, gebruikersnaam en afzender = het mailadres, wachtwoord = een *app-wachtwoord*. Zet daarvoor in het Google-account eerst *Verificatie in twee stappen* aan en maak dan een app-wachtwoord op [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
   - Weet je niet waar de mailbox staat? Kijk waar je de mail leest: in Gmail is het Google Workspace, in de webmail van je hostingbedrijf is het dat bedrijf. Waar je domeinnaam staat, zegt daar niets over.
   - Gebruik bij voorkeur een aparte mailbox, zoals `planbord@jouwdomein.nl`. Verander je het wachtwoord van die mailbox, pas het dan ook in Supabase aan.
   - Microsoft 365 en Outlook.com zijn niet geschikt: die staan mailen met alleen een wachtwoord niet meer of niet lang meer toe.

   Elke andere SMTP-dienst werkt ook. Kies bij voorkeur een dienst die in de EU verwerkt. De mail bevat alleen de code en het e-mailadres.
3. **Emails → Templates → Magic Link.** Supabase gebruikt dit sjabloon ook voor de inlogcode. Vervang het door een mail met alleen de code, zonder link:
   - **Subject:** `Je inlogcode voor Planbord`
   - **Body:**
     ```html
     <h2>Je inlogcode voor Planbord</h2>
     <p>Vul deze code in op het inlogscherm:</p>
     <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
     <p>De code is 10 minuten geldig. Heb je niet geprobeerd in te loggen? Dan kun je deze mail negeren.</p>
     ```
   - Pas "10 minuten" aan als je bij stap 2.1 een andere geldigheid kiest.
4. **Rate Limits:** zet het aantal mails per uur na het instellen van SMTP op een waarde die past bij het team, bijvoorbeeld `60`.
5. **Sessions:** laat de standaard staan, dus geen *time-box* en geen *inactivity timeout*. Zo blijf je op je eigen telefoon ingelogd.
6. **URL Configuration:**
   - **Site URL:** het adres van de app, bijvoorbeeld `https://planbord.netlify.app` (dat weet je na stap 4).
   - **Redirect URLs:** niet nodig. Planbord gebruikt geen inloglinks.

### Stap 3. Sleutels opzoeken

In Supabase onder **Project Settings**:
- **Data API** (of **API**): de **Project URL**, bijvoorbeeld `https://abcd.supabase.co`.
- **API Keys:**
  - de **Publishable key** (`sb_publishable_…`): mag in de browser;
  - een **Secret key** (`sb_secret_…`): **geheim**, alleen voor de server. Deel hem nooit en zet hem nooit in de repo.

Heeft je project alleen de oude sleutels (`anon` en `service_role`)? Dat werkt ook: gebruik dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `SUPABASE_SERVICE_ROLE_KEY` als namen in stap 4.

### Stap 4. Netlify

1. Ga naar [app.netlify.com](https://app.netlify.com) → **Add new project → Import an existing project → GitHub** en kies deze repository.
   - **Branch to deploy:** `main`.
   - De rest van de build-instellingen staat in [`netlify.toml`](netlify.toml): `npm run build` en Node 22.
2. Zet vóór de eerste deploy onder **Project configuration → Environment variables**:

   | Naam | Waarde | Let op |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | de Project URL | |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | de Publishable key | |
   | `SUPABASE_SECRET_KEY` | de Secret key | vink **Contains secret values** aan |
   | `SITE_URL` | optioneel, bijvoorbeeld `https://planbord.netlify.app` | alleen voor de context **Production**; leeg = het adres waarop de app draait |

   - Netlify zet de `NEXT_PUBLIC_`-waarden bij het bouwen in de app. Pas je ze aan, start dan een nieuwe deploy.
   - De secret key gebruikt de app alleen op de server: voor accountbeheer (aanmaken, e-mailadres wijzigen, blokkeren bij inactief) en om agendafeeds te serveren.
3. **Deploy Previews:** controleer onder **Build & deploy → Deploy Previews** dat er een preview komt voor elke pull request. Netlify zet dan een link in de pull request.
   - Bestond de pull request al vóór je Netlify koppelde? Dan komt de preview bij de volgende wijziging in die pull request.
4. **Private of public:** een nieuw Netlify-project is eerst *Private*. Je ziet dan onderaan de site een balk met **Make public**, en alleen jij en je Netlify-team kunnen de site openen. Klik op **Make public** zodra collega's erin moeten. Planbord blijft dan nog steeds afgeschermd: zonder inlogcode zie je niets, en zoekmachines mogen niets indexeren.
5. Wil je een eigen domein? Stel het in onder **Domain management** en pas daarna de **Site URL** in Supabase en `SITE_URL` in Netlify aan.

> Previews en productie gebruiken dezelfde Supabase-database, tenzij je per context andere waarden instelt. Vóór de livegang is dat prima. Daarna kun je voor de previews een tweede Supabase-project maken en die sleutels alleen in de context **Deploy Previews** zetten.

### Stap 5. De eerste beheerder

1. Supabase → **Authentication → Users → Add user → Create new user**:
   - je werkmail;
   - een lang, willekeurig wachtwoord als daarom gevraagd wordt (je gebruikt het nooit, inloggen gaat met een code);
   - vink **Auto Confirm User** aan.
2. Supabase → **SQL Editor**. Vervang naam en e-mailadres en klik op **Run**:
   ```sql
   -- Groep: den_bosch, eindhoven, breda, logistics, backoffice of other.
   -- Rol:   counter (balie), backoffice, transport, cleaning (hiker/buitendienst) of none.
   with nieuw as (
     insert into public.employees (name, group_id, default_role, is_admin)
     values ('Jouw naam', 'other', 'none', true)
     returning id
   )
   insert into public.employee_accounts (employee_id, email)
   select id, lower('jij@bedrijf.nl') from nieuw;
   ```
3. Controleer het resultaat. Je ziet je eigen naam, twee keer `true` en je werkmail:
   ```sql
   select e.name, e.is_admin, e.is_active, a.email
   from public.employees e
   join public.employee_accounts a on a.employee_id = e.id;
   ```
   Staat er nog `Jouw naam` of `jij@bedrijf.nl`? Pas het dan aan met `update public.employees set name = '…' where name = 'Jouw naam';` en `update public.employee_accounts set email = '…' where email = 'jij@bedrijf.nl';`.
4. Open de app en log in met precies dat mailadres. Bij de eerste keer koppelt Planbord je account automatisch aan deze medewerker.
   - Zie je **Geen toegang**? Dan hoort het adres waarmee je inlogt nog niet bij een medewerker. Pas het adres aan zoals bij stap 3 en herlaad de pagina.

### Stap 6. Collega's toevoegen

Twee manieren, ook door elkaar:
- **Beheer → Medewerkers → Medewerker toevoegen.** Met een werkmail krijgt iemand meteen een account en kan inloggen.
- **Beheer → Import:**
  1. download het lege sjabloon;
  2. vul de tabbladen *Medewerkers*, *Vaste roosters* en *Afwezigheid*;
  3. upload het bestand en klik op **Controleren**. Je ziet precies wat er verandert en welke fouten er zijn. Er wordt nog niets opgeslagen;
  4. klik op **Importeren**.

  Een bestand nog een keer importeren maakt geen dubbelingen, en de import verwijdert nooit iets. Medewerkers koppelen op naam (hoofdletters tellen niet mee).

---

## Een fase testen en live zetten

Elke fase komt als pull request op GitHub, met daarin de handmatige stappen en een testlijstje.

1. Heeft de fase een SQL-bestand (`supabase/setup/fase-N.sql`)? Draai dat eerst in de SQL Editor van Supabase.
2. Open de **deploy preview**: de link staat in de pull request, bijvoorbeeld `https://deploy-preview-1--planbord.netlify.app`.
3. Loop het testlijstje uit de pull request door, het liefst op je telefoon.
4. Alles goed? **Merge** de pull request. Netlify zet `main` dan automatisch live.
5. Iets niet goed? Zet een opmerking in de pull request.

---

## Agenda koppelen (uitleg voor collega's)

1. Open **Agenda** in Planbord en kies **Link maken** bij de agenda die je wilt.
2. Tik op **Toevoegen aan agenda**, of kopieer de link:
   - **iPhone:** Instellingen → Agenda → Accounts → Voeg account toe → Andere → Voeg agenda-abonnement toe → plak de link.
   - **Google Agenda** (op een computer): naast *Andere agenda's* op **+** → **Via URL** → plak de link.
   - **Outlook:** Agenda toevoegen → **Abonneren via internet** → plak de link.
3. Je ziet de link maar één keer. Kwijt? Maak een nieuwe; de oude werkt dan niet meer.

Agenda-apps halen de link zelf opnieuw op. Apple doet dat meestal binnen een uur. Google en Outlook doen het soms pas na uren, tot een dag. Sneller kan niet.

---

## Privacy en beveiliging

- Planbord bewaart alleen wat de planning nodig heeft: naam, werkmail, groep, rol, waar iemand mag invallen, vaste diensten, roosterwijzigingen, afwezigheid en invallen.
- Afwezigheid heeft geen reden en geen soort. Alles heet "Afwezig".
- Een e-mailadres zien alleen beheerders en de medewerker zelf. Het staat nooit in roosters, feeds of het logboek.
- Elke tabel is beveiligd met row level security. De rechten worden ook in de app zelf nog een keer gecontroleerd.
- De secret key staat alleen op de server.
- Een agendalink bevat 32 willekeurige bytes. De database bewaart alleen de hash; wie de database leest, kan er geen link mee maken.
- Het logboek is alleen voor beheerders, zonder e-mailadressen of andere gevoelige inhoud. Regels ouder dan 12 maanden verdwijnen vanzelf.
- Geen trackers, geen analytics, geen externe scripts of lettertypen. Zoekmachines mogen niets indexeren.

---

## Ontwikkelen

Nodig: Node 22.18 of nieuwer.

```bash
npm ci
cp .env.example .env.local   # vul de waarden van een Supabase-project in
npm run dev                  # http://localhost:3000
```

| Commando | Wat het doet |
|---|---|
| `npm run dev` | lokale ontwikkelserver |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript-controle |
| `npm run test` | unit-tests en databasetests (Vitest) |
| `npm run build` | productiebuild; slaagt ook zonder sleutels |
| `npm run db:bundle` | bundelt de migraties tot `supabase/setup/fase-N.sql` |
| `npm run icons` | tekent de app-iconen opnieuw |

- Vóór elke push moeten `lint`, `typecheck`, `test` en `build` slagen.
- De databasetests draaien alle migraties op [PGlite](https://pglite.dev), een Postgres in het testproces. Docker of een eigen database is niet nodig.
- **Een databasewijziging:**
  1. maak een nieuw bestand in `supabase/migrations/` (`YYYYMMDDHHMMSS_naam.sql`); pas een uitgeleverde migratie nooit meer aan;
  2. zet het in `supabase/setup/phases.json` bij de juiste fase;
  3. draai `npm run db:bundle`. Een test controleert of de bundel actueel is.
- Alle rooster-, verlof-, sluitingsdag- en vervangingslogica staat in pure functies in `src/lib/engine/`, met tests ernaast. Geen AI of taalmodel: dezelfde invoer geeft altijd dezelfde voorstellen.

### Bekende punten

- **`middleware.ts` in plaats van `proxy.ts`.** Next.js 16 noemt `middleware` verouderd en toont daarover een waarschuwing bij de build. Die is te verwachten. Netlify kan een `proxy.ts` nu niet verpakken (opennextjs-netlify #3171, #3562 en #3575); zie §16 van het plan.
- **Tijdvelden** tonen de tijd zoals het toestel is ingesteld. Op een Nederlands ingesteld toestel is dat 24-uurs.
- **Supabase gratis:**
  - pauzeert een project na een week zonder gebruik; met dagelijks gebruik en agendafeeds gebeurt dat niet;
  - staat maximaal twee actieve gratis projecten per account toe; gepauzeerde projecten tellen niet mee;
  - maakt geen back-ups.
- **Supabase Pro** kost ongeveer $25 per maand per organisatie en maakt dagelijks een back-up die 7 dagen bewaard blijft. Voor een rooster waar het team op leunt, is dat het overwegen waard.
