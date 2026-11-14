# Plan fase 8: locatie van huurauto's, en zoeken

**Status: gebouwd op 14 november 2026**, op opdracht van de eigenaar ("bouw fase 6 t/m 8"). Vervangt `Locatie huurauto's Den Bosch.xlsx`.

## Uitwerkingen tijdens de bouw
- **Het oude bestand** is een lijst van kenteken en plek (S 18, S 20, S 22, Achter, Zijkant), geen raster met plekken als kolommen. De export volgt die lijst: per vestiging Kenteken, Plek, Model, Verzet door, Verzet op en Lang niet gezien (V78 aangepast).
- **Startwaarden voor Den Bosch:** de plekken uit het bestand (Zijkant, Achter, S 18, S 20, S 22). De auto's zelf staan niet in de code; die lees je in onder Beheer → Plekken → **Lijst inlezen**. Onbekende plekken worden dan toegevoegd.
- **Plekken toevoegen** kan met meerdere tegelijk, één per regel (bijvoorbeeld S 1 tot en met S 30).
- **Zichtbaar:** het onderdeel Locatie staat in het menu voor wie op een vestiging met plekken werkt, en voor beheerder en teamleider zodra een vestiging plekken heeft. Zoeken op kenteken kan iedereen, via het vergrootglas of het zoekveld bovenaan.
- **Tabs van Locatie:** Terrein en Zoeken.
- **Gegevens per medewerker:** een tabblad Locatie met de auto's die die medewerker het laatst verzette.
- **Aanvulling van 14 november** (de eigenaar wilde ze alsnog, uit de routekaart):
  - **Plek bij retour:** na Retour · ingezet of Retour · niet ingezet vraagt Mobiliteit "Waar staat de auto nu?", met een knop per plek van die vestiging. Eén tik zet de auto bij Locatie; *Niet op het terrein* slaat het over. Alleen als de vestiging plekken heeft.
  - **Overdracht per vestiging** (`/overdracht`): een notitie van hooguit 300 tekens voor de collega van morgen, op Start bij de eigen vestiging. Na 7 dagen verdwijnt hij vanzelf. De schrijver wijzigt of verwijdert hem op dezelfde dag, daarna de teamleider (zoals V59). Het logboek bewaart de tekst niet. Export voor beheerder en teamleider; de gegevens per medewerker tonen de eigen notities.


## 1. Besluiten

### V72. Onderdeel Locatie
In de zijbalk komt **Locatie**, voor iedere collega. Het adres is `/locatie`. Het beantwoordt één vraag: waar staat deze auto?

### V73. Plekken per vestiging
De beheerder legt per vestiging de plekken vast (Beheer → Plekken): een naam en een volgorde, bijvoorbeeld Zijkant, Achter, Showroom, Wasstraat. De startlijst voor Den Bosch komt uit de koppen van het huidige bestand. Eindhoven en Breda beginnen leeg; het onderdeel is voor hen pas zichtbaar als er plekken zijn.

### V74. Een auto op een plek zetten
- Tik op een plek en vul het kenteken in, of zoek het kenteken en kies de plek. Twee tikken en een kenteken.
- Een auto staat op één plek tegelijk. Zet je hem ergens anders, dan verdwijnt hij vanzelf van de oude plek.
- **Weg** haalt de auto van het terrein, bijvoorbeeld als hij is verhuurd.
- Bij elke auto staat wie hem het laatst verzette en wanneer. Een auto die langer dan 14 dagen niet is verzet, krijgt een grijs label "lang niet gezien", zodat de lijst niet stilletjes veroudert.

### V75. Model en merk
Het model vult Planbord zelf in als het kenteken bekend is uit Mobiliteit of, vanaf fase 9, uit de Rentwise-export. Anders vul je het één keer in.

### V76. Zoeken op kenteken, door heel Planbord
Bovenaan elke pagina komt een zoekveld. Een kenteken (of een deel ervan) toont alles wat Planbord van die auto weet:
- waar hij nu staat;
- of hij uit staat via Mobiliteit, en de laatste keren;
- meldingen op dit kenteken;
- vanaf fase 9: de status in de Uitloop en de laatste overeenkomsten.

Een **wagenkaart** per auto (een eigen dossier dat je bijhoudt) bouwen we niet; de eigenaar vond dat overbodig. De zoekpagina toont alleen wat er al is.

### V77. Rechten, logboek en bewaren
- Iedere collega leest en verzet. Plekken beheren doet de beheerder.
- Elke verplaatsing staat in het logboek. De tabel bewaart alleen de huidige plek; de geschiedenis staat in het logboek.
- Geen klantgegevens.

### V78. Export
Beheer → Export → **Locatie downloaden**: per vestiging een tabblad met de plekken als kolommen, zoals het huidige bestand.

## 2. Datamodel
| Tabel | Inhoud | Schrijven |
|---|---|---|
| `parking_spots` | vestiging, naam, volgorde, actief | beheerder |
| `vehicle_locations` | kenteken (uniek), vestiging, plek, model, wie en wanneer | iedereen, via een functie `place_vehicle` |

## 3. Bouwvolgorde
1. Datamodel, rechten en tests.
2. Plekken beheren.
3. Het scherm Locatie: per plek de auto's, verzetten en weg.
4. Zoeken op kenteken.
5. De startlijst inlezen uit het Excel-bestand, de export, documentatie en de pull request.

## 4. Vragen voor de eigenaar
1. Klopt het dat alleen Den Bosch zo'n lijst bijhoudt, en dat Eindhoven en Breda er later bij kunnen?
2. Het huidige bestand heeft kolommen als Zijkant. Zijn dat alle plekken, of gebruik je er in de praktijk meer?
