# Planbord

De rooster- en verlofapp van het verhuurteam. Planbord vervangt de Excel: wie werkt wanneer en waar, wie is afwezig, en welke dagen zijn we dicht.

De opdracht staat in [`docs/SPEC.md`](docs/SPEC.md). Het plan per fase staat in [`docs/PLAN-fase-1.md`](docs/PLAN-fase-1.md), [`docs/PLAN-fase-2.md`](docs/PLAN-fase-2.md), [`docs/PLAN-fase-3.md`](docs/PLAN-fase-3.md) en [`docs/PLAN-fase-4.md`](docs/PLAN-fase-4.md). De vaste afspraken voor de code staan in [`CLAUDE.md`](CLAUDE.md).

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
  - Bovenaan staat een overzicht per week: hoeveel gaten en op welke dagen, ook voor weken met niets te regelen. Een tik springt naar die week (V34).
  - Je ziet de drie beste invallers, met de reden in gewone taal.
  - Met **Inzetten** wijs je iemand toe. Planbord wijst nooit zelf iemand toe.
  - Een gat kun je **negeren**. Het komt terug als het tekort groter wordt.
- **Impactcheck:** bij nieuwe of gewijzigde afwezigheid zie je eerst welke gaten ontstaan en welke invallen vervallen. Opslaan mag altijd.
- **Let op:** invallen die niet meer nodig zijn, of opnieuw geregeld moeten worden omdat de invaller zelf afwezig is. Ze blijven staan tot je op **Afgehandeld** klikt. Na een wijziging van een vaste dienst of sluitingsdag toont het overzicht welke invallen niet meer kloppen; met **Invallen bijwerken** pas je ze aan.
- **Rooster voor één dag:** geen dienst, een andere dienst, of de dienst verplaatsen naar een andere dag. Klik in het rooster op een naam.
- **Invallen:** de lijst van komende en recente invallen. **Intrekken** verwijdert niets: de inval krijgt de status *niet meer nodig*.

### Fase 3: de extra's

**Voor iedereen**
- **Mails over je eigen rooster**, zodra een beheerder mails heeft aangezet:
  - meteen een mail als je ergens invalt, als een inval niet doorgaat, of als je rooster voor één dag verandert;
  - om 16:00 de dag ervoor een herinnering als je rooster die dag afwijkt van je vaste rooster. Voor maandag komt die op zondag;
  - geen mail bij afwezigheid, vaste diensten of sluitingsdagen.
- Een mail gaat alleen over je eigen rooster: geen namen van collega's en geen reden van afwezigheid. Geen plaatjes en geen trackers.
- **Rooster als Excel:** onderaan het Rooster-scherm download je het rooster voor een periode naar keuze.
  - Per vestiging een tabblad, en de weken onder elkaar. Handig om te printen.
  - Er staat niets in wat je niet ook op het scherm ziet: geen e-mailadressen en geen redenen.

**Voor beheerders**
- **Instellingen → Mails:**
  - de schakelaar **Mails versturen** (sinds fase 4: **Meldingen versturen**); die staat eerst uit;
  - **Testmail naar mij**;
  - een voorbeeld van de herinneringen voor morgen: wie er een krijgt, en met welk onderwerp.
- Na een actie zie je of de mail is verstuurd.
  - Is de mail over een vervallen inval verstuurd, dan is die inval vanzelf afgehandeld. Hij verdwijnt dan uit *Let op*.
  - Mislukt een mail, dan probeert Planbord het elk uur opnieuw, hooguit drie keer.
- **Mails:** de mails van de laatste 30 dagen, met hun status: verstuurd, mislukt of niet verstuurd. Met namen, zonder e-mailadressen en zonder inhoud.
- **Export:**
  - het rooster als Excel, net als iedereen (zie hierboven);
  - de hele planning als Excel, in het formaat van de import, plus de invallen en roosterwijzigingen;
  - bij een medewerker **Gegevens downloaden**: alles wat Planbord over die persoon bewaart, bijvoorbeeld voor een inzageverzoek;
  - de export van de planning en de gegevens van een medewerker komen in het logboek. Het rooster niet: daarin staat niets wat niet op het scherm staat.
- **Volledig verwijderen:**
  - alleen bij een inactieve medewerker, met eerst een overzicht van wat er verdwijnt. Je typt de naam over om te bevestigen;
  - ook het inlogaccount verdwijnt;
  - het logboek houdt één regel met de aantallen, zonder naam.

### Fase 4: pushmeldingen

**Voor iedereen**
- **Meldingen op dit toestel**, onderaan Mijn rooster. Wie wil, zet ze aan op de eigen telefoon of computer.
  - Je krijgt een melding op dezelfde momenten als de mail: als je ergens invalt, als een inval niet doorgaat, als je rooster voor één dag verandert, en om 16:00 als je rooster morgen afwijkt.
  - Bijvoorbeeld "Je valt in op wo 14 okt in Eindhoven (07:30–18:00)". Een tik opent Mijn rooster.
  - De push komt naast de mail; de mail blijft de betrouwbare weg.
- Op een iPhone werkt het alleen vanuit Planbord op het beginscherm, vanaf iOS 16.4.

**Voor beheerders**
- **Instellingen:**
  - de schakelaar heet nu **Meldingen versturen** en geldt voor mail én push;
  - de knop **Testmelding naar mij** stuurt een melding naar je eigen toestellen;
  - zolang push niet is ingesteld, maak je hier de sleutels voor pushmeldingen.
- **Mails:** bij elke mail staat naar hoeveel toestellen de push ging.
- **Medewerker:** hoeveel toestellen meldingen aan hebben. Volledig verwijderen neemt die mee, en de gegevensexport noemt ze, zonder het adres van het toestel.

### Uitleg voor collega's

- **De pagina `/uitleg`**, te openen zonder in te loggen. Er staan negen korte video's op, met de stappen eronder:
  - welkom;
  - op je beginscherm (iPhone en Android);
  - inloggen met je code;
  - je rooster lezen;
  - meldingen aanzetten (iPhone en Android);
  - je rooster in je agenda;
  - vakantie of afwezig.
- **Een PDF** met dezelfde stappen, plaatjes en een QR-code naar de video's. Je downloadt hem bovenaan de pagina.
- **Waar de link staat:** op de inlogpagina ("Nieuw hier? Bekijk de uitleg") en in de kop van de app ("Uitleg").
- De video's tonen een verzonnen team en hebben geen geluid. Ze staan bij de app zelf, niet op YouTube, dus er komen geen trackers mee.
- Zie besluit V30 in het plan van fase 4. De bron van de video's staat in [`tools/uitleg-video/`](tools/uitleg-video/README.md).

### Collega's uitnodigen

- **Iedereen tegelijk:** Beheer → Medewerkers → **Iedereen uitnodigen**.
  - Dat gaat naar iedereen die actief is, een inlogaccount heeft en nog geen uitnodiging kreeg.
  - Jijzelf krijgt er geen. Je bevestigt eerst, met het aantal erbij.
- **Eén collega:** Beheer → Medewerkers → de naam → blok Inloggen → **Uitnodiging sturen**.
  - Daarna zie je "Uitgenodigd op …" en kun je hem opnieuw sturen.
  - De lijst toont het label *uitgenodigd*.
- **De mail:**
  - alleen naar de eigen werkmail, met de voornaam;
  - een link naar Planbord en naar de uitleg;
  - hoe inloggen gaat: met de code uit de mail, zonder wachtwoord.
  - Er staat geen inloglink in en er zitten geen plaatjes of trackers in.
- **Ook als Meldingen versturen uit staat.** Zo kun je iedereen uitnodigen voordat herinneringen en meldingen aan gaan.
- **Mislukt het versturen,** dan probeert Planbord het elk uur opnieuw. Elke uitnodiging staat onder Beheer → Mails.
- Zie besluit V33 in het plan van fase 4.

### Snelheid

- **Een laadscherm.** Na een tik zie je meteen een opzet van de pagina, terwijl de gegevens nog onderweg zijn.
- **Minder wachten.** Een pagina haalt haar gegevens op terwijl Planbord nog controleert wie er kijkt, in plaats van erna.
- **Warm houden.** Van 's ochtends vroeg tot 's avonds laat houdt een geplande taak de server wakker. Zo duurt de eerste pagina na een rustige periode geen paar seconden meer.
- **Server in Frankfurt.** Sinds de overstap naar Vercel (besluit V32) draait de server naast de database.
- Nog iets sneller kan met nieuwe inlogsleutels in Supabase; zie stap 9. Zie ook de besluiten V31 en V32 in het plan van fase 4.

---

## Eenmalig: de app in de lucht zetten

Volg de stappen op volgorde. Reken op ongeveer een uur. De namen in de dashboards van Supabase en Vercel kunnen iets afwijken van wat hier staat; ze veranderen af en toe.

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
4. Doe daarna hetzelfde met [`supabase/setup/fase-2.sql`](supabase/setup/fase-2.sql), [`supabase/setup/fase-3.sql`](supabase/setup/fase-3.sql) en [`supabase/setup/fase-4.sql`](supabase/setup/fase-4.sql). Gebruik voor elk bestand een nieuwe query, en houd die volgorde aan.

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
   - **Site URL:** het adres van de app: `https://planbord-ten.vercel.app` (dat weet je na stap 4). Komt er later een eigen domein, zet dat dan hier.
   - **Redirect URLs:** niet nodig. Planbord gebruikt geen inloglinks.

### Stap 3. Sleutels opzoeken

In Supabase onder **Project Settings**:
- **Data API** (of **API**): de **Project URL**, bijvoorbeeld `https://abcd.supabase.co`.
- **API Keys:**
  - de **Publishable key** (`sb_publishable_…`): mag in de browser;
  - een **Secret key** (`sb_secret_…`): **geheim**, alleen voor de server. Deel hem nooit en zet hem nooit in de repo.

Heeft je project alleen de oude sleutels (`anon` en `service_role`)? Dat werkt ook: gebruik dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `SUPABASE_SERVICE_ROLE_KEY` als namen in stap 4.

### Stap 4. Vercel

Planbord draait bij Vercel, in het betaalde team van 22labs (besluit V32). Het gratis plan van Vercel mag niet voor een bedrijf.

1. Ga naar [vercel.com](https://vercel.com), kies het team van 22labs en klik op **Add New → Project**. Kies bij **Import Git Repository** deze repository.
   - Ziet Vercel de repository niet? Geef de GitHub-app van Vercel er dan toegang toe (**Configure GitHub App**).
   - **Framework Preset:** Next.js. Dat vult Vercel zelf in.
   - **Project Name:** `planbord`. Was dat adres al bezet, dan plakt Vercel er iets achter. Bij ons werd het `https://planbord-ten.vercel.app`. Je ziet het adres op de overzichtspagina van het project, onder **Domains**.
   - Laat de build-instellingen staan. De regio (Frankfurt), het bouwcommando en de geplande taken staan in [`vercel.json`](vercel.json), en Node 22 staat in `package.json`.
2. Zet onder **Environment Variables** de waarden hieronder, voor **Production** en **Preview**. Dat kan vóór de eerste deploy, of later onder **Settings → Environment Variables**.

   | Naam | Waarde | Let op |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | de Project URL | |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | de Publishable key | |
   | `SUPABASE_SECRET_KEY` | de Secret key | zet **Sensitive** aan |
   | `SITE_URL` | het adres van de gewone app: `https://planbord-ten.vercel.app` | ook voor Preview: dan gaan agendalinks en de link in mails vanuit een preview naar de gewone app. Leeg = het adres waarop de app draait |

   - Vercel zet de `NEXT_PUBLIC_`-waarden bij het bouwen in de app. Pas je een waarde aan, start dan een nieuwe deploy: **Deployments** → de bovenste → **⋯ → Redeploy**.
   - De secret key gebruikt de app alleen op de server:
     - voor accountbeheer: aanmaken, e-mailadres wijzigen en blokkeren bij inactief;
     - om agendafeeds te serveren;
     - voor de geplande taak voor mails;
     - om een medewerker volledig te verwijderen.
   - Voor de mails komen er in stap 7 nog een paar waarden bij.
3. **Previews.** Vercel maakt bij elke pull request vanzelf een preview en zet de link in de pull request. Een preview open je alleen als je in het team bij Vercel bent ingelogd. De gewone app is voor iedereen bereikbaar; zonder inlogcode zie je er niets, en zoekmachines mogen niets indexeren.
4. **Geen meetdiensten.** Laat **Analytics** en **Speed Insights** uit. Zet ook de **Vercel Toolbar** uit, onder **Settings** (zoek op "Toolbar"). Planbord blokkeert hem toch.
5. **Eigen domein?** Stel het in onder **Settings → Domains**. Pas daarna de **Site URL** in Supabase en `SITE_URL` in Vercel aan.

> Previews en productie gebruiken dezelfde Supabase-database, tenzij je per omgeving andere waarden instelt. Vóór de livegang is dat prima. Daarna kun je voor de previews een tweede Supabase-project maken en die sleutels alleen voor **Preview** zetten.

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

### Stap 7. Mails (fase 3)

Planbord mailt via de Google Workspace-mailbox die ook de inlogcodes verstuurt (besluit V16 in het plan van fase 3). Aan je DNS verandert niets.

1. **App-wachtwoord.** Maak een apart app-wachtwoord, alleen voor Planbord:
   - log in met die mailbox en open [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords). *Verificatie in twee stappen* moet aan staan;
   - noem het `Planbord` en kopieer het wachtwoord van 16 letters, zonder spaties;
   - trek je het later in, dan stopt alleen Planbord met mailen. De inlogcodes van Supabase blijven werken.
2. **Een geheim voor de geplande taak** (`CRON_SECRET`): een willekeurige tekst van minstens 32 tekens.
   - Het makkelijkst: de wachtwoordgenerator van je wachtwoordkluis, bijvoorbeeld 48 tekens met letters en cijfers.
   - Of in PowerShell op Windows:
     ```powershell
     $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
     ```
   - Of op een Mac of Linux: `openssl rand -base64 32`.
3. **Vercel → Settings → Environment Variables**, voor Production en Preview:

   | Naam | Waarde | Let op |
   |---|---|---|
   | `SMTP_HOST` | `smtp.gmail.com` | |
   | `SMTP_PORT` | `465` | |
   | `SMTP_USER` | het adres van de mailbox | |
   | `SMTP_PASSWORD` | het app-wachtwoord | zet **Sensitive** aan |
   | `MAIL_FROM` | `Planbord <adres van de mailbox>` | de afzender die collega's zien |
   | `CRON_SECRET` | het geheim uit stap 2 | zet **Sensitive** aan. Vercel stuurt het mee als de geplande taak de app aanroept |

   - De namen moeten precies zo heten: de app leest alleen deze namen. Bewaar je de waarden ook in een wachtwoordkluis of een secret manager, dan mogen ze daar anders heten.
   - De link in de mail gaat naar `SITE_URL` (stap 4). Zonder `SITE_URL` gaat hij naar het adres waarop de app draait.
   - Start daarna een nieuwe deploy (**Deployments** → de bovenste → **⋯ → Redeploy**), zodat de app de nieuwe waarden gebruikt.
4. **Eerst testen**, in Planbord onder **Beheer → Instellingen**:
   1. Klik op **Testmail naar mij**. Die gaat naar je eigen werkmail, ook als mails nog uit staan.
   2. Bekijk het voorbeeld van de herinneringen voor morgen.
   3. Werkt de testmail, dan kun je je collega's uitnodigen: Beheer → Medewerkers → **Iedereen uitnodigen**. Dat kan al voordat je **Meldingen versturen** aanzet.
   4. Zet daarna pas **Meldingen versturen** aan (tot fase 4 heette die schakelaar **Mails versturen**).

   Previews en de gewone app delen één database. Staat de schakelaar aan, dan gaan ook mails van acties in een preview echt naar collega's.
5. **De geplande taak** draait elk uur, alleen op de gepubliceerde site en niet op een preview.
   - Wat de taak doet:
     - om 16:00 de herinneringen voor morgen versturen. De app bepaalt zelf wanneer het 16:00 is in Nederland, ook met zomer- en wintertijd;
     - mislukte mails opnieuw proberen;
     - de wachtrij opruimen.
   - Controleren: Vercel → **Settings → Cron Jobs**. Daar staan de taken uit `vercel.json`, met een knop om ze met de hand te starten. Wat er gebeurde, zie je onder **Logs**.
   - Laat de beveiliging van Vercel (**Deployment Protection**) op de standaard staan. Die beschermt alleen previews; zou ze ook de gewone app afschermen, dan komt de geplande taak er niet door.

### Stap 8. Pushmeldingen (fase 4)

1. **Supabase:** draai [`supabase/setup/fase-4.sql`](supabase/setup/fase-4.sql) in de SQL Editor, na fase 1 tot en met 3.
   - Komt er later iets bij in dit bestand, zoals de uitnodiging (V33), draai het dan opnieuw. Dat is veilig: bestaande gegevens blijven staan.
2. **Sleutels maken:** ga in Planbord naar **Beheer → Instellingen → Sleutels voor pushmeldingen** en klik op **Sleutels maken**.
   - Je eigen browser maakt het sleutelpaar. Het gaat niet naar de server en wordt nergens bewaard.
   - Laad je de pagina opnieuw, dan zijn de sleutels weg. Maak dan gewoon nieuwe.
3. **Vercel → Settings → Environment Variables:** zet de drie waarden erin, voor Production en Preview.

   | Naam | Waarde | Sensitive |
   |---|---|---|
   | `VAPID_PUBLIC_KEY` | de publieke sleutel | nee |
   | `VAPID_PRIVATE_KEY` | de privésleutel | **ja** |
   | `VAPID_SUBJECT` | `mailto:` met je werkmail, bijvoorbeeld `mailto:info@22labs.nl` | nee |

   - Start daarna een nieuwe deploy. Deel de privésleutel nooit via chat of mail.
   - Vervang je de sleutels later, dan moet iedereen de meldingen op zijn toestel opnieuw aanzetten.
4. **Op je eigen telefoon:**
   1. Zet Planbord op je beginscherm (zie de uitleg hieronder) en open het via het icoon.
   2. Ga naar Mijn rooster → onderaan **Meldingen aanzetten** → sta meldingen toe.
   3. Ga naar Beheer → Instellingen → **Testmelding naar mij**.
5. **Meldingen versturen** staat aan of uit voor mail én push. Een testmelding gaat ook als de schakelaar uit staat.

### Stap 9. Sneller (optioneel)

De server staat al in Frankfurt, naast de database (V32), en het warm houden (V31) werkt vanzelf. Eén instelling maakt Planbord nog iets sneller:

1. **Nieuwe inlogsleutels in Supabase.** Dit is gratis en mijn aanrader.
   - Ga in Supabase naar **Project Settings → JWT Keys**.
   - Staat bij de huidige sleutel **Legacy JWT secret**? Klik dan op **Migrate JWT secret** en daarna op **Rotate keys**.
   - Staat er al een sleutel van het type ECC of RSA? Dan hoef je niets te doen.
   - Niemand wordt uitgelogd. In Vercel verandert niets: de publishable key en de secret key blijven hetzelfde.
   - Daarna controleert Planbord de inlog zelf. Nu vraagt het dat bij elke pagina aan Supabase.

---

## Een fase testen en live zetten

Elke fase komt als pull request op GitHub, met daarin de handmatige stappen en een testlijstje.

1. Heeft de fase een SQL-bestand (`supabase/setup/fase-N.sql`)? Draai dat eerst in de SQL Editor van Supabase.
2. Open de **preview**: Vercel zet de link in de pull request. Je moet daarvoor in het team bij Vercel zijn ingelogd.
3. Loop het testlijstje uit de pull request door, het liefst op je telefoon.
4. Alles goed? **Merge** de pull request. Vercel zet `main` dan automatisch live.
5. Iets niet goed? Zet een opmerking in de pull request.

---

## De uitleg doorsturen

- **Stuur de link** naar het adres van Planbord met `/uitleg` erachter, nu `https://planbord-ten.vercel.app/uitleg`. Daar staan alle video's en de PDF.
- **Of laat Planbord het doen:** de uitnodiging (Beheer → Medewerkers → **Iedereen uitnodigen**) bevat de link naar de app en naar de uitleg. Zie [Collega's uitnodigen](#collegas-uitnodigen).
- **Liever losse bestanden?** De PDF download je bovenaan die pagina.
- **De video's in hoge kwaliteit** (1080 × 1920), bijvoorbeeld voor de groepsapp, staan niet in de repo. Je krijgt ze los bij de oplevering. Opnieuw maken kan met [`tools/uitleg-video/`](tools/uitleg-video/README.md) (`node render.mjs`).

## Meldingen op je telefoon (uitleg voor collega's)

1. **Zet Planbord op je beginscherm.**
   - **iPhone:** open Planbord in Safari, tik op de deelknop en kies **Zet op beginscherm**. Open Planbord voortaan via dat icoon. Meldingen werken alleen zo, en vanaf iOS 16.4.
   - **Android:** open Planbord in Chrome, tik op het menu (⋮) en kies **App installeren** of **Toevoegen aan startscherm**.
2. Ga naar **Mijn rooster** en tik onderaan op **Meldingen aanzetten**. Kies **Toestaan** als je telefoon het vraagt.
3. Je krijgt een melding als je ergens invalt, als een inval niet doorgaat, als je rooster voor één dag verandert, en om 16:00 als je rooster morgen afwijkt. De mail blijft ook komen.
4. Uitzetten kan op dezelfde plek. Heb je eerder **Niet toestaan** gekozen? Zet meldingen dan aan in de instellingen van je telefoon, bij Planbord.

---

## Agenda koppelen (uitleg voor collega's)

1. Open **Agenda** in Planbord en kies **Link maken** bij de agenda die je wilt.
2. Zet de link in je agenda:
   - **iPhone of iPad:** tik op **Toevoegen aan agenda** en daarna op **Abonneer**. Of kopieer de link: Instellingen → Agenda → Accounts → Voeg account toe → Andere → Voeg agenda-abonnement toe → plak de link.
   - **Android:** de app Google Agenda kan geen agenda via een link toevoegen, en Toevoegen aan agenda werkt daar niet. Op een Android-telefoon toont Planbord daarom **Kopieer link** als knop (besluit V35). Daarna:
     1. Open Chrome en ga naar calendar.google.com. Tik op ⋮ en zet **Desktopsite** aan.
     2. Tik bij *Andere agenda's* op **+** → **Via URL**. Zie je dat niet? Tik dan eerst linksboven op ☰.
     3. Plak de link en tik op **Agenda toevoegen**.
     4. Open de app Google Agenda: ☰ → **Instellingen** → de nieuwe agenda (of eerst **Meer weergeven**). Zet **Synchroniseren** aan.
   - **Google Agenda op een computer:** stap 1 tot en met 3 hierboven, zonder Desktopsite.
   - **Outlook:** Agenda toevoegen → **Abonneren vanaf internet** → plak de link.
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
- Mails gaan alleen naar de medewerker zelf, en alleen over het eigen rooster.
  - Er staan geen namen van collega's in, geen reden van afwezigheid, en geen plaatjes, trackers of leesbevestiging.
  - De wachtrij voor mails bewaart geen e-mailadressen en geen tekst. Regels ouder dan 90 dagen verdwijnen vanzelf.
- Exporteren en volledig verwijderen kunnen alleen beheerders. Allebei komen ze in het logboek.
- Pushmeldingen (fase 4):
  - je zet ze zelf aan, per toestel, en ze gaan alleen over je eigen rooster;
  - Planbord bewaart per toestel een push-abonnement: een adres bij de pushdienst van Apple, Google, Mozilla of Microsoft, met twee sleutels;
  - elke melding is versleuteld voor dat ene toestel. De pushdienst kan de inhoud niet lezen, maar ziet wel dát er een melding is. Die diensten staan deels buiten de EU;
  - het abonnement zien alleen de medewerker zelf en beheerders (om te versturen). Elders staan alleen aantallen. Het verdwijnt bij uitzetten, als het verlopen is, en bij volledig verwijderen.
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
- **Mails lokaal:** zonder de `SMTP_`-waarden mislukt het versturen (*mailserver niet ingesteld*); de rest van de app werkt gewoon. Tests versturen nooit een echte mail.
- **De uitlegvideo's en de PDF** maak je opnieuw met de scripts in [`tools/uitleg-video/`](tools/uitleg-video/README.md). Die map hoort niet bij de build. Gebruik alleen het verzonnen team.

### Bekende punten

- **Tijdvelden** tonen de tijd zoals het toestel is ingesteld. Op een Nederlands ingesteld toestel is dat 24-uurs.
- **Herinneringen alleen op de gewone app.** Vercel draait de geplande taken niet op een preview. In een preview test je met de testmail en het voorbeeld; de echte herinnering zie je pas na de merge.
- **Spam.** Belandt een mail van Planbord toch in de spam, laat collega's het adres dan aan hun contacten toevoegen.
- **Pushmeldingen.**
  - Op een iPhone werken ze alleen vanaf het beginscherm, en Apple kan een abonnement zonder melding laten verlopen. Opent iemand Mijn rooster, dan werkt Planbord het abonnement van dat toestel bij.
  - Op Android kan batterijbesparing een melding vertragen. Daarom blijft de mail.
  - Een push gaat niet opnieuw als hij mislukt; de mail wel.
- **Supabase gratis:**
  - pauzeert een project na een week zonder gebruik; met dagelijks gebruik en agendafeeds gebeurt dat niet;
  - staat maximaal twee actieve gratis projecten per account toe; gepauzeerde projecten tellen niet mee;
  - maakt geen back-ups.
- **Supabase Pro** kost ongeveer $25 per maand per organisatie en maakt dagelijks een back-up die 7 dagen bewaard blijft. Voor een rooster waar het team op leunt, is dat het overwegen waard.
