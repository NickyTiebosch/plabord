# Plan fase 9: de Rentwise-export inlezen, en de Uitloop

**Status: concept van 14 november 2026.** Vervangt `Uitloop werklijst.xlsx`. Het inlezen van de export is ook de basis voor fase 10 en 11.

## 1. Besluiten

### V79. Twee exports uit Rentwise
Planbord leest twee bestanden, allebei met de hand geüpload onder **Beheer → Rentwise**. Er komt geen koppeling met Rentwise.

| Bestand | Voorbeeld | Waarvoor |
|---|---|---|
| Overeenkomstenlijst | `Overeenkomsten oktober.xlsx` | status, soort, filialen, vertrek en retour, huurder, bestuurder, telefoon, reden, opmerking |
| Financiële export | `RentWiseOvereenkomsten.xlsx` | kilometerstanden, vrije kilometers, bedragen, korting, brandstof, aftankkosten, medewerkercode, debiteurengroep |

De sleutel is het **overeenkomstnummer** (`Nummer` en `novereenkomstnummer`). Een upload werkt bestaande overeenkomsten bij en voegt nieuwe toe; er verdwijnt nooit iets door een upload. Eerst zie je een voorbeeld (nieuw, gewijzigd, overgeslagen, onbekende kolommen), daarna bevestig je.

De overeenkomstenlijst begint met een titelregel en heeft de koppen op rij 2. De parser zoekt de kopregel zelf en herkent kolommen op naam, niet op positie.

### V80. Klantgegevens: besluit van de eigenaar
Tot nu toe gold: nooit klantnamen. Op 13 november 2026 besloot de eigenaar: **Huurder, Bestuurder en Telefoon mogen worden opgeslagen en gebruikt.** Zonder die kolommen kan de Uitloop niet: je moet weten wie de auto heeft en wie je belt.

Dat verandert de harde regel, dus leggen we de grenzen vast:
- De drie kolommen staan in een **aparte tabel** (`rental_contacts`), los van de overeenkomst zelf.
- **Wie ze ziet:** wie in de Uitloop meedoet, de teamleider en de beheerder. Andere collega's zien de overeenkomst zonder naam en telefoon.
- **Waar ze niet komen:** niet in het logboek, niet in mails of pushmeldingen, niet in rapporten, KPI's of het directierapport, en niet in een export behalve die van de Uitloop.
- **Bewaren:** de naam en het telefoonnummer verdwijnen 3 maanden nadat de overeenkomst is afgerekend. De overeenkomst zelf (zonder klantgegevens) blijft 24 maanden, voor de controles en de cijfers.
- De kolom Opmerking uit de export lezen we **niet** in: daar staat vrije tekst in waar van alles in kan staan.
- `CLAUDE.md`, `docs/SPEC.md` en de routekaart (uitgangspunt 6) worden bij de bouw aangepast aan dit besluit.

**Let op (voor de eigenaar):** hiermee staan klantgegevens van Van den Udenhout in een database op een account van 22labs. Dat is geen keuze voor de code, maar voor het bedrijf: stem het af met wie bij Van den Udenhout over privacy gaat (verwerkersovereenkomst, verwerkingsregister). Zolang dat niet rond is, kan fase 9 op de testomgeving met verzonnen gegevens worden gebouwd en getest.

### V81. Filialen en medewerkercodes
- De export gebruikt filiaalcodes (EHV, DB1, DB6, OSS, BRD, VEL, RSDOCC, RSDAU, HAL, SHO, VEG). Onder Beheer → Rentwise koppelt de beheerder elke code aan een vestiging van Planbord. Een onbekende code blokkeert de upload niet; hij staat als "niet gekoppeld" in het voorbeeld.
- De export gebruikt medewerkercodes (zoals NTIE). Bij een medewerker komt een veld **Rentwise-code**. Dat is nodig voor fase 10 en 11; de Uitloop gebruikt het niet.

### V82. Onderdeel Uitloop
In de zijbalk komt **Uitloop** (`/uitloop`), voor wie meedoet, de teamleider en de beheerder. Tabs: Mijn auto's, Werklijst, Overzicht, Archief, en voor de teamleider Verdelen.

Per auto, zoals in het huidige bestand: kenteken, prio (Hoog, Normaal, Laag), uitloopdatum, auto, waar nu, retour, bestemming (VWPFS, VDU of leeg), wie pakt op, status, afspraak en datum.

Statussen: **Open, Contact gezocht, Wacht op vervanger, Ingepland, Retour binnen, Uit vloot, Blijft voorlopig.** Uit vloot en Blijft voorlopig zetten de auto in het archief.

### V83. Wat Planbord zelf invult
Uit de overeenkomstenlijst, op kenteken, uit de overeenkomst die loopt:
- **Waar nu:** de huurder, of "Op vestiging …" als er geen lopende overeenkomst is;
- **Retour:** de retourdatum van die overeenkomst;
- telefoon en bestuurder, achter een tik op de auto.

Wat een collega zelf heeft ingevuld (status, afspraak, datum) wordt door een upload nooit overschreven.

### V84. Nieuwe auto's: de lijst van Frank
Onder Verdelen plak of upload je de lijst met auto's die uit de vloot mogen. Planbord toont eerst wat nieuw is en wat al op de werklijst staat. Een kenteken staat maar één keer op de werklijst.

### V85. Verdelen
Zoals het script nu doet, maar als vaste, geteste regel:
- de teamleider vinkt aan wie meedoet;
- alleen auto's zonder naam worden verdeeld;
- eerst Hoog, dan Normaal, dan Laag, steeds naar wie de minste open auto's heeft; bij gelijke stand op alfabet. Dezelfde invoer geeft altijd dezelfde verdeling;
- je ziet eerst het voorstel en bevestigt daarna. Een auto met de hand aan iemand geven of overzetten kan altijd.

Na het verdelen krijgt iedereen een pushmelding met het aantal nieuwe auto's (geen kentekens of namen in de melding), als de schakelaar Meldingen versturen aan staat.

### V86. Mijn auto's
Het scherm voor de telefoon: je eigen auto's, Hoog bovenaan. Per auto drie tikken: status kiezen, afspraak typen, datum kiezen. Het telefoonnummer is een link om te bellen.

### V87. Overzicht en signalen
Zoals het tabblad Overzicht: per prio het aantal per status, en de lijsten **retour bij klant verlopen**, **nog niemand opgepakt** en **terug maar nog niet afgemeld**. De eerste twee komen ook als signaal onder Let op op Start (fase 7).

### V88. Historie en export
- De werklijst (ongeveer 80 auto's) en het archief (ongeveer 340) worden één keer ingelezen. Namen in Wie pakt op koppelen we aan medewerkers als de voornaam precies één keer voorkomt.
- Export: de tabbladen Werklijst en Archief, in de opbouw van het huidige bestand.

## 2. Datamodel
| Tabel | Inhoud | Lezen | Schrijven |
|---|---|---|---|
| `rentwise_imports` | wie, wanneer, welk soort bestand, aantallen | beheerder, teamleider | via de importfunctie |
| `rental_agreements` | nummer (uniek), soort, status, kenteken, vervangt kenteken, categorie, filialen, vertrek, retour, afgerekend, opdracht- en toestemmingsnummer, reden, en uit de financiële export: kilometers, vrije kilometers, bedragen, korting, brandstof, aftankkosten, medewerkercode, debiteurengroep | teamleider en beheerder; deelnemers aan de Uitloop alleen via de werklijst | alleen de importfunctie |
| `rental_contacts` | nummer, huurder, bestuurder, telefoon | zie V80 | alleen de importfunctie |
| `rentwise_branches` | filiaalcode → vestiging | iedereen | beheerder |
| `runoff_vehicles` | de werklijst: de velden uit V82, plus gearchiveerd op | deelnemers, teamleider, beheerder | eigen auto's: status, afspraak, datum; teamleider: alles |
| `runoff_participants` | wie meedoet | deelnemers | teamleider |

- Bedragen als hele centen (integer), geen kommagetallen.
- Een geplande opruiming haalt `rental_contacts` weg 3 maanden na afrekenen en `rental_agreements` na 24 maanden.
- Het logboek bewaart bij de Uitloop wie wat wijzigde, zonder de tekst van de afspraak en zonder klantgegevens.

## 3. Code
- `src/lib/import/rentwise.ts`: de twee parsers, puur en getest met verzonnen bestanden (nooit de echte exports in de repo).
- `src/lib/runoff/`: verdelen, het overzicht, waar nu en retour afleiden. Puur, met tests.
- De upload verwerkt een bestand van 30.000 regels: inlezen op de server, in delen naar de database via één functie per deel. Meet dit op de preview; lukt het niet binnen de tijdslimiet van Vercel, dan in delen uploaden per maand.

## 4. Bouwvolgorde
1. Datamodel, rechten en tests, met de opruiming.
2. De parsers en het uploadscherm met voorbeeld.
3. Filialen en Rentwise-codes koppelen.
4. De Uitloop: werklijst, Mijn auto's, archief.
5. De lijst van Frank en verdelen.
6. Overzicht, signalen, historie, export, documentatie (ook `CLAUDE.md` voor V80) en de pull request.

## 5. Vragen voor de eigenaar
1. **Filialen:** bij welke vestiging horen DB1, DB6, OSS, VEL, VEG, SHO, HAL, RSDOCC en RSDAU? Je kunt dit ook zelf invullen in Beheer; dan hoef ik het niet te weten.
2. **Wie doet mee aan de Uitloop:** alleen de namen die nu in het bestand staan, of kan de teamleider dat zelf bijhouden (voorstel: het tweede)?
3. **Bewaartermijn van naam en telefoon:** 3 maanden na afrekenen. Akkoord, of korter of langer?
4. **De lijst van Frank:** in welke vorm komt die (Excel, mail, altijd dezelfde kolommen)? Een voorbeeld is genoeg.
5. **Privacy binnen het bedrijf:** zie de waarschuwing bij V80.
