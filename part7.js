/* =========================================================
   part7.js — page framework (same as script.js) + the demos of part7.html
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

  /* Shared simulation drawing helpers. Page helpers supply setupCanvas,
     addLoop, live, clamp, PALETTE and replayHandlers. */
  const p7Surface = id => {
    const host = $('#' + id), { cv, ctx } = setupCanvas(host);
    const begin = () => {
      ctx.setTransform(cv.width / 400, 0, 0, cv.height / 240, 0, 0);
      ctx.clearRect(0, 0, 400, 240); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
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
    return { host, cv, ctx, begin, line, dot, label };
  };
  const p7Run = (surface, key, reset, step, draw) => {
    let previous = 0, accumulator = 0;
    const render = () => { surface.begin(); draw(); };
    const replay = () => { previous = 0; accumulator = 0; reset(); render(); };
    replayHandlers[key] = replay; replay();
    addEventListener('resize', render);
    addLoop(surface.host, now => {
      const elapsed = previous && now - previous < 150 ? (now - previous) / 1000 : 1 / 60;
      previous = now; accumulator = Math.min(accumulator + elapsed, 3 / 60);
      while (accumulator >= 1 / 60) { step(1 / 60); accumulator -= 1 / 60; }
      render();
    });
    return replay;
  };
  const p7Random = seed => () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // ==demo:p7Sort==
  try {
    const s = p7Surface('p7Sort'), select = $('#p7SortMode'), status = $('#p7SortStatus');
    let values, frames, cursor, clock, active, comparisons;
    const reset = () => {
      values = Array.from({ length: 20 }, (_, i) => 12 + (i * 37 + 23) % 151);
      const work = [...values]; frames = []; cursor = 0; clock = 0; active = []; comparisons = 0;
      const record = (indices, compare = true) => frames.push({ values: [...work], active: indices, compare });
      const swap = (i, j) => { [work[i], work[j]] = [work[j], work[i]]; record([i, j], false); };
      if (select.value === 'merge') {
        const merge = (lo, hi) => {
          if (hi - lo < 2) return;
          const mid = (lo + hi) >> 1; merge(lo, mid); merge(mid, hi);
          const left = work.slice(lo, mid), right = work.slice(mid, hi); let i = 0, j = 0, k = lo;
          while (i < left.length || j < right.length) {
            const comparing = i < left.length && j < right.length;
            work[k] = j >= right.length || (i < left.length && left[i] <= right[j]) ? left[i++] : right[j++];
            record([k++], comparing);
          }
        };
        merge(0, work.length);
      } else if (select.value === 'quick') {
        const quick = (lo, hi) => {
          if (lo >= hi) return;
          const pivot = work[hi]; let store = lo;
          for (let j = lo; j < hi; j++) { record([j, hi]); if (work[j] < pivot) swap(store++, j); }
          swap(store, hi); quick(lo, store - 1); quick(store + 1, hi);
        };
        quick(0, work.length - 1);
      } else {
        for (let end = work.length - 1; end > 0; end--) {
          let changed = false;
          for (let j = 0; j < end; j++) { record([j, j + 1]); if (work[j] > work[j + 1]) { swap(j, j + 1); changed = true; } }
          if (!changed) break;
        }
      }
      status.textContent = 'Ready — ' + select.options[select.selectedIndex].text;
    };
    const step = dt => {
      clock += dt;
      if (clock < .035 || cursor >= frames.length) return;
      clock = 0; const frame = frames[cursor++]; values = frame.values; active = frame.active;
      if (frame.compare) comparisons++;
      status.textContent = cursor === frames.length ? 'Sorted · ' + comparisons + ' comparisons' : comparisons + ' comparisons';
      if (cursor === frames.length) active = [];
    };
    const draw = () => {
      values.forEach((height, i) => {
        s.ctx.fillStyle = active.includes(i) ? PALETTE[3] : cursor === frames.length ? PALETTE[4] : PALETTE[0];
        s.ctx.fillRect(15 + i * 18.5, 215 - height, 13, height);
      });
      s.line(12, 216, 385, 216, PALETTE[2], 1);
      s.label('Same starting data for every algorithm', 15, 25);
    };
    const replay = p7Run(s, 'p7Sort', reset, step, draw);
    select.addEventListener('change', replay);
  } catch (err) { console.error('[demo p7Sort]', err); }
  // ==/demo==

  // ==demo:p7Path==
  try {
    const s = p7Surface('p7Path'), mode = $('#p7PathMode'), status = $('#p7PathStatus');
    const columns = 25, rows = 13, start = 26, goal = 298;
    const neighbors = i => [i % columns > 0 ? i - 1 : -1, i % columns < columns - 1 ? i + 1 : -1, i - columns, i + columns].filter(j => j >= 0 && j < columns * rows);
    let walls, costs, parent, closed, open, route, reveal, finished, clock;
    const reset = () => {
      walls = new Set();
      for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
        if ((x === 7 && y !== 9) || (x === 15 && y !== 3) || (y === 6 && x > 15 && x !== 21)) walls.add(y * columns + x);
      }
      costs = new Float64Array(columns * rows).fill(Infinity); costs[start] = 0;
      parent = new Int32Array(columns * rows).fill(-1); closed = new Set(); open = new Set([start]);
      route = []; reveal = 0; finished = false; clock = 0; status.textContent = 'Ready to search';
    };
    const heuristic = i => mode.value === 'astar' ? Math.abs(i % columns - goal % columns) + Math.abs(Math.floor(i / columns) - Math.floor(goal / columns)) : 0;
    const step = dt => {
      clock += dt; if (clock < .025) return; clock = 0;
      if (finished) { reveal = Math.min(reveal + 1, route.length); return; }
      if (!open.size) { finished = true; status.textContent = 'No route found'; return; }
      let best = -1;
      for (const i of open) if (best === -1 || costs[i] + heuristic(i) < costs[best] + heuristic(best)) best = i;
      open.delete(best); closed.add(best);
      if (best === goal) {
        for (let i = goal; i !== -1; i = parent[i]) route.unshift(i);
        finished = true; status.textContent = 'Shortest route: ' + (route.length - 1) + ' steps · ' + closed.size + ' visited'; return;
      }
      for (const next of neighbors(best)) {
        if (walls.has(next) || closed.has(next)) continue;
        const candidate = costs[best] + 1;
        if (candidate < costs[next]) { costs[next] = candidate; parent[next] = best; open.add(next); }
      }
      status.textContent = closed.size + ' visited · ' + open.size + ' frontier';
    };
    const draw = () => {
      const shown = new Set(route.slice(0, reveal));
      for (let i = 0; i < columns * rows; i++) {
        s.ctx.fillStyle = walls.has(i) ? PALETTE[0] : shown.has(i) ? PALETTE[3] : closed.has(i) ? PALETTE[2] : open.has(i) ? PALETTE[1] : PALETTE[0];
        s.ctx.globalAlpha = walls.has(i) || shown.has(i) ? 1 : closed.has(i) ? .45 : open.has(i) ? .65 : .09;
        s.ctx.fillRect(13 + (i % columns) * 15, 22 + Math.floor(i / columns) * 15, 13, 13);
      }
      s.ctx.globalAlpha = 1;
      for (const [i, text, color] of [[start, 'S', PALETTE[4]], [goal, 'G', PALETTE[3]]]) {
        const x = 13 + i % columns * 15, y = 22 + Math.floor(i / columns) * 15;
        s.ctx.clearRect(x, y, 13, 13); s.label(text, x + 2, y + 11, color);
      }
    };
    const replay = p7Run(s, 'p7Path', reset, step, draw);
    mode.addEventListener('change', replay);
  } catch (err) { console.error('[demo p7Path]', err); }
  // ==/demo==

  // ==demo:p7Maze==
  try {
    const s = p7Surface('p7Maze'), status = $('#p7MazeStatus');
    const columns = 20, rows = 11, total = columns * rows;
    let walls, seen, stack, random, clock, visited, seed = 47;
    const reset = () => {
      walls = new Uint8Array(total).fill(15); seen = new Uint8Array(total); seen[0] = 1;
      stack = [0]; random = p7Random(seed); clock = 0; visited = 1; status.textContent = '1 / ' + total + ' cells carved';
    };
    const step = dt => {
      clock += dt; if (clock < .025 || !stack.length) return; clock = 0;
      const current = stack[stack.length - 1], x = current % columns, y = Math.floor(current / columns);
      const candidates = [[x, y - 1, 1, 4], [x + 1, y, 2, 8], [x, y + 1, 4, 1], [x - 1, y, 8, 2]]
        .filter(([nx, ny]) => nx >= 0 && nx < columns && ny >= 0 && ny < rows && !seen[ny * columns + nx]);
      if (candidates.length) {
        const [nx, ny, bit, opposite] = candidates[Math.floor(random() * candidates.length)], next = ny * columns + nx;
        walls[current] &= ~bit; walls[next] &= ~opposite; seen[next] = 1; visited++; stack.push(next);
      } else stack.pop();
      status.textContent = stack.length ? visited + ' / ' + total + ' cells carved' : 'Complete · every cell connected · no cycles';
    };
    const draw = () => {
      for (let i = 0; i < total; i++) {
        const x = 20 + i % columns * 18, y = 20 + Math.floor(i / columns) * 18;
        if (seen[i]) { s.ctx.fillStyle = PALETTE[0]; s.ctx.globalAlpha = .17; s.ctx.fillRect(x, y, 18, 18); s.ctx.globalAlpha = 1; }
        if (walls[i] & 1) s.line(x, y, x + 18, y, PALETTE[2], 1);
        if (walls[i] & 2) s.line(x + 18, y, x + 18, y + 18, PALETTE[2], 1);
        if (walls[i] & 4) s.line(x, y + 18, x + 18, y + 18, PALETTE[2], 1);
        if (walls[i] & 8) s.line(x, y, x, y + 18, PALETTE[2], 1);
      }
      if (stack.length) { const i = stack[stack.length - 1]; s.dot(29 + i % columns * 18, 29 + Math.floor(i / columns) * 18, 5, PALETTE[3]); }
    };
    const replay = p7Run(s, 'p7Maze', reset, step, draw);
    $('#p7MazeNew').addEventListener('click', () => { seed++; replay(); });
  } catch (err) { console.error('[demo p7Maze]', err); }
  // ==/demo==

  // ==demo:p7Bodies==
  try {
    const s = p7Surface('p7Bodies');
    let bodies;
    const reset = () => {
      bodies = Array.from({ length: 6 }, (_, i) => {
        const w = 25 + i % 3 * 8, h = 22 + i % 2 * 10, mass = w * h / 700;
        return { x: 55 + i % 3 * 140, y: 35 + Math.floor(i / 3) * 70, vx: i % 2 ? -50 : 60, vy: 0, angle: i * .3, spin: i % 2 ? -1.4 : 1.2, w, h, inverseMass: 1 / mass, inverseInertia: 12 / (mass * (w * w + h * h)) };
      });
    };
    const vertices = b => [[-b.w / 2, -b.h / 2], [b.w / 2, -b.h / 2], [b.w / 2, b.h / 2], [-b.w / 2, b.h / 2]]
      .map(([x, y]) => ({ x: b.x + x * Math.cos(b.angle) - y * Math.sin(b.angle), y: b.y + x * Math.sin(b.angle) + y * Math.cos(b.angle) }));
    const cross = (a, b) => a.x * b.y - a.y * b.x;
    const impulse = (a, b, normal, point) => {
      const ra = { x: point.x - a.x, y: point.y - a.y }, rb = b ? { x: point.x - b.x, y: point.y - b.y } : { x: 0, y: 0 };
      const av = { x: a.vx - a.spin * ra.y, y: a.vy + a.spin * ra.x };
      const bv = b ? { x: b.vx - b.spin * rb.y, y: b.vy + b.spin * rb.x } : { x: 0, y: 0 };
      const speed = (bv.x - av.x) * normal.x + (bv.y - av.y) * normal.y;
      if (speed >= 0) return;
      const denominator = a.inverseMass + (b ? b.inverseMass : 0) + cross(ra, normal) ** 2 * a.inverseInertia + (b ? cross(rb, normal) ** 2 * b.inverseInertia : 0);
      const magnitude = -(1 + .62) * speed / denominator;
      const j = { x: magnitude * normal.x, y: magnitude * normal.y };
      a.vx -= j.x * a.inverseMass; a.vy -= j.y * a.inverseMass; a.spin -= cross(ra, j) * a.inverseInertia;
      if (b) { b.vx += j.x * b.inverseMass; b.vy += j.y * b.inverseMass; b.spin += cross(rb, j) * b.inverseInertia; }
    };
    const collide = (a, b) => {
      const av = vertices(a), bv = vertices(b); let depth = Infinity, normal;
      for (const polygon of [av, bv]) for (let i = 0; i < 2; i++) {
        const dx = polygon[i + 1].x - polygon[i].x, dy = polygon[i + 1].y - polygon[i].y, length = Math.hypot(dx, dy);
        const axis = { x: -dy / length, y: dx / length };
        const pa = av.map(p => p.x * axis.x + p.y * axis.y), pb = bv.map(p => p.x * axis.x + p.y * axis.y);
        const overlap = Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
        if (overlap <= 0) return;
        if (overlap < depth) { depth = overlap; normal = axis; }
      }
      if ((b.x - a.x) * normal.x + (b.y - a.y) * normal.y < 0) { normal.x *= -1; normal.y *= -1; }
      const support = (polygon, sign) => {
        const projection = polygon.map(p => sign * (p.x * normal.x + p.y * normal.y)), maximum = Math.max(...projection);
        const face = polygon.filter((p, i) => maximum - projection[i] < .01);
        return { x: face.reduce((sum, p) => sum + p.x, 0) / face.length, y: face.reduce((sum, p) => sum + p.y, 0) / face.length };
      };
      const p = support(av, 1), q = support(bv, -1);
      impulse(a, b, normal, { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
      const correction = Math.max(depth - .01, 0) * .8 / (a.inverseMass + b.inverseMass);
      a.x -= normal.x * correction * a.inverseMass; a.y -= normal.y * correction * a.inverseMass;
      b.x += normal.x * correction * b.inverseMass; b.y += normal.y * correction * b.inverseMass;
    };
    const boundaries = b => {
      for (const [axis, edge, sign] of [['x', 8, -1], ['x', 392, 1], ['y', 8, -1], ['y', 226, 1]]) {
        const points = vertices(b), extreme = sign < 0 ? Math.min(...points.map(p => p[axis])) : Math.max(...points.map(p => p[axis]));
        const depth = sign * (extreme - edge); if (depth <= 0) continue;
        const contacts = points.filter(p => Math.abs(p[axis] - extreme) < .05);
        const point = { x: contacts.reduce((v, p) => v + p.x, 0) / contacts.length, y: contacts.reduce((v, p) => v + p.y, 0) / contacts.length };
        const normal = axis === 'x' ? { x: sign, y: 0 } : { x: 0, y: sign };
        impulse(b, null, normal, point); b[axis] -= sign * depth;
      }
    };
    const step = dt => {
      const h = dt / 4;
      for (let substep = 0; substep < 4; substep++) {
        for (const b of bodies) { b.vy += 170 * h; b.x += b.vx * h; b.y += b.vy * h; b.angle += b.spin * h; b.vx *= .999; b.spin *= .999; }
        for (let iteration = 0; iteration < 3; iteration++) {
          for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) collide(bodies[i], bodies[j]);
          for (const b of bodies) boundaries(b);
        }
      }
    };
    const draw = () => {
      s.line(8, 228, 392, 228, PALETTE[2], 2);
      bodies.forEach((b, i) => {
        s.ctx.save(); s.ctx.translate(b.x, b.y); s.ctx.rotate(b.angle);
        s.ctx.globalAlpha = .7; s.ctx.fillStyle = PALETTE[i % 5]; s.ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); s.ctx.globalAlpha = 1;
        s.line(-b.w / 4, 0, b.w / 4, 0, PALETTE[3], 2); s.ctx.restore();
      });
    };
    const replay = p7Run(s, 'p7Bodies', reset, step, draw);
    $('#p7BodiesDrop').addEventListener('click', replay);
  } catch (err) { console.error('[demo p7Bodies]', err); }
  // ==/demo==

  // ==demo:p7Skin==
  try {
    const s = p7Surface('p7Skin'), toggle = $('#p7SkinBones');
    const segment = 75;
    let time, showBones = true;
    const reset = () => { time = 0; };
    const bones = () => {
      const rotations = [Math.sin(time * 1.3) * .15, Math.sin(time * 1.3 - .7) * .3, Math.sin(time * 1.3 - 1.4) * .25];
      const result = []; let x = 88, y = 120, angle = 0;
      for (const rotation of rotations) { angle += rotation; result.push({ x, y, angle }); x += Math.cos(angle) * segment; y += Math.sin(angle) * segment; }
      return result;
    };
    const deform = (x, y, transforms) => {
      // Blend two neighboring bone transforms, each multiplied by inverse bind pose.
      const coordinate = clamp(x / segment - .5, 0, 2), first = Math.floor(coordinate), second = Math.min(first + 1, 2), weight = coordinate - first;
      const transform = index => {
        const b = transforms[index], localX = x - index * segment;
        return { x: b.x + Math.cos(b.angle) * localX - Math.sin(b.angle) * y, y: b.y + Math.sin(b.angle) * localX + Math.cos(b.angle) * y };
      };
      const a = transform(first), b = transform(second);
      return { x: a.x * (1 - weight) + b.x * weight, y: a.y * (1 - weight) + b.y * weight };
    };
    const step = dt => { time += dt; };
    const draw = () => {
      const transforms = bones(), rows = [-15, -5, 5, 15];
      for (let column = 0; column < 30; column++) for (let row = 0; row < rows.length - 1; row++) {
        const x = column * 7.5, points = [deform(x, rows[row], transforms), deform(x + 7.5, rows[row], transforms), deform(x + 7.5, rows[row + 1], transforms), deform(x, rows[row + 1], transforms)];
        s.ctx.fillStyle = PALETTE[column < 10 ? 0 : column < 20 ? 1 : 2]; s.ctx.globalAlpha = .6;
        s.ctx.beginPath(); points.forEach((p, i) => i ? s.ctx.lineTo(p.x, p.y) : s.ctx.moveTo(p.x, p.y)); s.ctx.closePath(); s.ctx.fill();
        s.ctx.globalAlpha = 1; s.ctx.strokeStyle = PALETTE[2]; s.ctx.lineWidth = .5; s.ctx.stroke();
      }
      if (showBones) for (const b of transforms) {
        s.line(b.x, b.y, b.x + Math.cos(b.angle) * segment, b.y + Math.sin(b.angle) * segment, PALETTE[3], 3); s.dot(b.x, b.y, 4, PALETTE[3]);
      }
      s.label('Vertex colors show influence regions', 15, 25);
    };
    p7Run(s, 'p7Skin', reset, step, draw);
    toggle.addEventListener('click', () => { showBones = !showBones; toggle.setAttribute('aria-pressed', showBones); toggle.textContent = showBones ? 'Hide bones' : 'Show bones'; s.begin(); draw(); });
  } catch (err) { console.error('[demo p7Skin]', err); }
  // ==/demo==

  // ==demo:p7WebGL==
  try {
    const host = $('#p7WebGL'), status = $('#p7WebGLStatus');
    let cv = $('canvas', host), gl, ctx, program, buffer, timeLocation, positionLocation, count, time = 0, previous = 0, lost = false;
    const vertexSource = `
      attribute vec2 aPosition;
      uniform float uTime;
      varying float vHeight;
      void main() {
        float x = aPosition.x, z = aPosition.y;
        float height = sin(x * 5.0 + uTime * 1.6) * cos(z * 4.0 - uTime) * 0.18;
        vHeight = height;
        gl_Position = vec4((x - z) * 0.48, (x + z) * 0.22 + height, (x + z) * 0.1, 1.0);
      }`;
    const fragmentSource = `
      precision mediump float;
      varying float vHeight;
      void main() {
        vec3 violet = vec3(124.0, 92.0, 255.0) / 255.0;
        vec3 cyan = vec3(34.0, 211.0, 238.0) / 255.0;
        gl_FragColor = vec4(mix(violet, cyan, clamp(vHeight * 2.5 + 0.5, 0.0, 1.0)), 1.0);
      }`;
    const geometry = [];
    for (let y = 0; y <= 36; y++) for (let x = 0; x <= 36; x++) {
      const px = x / 18 - 1, py = y / 18 - 1;
      if (x < 36) geometry.push(px, py, px + 1 / 18, py);
      if (y < 36) geometry.push(px, py, px, py + 1 / 18);
    }
    const fallback = () => {
      // A canvas cannot switch context types; replace it before requesting 2D.
      const replacement = cv.cloneNode(true); cv.replaceWith(replacement); cv = replacement; gl = null;
      ctx = cv.getContext('2d'); status.textContent = 'Canvas fallback — WebGL unavailable';
    };
    const initialize = () => {
      gl = cv.getContext('webgl', { alpha: true, antialias: true, preserveDrawingBuffer: true });
      if (!gl) { fallback(); return; }
      const shader = (type, source) => {
        const result = gl.createShader(type); gl.shaderSource(result, source); gl.compileShader(result);
        if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) { const message = gl.getShaderInfoLog(result); gl.deleteShader(result); throw new Error(message); }
        return result;
      };
      const graphics = gl;
      let vertex, fragment;
      try {
        vertex = shader(gl.VERTEX_SHADER, vertexSource); fragment = shader(gl.FRAGMENT_SHADER, fragmentSource);
        program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
        gl.useProgram(program); buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry), gl.STATIC_DRAW); count = geometry.length / 2;
        positionLocation = gl.getAttribLocation(program, 'aPosition'); timeLocation = gl.getUniformLocation(program, 'uTime');
        gl.enableVertexAttribArray(positionLocation); gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        status.textContent = 'WebGL vertex shader · ' + count + ' line vertices';
      } catch (error) {
        if (buffer) gl.deleteBuffer(buffer); if (program) gl.deleteProgram(program);
        fallback();
      } finally { if (vertex) graphics.deleteShader(vertex); if (fragment) graphics.deleteShader(fragment); }
    };
    const draw = () => {
      if (lost) return;
      if (gl) {
        gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program); gl.uniform1f(timeLocation, time); gl.drawArrays(gl.LINES, 0, count);
      } else if (ctx) {
        ctx.setTransform(cv.width / 400, 0, 0, cv.height / 240, 0, 0); ctx.clearRect(0, 0, 400, 240);
        ctx.strokeStyle = PALETTE[2]; ctx.lineWidth = .8;
        const project = (x, z) => {
          const height = Math.sin(x * 5 + time * 1.6) * Math.cos(z * 4 - time) * .18;
          return [200 + (x - z) * 96, 120 - ((x + z) * .22 + height) * 120];
        };
        ctx.beginPath();
        for (let i = 0; i < geometry.length; i += 4) { ctx.moveTo(...project(geometry[i], geometry[i + 1])); ctx.lineTo(...project(geometry[i + 2], geometry[i + 3])); }
        ctx.stroke();
      }
    };
    const fit = () => { const dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.max(1, Math.round(host.clientWidth * dpr)); cv.height = Math.max(1, Math.round(host.clientHeight * dpr)); draw(); };
    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; previous = 0; status.textContent = 'Graphics context lost — waiting to restore'; });
    cv.addEventListener('webglcontextrestored', () => { lost = false; initialize(); fit(); });
    initialize(); fit(); addEventListener('resize', fit);
    replayHandlers.p7WebGL = () => { time = 0; previous = 0; draw(); };
    addLoop(host, now => {
      if (lost) return;
      time += previous && now - previous < 150 ? Math.min((now - previous) / 1000, .05) : 1 / 60;
      previous = now; draw();
    });
  } catch (err) { console.error('[demo p7WebGL]', err); }
  // ==/demo==

})();
