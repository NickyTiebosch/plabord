# Uitlegvideo's en PDF (besluit V30)

Deze map maakt de video's en de PDF op de pagina `/uitleg`. Hij hoort niet bij de app: Netlify installeert hier niets en de build kijkt er niet naar.

**Hoe het werkt**
- Elke video is een HTML-pagina in `videos/`, met een eigen tijdlijn (`lib/motion.js`).
- `render.mjs` zet die beeld voor beeld om naar MP4 (H.264, 1080 × 1920, 30 beelden per seconde), zonder geluid.
- De schermen van Planbord zijn echte schermafbeeldingen (`assets/screens/`), gemaakt met een **verzonnen team**. Gebruik nooit echte collega's.
- De telefoononderdelen (beginscherm, Safari, Chrome, dialogen, meldingen) zijn eenvoudige eigen nabootsingen in `lib/ios.js` en `lib/android.js`.
- De teksten van de pagina en de PDF staan in `src/lib/guide/topics.ts`. De ondertitels staan in de video's zelf.

## Nodig
- Node 22.18 of nieuwer: `pdf.mjs` leest `topics.ts` direct in.
- `ffmpeg` met libx264, op het PATH (of zet `FFMPEG=/pad/naar/ffmpeg`).
- `npm install` in deze map (Playwright en `qrcode`). Daarna één keer `npx playwright install chromium`, als je nog geen Chromium voor Playwright hebt.

## Alleen een tekst of de timing aanpassen
De schermafbeeldingen staan al klaar:

```sh
cd tools/uitleg-video
node render.mjs meldingen-iphone --frames=2,11,14   # losse beelden in out/, om te bekijken
node render.mjs meldingen-iphone                    # de hele video naar out/meldingen-iphone.mp4
node pdf.mjs                                        # de PDF naar out/planbord-uitleg.pdf
node publish.mjs                                    # lichtere versies en de PDF naar public/uitleg
```

Zet daarna de bestanden in `public/uitleg` in een commit. De test `src/lib/guide/topics.test.ts` controleert dat elke video, elke poster en de PDF er staan.

## Een scherm van Planbord is veranderd
Maak de schermafbeeldingen opnieuw, met de nagebootste Supabase en het verzonnen team uit `mock/seed.sql`:

1. Start de nagebootste Supabase: `node mock/server.mjs` (poort 54321). De inlogcode is altijd `123456`.
   - Snelheid meten (besluit V31): `MOCK_DELAY_MS=100` geeft elke vraag 0,1 seconde vertraging, zoals tussen de VS en Frankfurt. Met `MOCK_LOG=1` zie je elke vraag die de app stelt.
2. Bouw en start Planbord in de hoofdmap, met deze waarden. Ze werken alleen tegen de nabootsing:

   ```sh
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_localtest
   SUPABASE_SECRET_KEY=sb_secret_localtest
   SITE_URL=https://planbord-udenhout.netlify.app
   VAPID_PUBLIC_KEY=<een willekeurige publieke P-256-sleutel, bijvoorbeeld uit Beheer → Instellingen>
   ```

   Gebruik daarna `npm run build` en `npx next start -p 3000`.
3. Zet de afwijkingen voor Sanne klaar: `node demo-data.mjs`. Dat zijn een gewijzigde dag, een vrije dag, een inval en afwezigheid.
4. Leg de schermen vast: `node capture.mjs`. Dit overschrijft `assets/screens/`, ook `boxes.json` met de plek van elke knop.
5. Render, maak de PDF en publiceer, zoals hierboven.

**Let op: de data**
- De video's tonen de datums van de dag waarop je de schermen vastlegt. Hier was dat maandag 5 oktober 2026.
- Komen er andere datums in beeld, controleer dan de teksten in de video's die naar een dag verwijzen, zoals in `rooster-lezen.html` en `afwezig.html`.

## Lettertype
Inter (SIL Open Font License, zie `assets/fonts/OFL.txt`). Het staat alleen in de video's en de PDF, niet in de app.
