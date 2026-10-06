// Legt de schermen van Planbord vast voor de uitlegvideo's: een fictieve medewerker (Sanne) op een
// telefoon van 390 x 797 punten (iPhone zonder statusbalk), drie keer zo scherp. Bewaart ook waar de
// knoppen staan (boxes.json), zodat de animaties precies op de goede plek tikken.
// Nodig: UITLEG_ADRES (het adres in de agendalink) en Planbord op maandag 5 oktober 2026 (zie README).
import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { interCss } from './fonts.mjs';
import { guideAddress } from './address.mjs';

const BASE = 'http://localhost:3000';
const ADDRESS = guideAddress();
const OUT = new URL('./assets/screens/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const W = 390;
const H = 797;
const boxes = {};

const css = `${interCss()}\nhtml,body,button,input,select,textarea{font-family:'Inter',system-ui,sans-serif !important;}`;
const ecdh = crypto.createECDH('prime256v1');
ecdh.generateKeys();
const fake = {
  endpoint: `https://fcm.googleapis.com/fcm/send/uitleg-${crypto.randomBytes(8).toString('hex')}`,
  p256dh: ecdh.getPublicKey().toString('base64url'),
  auth: crypto.randomBytes(16).toString('base64url'),
};

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'nl-NL',
  timezoneId: 'Europe/Amsterdam',
  bypassCSP: true,
});
await context.grantPermissions(['notifications'], { origin: BASE });
await context.addInitScript((styles) => {
  const add = () => {
    const el = document.createElement('style');
    el.textContent = styles;
    document.head.appendChild(el);
  };
  if (document.head) add();
  else document.addEventListener('DOMContentLoaded', add);
}, css);
// Een telefoon die meldingen kan krijgen (headless Chromium kan dat niet uit zichzelf).
await context.addInitScript(({ endpoint, p256dh, auth }) => {
  const make = () => ({
    endpoint,
    expirationTime: null,
    toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh, auth } }),
    unsubscribe: async () => {
      localStorage.removeItem('nep-abonnement');
      return true;
    },
  });
  Object.defineProperty(Notification, 'permission', { get: () => (localStorage.getItem('nep-abonnement') ? 'granted' : 'default') });
  PushManager.prototype.subscribe = async function () {
    localStorage.setItem('nep-abonnement', '1');
    return make();
  };
  PushManager.prototype.getSubscription = async function () {
    return localStorage.getItem('nep-abonnement') ? make() : null;
  };
}, fake);
const page = await context.newPage();
page.on('dialog', (dialog) => dialog.accept());

/** Rechthoek van een element in paginacoördinaten (inclusief scroll), in punten. */
async function box(locator) {
  const handle = locator.first();
  await handle.waitFor({ state: 'visible' });
  return handle.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x * 10) / 10, y: Math.round((r.y + window.scrollY) * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 };
  });
}
async function settle() {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}
/** Een pagina in drie delen: de kop, de inhoud (volledige hoogte, zonder tabbalk) en de tabbalk. */
async function capturePage(name) {
  await settle();
  await page.evaluate(() => window.scrollTo(0, 0));
  const nav = page.locator('nav[aria-label="Hoofdmenu"]').last();
  const navBox = await nav.boundingBox();
  await page.screenshot({ path: `${OUT}${name}-header.png`, clip: { x: 0, y: 0, width: W, height: 57 } });
  if (navBox) {
    // Zonder de pagina erachter, anders schemert tekst door de halfdoorzichtige tabbalk.
    await page.addStyleTag({ content: 'main{visibility:hidden !important}' });
    await page.screenshot({ path: `${OUT}${name}-nav.png`, clip: { x: 0, y: navBox.y, width: W, height: H - navBox.y } });
    await page.evaluate(() => document.querySelectorAll('style').forEach((el) => el.textContent.includes('main{visibility') && el.remove()));
  }
  await page.addStyleTag({ content: 'nav[aria-label="Hoofdmenu"].fixed{display:none !important}' });
  await page.screenshot({ path: `${OUT}${name}-content.png`, fullPage: true });
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  boxes[name] = { height, navTop: navBox ? navBox.y : null };
  await page.evaluate(() => document.querySelectorAll('style').forEach((el) => el.textContent.includes('Hoofdmenu') && el.remove()));
}

// 1. Inloggen
await page.goto(`${BASE}/inloggen`);
await settle();
await page.screenshot({ path: `${OUT}login.png` });
boxes.login = { email: await box(page.locator('#email')), send: await box(page.locator('button[type=submit]')) };
await page.fill('#email', 'sanne@voorbeeld.nl');
await page.click('button[type=submit]');
await page.waitForSelector('#code');
await page.evaluate(() => document.activeElement && document.activeElement.blur());
await settle();
await page.screenshot({ path: `${OUT}login-code.png` });
boxes['login-code'] = { code: await box(page.locator('#code')), submit: await box(page.locator('form button[type=submit] >> text=Inloggen')) };
await page.fill('#code', '123456');
await page.click('form button[type=submit] >> text=Inloggen');
await page.waitForURL((url) => !url.pathname.startsWith('/inloggen'));

// 2. Mijn rooster, met het blok voor meldingen
await page.goto(`${BASE}/`);
await capturePage('mijn');
// De teksten in de video's horen bij maandag 5 oktober 2026 (UITLEG_DATUM, zie clock.cjs).
if ((await page.locator('li', { hasText: 'ma 5 okt' }).count()) === 0) {
  throw new Error('Mijn rooster toont ma 5 okt niet: start de nabootsing en Planbord met UITLEG_DATUM en clock.cjs (zie README).');
}
const mijn = boxes.mijn;
for (const day of ['ma 5 okt', 'wo 7 okt', 'vr 9 okt', 'za 10 okt', 'wo 14 okt', 'ma 19 okt']) {
  mijn[day] = await box(page.locator('li', { hasText: day }));
}
mijn.week42 = await box(page.locator('h2', { hasText: 'Week 42' }));
mijn.pushCard = await box(page.locator('section, div').filter({ has: page.locator('h2, h3', { hasText: 'Meldingen op dit toestel' }) }).last());
mijn.pushButton = await box(page.getByRole('button', { name: 'Meldingen aanzetten' }));
await page.screenshot({ path: `${OUT}push-uit.png`, clip: { x: 0, y: mijn.pushCard.y - 8, width: W, height: mijn.pushCard.h + 16 }, fullPage: true });
await page.getByRole('button', { name: 'Meldingen aanzetten' }).click();
await page.getByText('Meldingen staan aan op dit toestel').first().waitFor();
await settle();
mijn.pushCardOn = await box(page.locator('section, div').filter({ has: page.locator('h2, h3', { hasText: 'Meldingen op dit toestel' }) }).last());
await page.screenshot({ path: `${OUT}push-aan.png`, clip: { x: 0, y: mijn.pushCardOn.y - 8, width: W, height: mijn.pushCardOn.h + 16 }, fullPage: true });
for (const label of ['Mijn rooster', 'Rooster', 'Verlof', 'Agenda']) {
  mijn[`nav:${label}`] = await page.locator('nav[aria-label="Hoofdmenu"]').last().getByRole('link', { name: label, exact: true }).boundingBox();
}

// 3. Rooster per vestiging
await page.goto(`${BASE}/rooster/den-bosch`);
await capturePage('rooster');
boxes.rooster.tabEindhoven = await box(page.getByRole('link', { name: 'Eindhoven', exact: true }));
boxes.rooster.today = await box(page.locator('[aria-current="date"], section, article').filter({ hasText: 'vandaag' }).first());
boxes.rooster.next = await box(page.getByRole('link', { name: /volgende week/i }).or(page.locator('a[aria-label*="olgende"]')));
await page.goto(`${BASE}/rooster/eindhoven`);
await capturePage('rooster-eindhoven');

// 4. Verlof
await page.goto(`${BASE}/verlof`);
await capturePage('verlof');

// 5. Agenda: eerst zonder link, dan met de link voor Mijn rooster
await page.goto(`${BASE}/agenda`);
await capturePage('agenda');
boxes.agenda.makeLink = await box(page.getByRole('button', { name: 'Link maken', exact: true }));
await page.getByRole('button', { name: 'Link maken', exact: true }).first().click();
await page.getByRole('link', { name: 'Toevoegen aan agenda' }).first().waitFor();
const link = await page.getByText(/\/feed\/\S+\.ics/).first().innerText();
if (!link.startsWith(`https://${ADDRESS}/feed/`)) {
  throw new Error(`De agendalink is ${link}, niet op ${ADDRESS}: start Planbord met SITE_URL=https://${ADDRESS}.`);
}
await capturePage('agenda-link');
boxes['agenda-link'].add = await box(page.getByRole('link', { name: 'Toevoegen aan agenda' }));

fs.writeFileSync(`${OUT}boxes.json`, JSON.stringify(boxes, null, 2));
await browser.close();
console.log('vastgelegd:', fs.readdirSync(OUT).length, 'bestanden');
