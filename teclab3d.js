// TECLAB, el modelo. Un solo constructor para las dos escenas (conjunto y
// encendido). Todo se modela en milímetros y se escala 0,01 al final.
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/addons/RoundedBoxGeometry.js';
import { RoomEnvironment } from './vendor/addons/RoomEnvironment.js';
import { KEYS, U, BEZEL, COLS, ROWS, WIDTH_MM, DEPTH_MM } from './layout.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const mix = (a, b, t) => a + (b - a) * t;
const small = () => innerWidth < 760;

const CAP_H = 9, CAP_BASE = 7, TRAVEL = 4, RIM_TOP = 5;

// ---------------------------------------------------------------- piezas --
const capCache = new Map();
function capGeometry(w) {
  if (capCache.has(w)) return capCache.get(w);
  const bw = w * U - 1.1, bd = U - 1.1;
  const g = new RoundedBoxGeometry(bw, CAP_H, bd, 3, 1.3);
  const p = g.attributes.position;
  const ix = 2.9, iz = 3.4;                     // cuánto se angosta la cara superior
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + CAP_H / 2) / CAP_H;
    p.setX(i, p.getX(i) * (1 - t * 2 * ix / bw));
    p.setZ(i, p.getZ(i) * (1 - t * 2 * iz / bd) - t * 0.6);
  }
  g.computeVertexNormals();
  g.translate(0, CAP_H / 2, 0);
  const out = { g, top: { w: bw - 2 * ix, d: bd - 2 * iz } };
  capCache.set(w, out);
  return out;
}

function roundedRect(shape, x, y, w, h, r) {
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

// Leyendas: un atlas, un solo draw call, color por vértice para la luz.
async function legendAtlas() {
  try {
    await Promise.all([
      document.fonts.load('600 40px "IBM Plex Mono"'),
      document.fonts.load('800 40px "Archivo"'),
    ]);
  } catch (e) { /* sin fuentes igual dibuja con la de sistema */ }
  const PX = 128, W = 2048;
  let x = 0, y = 0;
  const cells = [];
  KEYS.forEach((k) => {
    const cw = Math.round(k.w * PX);
    if (x + cw > W) { x = 0; y += PX; }
    cells.push({ x, y, w: cw, h: PX });
    x += cw;
  });
  const H = Math.pow(2, Math.ceil(Math.log2(y + PX)));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  KEYS.forEach((k, i) => {
    const cell = cells[i];
    const L = k.legend;
    ctx.save();
    ctx.beginPath(); ctx.rect(cell.x, cell.y, cell.w, cell.h); ctx.clip();
    if (k.code === 'Space') {
      ctx.font = '800 40px "Archivo", system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(L, cell.x + cell.w / 2, cell.y + cell.h / 2 + 2);
    } else if ([...L].length === 1) {
      ctx.font = '600 62px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(L, cell.x + cell.w / 2, cell.y + cell.h / 2 + 2);
    } else {
      ctx.font = '600 31px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(L, cell.x + 16, cell.y + 16);
    }
    ctx.restore();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.flipY = true;
  return { tex, cells, W, H };
}

function softSquare() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function buildKeyboard({ dim = 0.35 } = {}) {
  const root = new THREE.Group();
  const kb = new THREE.Group();
  root.add(kb);
  kb.scale.setScalar(0.01);

  const alu = new THREE.MeshPhysicalMaterial({ color: 0x6a6f72, metalness: 0.86, roughness: 0.55, envMapIntensity: 0.55 });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x0c0d0e, metalness: 0.5, roughness: 0.55, emissive: 0xffffff, emissiveIntensity: 0 });
  const capMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0b0c, roughness: 0.84, metalness: 0, envMapIntensity: 0.3, sheen: 0.15, sheenColor: 0x303030 });
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.4 });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x2457ff, roughness: 0.32, emissive: 0x0b2a9c, emissiveIntensity: 0.25 });

  const iw = COLS * U, id = ROWS * U;

  // chasis: cuerpo + marco elevado
  const body = new THREE.Mesh(new RoundedBoxGeometry(WIDTH_MM, 20, DEPTH_MM, 4, 5), alu);
  body.position.y = -1.5 - 10;
  body.castShadow = body.receiveShadow = true;
  kb.add(body);

  const outer = roundedRect(new THREE.Shape(), -WIDTH_MM / 2, -DEPTH_MM / 2, WIDTH_MM, DEPTH_MM, 6);
  const hole = roundedRect(new THREE.Path(), -iw / 2 - 1.5, -id / 2 - 1.5, iw + 3, id + 3, 1.2);
  outer.holes.push(hole);
  const rimG = new THREE.ExtrudeGeometry(outer, { depth: 7, bevelEnabled: true, bevelSize: 1.1, bevelThickness: 1.1, bevelSegments: 3, curveSegments: 6 });
  rimG.rotateX(-Math.PI / 2);
  const rim = new THREE.Mesh(rimG, alu);
  rim.position.y = RIM_TOP - 7 - 1.1;
  rim.castShadow = rim.receiveShadow = true;
  kb.add(rim);

  const plate = new THREE.Mesh(new THREE.BoxGeometry(iw + 3, 1.5, id + 3), plateMat);
  plate.position.y = -0.75;
  plate.receiveShadow = true;
  kb.add(plate);

  // sombra de contacto sobre lo que haya detrás del canvas
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH_MM * 2.2, DEPTH_MM * 3.2), new THREE.ShadowMaterial({ opacity: 0.24 }));
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -21.6;
  shadowPlane.receiveShadow = true;
  kb.add(shadowPlane);

  // switches: carcasas y vástagos en cruz, instanciados
  const n = KEYS.length;
  const housing = new THREE.InstancedMesh(new THREE.BoxGeometry(14, 6, 14), housingMat, n);
  const stemA = new THREE.InstancedMesh(new THREE.BoxGeometry(4.1, 4, 1.3), stemMat, n);
  const stemB = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 4, 4.1), stemMat, n);
  housing.castShadow = true; housing.receiveShadow = true;
  const m4 = new THREE.Matrix4();

  const atlas = await legendAtlas();
  const legendPos = new Float32Array(n * 4 * 3);
  const legendUV = new Float32Array(n * 4 * 2);
  const legendCol = new Float32Array(n * 4 * 3);
  const legendIdx = [];

  const glowTex = softSquare();
  const glow = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    n);
  glow.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);

  const keys = [];
  const byCode = new Map();
  KEYS.forEach((k, i) => {
    const cx = (k.x + k.w / 2) * U - iw / 2;
    const cz = (k.y + 0.5) * U - id / 2;
    const { g, top } = capGeometry(k.w);
    const cap = new THREE.Mesh(g, capMat);
    cap.position.set(cx, CAP_BASE, cz);
    cap.castShadow = true; cap.receiveShadow = true;
    cap.userData.code = k.code;
    kb.add(cap);

    m4.makeTranslation(cx, 3, cz); housing.setMatrixAt(i, m4);
    m4.makeTranslation(cx, 8, cz); stemA.setMatrixAt(i, m4); stemB.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(cx, 0.4, cz), new THREE.Quaternion(), new THREE.Vector3(k.w * U + 4, 1, U + 4));
    glow.setMatrixAt(i, m4);

    // cara superior de la leyenda (cuatro vértices, dos triángulos)
    const lw = top.w - 0.6, ld = top.d - 0.6, lzc = cz - 0.6;
    const cell = atlas.cells[i];
    const u0 = cell.x / atlas.W, u1 = (cell.x + cell.w) / atlas.W;
    const v1 = 1 - cell.y / atlas.H, v0 = 1 - (cell.y + cell.h) / atlas.H;
    const corners = [[-lw / 2, -ld / 2, u0, v1], [lw / 2, -ld / 2, u1, v1], [lw / 2, ld / 2, u1, v0], [-lw / 2, ld / 2, u0, v0]];
    corners.forEach(([dx, dz, u, v], j) => {
      const o = (i * 4 + j);
      legendPos[o * 3] = cx + dx; legendPos[o * 3 + 1] = CAP_BASE + CAP_H + 0.12; legendPos[o * 3 + 2] = lzc + dz;
      legendUV[o * 2] = u; legendUV[o * 2 + 1] = v;
    });
    const b = i * 4;
    legendIdx.push(b, b + 2, b + 1, b, b + 3, b + 2);

    const key = { ...k, i, cap, cx, cz, press: 0, pressed: false, level: 0, lift: 0, flash: 0 };
    keys.push(key);
    byCode.set(k.code, key);
  });

  const legendGeo = new THREE.BufferGeometry();
  legendGeo.setAttribute('position', new THREE.BufferAttribute(legendPos, 3));
  legendGeo.setAttribute('uv', new THREE.BufferAttribute(legendUV, 2));
  legendGeo.setAttribute('color', new THREE.BufferAttribute(legendCol, 3));
  legendGeo.setIndex(legendIdx);
  const legends = new THREE.Mesh(legendGeo, new THREE.MeshBasicMaterial({ map: atlas.tex, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false }));
  legends.frustumCulled = false;
  kb.add(housing, stemA, stemB, glow, legends);

  // luz por tecla: 0 apagada, 1 blanco pleno
  function apply() {
    let sum = 0;
    const col = glow.instanceColor.array;
    const lc = legendGeo.attributes.color.array;
    const lp = legendGeo.attributes.position.array;
    keys.forEach((k) => {
      const L = clamp01(k.level);
      sum += L;
      col[k.i * 3] = col[k.i * 3 + 1] = col[k.i * 3 + 2] = L * 0.8;
      const c = mix(dim, 1.25, L);
      const y = CAP_BASE + CAP_H + 0.12 + k.lift - k.press * TRAVEL;
      for (let j = 0; j < 4; j++) {
        const o = (k.i * 4 + j) * 3;
        lc[o] = lc[o + 1] = lc[o + 2] = c;
        lp[o + 1] = y;
      }
      k.cap.position.y = CAP_BASE + k.lift - k.press * TRAVEL;
    });
    glow.instanceColor.needsUpdate = true;
    legendGeo.attributes.color.needsUpdate = true;
    legendGeo.attributes.position.needsUpdate = true;
    plateMat.emissiveIntensity = (sum / keys.length) * 0.12;
  }
  apply();

  return { root, kb, keys, byCode, apply, caps: keys.map((k) => k.cap), materials: { alu, capMat } };
}

// ---------------------------------------------------------------- escena --
function makeRenderer(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  return renderer;
}

function lights(scene, renderer, { env = 1, key = 2.4, fill = 0.5 }) {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = env;
  const sun = new THREE.DirectionalLight(0xffffff, key);
  sun.position.set(-2.2, 5.5, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = sun.shadow.camera; s.left = -3; s.right = 3; s.top = 3; s.bottom = -3; s.near = 0.5; s.far = 14;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.01; sun.shadow.radius = 4;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x303234, fill));
  return sun;
}

// distancia para que el ancho del teclado ocupe `f` del ancho visible
function fitDistance(cam, f) {
  const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  return (WIDTH_MM * 0.01) / (f * 2 * t * cam.aspect);
}

function place(cam, target, d, elDeg, azDeg) {
  const el = THREE.MathUtils.degToRad(elDeg), az = THREE.MathUtils.degToRad(azDeg);
  cam.position.set(
    target.x + d * Math.cos(el) * Math.sin(az),
    target.y + d * Math.sin(el),
    target.z + d * Math.cos(el) * Math.cos(az));
  cam.lookAt(target);
}

function actProgress(el) { return parseFloat(el.style.getPropertyValue('--sc-p')) || 0; }

function sizer(renderer, cam, canvas) {
  let w = 0, h = 0;
  return () => {
    const r = canvas.getBoundingClientRect();
    if (Math.round(r.width) === w && Math.round(r.height) === h) return false;
    w = Math.round(r.width); h = Math.round(r.height);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small() ? 1.75 : 1.6));
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    return true;
  };
}

function onScreen(el, cb) {
  let vis = false;
  new IntersectionObserver((es) => es.forEach((e) => { vis = e.isIntersecting; cb(vis); }), { rootMargin: '10% 0px' }).observe(el);
  return () => vis;
}

const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
if (fine && !reduce) {
  addEventListener('pointermove', (e) => {
    pointer.tx = e.clientX / innerWidth * 2 - 1;
    pointer.ty = e.clientY / innerHeight * 2 - 1;
  }, { passive: true });
}

// ============================================================== CONJUNTO ==
export async function mountHero(act) {
  const canvas = act.querySelector('[data-tl-canvas]');
  const renderer = makeRenderer(canvas);
  if (!renderer) return;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
  lights(scene, renderer, { env: 0.95, key: 2.6, fill: 0.55 });
  const board = await buildKeyboard({ dim: 0.62 });
  scene.add(board.root);
  const resize = sizer(renderer, cam, canvas);
  const target = new THREE.Vector3();

  const callouts = [...act.querySelectorAll('[data-tl-anchor]')].map((el) => ({ el, name: el.dataset.tlAnchor, line: act.querySelector(`[data-tl-line="${el.dataset.tlAnchor}"]`) }));
  const anchorsMM = {
    case: new THREE.Vector3(WIDTH_MM / 2 - 8, RIM_TOP + 1, DEPTH_MM / 2 - 2),
    cap: null, switch: null, light: null,
  };
  const kEnter = board.byCode.get('Enter'), kJ = board.byCode.get('KeyJ'), kB = board.byCode.get('KeyB');
  const v = new THREE.Vector3();
  const layerWord = act.querySelector('.hero__word');
  const layerGrid = act.querySelector('.hero__grid');
  const lineSvg = act.querySelector('.hero__lines');

  let last = -1, lastPx = 0, lastPy = 0;
  const isVisible = onScreen(act, (vis) => { if (vis) loop(); });
  let running = false;

  function frame() {
    const resized = resize();
    let p = reduce ? 0 : actProgress(act);
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    const moved = Math.abs(pointer.x - lastPx) + Math.abs(pointer.y - lastPy) > 0.0005;
    if (!resized && !moved && Math.abs(p - last) < 0.0002) return;
    last = p; lastPx = pointer.x; lastPy = pointer.y;

    const mob = small();
    const turn = smooth(p / 0.85);
    const el = Math.min(88.4, mix(88.4, mob ? 44 : 34, turn) - pointer.y * 2.2);   // nunca pasa por encima del cenit
    const az = mix(0, mob ? -18 : -26, turn) + pointer.x * 3.5;
    const f = mob ? mix(0.94, 1.02, turn) : mix(0.58, 0.64, turn);
    const d = fitDistance(cam, f);
    target.set(0, mix(0, 0.08, turn), 0);
    place(cam, target, d, el, az);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const ox = mob ? 0 : mix(-0.13, -0.075, turn) * W;
    const oy = mob ? mix(0.14, 0.06, turn) * H : mix(0.03, -0.035, turn) * H;
    cam.setViewOffset(W, H, ox, oy, W, H);

    // despiece: filas del fondo primero, sin pasar de 30 mm
    board.keys.forEach((k) => {
      const e = smooth((p - 0.22 - (6.5 - k.y) * 0.022) / 0.4);
      k.lift = e * 30;
      k.level = 0;
    });
    board.apply();
    renderer.render(scene, cam);

    // planos DOM: grilla lenta, marca media, cotas al frente y más rápidas
    if (!reduce) {
      layerGrid.style.transform = `translate3d(${(-pointer.x * 4).toFixed(2)}px, ${(-p * 3).toFixed(2)}vh, 0)`;
      layerWord.style.transform = `translate3d(${(-pointer.x * 9).toFixed(2)}px, ${(-p * 13).toFixed(2)}vh, 0)`;
    }
    anchorsMM.cap = new THREE.Vector3(kEnter.cx, CAP_BASE + CAP_H + kEnter.lift, kEnter.cz);
    anchorsMM.switch = new THREE.Vector3(kJ.cx, 10, kJ.cz);
    anchorsMM.light = new THREE.Vector3(kB.cx + U * 0.5, 0.5, kB.cz + U * 0.5);
    const show = reduce ? 0 : smooth((p - 0.5) / 0.28);
    const rise = reduce ? 0 : (1 - p) * 60;
    callouts.forEach((c) => {
      if (!c.el.offsetParent) { c.line.style.opacity = '0'; return; }
      v.copy(anchorsMM[c.name]).multiplyScalar(0.01).project(cam);
      const ax = (v.x * 0.5 + 0.5) * W, ay = (-v.y * 0.5 + 0.5) * H;
      const [dx, dy] = (mob ? c.el.dataset.offM : c.el.dataset.off).split(',').map(Number);
      let lx = ax + dx, ly = ay + dy + rise;
      const bw = c.el.offsetWidth, bh = c.el.offsetHeight;
      const alignRight = dx < 0;
      let bx = alignRight ? lx - bw : lx;
      bx = Math.max(12, Math.min(W - bw - 12, bx));
      let by = Math.max(12, Math.min(H - bh - 12, ly - bh / 2));
      c.el.style.transform = `translate3d(${bx.toFixed(1)}px, ${by.toFixed(1)}px, 0)`;
      c.el.style.opacity = show.toFixed(3);
      const ex = alignRight ? bx + bw : bx, ey = by + bh / 2;
      c.line.setAttribute('d', `M${ax.toFixed(1)} ${ay.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}`);
      c.line.style.opacity = show.toFixed(3);
    });
    lineSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    if (!act.classList.contains('tl-live')) act.classList.add('tl-live');
  }
  function loop() {
    if (running) return;
    running = true;
    const tick = () => {
      if (!isVisible() || document.hidden) { running = false; return; }
      frame();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });
  addEventListener('resize', () => { last = -1; });
  loop();
}

// ============================================================= ENCENDIDO ==
export async function mountClose(act) {
  const canvas = act.querySelector('[data-tl-canvas]');
  const renderer = makeRenderer(canvas);
  if (!renderer) return;
  renderer.toneMappingExposure = 0.9;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  const sun = lights(scene, renderer, { env: 0.16, key: 0.9, fill: 0.08 });
  sun.position.set(1.5, 4.5, -2.5);
  const board = await buildKeyboard({ dim: 0.1 });
  scene.add(board.root);
  const resize = sizer(renderer, cam, canvas);
  const target = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  const ui = {
    ppm: act.querySelector('[data-tl-ppm]'),
    typed: act.querySelector('[data-tl-typed]'),
    sound: act.querySelector('[data-tl-sound]'),
    room: act.querySelector('.close__room'),
    status: act.querySelector('[data-tl-state]'),
  };

  // ---- sonido: clic azul sintetizado, solo en respuesta a una tecla -------
  let audio = null, soundOn = true;
  ui.sound.addEventListener('click', () => {
    soundOn = !soundOn;
    ui.sound.setAttribute('aria-pressed', String(soundOn));
    ui.sound.querySelector('b').textContent = soundOn ? 'sí' : 'no';
  });
  function noise(ctx, dur) {
    const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const s = ctx.createBufferSource(); s.buffer = b; return s;
  }
  function click(down) {
    if (!soundOn) return;
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const t = audio.currentTime, out = audio.createGain();
      out.gain.value = 0.55; out.connect(audio.destination);
      const n1 = noise(audio, down ? 0.035 : 0.025);
      const bp = audio.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = (down ? 3900 : 2600) * (0.94 + Math.random() * 0.12); bp.Q.value = 1.4;
      const g1 = audio.createGain(); g1.gain.setValueAtTime(down ? 0.9 : 0.3, t); g1.gain.exponentialRampToValueAtTime(0.001, t + (down ? 0.035 : 0.025));
      n1.connect(bp).connect(g1).connect(out); n1.start(t);
      if (down) {
        const o = audio.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.06);
        const g2 = audio.createGain(); g2.gain.setValueAtTime(0.35, t + 0.004); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
        o.connect(g2).connect(out); o.start(t); o.stop(t + 0.08);
      }
    } catch (e) { /* sin audio no pasa nada */ }
  }

  // ---- estado de la luz ---------------------------------------------------
  const ripples = [];
  const stamps = [];
  let charge = 0, total = 0, lit = false, typed = '';
  const pressedByPointer = new Map();

  function press(k) {
    if (!k || k.pressed) return;
    k.pressed = true;
    k.flash = 1;
    const now = performance.now();
    if (!reduce) ripples.push({ x: k.cx, z: k.cz, t: now });
    if (ripples.length > 24) ripples.shift();
    stamps.push(now);
    total++;
    charge = Math.min(1, charge + 0.07);
    if (total >= 12 && !lit) {
      lit = true;
      act.classList.add('is-lit');
      ui.status.textContent = 'Encendido.';
    }
    act.classList.add('is-awake');
    click(true);
    wake();
  }
  function release(k) {
    if (!k || !k.pressed) return;
    k.pressed = false;
    click(false);
    wake();
  }
  function write(e) {
    if (e.key === 'Backspace') typed = typed.slice(0, -1);
    else if (e.key === 'Enter') typed = '';
    else if (e.key && [...e.key].length === 1) typed += e.key;
    else return;
    typed = typed.slice(-40);
    ui.typed.textContent = typed || ' ';
  }

  const active = () => { const r = act.getBoundingClientRect(); return r.top < innerHeight * 0.5 && r.bottom > innerHeight * 0.5; };
  const inField = (t) => t && t.closest && t.closest('input, textarea, select, [contenteditable]');
  addEventListener('keydown', (e) => {
    if (!active() || e.repeat || e.ctrlKey || e.metaKey) return;
    const k = board.byCode.get(e.code);
    if (!k) return;
    if (e.code === 'Space' && !inField(e.target) && !(e.target.closest && e.target.closest('button, a'))) e.preventDefault();
    press(k);
    if (!inField(e.target)) write(e);
  });
  addEventListener('keyup', (e) => { const k = board.byCode.get(e.code); if (k) release(k); });
  addEventListener('blur', () => board.keys.forEach((k) => { k.pressed = false; }));

  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObjects(board.caps, false)[0];
    if (!hit) return;
    const k = board.byCode.get(hit.object.userData.code);
    pressedByPointer.set(e.pointerId, k);
    press(k);
    if (k.legend.length === 1) { typed = (typed + k.legend.toLowerCase()).slice(-40); ui.typed.textContent = typed; }
    else if (k.code === 'Space') { typed = (typed + ' ').slice(-40); ui.typed.textContent = typed; }
    else if (k.code === 'Backspace') { typed = typed.slice(0, -1); ui.typed.textContent = typed || ' '; }
  });
  const up = (e) => { const k = pressedByPointer.get(e.pointerId); if (k) { release(k); pressedByPointer.delete(e.pointerId); } };
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);

  // ---- render --------------------------------------------------------------
  let running = false, idleFrames = 0, lastP = -1;
  const isVisible = onScreen(act, (vis) => { if (vis) wake(); });
  function wake() { idleFrames = 0; loop(); }

  function frame(now) {
    const resized = resize();
    const p = reduce ? 1 : actProgress(act);
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;

    // pulsaciones por minuto, medidas sobre los últimos 6 segundos reales
    while (stamps.length && now - stamps[0] > 6000) stamps.shift();
    let ppm = 0;
    if (stamps.length >= 3) {
      const span = Math.max(now - stamps[0], 1500);
      ppm = Math.round((stamps.length - 1) / span * 60000);
    }
    if (ui.ppm.textContent !== String(ppm)) ui.ppm.textContent = String(ppm);
    const speed = Math.min(1, ppm / 420);

    charge = Math.max(lit ? 0.42 : 0, charge - 0.0025);
    const base = Math.max(charge * 0.55, lit ? 0.42 : 0) + speed * 0.3;
    let busy = charge > (lit ? 0.42 : 0) + 0.001 || stamps.length > 0;
    for (let i = ripples.length - 1; i >= 0; i--) if (now - ripples[i].t > 1400) ripples.splice(i, 1);
    board.keys.forEach((k) => {
      k.press += ((k.pressed ? 1 : 0) - k.press) * (reduce ? 1 : 0.5);
      k.flash = Math.max(0, k.flash - 0.035);
      let r = 0;
      for (const R of ripples) {
        const age = (now - R.t) / 1000;
        const dist = Math.hypot(k.cx - R.x, k.cz - R.z);
        const front = age * 520;
        const w = Math.exp(-Math.pow(dist - front, 2) / (2 * 26 * 26)) * Math.max(0, 1 - age / 1.2);
        if (w > r) r = w;
      }
      k.level = Math.min(1, base + r * 0.8 + k.flash * 0.9 + (k.pressed ? 0.35 : 0));
      if (k.press > 0.002 || k.flash > 0) busy = true;
    });
    if (ripples.length) busy = true;
    board.apply();

    const mob = small();
    const arrive = smooth(p / 0.42);
    const el = mix(64, mob ? 40 : 31, arrive) - pointer.y * 1.6;
    const az = mix(0, mob ? 4 : 9, arrive) + pointer.x * 2.5;
    const f = mob ? mix(1.0, 1.38, arrive) : mix(0.5, 0.74, arrive);
    target.set(mob ? -0.14 : 0, 0, mob ? 0.05 : 0);
    const kick = reduce ? 0 : Math.min(1, ripples.reduce((a, R) => Math.max(a, 1 - (now - R.t) / 90), 0)) * 0.006;
    place(cam, target, fitDistance(cam, f) * (1 - kick), el, az);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    cam.setViewOffset(W, H, 0, (mob ? -0.02 : -0.025) * H, W, H);
    renderer.render(scene, cam);

    const avg = board.keys.reduce((a, k) => a + k.level, 0) / board.keys.length;
    ui.room.style.opacity = Math.min(1, avg * 1.4).toFixed(3);
    if (!act.classList.contains('tl-live')) act.classList.add('tl-live');

    const moving = Math.abs(p - lastP) > 0.0002 || Math.abs(pointer.tx - pointer.x) > 0.001 || Math.abs(pointer.ty - pointer.y) > 0.001 || resized;
    lastP = p;
    return busy || moving;
  }
  function loop() {
    if (running) return;
    running = true;
    const tick = (now) => {
      if (!isVisible() || document.hidden) { running = false; return; }
      const busy = frame(now);
      idleFrames = busy ? 0 : idleFrames + 1;
      if (idleFrames > 90) { running = false; return; }   // se duerme; lo despiertan scroll, tecla o puntero
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  addEventListener('scroll', () => { if (isVisible()) wake(); }, { passive: true });
  addEventListener('pointermove', () => { if (isVisible()) wake(); }, { passive: true });
  addEventListener('resize', wake);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  wake();
}
