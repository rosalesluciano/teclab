// La marca hecha polvo de taller. Las partículas llegan dispersas, arman la
// palabra TECLAB, se apartan del puntero (o del dedo) y vuelven a su lugar
// exacto. El <p> real queda debajo: con movimiento reducido, sin canvas o
// antes de que esto cargue, se ve la palabra tipográfica tal cual.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountParticles(word) {
  if (reduce) return () => {};
  const canvas = document.createElement('canvas');
  canvas.className = 'hero__dust';
  canvas.setAttribute('aria-hidden', 'true');
  word.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return () => {}; }

  const PAD = 140;                       // margen para que el polvo pueda salir de la palabra
  let W = 0, H = 0, dpr = 1, pts = null, n = 0;
  let ink = '#111213', blue = '#2457ff';
  const pointer = { x: -1e4, y: -1e4, active: false };
  let running = false, asleep = 0, intro = true;

  function sample() {
    const r = word.getBoundingClientRect();
    const cs = getComputedStyle(word);
    ink = cs.getPropertyValue('--sc-ink').trim() || ink;
    W = Math.round(r.width + PAD * 2);
    H = Math.round(r.height + PAD * 2);
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    canvas.style.left = -PAD + 'px';
    canvas.style.top = -PAD + 'px';
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    // rasterizar la palabra con la misma letra, y ajustar el ancho al real
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const o = off.getContext('2d', { willReadFrequently: true });
    const size = parseFloat(cs.fontSize);
    o.font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`;
    try { o.fontStretch = 'expanded'; } catch (e) { /* sin soporte: se corrige con la escala */ }
    try { o.letterSpacing = cs.letterSpacing; } catch (e) { /* idem */ }
    o.textBaseline = 'alphabetic';
    const m = o.measureText(word.textContent.trim());
    const sx = (r.width - parseFloat(cs.paddingRight || 0)) / Math.max(m.width, 1);
    const asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent;
    const lineH = r.height;
    const baseline = PAD + (lineH - (asc + desc)) / 2 + asc;
    o.save();
    o.translate(PAD, 0);
    o.scale(sx, 1);
    o.fillStyle = '#000';
    o.fillText(word.textContent.trim(), 0, baseline);
    o.restore();

    const data = o.getImageData(0, 0, W, H).data;
    const step = innerWidth < 760 ? 3 : Math.max(4, Math.round(r.width / 330));
    const list = [];
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 140) list.push(x, y);
      }
    }
    n = list.length / 2;
    const prev = pts;
    // x, y, vx, vy, homeX, homeY
    pts = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const hx = list[i * 2], hy = list[i * 2 + 1];
      const j = i * 6;
      if (intro && !prev) {
        // llegan desde abajo y los costados, como polvo que se asienta
        pts[j] = hx + (Math.random() - 0.5) * W * 0.9;
        pts[j + 1] = hy + (Math.random() * 0.8 + 0.2) * H * 1.4;
      } else { pts[j] = hx; pts[j + 1] = hy; }
      pts[j + 2] = 0; pts[j + 3] = 0;
      pts[j + 4] = hx; pts[j + 5] = hy;
    }
    canvas.dataset.step = String(step);
    word.classList.add('has-dust');
    wake();
  }

  const R = () => (innerWidth < 760 ? 70 : 120);
  function frame() {
    const step = +canvas.dataset.step;
    const size = Math.max(2, step - 1);
    const rad = R(), rad2 = rad * rad;
    let energy = 0;
    const px = pointer.x, py = pointer.y, on = pointer.active;
    const k = intro ? 0.035 : 0.06, damp = intro ? 0.86 : 0.82;
    for (let i = 0; i < n; i++) {
      const j = i * 6;
      let x = pts[j], y = pts[j + 1], vx = pts[j + 2], vy = pts[j + 3];
      vx += (pts[j + 4] - x) * k;
      vy += (pts[j + 5] - y) * k;
      if (on) {
        const dx = x - px, dy = y - py, d2 = dx * dx + dy * dy;
        if (d2 < rad2 && d2 > 0.01) {
          const d = Math.sqrt(d2), f = (1 - d / rad) * 7.5;
          vx += dx / d * f; vy += dy / d * f;
        }
      }
      vx *= damp; vy *= damp;
      x += vx; y += vy;
      pts[j] = x; pts[j + 1] = y; pts[j + 2] = vx; pts[j + 3] = vy;
      energy += Math.abs(vx) + Math.abs(vy) + Math.abs(pts[j + 4] - x) * 0.05;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // dos pasadas: tinta para lo que está en su lugar, azul switch para lo desplazado
    ctx.fillStyle = ink;
    for (let i = 0; i < n; i++) {
      const j = i * 6;
      const off = Math.abs(pts[j] - pts[j + 4]) + Math.abs(pts[j + 1] - pts[j + 5]);
      if (off < 14 || intro) ctx.fillRect(pts[j], pts[j + 1], size, size);
    }
    if (!intro) {
      ctx.fillStyle = blue;
      for (let i = 0; i < n; i++) {
        const j = i * 6;
        const off = Math.abs(pts[j] - pts[j + 4]) + Math.abs(pts[j + 1] - pts[j + 5]);
        if (off >= 14) ctx.fillRect(pts[j], pts[j + 1], size, size);
      }
    }
    if (intro && energy / Math.max(n, 1) < 0.08) intro = false;
    return energy / Math.max(n, 1) > 0.01 || on;
  }

  function loop() {
    if (running) return;
    running = true;
    const tick = () => {
      if (!pts || document.hidden || !visible) { running = false; return; }
      const busy = frame();
      asleep = busy ? 0 : asleep + 1;
      if (asleep > 30) { running = false; return; }   // asentado: deja de dibujar
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  function wake() { asleep = 0; loop(); }

  let visible = true;
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) wake(); }).observe(word);

  function move(e) {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const inside = x > -40 && y > -40 && x < r.width + 40 && y < r.height + 40;
    pointer.x = x; pointer.y = y;
    if (inside !== pointer.active || inside) { pointer.active = inside; wake(); }
  }
  addEventListener('pointermove', move, { passive: true });
  addEventListener('pointerdown', move, { passive: true });
  const leave = () => { pointer.active = false; wake(); };
  addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') leave(); }, { passive: true });
  addEventListener('pointercancel', leave, { passive: true });
  document.addEventListener('pointerleave', leave);
  addEventListener('blur', leave);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });

  return sample;   // se vuelve a llamar después de cada ajuste de tamaño
}
