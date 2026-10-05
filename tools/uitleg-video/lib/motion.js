// Een kleine, deterministische tijdlijn voor de uitlegvideo's. Alles is een functie van de tijd t
// (seconden): dezelfde t geeft altijd hetzelfde beeld. Geen CSS-animaties of timers, zodat het
// renderen beeld voor beeld kan.

export const ease = {
  linear: (p) => p,
  in: (p) => p * p * p,
  out: (p) => 1 - Math.pow(1 - p, 3),
  inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  outBack: (p) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
  },
  outQuint: (p) => 1 - Math.pow(1 - p, 5),
};

class Track {
  constructor(initial) {
    this.keys = [[-Infinity, initial, 'linear']];
    this.last = initial;
  }
  /** Van de huidige waarde naar `value`, tussen `start` en `end`. */
  to(start, end, value, how = 'inOut') {
    this.keys.push([start, this.last, 'linear']);
    this.keys.push([end, value, how]);
    this.last = value;
    return this;
  }
  /** Direct naar `value` op tijdstip `time`. */
  set(time, value) {
    this.keys.push([time, this.last, 'linear']);
    this.keys.push([time + 1e-6, value, 'linear']);
    this.last = value;
    return this;
  }
  at(t) {
    const keys = this.keys;
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, how] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        const span = t1 - t0;
        // Het eerste stuk begint bij -oneindig: daar geldt gewoon de beginwaarde.
        const p = !Number.isFinite(span) || span <= 0 ? 1 : (t - t0) / span;
        return v0 + (v1 - v0) * ease[how](Math.min(1, Math.max(0, p)));
      }
    }
    return keys[keys.length - 1][1];
  }
}

export class Timeline {
  constructor() {
    this.tracks = new Map();
    this.hooks = [];
    this.duration = 0;
  }
  /** Het spoor voor één eigenschap van één element (x, y, scale, rotate, opacity, scroll, chars, w, h). */
  prop(el, name, initial) {
    if (!el) throw new Error(`Geen element voor ${name}`);
    let perEl = this.tracks.get(el);
    if (!perEl) {
      perEl = new Map();
      this.tracks.set(el, perEl);
    }
    let track = perEl.get(name);
    if (!track) {
      track = new Track(initial ?? defaults[name] ?? 0);
      perEl.set(name, track);
    }
    return track;
  }
  /** Code die bij elk beeld draait, voor alles wat geen gewone eigenschap is. */
  every(fn) {
    this.hooks.push(fn);
  }
  end(t) {
    this.duration = Math.max(this.duration, t);
  }
  seek(t) {
    for (const [el, perEl] of this.tracks) {
      const v = {};
      for (const [name, track] of perEl) v[name] = track.at(t);
      apply(el, v);
    }
    for (const fn of this.hooks) fn(t);
  }
}

const defaults = { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1, scroll: 0, chars: 0, blur: 0 };

function apply(el, v) {
  const parts = [];
  if ('x' in v || 'y' in v) parts.push(`translate(${(v.x ?? 0).toFixed(3)}px, ${(v.y ?? 0).toFixed(3)}px)`);
  if ('scroll' in v) parts.push(`translateY(${(-v.scroll).toFixed(3)}px)`);
  if ('scale' in v) parts.push(`scale(${v.scale.toFixed(5)})`);
  if ('rotate' in v) parts.push(`rotate(${v.rotate.toFixed(3)}deg)`);
  if (parts.length) el.style.transform = parts.join(' ');
  if ('opacity' in v) {
    el.style.opacity = String(Math.max(0, Math.min(1, v.opacity)));
    el.style.visibility = v.opacity <= 0.001 ? 'hidden' : 'visible';
  }
  if ('blur' in v) el.style.filter = v.blur > 0.01 ? `blur(${v.blur.toFixed(2)}px)` : 'none';
  if ('w' in v) el.style.width = `${v.w}px`;
  if ('h' in v) el.style.height = `${v.h}px`;
  if ('chars' in v) el.textContent = (el.dataset.full ?? '').slice(0, Math.round(v.chars));
}
