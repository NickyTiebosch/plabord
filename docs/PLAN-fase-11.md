# Plan fase 11: KPI's en het directierapport

**Status: concept van 14 november 2026.** Het tweede deel van de opdracht van de directeur. Rekent met alles uit fase 5 tot en met 10; er komt geen nieuwe invoer bij.

## 1. Besluiten

### V97. Onderdeel KPI's
In de zijbalk komt **KPI's** (`/kpi`). Tabs: Vestigingen, Medewerkers en Directierapport. Bovenaan staat dezelfde periodekeuze als in fase 7: week, maand of jaar, een aantal perioden of losse maanden die je aanvinkt, en de vestiging.

### V98. Cijfers per vestiging
Per periode, met het verschil met de periode ervoor:
- aantal overeenkomsten, per soort;
- omzet huur, korting, meerkilometers en brandstof, in hele euro's;
- bevindingen: aantal, geschat bedrag open, hersteld en terecht;
- het **lekpercentage**: geschat blijven liggen ten opzichte van de omzet huur;
- binnenvallers, meldingen per soort, doorbelast en nog open;
- Mobiliteit: auto's per werkdag en het aandeel niet ingezet;
- Uitloop: open auto's, afgehandeld in de periode, retour verlopen;
- afgesloten dagen: hoeveel procent van de werkdagen.

### V99. Cijfers per medewerker
Op basis van de Rentwise-code (V81):
- aantal overeenkomsten;
- bevindingen: aantal en geschat bedrag, en hoeveel daarvan hersteld of terecht;
- **bevindingen per 100 overeenkomsten**, zodat iemand met veel overeenkomsten eerlijk wordt vergeleken.

Bewust niet per medewerker: binnenvallers, meldingen en afgesloten dagen. Dat is werk van de vestiging als geheel.

Een medewerker met minder dan 20 overeenkomsten in de periode krijgt geen verhoudingsgetal: te weinig om iets over te zeggen.

### V100. Wie ziet wat
- **Beheerder:** alles.
- **Teamleider:** de vestigingen altijd; de medewerkers alleen als de beheerder dat aanzet (instelling, standaard uit).
- **Medewerker:** standaard niets. De beheerder kan aanzetten dat iedereen de **eigen** cijfers ziet, nooit die van een ander.
- Cijfers per medewerker komen niet in een pushmelding of mail, en niet op Start.

### V101. Dit ligt bij de eigenaar, niet bij de code
Cijfers per medewerker bijhouden is het beoordelen van personeel met een systeem. Daar horen binnen het bedrijf HR en, als die er is, de ondernemingsraad bij betrokken te zijn, en medewerkers horen te weten dat het gebeurt. Het tabblad Medewerkers staat daarom **standaard uit** en gaat pas aan met een instelling van de beheerder. De tab Vestigingen en het directierapport werken zonder.

### V102. Directierapport
Eén pagina per maand, om te downloaden als PDF en als Excel:
- de kerncijfers van V98 voor het geheel en per vestiging, met de vorige maand en dezelfde maand een jaar eerder ernaast;
- de drie grootste lekken van de maand, per controle;
- wat er is hersteld;
- een leeg vak voor een toelichting, die de beheerder zelf typt voor het downloaden. Die tekst wordt niet bewaard.

Geen namen van medewerkers en geen klantgegevens in het directierapport.

### V103. Bewaren
De overeenkomsten verdwijnen na 24 maanden. De maandtotalen (fase 7) worden uitgebreid met de cijfers van V98 per vestiging, zodat het rapport ook over meerdere jaren klopt. Per medewerker bewaren we **geen** totalen langer dan de 24 maanden van de overeenkomsten zelf.

## 2. Datamodel
- `monthly_totals` (fase 7) krijgt de soorten uit V98.
- Functies in de database die per periode optellen per vestiging en per medewerkercode, met de rechten van V100 in de functie zelf én in RLS.
- `settings`: teamleider ziet medewerkers (uit), medewerker ziet eigen cijfers (uit), tabblad Medewerkers (uit).

## 3. Code
- `src/lib/kpi/`: de verhoudingsgetallen, de ondergrens van 20, de vergelijking met vorige perioden en de opbouw van het directierapport. Puur, met tests.
- De PDF komt uit dezelfde opbouw als de pagina (afdrukstijl), zonder extra pakket als dat lukt.

## 4. Bouwvolgorde
1. De optelfuncties en de rechten, met databasetests voor elke rol.
2. Vestigingen.
3. Directierapport.
4. Medewerkers, achter de instelling.
5. Export, documentatie en de pull request.
6. **Daarna, als laatste van het geheel:** alle uitlegvideo's en de PDF opnieuw, met de nieuwe navigatie en de nieuwe onderdelen.

## 5. Vragen voor de eigenaar
1. **Omzet:** is `bedraghuur` uit de export het juiste getal voor de omzet huur, en is dat zonder btw?
2. **Welke cijfers wil de directeur elke maand zien?** V98 is mijn voorstel; schrap of vul aan.
3. **Medewerkers:** wil je het tabblad Medewerkers direct, of eerst alleen de vestigingen en het directierapport (voorstel: het tweede, tot het binnen het bedrijf is afgestemd)?
4. **Doelen:** zijn er normen, bijvoorbeeld een lekpercentage onder een bepaalde grens? Dan kleurt het rapport daarop.
