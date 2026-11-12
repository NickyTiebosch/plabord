# Overdracht: Planbord naar andere accounts (besluit V51)

Planbord draait op drie accounts: de code op **GitHub**, de app op **Vercel** en de database op **Supabase**. Dit document beschrijft hoe een ander, bijvoorbeeld het bedrijf, Planbord overneemt zodat het niet meer op de accounts van de huidige eigenaar draait. Er zijn drie routes:

| Route | Wat | Wanneer |
|---|---|---|
| A. Overdragen | De projecten verhuizen naar de accounts van de nieuwe eigenaar. Gegevens en inlogaccounts blijven staan. | De snelste weg, zonder onderbreking voor collega's. |
| B. Opnieuw opzetten | De nieuwe eigenaar zet Planbord op eigen projecten, en zet een kopie van de database terug. | Als overdragen niet kan, bijvoorbeeld omdat de nieuwe eigenaar andere regio's of contracten wil. |
| C. Exporteren (gratis versie) | Alles naar Excel en verder in Excel. Planbord stopt. | Als Planbord niet verder hoeft. |

Bij A en B moeten daarna een paar instellingen worden vervangen die nu bij de huidige eigenaar horen; zie [Wat je altijd vervangt](#wat-je-altijd-vervangt).

De stappen hieronder zijn gecontroleerd tegen de documentatie van Vercel en Supabase in november 2026. De namen in de dashboards veranderen af en toe; zoek bij twijfel op "transfer project".

---

## Route A: de projecten overdragen

Reken op een uur. Collega's merken er niets van, behalve bij de stap met de mailbox.

### 1. Voorbereiden
- De nieuwe eigenaar maakt een account of team aan bij **GitHub**, **Vercel** en **Supabase**.
- Hij nodigt de huidige eigenaar daarin uit als lid, tijdelijk:
  - **Vercel:** de huidige eigenaar moet eigenaar zijn van het team waar Planbord nu staat, en lid van het team waar het naartoe gaat. Het doelteam heeft een geldige betaalmethode nodig.
  - **Supabase:** de huidige eigenaar moet eigenaar zijn van de organisatie waar het project nu staat, en minstens lid van de doelorganisatie.
- Maak vooraf een export (route C) als reservekopie.

### 2. Supabase
1. Controleer in het project dat er geen koppeling met GitHub aanstaat en geen log drains zijn ingesteld: dan kan overdragen niet.
2. **Project Settings → General → Transfer project**, kies de doelorganisatie en bevestig.
3. Staat de doelorganisatie op het gratis plan, dan mag ze niet boven de twee gratis projecten uitkomen. Overdragen naar een andere regio kan niet.
4. Doe hetzelfde met het testproject (**Planbord test**), of verwijder dat en maak later een nieuw.

Het project verhuist als geheel. Controleer na afloop of de app nog werkt; het projectadres en de sleutels horen gelijk te blijven, want het is hetzelfde project.

### 3. GitHub
1. Repository → **Settings → General → Transfer ownership**, naar het account of de organisatie van de nieuwe eigenaar.
2. GitHub stuurt oude links door, maar zet bij de nieuwe eigenaar de Vercel-app voor GitHub aan voor deze repository, anders bouwt Vercel niet meer.

### 4. Vercel
1. Project → **Settings → General → Transfer Project**, kies het doelteam.
2. Vercel toont wat er meegaat: deployments, omgevingsvariabelen, domeinen, de koppeling met de repository, de geplande taken (`vercel.json`) en de regio. Er is geen onderbreking.
3. Controleer na afloop onder **Settings → Git** of de koppeling met de verhuisde repository werkt. Zo niet: koppel hem opnieuw.

### 5. De instellingen vervangen
Zie [Wat je altijd vervangt](#wat-je-altijd-vervangt).

### 6. Afronden
- De nieuwe eigenaar verwijdert de huidige eigenaar uit het team (Vercel), de organisatie (Supabase) en de repository (GitHub).
- In Planbord zelf: zet de huidige eigenaar op inactief bij Beheer → Medewerkers, of verwijder hem volledig. Maak eerst een andere collega beheerder.

---

## Route B: opnieuw opzetten

Voor wie het werk van een IT-afdeling of leverancier kan inzetten. Reken op een halve dag.

1. **Code:** maak een kopie van de repository bij de nieuwe eigenaar (fork of nieuwe repository met de inhoud).
2. **Supabase:** maak een nieuw project in een EU-regio en volg de README vanaf stap 1, maar draai de setup-bestanden **niet** op een leeg project als je een kopie terugzet: de kopie bevat ze al.
3. **De gegevens:** maak een kopie van de oude database met de gereedschappen van Supabase (zie hun handleiding over migreren tussen projecten: een dump van de database en van de inlogaccounts, en die terugzetten in het nieuwe project). Zo komen ook de inlogaccounts mee; collega's loggen daarna in met hun gewone werkmail.
4. **Vercel:** maak een project bij de nieuwe repository, regio Frankfurt, en vul de omgevingsvariabelen in (zie `.env.example` en hieronder).
5. Vervang de instellingen hieronder, test met een paar collega's, en zet daarna pas de oude app uit.

Planbord heeft bewust geen eigen knop "alles importeren": een kopie van de database is betrouwbaarder en neemt de inlogaccounts mee.

---

## Route C: exporteren (de gratis versie)

Alles uit Planbord kan naar Excel, in de opbouw waarmee het team werkte. Daarna kan het team in Excel verder.

| Wat | Waar | Wie |
|---|---|---|
| Planning: medewerkers, vaste roosters, afwezigheid, invallen, roosterwijzigingen | Beheer → Export → **Planning downloaden** | beheerder |
| Het rooster per vestiging, per week | Beheer → Export, of onderaan het Rooster-scherm | iedereen |
| De uitleen: Registratie (nu uit) en Archief (retour) | Beheer → Export → **Uitleen downloaden**, of Registraties → Uitleen → Archief | beheerder en teamleider |
| Alles over één medewerker (inzageverzoek) | Beheer → Medewerkers → de naam → **Gegevens downloaden** | beheerder |

Elke export staat in het logboek.

Regel bij elk nieuw onderdeel (vanaf fase 5): een onderdeel is pas af als het in een export staat en in dit document.

---

## Wat je altijd vervangt

Er zit niets persoonlijks in de code; dit zijn allemaal instellingen.

### Vercel → Settings → Environment Variables

| Variabele | Wat | Na een overdracht (A) | Opnieuw opzetten (B) |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | adres van het Supabase-project | blijft | nieuw project |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publieke sleutel | blijft | nieuw project |
| `SUPABASE_SECRET_KEY` | geheime sleutel | **vervangen**: maak in Supabase een nieuwe secret key en trek de oude in | nieuw project |
| `SITE_URL` | het adres van de app | aanpassen als het adres verandert | nieuw adres |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | de mailbox voor meldingen | **vervangen** door een mailbox van de nieuwe eigenaar | idem |
| `CRON_SECRET` | geheim voor de geplande taak | **vervangen** door een nieuw geheim | nieuw geheim |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | sleutels voor pushmeldingen | mogen blijven; `VAPID_SUBJECT` naar een adres van de nieuwe eigenaar | nieuw sleutelpaar |

Zet elke waarde voor **Production**. De testomgeving (besluit V42) heeft eigen Supabase-waarden onder **Preview**.

Na het wijzigen: **Deployments → Redeploy** van de nieuwste productieversie, want `NEXT_PUBLIC_`-waarden worden bij het bouwen in de app gezet.

### Supabase → Authentication

- **Emails → SMTP Settings:** de mailbox voor de inlogcodes. Vervang hem door die van de nieuwe eigenaar; anders komen de codes uit de mailbox van de vorige eigenaar, of niet meer.
- **URL Configuration → Site URL:** het adres van de app, als dat verandert.

### Pushmeldingen

- Nieuwe VAPID-sleutels (route B, of als je ze toch vervangt): iedere collega zet de meldingen één keer opnieuw aan, onderaan Mijn rooster. Maak de sleutels in Planbord onder Beheer → Instellingen.

### Het adres van de app

- Planbord draait nu op een adres van Vercel (`planbord-ten.vercel.app`). Bij route A blijft dat adres werken. Wil de nieuwe eigenaar een eigen domein: **Vercel → Settings → Domains**, en pas daarna `SITE_URL` en de Site URL in Supabase aan.
- Een nieuw adres betekent: collega's zetten Planbord opnieuw op het beginscherm, en koppelen de agenda opnieuw (de agendalinks bevatten het adres).

---

## Controle na de overdracht

- [ ] Inloggen met een code werkt, en de mail met de code komt uit de nieuwe mailbox.
- [ ] Mijn rooster, Rooster, Verlof en Registraties tonen de bekende gegevens.
- [ ] Beheer → Instellingen → **Testmail naar mij** en **Testmelding naar mij** werken.
- [ ] Na een uur: Beheer → Mails toont dat de geplande taak draaide.
- [ ] Een export werkt en staat in het logboek.
- [ ] De vorige eigenaar heeft geen toegang meer tot GitHub, Vercel en Supabase.
