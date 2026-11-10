# Routekaart: van Planbord naar één systeem voor verhuur

**Status: voorstel van 10 november 2026, nog niet goedgekeurd.** Dit document beschrijft het geheel. Per fase komt er een eigen plan (`docs/PLAN-fase-N.md`) dat je apart goedkeurt. Het plan van fase 5 is al uitgeschreven.

## Waar we naartoe gaan
Planbord is nu de rooster- en verlofapp. Het wordt de plek waar het verhuurteam ook zijn dagelijkse registraties bijhoudt, en waar jij en de teamleider de cijfers en de controle zien. De losse Excel-bestanden verdwijnen één voor één.

| Nu in Excel | Wordt in Planbord | Fase |
|---|---|---|
| Uitleenregistratie (nieuw, via Copilot geprobeerd) | Uitleen: aanmelden en retour melden | 5 |
| Binnenvallers Registratie | Binnenvallers per vestiging per werkplaats | 6 |
| WPL meldingen dagregistratie | Meldingen per vestiging, met doorbelastlijst | 6 |
| Dashboards in die twee bestanden | Rapport per werkplaats, signalen | 7 |
| Locatie huurauto's Den Bosch | Parkeerplekken, zoeken op kenteken | 8 |
| (bestaat niet) | Lekkagecontroles op de Rentwise-export | 9 |
| (bestaat niet) | KPI's per medewerker en per vestiging | 10 |
| Uitloop werklijst | Blijft voorlopig Excel | later |

## Uitgangspunten
Deze gelden voor elke fase.

1. **Live blijft ongemoeid tot jij akkoord geeft.** Alles wordt eerst gebouwd en getest op een aparte testomgeving met een eigen database (fase 5 regelt die).
2. **Invoeren is één of twee tikken.** Een knop boven een formulier, een keuze boven typen, en wat de app al weet (wie, wanneer, welke vestiging) vult hij zelf in. Alles blijft aanpasbaar.
3. **Per vestiging.** De invoer en de controle blijven per vestiging gescheiden, zoals nu met de tabbladen.
4. **Controle zichtbaar voor beheerder en teamleider.** Zij zien per dag per vestiging of alles is bijgehouden.
5. **Overdraagbaar.** Planbord moet zonder jou verder kunnen:
   - elk onderdeel heeft een Excel-export in de opbouw van het huidige bestand (de gratis versie);
   - er zit niets persoonlijks in de code: mailbox, adres en sleutels zijn instellingen;
   - `docs/OVERDRACHT.md` beschrijft stap voor stap hoe het naar een ander Vercel- en Supabase-account gaat;
   - een onderdeel is pas af als het in de export en in het overdrachtsdocument staat.
6. **Zo min mogelijk gegevens.** Geen klantnamen, geen rijbewijs- of adresgegevens. Bij vrije tekst staat erbij dat klantgegevens niet nodig zijn.
7. **Geen AI in de app.** Controles en signalen zijn vaste regels: dezelfde gegevens geven altijd dezelfde uitkomst.
8. **Geen koppeling met Rentwise.** Rentwise blijft de bron voor contracten en de vloot. Planbord leest hooguit een export in die iemand uploadt.

## De fasen

### Fase 5: fundament en uitleen
Uitgewerkt in `docs/PLAN-fase-5.md`.
- Aparte testomgeving met eigen database.
- Rol Teamleider.
- Nieuwe tab Registraties, met als eerste onderdeel Uitleen: auto aanmelden, retour melden (ingezet of niet ingezet), archief.
- Controle op de uitleen per dag per vestiging.
- Excel-export van de uitleen en het overdrachtsdocument.

### Fase 6: binnenvallers, meldingen en de invulcontrole
- **Werkplaatsen per vestiging** als lijst in Beheer, met de werkplaatsen uit de huidige bestanden als startwaarde (Den Bosch: Volkswagen, Audi, Bedrijfswagens, Seat Skoda, Oss, Carlux Den Bosch, Carlux Oss; Eindhoven: Volkswagen, Audi, Veldhoven, Bedrijfswagens, Carlux Best; Breda: Volkswagen, Audi, Bedrijfswagens, Seat Skoda, Roosendaal, Halsteren, Den Elzen Breda, Den Elzen Roosendaal).
- **Binnenvallers.** Per vestiging één scherm voor vandaag: per werkplaats een teller met plus en min. De hele dag door bij te werken.
- **Meldingen.** Eén formulier per melding, met dezelfde keuzes als nu:
  - soort: contract/rijbewijs niet in orde, verkeerde auto meegegeven, annulering door werkplaats, te laat retour;
  - bij contract/rijbewijs: wat ontbrak (handtekening, rijbewijscontrole of beide);
  - bij een annulering: het tijdstip. Vanaf 11:00 (instelbaar) staat Doorbelasten vanzelf op ja;
  - kenteken, contract- of reserveringsnummer en bijzonderheden.
- **Doorbelastlijst.** Alle annuleringen die doorbelast moeten worden, met de status doorbelast ja of nee.
- **Dag afsluiten.** Aan het eind van de dag tikt de vestiging op Dag afgesloten, en vinkt daarbij af dat de contracten in RentLink zijn gecontroleerd. Een dag zonder meldingen is daarmee een bewuste keuze en geen vergeten dag.
- **Invulcontrole.** Een raster van vestiging × dag voor beheerder en teamleider: groen als de dag is afgesloten, rood als dat niet zo is.
- **Herinnering.** Een vestiging die om 16:00 (instelbaar) de dag nog niet heeft afgesloten, krijgt een pushmelding. Dit gebruikt de pushmeldingen uit fase 4.
- **Historie inlezen.** De huidige Excel-bestanden worden één keer ingelezen, zodat de cijfers vanaf juli en september 2026 bewaard blijven.
- **Export** in de opbouw van de huidige bestanden: per vestiging een tabblad.

Vragen die in het plan van fase 6 terugkomen:
- Wie krijgt de herinnering: iedereen van de vestiging die die dag werkt, of één vaste persoon?
- Mag iedere collega een melding van een ander corrigeren, of alleen de teamleider?

### Fase 7: rapporten en signalen
- **Periodekiezer.** Week, maand of jaar, en een lijst waarin je aanvinkt welke maanden je wilt zien. Elke periode staat naast de vorige.
- **Rapport per werkplaats.** Per periode: binnenvallers, meldingen per soort, te late annuleringen en wat er doorbelast is of nog moet. Te downloaden als Excel en als afdrukbare pagina voor het overleg met de werkplaats.
- **Rapport per vestiging.** Dezelfde cijfers, opgeteld per vestiging, plus de uitleen: uitgegeven, ingezet en niet ingezet.
- **Signalen.** Vaste regels, bijvoorbeeld: een werkplaats zit drie weken achter elkaar boven zijn gemiddelde. De drempels zijn instelbaar.
- **Stand van vandaag.** De startpagina van Registraties toont per vestiging wat er vandaag al is geregistreerd en wat nog openstaat.

### Fase 8: locatie en zoeken
- **Parkeerplekken.** De lijst Locatie huurauto's, per vestiging: kenteken en plek (zoals S 18, Achter, Zijkant). Een plek wijzig je met één tik.
- **Plek vragen bij retour.** Bij een retourmelding van een uitgeleende auto vraagt de app waar de auto staat.
- **Zoeken op kenteken.** Eén zoekveld dat toont wat Planbord zelf over die auto weet: plek, uitleen en meldingen. Geen wagenkaart en geen kopie van Rentwise.
- **Overdracht per vestiging.** Een korte notitie voor de collega van morgen, die na een week vanzelf verdwijnt. Zonder klantgegevens.

### Fase 9: lekkagecontroles op de Rentwise-export
Dit is het eerste deel van de opdracht van de directeur: welke kosten zijn blijven liggen.
- **Export uploaden.** Een beheerder of teamleider uploadt de export uit Rentwise. Planbord bewaart alleen de kolommen die de controles nodig hebben. Klantnamen en andere klantgegevens worden bij het inlezen weggelaten en nergens opgeslagen.
- **Vaste controles.** Welke er komen hangt af van de kolommen in de export. Kandidaten:
  - brandstof doorbelast zonder aftankkosten;
  - meer gereden dan de vrije kilometers, zonder meerkilometers;
  - te laat retour zonder extra dag;
  - schade gemeld zonder eigen risico op het contract;
  - korting zonder reden;
  - een te late annulering door de werkplaats (uit fase 6) die niet is doorbelast.
- **Bevindingen.** Elke afwijking wordt een bevinding met bedrag in hele euro's, contractnummer, kenteken, medewerker en status: open, hersteld of terecht. Een bevinding handel je af met één tik en een korte reden.
- **Dagelijks of wekelijks.** Als Rentwise een geplande export kan mailen, kan die later automatisch worden ingelezen. Tot dan is het uploaden met de hand.

Nodig voordat dit plan geschreven kan worden:
- een voorbeeldexport uit Rentwise, zonder klantnamen;
- per controle de regel zoals jullie hem hanteren, bijvoorbeeld het aantal vrije kilometers en wanneer aftankkosten gelden.

### Fase 10: KPI's per medewerker en per vestiging
Het tweede deel van de opdracht van de directeur.
- **Per week, maand en jaar**, met dezelfde periodekiezer als in fase 7.
- **Per medewerker en per vestiging:** aantal contracten, aantal bevindingen, het bedrag dat is blijven liggen, het bedrag dat is hersteld, en de registraties uit fase 5 en 6. Het aantal contracten staat ernaast, zodat iemand met veel contracten eerlijk wordt vergeleken.
- **Zichtbaarheid:** alleen beheerders, en de teamleider als jij dat aanzet. Een medewerker ziet standaard alleen de eigen cijfers, of niets; dat is een keuze voor het plan.
- **Directierapport:** één pagina per maand, te downloaden.

Een keuze die bij jou ligt en die ik hier alleen noteer: cijfers per medewerker bijhouden is iets waar HR en een eventuele ondernemingsraad doorgaans bij betrokken worden. De app dwingt daar niets in af.

### Later of niet
- **Uitloop werklijst.** Blijft Excel. Het bestand is net ingevoerd en hangt aan de export uit Rentwise en het verdeelscript. Na fase 8 kijken we opnieuw.
- **Foto's van schade.** Vraagt opslag en bewaartermijnen. Niet gepland.
- **Wagenkaart per kenteken.** Geschrapt: de gegevens veranderen de hele dag in Rentwise.
- **Formulier zonder inloggen.** Niet: Planbord toont geen gegevens zonder inloggen.
- **Vraagbaak.** Die bouw je in Copilot. Planbord krijgt hooguit een link.

## Werkwijze en modelkeuze
- Elke fase volgt de vaste werkwijze uit `CLAUDE.md`: plan, akkoord, bouwen op een eigen branch, pull request met testlink, wachten.
- De plannen staan in de repo. Een nieuwe sessie kan daardoor zonder dit gesprek verder: "lees docs/PLAN-fase-5.md en bouw fase 5".
- Advies: het plan en het ontwerp van rechten en database op het sterkste model; het bouwen volgens een goedgekeurd plan kan op een lichter model, in een aparte sessie per fase.
