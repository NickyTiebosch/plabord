// Zet de video's, posters en de PDF in public/uitleg: lichtere versies (720 x 1280) voor de pagina.
// De volle versies (1080 x 1920) blijven in out/, om los te delen.
//   node publish.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const OUT = path.join(ROOT, 'out');
const PUBLIC = path.join(ROOT, '..', '..', 'public', 'uitleg');
fs.mkdirSync(PUBLIC, { recursive: true });

const videos = fs.readdirSync(path.join(ROOT, 'videos')).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, ''));
for (const name of videos) {
  const source = path.join(OUT, `${name}.mp4`);
  if (!fs.existsSync(source)) throw new Error(`${name}.mp4 ontbreekt in out/: draai eerst node render.mjs ${name}`);
  execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-vf', 'scale=720:1280:flags=lanczos',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', path.join(PUBLIC, `${name}.mp4`)]);
  execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(OUT, `${name}.jpg`), '-vf', 'scale=720:-1:flags=lanczos', '-q:v', '4', path.join(PUBLIC, `${name}.jpg`)]);
  console.log(`${name}: ${(fs.statSync(path.join(PUBLIC, `${name}.mp4`)).size / 1e6).toFixed(2)} MB`);
}
fs.copyFileSync(path.join(OUT, 'planbord-uitleg.pdf'), path.join(PUBLIC, 'planbord-uitleg.pdf'));
console.log('PDF gekopieerd');
