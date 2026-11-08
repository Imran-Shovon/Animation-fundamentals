/* =========================================================
   part6.js — page framework (same as script.js) + the demos of part6.html
   ========================================================= */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const body = document.body;
  const isPaused = () => body.classList.contains('paused');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const stageOf = el => el.closest('.stage');
  const live = el => { const s = stageOf(el); return !!(s && s._vis) && !isPaused() && !document.hidden; };

  // ==demo:split==
  /* Split text into <span style="--i:n"> per letter (or per word) for staggering */
  $$('[data-split]').forEach(el => {
    const mode = el.dataset.split || 'chars';
    const text = el.textContent.trim();
    const parts = mode === 'words' ? text.split(/\s+/) : [...text];
    el.textContent = '';
    el.setAttribute('aria-label', text);
    parts.forEach((p, i) => {
      const s = document.createElement('span');
      s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--i', i);
      s.textContent = p === ' ' ? ' ' : p;
      el.appendChild(s);
      if (mode === 'words' && i < parts.length - 1) el.appendChild(document.createTextNode(' '));
    });
  });
  // ==/demo==

  /* ---------- Pause / play all motion (+ reduced-motion preference) ---------- */
  const pauseBtn = $('#pauseAll');
  const setPaused = p => {
    body.classList.toggle('paused', p);
    pauseBtn.textContent = p ? '▶ Play all motion' : '⏸ Pause all motion';
    $$('svg').forEach(s => (p ? s.pauseAnimations?.() : s.unpauseAnimations?.())); // SMIL
  };
  pauseBtn.addEventListener('click', () => setPaused(!isPaused()));
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { body.classList.add('reduced'); setPaused(true); }

  /* ---------- PERFORMANCE: only animate demos that are on screen ---------- */
  const stageIO = new IntersectionObserver(entries => entries.forEach(e => {
    e.target._vis = e.isIntersecting;
    e.target.classList.toggle('offscreen', !e.isIntersecting);
  }), { rootMargin: '120px 0px' });
  $$('.stage, .hero').forEach(s => { s.classList.add('offscreen'); stageIO.observe(s); });

  /* ---------- Replay: restart all CSS animations inside a stage ----------
     Adds .rs (animation:none) for one frame, then removes it. No forced layout. */
  const replayHandlers = {};
  function replay(stage) {
    stage.classList.add('rs');
    requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.remove('rs')));
    const h = stage.dataset.jsReplay;
    if (h && replayHandlers[h]) replayHandlers[h]();
  }
  const loopStages = $$('.loop-gallery .stage, .stage[data-loop]');
  setInterval(() => {
    if (isPaused() || document.hidden) return;
    loopStages.forEach(s => { if (s._vis) replay(s); });
  }, 3400);

  /* ---------- Demo footer: Show code / Replay / Copy ---------- */
  $$('.demo').forEach(d => {
    const stage = $('.demo-box > .stage', d);
    $('.replay-btn', d)?.addEventListener('click', () => replay(stage));
    const btn = $('.show-code', d), panel = $('.code-panel', d);
    btn?.addEventListener('click', () => {
      const open = panel.hidden;
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', open);
      btn.textContent = open ? 'Hide code' : 'Show code';
      d.classList.toggle('code-open', open);
    });
  });
  const copyText = txt => {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(txt);
    const ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } finally { ta.remove(); }
    return Promise.resolve();
  };
  $$('.copy-code').forEach(b => b.addEventListener('click', () => {
    copyText(b.closest('.code-block').querySelector('pre').textContent)
      .then(() => { b.textContent = 'Copied ✓'; setTimeout(() => (b.textContent = 'Copy'), 1400); })
      .catch(() => {});
  }));

  /* ---------- Page: reveal on scroll ---------- */
  const revealIO = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); revealIO.unobserve(e.target); }
  }), { threshold: .08 });
  $$('.reveal').forEach(el => revealIO.observe(el));

  /* ---------- Page: progress bar (transform only, once per frame) ---------- */
  const prog = $('#pageProgress');
  let progQueued = false;
  const updateProg = () => {
    progQueued = false;
    const h = document.documentElement;
    prog.style.transform = `scaleX(${h.scrollTop / (h.scrollHeight - h.clientHeight || 1)})`;
  };
  addEventListener('scroll', () => { if (!progQueued) { progQueued = true; requestAnimationFrame(updateProg); } }, { passive: true });
  updateProg();

  /* ---------- Page: active link in the sticky nav ----------
     Scrolls only the nav strip sideways — never the page — so it can't
     interrupt your own scrolling. */
  const tocList = $('.toc ul');
  const links = $$('.toc a');
  const secIO = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    links.forEach(l => {
      const on = l.getAttribute('href') === '#' + e.target.id;
      l.classList.toggle('active', on);
      if (on) tocList.scrollTo({ left: l.offsetLeft - tocList.clientWidth / 2 + l.offsetWidth / 2, behavior: 'smooth' });
    });
  }), { rootMargin: '-45% 0px -50% 0px' });
  $$('main section').forEach(s => secIO.observe(s));

  /* ---------- Shared: canvas + a single animation ticker ---------- */
  // ==demo:gravityStage confettiStage netStage matrix==
  const PALETTE = ['#7c5cff', '#ff5c8a', '#22d3ee', '#fbbf24', '#34d399'];
  const loops = [];
  const addLoop = (el, fn) => loops.push({ el, fn });
  const tickAll = t => {
    loops.forEach(l => { if (live(l.el)) l.fn(t); }); // skip off-screen canvases
    requestAnimationFrame(tickAll);
  };
  requestAnimationFrame(tickAll);
  function setupCanvas(host) {
    const cv = $('canvas', host), ctx = cv.getContext('2d');
    const fit = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = host.clientWidth * dpr; cv.height = host.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit(); addEventListener('resize', fit);
    return { cv, ctx, w: () => host.clientWidth, h: () => host.clientHeight };
  }
  // ==/demo==

  /* ---------- Shared helper ---------- */
  const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  /* Shared by the seven studies. Coordinates stay in a 400 × 240 drawing space.
     setupCanvas, addLoop, live, clamp, PALETTE and replayHandlers are page helpers. */
  const p6Surface = id => {
    const host = $('#' + id);
    const { cv, ctx } = setupCanvas(host);
    const point = e => {
      const r = cv.getBoundingClientRect();
      return { x: clamp((e.clientX - r.left) * 400 / r.width, 0, 400), y: clamp((e.clientY - r.top) * 240 / r.height, 0, 240) };
    };
    const begin = () => {
      ctx.setTransform(cv.width / 400, 0, 0, cv.height / 240, 0, 0);
      ctx.clearRect(0, 0, 400, 240);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };
    const line = (x1, y1, x2, y2, color, width = 2) => {
      ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    };
    const dot = (x, y, radius, color) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    };
    const label = (text, x, y, color = PALETTE[2]) => {
      ctx.fillStyle = color; ctx.font = '12px system-ui'; ctx.fillText(text, x, y);
    };
    return { host, cv, ctx, point, begin, line, dot, label };
  };
  const p6Run = (surface, key, reset, step, draw) => {
    let previous = 0, accumulator = 0;
    const render = () => { surface.begin(); draw(); };
    const replay = () => { previous = 0; accumulator = 0; reset(); render(); };
    replayHandlers[key] = replay;
    replay(); // A useful static first frame is visible even with reduced motion.
    addEventListener('resize', render); // Repaint a resized canvas even while paused.
    addLoop(surface.host, now => {
      const elapsed = previous && now - previous < 150 ? (now - previous) / 1000 : 1 / 60;
      previous = now;
      accumulator = Math.min(accumulator + elapsed, 3 / 60);
      while (accumulator >= 1 / 60) { step(1 / 60); accumulator -= 1 / 60; }
      render();
    });
    return replay;
  };

  // ==demo:p6Pendulum==
  try {
    const s = p6Surface('p6Pendulum');
    const length = 52, gravity = 150;
    let state, trail;
    const reset = () => { state = [2.05, 1.6, 0, 0]; trail = []; };
    // Equal masses and lengths; integrate the coupled equations using RK4.
    const derivative = ([a, b, u, v]) => {
      const d = a - b, denominator = length * (3 - Math.cos(2 * d));
      return [u, v,
        (-3 * gravity * Math.sin(a) - gravity * Math.sin(a - 2 * b) - 2 * Math.sin(d) * length * (v * v + u * u * Math.cos(d))) / denominator,
        2 * Math.sin(d) * (2 * u * u * length + 2 * gravity * Math.cos(a) + v * v * length * Math.cos(d)) / denominator];
    };
    const position = () => {
      const x = 200 + length * Math.sin(state[0]), y = 110 + length * Math.cos(state[0]);
      return [x, y, x + length * Math.sin(state[1]), y + length * Math.cos(state[1])];
    };
    const step = dt => {
      const h = dt / 4;
      for (let n = 0; n < 4; n++) {
        const k1 = derivative(state);
        const k2 = derivative(state.map((v, i) => v + h * k1[i] / 2));
        const k3 = derivative(state.map((v, i) => v + h * k2[i] / 2));
        const k4 = derivative(state.map((v, i) => v + h * k3[i]));
        state = state.map((v, i) => v + h * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6);
      }
      const p = position(); trail.push([p[2], p[3]]); if (trail.length > 280) trail.shift();
    };
    const draw = () => {
      s.ctx.globalAlpha = .45;
      for (let i = 1; i < trail.length; i++) s.line(...trail[i - 1], ...trail[i], PALETTE[1], 1);
      s.ctx.globalAlpha = 1;
      const [x, y, x2, y2] = position();
      s.line(200, 110, x, y, PALETTE[2], 3); s.line(x, y, x2, y2, PALETTE[1], 3);
      s.dot(200, 110, 4, PALETTE[3]); s.dot(x, y, 9, PALETTE[2]); s.dot(x2, y2, 11, PALETTE[1]);
    };
    p6Run(s, 'p6Pendulum', reset, step, draw);
  } catch (err) { console.error('[demo p6Pendulum]', err); }
  // ==/demo==

  // ==demo:p6Arm==
  try {
    const s = p6Surface('p6Arm');
    let target, current, phase, manual;
    const reset = () => { target = { x: 290, y: 100 }; current = { ...target }; phase = 0; manual = false; };
    const aim = e => { if (!live(s.host)) return; target = s.point(e); manual = true; };
    s.cv.addEventListener('pointermove', aim);
    s.cv.addEventListener('pointerdown', aim);
    s.cv.addEventListener('keydown', e => {
      const arrows = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] };
      if (!arrows[e.key]) return;
      e.preventDefault(); if (!live(s.host)) return;
      const [dx, dy] = arrows[e.key]; manual = true;
      target.x = clamp(target.x + dx, 10, 390); target.y = clamp(target.y + dy, 10, 230);
    });
    const step = dt => {
      phase += dt;
      if (!manual) target = { x: 220 + Math.cos(phase * .7) * 95, y: 105 + Math.sin(phase) * 65 };
      current.x += (target.x - current.x) * .12; current.y += (target.y - current.y) * .12;
    };
    const draw = () => {
      const bx = 145, by = 200, a = 92, b = 78;
      const dx = current.x - bx, dy = current.y - by;
      const distance = clamp(Math.hypot(dx, dy), Math.abs(a - b) + .01, a + b - .01);
      const direction = Math.atan2(dy, dx);
      const shoulder = direction - Math.acos(clamp((a * a + distance * distance - b * b) / (2 * a * distance), -1, 1));
      const elbow = { x: bx + a * Math.cos(shoulder), y: by + a * Math.sin(shoulder) };
      const end = { x: bx + distance * Math.cos(direction), y: by + distance * Math.sin(direction) };
      s.line(110, 210, 180, 210, PALETTE[0], 8);
      s.line(bx, by, elbow.x, elbow.y, PALETTE[0], 12);
      s.line(elbow.x, elbow.y, end.x, end.y, PALETTE[2], 9);
      s.dot(bx, by, 8, PALETTE[3]); s.dot(elbow.x, elbow.y, 7, PALETTE[3]); s.dot(end.x, end.y, 6, PALETTE[1]);
      s.line(target.x - 6, target.y, target.x + 6, target.y, PALETTE[1]);
      s.line(target.x, target.y - 6, target.x, target.y + 6, PALETTE[1]);
    };
    const replay = p6Run(s, 'p6Arm', reset, step, draw);
    $('#p6ArmAuto').addEventListener('click', replay);
  } catch (err) { console.error('[demo p6Arm]', err); }
  // ==/demo==

  // ==demo:p6Flock==
  try {
    const s = p6Surface('p6Flock');
    let birds, pointer;
    const reset = () => {
      pointer = null;
      birds = Array.from({ length: 48 }, (_, i) => ({ x: 200 + Math.cos(i * 2.4) * (20 + i * 2), y: 120 + Math.sin(i * 2.4) * (15 + i), vx: Math.cos(i) * 55, vy: Math.sin(i) * 55 }));
    };
    s.cv.addEventListener('pointermove', e => { if (live(s.host)) pointer = s.point(e); });
    s.cv.addEventListener('pointerleave', () => { pointer = null; });
    const step = dt => {
      const forces = birds.map(bird => {
        let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, count = 0;
        for (const other of birds) {
          const dx = bird.x - other.x, dy = bird.y - other.y, d2 = dx * dx + dy * dy;
          if (other === bird || d2 > 65 * 65) continue;
          count++; ax += other.vx; ay += other.vy; cx += other.x; cy += other.y;
          if (d2 < 24 * 24) { sx += dx / Math.max(d2, 1); sy += dy / Math.max(d2, 1); }
        }
        const steer = (x, y) => { const n = Math.hypot(x, y); return n > .001 ? [x / n * 65 - bird.vx, y / n * 65 - bird.vy] : [0, 0]; };
        const separation = steer(sx, sy);
        const cohesion = count ? steer(cx / count - bird.x, cy / count - bird.y) : [0, 0];
        let fx = separation[0] * 1.7 + cohesion[0] * .65 + (count ? (ax / count - bird.vx) * .8 : 0);
        let fy = separation[1] * 1.7 + cohesion[1] * .65 + (count ? (ay / count - bird.vy) * .8 : 0);
        if (pointer) {
          const dx = bird.x - pointer.x, dy = bird.y - pointer.y, d = Math.hypot(dx, dy);
          if (d < 85 && d > .01) { fx += dx / d * 160; fy += dy / d * 160; }
        }
        const limit = Math.max(1, Math.hypot(fx, fy) / 120);
        return [fx / limit, fy / limit];
      });
      birds.forEach((bird, i) => {
        bird.vx += forces[i][0] * dt; bird.vy += forces[i][1] * dt;
        const speed = Math.hypot(bird.vx, bird.vy), scale = speed > .001 ? clamp(speed, 35, 85) / speed : 1;
        bird.vx *= scale; bird.vy *= scale;
        bird.x = (bird.x + bird.vx * dt + 400) % 400; bird.y = (bird.y + bird.vy * dt + 240) % 240;
      });
    };
    const draw = () => birds.forEach((bird, i) => {
      s.ctx.save(); s.ctx.translate(bird.x, bird.y); s.ctx.rotate(Math.atan2(bird.vy, bird.vx));
      s.ctx.fillStyle = PALETTE[i % 3]; s.ctx.beginPath(); s.ctx.moveTo(7, 0); s.ctx.lineTo(-5, -3); s.ctx.lineTo(-3, 0); s.ctx.lineTo(-5, 3); s.ctx.closePath(); s.ctx.fill(); s.ctx.restore();
    });
    const replay = p6Run(s, 'p6Flock', reset, step, draw);
    $('#p6FlockReset').addEventListener('click', replay);
  } catch (err) { console.error('[demo p6Flock]', err); }
  // ==/demo==

  // ==demo:p6Cloth==
  try {
    const s = p6Surface('p6Cloth');
    const columns = 23, rows = 13, spacing = 12;
    let points, links, grabbed, pointer, phase, gust;
    const reset = () => {
      phase = 0; gust = 0; grabbed = null; pointer = null; points = []; links = [];
      for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
        const px = 68 + x * spacing, py = 24 + y * spacing;
        points.push({ x: px, y: py, oldX: px, oldY: py, pinned: y === 0 && x % 2 === 0 });
        const index = y * columns + x;
        if (x) links.push([index - 1, index]);
        if (y) links.push([index - columns, index]);
      }
    };
    s.cv.addEventListener('pointerdown', e => {
      if (!live(s.host)) return;
      const aim = s.point(e);
      const nearest = points.filter(p => !p.pinned).sort((a, b) => Math.hypot(a.x - aim.x, a.y - aim.y) - Math.hypot(b.x - aim.x, b.y - aim.y))[0];
      if (Math.hypot(nearest.x - aim.x, nearest.y - aim.y) > 32) return;
      grabbed = nearest; pointer = aim; s.cv.setPointerCapture(e.pointerId);
    });
    s.cv.addEventListener('pointermove', e => { if (grabbed && live(s.host)) pointer = s.point(e); });
    const release = () => { grabbed = null; pointer = null; };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => s.cv.addEventListener(type, release));
    $('#p6ClothGust').addEventListener('click', () => { if (live(s.host)) gust = 1.1; });
    const step = dt => {
      phase += dt; gust *= .97;
      for (const p of points) {
        if (p.pinned || p === grabbed) continue;
        const vx = (p.x - p.oldX) * .99, vy = (p.y - p.oldY) * .99;
        p.oldX = p.x; p.oldY = p.y;
        p.x += vx + Math.sin(phase * 2 + p.y / 60) * .025 + gust * .32;
        p.y += vy + .14;
      }
      for (let iteration = 0; iteration < 6; iteration++) {
        if (grabbed && pointer) { grabbed.x = pointer.x; grabbed.y = pointer.y; grabbed.oldX = pointer.x; grabbed.oldY = pointer.y; }
        for (const [i, j] of links) {
          const a = points[i], b = points[j], dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy) || .001;
          const fixedA = a.pinned || a === grabbed, fixedB = b.pinned || b === grabbed;
          const weight = (!fixedA ? 1 : 0) + (!fixedB ? 1 : 0);
          if (!weight) continue;
          const correction = (distance - spacing) / distance / weight;
          if (!fixedA) { a.x += dx * correction; a.y += dy * correction; }
          if (!fixedB) { b.x -= dx * correction; b.y -= dy * correction; }
        }
      }
      for (const p of points) if (!p.pinned) { p.x = clamp(p.x, 5, 395); p.y = clamp(p.y, 5, 233); }
    };
    const draw = () => {
      for (const [i, j] of links) s.line(points[i].x, points[i].y, points[j].x, points[j].y, i % columns < 11 ? PALETTE[0] : PALETTE[2], 1);
      for (const p of points) if (p.pinned) s.dot(p.x, p.y, 3, PALETTE[3]);
    };
    p6Run(s, 'p6Cloth', reset, step, draw);
  } catch (err) { console.error('[demo p6Cloth]', err); }
  // ==/demo==

  // ==demo:p6Fluid==
  try {
    const s = p6Surface('p6Fluid');
    const width = 64, height = 40, count = width * height;
    const buffer = document.createElement('canvas'); buffer.width = width; buffer.height = height;
    const pixels = buffer.getContext('2d'), image = pixels.createImageData(width, height);
    let u, v, dye, pressure, divergence, phase, pointer, lastPointer;
    const index = (x, y) => y * width + x;
    const reset = () => {
      u = new Float32Array(count); v = new Float32Array(count); dye = new Float32Array(count);
      pressure = new Float32Array(count); divergence = new Float32Array(count); phase = 0; pointer = null; lastPointer = null;
      for (let y = 28; y < 36; y++) for (let x = 28; x < 36; x++) dye[index(x, y)] = 1;
    };
    const inject = (x, y, fx, fy) => {
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
        const px = Math.round(x) + i, py = Math.round(y) + j;
        if (px < 1 || px >= width - 1 || py < 1 || py >= height - 1) continue;
        const k = index(px, py), weight = Math.exp(-(i * i + j * j) / 4);
        u[k] = clamp(u[k] + fx * weight, -8, 8); v[k] = clamp(v[k] + fy * weight, -8, 8); dye[k] = Math.min(1, dye[k] + .35 * weight);
      }
    };
    s.cv.addEventListener('pointermove', e => {
      if (!live(s.host)) return;
      pointer = s.point(e);
      const dx = lastPointer ? (pointer.x - lastPointer.x) * .08 : 0, dy = lastPointer ? (pointer.y - lastPointer.y) * .08 : -1;
      inject(pointer.x / 400 * width, pointer.y / 240 * height, dx, dy); lastPointer = pointer;
    });
    s.cv.addEventListener('pointerleave', () => { pointer = null; lastPointer = null; });
    $('#p6FluidInk').addEventListener('click', () => { if (live(s.host)) inject(width / 2, height / 2, 2.5, -3); });
    const sample = (field, x, y) => {
      x = clamp(x, .5, width - 1.5); y = clamp(y, .5, height - 1.5);
      const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      return (field[index(ix, iy)] * (1 - fx) + field[index(ix + 1, iy)] * fx) * (1 - fy) + (field[index(ix, iy + 1)] * (1 - fx) + field[index(ix + 1, iy + 1)] * fx) * fy;
    };
    const advect = (field, vx, vy, decay) => {
      const result = new Float32Array(count);
      for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
        const k = index(x, y); result[k] = sample(field, x - vx[k], y - vy[k]) * decay;
      }
      return result;
    };
    const step = dt => {
      phase += dt;
      inject(width / 2 + Math.sin(phase * 1.2) * 8, height - 6, Math.sin(phase * 1.7) * .2, -.38);
      // Semi-Lagrangian transport, followed by a pressure projection.
      const nextU = advect(u, u, v, .992), nextV = advect(v, u, v, .992); u = nextU; v = nextV;
      pressure.fill(0);
      for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
        const k = index(x, y); divergence[k] = -.5 * (u[k + 1] - u[k - 1] + v[k + width] - v[k - width]);
      }
      for (let iteration = 0; iteration < 18; iteration++) {
        for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
          const k = index(x, y); pressure[k] = (divergence[k] + pressure[k - 1] + pressure[k + 1] + pressure[k - width] + pressure[k + width]) / 4;
        }
      }
      for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
        const k = index(x, y); u[k] -= .5 * (pressure[k + 1] - pressure[k - 1]); v[k] -= .5 * (pressure[k + width] - pressure[k - width]);
      }
      dye = advect(dye, u, v, .995);
    };
    const draw = () => {
      for (let k = 0; k < count; k++) {
        const d = clamp(dye[k] * 1.8, 0, 1), offset = k * 4;
        image.data[offset] = 34 + 90 * d; image.data[offset + 1] = 211 - 119 * d; image.data[offset + 2] = 238 + 17 * d; image.data[offset + 3] = d * 255;
      }
      pixels.putImageData(image, 0, 0); s.ctx.imageSmoothingEnabled = true; s.ctx.drawImage(buffer, 0, 0, 400, 240);
    };
    p6Run(s, 'p6Fluid', reset, step, draw);
  } catch (err) { console.error('[demo p6Fluid]', err); }
  // ==/demo==

  // ==demo:p6Reaction==
  try {
    const s = p6Surface('p6Reaction');
    const width = 96, height = 60, count = width * height;
    const buffer = document.createElement('canvas'); buffer.width = width; buffer.height = height;
    const pixels = buffer.getContext('2d'), image = pixels.createImageData(width, height);
    let a, b, nextA, nextB;
    const seed = (cx, cy) => {
      for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
        const px = (Math.round(cx) + x + width) % width, py = (Math.round(cy) + y + height) % height;
        const k = py * width + px; a[k] = .5; b[k] = .9;
      }
    };
    const reset = () => {
      a = new Float32Array(count).fill(1); b = new Float32Array(count);
      nextA = new Float32Array(count); nextB = new Float32Array(count);
      seed(width / 2, height / 2); seed(width / 3, height / 3); seed(width * .7, height * .65);
    };
    s.cv.addEventListener('pointerdown', e => {
      if (!live(s.host)) return;
      const p = s.point(e); seed(p.x / 400 * width, p.y / 240 * height);
    });
    $('#p6ReactionSeed').addEventListener('click', () => { if (live(s.host)) seed(width * .65, height * .3); });
    const laplacian = (field, x, y) => {
      const left = (x + width - 1) % width, right = (x + 1) % width;
      const up = (y + height - 1) % height, down = (y + 1) % height;
      return -field[y * width + x] + .2 * (field[y * width + left] + field[y * width + right] + field[up * width + x] + field[down * width + x]) + .05 * (field[up * width + left] + field[up * width + right] + field[down * width + left] + field[down * width + right]);
    };
    const step = () => {
      // Gray–Scott: A diffuses faster than B, while A + 2B produces more B.
      for (let iteration = 0; iteration < 8; iteration++) {
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const k = y * width + x, reaction = a[k] * b[k] * b[k];
          nextA[k] = clamp(a[k] + laplacian(a, x, y) - reaction + .055 * (1 - a[k]), 0, 1);
          nextB[k] = clamp(b[k] + .5 * laplacian(b, x, y) + reaction - (.055 + .062) * b[k], 0, 1);
        }
        [a, nextA] = [nextA, a]; [b, nextB] = [nextB, b];
      }
    };
    const draw = () => {
      for (let k = 0; k < count; k++) {
        const value = clamp(b[k] * 2.5, 0, 1), offset = k * 4;
        image.data[offset] = 124 + (34 - 124) * value; image.data[offset + 1] = 92 + (211 - 92) * value; image.data[offset + 2] = 255 + (238 - 255) * value; image.data[offset + 3] = 70 + 185 * value;
      }
      pixels.putImageData(image, 0, 0); s.ctx.imageSmoothingEnabled = true; s.ctx.drawImage(buffer, 0, 0, 400, 240);
    };
    p6Run(s, 'p6Reaction', reset, step, draw);
  } catch (err) { console.error('[demo p6Reaction]', err); }
  // ==/demo==

  // ==demo:p6Springs==
  try {
    const s = p6Surface('p6Springs');
    const damping = [.22, 1, 1.8], names = ['Underdamped', 'Critical', 'Overdamped'];
    let time;
    const reset = () => { time = 0; };
    const response = (t, zeta) => {
      const omega = 4;
      if (zeta < 1) {
        const wd = omega * Math.sqrt(1 - zeta * zeta);
        return 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + zeta * omega / wd * Math.sin(wd * t));
      }
      if (zeta === 1) return 1 - Math.exp(-omega * t) * (1 + omega * t);
      const q = Math.sqrt(zeta * zeta - 1), r1 = -omega * (zeta - q), r2 = -omega * (zeta + q);
      return 1 + (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r1 - r2);
    };
    const step = dt => { time = Math.min(time + dt, 7); };
    const draw = () => {
      s.ctx.globalAlpha = .35; s.line(270, 12, 270, 230, PALETTE[3], 1); s.ctx.globalAlpha = 1;
      damping.forEach((zeta, i) => {
        const y = 49 + i * 76, x = 65 + response(time, zeta) * 205;
        s.label(names[i] + ' (ζ=' + zeta + ')', 12, y - 23, PALETTE[i]);
        let previous = [25, y];
        for (let n = 1; n <= 16; n++) {
          const point = [25 + (x - 38) * n / 16, y + (n === 16 ? 0 : (n % 2 ? 7 : -7))];
          s.line(...previous, ...point, PALETTE[i], 1.5); previous = point;
        }
        s.dot(x, y, 11, PALETTE[i]);
      });
    };
    const replay = p6Run(s, 'p6Springs', reset, step, draw);
    $('#p6SpringsRelease').addEventListener('click', replay);
  } catch (err) { console.error('[demo p6Springs]', err); }
  // ==/demo==

})();
