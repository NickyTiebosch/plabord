# Plan fase 10: lekkagecontroles

**Status: concept van 14 november 2026.** Het eerste deel van de opdracht van de directeur: welke kosten zijn blijven liggen. Gebruikt de overeenkomsten uit fase 9 en de meldingen uit fase 6.

## 1. Besluiten

### V89. Onderdeel Lekkage
In de zijbalk komt **Lekkage** (`/lekkage`), voor beheerder en teamleider. Tabs: Bevindingen, Per controle, Regels.

Na elke upload van de financiële export draait Planbord de controles opnieuw. Een controle is een vaste regel: dezelfde gegevens geven altijd dezelfde bevindingen. Geen AI.

### V90. De regels, zoals de eigenaar ze opgaf
| # | Controle | Regel | Kan nu met de export? |
|---|---|---|---|
| 1 | Aftankkosten | Is er brandstof doorbelast, dan horen er aftankkosten bij. **Niet bij Athlon**, en alleen bij benzineauto's. | Ja, behalve de brandstofsoort (zie V92) |
| 2 | Meerkilometers | Meer gereden dan de vrije kilometers van die overeenkomst, maar geen bedrag voor meerkilometers. De vrije kilometers verschillen per voertuig en staan per overeenkomst in de export. | Ja |
| 3 | Te laat retour | Meer dan 60 minuten na het afgesproken tijdstip terug: een extra dag. | Ja: terugbrengtijdstip tegen berekend tot |
| 4 | Korting | Korting mag alleen bij een actie, in opdracht van Michel, of bij een voorlooptarief. Elke overeenkomst met korting wordt een bevinding om te beoordelen. | Deels: de reden staat niet in de export |
| 5 | Annulering door werkplaats | Na 11:00 geannuleerd: 1 dag huur doorbelasten. Komt uit de doorbelastlijst van fase 6: ouder dan 14 dagen en nog niet doorbelast. | Ja |
| 6 | Eigen risico bij schade | Verschilt per soort klant en per auto. | Nee |
| 7 | Schoonmaakkosten | Worden onder diversen doorbelast. | Nee |
| 8 | Transportkosten | Rekenen als wij het transport inplannen. | Nee |

Controles 6, 7 en 8 bouwen we pas als de gegevens er zijn (zie de vragen). Ze staan wel al in de lijst, als "nog niet mogelijk", zodat duidelijk is wat ontbreekt.

### V91. Uitzonderingen zijn instellingen
Onder **Regels** beheert de beheerder:
- per debiteurengroep of debiteur: geen aftankkosten (start: Athlon), geen meerkilometers, korting toegestaan;
- welke soorten overeenkomst meetellen. Voorstel: alleen Verhuur en Vervangend vervoer; Intern gebruik, Onderhoud, Schade en Transport niet;
- de grenzen: 60 minuten, en een ondergrens in kilometers of euro's waaronder een bevinding niet de moeite is (voorstel: 10 kilometer).

Zo hoeft er voor een nieuwe afspraak met een leasemaatschappij geen code te veranderen.

### V92. Brandstofsoort
De export zegt niet of een auto op benzine rijdt. Zolang dat ontbreekt, geldt controle 1 voor elke overeenkomst met doorbelaste brandstof: een elektrische auto krijgt geen brandstof doorbelast en valt dus vanzelf af. Voor diesel is dat een aanname; zie de vragen.

### V93. Bevindingen
Elke afwijking is een bevinding met: controle, overeenkomstnummer, kenteken, vestiging, medewerkercode, datum en een **geschat bedrag in hele euro's**.
- Status: **Open**, **Hersteld** (alsnog gefactureerd) of **Terecht** (er was een reden). Afhandelen kost één tik en een korte reden uit een lijst (Actie, Opdracht Michel, Voorlooptarief, Afspraak met klant, Anders).
- Een bevinding die bij een volgende upload niet meer klopt (Rentwise is aangepast), gaat vanzelf op Hersteld.
- Een afgehandelde bevinding komt niet terug bij een volgende upload.
- Het bedrag is een schatting. Het scherm zegt dat erbij, en toont hoe het is berekend (bijvoorbeeld 120 kilometer × de prijs per kilometer van die overeenkomst). Ontbreekt de prijs per kilometer, dan staat er "bedrag onbekend" en telt de bevinding mee in het aantal, niet in het totaal.

### V94. Wat de eerste telling op de export liet zien
Een grove telling op de export van januari tot en met oktober 2026, **nog zonder de uitzonderingen**. Deze aantallen zijn dus te hoog en dienen alleen om de omvang te zien:
- ongeveer 4.200 overeenkomsten met doorbelaste brandstof, waarvan ongeveer 2.200 zonder aftankkosten;
- ongeveer 7.200 overeenkomsten boven de vrije kilometers, waarvan ongeveer 1.700 met een prijs per kilometer van 0;
- ongeveer 460 overeenkomsten met korting.

Bij de bouw eerst de regels van V91 toepassen en de uitkomst met de eigenaar doorlopen op twintig voorbeelden per controle, voordat het team ermee werkt. Een controle die te veel loos alarm geeft, wordt niet gebruikt.

### V95. Privacy en zichtbaarheid
- Bevindingen tonen geen huurder, bestuurder of telefoon. Wie de klant wil weten, zoekt de overeenkomst op in Rentwise.
- De medewerkercode staat bij een bevinding, omdat de teamleider moet weten wie hij erover spreekt. Optellen per medewerker gebeurt hier niet; dat is fase 11.
- Bevindingen verdwijnen samen met de overeenkomst, na 24 maanden. De maandtotalen (fase 7) bewaren aantallen en bedragen per vestiging en controle.

### V96. Export
**Bevindingen downloaden**: één regel per bevinding, met de filters van het scherm.

## 2. Datamodel
| Tabel | Inhoud |
|---|---|
| `leak_rules` | per controle: aan of uit, grenzen |
| `leak_exemptions` | debiteurengroep of debiteur, controle, reden |
| `leak_findings` | controle, overeenkomst, bedrag in centen of leeg, uitleg van de berekening als gegevens (geen vrije tekst), status, reden, wie en wanneer afgehandeld |

Alles alleen voor beheerder en teamleider; regels en uitzonderingen alleen de beheerder.

## 3. Code
- `src/lib/leaks/`: per controle een pure functie `(overeenkomst, regels) → bevinding of niets`, elk met tests voor het gewone geval, de uitzondering en de grens (precies 60 minuten, precies de vrije kilometers).
- Het opnieuw draaien na een upload gebeurt in de database of in delen, niet met 30.000 regels in het geheugen van één verzoek.

## 4. Bouwvolgorde
1. Regels, uitzonderingen en het datamodel.
2. Controle 1 tot en met 5, elk met tests.
3. Het scherm Bevindingen met afhandelen.
4. De controle op twintig voorbeelden per soort, samen met de eigenaar.
5. Export, documentatie en de pull request.

## 5. Vragen voor de eigenaar
1. **Factuurregels:** kan Rentwise een export geven met de regels van de factuur (diversen, eigen risico, transport, schoonmaak)? Zonder die export kunnen controles 6, 7 en 8 niet.
2. **Brandstofsoort:** is er een export of lijst van de vloot met de brandstofsoort per kenteken? En gelden aftankkosten ook bij diesel, of echt alleen bij benzine?
3. **Athlon:** onder welke naam of code staat Athlon in `debiteurengroep`? Zijn er meer partijen met zo'n afspraak?
4. **Te laat retour:** telt de 60 minuten vanaf het afgesproken retourtijdstip op de overeenkomst? En geldt de regel ook bij vervangend vervoer voor de werkplaats?
5. **Korting:** waar leg je nu vast waarom iemand korting kreeg? Als dat nergens staat, is de reden bij het afhandelen in Planbord de eerste plek.
6. **Bedragen:** tegen welk bedrag reken ik aftankkosten (in de export staan 5, 7,50, 10 en 12,39) en een extra dag (het dagtarief van die overeenkomst)?
