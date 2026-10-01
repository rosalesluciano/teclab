// Todo lo que no es 3D: marcos, cajetín, plano 1:1, corte del switch y formulario.
// El modelo se carga aparte, así que la página se lee entera aunque WebGL falle.
import { KEYS, U, BEZEL, COLS, ROWS, WIDTH_MM, DEPTH_MM } from './layout.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const sheets = [...document.querySelectorAll('[data-tl-sheet]')];
const NS = 'http://www.w3.org/2000/svg';

// ------------------------------------------------------------- marcos --
sheets.forEach((s) => {
  const host = s.querySelector('[data-sc-stage]') || s;
  const m = document.createElement('div');
  m.className = 'marco';
  m.setAttribute('aria-hidden', 'true');
  'ABCDEF'.split('').forEach((l, i) => {
    const sp = document.createElement('span'); sp.className = 'zx'; sp.textContent = l;
    sp.style.left = ((i + 0.5) / 6 * 100) + '%'; m.appendChild(sp);
  });
  '1234'.split('').forEach((l, i) => {
    const sp = document.createElement('span'); sp.className = 'zy'; sp.textContent = l;
    sp.style.top = ((i + 0.5) / 4 * 100) + '%'; m.appendChild(sp);
  });
  host.appendChild(m);
});

// ------------------------------------------------------------ cajetín --
const cj = document.querySelector('.cajetin');
const cjName = cj.querySelector('[data-cj-name]');
const cjScale = cj.querySelector('[data-cj-scale]');
const cjBtn = cj.querySelector('.cajetin__btn');
const cjList = cj.querySelector('#cj-index');
sheets.forEach((s) => {
  const li = document.createElement('li');
  li.innerHTML = `<a href="#${s.id}"><b>${s.dataset.tlSheet}</b><span>Esc ${s.dataset.tlScale}</span></a>`;
  cjList.appendChild(li);
});
const links = [...cjList.querySelectorAll('a')];
const setOpen = (open) => { cjBtn.setAttribute('aria-expanded', String(open)); cjList.hidden = !open; };
cjBtn.addEventListener('click', () => setOpen(cjList.hidden));
links.forEach((a) => a.addEventListener('click', () => setOpen(false)));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !cjList.hidden) { setOpen(false); cjBtn.focus(); } });
document.addEventListener('click', (e) => { if (!cj.contains(e.target)) setOpen(false); });

let current = null;
function track() {
  const mid = innerHeight * 0.5;
  let now = sheets[0];
  for (const s of sheets) { if (s.getBoundingClientRect().top <= mid) now = s; }
  if (now !== current) {
    current = now;
    cjName.textContent = now.dataset.tlSheet;
    cjScale.textContent = now.dataset.tlScale;
    links.forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + now.id)));
  }
  const close = document.getElementById('encendido');
  const r = close.getBoundingClientRect();
  document.body.classList.toggle('at-close', r.top < innerHeight * 0.35);
}

// --------------------------------------------------------- plano 1:1 --
(function plan() {
  const fig = document.querySelector('[data-tl-plan]');
  const padT = 34, padB = 34, W = WIDTH_MM, D = DEPTH_MM;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 ${-padT} ${W} ${D + padT + padB}`);
  svg.setAttribute('aria-hidden', 'true');
  fig.style.setProperty('--wmm', W.toFixed(1));
  const el = (tag, attrs, parent = svg) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    parent.appendChild(n); return n;
  };
  const ink = '#0E0F10';
  el('rect', { x: 0.5, y: 0.5, width: W - 1, height: D - 1, rx: 6, fill: '#8C9093', stroke: ink, 'stroke-width': 0.6 });
  el('rect', { x: BEZEL - 1.5, y: BEZEL - 1.5, width: COLS * U + 3, height: ROWS * U + 3, fill: '#111213' });
  KEYS.forEach((k) => {
    const x = BEZEL + k.x * U, y = BEZEL + k.y * U, w = k.w * U;
    el('rect', { x: x + 0.55, y: y + 0.55, width: w - 1.1, height: U - 1.1, rx: 1.2, fill: '#1B1C1D', stroke: '#2E3032', 'stroke-width': 0.3 });
    el('rect', { x: x + 2.9, y: y + 2.4, width: w - 5.8, height: U - 7, rx: 1, fill: '#222325' });
    const single = [...k.legend].length === 1;
    const t = el('text', {
      x: single || k.code === 'Space' ? x + w / 2 : x + 4.2,
      y: single || k.code === 'Space' ? y + U / 2 + 1.4 : y + 7.6,
      'text-anchor': single || k.code === 'Space' ? 'middle' : 'start',
      'font-size': single ? 5.2 : 2.9, 'font-weight': k.code === 'Space' ? 800 : 600,
      fill: '#D9DBD8',
    });
    if (k.code === 'Space') t.setAttribute('font-family', 'Archivo, sans-serif');
    t.textContent = k.legend;
  });
  // cota total
  const dim = (x1, x2, y, label) => {
    el('path', { d: `M${x1} ${y}H${x2}M${x1} ${y - 3}V${y + 3}M${x2} ${y - 3}V${y + 3}`, stroke: ink, 'stroke-width': 0.45, fill: 'none' });
    el('text', { x: (x1 + x2) / 2, y: y - 2.2, 'text-anchor': 'middle', 'font-size': 3.6, 'font-weight': 600, fill: ink }).textContent = label;
  };
  dim(0, W, -16, '371,7 mm');
  // zonas debajo del plano
  const zone = (u0, u1, row, label) => {
    const x1 = BEZEL + u0 * U, x2 = BEZEL + u1 * U, y = D + 10 + row * 16;
    el('path', { d: `M${x1} ${y - 4}V${y}H${x2}V${y - 4}`, stroke: ink, 'stroke-width': 0.45, fill: 'none' });
    el('text', { x: x1, y: y + 6.5, 'font-size': 3.4, 'font-weight': 600, fill: ink, 'letter-spacing': 0.3 }).textContent = label;
  };
  zone(0, 15, 0, 'BLOQUE PRINCIPAL · 61 TECLAS');
  zone(15.25, 18.25, 0, 'BLOQUE DERECHO · 13');
  // cota de profundidad
  el('path', { d: `M${W + 10} 0V${D}M${W + 7} 0H${W + 13}M${W + 7} ${D}H${W + 13}`, stroke: ink, 'stroke-width': 0.45, fill: 'none' });
  el('text', { x: W + 15, y: D / 2, 'font-size': 3.6, 'font-weight': 600, fill: ink, transform: `rotate(90 ${W + 15} ${D / 2})`, 'text-anchor': 'middle' }).textContent = '147,8 mm';
  fig.prepend(svg);
})();

// ------------------------------------------------------ corte del switch --
const sw = {
  act: document.getElementById('switch'),
  cap: document.getElementById('sw-cap'),
  stem: document.getElementById('sw-stem'),
  jacket: document.getElementById('sw-jacket'),
  spring: document.getElementById('sw-spring'),
  leaf: document.getElementById('sw-leaf'),
  read: document.querySelector('[data-sw-read]'),
  fill: document.querySelector('[data-sw-fill]'),
  clic: document.querySelector('[data-sw-clic]'),
  last: -1,
};
const PXMM = 22;
function drawSwitch() {
  const p = reduce ? 0.14 + 0.6 * 0.47 : (parseFloat(sw.act.style.getPropertyValue('--sc-p')) || 0);
  if (Math.abs(p - sw.last) < 0.0005) return;
  sw.last = p;
  const mm = 4 * smooth((p - 0.14) / 0.6);
  const dy = mm * PXMM;
  sw.cap.setAttribute('transform', `translate(0 ${(dy - 10).toFixed(2)})`);
  sw.stem.setAttribute('transform', `translate(0 ${(dy - 10).toFixed(2)})`);
  // el collar baja con el vástago y, entre 1,8 y 2,2 mm, salta hasta el piso: ese golpe es el clic
  const snap = smooth((mm - 1.8) / 0.4);
  const jy = Math.min(dy, 1.8 * PXMM) + snap * 30 - 10;
  sw.jacket.setAttribute('transform', `translate(0 ${jy.toFixed(2)})`);
  // resorte entre el fondo del vástago y el piso de la carcasa
  const top = 460 + dy, bot = 612, turns = 9;
  let d = `M320 ${top}`;
  for (let i = 1; i <= turns * 2; i++) {
    const y = top + (bot - top) * (i / (turns * 2));
    d += `L${i % 2 ? 346 : 294} ${y.toFixed(1)}`;
  }
  d += `L320 ${bot}`;
  sw.spring.setAttribute('d', d);
  const bend = smooth((mm - 2.0) / 0.3) * 14;
  sw.leaf.setAttribute('d', `M388 612 Q${(386 + bend).toFixed(1)} 566 ${(388 + bend).toFixed(1)} 520`);
  sw.read.textContent = mm.toFixed(1).replace('.', ',');
  sw.fill.style.transform = `scaleX(${(mm / 4).toFixed(4)})`;
  const c = smooth((mm - 2.1) / 0.25);
  sw.clic.style.opacity = c.toFixed(3);
  sw.clic.style.transform = reduce ? 'none' : `scale(${(1.08 - c * 0.08).toFixed(3)})`;
}

// --------------------------------------------------------- formulario --
(function form() {
  const f = document.querySelector('.aprobado');
  const msg = f.querySelector('[data-ap-msg]');
  const input = f.querySelector('input');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!input.checkValidity()) {
      msg.dataset.kind = 'error';
      msg.textContent = 'Revisá el correo: falta algo antes o después de la @.';
      input.focus();
      return;
    }
    const endpoint = f.dataset.endpoint;
    if (!endpoint) {
      msg.dataset.kind = 'error';
      msg.textContent = 'La preventa todavía no tiene el envío conectado. Tu correo no salió de esta página.';
      return;
    }
    const btn = f.querySelector('button');
    btn.disabled = true;
    try {
      const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: input.value }) });
      if (!r.ok) throw new Error(r.status);
      msg.dataset.kind = 'ok';
      msg.textContent = 'Anotado. Te escribimos cuando abra la preventa, y nada más.';
      f.reset();
    } catch (err) {
      msg.dataset.kind = 'error';
      msg.textContent = 'No se pudo enviar. Probá de nuevo en un rato.';
    } finally { btn.disabled = false; }
  });
})();

// la marca ocupa el ancho de la hoja, ni un píxel más
const word = document.querySelector('.hero__word');
function fitWord() {
  word.style.fontSize = '20vw';
  const avail = innerWidth - 2 * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--marco')) || 12) - 24;
  word.style.fontSize = (20 * avail / word.offsetWidth).toFixed(3) + 'vw';
}
// y está hecha de partículas que se apartan del puntero
let resample = () => {};
import('./particles.js').then(({ mountParticles }) => {
  document.fonts.ready.then(() => { fitWord(); resample = mountParticles(word); resample(); });
}).catch(() => {});
document.fonts.ready.then(fitWord);
let rz;
addEventListener('resize', () => { fitWord(); clearTimeout(rz); rz = setTimeout(() => resample(), 180); });

// ------------------------------------------------------------- bucle --
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { ticking = false; track(); drawSwitch(); });
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
// el motor escribe --sc-p en su propio rAF; un pase más asegura el primer cuadro
requestAnimationFrame(() => requestAnimationFrame(onScroll));

// --------------------------------------------------------------- 3D --
import('./teclab3d.js').then(({ mountHero, mountClose }) => {
  mountHero(document.getElementById('conjunto')).catch((e) => console.warn('[teclab] hero sin 3D', e));
  mountClose(document.getElementById('encendido')).catch((e) => console.warn('[teclab] cierre sin 3D', e));
}).catch((e) => console.warn('[teclab] sin WebGL, quedan los pósters', e));
