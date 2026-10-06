# CLAUDE.md: vaste afspraken voor Planbord

Planbord is de rooster- en verlofapp van het verhuurteam. De opdracht in `docs/SPEC.md` is leidend. Het plan per fase staat in `docs/PLAN-fase-N.md`. Wijkt dit bestand af van de spec, dan geldt de spec en pas je dit bestand aan.

## Werkwijze
- Werk fase voor fase. Schrijf pas code als de eigenaar het plan van die fase heeft goedgekeurd. Begin pas aan een volgende fase na "ga verder met fase X".
- Is een bedrijfsregel onduidelijk, vraag het dan. Maak geen stille aannames: zet elke keuze expliciet in het plan of de pull request.
- Werk per fase op een eigen branch, in kleine commits met een duidelijke boodschap.
- Vóór elke push moeten alle vier slagen: `npm run lint`, `npm run typecheck`, `npm run test` en `npm run build`.
- Sluit een fase af met een pull request. Zet daarin een samenvatting, de handmatige stappen voor de eigenaar (SQL, Supabase-instellingen, omgevingsvariabelen) en een testlijstje. Stop daarna en wacht.

## Stack
- Next.js 16 (App Router) met React 19, TypeScript 6 (strict) en Tailwind CSS 4. Node 22.
  - TypeScript 7 nog niet gebruiken: die versie heeft de JS-API niet die Next.js en typescript-eslint nodig hebben.
- Supabase in een EU-regio:
  - Auth met een e-mailcode (OTP);
  - Postgres met RLS;
  - clients via `@supabase/ssr` en `@supabase/supabase-js`.
- Hosting op Vercel (team van 22labs, betaald), met previews per pull request (besluit V32). De server draait in Frankfurt (`fra1`), naast de database. De instellingen staan in `vercel.json`.
- Tests met Vitest. Databasetests draaien op PGlite met een nagebootst `auth`-schema.
- Excel: `read-excel-file` voor de import en `write-excel-file` voor het sjabloon en de export, allebei actief onderhouden.
  - Niet `exceljs`: sinds 2023 geen release meer en er staat een audit-waarschuwing open.
  - Niet `xlsx` van npm: die versie is verouderd.
- Mail (fase 3): `nodemailer` via SMTP, met de Google Workspace-mailbox van de eigenaar (besluit V16). Niet Resend: dat vraagt DNS-records.
- Geplande taken: Vercel Cron, in `vercel.json` (besluit V32). Ze draaien alleen op de gepubliceerde site, niet op een preview.
  - Elk uur `/taken/herinneringen` (fase 3). Vercel roept die aan met GET en stuurt `CRON_SECRET` mee als Bearer-token.
  - Overdag elke 5 minuten `/taken/wakker` (besluit V31), zodat de server niet in slaap valt. Die route doet niets en raakt de database niet, dus geen geheim.
- Pushmeldingen (fase 4): web push volgens RFC 8030, 8291 en 8292, zelf gebouwd met `node:crypto`. Niet het pakket `web-push`: sinds januari 2024 geen release meer.
  - Sleutels: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (geheim) en `VAPID_SUBJECT`.
  - De service worker `public/sw.js` toont alleen meldingen (besluit V23).

## Commando's
| Commando | Wat het doet |
|---|---|
| `npm run dev` | lokale ontwikkelserver |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest: unit-tests en PGlite-databasetests |
| `npm run build` | productiebuild; moet slagen zonder echte sleutels |
| `npm run db:bundle` | bundelt de migraties tot `supabase/setup/fase-N.sql` |
| `npm run icons` | tekent de app-iconen en de favicon opnieuw |

## Codeafspraken
- Engels voor code, bestandsnamen, tabellen, kolommen en variabelen.
- Nederlands voor alle tekst die een gebruiker ziet, ook foutmeldingen. Ook de URL's zijn Nederlands: `/rooster`, `/verlof`, `/agenda`, `/beheer`.
- Tijdzone overal Europe/Amsterdam.
  - Een kalenderdatum is een ISO-string `YYYY-MM-DD`.
  - Bepaal "vandaag" altijd in Europe/Amsterdam, nooit in de tijdzone van de server.
  - Weergave: datums als "di 14 okt", tijden 24-uurs ("07:30"), een tijdvak met en-dash ("07:30–18:00").
- Alle rooster-, sluitingsdag- en verloflogica staat in pure functies in `src/lib/engine/`. In fase 2 komt de vervangingslogica erbij.
  - Geen databasetoegang, geen `Date.now()` en geen omgevingsvariabelen. Gegevens en "nu" komen binnen als parameter.
  - Deterministisch: dezelfde invoer geeft altijd dezelfde uitvoer, in dezelfde volgorde.
- De ICS-opbouw (`src/lib/ics/`), de Excel-import (`src/lib/import/`), de export (`src/lib/export/`), de mails (`src/lib/mail/`) en de pushmeldingen (`src/lib/push/`) zijn ook puur en los te testen, behalve het versturen zelf.
- Lees een omgevingsvariabele pas uit in de functie die haar gebruikt, nooit bovenin een module. De build moet slagen zonder sleutels.
- Schrijfacties lopen via server actions met de sessie van de gebruiker. Valideer de invoer op de server en controleer de rechten twee keer: in de action én via RLS.
- Een pagina laadt haar gegevens met `requireViewerWith` of `requireAdminWith` (besluit V31): tegelijk met de controle wie er kijkt, niet erna. Hebben de gegevens de kijker nodig, dan eerst `requireViewer()`.
- Mobile-first: ontwerp eerst voor een telefoon, met grote tikvlakken en weinig JavaScript op de client.
- Geen AI of taalmodel in de roosterlogica.
- Geen trackers, analytics, externe fonts of scripts van derden. Ook geen Vercel Analytics of Speed Insights.
- Laat geen enkele pagina indexeren: noindex in de metadata, een `X-Robots-Tag`-header en een `robots.txt` die alles blokkeert.
- De uitleg voor collega's (`/uitleg`, besluit V30) is de enige pagina zonder inloggen naast `/inloggen`. Ze toont geen gegevens uit de database.
  - De teksten staan in `src/lib/guide/topics.ts`, de video's en de PDF in `public/uitleg`.
  - De bron van de video's staat in `tools/uitleg-video/`: buiten de app en de build.

## Database
- Schrijf elke wijziging als migratie in `supabase/migrations/`, met als naam `YYYYMMDDHHMMSS_naam.sql`. Pas een migratie die al is uitgeleverd nooit meer aan; maak een nieuwe.
- Lever per fase één bundel `supabase/setup/fase-N.sql` om in de SQL-editor te plakken. Genereer die met `npm run db:bundle`; een test controleert of de bundel actueel is.
- Alle SQL moet twee keer achter elkaar kunnen draaien:
  - `create ... if not exists` en `create or replace`;
  - `drop policy if exists` gevolgd door `create policy`;
  - seeds met `on conflict do nothing`.
- RLS staat aan op élke tabel.
- Vertrouw niet op standaardrechten:
  - trek per tabel eerst alles in (`revoke all ... from anon, authenticated`) en geef daarna expliciete `grant`s;
  - `anon` krijgt alleen iets als het echt nodig is (in fase 1 niets).
- Hulpfuncties voor policies staan in schema `private`, als `security definer` met `set search_path = ''`. Het gaat om `private.current_employee_id()` en `private.is_admin()`.
- Voor RPC-functies in `public`: `revoke execute ... from public, anon` en geef alleen `grant` aan wie ze echt nodig heeft.

## Privacy (harde regels)
- Sla alleen op wat de planning nodig heeft: naam, werkmail, groep, rol, waar iemand mag invallen, vaste diensten, afwezigheid en invallen.
  - Sinds fase 4 ook de push-abonnementen van de eigen toestellen van een medewerker (besluit V28).
- Afwezigheid heeft géén reden, soort of vrij tekstveld. Alles heet "Afwezig".
- Beheerders zien per medewerker wanneer die voor het laatst inlogde en op hoeveel toestellen meldingen aanstaan (besluit V38).
  - Het tijdstip komt uit Supabase Auth, via `public.employee_sign_ins()`, die alleen beheerders mogen aanroepen. Planbord slaat daarvoor niets extra op en legt geen gebruik van de app vast.
  - Collega's lezen dat in de uitleg.
- E-mailadressen staan alleen in `employee_accounts`.
  - Alleen beheerders en de medewerker zelf kunnen die tabel lezen.
  - Nooit een e-mailadres in roosters, feeds, het logboek of in meldingen die anderen zien.
- De secret key (service role) blijft op de server.
  - Een module die hem gebruikt, begint met `import 'server-only'`. Nooit in de client-bundel en nooit in een `NEXT_PUBLIC_`-variabele.
  - Alleen gebruiken voor:
    - accountbeheer: aanmaken, e-mailadres wijzigen en inloggen blokkeren als iemand op inactief staat (besluit V4 in het plan van fase 1);
    - agendafeeds serveren;
    - (fase 3) de geplande taak voor mails: herinneringen versturen (sinds fase 4 ook als push), mislukte mails opnieuw proberen en een gemailde vervallen inval afhandelen. Die taak heeft geen sessie en leest dan de werkmails (besluit V17 in het plan van fase 3);
    - (fase 3) een medewerker volledig verwijderen.
- Een agendatoken bestaat uit minstens 32 willekeurige bytes. De database bewaart alleen de SHA-256-hash.
- Het logboek legt vast wie wat wanneer deed. Het is alleen zichtbaar voor beheerders.
  - Geen e-mailadressen, tokens of namen als tekst; verwijs naar id's.
- Mails (fase 3) gaan alleen naar de medewerker zelf, en alleen over het eigen rooster. De uitnodiging (besluit V33) gaat over Planbord zelf: een link naar de app en de uitleg, nooit een inloglink.
  - Geen namen van anderen, geen reden van afwezigheid en geen andere e-mailadressen.
  - Geen plaatjes, trackers of leesbevestigingen.
  - De wachtrij `mail_queue` bewaart geen adressen en geen tekst; de tekst ontstaat pas bij het versturen.
  - Zonder de schakelaar "Meldingen versturen" (tot fase 4: "Mails versturen") gaat er geen mail of push naar collega's. De testmail en de testmelding gaan alleen naar jezelf.
  - Uitzondering: een uitnodiging die een beheerder zelf verstuurt, gaat ook als de schakelaar uit staat (besluit V33).
- Pushmeldingen (fase 4) volgen dezelfde regels als mails.
  - Alleen naar de eigen toestellen van de medewerker, en alleen over het eigen rooster.
  - De inhoud is versleuteld per toestel. Nooit namen van anderen of een reden van afwezigheid.
  - Een push-abonnement zien alleen de medewerker zelf en beheerders (om te versturen). Elders alleen aantallen, nooit het adres of de sleutels.
  - Alleen naar https-adressen van de bekende pushdiensten: Apple, Google, Mozilla en Microsoft.
- Nooit echte medewerkergegevens, secrets of `.env`-bestanden in de repo. Testdata en fixtures zijn fictief.
  - Dat geldt ook voor schermafbeeldingen, video's en de PDF van de uitleg (besluit V30): alleen het verzonnen team.

## Teststrategie
- Schrijf Vitest-unit-tests voor alles in `src/lib/engine/`, `src/lib/ics/`, `src/lib/import/`, `src/lib/export/`, `src/lib/mail/` en `src/lib/push/`. Een test staat naast de code als `*.test.ts`.
- Tests versturen nooit een echte mail of push: het versturen gaat via een transport dat je in tests vervangt.
- Er is één gedeelde, fictieve teamfixture: `src/lib/engine/__fixtures__/team.ts`. Die heeft dezelfde opbouw als het echte team (zie SPEC, "Tests").
- De databasetests in `supabase/tests/` draaien alle migraties op PGlite, met een nagebootst `auth`-schema en de rollen `anon`, `authenticated` en `service_role`. Ze controleren:
  - RLS en grants;
  - constraints en de seed;
  - dat de setup-bundel twee keer achter elkaar kan draaien.
- Fix je een bug, schrijf dan eerst een test die faalt.
- Schermen worden hier niet end-to-end getest; de eigenaar test via de preview van Vercel. Houd pagina's daarom dun en zet de logica in geteste functies.

## Niet doen
- Geen verlofsaldo's, ziekteverzuim, urenregistratie of salaris.
- Niet lezen of schrijven in iemands eigen agenda. Geen koppeling met Microsoft 365, Outlook of MyHR.
- Nooit zelf een inval toewijzen: daar is altijd akkoord van een beheerder voor nodig.
- Nooit iets stilletjes verwijderen of overschrijven. Elke wijziging komt in het logboek.
- Geen offline-modus, en geen analytics of tracking.
  - Een service worker alleen voor pushmeldingen (besluit V23): geen cache en geen `fetch`-handler.
- Geen magic links. Inloggen gaat alleen met de 6-cijferige code, met `shouldCreateUser: false`.
