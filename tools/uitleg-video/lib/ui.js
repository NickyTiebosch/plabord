// Bouwstenen voor de uitlegvideo's: het podium, de telefoon, schermen van Planbord, tikjes,
// markeringen, ondertitels en de camera. Alle maten in schermpunten van een iPhone (390 x 844),
// behalve het podium zelf (540 x 960).
import { Timeline } from './motion.js';

export const tl = new Timeline();
window.timeline = tl;
window.seek = (t) => tl.seek(t);

export const SS = 0.85;
export const BEZEL = 10;
export const PHONE_W = 390 * SS + 2 * BEZEL;
export const PHONE_H = 844 * SS + 2 * BEZEL;
export const PHONE_X = (540 - PHONE_W) / 2;
export const PHONE_Y = 80;
export const SCREEN_X = PHONE_X + BEZEL;
export const SCREEN_Y = PHONE_Y + BEZEL;
export const toCanvas = (x, y) => ({ x: SCREEN_X + SS * x, y: SCREEN_Y + SS * y });

export function el(tag, cls, parent, html) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html != null) node.innerHTML = html;
  if (parent) parent.appendChild(node);
  return node;
}
const UNITLESS = new Set(['zIndex', 'opacity', 'fontWeight', 'lineHeight', 'flex', 'order']);
export function css(node, styles) {
  for (const [key, value] of Object.entries(styles)) node.style[key] = typeof value === 'number' && !UNITLESS.has(key) ? `${value}px` : value;
  return node;
}
export async function loadBoxes() {
  const response = await fetch('../assets/screens/boxes.json');
  return response.json();
}
/** Wacht tot lettertypen en afbeeldingen er zijn. */
export async function ready() {
  await document.fonts.ready;
  await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))));
}

// ---------- Iconen ----------
const svg = {
  signal: '<svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>',
  wifi: '<svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor"><path d="M8 2.2c2.4 0 4.6.9 6.3 2.5l1.2-1.3C13.4 1.4 10.8.4 8 .4S2.6 1.4.5 3.4l1.2 1.3C3.4 3.1 5.6 2.2 8 2.2z"/><path d="M8 5.6c1.5 0 2.9.6 4 1.6l1.2-1.3C11.8 4.6 10 3.8 8 3.8s-3.8.8-5.2 2.1L4 7.2c1.1-1 2.5-1.6 4-1.6z"/><path d="M8 9c.7 0 1.3.3 1.8.7L8 11.6 6.2 9.7C6.7 9.3 7.3 9 8 9z"/></svg>',
  battery: '<svg width="27" height="12" viewBox="0 0 27 12"><rect x="0.5" y="0.5" width="23" height="11" rx="3.2" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="18" height="8" rx="2" fill="currentColor"/><rect x="24.5" y="4" width="1.8" height="4" rx=".9" fill="currentColor" opacity=".5"/></svg>',
  check: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};
export const icons = svg;

// ---------- Podium ----------
export function buildStage({ title, chip }) {
  const stage = el('div', '', document.body);
  stage.id = 'stage';
  css(el('div', 'blob', stage), { left: -90, top: -70, width: 280, height: 280, background: 'rgba(94,234,212,.45)' });
  css(el('div', 'blob', stage), { right: -100, top: 330, width: 300, height: 300, background: 'rgba(45,212,191,.30)' });
  css(el('div', 'blob', stage), { left: -70, bottom: 60, width: 260, height: 260, background: 'rgba(15,118,110,.20)' });
  const brand = el('div', '', stage, '<img src="../assets/img/planbord-icon.png"><span>PLANBORD · UITLEG</span>');
  brand.id = 'brand';
  const titleEl = el('div', '', stage, `${title}${chip ? `<span class="chip">${chip}</span>` : ''}`);
  titleEl.id = 'title';
  const cam = el('div', '', stage);
  cam.id = 'cam';
  const phone = css(el('div', 'phone', cam), { left: PHONE_X, top: PHONE_Y, width: PHONE_W, height: PHONE_H });
  const screen = css(el('div', 'screen', phone), { left: BEZEL, top: BEZEL, transform: `scale(${SS})` });
  const captions = el('div', '', stage);
  captions.id = 'captions';
  return { stage, brand, title: titleEl, cam, phone, screen, captions };
}

/** Telefoonkenmerken: Dynamic Island of cameragaatje, en de thuisbalk. */
export function phoneChrome(screen, { platform = 'ios', lightHomebar = false } = {}) {
  if (platform === 'ios') el('div', 'island', screen);
  else el('div', 'punch', screen);
  const bar = el('div', `homebar${lightHomebar ? ' light' : ''}`, screen);
  return { homebar: bar };
}

export function statusBar(parent, { light = false, platform = 'ios' } = {}) {
  const cls = `sb${light ? ' light' : ''}${platform === 'android' ? ' android' : ''}`;
  return el('div', cls, parent, `<div class="time">9:41</div><div class="icons">${svg.signal}${svg.wifi}${svg.battery}</div>`);
}

/** Een scherm van Planbord: kop, scrollende inhoud en de tabbalk onderin. */
export function appScreen(parent, name, boxes, { top = 47, height = 797 } = {}) {
  const info = boxes[name];
  const app = css(el('div', 'app', parent), { top, height });
  const viewport = css(el('div', 'viewport', app), { height });
  const content = el('div', 'content', viewport, `<img src="../assets/screens/${name}-content.png">`);
  const header = el('div', 'header', app, `<img src="../assets/screens/${name}-header.png">`);
  const nav = info.navTop != null ? css(el('div', 'nav', app, `<img src="../assets/screens/${name}-nav.png">`), { top: info.navTop }) : null;
  return { app, viewport, content, header, nav, top, height, info };
}

/** Rechthoek van een element in schermpunten (zonder camera of animatie). */
export function localBox(node, screen) {
  const r = node.getBoundingClientRect();
  const s = screen.getBoundingClientRect();
  return { x: (r.left - s.left) / SS, y: (r.top - s.top) / SS, w: r.width / SS, h: r.height / SS };
}

// ---------- Animaties ----------
/** Een tik: de vinger verschijnt, drukt en laat een kring achter. `from` laat hem eerst glijden. */
export function tap(parent, t, x, y, { from = null, glide = 0.6, linger = 0.35 } = {}) {
  const dot = css(el('div', 'tap', parent), { left: x, top: y });
  const ring = css(el('div', 'ripple', parent), { left: x, top: y });
  const appear = t - (from ? glide + 0.3 : 0.45);
  const o = tl.prop(dot, 'opacity', 0);
  const s = tl.prop(dot, 'scale', 1.5);
  o.to(appear, appear + 0.25, 1, 'out');
  s.to(appear, appear + 0.3, 1, 'out');
  if (from) {
    tl.prop(dot, 'x', from.x - x).to(appear + 0.25, t - 0.12, 0, 'inOut');
    tl.prop(dot, 'y', from.y - y).to(appear + 0.25, t - 0.12, 0, 'inOut');
  }
  s.to(t - 0.08, t + 0.04, 0.8, 'out').to(t + 0.04, t + 0.22, 1, 'out');
  tl.prop(ring, 'opacity', 0).set(t, 0.9).to(t, t + 0.55, 0, 'out');
  tl.prop(ring, 'scale', 1).set(t, 1).to(t, t + 0.55, 2.6, 'out');
  o.to(t + linger, t + linger + 0.25, 0, 'in');
  return { dot, ring };
}

/** Een veeg: de vinger beweegt van `from` naar `to` tussen t0 en t1. */
export function swipe(parent, t0, t1, from, to) {
  const dot = css(el('div', 'tap', parent), { left: from.x, top: from.y });
  tl.prop(dot, 'opacity', 0).to(t0 - 0.3, t0 - 0.05, 1, 'out').to(t1 + 0.05, t1 + 0.3, 0, 'in');
  tl.prop(dot, 'scale', 1.4).to(t0 - 0.3, t0 - 0.05, 0.85, 'out').to(t1, t1 + 0.2, 1.1, 'out');
  tl.prop(dot, 'x', 0).to(t0, t1, to.x - from.x, 'inOut');
  tl.prop(dot, 'y', 0).to(t0, t1, to.y - from.y, 'inOut');
  return dot;
}

/** Een oranje kader dat even pulseert rond een knop of regel. */
export function highlight(parent, box, t0, t1, { pad = 6, radius = 14 } = {}) {
  const node = css(el('div', 'hl', parent), {
    left: box.x - pad,
    top: box.y - pad,
    width: box.w + 2 * pad,
    height: box.h + 2 * pad,
    borderRadius: `${radius}px`,
    transformOrigin: 'center',
  });
  const o = tl.prop(node, 'opacity', 0);
  const s = tl.prop(node, 'scale', 1.12);
  o.to(t0, t0 + 0.25, 1, 'out');
  s.to(t0, t0 + 0.4, 1, 'outBack');
  for (let p = t0 + 0.7; p < t1 - 0.6; p += 1.1) s.to(p, p + 0.4, 1.035, 'inOut').to(p + 0.4, p + 0.8, 1, 'inOut');
  o.to(t1, t1 + 0.25, 0, 'in');
  return node;
}

/** Ondertitel onderin, met stapnummer. */
export function caption(captions, n, text, sub, t0, t1) {
  const num = n === 'ok' ? `<div class="num check">${svg.check.replace(/40/g, '24')}</div>` : `<div class="num">${n}</div>`;
  const node = el('div', 'cap', captions, `${num}<div><div class="txt">${text}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`);
  tl.prop(node, 'opacity', 0).to(t0, t0 + 0.35, 1, 'out').to(t1, t1 + 0.3, 0, 'in');
  tl.prop(node, 'y', 26).to(t0, t0 + 0.45, 0, 'out').to(t1, t1 + 0.3, -14, 'in');
  return node;
}

/**
 * De camera: zoom in op een punt van het scherm, zodat het op plek `at` van het podium komt.
 * Tijdens het inzoomen verdwijnt de titel even, anders schuift de telefoon eroverheen.
 */
export function camera(stage) {
  const cam = stage.cam ?? stage;
  const x = tl.prop(cam, 'x', 0);
  const y = tl.prop(cam, 'y', 0);
  const s = tl.prop(cam, 'scale', 1);
  const heads = [stage.title, stage.brand].filter(Boolean);
  let zoomed = false;
  return {
    zoom(t0, t1, focus, k, at = { x: 270, y: 470 }) {
      const p = toCanvas(focus.x, focus.y);
      x.to(t0, t1, at.x - k * p.x, 'inOut');
      y.to(t0, t1, at.y - k * p.y, 'inOut');
      s.to(t0, t1, k, 'inOut');
      if (!zoomed) for (const head of heads) tl.prop(head, 'opacity').to(t0, t0 + 0.35, 0, 'out');
      zoomed = true;
    },
    reset(t0, t1) {
      x.to(t0, t1, 0, 'inOut');
      y.to(t0, t1, 0, 'inOut');
      s.to(t0, t1, 1, 'inOut');
      if (zoomed) for (const head of heads) tl.prop(head, 'opacity').to(t1 - 0.35, t1, 1, 'out');
      zoomed = false;
    },
  };
}

/** Begin: titel en telefoon komen binnen. */
export function intro(s, t = 0) {
  tl.prop(s.brand, 'opacity', 0).to(t + 0.1, t + 0.6, 1, 'out');
  tl.prop(s.title, 'opacity', 0).to(t + 0.2, t + 0.7, 1, 'out');
  tl.prop(s.title, 'y', 14).to(t + 0.2, t + 0.8, 0, 'out');
  tl.prop(s.phone, 'y', 760).to(t + 0.25, t + 1.25, 0, 'outQuint');
}

/** Slot: een kaart met een vinkje. */
export function outro(s, t, heading, text) {
  const veil = css(el('div', '', s.stage), { position: 'absolute', inset: '0', background: 'rgba(240,253,250,.72)', zIndex: 150 });
  tl.prop(veil, 'opacity', 0).to(t, t + 0.4, 1, 'out');
  const card = el('div', 'done', s.stage, `<div class="ok">${svg.check}</div><h2>${heading}</h2><p>${text}</p>`);
  tl.prop(card, 'opacity', 0).to(t + 0.15, t + 0.5, 1, 'out');
  tl.prop(card, 'scale', 0.85).to(t + 0.15, t + 0.65, 1, 'outBack');
  return card;
}

/** Tekst die letter voor letter verschijnt, met een knipperende cursor. */
export function typeText(parent, text, t0, t1, styles, { caretFrom = t0 - 0.4, caretUntil = t1 + 0.8 } = {}) {
  const wrap = css(el('div', '', parent), { position: 'absolute', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', ...styles });
  const span = el('span', '', wrap);
  span.dataset.full = text;
  const caret = css(el('span', '', wrap), { display: 'inline-block', width: '2px', height: '1.15em', marginLeft: '1px', background: '#0a7aff' });
  tl.prop(span, 'chars', 0).to(t0, t1, text.length, 'linear');
  tl.every((t) => {
    const on = t >= caretFrom && t <= caretUntil && Math.floor((t - caretFrom) * 2.2) % 2 === 0;
    caret.style.visibility = on || (t >= t0 && t <= t1) ? 'visible' : 'hidden';
  });
  return { wrap, span, caret };
}

/** Planbord als app op de telefoon: statusbalk plus een of meer schermen die je kunt wisselen. */
export function appFrame(parent, names, boxes, { platform = 'ios' } = {}) {
  const top = platform === 'ios' ? 47 : 32;
  const layer = css(el('div', 'layer', parent), { background: '#f8fafc' });
  statusBar(layer, { platform });
  const pages = {};
  names.forEach((name, index) => {
    const pageLayer = el('div', 'layer', layer);
    const page = appScreen(pageLayer, name, boxes, { top });
    page.layer = pageLayer;
    page.opacity = tl.prop(pageLayer, 'opacity', index === 0 ? 1 : 0);
    pages[name] = page;
  });
  if (platform === 'ios') el('div', 'homebar', layer);
  else css(el('div', 'homebar', layer), { width: '108px', left: '141px', height: '4px' });
  return { layer, pages, top };
}

/** Wissel van scherm: `to` komt in beeld, `from` verdwijnt. */
export function switchPage(from, to, t, dur = 0.3) {
  to.opacity.to(t, t + dur, 1, 'out');
  if (from) from.opacity.to(t + dur * 0.6, t + dur, 0, 'linear');
}

/** Middelpunt van een rechthoek. */
export const mid = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
