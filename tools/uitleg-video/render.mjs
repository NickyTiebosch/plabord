// Rendert een uitlegvideo beeld voor beeld naar MP4 (H.264, 1080 x 1920, 30 beelden per seconde).
//   node render.mjs <naam>                      hele video naar out/<naam>.mp4 en een poster out/<naam>.jpg
//   node render.mjs <naam> --frames=1.5,6,12    alleen losse beelden naar out/<naam>-<t>.png (om te bekijken)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const FPS = 30;
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

const [name, ...args] = process.argv.slice(2);
const framesArg = args.find((arg) => arg.startsWith('--frames='));
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
page.on('console', (msg) => msg.type() === 'error' && console.error('console:', msg.text()));
page.on('pageerror', (error) => console.error('pageerror:', error.message));
await page.goto(`http://127.0.0.1:${port}/videos/${name}.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
const duration = await page.evaluate(() => window.timeline.duration);

if (framesArg) {
  for (const t of framesArg.slice('--frames='.length).split(',').map(Number)) {
    await page.evaluate((time) => window.seek(time), t);
    await page.screenshot({ path: path.join(ROOT, 'out', `${name}-${t}.png`) });
  }
  console.log(`${name}: ${duration.toFixed(1)} s, beelden opgeslagen`);
} else {
  const out = path.join(ROOT, 'out', `${name}.mp4`);
  const ff = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const frames = Math.ceil(duration * FPS);
  const started = Date.now();
  for (let i = 0; i < frames; i++) {
    await page.evaluate((time) => window.seek(time), i / FPS);
    const buffer = await page.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(buffer)) await once(ff.stdin, 'drain');
  }
  ff.stdin.end();
  const [code] = await once(ff, 'close');
  if (code !== 0) throw new Error(`ffmpeg stopte met code ${code}`);
  const poster = await page.evaluate(() => window.poster ?? 2);
  await page.evaluate((time) => window.seek(time), poster);
  await page.screenshot({ path: path.join(ROOT, 'out', `${name}.jpg`), type: 'jpeg', quality: 82 });
  const size = fs.statSync(out).size;
  console.log(`${name}: ${frames} beelden in ${((Date.now() - started) / 1000).toFixed(0)} s, ${(size / 1e6).toFixed(2)} MB`);
}
await browser.close();
server.close();
