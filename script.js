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

  // ==demo:tiltCard==
  {
    const tilt = $('#tiltCard'), zone = tilt.parentElement;
    zone.addEventListener('pointermove', e => {
      const r = tilt.getBoundingClientRect();
      const x = clamp((e.clientX - r.left) / r.width - .5, -.5, .5);
      const y = clamp((e.clientY - r.top) / r.height - .5, -.5, .5);
      tilt.style.setProperty('--ry', x * 26 + 'deg');
      tilt.style.setProperty('--rx', -y * 26 + 'deg');
      tilt.style.setProperty('--gx', (x + .5) * 100 + '%');
      tilt.style.setProperty('--gy', (y + .5) * 100 + '%');
      tilt.style.setProperty('--glare', 1);
      tilt.style.setProperty('--s', 1.04);
    });
    zone.addEventListener('pointerleave', () => {
      tilt.style.setProperty('--rx', '0deg'); tilt.style.setProperty('--ry', '0deg');
      tilt.style.setProperty('--glare', 0); tilt.style.setProperty('--s', 1);
    });
  }
  // ==/demo==

  // ==demo:magBtn==
  {
    const mag = $('#magBtn'), zone = $('#magZone').parentElement;
    zone.addEventListener('pointermove', e => {
      const r = mag.getBoundingClientRect();
      mag.style.setProperty('--mx', (e.clientX - (r.left + r.width / 2)) * .35 + 'px');
      mag.style.setProperty('--my', (e.clientY - (r.top + r.height / 2)) * .35 + 'px');
    });
    zone.addEventListener('pointerleave', () => { mag.style.setProperty('--mx', 0); mag.style.setProperty('--my', 0); });
  }
  // ==/demo==

  // ==demo:spot==
  {
    const spot = $('#spot');
    spot.addEventListener('pointermove', e => {
      const r = spot.getBoundingClientRect();
      spot.style.setProperty('--x', e.clientX - r.left + 'px');
      spot.style.setProperty('--y', e.clientY - r.top + 'px');
    });
  }
  // ==/demo==

  // ==demo:cursorZone==
  {
    const cz = $('#cursorZone'), fol = $('.follower', cz), cdot = $('.cursor-dot', cz);
    let mx = 150, my = 125, fx = mx, fy = my, raf = 0;
    const place = () => { fol.style.transform = `translate(${fx}px, ${fy}px)`; cdot.style.transform = `translate(${mx}px, ${my}px)`; };
    const loop = () => { fx += (mx - fx) * .15; fy += (my - fy) * .15; place(); raf = requestAnimationFrame(loop); };
    requestAnimationFrame(() => { mx = fx = cz.clientWidth / 2 - 60; my = fy = cz.clientHeight / 2 - 50; place(); });
    cz.addEventListener('pointermove', e => { const r = cz.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
    cz.addEventListener('pointerenter', () => { cancelAnimationFrame(raf); loop(); });
    cz.addEventListener('pointerleave', () => cancelAnimationFrame(raf));
    const tgt = $('.target', cz);
    tgt.addEventListener('pointerenter', () => cz.classList.add('hovering'));
    tgt.addEventListener('pointerleave', () => cz.classList.remove('hovering'));
  }
  // ==/demo==

  // ==demo:glowGrid==
  {
    const grid = $('#glowGrid');
    grid.parentElement.addEventListener('pointermove', e => {
      $$('.glow-card', grid).forEach(c => {
        const r = c.getBoundingClientRect();
        c.style.setProperty('--x', e.clientX - r.left + 'px');
        c.style.setProperty('--y', e.clientY - r.top + 'px');
      });
    });
  }
  // ==/demo==

  // ==demo:trailZone==
  {
    const tz = $('#trailZone'), msg = $('.msg', tz), dots = [];
    for (let i = 0; i < 14; i++) {
      const el = document.createElement('i');
      el.style.setProperty('--s', 18 - i + 'px');
      el.style.setProperty('--h', 260 - i * 12);
      el.style.transform = 'translate(-50px,-50px)';
      tz.appendChild(el); dots.push({ el, x: -50, y: -50 });
    }
    const m = { x: -50, y: -50 }; let raf = 0;
    const loop = () => {
      dots.forEach((d, i) => {
        const t = i ? dots[i - 1] : m;
        d.x += (t.x - d.x) * .35; d.y += (t.y - d.y) * .35;
        d.el.style.transform = `translate(${d.x}px, ${d.y}px)`;
      });
      raf = requestAnimationFrame(loop);
    };
    const pos = e => { const r = tz.getBoundingClientRect(); m.x = e.clientX - r.left; m.y = e.clientY - r.top; };
    tz.addEventListener('pointermove', pos);
    tz.addEventListener('pointerenter', e => { pos(e); dots.forEach(d => { d.x = m.x; d.y = m.y; }); msg.style.opacity = 0; cancelAnimationFrame(raf); loop(); });
    tz.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); msg.style.opacity = 1; dots.forEach(d => (d.el.style.transform = 'translate(-50px,-50px)')); });
  }
  // ==/demo==

  // ==demo:scramble==
  {
    const scr = $('#scramble');
    const phrases = ['ACCESS GRANTED', 'DECODING DATA', 'HELLO, WORLD', 'MOTION ONLINE'];
    const glyphs = '!<>-_/[]{}=+*^?#ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let pi = 0;
    const scramble = to => {
      const from = scr.textContent, len = Math.max(from.length, to.length), q = [];
      for (let i = 0; i < len; i++) {
        const start = Math.floor(Math.random() * 18), end = start + 6 + Math.floor(Math.random() * 18);
        q.push({ from: from[i] || '', to: to[i] || '', start, end });
      }
      let frame = 0;
      const tick = () => {
        let out = '', done = 0;
        q.forEach(c => {
          if (frame >= c.end) { done++; out += c.to; }
          else if (frame >= c.start) out += c.to === ' ' ? ' ' : glyphs[Math.floor(Math.random() * glyphs.length)];
          else out += c.from;
        });
        scr.textContent = out;
        if (done < q.length) { frame++; requestAnimationFrame(tick); }
      };
      tick();
    };
    setInterval(() => { if (!live(scr)) return; pi = (pi + 1) % phrases.length; scramble(phrases[pi]); }, 3000);
  }
  // ==/demo==

  // ==demo:srBox==
  {
    const box = $('#srBox');
    const io = new IntersectionObserver(entries => entries.forEach(e => e.target.classList.toggle('in', e.isIntersecting)), { root: box, threshold: .25 });
    $$('.sr-item', box).forEach(el => io.observe(el));
  }
  // ==/demo==

  // ==demo:pxBox==
  {
    const box = $('#pxBox'), layers = $$('[data-speed]', box);
    box.addEventListener('scroll', () => {
      const y = box.scrollTop;
      layers.forEach(l => (l.style.transform = `translateY(${y * parseFloat(l.dataset.speed)}px)`));
    }, { passive: true });
  }
  // ==/demo==

  // ==demo:shBox==
  {
    const box = $('#shBox');
    box.addEventListener('scroll', () => box.classList.toggle('scrolled', box.scrollTop > 10), { passive: true });
  }
  // ==/demo==

  // ==demo:hsBox==
  {
    const box = $('#hsBox'), track = $('#hsTrack');
    box.addEventListener('scroll', () => {
      const p = box.scrollTop / (box.scrollHeight - box.clientHeight);
      track.style.transform = `translateX(${-p * (track.scrollWidth - box.clientWidth)}px)`;
    }, { passive: true });
  }
  // ==/demo==

  // ==demo:hideBox==
  {
    const box = $('#hideBox'), head = $('#hideHead');
    let lastY = 0;
    box.addEventListener('scroll', () => {
      const y = box.scrollTop;
      head.classList.toggle('hidden', y > lastY && y > 50);
      lastY = y;
    }, { passive: true });
  }
  // ==/demo==

  // ==demo:thBox==
  {
    const box = $('#thBox'), text = $('#thText');
    text.innerHTML = text.textContent.trim().split(/\s+/).map(w => `<span>${w}</span>`).join(' ');
    const words = $$('span', text);
    box.addEventListener('scroll', () => {
      const p = box.scrollTop / (box.scrollHeight - box.clientHeight);
      const n = Math.round(p * words.length * 1.1);
      words.forEach((w, i) => w.classList.toggle('on', i < n));
    }, { passive: true });
  }
  // ==/demo==

  // ==demo:zoomBox==
  {
    const box = $('#zoomBox'), pane = $('#zoomPane');
    box.addEventListener('scroll', () => {
      const p = Math.min(1, box.scrollTop / ((box.scrollHeight - box.clientHeight) * .8));
      pane.style.setProperty('--sc', .5 + p * .5);
      pane.style.setProperty('--br', 30 * (1 - p) + 'px');
      pane.style.setProperty('--op', p > .9 ? 1 : 0);
    }, { passive: true });
  }
  // ==/demo==

  /* ---------- Micro-interactions ---------- */
  const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  // ==demo:likeBtn==
  {
    let likes = 127;
    const btn = $('#likeBtn');
    btn.addEventListener('click', () => {
      const on = btn.classList.toggle('liked');
      likes += on ? 1 : -1;
      $('#likeCount').textContent = likes + ' likes';
    });
  }
  // ==/demo==

  // ==demo:rippleBtn==
  $('#rippleBtn').addEventListener('pointerdown', e => {
    const btn = e.currentTarget, r = btn.getBoundingClientRect(), size = Math.max(r.width, r.height);
    const s = document.createElement('span');
    s.className = 'rp';
    s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    btn.appendChild(s);
    s.addEventListener('animationend', () => s.remove());
  });
  // ==/demo==

  // ==demo:burger==
  { const b = $('#burger'); b.addEventListener('click', () => b.setAttribute('aria-expanded', b.classList.toggle('open'))); }
  // ==/demo==

  // ==demo:copyBtn==
  {
    const btn = $('#copyBtn');
    btn.addEventListener('click', () => {
      copyText('npm i motion').catch(() => {});
      btn.classList.add('copied');
      clearTimeout(btn._t);
      btn._t = setTimeout(() => btn.classList.remove('copied'), 1600);
    });
  }
  // ==/demo==

  // ==demo:tabs==
  {
    const tabs = $('#tabs'), ind = $('.ind', tabs);
    const move = b => { ind.style.width = b.offsetWidth + 'px'; ind.style.transform = `translateX(${b.offsetLeft}px)`; };
    $$('button', tabs).forEach(b => b.addEventListener('click', () => {
      $$('button', tabs).forEach(x => x.classList.toggle('on', x === b)); move(b);
    }));
    const init = () => move($('button.on', tabs));
    init(); addEventListener('resize', init); document.fonts?.ready.then(init);
  }
  // ==/demo==

  // ==demo:acc==
  $$('#acc .acc-item > button').forEach(b => b.addEventListener('click', () => {
    const item = b.parentElement, open = !item.classList.contains('open');
    $$('#acc .acc-item').forEach(i => i.classList.remove('open'));
    item.classList.toggle('open', open);
  }));
  // ==/demo==

  // ==demo:stars==
  $$('#stars button').forEach(b => b.addEventListener('click', () => {
    $$('#stars button').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); restart(b, 'pop');
  }));
  // ==/demo==

  // ==demo:addBtn==
  {
    let count = 0;
    $('#addBtn').addEventListener('click', () => {
      const badge = $('#badge');
      badge.textContent = ++count;
      restart(badge, 'bump'); restart($('#cart'), 'wiggle');
    });
  }
  // ==/demo==

  // ==demo:themeBtn==
  $('#themeBtn').addEventListener('click', () => $('#themeStage').classList.toggle('light'));
  // ==/demo==

  // ==demo:pw==
  {
    const pw = $('#pw'), input = $('input', pw);
    $('button', pw).addEventListener('click', () => {
      const shown = pw.classList.toggle('shown');
      input.type = shown ? 'text' : 'password';
    });
  }
  // ==/demo==

  // ==demo:dlBtn==
  {
    const btn = $('#dlBtn'); let busy = false;
    btn.addEventListener('click', () => {
      if (busy) return;
      if (btn.classList.contains('done')) { btn.classList.remove('done'); btn.textContent = 'Download'; btn.style.setProperty('--p', 0); return; }
      busy = true;
      const t0 = performance.now();
      const step = now => {
        const p = Math.min(1, (now - t0) / 2200), e = 1 - Math.pow(1 - p, 2);
        btn.style.setProperty('--p', e);
        btn.textContent = `Downloading… ${Math.round(e * 100)}%`;
        if (p < 1) requestAnimationFrame(step);
        else { btn.classList.add('done'); btn.textContent = 'Done ✓'; busy = false; }
      };
      requestAnimationFrame(step);
    });
  }
  // ==/demo==

  // ==demo:sendBtn==
  {
    const btn = $('#sendBtn'), label = $('span', btn);
    btn.addEventListener('click', () => {
      restart(btn, 'go');
      label.textContent = 'Sending…';
      clearTimeout(btn._t1); clearTimeout(btn._t2);
      btn._t1 = setTimeout(() => (label.textContent = 'Sent!'), 750);
      btn._t2 = setTimeout(() => { label.textContent = 'Send'; btn.classList.remove('go'); }, 2200);
    });
  }
  // ==/demo==

  // ==demo:trashDemo==
  { const t = $('#trashDemo'); t.addEventListener('click', () => restart(t, 'go')); }
  // ==/demo==

  // ==demo:ppBtn==
  {
    const pp = $('#ppBtn');
    pp.addEventListener('click', () => pp.setAttribute('aria-label', pp.classList.toggle('playing') ? 'Pause' : 'Play'));
  }
  // ==/demo==

  /* ---------- UI transitions ---------- */
  // ==demo:modalDemo==
  {
    const demo = $('#modalDemo');
    $('[data-open]', demo).addEventListener('click', () => demo.classList.add('open'));
    $('[data-close]', demo).addEventListener('click', () => demo.classList.remove('open'));
    $('.modal-backdrop', demo).addEventListener('click', e => { if (e.target === e.currentTarget) demo.classList.remove('open'); });
  }
  // ==/demo==

  // ==demo:toastBtn==
  {
    const msgs = ['File uploaded', 'Changes saved', 'Link copied', 'Invite sent'];
    let n = 0;
    $('#toastBtn').addEventListener('click', () => {
      const wrap = $('#toasts');
      if (wrap.children.length >= 3) wrap.firstElementChild.remove();
      const t = document.createElement('div');
      t.className = 'toast'; t.textContent = '✓ ' + msgs[n++ % msgs.length];
      wrap.appendChild(t);
      setTimeout(() => { t.classList.add('out'); t.addEventListener('animationend', () => t.remove()); }, 2400);
    });
  }
  // ==/demo==

  // ==demo:drawerDemo==
  {
    const demo = $('#drawerDemo');
    $('#drawerBtn').addEventListener('click', e => { e.stopPropagation(); demo.classList.toggle('open'); });
    demo.addEventListener('click', e => { if (!e.target.closest('.drawer')) demo.classList.remove('open'); });
  }
  // ==/demo==

  // ==demo:dd==
  {
    const dd = $('#dd');
    $('.ui-btn', dd).addEventListener('click', e => { e.stopPropagation(); dd.classList.toggle('open'); });
    document.addEventListener('click', e => { if (!dd.contains(e.target)) dd.classList.remove('open'); });
  }
  // ==/demo==

  // ==demo:vtGrid==
  {
    const grid = $('#vtGrid');
    const shuffle = () => {
      const items = [...grid.children];
      for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
      items.forEach(it => grid.appendChild(it));
    };
    $('#vtBtn').addEventListener('click', () => {
      if (document.startViewTransition) { document.startViewTransition(shuffle); return; }
      // FLIP fallback: First, Last, Invert, Play
      const first = new Map([...grid.children].map(el => [el, el.getBoundingClientRect()]));
      shuffle();
      [...grid.children].forEach(el => {
        const a = first.get(el), b = el.getBoundingClientRect();
        el.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: 'none' }],
          { duration: 550, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      });
    });
  }
  // ==/demo==

  // ==demo:search==
  {
    const s = $('#search'), input = $('input', s);
    $('button', s).addEventListener('click', () => { if (s.classList.toggle('open')) setTimeout(() => input.focus({ preventScroll: true }), 300); });
  }
  // ==/demo==

  // ==demo:stepper==
  {
    const st = $('#stepper'), steps = $$('.step', st), lines = $$('.step-line', st);
    let cur = 0;
    const render = () => {
      steps.forEach((s, i) => { s.classList.toggle('done', i < cur); s.classList.toggle('current', i === cur); s.textContent = i < cur ? '✓' : i + 1; });
      lines.forEach((l, i) => l.classList.toggle('fill', i < cur));
    };
    $('[data-next]', st).addEventListener('click', () => { if (cur < steps.length) { cur++; render(); } });
    $('[data-back]', st).addEventListener('click', () => { if (cur > 0) { cur--; render(); } });
  }
  // ==/demo==

  // ==demo:sheetDemo==
  {
    const d = $('#sheetDemo');
    $('[data-open]', d).addEventListener('click', () => d.classList.add('open'));
    $('.sheet-scrim', d).addEventListener('click', () => d.classList.remove('open'));
    $$('.sheet p', d).forEach(p => p.addEventListener('click', () => d.classList.remove('open')));
  }
  // ==/demo==

  // ==demo:skCard==
  {
    const card = $('#skCard');
    $('#skBtn').addEventListener('click', () => {
      card.classList.add('loading');
      setTimeout(() => { card.classList.remove('loading'); replay(card); }, 1400);
    });
  }
  // ==/demo==

  /* ---------- Image & media ---------- */
  // ==demo:baSlider==
  {
    const ba = $('#baSlider'), input = $('input', ba);
    input.addEventListener('input', () => { ba.classList.remove('auto'); ba.style.setProperty('--pos', input.value + '%'); });
  }
  // ==/demo==

  // ==demo:hrList==
  {
    const list = $('#hrList'), prev = $('#hrPreview'), zone = list.parentElement;
    const p = { x: 0, y: 0, tx: 0, ty: 0, s: 0, ts: 0 };
    let raf = 0;
    const loop = () => {
      const vx = p.tx - p.x;
      p.x += vx * .18; p.y += (p.ty - p.y) * .18; p.s += (p.ts - p.s) * .2;
      prev.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${clamp(vx * .3, -15, 15)}deg) scale(${p.s})`;
      raf = (Math.abs(p.ts - p.s) > .002 || Math.abs(vx) > .2) ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    zone.addEventListener('pointermove', e => {
      const r = zone.getBoundingClientRect();
      p.tx = e.clientX - r.left; p.ty = e.clientY - r.top;
      if (p.s < .01) { p.x = p.tx; p.y = p.ty; }
      kick();
    });
    $$('li', list).forEach(li => li.addEventListener('pointerenter', () => { prev.style.background = li.dataset.c; p.ts = 1; kick(); }));
    list.addEventListener('pointerleave', () => { p.ts = 0; kick(); });
  }
  // ==/demo==

  // ==demo:holo==
  {
    const holo = $('#holo'), zone = holo.parentElement;
    zone.addEventListener('pointermove', e => {
      const r = holo.getBoundingClientRect();
      const x = clamp((e.clientX - r.left) / r.width, 0, 1), y = clamp((e.clientY - r.top) / r.height, 0, 1);
      holo.classList.remove('auto');
      holo.style.setProperty('--ry', (x - .5) * 30 + 'deg');
      holo.style.setProperty('--rx', (.5 - y) * 30 + 'deg');
      holo.style.setProperty('--hx', x * 100 + '%');
      holo.style.setProperty('--hy', y * 100 + '%');
    });
    zone.addEventListener('pointerleave', () => {
      holo.classList.add('auto');
      holo.style.setProperty('--rx', '0deg'); holo.style.setProperty('--ry', '0deg');
    });
  }
  // ==/demo==

  /* ---------- Data viz ---------- */
  // ==demo:odo==
  {
    const odo = $('#odo');
    const fmt = n => n.toLocaleString('en-US');
    let val = 48213;
    const build = str => {
      odo.innerHTML = '';
      [...str].forEach((ch, i) => {
        if (/\d/.test(ch)) {
          const col = document.createElement('span');
          col.className = 'col'; col.style.setProperty('--i', i);
          col.innerHTML = [...'0123456789'].map(d => `<span>${d}</span>`).join('');
          odo.appendChild(col);
        } else {
          const s = document.createElement('span'); s.className = 'sep'; s.textContent = ch; odo.appendChild(s);
        }
      });
    };
    const set = n => {
      const str = fmt(n);
      if (odo.children.length !== str.length) build(str);
      [...str].forEach((ch, i) => { const c = odo.children[i]; if (c.classList.contains('col')) c.style.transform = `translateY(${-ch}em)`; });
    };
    build(fmt(val)); requestAnimationFrame(() => set(val));
    setInterval(() => {
      if (!live(odo)) return;
      val += Math.floor(Math.random() * 900) + 37;
      if (val > 99999) val = 10000;
      set(val);
    }, 2600);
  }
  // ==/demo==

  // ==demo:kpiStage==
  {
    const money = $('#kpiMoney'); let raf = 0;
    const countUp = () => {
      cancelAnimationFrame(raf);
      const t0 = performance.now();
      const tick = now => {
        const p = Math.min(1, (now - t0) / 1600), e = 1 - Math.pow(1 - p, 4); // ease-out
        money.textContent = '$' + Math.round(48250 * e).toLocaleString('en-US');
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    replayHandlers.kpi = countUp;
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { countUp(); o.disconnect(); } }).observe(money);
  }
  // ==/demo==

  /* ---------- Drag, gestures & physics ---------- */
  // ==demo:springStage==
  {
    const st = $('#springStage'), ball = $('#springBall'), line = $('#springLine'), anc = $('#springAnchor');
    let x = 0, y = 0, vx = 0, vy = 0, hx = 0, hy = 0, dragging = false, raf = 0;
    const home = () => { hx = st.clientWidth / 2; hy = st.clientHeight / 2 - 10; };
    const draw = () => {
      ball.style.transform = `translate(${x}px, ${y}px)`;
      line.setAttribute('x1', hx); line.setAttribute('y1', hy); line.setAttribute('x2', x); line.setAttribute('y2', y);
      anc.setAttribute('cx', hx); anc.setAttribute('cy', hy);
    };
    const loop = () => {
      if (!dragging) {                      // spring: stiffness .12, damping .82
        vx = (vx + (hx - x) * .12) * .82; vy = (vy + (hy - y) * .12) * .82;
        x += vx; y += vy;
      }
      draw();
      raf = (dragging || Math.abs(vx) + Math.abs(vy) + Math.abs(hx - x) + Math.abs(hy - y) > .2) ? requestAnimationFrame(loop) : 0;
    };
    requestAnimationFrame(() => { home(); x = hx; y = hy; draw(); });
    ball.addEventListener('pointerdown', e => { dragging = true; ball.setPointerCapture(e.pointerId); if (!raf) raf = requestAnimationFrame(loop); });
    ball.addEventListener('pointermove', e => {
      if (!dragging) return;
      const r = st.getBoundingClientRect(), nx = e.clientX - r.left, ny = e.clientY - r.top;
      vx = nx - x; vy = ny - y; x = nx; y = ny;
    });
    const up = () => { dragging = false; };
    ball.addEventListener('pointerup', up); ball.addEventListener('pointercancel', up);
    addEventListener('resize', () => { home(); if (!raf) raf = requestAnimationFrame(loop); });
  }
  // ==/demo==

  // ==demo:swipe==
  {
    const sw = $('#swipe');
    const layout = () => $$('.sc', sw).forEach((c, i, arr) => {
      const depth = arr.length - 1 - i;
      c.style.zIndex = i;
      c.style.transform = `translateY(${depth * -9}px) scale(${1 - depth * .05})`;
      c.style.opacity = depth > 2 ? 0 : 1;
    });
    let drag = null;
    sw.addEventListener('pointerdown', e => {
      const c = sw.lastElementChild;
      if (!c.contains(e.target)) return;
      drag = { c, x0: e.clientX, dx: 0 };
      c.classList.add('dragging'); c.setPointerCapture(e.pointerId);
    });
    sw.addEventListener('pointermove', e => {
      if (!drag) return;
      drag.dx = e.clientX - drag.x0;
      drag.c.style.transform = `translateX(${drag.dx}px) rotate(${drag.dx * .08}deg)`;
      $('.yes', drag.c).style.opacity = Math.max(0, drag.dx / 90);
      $('.no', drag.c).style.opacity = Math.max(0, -drag.dx / 90);
    });
    const end = () => {
      if (!drag) return;
      const { c, dx } = drag; drag = null;
      c.classList.remove('dragging');
      if (Math.abs(dx) > 90) {
        c.style.transform = `translateX(${Math.sign(dx) * 420}px) rotate(${Math.sign(dx) * 40}deg)`;
        c.style.opacity = 0;
        setTimeout(() => { $$('em', c).forEach(m => (m.style.opacity = 0)); sw.prepend(c); layout(); }, 400);
      } else { $$('em', c).forEach(m => (m.style.opacity = 0)); layout(); }
    };
    sw.addEventListener('pointerup', end); sw.addEventListener('pointercancel', end);
    layout();
  }
  // ==/demo==

  // ==demo:gravityStage==
  {
    const host = $('#gravityStage'), g = setupCanvas(host), balls = [];
    const add = (x, y) => {
      balls.push({ x, y, vx: (Math.random() - .5) * 8, vy: (Math.random() - .5) * 4 - 2, r: 10 + Math.random() * 12, c: PALETTE[balls.length % 5] });
      if (balls.length > 40) balls.shift();
    };
    for (let i = 0; i < 9; i++) add(40 + Math.random() * (g.w() - 80), 30 + Math.random() * 80);
    host.addEventListener('pointerdown', e => { const r = host.getBoundingClientRect(); add(e.clientX - r.left, e.clientY - r.top); });
    let lastKick = 0;
    addLoop(host, t => {
      const W = g.w(), H = g.h(), ctx = g.ctx;
      if (t - lastKick > 4500) { lastKick = t; balls.forEach(b => { if (Math.abs(b.vy) < .5) b.vy = -6 - Math.random() * 7; }); }
      ctx.clearRect(0, 0, W, H);
      balls.forEach(b => {
        b.vy += .4; b.x += b.vx; b.y += b.vy;                        // gravity
        if (b.y + b.r > H) { b.y = H - b.r; b.vy *= -.78; b.vx *= .985; if (Math.abs(b.vy) < 1) b.vy = 0; } // bounce
        if (b.x - b.r < 0) { b.x = b.r; b.vx *= -.8; }
        if (b.x + b.r > W) { b.x = W - b.r; b.vx *= -.8; }
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fillStyle = b.c; ctx.fill();
      });
    });
  }
  // ==/demo==

  // ==demo:confettiStage==
  {
    const host = $('#confettiStage'), cf = setupCanvas(host);
    let parts = [];
    const burst = () => {
      const W = cf.w(), H = cf.h();
      for (let i = 0; i < 160; i++) {
        const a = -Math.PI / 2 + (Math.random() - .5) * 1.7, s = 6 + Math.random() * 9;
        parts.push({ x: W / 2, y: H / 2 + 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: Math.random() * 6, spin: (Math.random() - .5) * .4, w: 6 + Math.random() * 6, h: 4 + Math.random() * 4, c: PALETTE[i % 5], life: 1 });
      }
    };
    $('#confettiBtn').addEventListener('click', burst);
    replayHandlers.confetti = burst;
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { setTimeout(burst, 300); o.disconnect(); } }, { threshold: .6 }).observe(host);
    addLoop(host, () => {
      const ctx = cf.ctx;
      ctx.clearRect(0, 0, cf.w(), cf.h());
      parts = parts.filter(p => p.life > 0 && p.y < cf.h() + 20);
      parts.forEach(p => {
        p.vx *= .99; p.vy = p.vy * .99 + .25; p.x += p.vx; p.y += p.vy; p.rot += p.spin; p.life -= .006;
        ctx.save(); ctx.globalAlpha = Math.max(0, p.life); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      });
    });
  }
  // ==/demo==

  // ==demo:stringStage==
  {
    const st = $('#stringStage'), path = $('#stringPath'), A = $('#stringA'), B = $('#stringB');
    let ax, ay, bx, cx, cy, vx = 0, vy = 0, mx = 0, my = 0, pulling = false, raf = 0;
    const home = () => { ax = 30; bx = st.clientWidth - 30; ay = st.clientHeight / 2 - 10; };
    const draw = () => {
      path.setAttribute('d', `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${ay}`);
      A.setAttribute('cx', ax); A.setAttribute('cy', ay); B.setAttribute('cx', bx); B.setAttribute('cy', ay);
    };
    const loop = () => {
      const hx = (ax + bx) / 2, hy = ay;
      if (pulling) { vx = (2 * mx - hx - cx) * .35; vy = (2 * my - hy - cy) * .35; } // curve passes through the pointer
      else { vx = (vx + (hx - cx) * .18) * .9; vy = (vy + (hy - cy) * .18) * .9; }   // spring back & vibrate
      cx += vx; cy += vy; draw();
      raf = (pulling || Math.abs(vx) + Math.abs(vy) + Math.abs(hy - cy) > .1) ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    requestAnimationFrame(() => { home(); cx = (ax + bx) / 2; cy = ay; draw(); });
    st.addEventListener('pointermove', e => {
      const r = st.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top;
      pulling = Math.abs(my - ay) < 70 && mx > ax && mx < bx; kick();
    });
    st.addEventListener('pointerleave', () => { pulling = false; kick(); });
    addEventListener('resize', () => { home(); kick(); });
  }
  // ==/demo==

  // ==demo:netStage==
  {
    const host = $('#netStage'), nt = setupCanvas(host), pts = [];
    for (let i = 0; i < 42; i++) pts.push({ x: Math.random() * nt.w(), y: Math.random() * nt.h(), vx: (Math.random() - .5) * .6, vy: (Math.random() - .5) * .6 });
    let mouse = null;
    host.addEventListener('pointermove', e => { const r = host.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; });
    host.addEventListener('pointerleave', () => (mouse = null));
    addLoop(host, () => {
      const W = nt.w(), H = nt.h(), ctx = nt.ctx;
      ctx.clearRect(0, 0, W, H);
      pts.forEach(p => { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1; });
      const all = mouse ? pts.concat([mouse]) : pts;
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j], isM = a === mouse || b === mouse, max = isM ? 130 : 90;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < max) {
          ctx.globalAlpha = 1 - d / max; ctx.strokeStyle = isM ? '#ff5c8a' : '#22d3ee';
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1; ctx.fillStyle = '#e9ebf3';
      pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill(); });
    });
  }
  // ==/demo==

  // ==demo:matrix==
  {
    const host = $('#matrix'), m = setupCanvas(host);
    const chars = 'アイウエオカキクケコサシスセソタチツテト0123456789ABCDEF', size = 14;
    let drops = [], last = 0;
    const reset = () => (drops = Array.from({ length: Math.ceil(m.w() / size) }, () => Math.random() * -20));
    reset(); addEventListener('resize', reset);
    addLoop(host, t => {
      if (t - last < 50) return; last = t;            // ~20fps is enough here
      const ctx = m.ctx;
      ctx.fillStyle = 'rgba(0,0,0,.09)'; ctx.fillRect(0, 0, m.w(), m.h()); // fading trails
      ctx.fillStyle = '#34d399'; ctx.font = `${size}px monospace`;
      drops.forEach((y, i) => {
        ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * size, y * size);
        drops[i] = (y * size > m.h() && Math.random() > .975) ? 0 : y + 1;
      });
    });
  }
  // ==/demo==

  /* ---------- 3D ---------- */
  // ==demo:icube==
  {
    const cube = $('#icube'), btns = $$('#faceBtns button');
    btns.forEach(b => b.addEventListener('click', () => {
      btns.forEach(x => x.classList.toggle('on', x === b));
      cube.style.transform = `rotateX(-14deg) rotateY(18deg) ${b.dataset.r}`;
    }));
  }
  // ==/demo==

  // ==demo:depthCard==
  {
    const card = $('#depthCard'), zone = card.parentElement;
    zone.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const x = clamp((e.clientX - r.left) / r.width - .5, -.6, .6), y = clamp((e.clientY - r.top) / r.height - .5, -.6, .6);
      card.classList.remove('auto');
      card.style.setProperty('--ry', x * 34 + 'deg'); card.style.setProperty('--rx', -y * 34 + 'deg');
    });
    zone.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); setTimeout(() => card.classList.add('auto'), 400); });
  }
  // ==/demo==

  // ==demo:fclock==
  {
    const fc = $('#fclock'), digits = [];
    for (let i = 0; i < 6; i++) {
      if (i === 2 || i === 4) { const c = document.createElement('span'); c.className = 'colon'; c.textContent = ':'; fc.appendChild(c); }
      const d = document.createElement('div');
      d.className = 'fd';
      d.innerHTML = '<div class="half top"><span></span></div><div class="half bottom"><span></span></div><div class="flap ftop"><span></span></div><div class="flap fbottom"><span></span></div>';
      fc.appendChild(d); digits.push(d);
    }
    const setDigit = (d, v, animate) => {
      const old = d.dataset.v;
      if (old === v) return;
      const [top, bottom, ftop, fbottom] = $$('span', d);
      d.dataset.v = v;
      if (!animate || old === undefined) { top.textContent = bottom.textContent = ftop.textContent = fbottom.textContent = v; return; }
      top.textContent = v; bottom.textContent = old; ftop.textContent = old; fbottom.textContent = v;
      restart(d, 'go');
      clearTimeout(d._t);
      d._t = setTimeout(() => { bottom.textContent = v; ftop.textContent = v; d.classList.remove('go'); }, 650);
    };
    const tick = animate => {
      const n = new Date();
      const s = [n.getHours(), n.getMinutes(), n.getSeconds()].map(x => String(x).padStart(2, '0')).join('');
      digits.forEach((d, i) => setDigit(d, s[i], animate));
    };
    tick(false);
    setInterval(() => { if (!isPaused()) tick(live(fc)); }, 1000);
  }
  // ==/demo==

  // ==demo:coverflow==
  {
    const cf = $('#coverflow'), items = $$('i', cf);
    let idx = 2;
    const lay = () => items.forEach((el, i) => {
      const off = i - idx;
      el.style.transform = `translateX(${off * 70}px) translateZ(${-Math.abs(off) * 90}px) rotateY(${-Math.sign(off) * 45}deg)`;
      el.style.zIndex = 10 - Math.abs(off);
      el.style.filter = off ? 'brightness(.6)' : 'none';
    });
    items.forEach((el, i) => el.addEventListener('click', () => { idx = i; lay(); }));
    $('#cfPrev').addEventListener('click', () => { idx = Math.max(0, idx - 1); lay(); });
    $('#cfNext').addEventListener('click', () => { idx = Math.min(items.length - 1, idx + 1); lay(); });
    lay();
  }
  // ==/demo==
})();
