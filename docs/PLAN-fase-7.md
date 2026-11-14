# Plan fase 7: rapporten en signalen

**Status: concept van 13 november 2026.** Bouwt voort op fase 6. Niets nieuws om in te vullen voor collega's: deze fase rekent met wat er al staat.

## 1. Besluiten

### V66. Eén onderdeel Rapporten
In de zijbalk komt **Rapporten**, voor beheerder en teamleider. Het adres is `/rapporten`. De tabs: Overzicht, Binnenvallers, Meldingen, Mobiliteit en Doorbelasten.

### V67. De periode kies je zelf
Bovenaan elk rapport staat dezelfde keuze:
- **per week, per maand of per jaar**;
- **hoeveel perioden**: een aantal dat je aanvinkt of intypt (bijvoorbeeld 3, 6 of 12 maanden), of losse maanden die je aanvinkt;
- **vestiging**: alle, of één.

De keuze staat in het adres van de pagina. Een rapport is dus te delen als link en te bewaren als favoriet.

### V68. Wat de rapporten tonen
| Rapport | Inhoud |
|---|---|
| Overzicht | per periode: binnenvallers, meldingen per soort, door te belasten en doorbelast, auto's aan Mobiliteit en hoeveel daarvan niet zijn ingezet; met het verschil met de periode ervoor |
| Binnenvallers | per vestiging en per werkplaats; de top 5 werkplaatsen; gemiddeld per werkdag |
| Meldingen | per soort, per vestiging en per werkplaats; meldingen per 100 binnenvallers, zodat een drukke werkplaats eerlijk wordt vergeleken |
| Mobiliteit | auto's per werkdag tegen het minimum; het aandeel niet ingezet; auto's die te lang uit stonden |
| Doorbelasten | annuleringen vanaf 11:00, doorbelast en nog open, per werkplaats |

Elk rapport heeft een tabel en, waar het helpt, een eenvoudige staaf- of lijngrafiek. De grafieken tekent Planbord zelf als SVG: geen bibliotheek van buiten en geen JavaScript op de client.

### V69. Signalen
Een signaal is een regel onder **Let op** op Start, voor beheerder en teamleider. Elk signaal verwijst naar het rapport of de lijst waar het uit komt.
- Een werkplaats heeft deze week meer dan twee keer zoveel meldingen als gemiddeld in de acht weken ervoor, en minstens 3.
- Een vestiging sloot deze week twee of meer dagen niet af.
- Er staan annuleringen ouder dan 14 dagen op de doorbelastlijst.
- Een vestiging gaf deze week op twee of meer dagen te weinig auto's aan Mobiliteit.
- Meer dan een derde van de auto's voor Mobiliteit is deze maand niet ingezet.

De grenzen zijn instellingen (Beheer → Instellingen → Signalen), en elk signaal is uit te zetten. Signalen staan alleen op Start; er gaat geen mail of push uit.

### V70. Export
Elk rapport heeft **Download (Excel)**, met dezelfde periode en dezelfde cijfers als op het scherm. Elke export staat in het logboek.

### V71. Privacy
Rapporten tonen aantallen per vestiging en werkplaats. **Geen cijfers per medewerker**: wie een melding maakte of een dag afsloot, komt niet in een rapport. Planbord is geen middel om collega's te beoordelen. Cijfers per medewerker uit Rentwise komen pas aan de orde in fase 11, als apart besluit.

## 2. Datamodel
Geen nieuwe tabellen voor de cijfers: de rapporten tellen uit `walk_ins`, `incident_reports`, `day_closures` en `vehicle_loans`.
- Functies in de database die per periode optellen (`report_walk_ins`, `report_incidents`, `report_loans`), alleen voor beheerder en teamleider. Zo hoeft de app geen duizenden regels op te halen.
- `settings` krijgt de grenzen van de signalen.
- Omdat meldingen en uitleen na 24 maanden verdwijnen, bewaart een tabel `monthly_totals` per maand de aantallen (vestiging, werkplaats, soort, aantal), zonder kentekens of nummers. Zo blijven de jaarcijfers kloppen. De geplande taak vult die tabel op de eerste dag van de maand.

## 3. Code
- Pure logica in `src/lib/reports/`: perioden bepalen, optellen, vergelijken met de vorige periode, de signalen en de opbouw van een grafiek. Met tests.
- `src/components/charts.tsx`: staven en lijnen als SVG, met een tabel eronder voor wie de grafiek niet kan zien.

## 4. Bouwvolgorde
1. De periodekeuze en de logica voor perioden.
2. De databasefuncties en `monthly_totals`, met tests.
3. De vijf rapporten.
4. De signalen en hun instellingen.
5. Export, documentatie en de pull request.

## 5. Vragen voor de eigenaar
Geen die de bouw tegenhouden. Wil je andere grenzen voor de signalen, dan pas je ze zelf aan in de instellingen.
