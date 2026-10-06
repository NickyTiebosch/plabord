// Maakt de PDF-gids (A4) met de teksten van de uitlegpagina, stilstaande beelden uit de video's en
// een QR-code naar /uitleg. Draai eerst de video's (render.mjs); dit script gebruikt dezelfde
// composities om beelden te maken.
//   node pdf.mjs            → out/planbord-uitleg.pdf
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import QRCode from 'qrcode';
import { chromium } from 'playwright';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
// Het adres van Planbord, zonder https://, zoals op de pagina /uitleg (SITE_URL). Verplicht, zodat er
// nooit een oud adres in de PDF en de QR-code komt.
const ADDRESS = process.env.UITLEG_ADRES?.replace(/^https?:\/\//, '').replace(/\/+$/, '');
if (!ADDRESS) throw new Error('Zet UITLEG_ADRES op het adres van Planbord, bijvoorbeeld UITLEG_ADRES=planbord-ten.vercel.app node pdf.mjs');
const OUT = path.join(ROOT, 'out');
// De teksten komen uit src/lib/guide/topics.ts, dezelfde als op de pagina /uitleg.
const { GUIDE_QUESTIONS, guideTopics } = await import('../../src/lib/guide/topics.ts');
const STILLS = path.join(OUT, 'pdf');
fs.mkdirSync(STILLS, { recursive: true });

/** Welke beelden uit welke video bij welk onderwerp horen. */
const SHOTS = {
  'beginscherm-iphone': [7.6, 11, 15, 19],
  'beginscherm-android': [7.3, 10.5, 14, 18.5],
  inloggen: [3.6, 7, 11, 15.6],
  'meldingen-iphone': [11, 13.8, 17, 22],
  'meldingen-android': [11, 13.8, 17, 22],
  'rooster-lezen': [8, 12.5, 19, 23.5],
  agenda: [6.5, 10.5, 13.4, 20],
  afwezig: [4, 8.5, 13, 17],
};

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch();

// 1. Stilstaande beelden: een beeld uit de video, verkleind tot 480 punten breed.
const stillPage = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
for (const [video, times] of Object.entries(SHOTS)) {
  await stillPage.goto(`http://127.0.0.1:${port}/videos/${video}.html`);
  await stillPage.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  for (const t of times) {
    await stillPage.evaluate((time) => window.seek(time), t);
    const png = path.join(STILLS, `${video}-${t}.png`);
    await stillPage.screenshot({ path: png });
    execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-vf', 'scale=480:-1:flags=lanczos', '-q:v', '4', png.replace(/\.png$/, '.jpg')]);
    fs.rmSync(png);
  }
}

// 2. De gids zelf.
const topics = guideTopics(ADDRESS);
const qr = await QRCode.toString(`https://${ADDRESS}/uitleg`, { type: 'svg', margin: 0, color: { dark: '#134e4a', light: '#ffffff' } });
const esc = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const stills = (video) => (SHOTS[video] ?? []).map((t) => `<img src="pdf/${video}-${t}.jpg">`).join('');
const steps = (list) => `<ol>${list.map((step) => `<li>${esc(step)}</li>`).join('')}</ol>`;

// Eén blok per video. De slotregel hoort bij het laatste blok: blokken worden nooit over twee
// pagina's verdeeld, dus zo staat hij nooit alleen op een lege laatste pagina.
const blocks = topics
  .filter((topic) => topic.id !== 'welkom')
  .flatMap((topic, index) =>
    topic.videos.map((video) => {
      const group = topic.steps.find((g) => g.device === video.device) ?? topic.steps[0];
      const device = video.device && topic.videos.length > 1 ? `<span class="chip">${video.device}</span>` : '';
      // Elk blok staat op zichzelf: lees je alleen het blok van je eigen telefoon, dan mis je niets.
      const notes = topic.notes.length ? `<ul class="notes">${topic.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : '';
      return { number: index + 1, title: topic.title, device, video: video.file, steps: steps(group.steps), notes };
    }),
  );
const sections = blocks
  .map((block, i) => `<section class="topic">
        <h2><span class="n">${block.number}</span>${esc(block.title)}${block.device}</h2>
        <div class="stills">${stills(block.video)}</div>
        <div class="text">${block.steps}${block.notes}</div>${i === blocks.length - 1 ? `
        <p class="foot">${esc(GUIDE_QUESTIONS)}</p>` : ''}
      </section>`)
  .join('');

const welcome = topics.find((topic) => topic.id === 'welkom');
const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Planbord – uitleg voor collega's</title>
<style>
@font-face { font-family: Inter; font-weight: 400; src: url(../assets/fonts/inter-latin-400-normal.woff2); }
@font-face { font-family: Inter; font-weight: 600; src: url(../assets/fonts/inter-latin-600-normal.woff2); }
@font-face { font-family: Inter; font-weight: 800; src: url(../assets/fonts/inter-latin-800-normal.woff2); }
@page { size: A4; margin: 14mm 14mm 16mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Inter, sans-serif; color: #0f172a; font-size: 10.5pt; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.cover { display: grid; grid-template-columns: 1fr 34mm; gap: 8mm; align-items: center; padding: 6mm 7mm; border-radius: 6mm; background: linear-gradient(160deg, #f0fdfa, #ccfbf1); margin-bottom: 6mm; }
.brand { display: flex; align-items: center; gap: 3mm; font-size: 8.5pt; letter-spacing: .2em; font-weight: 800; color: #0f766e; }
.brand img { width: 7mm; height: 7mm; border-radius: 1.6mm; }
h1 { font-size: 21pt; font-weight: 800; letter-spacing: -.01em; margin: 2mm 0 2mm; }
.cover p { color: #334155; }
.nowrap { white-space: nowrap; }
.qr { text-align: center; font-size: 7.5pt; color: #134e4a; font-weight: 600; }
.qr svg { width: 30mm; height: 30mm; display: block; margin: 0 auto 1.5mm; }
.intro { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5mm 6mm; margin: 0 1mm 6mm; padding: 0; list-style: none; }
.intro li { padding-left: 4mm; position: relative; }
.intro li::before { content: ''; position: absolute; left: 0; top: 1.9mm; width: 1.8mm; height: 1.8mm; border-radius: 50%; background: #0d9488; }
.topic { break-inside: avoid; margin-bottom: 7mm; }
h2 { display: flex; align-items: center; gap: 2.5mm; font-size: 13.5pt; font-weight: 800; margin-bottom: 3mm; }
h2 .n { display: inline-grid; place-items: center; width: 7mm; height: 7mm; border-radius: 50%; background: #0f766e; color: #fff; font-size: 10pt; }
.chip { margin-left: 1mm; padding: .6mm 2.6mm; border-radius: 99px; background: #0f766e; color: #fff; font-size: 8.5pt; font-weight: 600; }
/* Iets smaller dan de pagina: zo passen er overal twee onderwerpen op een pagina. */
.stills { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; width: 85%; margin: 0 auto; }
.stills img { width: 100%; border-radius: 2.5mm; border: .3mm solid #e2e8f0; }
.text { margin-top: 3mm; }
ol { padding-left: 5mm; }
ol li { margin: .6mm 0; }
.notes { list-style: none; margin-top: 2mm; padding: 2mm 3mm; border-radius: 2mm; background: #f1f5f9; color: #475569; font-size: 9pt; }
.notes li + li { margin-top: 1mm; }
.foot { margin-top: 5mm; padding-top: 3mm; border-top: .3mm solid #e2e8f0; color: #475569; font-size: 9pt; text-align: center; }
</style></head><body>
<div class="cover">
  <div>
    <div class="brand"><img src="../assets/img/planbord-icon.png">PLANBORD</div>
    <h1>Uitleg voor collega's</h1>
    <p>Planbord is ons rooster op je telefoon. Ga naar <b class="nowrap">${ADDRESS}</b>. Scan de code voor korte video's van elke stap. Op de plaatjes zie je een verzonnen team.</p>
  </div>
  <div class="qr">${qr}Video's: ${ADDRESS}/uitleg</div>
</div>
<ul class="intro">${welcome.steps[0].steps.map((s) => `<li>${esc(s)}</li>`).join('')}${welcome.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
${sections}
</body></html>`;
// De gids staat naast de beelden in out/, zodat de verwijzingen kloppen.
fs.writeFileSync(path.join(OUT, 'gids.html'), html);

const pdfPage = await browser.newPage();
await pdfPage.goto(`http://127.0.0.1:${port}/out/gids.html`);
await pdfPage.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0));
await pdfPage.evaluate(() => document.fonts.ready);
const out = path.join(OUT, 'planbord-uitleg.pdf');
await pdfPage.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();
server.close();
console.log(`PDF: ${(fs.statSync(out).size / 1e6).toFixed(2)} MB`);
