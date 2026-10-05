// Eenvoudige, eigen nabootsingen van Android-onderdelen: beginscherm, Chrome, menu, dialogen en een
// melding. Geen kopie van Google-ontwerpen: alleen genoeg om te herkennen waar je tikt.
import { css, el, statusBar } from './ui.js';

const g = {
  phone: '<svg width="30" height="30" viewBox="0 0 24 24" fill="#fff"><path d="M6.6 3.5l2.7 3.2-1.6 2.4a12 12 0 0 0 7.2 7.2l2.4-1.6 3.2 2.7-1.7 2.9C11 20 4 13 3.7 5.2z"/></svg>',
  chat: '<svg width="30" height="30" viewBox="0 0 24 24" fill="#fff"><path d="M4 5h16v11H8l-4 4z"/></svg>',
  camera: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.6"/></svg>',
  browser: '<svg width="34" height="34" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#fff"/><circle cx="12" cy="12" r="4.2" fill="#2563eb"/><path d="M12 7.8h8.6M8.4 14.1L4.1 6.6M15.6 14.1l-4.3 7.5" stroke="#16a34a" stroke-width="2.2"/></svg>',
  mail: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6.5L20.5 7"/></svg>',
  clock: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg>',
  gear: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2.3M12 18.2v2.3M3.5 12h2.3M18.2 12h2.3M6 6l1.6 1.6M16.4 16.4L18 18M6 18l1.6-1.6M16.4 7.6L18 6"/></svg>',
  photos: '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M12 3a5 5 0 0 1 0 9z" fill="#ef4444"/><path d="M21 12a5 5 0 0 1-9 0z" fill="#3b82f6"/><path d="M12 21a5 5 0 0 1 0-9z" fill="#22c55e"/><path d="M3 12a5 5 0 0 1 9 0z" fill="#facc15"/></svg>',
  dots: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  bell: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0f766e" stroke-width="2" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>',
  lock: '<svg width="12" height="13" viewBox="0 0 11 13" fill="currentColor"><rect x="0.5" y="5.5" width="10" height="7.5" rx="1.6"/><path d="M2.6 5.6V4a2.9 2.9 0 0 1 5.8 0v1.6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
};

function icon(name, bg, inner, attr = '') {
  return `<div class="app-icon" ${attr}><div class="ic" style="border-radius:50%;background:${bg}">${inner}</div><div class="lb">${name}</div></div>`;
}

/** Beginscherm van een Android-telefoon. `planbord`: plek van het Planbord-icoon (of null). */
export function androidHome(parent, { planbord = null } = {}) {
  const layer = el('div', 'layer', parent);
  css(el('div', '', layer), { position: 'absolute', inset: '0', background: 'radial-gradient(120% 90% at 80% 0%, #a7f3d0 0%, #34d399 30%, #0f766e 65%, #0b3b37 100%)' });
  statusBar(layer, { light: true, platform: 'android' });
  layer.insertAdjacentHTML('beforeend', '<div style="position:absolute;left:28px;top:70px;color:#fff"><div style="font-size:54px;font-weight:300;letter-spacing:-.02em">9:41</div><div style="font-size:16px;margin-top:2px">maandag 5 oktober</div></div>');
  const apps = [
    icon('Mail', '#ef4444', g.mail),
    icon("Foto's", '#fff', g.photos),
    icon('Klok', '#2563eb', g.clock),
    icon('Instellingen', '#64748b', g.gear),
  ];
  if (planbord != null) apps.splice(planbord, 0, '<div class="app-icon" data-planbord><div class="ic" style="border-radius:50%"><img src="../assets/img/planbord-maskable.png"></div><div class="lb">Planbord</div></div>');
  const grid = css(el('div', 'grid', layer, apps.join('')), { top: '470px' });
  const dock = css(el('div', '', layer), { position: 'absolute', left: '0', right: '0', bottom: '86px', display: 'flex', justifyContent: 'space-around', padding: '0 27px' });
  dock.innerHTML = [
    icon('', '#16a34a', g.phone),
    icon('', '#2563eb', g.chat),
    icon('', '#1f2937', g.browser, 'data-browser'),
    icon('', '#475569', g.camera),
  ].join('');
  css(el('div', '', layer), { position: 'absolute', left: '24px', right: '24px', bottom: '28px', height: '46px', borderRadius: '23px', background: 'rgba(255,255,255,.9)', display: 'flex', alignItems: 'center', padding: '0 18px', color: '#64748b', fontSize: '15px' }).textContent = 'Zoeken';
  css(el('div', 'homebar light', layer), { width: '108px', left: '141px', height: '4px' });
  return { layer, planbordIcon: grid.querySelector('[data-planbord]'), browserIcon: dock.querySelector('[data-browser] .ic') };
}

/** Chrome met een pagina; de adresbalk staat bovenin. */
export function chrome(parent, { url, page }) {
  const layer = css(el('div', 'layer', parent), { background: '#fff' });
  statusBar(layer, { platform: 'android' });
  const bar = css(el('div', '', layer), { position: 'absolute', left: '0', top: '32px', width: '390px', height: '58px', background: '#fff', borderBottom: '1px solid #e5e7eb' });
  const field = css(el('div', '', bar), { position: 'absolute', left: '12px', top: '9px', width: '292px', height: '40px', borderRadius: '20px', background: '#eef1f4', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 14px', fontSize: '15px', color: '#111' });
  el('span', '', field, g.lock).style.color = '#475569';
  const urlText = el('span', '', field);
  urlText.dataset.full = url;
  css(el('div', '', bar, '1'), { position: 'absolute', left: '316px', top: '19px', width: '20px', height: '20px', border: '2px solid #374151', borderRadius: '5px', fontSize: '11px', fontWeight: '700', display: 'grid', placeItems: 'center', color: '#374151' });
  const menu = css(el('div', '', bar, g.dots), { position: 'absolute', left: '350px', top: '15px', width: '28px', height: '28px', display: 'grid', placeItems: 'center', color: '#374151' });
  const content = css(el('div', '', layer), { position: 'absolute', left: '0', top: '90px', width: '390px', height: '740px', overflow: 'hidden', background: '#f8fafc' });
  const pageImg = el('div', '', content, page ? `<img src="${page}" style="width:390px">` : '');
  css(el('div', 'homebar', layer), { width: '108px', left: '141px', height: '4px' });
  return { layer, urlText, menu, content, pageImg };
}

/** Het menu van Chrome (de drie puntjes), met "App installeren". */
export function chromeMenu(parent) {
  const items = ['Nieuw tabblad', 'Nieuw incognitotabblad', 'Geschiedenis', 'Downloads', 'Bladwijzers', 'Recente tabbladen', 'Delen…', 'Zoeken op pagina', 'App installeren', 'Desktopsite', 'Instellingen'];
  const menu = css(el('div', '', parent), { position: 'absolute', left: '128px', top: '38px', width: '254px', borderRadius: '14px', background: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,.25)', zIndex: 62, padding: '6px 0', transformOrigin: '100% 0' });
  menu.innerHTML = `<div style="display:flex;justify-content:space-around;padding:8px 6px 10px;border-bottom:1px solid #eef0f2;color:#374151;font-size:18px"><span>→</span><span>☆</span><span>⤓</span><span>ⓘ</span><span>⟳</span></div>${items
    .map((n) => `<div ${n === 'App installeren' ? 'data-target' : ''} style="height:44px;display:flex;align-items:center;padding:0 18px;font-size:16px;color:#111">${n}</div>`)
    .join('')}`;
  return { menu, target: menu.querySelector('[data-target]') };
}

/** Dialoog "App installeren". */
export function installDialog(parent, { name, url }) {
  const dim = css(el('div', 'dim', parent), {});
  const box = css(el('div', '', parent), { position: 'absolute', left: '28px', top: '300px', width: '334px', borderRadius: '28px', background: '#f4f7f6', padding: '24px', zIndex: 61, boxShadow: '0 10px 40px rgba(0,0,0,.25)' });
  box.innerHTML = `<div style="font-size:22px;font-weight:500;color:#111">App installeren</div>
    <div style="display:flex;gap:14px;align-items:center;margin-top:18px"><img src="../assets/img/planbord-maskable.png" style="width:52px;height:52px;border-radius:50%"><div><div style="font-size:17px;font-weight:600">${name}</div><div style="font-size:14px;color:#6b7280;margin-top:2px">${url}</div></div></div>
    <div style="display:flex;justify-content:flex-end;gap:26px;margin-top:26px;font-size:16px;font-weight:600;color:#0f766e"><span>Annuleren</span><span data-target>Installeren</span></div>`;
  return { dim, box, target: box.querySelector('[data-target]') };
}

/** Systeemvraag voor meldingen (Android 13 en nieuwer). */
export function permissionDialog(parent, { name }) {
  const dim = el('div', 'dim', parent);
  const box = css(el('div', '', parent), { position: 'absolute', left: '28px', top: '280px', width: '334px', borderRadius: '28px', background: '#f4f7f6', padding: '24px 22px 18px', zIndex: 61, textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,.25)' });
  box.innerHTML = `<div style="display:grid;place-items:center">${g.bell}</div>
    <div style="font-size:19px;line-height:1.35;margin-top:14px;color:#111">Toestaan dat <b>${name}</b> je meldingen stuurt?</div>
    <div data-target style="margin-top:22px;height:44px;border-radius:22px;background:#0f766e;color:#fff;display:grid;place-items:center;font-size:16px;font-weight:600">Toestaan</div>
    <div style="margin-top:8px;height:44px;border-radius:22px;display:grid;place-items:center;font-size:16px;font-weight:600;color:#0f766e">Niet toestaan</div>`;
  return { dim, box, target: box.querySelector('[data-target]') };
}

/** Een melding bovenin het scherm. */
export function androidNotification(parent, { title, body }) {
  const box = css(el('div', '', parent), { position: 'absolute', left: '10px', right: '10px', top: '40px', borderRadius: '24px', background: '#f6f8f7', padding: '14px 16px', zIndex: 70, boxShadow: '0 10px 30px rgba(15,23,42,.28)' });
  box.innerHTML = `<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#4b5563"><img src="../assets/img/planbord-maskable.png" style="width:20px;height:20px;border-radius:50%">${title} • nu</div>
    <div style="font-size:15.5px;line-height:1.35;margin-top:6px;color:#111">${body}</div>`;
  return box;
}
