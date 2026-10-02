# Plan fase 2: "het brein"

**Status: goedgekeurd op 1 oktober 2026** ("akkoord met je voorstellen, bouw fase 2"). Dit plan hoort bij de opdracht in `docs/SPEC.md` (fase 2 en "Vervangingsengine") en bouwt voort op fase 1. De vaste afspraken staan in `CLAUDE.md`.

## Besluiten
Alle voorstellen uit §1 zijn aangenomen:

| Vraag | Besluit |
|---|---|
| V6 | Per medewerker per dag: geen dienst, een andere dienst (ook als toevoeging), of verplaatsen naar een andere dag (in één keer opgeslagen). |
| V7 | "Het minst ingevallen" telt de invallen die doorgaan in de 90 dagen vóór de datum van het gat. |
| V8 | Een genegeerd gat komt terug als het tekort groter wordt. Genegeerde gaten zijn te bekijken en terug te zetten. |
| V9 | Invallen is altijd vanuit een andere groep. Voor de eigen vestiging gebruik je een roosterwijziging. |
| V10 | "Niet meer nodig" alleen als de vestiging zonder de inval op de norm zit; de laatst ingeplande vervalt eerst. Vervallen invallen staan in "Let op" tot de beheerder op Afgehandeld klikt. Is de invaller zelf afwezig, dan "opnieuw regelen". |

De keuzes in §2 gelden zoals ze er staan.

### Aanpassingen na de eerste test (2 oktober 2026)
- **V11. De rol "poets" heet voortaan "hiker/buitendienst".**
  - Alleen de naam verandert. Intern blijft de rol `cleaning`, dus er is geen migratie en geen SQL nodig.
  - De regels blijven gelijk: deze rol telt niet mee aan de balie en wordt nooit voorgesteld als invaller.
  - Waar `docs/SPEC.md` of dit plan "poets" zegt, lees "hiker/buitendienst".
  - De Excel-import kent de nieuwe naam (ook los: "hiker" of "buitendienst"). "poets" en "schoonmaak" werken nog, zodat eerdere importbestanden blijven passen.
- **Vaste diensten voor meerdere dagen tegelijk.** In "Vaste diensten wijzigen of toevoegen" vink je de dagen aan (ma t/m za) in plaats van één dag te kiezen.
  - De gekozen dagen krijgen dezelfde dienst vanaf de datum bij "Geldig vanaf". Dagen zonder vinkje blijven zoals ze zijn. Een vaste vrije dag is dus een dag die je niet aanvinkt.
  - "Vaste diensten laten stoppen" werkt ook voor meerdere dagen. Kan het op één van die dagen niet, dan verandert er niets en zegt de melding welke dag het probleem is.
  - De wijzigingen gaan in hoogstens drie bewerkingen naar de database: eerst stoppen, dan aanpassen, dan toevoegen. Mislukt een latere bewerking, dan zegt de melding dat een deel wel is opgeslagen. Het logboek laat precies zien wat er is veranderd.
  - Bij de vaste diensten van een medewerker staat bij een dag zonder dienst "Vrij (geen vaste dienst)", of "Nu nog geen vaste dienst" als er een dienst aankomt. Een komende dienst toont ook zijn einddatum.

---

Fase 2 levert drie dingen:
1. **Bezetting tegen de norm.** Per vestiging, per dag en per dagdeel: hoeveel mensen staan er aan de balie, en is dat genoeg? Onderbezetting is rood in het vestigingsrooster. De gaten verschijnen in "Nog te regelen".
2. **De vervangingsengine.**
   - Per gat stelt hij de beste drie invallers voor, elk met een uitleg.
   - Jij kiest; de app wijst nooit zelf toe.
   - Bij het invoeren van afwezigheid zie je vóór het opslaan wat het gevolg is (impactcheck).
   - Invallen die achterhaald zijn, worden gemarkeerd, nooit stilletjes verwijderd.
3. **Roosterwijzigingen voor één dag.** Een dienst toevoegen, verwijderen of verplaatsen, zonder de vaste dienst aan te passen.

---

## 1. Vragen over bedrijfsregels

De nummering loopt door vanaf fase 1 (V1–V5). Bij elke vraag staat een voorstel. "Akkoord met je voorstellen" is genoeg.

### V6. Wat betekent "een dienst verplaatsen"?
De spec noemt "toevoegen, verwijderen of verplaatsen", maar zegt niet of verplaatsen naar een andere dag is, of naar een andere vestiging op dezelfde dag.
- **Voorstel:** allebei. Per medewerker per dag kun je kiezen uit:
  - **geen dienst** deze dag;
  - **een andere dienst** deze dag: andere groep, rol of tijden. Dat werkt ook op een dag zonder vaste dienst (= toevoegen);
  - **verplaatsen naar een andere dag:** geen dienst op dag A en een dienst op dag B, in één keer opgeslagen.

### V7. Over welke 90 dagen telt "het minst ingevallen"?
Binnen een groep krijgt eerst de kandidaat voorrang die "in de laatste 90 dagen het minst is ingevallen".
- **Voorstel:**
  - de 90 dagen vóór de datum van het gat;
  - alleen invallen die doorgaan tellen mee; invallen met de status "niet meer nodig" of "opnieuw regelen" niet.

  Zo telt een inval die al voor volgende week gepland staat mee bij een gat in de week daarna.

### V8. Wanneer komt een genegeerd gat terug?
Je kunt een gat negeren. Daarna kan het erger worden, bijvoorbeeld als er nog iemand afwezig wordt.
- **Voorstel:**
  - een genegeerd gat blijft weg zolang het tekort niet groter wordt;
  - wordt het tekort groter, bijvoorbeeld van 1 naar 2 te weinig, dan komt het terug;
  - je kunt genegeerde gaten altijd bekijken en terugzetten.

### V9. Mag iemand invallen in de eigen vestiging?
Stel dat iemand op een dag in Eindhoven ingeroosterd staat in een andere rol dan balie. Mag de engine die persoon voorstellen voor een gat aan de balie in Eindhoven?
- **Voorstel:** nee. Invallen is altijd vanuit een andere groep. Wil je iemand in de eigen vestiging aan de balie zetten, dan gebruik je "een andere dienst deze dag" (V6).

### V10. Wanneer is een inval "niet meer nodig"?
De spec zegt: wordt een afwezigheid gewijzigd of verwijderd, dan krijgt de inval de status "niet meer nodig". Soms is de inval dan nog wél nodig, bijvoorbeeld omdat er die dag nog iemand anders afwezig is.
- **Voorstel:**
  - na elke wijziging of verwijdering van afwezigheid kijkt de engine of de vestiging zónder de inval op de norm zit. Alleen dan wordt het "niet meer nodig";
  - zijn er die dag meerdere invallen overbodig, dan vervalt de laatst ingeplande eerst;
  - een inval die niet meer nodig is, verdwijnt uit de roosters en agenda's. Hij blijft in een lijst "Let op" op het overzicht staan tot jij op **Afgehandeld** klikt. Dan heb je het de invaller laten weten; mails komen pas in fase 3;
  - is de invaller zelf afwezig, dan wordt het "opnieuw regelen", zoals de spec zegt. Het gat komt terug in "Nog te regelen".

---

## 2. Keuzes die ik maak

**Gaten**
- Een gat is een vestiging die in een dagdeel onder de norm zit. Het **tekort** is de norm min het aantal mensen aan de balie.
- Alleen de rol balie telt, zoals in fase 1: wie die dag "telt mee aan de balie" heeft.
- Op een gesloten dag zijn er geen gaten. Zaterdag heeft norm 0 en dus nooit een gat (seed uit de spec).
- "Nog te regelen" kijkt vanaf vandaag zoveel weken vooruit als ingesteld (standaard 8). Gaten in het verleden tonen we niet.
- De gaten van één vestiging op één dag staan samen. Een inval dekt standaard alle dagdelen met een tekort; je kunt ook één dagdeel kiezen.

**Kandidaten** (de regels uit de spec, precies uitgewerkt)
- Iemand is kandidaat als alles hieronder klopt:
  - actief, en inzetbaar aan de balie in die vestiging;
  - die dag de hele dag ingeroosterd: de dienst van die dag raakt de ochtend én de middag, en zijn groep is die dag open;
  - die dag helemaal niet afwezig, ook niet half, en aangevraagd telt ook;
  - die dag nog niet ingeleend;
  - zijn rol die dag is niet poets;
  - zijn groep die dag is een andere dan de vestiging van het gat (V9);
  - komt hij uit een andere vestiging en telt hij daar mee aan de balie, dan zit die vestiging zonder hem nog op de norm in alle dagdelen van de inval.
- "De dienst van die dag" is de vaste dienst, of de roosterwijziging voor die dag als die er is. De groep en rol van die dag bepalen de volgorde en de normcheck.
- **Volgorde:**
  1. invalvolgorde van zijn groep van die dag (instelbaar; seed: Backoffice, Overig, een andere vestiging, Logistiek);
  2. het minst ingevallen in 90 dagen (V7);
  3. naam;
  4. id.

  Gelijke gegevens geven dus altijd dezelfde volgorde.
- **Voorstel:** de eerste drie, elk met een uitlegregel in het Nederlands. Bijvoorbeeld:
  - "Danique (backoffice): werkt die dag en mag in Eindhoven invallen; 1× ingevallen in 90 dagen."
  - "Sanne (balie Den Bosch): werkt die dag en mag in Eindhoven invallen; Den Bosch blijft op de norm; 0× ingevallen in 90 dagen."
- **Andere kandidaat:** je kunt ook iemand verder in de lijst kiezen, met dezelfde uitleg erbij. Wie niet in aanmerking komt, staat er niet tussen.

**Toewijzen**
- Alleen na jouw klik. De server controleert vlak voor het opslaan opnieuw of de kandidaat nog geldig is. Is er intussen iets veranderd, dan krijg je een melding en de nieuwe voorstellen.
- Een inval staat meteen in beide roosters:
  - als "ingeleend" bij de vestiging;
  - als "valt elders in" bij de eigen groep;
  - en als "Invallen in Eindhoven" in Mijn rooster en de agendafeed van de invaller.

  Fase 1 kan dit al tonen; nu komen de gegevens erbij.
- Een inval intrekken kan. Hij krijgt dan de status "niet meer nodig" en komt in het logboek. Verwijderen doen we niet.

**Impactcheck** bij afwezigheid
- Opslaan gaat in twee stappen als er gevolgen zijn:
  1. je klikt op **Opslaan** en de engine rekent;
  2. zakt er een dagdeel onder de norm, of vervalt er een inval, dan zie je de gevolgen met de voorstellen. Je klikt op **Toch opslaan** of past de afwezigheid aan.

  Zonder gevolgen wordt meteen opgeslagen. Opslaan mag altijd.
- De check kijkt naar alle dagen van de afwezigheid, ook verder dan 8 weken vooruit.

**Achterhaalde invallen**
- Na elke wijziging die het rooster raakt, bekijkt de engine de invallen op de geraakte dagen:
  - afwezigheid opslaan of verwijderen;
  - een roosterwijziging voor één dag;
  - een Excel-import met afwezigheid.

  Het resultaat is "niet meer nodig" of "opnieuw regelen", volgens V10.
- Invallen in het verleden laten we altijd ongemoeid.
- Een andere vaste dienst of een nieuwe sluitingsdag zet een inval niet vanzelf om. Klopt een inval daardoor niet meer, dan toont het overzicht een waarschuwing en kies jij wat er gebeurt.

**Roosterwijzigingen voor één dag**
- Per medewerker per dag hooguit één wijziging. Die bepaalt de dienst van die dag helemaal: "geen dienst", of "deze dienst" met groep, rol en tijden.
- Te vinden vanuit het vestigingsrooster: een beheerder tikt op een naam. Ook vanaf de pagina van de medewerker.
- "Terug naar de vaste dienst" haalt de wijziging weg. Het logboek bewaart wat er was.
- In Mijn rooster en het vestigingsrooster staat bij zo'n dag "gewijzigd". De agendafeeds volgen vanzelf.

**Wie ziet wat**
- Invallen en roosterwijzigingen ziet iedereen: ze horen bij het rooster.
- Genegeerde gaten en "Nog te regelen" zien alleen beheerders.
- Alleen beheerders wijzigen iets. Dat wordt twee keer gecontroleerd: in de server action en via RLS.

**Branch:** fase 2 staat op een eigen branch, `claude/planbord-fase-2`, met een eigen pull request.

---

## 3. Datamodel

Drie nieuwe tabellen. RLS staat aan op elke tabel. Eerst `revoke all` voor `anon` en `authenticated`, daarna expliciete grants. `anon` krijgt niets.

**`substitutions`** (invallen)

| Kolom | Type | Uitleg |
|---|---|---|
| `id` | uuid | |
| `employee_id` | uuid | de invaller |
| `date` | date | |
| `group_id` | text | de vestiging waar hij invalt; een trigger controleert dat het een vestiging met balie is |
| `day_part` | text | `full_day`, `morning` of `afternoon`, net als bij afwezigheid |
| `status` | text | `active` (gaat door), `not_needed` (niet meer nodig) of `reschedule` (opnieuw regelen) |
| `handled_at` | timestamptz | wanneer de beheerder een vervallen inval heeft afgehandeld (V10) |
| `created_at`, `updated_at` | timestamptz | |

- Per medewerker per dag hooguit één inval met status `active` (een unieke index op die combinatie).
- Lezen: iedereen die is ingelogd. Schrijven: alleen beheerders.

**`shift_overrides`** (roosterwijziging voor één dag)

| Kolom | Type | Uitleg |
|---|---|---|
| `id` | uuid | |
| `employee_id` | uuid | |
| `date` | date | uniek samen met `employee_id` |
| `kind` | text | `off` = geen dienst; `shift` = deze dienst |
| `group_id`, `role` | text | verplicht bij `shift`, leeg bij `off` |
| `start_time`, `end_time` | time | leeg = standaardtijd, net als bij vaste diensten |
| `created_at`, `updated_at` | timestamptz | |

- Lezen: iedereen die is ingelogd. Schrijven: alleen beheerders.

**`gap_dismissals`** (genegeerde gaten)

| Kolom | Type | Uitleg |
|---|---|---|
| `id` | uuid | |
| `group_id`, `date`, `day_part` | | uniek samen |
| `shortage` | smallint | het tekort op het moment van negeren (V8) |
| `created_at` | timestamptz | |

- Lezen en schrijven: alleen beheerders.

**Verder**
- Logboek: triggers op de drie tabellen. We loggen datums, dagdelen, status, groep, rol, tijden en tekort; nooit namen.
- Een functie `move_shift(...)` slaat "verplaatsen" (V6) in één transactie op. Ze is `security invoker`, dus RLS geldt gewoon: alleen een beheerder kan het.
- De bestaande tabellen veranderen niet. `staffing_norms` en `groups.substitution_rank` uit fase 1 worden nu gebruikt.

**Migraties en bundel**
- Nieuwe bestanden in `supabase/migrations/`, vanaf `20261002000100_…`.
- De bundel `supabase/setup/fase-2.sql` draai je ná `fase-1.sql`. Hij is herhaalbaar.
- Hij voegt alleen tabellen en functies toe. Je kunt hem dus al draaien vóór je fase 2 merget; de app van fase 1 merkt er niets van.

---

## 4. De engine (pure functies in `src/lib/engine/`)

| Bestand | Wat |
|---|---|
| `schedule.ts` (uitgebreid) | roosterwijzigingen voor één dag verwerken; "gewijzigd" markeren |
| `staffing.ts` | bezetting per vestiging, dag en dagdeel tegen de norm |
| `gaps.ts` | gaten in een periode, met tekort, en zonder genegeerde gaten (V8) |
| `candidates.ts` | kandidaten, volgorde, de top-3 en de uitlegregels |
| `history.ts` | het aantal invallen per medewerker in 90 dagen (V7) |
| `impact.ts` | de impactcheck: rooster vóór en na een afwezigheid vergelijken |
| `review.ts` | achterhaalde invallen: "niet meer nodig" of "opnieuw regelen" (V10) |

- Geen databasetoegang, geen `Date.now()`. "Vandaag" en alle gegevens komen binnen als parameter.
- De momentopname krijgt erbij: normen, invallen en roosterwijzigingen. Genegeerde gaten gaan los mee naar `gaps.ts`.

---

## 5. Schermen en routes

**Voor iedereen**
- **Vestigingsrooster** (`/rooster/[vestiging]`):
  - per dag per dagdeel de bezetting, bijvoorbeeld "ochtend 2/2" en "middag 1/2", met onderbezetting in rood;
  - invallers met "ingeleend" en roosterwijzigingen met "gewijzigd";
  - voor beheerders: tik op een naam voor een roosterwijziging, en bij een gat de knop "Regelen".
- **Mijn rooster:** "Invallen in Eindhoven" en "gewijzigd" vallen op (het eerste kon al).
- **Agendafeeds:** invallen en roosterwijzigingen komen erin. "Invallen Eindhoven" stond al klaar.

**Voor beheerders**
- **Overzicht** (`/beheer`), met bovenaan:
  - **Nog te regelen:** per dag en vestiging het gat met het tekort per dagdeel, en de voorstellen met uitleg. Per voorstel de knop **Inzetten**, plus **Andere kandidaat** en **Negeren**. Een link naar de genegeerde gaten;
  - **Let op:** invallen die niet meer nodig zijn of opnieuw geregeld moeten worden, en invallen die niet meer kloppen, met de knop **Afgehandeld**.
- **Afwezigheid:** de impactcheck in het formulier.
- **Roosterwijziging** (`/beheer/rooster/[medewerker]/[datum]`): geen dienst, een andere dienst, verplaatsen naar een andere dag, of terug naar de vaste dienst.
- **Invallen** (`/beheer/invallen`): de lijst van komende en recente invallen, met intrekken.

---

## 6. Testaanpak

**Engine** (Vitest, met de fictieve teamfixture, uitgebreid waar nodig). In ieder geval de gevallen uit de spec:
- afwezigheid geeft alleen een gat als de norm echt wordt onderschreden;
- een sluitingsdag geeft geen gaten; zaterdag ook niet;
- de kandidaatvolgorde klopt, en gelijkwaardige kandidaten staan altijd in dezelfde volgorde;
- rol poets wordt nooit voorgesteld;
- wie niet inzetbaar is op die vestiging, valt af;
- een kandidaat uit een andere vestiging komt alleen in aanmerking als die vestiging op norm blijft;
- een inval telt mee op de nieuwe vestiging en niet bij de eigen groep;
- een gewijzigde afwezigheid maakt de inval "niet meer nodig". Is hij toch nog nodig, dan blijft hij staan (V10);
- is de invaller zelf afwezig, dan wordt het "opnieuw regelen" en komt het gat terug.

Daarnaast:
- de 90-dagenteller (V7) en genegeerde gaten (V8);
- roosterwijzigingen (geen dienst, andere dienst, verplaatsen);
- de impactcheck;
- de uitlegregels.

**Database** (PGlite):
- RLS en grants van de nieuwe tabellen. Een medewerker kan invallen lezen maar niet schrijven, en genegeerde gaten niet zien. `anon` kan niets;
- de constraints: één actieve inval per persoon per dag, alleen invallen in een vestiging, en de regels van `shift_overrides`;
- het logboek zonder namen;
- `fase-1.sql` en daarna `fase-2.sql`, allebei twee keer achter elkaar.

**Schermen:** zoals in fase 1. De logica zit in geteste functies; jij test via de Netlify-preview. Zelf loop ik de schermen weer door in een browser, tegen een nagebootste Supabase.

---

## 7. Bouwvolgorde (kleine commits)
1. Migraties, de bundel en de databasetests.
2. Engine: roosterwijzigingen in de roosterberekening.
3. Engine: bezetting, gaten, kandidaten, volgorde en uitleg.
4. Engine: impactcheck en achterhaalde invallen.
5. Gegevens laden: invallen, wijzigingen en normen in de momentopname en de agendafeeds.
6. Vestigingsrooster met bezetting.
7. "Nog te regelen": toewijzen, negeren en afhandelen.
8. Impactcheck in het afwezigheidsformulier, en de controle na import.
9. Roosterwijzigingen voor één dag, en de lijst met invallen.
10. Afronden: README, `supabase/setup/fase-2.sql`, en de PR met handmatige stappen en testlijst.

---

## 8. Oplevering
De pull request van fase 2 bevat:
- een samenvatting;
- de handmatige stap: `supabase/setup/fase-2.sql` draaien in de SQL Editor;
- een testlijstje voor de deploy preview.

Er zijn geen nieuwe omgevingsvariabelen of Supabase-instellingen nodig.

---

## 9. Risico's en aandachtspunten
- **Fase 1 eerst.** Fase 2 bouwt voort op fase 1. Is fase 1 nog niet gemerged, dan wijst de PR van fase 2 eerst naar de branch van fase 1. Na de merge zet ik hem om naar `main`, zodat Netlify er een preview van maakt.
- **Eén database voor preview en productie.** Zolang je één Supabase-project gebruikt, test de preview van fase 2 op je echte gegevens. Dat is veilig: `fase-2.sql` voegt alleen toe. Maar een inval die je in de preview toewijst, staat ook echt in de database. Wil je dat niet, gebruik dan een tweede Supabase-project voor de previews (zie de README).
- **Geen meldingen.** Een invaller ziet zijn inval in Mijn rooster en zijn agendafeed. Een mail komt pas in fase 3. Tot dan laat jij het de invaller weten. Daarom bestaat de lijst "Let op" met **Afgehandeld**.
