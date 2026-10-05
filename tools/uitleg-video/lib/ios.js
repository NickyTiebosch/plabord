// Eenvoudige, eigen nabootsingen van iPhone-onderdelen: beginscherm, dialoog en melding.
// Bewust geen kopie van Apple-ontwerpen: alleen genoeg om te herkennen waar je tikt.
import { css, el, statusBar } from './ui.js';

const glyph = {
  mail: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6.5L20.5 7"/></svg>',
  camera: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.6"/></svg>',
  clock: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg>',
  weather: '<svg width="38" height="38" viewBox="0 0 24 24"><circle cx="9" cy="9" r="4" fill="#fde047"/><path d="M8 18h9a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.6A2.8 2.8 0 0 0 8 18z" fill="#fff"/></svg>',
  notes: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" stroke-width="1.6"><path d="M6 10h12M6 14h12M6 18h8"/></svg>',
  gear: '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7"><circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2.3M12 18.2v2.3M3.5 12h2.3M18.2 12h2.3M6 6l1.6 1.6M16.4 16.4L18 18M6 18l1.6-1.6M16.4 7.6L18 6"/></svg>',
  map: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z"/><path d="M9 4v14M15 6v14"/></svg>',
  calc: '<svg width="34" height="34" viewBox="0 0 24 24" fill="#fff"><circle cx="7" cy="8" r="2"/><circle cx="12" cy="8" r="2"/><circle cx="17" cy="8" r="2" fill="#fb923c"/><circle cx="7" cy="14" r="2"/><circle cx="12" cy="14" r="2"/><circle cx="17" cy="14" r="2" fill="#fb923c"/></svg>',
  phone: '<svg width="34" height="34" viewBox="0 0 24 24" fill="#fff"><path d="M6.6 3.5l2.7 3.2-1.6 2.4a12 12 0 0 0 7.2 7.2l2.4-1.6 3.2 2.7-1.7 2.9C11 20 4 13 3.7 5.2z"/></svg>',
  safari: '<svg width="44" height="44" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="none" stroke="#fff" stroke-width="1.2"/><path d="M15.8 8.2L13 13l-4.8 2.8L11 11z" fill="#fff"/><path d="M15.8 8.2L13 13l-2-2z" fill="#ef4444"/></svg>',
  chat: '<svg width="36" height="36" viewBox="0 0 24 24" fill="#fff"><path d="M12 4c5 0 9 3.1 9 7s-4 7-9 7c-1 0-2-.1-2.9-.4L5 19.5l1.1-3.3C4.2 14.9 3 13.1 3 11c0-3.9 4-7 9-7z"/></svg>',
  music: '<svg width="34" height="34" viewBox="0 0 24 24" fill="#fff"><path d="M9 17.5V6l11-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/><path d="M9 6l11-2v3L9 9z"/></svg>',
};

function icon(name, bg, inner) {
  return `<div class="app-icon"><div class="ic" style="background:${bg}">${inner}</div><div class="lb">${name}</div></div>`;
}
const calendarInner = '<div style="width:64px;height:64px;background:#fff;text-align:center;font-family:Inter"><div style="font-size:10px;font-weight:700;color:#ef4444;padding-top:7px">MAANDAG</div><div style="font-size:30px;font-weight:400;line-height:1.05;color:#111">5</div></div>';
const notesInner = `<div style="width:64px;height:64px;background:#fff;display:grid;place-items:center;border-top:14px solid #facc15">${glyph.notes}</div>`;

/** Het beginscherm. Met `planbord` staat het Planbord-icoon op de gegeven plek in het raster. */
export function iosHome(parent, { planbord = 6 } = {}) {
  const layer = el('div', 'layer', parent);
  el('div', 'wall', layer);
  statusBar(layer, { light: true });
  const apps = [
    icon('Agenda', '#fff', calendarInner),
    icon("Foto's", 'conic-gradient(#f87171,#fbbf24,#4ade80,#38bdf8,#a78bfa,#f87171)', '<div style="width:22px;height:22px;border-radius:50%;background:#fff"></div>'),
    icon('Camera', 'linear-gradient(#9ca3af,#4b5563)', glyph.camera),
    icon('Mail', 'linear-gradient(#60a5fa,#2563eb)', glyph.mail),
    icon('Klok', '#111827', glyph.clock),
    icon('Weer', 'linear-gradient(#38bdf8,#1d4ed8)', glyph.weather),
    icon('Notities', '#fff', notesInner),
    icon('Kaarten', 'linear-gradient(#34d399,#059669)', glyph.map),
    icon('Rekenmachine', '#1f2937', glyph.calc),
    icon('Instellingen', 'linear-gradient(#9ca3af,#6b7280)', glyph.gear),
  ];
  let planbordIcon = null;
  if (planbord != null) apps.splice(planbord, 0, '<div class="app-icon" data-planbord><div class="ic"><img src="../assets/img/planbord-icon.png"></div><div class="lb">Planbord</div></div>');
  const grid = el('div', 'grid', layer, apps.join(''));
  planbordIcon = grid.querySelector('[data-planbord]');
  el('div', 'dock', layer, [
    `<div class="ic" style="width:64px;height:64px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(#4ade80,#16a34a)">${glyph.phone}</div>`,
    `<div class="ic" data-safari style="width:64px;height:64px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(#38bdf8,#2563eb)">${glyph.safari}</div>`,
    `<div class="ic" style="width:64px;height:64px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(#4ade80,#22c55e)">${glyph.chat}</div>`,
    `<div class="ic" style="width:64px;height:64px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(#fb7185,#e11d48)">${glyph.music}</div>`,
  ].join(''));
  return { layer, grid, planbordIcon, safariIcon: layer.querySelector('[data-safari]') };
}

/** Een systeemvraag zoals "Planbord wil je meldingen sturen". */
export function iosAlert(parent, { title, message, cancel, confirm }) {
  const dim = el('div', 'dim', parent);
  const alert = el('div', 'ios-alert', parent, `<div class="t">${title}</div><div class="m">${message}</div><div class="btns"><div>${cancel}</div><div data-confirm>${confirm}</div></div>`);
  css(alert, { top: '0px' });
  return { dim, alert, confirm: alert.querySelector('[data-confirm]') };
}

/** Een melding bovenin het scherm. */
export function iosBanner(parent, { title, body, when = 'nu' }) {
  return el('div', 'banner', parent, `<img src="../assets/img/planbord-icon.png"><div style="flex:1;min-width:0"><div class="bt">${title}<span>${when}</span></div><div class="bb">${body}</div></div>`);
}

// ---------- Safari ----------
const sym = {
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  fwd: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  share: '<svg width="24" height="26" viewBox="0 0 24 26" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9.5H6.5A1.5 1.5 0 0 0 5 11v11a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 22V11a1.5 1.5 0 0 0-1.5-1.5H16"/><path d="M12 15V2.5M8 6l4-4 4 4"/></svg>',
  book: '<svg width="24" height="22" viewBox="0 0 24 22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M12 4C9.5 2 6 2 2.5 3v15C6 17 9.5 17 12 19c2.5-2 6-2 9.5-1V3C18 2 14.5 2 12 4z"/><path d="M12 4v15"/></svg>',
  tabs: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><rect x="3" y="7" width="13" height="13" rx="2.5"/><path d="M8 4h10.5A2.5 2.5 0 0 1 21 6.5V17"/></svg>',
  lock: '<svg width="11" height="13" viewBox="0 0 11 13" fill="currentColor"><rect x="0.5" y="5.5" width="10" height="7.5" rx="1.6"/><path d="M2.6 5.6V4a2.9 2.9 0 0 1 5.8 0v1.6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  reload: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/></svg>',
  copy: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  glasses: '<svg width="22" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6.5" cy="14" r="3.5"/><circle cx="17.5" cy="14" r="3.5"/><path d="M10 14h4M3 14l2-7M21 14l-2-7"/></svg>',
  star: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  plusSquare: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
  search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/></svg>',
  x: '<svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 2l8 8M10 2l-8 8"/></svg>',
};
export const iosSymbols = sym;

/** Safari met een pagina. De adresbalk en knoppen staan onderin, zoals op recente iPhones. */
export function safari(parent, { url, page }) {
  const layer = css(el('div', 'layer', parent), { background: '#fff' });
  statusBar(layer);
  const content = css(el('div', '', layer), { position: 'absolute', left: '0', top: '47px', width: '390px', height: '705px', overflow: 'hidden', background: '#f8fafc' });
  const pageImg = el('div', '', content, page ? `<img src="${page}" style="width:390px">` : '');
  const bar = css(el('div', '', layer), { position: 'absolute', left: '0', top: '752px', width: '390px', height: '92px', background: '#f6f6f8', borderTop: '0.5px solid rgba(60,60,67,.25)' });
  const pill = css(el('div', '', bar, ''), { position: 'absolute', left: '12px', top: '8px', width: '366px', height: '44px', borderRadius: '14px', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', fontSize: '15px', color: '#111' });
  css(el('span', '', pill, 'aA'), { position: 'absolute', left: '14px', fontSize: '15px', fontWeight: '600' });
  const urlBox = css(el('div', '', pill), { position: 'absolute', left: '50px', right: '50px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', color: '#111' });
  el('span', '', urlBox, sym.lock).style.color = '#6b7280';
  const urlText = el('span', '', urlBox);
  css(el('span', '', pill, sym.reload), { position: 'absolute', right: '14px', color: '#111', display: 'flex' });
  const tools = css(el('div', '', bar), { position: 'absolute', left: '0', top: '56px', width: '390px', height: '30px', display: 'flex', justifyContent: 'space-around', alignItems: 'center', color: '#0a7aff' });
  el('span', '', tools, sym.back);
  css(el('span', '', tools, sym.fwd), { color: '#c7c7cc' });
  const shareBtn = el('span', '', tools, sym.share);
  el('span', '', tools, sym.book);
  el('span', '', tools, sym.tabs);
  el('div', 'homebar', layer);
  urlText.dataset.full = url;
  return { layer, content, pageImg, urlText, shareBtn };
}

/** Het deelmenu van Safari, met "Zet op beginscherm". */
export function shareSheet(parent, { title, url }) {
  const sheet = css(el('div', '', parent), { position: 'absolute', left: '0', top: '286px', width: '390px', height: '600px', borderRadius: '14px 14px 0 0', background: '#f2f2f7', zIndex: 62, boxShadow: '0 -6px 30px rgba(0,0,0,.18)' });
  sheet.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:18px 18px 14px">
      <img src="../assets/img/planbord-icon.png" style="width:46px;height:46px;border-radius:10px">
      <div style="flex:1"><div style="font-size:15px;font-weight:600">${title}</div><div style="font-size:13px;color:#6b7280;margin-top:2px">${url}</div></div>
      <div style="width:30px;height:30px;border-radius:50%;background:#e3e3e8;display:grid;place-items:center;color:#6b7280">${sym.x}</div>
    </div>
    <div style="height:0.5px;background:rgba(60,60,67,.2);margin:0 0 14px"></div>
    <div style="display:flex;justify-content:space-around;padding:0 8px 16px">
      ${[['AirDrop', 'linear-gradient(#60a5fa,#2563eb)'], ['Berichten', 'linear-gradient(#4ade80,#16a34a)'], ['Mail', 'linear-gradient(#60a5fa,#1d4ed8)'], ['Notities', 'linear-gradient(#fde047,#facc15)']]
        .map(([n, bg]) => `<div style="text-align:center;width:72px"><div style="width:58px;height:58px;margin:0 auto;border-radius:14px;background:${bg}"></div><div style="font-size:11.5px;margin-top:6px;color:#111">${n}</div></div>`).join('')}
    </div>
    <div data-list style="margin:0 16px;border-radius:12px;background:#fff;overflow:hidden">
      ${[['Kopieer', sym.copy], ['Voeg toe aan leeslijst', sym.glasses], ['Voeg bladwijzer toe', sym.book], ['Voeg toe aan favorieten', sym.star], ['Zet op beginscherm', sym.plusSquare], ['Zoek op pagina', sym.search]]
        .map(([n, ic], i) => `<div ${n === 'Zet op beginscherm' ? 'data-target' : ''} style="display:flex;justify-content:space-between;align-items:center;height:46px;padding:0 16px;font-size:16.5px;${i ? 'border-top:0.5px solid rgba(60,60,67,.2)' : ''}">${n}<span style="color:#111;display:flex">${ic}</span></div>`).join('')}
    </div>`;
  return { sheet, target: sheet.querySelector('[data-target]') };
}

/** Het scherm "Zet op beginscherm" met de knop "Voeg toe". */
export function addToHomeSheet(parent, { name, url }) {
  const sheet = css(el('div', '', parent), { position: 'absolute', left: '0', top: '58px', width: '390px', height: '800px', borderRadius: '12px 12px 0 0', background: '#f2f2f7', zIndex: 63, boxShadow: '0 -6px 30px rgba(0,0,0,.2)' });
  sheet.innerHTML = `
    <div style="position:relative;height:56px;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:600">
      <span style="position:absolute;left:18px;font-weight:400;color:#0a7aff">Annuleer</span>Zet op beginscherm<span data-add style="position:absolute;right:18px;color:#0a7aff">Voeg toe</span>
    </div>
    <div style="margin:18px 16px 0;border-radius:12px;background:#fff;display:flex;gap:14px;padding:14px">
      <img src="../assets/img/planbord-icon.png" style="width:62px;height:62px;border-radius:14px">
      <div style="flex:1"><div style="font-size:17px;padding:6px 0 9px;border-bottom:0.5px solid rgba(60,60,67,.25)">${name}</div><div style="font-size:14px;color:#8e8e93;padding-top:9px">${url}</div></div>
    </div>
    <div style="margin:16px 16px 0;border-radius:12px;background:#fff;display:flex;justify-content:space-between;align-items:center;padding:0 16px;height:48px;font-size:17px">Open als webapp
      <span style="width:51px;height:31px;border-radius:16px;background:#34c759;position:relative"><span style="position:absolute;right:2px;top:2px;width:27px;height:27px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.2)"></span></span>
    </div>
    <div style="margin:10px 32px 0;font-size:13px;line-height:1.35;color:#6b7280">Er komt een symbool op je beginscherm, zodat je snel naar deze website gaat.</div>`;
  return { sheet, add: sheet.querySelector('[data-add]') };
}

// ---------- Agenda ----------
/** Agenda-app: een lijst met diensten. */
export function calendarList(parent, events) {
  const layer = css(el('div', 'layer', parent), { background: '#fff' });
  statusBar(layer);
  layer.insertAdjacentHTML('beforeend', `
    <div style="position:absolute;left:0;top:47px;width:390px;padding:6px 18px 0">
      <div style="display:flex;justify-content:space-between;color:#ef4444;font-size:17px"><span>‹ 2026</span><span style="display:flex;gap:18px">☰ ＋</span></div>
      <div style="font-size:32px;font-weight:700;margin-top:6px">oktober</div>
    </div>
    <div data-list style="position:absolute;left:0;top:140px;width:390px">
      ${events.map((e) => `
        <div style="padding:10px 18px 0">
          ${e.day ? `<div style="font-size:14px;font-weight:600;color:${e.today ? '#ef4444' : '#6b7280'};padding:6px 0">${e.day}</div>` : ''}
          <div style="display:flex;gap:10px;align-items:stretch;padding:8px 0;border-bottom:0.5px solid rgba(60,60,67,.18)">
            <span style="width:4px;border-radius:2px;background:${e.color ?? '#0d9488'}"></span>
            <div style="flex:1"><div style="font-size:16px;font-weight:600">${e.title}</div><div style="font-size:13px;color:#6b7280;margin-top:2px">${e.sub}</div></div>
          </div>
        </div>`).join('')}
    </div>`);
  el('div', 'homebar', layer);
  return { layer };
}

/** Het scherm "Abonnement toevoegen" van de Agenda-app. */
export function subscribeSheet(parent, { name, url }) {
  const sheet = css(el('div', '', parent), { position: 'absolute', left: '0', top: '58px', width: '390px', height: '800px', borderRadius: '12px 12px 0 0', background: '#f2f2f7', zIndex: 63, boxShadow: '0 -6px 30px rgba(0,0,0,.2)' });
  sheet.innerHTML = `
    <div style="position:relative;height:56px;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:600">
      <span style="position:absolute;left:18px;font-weight:400;color:#ef4444">Annuleer</span>Abonnement<span data-add style="position:absolute;right:18px;color:#ef4444">Voeg toe</span>
    </div>
    <div style="margin:18px 16px 0;border-radius:12px;background:#fff;overflow:hidden;font-size:16px">
      <div style="display:flex;justify-content:space-between;padding:13px 16px;border-bottom:0.5px solid rgba(60,60,67,.2)"><span>Naam</span><span style="color:#6b7280">${name}</span></div>
      <div style="display:flex;justify-content:space-between;padding:13px 16px;border-bottom:0.5px solid rgba(60,60,67,.2)"><span>Kleur</span><span style="width:14px;height:14px;border-radius:50%;background:#0d9488;align-self:center"></span></div>
      <div style="display:flex;justify-content:space-between;padding:13px 16px"><span>URL</span><span style="color:#6b7280;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${url}</span></div>
    </div>
    <div style="margin:16px 16px 0;border-radius:12px;background:#fff;display:flex;justify-content:space-between;padding:13px 16px;font-size:16px"><span>Account</span><span style="color:#6b7280">iCloud</span></div>`;
  return { sheet, add: sheet.querySelector('[data-add]') };
}
