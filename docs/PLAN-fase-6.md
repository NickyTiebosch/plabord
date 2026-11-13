# Plan fase 6: binnenvallers, meldingen en de invulcontrole

**Status: concept van 13 november 2026.** De eigenaar heeft gevraagd alle plannen te schrijven en uit te voeren, en niet per fase op akkoord te wachten. Daarom staan de keuzes hieronder als besluit, met de reden erbij. Wil je er een anders, zeg het dan; ik pas het aan. Dit plan bouwt voort op fase 5. Het geheel staat in `docs/ROUTEKAART.md`; de vaste afspraken in `CLAUDE.md`.

## Wat er nodig is van de eigenaar
Twee onderdelen kan ik pas bouwen met de Excel-bestanden erbij. Ze zaten in het eerste gesprek, maar zijn daar niet meer beschikbaar.

| Nodig | Waarvoor | Zonder dit |
|---|---|---|
| `Binnenvallers Registratie.xlsx` en `WPL meldingen dagregistratie.xlsx`, opnieuw als bijlage | de historie inlezen (V62) en de export in precies dezelfde kolommen (V63) | bouw ik alles behalve de historie; de export krijgt een eigen, logische opbouw |

## 1. Besluiten

### V55. Twee nieuwe onderdelen
In de zijbalk komen **Binnenvallers** en **Meldingen** erbij, onder Mobiliteit. Iedere collega ziet ze, voor iedere vestiging. De adressen zijn `/binnenvallers` en `/meldingen`. Op Start krijgen ze elk een tegel met de stand van vandaag.

De controle van Mobiliteit en de nieuwe invulcontrole komen samen in één onderdeel **Controle** (`/controle`), voor beheerder en teamleider. Zo staat alles wat jij en de teamleider nakijken op één plek, en past de tabbalk van Mobiliteit op de telefoon.

### V56. Werkplaatsen per vestiging
Een lijst in Beheer → Instellingen, per vestiging. De beheerder kan een werkplaats toevoegen, hernoemen, van volgorde wisselen en op inactief zetten. Verwijderen kan niet zodra er cijfers aan hangen: dan blijft de historie kloppen.

Startwaarden, uit de huidige bestanden:
- **Den Bosch:** Volkswagen, Audi, Bedrijfswagens, Seat Skoda, Oss, Carlux Den Bosch, Carlux Oss.
- **Eindhoven:** Volkswagen, Audi, Veldhoven, Bedrijfswagens, Carlux Best.
- **Breda:** Volkswagen, Audi, Bedrijfswagens, Seat Skoda, Roosendaal, Halsteren, Den Elzen Breda, Den Elzen Roosendaal.

### V57. Binnenvallers
Eén scherm per vestiging voor vandaag: per werkplaats een teller met een grote plus en min. De hele dag door bij te werken, door iedere collega.
- Je eigen vestiging staat voor; wisselen kan bovenaan.
- Een andere dag kiezen kan tot 7 dagen terug. Ouder kan alleen de teamleider of beheerder aanpassen.
- De app bewaart per vestiging, werkplaats en dag één getal. Wie het laatst wijzigde en wanneer staat erbij; elke wijziging staat in het logboek.
- Een dag zonder binnenvallers is 0. Dat hoeft niemand in te vullen: het telt als ingevuld zodra de dag is afgesloten (V60).

### V58. Meldingen
Eén formulier per melding, met de keuzes uit het huidige bestand:
- **vestiging** (staat op je eigen vestiging) en **werkplaats**;
- **soort**: contract of rijbewijs niet in orde, verkeerde auto meegegeven, annulering door werkplaats, te laat retour;
- bij contract of rijbewijs: **wat ontbrak** (handtekening, rijbewijscontrole of beide);
- bij een annulering: het **tijdstip**. Vanaf 11:00 staat **Doorbelasten** vanzelf op ja; het tijdstip is een instelling, en je kunt het vinkje per melding omzetten;
- **kenteken**, **contract- of reserveringsnummer** en **bijzonderheden** (kort, met de regel erbij dat klantgegevens niet nodig zijn);
- datum en tijd staan op nu en zijn aan te passen.

Wie de melding maakte, vult de app in.

### V59. Corrigeren en verwijderen (vraag uit de routekaart)
Wie de melding maakte, kan haar op dezelfde dag zelf corrigeren of verwijderen. Daarna, en bij meldingen van een ander, doet de teamleider of beheerder dat. Reden: fouten merk je meestal meteen, en zo hoeft de teamleider daar niet voor te worden gebeld. Alles staat in het logboek.

Dezelfde regel voer ik door bij Mobiliteit: wie een auto aanmeldde, kan die registratie op dezelfde dag zelf corrigeren. Dat was het open punt uit fase 5.

### V60. Dag afsluiten
Aan het eind van de dag tikt iemand van de vestiging op **Dag afsluiten**, en vinkt daarbij af dat de contracten in RentLink zijn gecontroleerd. Een dag zonder meldingen of binnenvallers is daarmee een bewuste keuze en geen vergeten dag.
- Afsluiten kan voor vandaag en, als het vergeten is, voor eerdere dagen.
- Na het afsluiten kan er nog iets bij; de dag blijft afgesloten. Heropenen kan de teamleider of beheerder.
- Zaterdag telt mee als de vestiging die dag volgens het rooster open is. Zondagen en sluitingsdagen tellen niet.

### V61. De invulcontrole en de herinnering
- **Invulcontrole:** een raster van vestiging × werkdag, voor beheerder en teamleider. Groen: afgesloten. Geel: vandaag, nog niet afgesloten. Rood: een eerdere dag die niet is afgesloten. Een tik op een vakje toont de binnenvallers en meldingen van die dag.
- **Herinnering (vraag uit de routekaart):** is de dag om 16:00 nog niet afgesloten, dan krijgt iedere collega die die dag volgens het rooster op die vestiging werkt een pushmelding. Reden: een vaste persoon is ziek of vrij op de dag dat het ertoe doet. Het tijdstip is een instelling; uitzetten kan ook. De herinnering valt onder de schakelaar Meldingen versturen en gaat alleen naar wie meldingen aan heeft staan.
- De controle telt per vestiging pas vanaf de eerste dag dat die vestiging iets in Planbord registreert of afsluit. Zo staat bij de start niet alles rood.

### V62. De doorbelastlijst
Onder Meldingen een tab **Doorbelasten**: alle annuleringen met Doorbelasten op ja, de openstaande eerst. Elke regel heeft de status doorbelast ja of nee, om te zetten met één tik door de teamleider of beheerder. Wie het omzette en wanneer staat erbij.

### V63. Historie inlezen
De cijfers uit de huidige Excel-bestanden (vanaf juli en september 2026) worden één keer ingelezen, door de beheerder, onder Beheer → Importeren. Eerst een voorbeeld van wat er wordt ingelezen, dan pas opslaan. Twee keer inlezen geeft geen dubbele regels. Hiervoor heb ik de bestanden nodig (zie boven).

### V64. De export
Onder Beheer → Export, en voor de teamleider bij het onderdeel zelf: **Binnenvallers downloaden** en **Meldingen downloaden**. Per vestiging een tabblad, zoals in de huidige bestanden, en een tabblad Doorbelasten. Zonder werkmails. Elke export staat in het logboek.

### V65. Bewaren en privacy
- Binnenvallers zijn alleen aantallen. Ze blijven bewaard; de rapporten van fase 7 hebben meerdere jaren nodig.
- Een melding bewaart kenteken, contract- of reserveringsnummer, soort, tijdstip en een korte toelichting. Nooit een klantnaam of andere klantgegevens. Een melding verdwijnt 24 maanden na de datum, net als bij Mobiliteit.
- Het logboek bewaart geen vrije tekst van een melding.
- De gegevensexport per medewerker (inzageverzoek) krijgt de tabbladen Meldingen en Dag afgesloten: wat die medewerker zelf maakte of afsloot.

## 2. Datamodel
Eén bundel `supabase/setup/fase-6.sql`. Alles twee keer te draaien, RLS op elke tabel, rechten eerst ingetrokken.

| Tabel | Inhoud | Lezen | Schrijven |
|---|---|---|---|
| `workshops` | vestiging, naam, volgorde, actief | iedereen | beheerder |
| `walk_ins` | vestiging, werkplaats, dag, aantal, wie het laatst wijzigde | iedereen | iedereen tot 7 dagen terug; ouder: teamleider of beheerder |
| `incident_reports` | de velden uit V58, wie meldde, doorbelast ja of nee en door wie | iedereen | aanmaken: iedereen, op eigen naam; wijzigen: de melder op dezelfde dag, anders teamleider of beheerder |
| `day_closures` | vestiging, dag, RentLink gecontroleerd, wie en wanneer | iedereen | afsluiten: iedereen; heropenen: teamleider of beheerder |

- `settings` krijgt: het tijdstip waarna een annulering wordt doorbelast (11:00) en het tijdstip van de herinnering (16:00, of uit).
- Functies: `adjust_walk_in` (plus of min, nooit onder 0, zodat twee collega's tegelijk elkaars tik niet overschrijven), `close_day`, `reopen_day` en `set_incident_charged`.
- Het logboek volgt alle vier de tabellen, zonder vrije tekst.

## 3. Code
- Pure logica in `src/lib/registrations/`: de formulieren, de regel voor doorbelasten, welke dagen meetellen, de stand van een dag en het raster van de invulcontrole. Met tests ernaast.
- `src/lib/nav/modules.ts`: de onderdelen Binnenvallers, Meldingen en Controle.
- De herinnering draait mee in de bestaande geplande taak (`/taken/herinneringen`, elk uur), met de secret key: die taak heeft geen sessie.
- Export in `src/lib/export/`, import in `src/lib/import/`.

## 4. Schermen
- **Binnenvallers** (`/binnenvallers`): vandaag per werkplaats, met plus en min; een tab Overzicht met de laatste twee weken.
- **Meldingen** (`/meldingen`): de meldingen van vandaag, Nieuwe melding, de tabs Doorbelasten en Archief.
- **Dag afsluiten:** een blok onderaan Binnenvallers en Meldingen, en op de tegels van Start.
- **Controle** (`/controle`): de tabs Invulcontrole en Mobiliteit.
- **Beheer → Instellingen:** de werkplaatsen en de twee tijdstippen.

## 5. Bouwvolgorde
1. Datamodel, rechten en databasetests.
2. Werkplaatsen in de instellingen.
3. Binnenvallers.
4. Meldingen en de doorbelastlijst.
5. Dag afsluiten, de invulcontrole en de herinnering.
6. De regel "zelf corrigeren op dezelfde dag", ook bij Mobiliteit.
7. Export, de gegevens per medewerker en het logboek.
8. Historie inlezen (zodra de bestanden er zijn).
9. Documentatie, `docs/OVERDRACHT.md` en de pull request.

De uitlegvideo's volgen als alle fasen klaar zijn, op verzoek van de eigenaar.

## 6. Wat daarna komt, en wat daarvoor nodig is
| Fase | Kan ik bouwen zonder iets van jou? |
|---|---|
| 7. Rapporten en signalen | Ja, zodra fase 6 staat. |
| 8. Locatie en zoeken | Grotendeels. Voor de startlijst heb ik `Locatie huurauto's Den Bosch.xlsx` opnieuw nodig. |
| 9. Rentwise-export en Uitloop | Nee. Ik heb een voorbeeldexport uit Rentwise nodig (zonder klantnamen) en `Uitloop werklijst.xlsx`. |
| 10. Lekkagecontroles | Nee. Naast de export heb ik per controle jullie regel nodig, bijvoorbeeld de vrije kilometers en wanneer aftankkosten gelden. |
| 11. KPI's | Pas na fase 10. |
