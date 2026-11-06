/* =========================================================
   more.js — page framework (same as script.js) + the demos of more.html
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

  // ==demo:dirHover==
  try {
    const OFF = { top: 'translateY(-100%)', bottom: 'translateY(100%)', left: 'translateX(-100%)', right: 'translateX(100%)' };
    const edge = (e, el) => {
      const r = el.getBoundingClientRect();
      const d = { top: e.clientY - r.top, bottom: r.bottom - e.clientY, left: e.clientX - r.left, right: r.right - e.clientX };
      return Object.keys(d).reduce((a, b) => (d[a] < d[b] ? a : b));
    };
    $$('#mDirGrid .m-dir').forEach(card => {
      const fill = $('i', card);
      card.addEventListener('pointerenter', e => {
        fill.classList.add('m-jump');
        fill.style.transform = OFF[edge(e, card)];
        requestAnimationFrame(() => requestAnimationFrame(() => { fill.classList.remove('m-jump'); fill.style.transform = 'none'; }));
      });
      card.addEventListener('pointerleave', e => { fill.style.transform = OFF[edge(e, card)]; });
    });
  } catch (err) { console.error('[demo dirHover]', err); }
  // ==/demo==

  // ==demo:eyes==
  try {
    const eyes = $('#mEyes'), zone = eyes.closest('.stage');
    zone.addEventListener('pointermove', e => {
      $$('.m-eye', eyes).forEach(eye => {
        const r = eye.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const a = Math.atan2(dy, dx), d = Math.min(22, Math.hypot(dx, dy) / 8);
        $('i', eye).style.transform = `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px)`;
      });
    });
    zone.addEventListener('pointerleave', () => $$('.m-eye i', eyes).forEach(p => (p.style.transform = '')));
  } catch (err) { console.error('[demo eyes]', err); }
  // ==/demo==

  // ==demo:mouseParallax==
  try {
    const par = $('#mPar'), zone = par.closest('.stage'), layers = $$('[data-depth]', par);
    zone.addEventListener('pointermove', e => {
      const r = zone.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      layers.forEach(l => {
        const d = parseFloat(l.dataset.depth);
        l.style.setProperty('--px', -x * 40 * d + 'px');
        l.style.setProperty('--py', -y * 24 * d + 'px');
      });
    });
    zone.addEventListener('pointerleave', () => layers.forEach(l => { l.style.setProperty('--px', 0); l.style.setProperty('--py', 0); }));
  } catch (err) { console.error('[demo mouseParallax]', err); }
  // ==/demo==

  // ==demo:repel==
  try {
    const el = $('#mRepel'), zone = el.closest('.stage'), letters = $$('span', el);
    const st = letters.map(() => ({ x: 0, y: 0, tx: 0, ty: 0 }));
    let mouse = null, raf = 0;
    const loop = () => {
      let moving = false;
      letters.forEach((l, i) => {
        const s = st[i];
        if (mouse) {
          const r = l.getBoundingClientRect();
          const dx = r.left + r.width / 2 - s.x - mouse.x, dy = r.top + r.height / 2 - s.y - mouse.y;
          const d = Math.hypot(dx, dy) || 1, f = Math.max(0, 1 - d / 110) * 46;
          s.tx = dx / d * f; s.ty = dy / d * f;
        } else { s.tx = 0; s.ty = 0; }
        s.x += (s.tx - s.x) * .18; s.y += (s.ty - s.y) * .18;
        if (Math.abs(s.tx - s.x) + Math.abs(s.ty - s.y) > .1) moving = true;
        l.style.transform = `translate(${s.x}px, ${s.y}px)`;
      });
      raf = moving || mouse ? requestAnimationFrame(loop) : 0;
    };
    zone.addEventListener('pointermove', e => { mouse = { x: e.clientX, y: e.clientY }; if (!raf) raf = requestAnimationFrame(loop); });
    zone.addEventListener('pointerleave', () => { mouse = null; if (!raf) raf = requestAnimationFrame(loop); });
  } catch (err) { console.error('[demo repel]', err); }
  // ==/demo==

  // ==demo:dotGrid==
  try {
    const grid = $('#mDots'), zone = grid.closest('.stage');
    for (let i = 0; i < 14 * 8; i++) grid.appendChild(document.createElement('i'));
    const dots = $$('i', grid);
    zone.addEventListener('pointermove', e => {
      dots.forEach(d => {
        const r = d.getBoundingClientRect();
        const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
        d.style.setProperty('--k', Math.max(0, 1 - dist / 120).toFixed(2));
      });
    });
    zone.addEventListener('pointerleave', () => dots.forEach(d => d.style.setProperty('--k', 0)));
  } catch (err) { console.error('[demo dotGrid]', err); }
  // ==/demo==

  // ==demo:lens==
  try {
    const img = $('#mLensImg'), lens = $('.m-lens', img), big = $('.m-lens-big', img), Z = 2, R = 55;
    img.addEventListener('pointermove', e => {
      const r = img.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      lens.style.transform = `translate(${x - R}px, ${y - R}px)`;
      big.style.transform = `translate(${-x * Z + R}px, ${-y * Z + R}px)`;
    });
  } catch (err) { console.error('[demo lens]', err); }
  // ==/demo==

  // ==demo:velCursor==
  try {
    const zone = $('#mVel'), blob = $('i', zone);
    let x = 0, y = 0, tx = 0, ty = 0, raf = 0;
    const loop = () => {
      const vx = tx - x, vy = ty - y, speed = Math.hypot(vx, vy);
      x += vx * .22; y += vy * .22;
      const s = Math.min(speed / 40, .8);
      blob.style.transform = `translate(${x}px, ${y}px) rotate(${Math.atan2(vy, vx)}rad) scale(${1 + s}, ${1 - s * .5})`;
      raf = speed > .1 ? requestAnimationFrame(loop) : 0;
    };
    zone.addEventListener('pointermove', e => {
      const r = zone.getBoundingClientRect(); tx = e.clientX - r.left; ty = e.clientY - r.top;
      if (!raf) raf = requestAnimationFrame(loop);
    });
    zone.addEventListener('pointerenter', e => { const r = zone.getBoundingClientRect(); x = tx = e.clientX - r.left; y = ty = e.clientY - r.top; });
  } catch (err) { console.error('[demo velCursor]', err); }
  // ==/demo==

  // ==demo:typeDelete==
  try {
    const out = $('#mType'), words = ['websites.', 'mobile apps.', 'brands.', 'motion.'];
    let w = 0, i = 0, del = false;
    const tick = () => {
      const word = words[w];
      if (!live(out)) return setTimeout(tick, 400);
      if (!del && i < word.length) { out.textContent = word.slice(0, ++i); return setTimeout(tick, 70 + Math.random() * 60); }
      if (!del) { del = true; return setTimeout(tick, 1400); }
      if (i > 0) { out.textContent = word.slice(0, --i); return setTimeout(tick, 35); }
      del = false; w = (w + 1) % words.length; setTimeout(tick, 300);
    };
    tick();
  } catch (err) { console.error('[demo typeDelete]', err); }
  // ==/demo==

  // ==demo:snapScale==
  try {
    const strip = $('#mSnap'), cards = $$('i', strip);
    const update = () => {
      const mid = strip.scrollLeft + strip.clientWidth / 2;
      cards.forEach(c => {
        const k = Math.max(0, 1 - Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) / 200);
        c.style.setProperty('--s', .8 + k * .25);
        c.style.setProperty('--o', .45 + k * .55);
      });
    };
    strip.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
    requestAnimationFrame(() => { strip.scrollLeft = cards[2].offsetLeft - strip.clientWidth / 2 + 60; update(); });
  } catch (err) { console.error('[demo snapScale]', err); }
  // ==/demo==

  // ==demo:bgShift==
  try {
    const box = $('#mBgs');
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) box.style.backgroundColor = e.target.dataset.c; }),
      { root: box, threshold: .55 });
    $$('.m-bgs-sec', box).forEach(s => io.observe(s));
  } catch (err) { console.error('[demo bgShift]', err); }
  // ==/demo==

  // ==demo:scrollDraw==
  try {
    const box = $('#mSDraw'), path = $('path', box);
    const draw = () => {
      const p = box.scrollTop / (box.scrollHeight - box.clientHeight || 1);
      path.style.strokeDashoffset = 1 - Math.min(1, p * 1.05);
    };
    box.addEventListener('scroll', () => requestAnimationFrame(draw), { passive: true });
    draw();
  } catch (err) { console.error('[demo scrollDraw]', err); }
  // ==/demo==

  // ==demo:backTop==
  try {
    const box = $('#mBt'), btn = $('.m-bt-btn', box);
    box.addEventListener('scroll', () => {
      const p = box.scrollTop / (box.scrollHeight - box.clientHeight || 1);
      btn.classList.toggle('on', box.scrollTop > 60);
      btn.style.setProperty('--off', 1 - p);
    }, { passive: true });
    btn.addEventListener('click', () => box.scrollTo({ top: 0, behavior: 'smooth' }));
  } catch (err) { console.error('[demo backTop]', err); }
  // ==/demo==

  // ==demo:velSkew==
  try {
    const box = $('#mSkew'), inner = $('.m-skew', box);
    let last = box.scrollTop, skew = 0, raf = 0;
    const loop = () => {
      const v = box.scrollTop - last; last = box.scrollTop;
      skew += (clamp(v * .4, -10, 10) - skew) * .15;
      inner.style.setProperty('--sk', skew.toFixed(2) + 'deg');
      raf = Math.abs(skew) > .02 || v ? requestAnimationFrame(loop) : 0;
    };
    box.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(loop); }, { passive: true });
  } catch (err) { console.error('[demo velSkew]', err); }
  // ==/demo==

  // ==demo:frameScrub==
  try {
    const box = $('#mScrub'), moon = $('#mMoon'), frames = [...'🌑🌒🌓🌔🌕🌖🌗🌘🌑'.match(/./gu)];
    box.addEventListener('scroll', () => {
      const p = box.scrollTop / (box.scrollHeight - box.clientHeight || 1);
      moon.textContent = frames[Math.round(p * (frames.length - 1))];
    }, { passive: true });
  } catch (err) { console.error('[demo frameScrub]', err); }
  // ==/demo==

  // ==demo:infScroll==
  try {
    const box = $('#mInf'), list = $('.m-inf-list', box), sentinel = $('.m-inf-sentinel', box);
    let n = 0, busy = false;
    const more = () => {
      for (let i = 0; i < 5; i++) {
        const d = document.createElement('div');
        d.style.setProperty('--i', i); d.textContent = 'Post #' + ++n;
        list.appendChild(d);
      }
    };
    more();
    const io = new IntersectionObserver(es => {
      if (!es[0].isIntersecting || busy || n >= 40) return;
      busy = true;
      setTimeout(() => {
        more(); busy = false;
        if (n >= 40) { sentinel.classList.add('end'); io.disconnect(); }
        else { io.unobserve(sentinel); io.observe(sentinel); } // re-check if still visible
      }, 700);
    }, { root: box });
    io.observe(sentinel);
  } catch (err) { console.error('[demo infScroll]', err); }
  // ==/demo==

  // ==demo:shakeInput==
  try {
    const form = $('#mShake'), input = $('input', form);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value);
      form.classList.remove('ok', 'err');
      if (ok) form.classList.add('ok'); else restart(form, 'err');
    });
    input.addEventListener('input', () => form.classList.remove('err', 'ok'));
  } catch (err) { console.error('[demo shakeInput]', err); }
  // ==/demo==

  // ==demo:submitBtn==
  try {
    const b = $('#mSubmit');
    b.addEventListener('click', () => {
      if (b.className !== 'm-submit') return;
      b.classList.add('busy');
      setTimeout(() => { b.classList.replace('busy', 'done'); }, 1600);
      setTimeout(() => { b.classList.remove('done'); }, 3200);
    });
  } catch (err) { console.error('[demo submitBtn]', err); }
  // ==/demo==

  // ==demo:charRing==
  try {
    const cc = $('#mCc'), ta = $('textarea', cc), fg = $('.fg', cc), left = $('b', cc), MAX = 60;
    ta.addEventListener('input', () => {
      const len = ta.value.length;
      fg.style.strokeDashoffset = 1 - Math.min(1, len / MAX);
      cc.classList.toggle('warn', len >= MAX * .8);
      left.textContent = len >= MAX * .8 ? MAX - len : '';
      if (len >= MAX) restart(cc, 'full'); else cc.classList.remove('full');
    });
  } catch (err) { console.error('[demo charRing]', err); }
  // ==/demo==

  // ==demo:bookmark==
  try {
    const bm = $('#mBm');
    bm.addEventListener('click', () => bm.setAttribute('aria-pressed', bm.getAttribute('aria-pressed') !== 'true'));
  } catch (err) { console.error('[demo bookmark]', err); }
  // ==/demo==

  // ==demo:followBtn==
  try {
    $('#mFollow').addEventListener('click', e => e.currentTarget.classList.toggle('on'));
  } catch (err) { console.error('[demo followBtn]', err); }
  // ==/demo==

  // ==demo:rangeBubble==
  try {
    const r = $('#mRange'), input = $('input', r), out = $('output', r);
    const set = () => { r.style.setProperty('--p', input.value + '%'); out.textContent = input.value; };
    input.addEventListener('input', set); set();
  } catch (err) { console.error('[demo rangeBubble]', err); }
  // ==/demo==

  // ==demo:pullRefresh==
  try {
    const ptr = $('#mPtr'), list = $('ul', ptr), icon = $('.m-ptr-icon', ptr);
    let y0 = null, pull = 0, n = 0;
    ptr.addEventListener('pointerdown', e => { if (ptr.classList.contains('spin')) return; y0 = e.clientY; ptr.classList.add('drag'); ptr.setPointerCapture(e.pointerId); });
    ptr.addEventListener('pointermove', e => {
      if (y0 === null) return;
      pull = clamp((e.clientY - y0) * .5, 0, 110);
      list.style.transform = `translateY(${pull}px)`;
      icon.style.transform = `rotate(${pull >= 60 ? 180 : pull * 3}deg)`;
    });
    const release = () => {
      if (y0 === null) return;
      y0 = null; ptr.classList.remove('drag');
      if (pull < 60) { list.style.transform = ''; return; }
      list.style.transform = 'translateY(56px)'; ptr.classList.add('spin'); icon.style.transform = '';
      setTimeout(() => {
        const li = document.createElement('li'); li.className = 'm-new'; li.textContent = 'New message #' + ++n;
        list.prepend(li); ptr.classList.remove('spin'); list.style.transform = '';
      }, 1100);
    };
    ptr.addEventListener('pointerup', release); ptr.addEventListener('pointercancel', release);
  } catch (err) { console.error('[demo pullRefresh]', err); }
  // ==/demo==

  // ==demo:swipeDelete==
  try {
    const box = $('#mSwd');
    const fill = () => ['Flight to Lisbon', 'Invoice #2041', 'Dentist reminder', 'Package delivered'].forEach(t => {
      box.insertAdjacentHTML('beforeend', `<div class="m-swd-row"><div><span>${t}</span></div></div>`);
    });
    fill();
    let drag = null;
    box.addEventListener('pointerdown', e => {
      const span = e.target.closest('span'); if (!span) return;
      drag = { row: span.closest('.m-swd-row'), span, x0: e.clientX, dx: 0 };
      drag.row.classList.add('drag'); span.setPointerCapture(e.pointerId);
    });
    box.addEventListener('pointermove', e => {
      if (!drag) return;
      drag.dx = Math.min(0, e.clientX - drag.x0);
      drag.span.style.transform = `translateX(${drag.dx}px)`;
    });
    const end = () => {
      if (!drag) return;
      const { row, span, dx } = drag; drag = null; row.classList.remove('drag');
      if (dx < -span.offsetWidth / 2) {
        span.style.transform = 'translateX(-100%)';
        setTimeout(() => row.classList.add('gone'), 200);
        setTimeout(() => { row.remove(); if (!box.children.length) fill(); }, 600);
      } else span.style.transform = '';
    };
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  } catch (err) { console.error('[demo swipeDelete]', err); }
  // ==/demo==

  // ==demo:reactions==
  try {
    const r = $('#mReact'), btn = $('.m-react-btn', r);
    $$('.m-react-bar button', r).forEach(b => b.addEventListener('click', () => {
      btn.textContent = b.textContent + ' Reacted'; restart(btn, 'pop');
    }));
  } catch (err) { console.error('[demo reactions]', err); }
  // ==/demo==

  // ==demo:upvote==
  try {
    const v = $('#mVote'), box = $('.m-vote-n', v);
    let n = 128, my = 0;
    const show = dir => {
      const old = $('span', box), nu = document.createElement('span');
      nu.textContent = n; nu.style.transform = `translateY(${dir * 100}%)`; nu.style.opacity = 0;
      box.appendChild(nu);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        nu.style.transform = 'none'; nu.style.opacity = 1;
        old.style.transform = `translateY(${-dir * 100}%)`; old.style.opacity = 0;
      }));
      setTimeout(() => old.remove(), 320);
    };
    const vote = d => {
      const next = my === d ? 0 : d, delta = next - my;
      n += delta; my = next;
      $('.up', v).classList.toggle('on', my === 1); $('.down', v).classList.toggle('on', my === -1);
      show(delta > 0 ? 1 : -1);   // roll up when the number grows
    };
    $('.up', v).addEventListener('click', () => vote(1));
    $('.down', v).addEventListener('click', () => vote(-1));
  } catch (err) { console.error('[demo upvote]', err); }
  // ==/demo==

  // ==demo:pagerDots==
  try {
    const p = $('#mPager'), slides = $$('.m-pager-slides i', p), dots = $$('.m-pager-dots button', p);
    let cur = 0, t0 = 0;
    const go = i => {
      cur = i; t0 = performance.now();
      slides.forEach((s, k) => s.classList.toggle('on', k === i));
      dots.forEach((d, k) => { d.classList.remove('on'); if (k === i) restart(d, 'on'); });
    };
    dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
    go(0);
    setInterval(() => { if (live(p) && performance.now() - t0 > 2950) go((cur + 1) % slides.length); }, 100);
  } catch (err) { console.error('[demo pagerDots]', err); }
  // ==/demo==

  // ==demo:flyCart==
  try {
    const fly = $('#mFly'), cart = $('.m-fly-cart', fly), count = $('b', cart);
    let n = 0;
    $$('.m-fly-items button', fly).forEach(b => b.addEventListener('click', () => {
      const a = b.getBoundingClientRect(), c = cart.getBoundingClientRect();
      const x0 = a.left + a.width / 2, y0 = a.top + 37, dx = c.left + c.width / 2 - x0, dy = c.top + c.height / 2 - y0;
      const dot = document.createElement('div'), inner = document.createElement('i');
      dot.className = 'm-fly-dot'; dot.style.left = x0 + 'px'; dot.style.top = y0 + 'px';
      inner.style.background = getComputedStyle(b).getPropertyValue('--c');
      dot.appendChild(inner); document.body.appendChild(dot);
      dot.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }], { duration: 700, easing: 'linear' });
      const anim = inner.animate([{ transform: 'translateY(0) scale(1)' }, { transform: `translateY(${dy}px) scale(.5)` }],
        { duration: 700, easing: 'cubic-bezier(.5,-0.6,.9,.6)' });
      anim.onfinish = () => { dot.remove(); count.textContent = ++n; restart(cart, 'bump'); };
    }));
  } catch (err) { console.error('[demo flyCart]', err); }
  // ==/demo==

  // ==demo:popover==
  try {
    const pop = $('#mPop'), btn = $('button', pop);
    btn.addEventListener('click', e => { e.stopPropagation(); btn.setAttribute('aria-expanded', pop.classList.toggle('open')); });
    document.addEventListener('click', e => { if (!pop.contains(e.target)) { pop.classList.remove('open'); btn.setAttribute('aria-expanded', false); } });
  } catch (err) { console.error('[demo popover]', err); }
  // ==/demo==

  // ==demo:ctxMenu==
  try {
    const ctx = $('#mCtx'), menu = $('.m-ctx-menu', ctx);
    ctx.addEventListener('contextmenu', e => {
      e.preventDefault();
      const r = ctx.getBoundingClientRect();
      const x = clamp(e.clientX - r.left, 0, r.width - 155), y = clamp(e.clientY - r.top, 0, r.height - 150);
      menu.classList.remove('open');
      menu.style.left = x + 'px'; menu.style.top = y + 'px';
      requestAnimationFrame(() => menu.classList.add('open'));
    });
    document.addEventListener('click', () => menu.classList.remove('open'));
  } catch (err) { console.error('[demo ctxMenu]', err); }
  // ==/demo==

  // ==demo:cmdk==
  try {
    const cmd = $('#mCmd'), input = $('input', cmd), ul = $('ul', cmd);
    const items = ['New file', 'Open recent', 'Toggle theme', 'Go to settings', 'Invite teammate', 'Export as PDF', 'Keyboard shortcuts'];
    let sel = 0, shown = [];
    const render = () => {
      const q = input.value.toLowerCase();
      shown = items.filter(t => t.toLowerCase().includes(q)); sel = Math.min(sel, Math.max(0, shown.length - 1));
      ul.innerHTML = shown.map((t, i) => `<li style="--i:${i}" class="${i === sel ? 'on' : ''}">${t}</li>`).join('') || '<li>No results</li>';
    };
    const open = o => { cmd.classList.toggle('open', o); if (o) { input.value = ''; sel = 0; render(); setTimeout(() => input.focus({ preventScroll: true }), 50); } };
    $('.m-cmd-open', cmd).addEventListener('click', () => open(true));
    $('.m-cmd-back', cmd).addEventListener('click', e => { if (e.target === e.currentTarget) open(false); });
    input.addEventListener('input', () => { sel = 0; render(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') open(false);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % (shown.length || 1);
        $$('li', ul).forEach((li, i) => li.classList.toggle('on', i === sel));
      }
    });
    addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && live(cmd)) { e.preventDefault(); open(true); } });
  } catch (err) { console.error('[demo cmdk]', err); }
  // ==/demo==

  // ==demo:undoSnack==
  try {
    const u = $('#mUndo'), item = $('.m-undo-item', u), snack = $('.m-undo-snack', u);
    let t = 0;
    const hide = () => snack.classList.remove('on');
    $('.m-undo-item button', u).addEventListener('click', () => {
      item.classList.add('gone'); restart(snack, 'on');
      clearTimeout(t); t = setTimeout(() => { hide(); setTimeout(() => item.classList.remove('gone'), 900); }, 4000); // demo: item comes back later
    });
    $('.m-undo-snack button', u).addEventListener('click', () => { clearTimeout(t); hide(); item.classList.remove('gone'); });
  } catch (err) { console.error('[demo undoSnack]', err); }
  // ==/demo==

  // ==demo:chips==
  try {
    const form = $('#mChips'), list = $('.m-chips-list', form), input = $('input', form);
    const flip = change => {
      const before = new Map($$('.m-chip', list).map(c => [c, c.getBoundingClientRect()]));
      change();
      $$('.m-chip', list).forEach(c => {
        const a = before.get(c); if (!a) return;
        const b = c.getBoundingClientRect();
        if (a.left !== b.left || a.top !== b.top) c.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' });
      });
    };
    const add = t => { const c = document.createElement('span'); c.className = 'm-chip'; c.innerHTML = `<span></span><button type="button" aria-label="Remove">✕</button>`; c.firstChild.textContent = t; list.appendChild(c); };
    ['design', 'motion', 'css'].forEach(add);
    form.addEventListener('submit', e => { e.preventDefault(); if (input.value.trim()) add(input.value.trim()); input.value = ''; });
    list.addEventListener('click', e => {
      const c = e.target.closest('button') && e.target.closest('.m-chip'); if (!c) return;
      c.classList.add('out');
      c.addEventListener('animationend', () => flip(() => c.remove()), { once: true });
    });
  } catch (err) { console.error('[demo chips]', err); }
  // ==/demo==

  // ==demo:sidebar==
  try {
    const side = $('#mSide');
    $('.m-side-tog', side).addEventListener('click', () => side.classList.toggle('mini'));
  } catch (err) { console.error('[demo sidebar]', err); }
  // ==/demo==

  // ==demo:banner==
  try {
    const ban = $('#mBan');
    $('.m-ban-bar button', ban).addEventListener('click', () => ban.classList.add('closed'));
    $('.m-ban-reset', ban).addEventListener('click', () => ban.classList.remove('closed'));
  } catch (err) { console.error('[demo banner]', err); }
  // ==/demo==

  // ==demo:lightbox==
  try {
    const lb = $('#mLb'), view = $('.m-lb-view', lb);
    let from = null;
    const fly = (a, b, reverse) => view.animate([
      { transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`, borderRadius: '10px' },
      { transform: 'none' }
    ], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)', direction: reverse ? 'reverse' : 'normal' });
    $$('.m-lb-grid button', lb).forEach(b => b.addEventListener('click', () => {
      from = b; view.style.filter = b.style.filter; view.style.transformOrigin = '0 0';
      view.classList.add('open'); fly(b.getBoundingClientRect(), view.getBoundingClientRect(), false);
    }));
    view.addEventListener('click', () => {
      fly(from.getBoundingClientRect(), view.getBoundingClientRect(), true).onfinish = () => view.classList.remove('open');
    });
  } catch (err) { console.error('[demo lightbox]', err); }
  // ==/demo==

  // ==demo:speedDial==
  try {
    const dial = $('#mDial'), btn = $('button', dial);
    btn.addEventListener('click', () => btn.setAttribute('aria-expanded', dial.classList.toggle('open')));
  } catch (err) { console.error('[demo speedDial]', err); }
  // ==/demo==

  // ==demo:filterGrid==
  try {
    const f = $('#mFilter'), grid = $('.m-filter-grid', f), items = $$('i', grid);
    $$('.m-filter-tabs button', f).forEach(b => b.addEventListener('click', () => {
      $$('.m-filter-tabs button', f).forEach(x => x.classList.toggle('on', x === b));
      const keep = i => b.dataset.f === 'all' || i.dataset.k === b.dataset.f;
      const first = new Map(items.map(i => [i, i.getBoundingClientRect()]));
      items.forEach(i => i.classList.toggle('hide', !keep(i)));
      items.forEach(i => {
        if (!keep(i)) return;
        const a = first.get(i), r = i.getBoundingClientRect();
        if (!a.width) { i.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 350, easing: 'cubic-bezier(.34,1.56,.64,1)' }); return; }
        i.animate([{ transform: `translate(${a.left - r.left}px, ${a.top - r.top}px)` }, { transform: 'none' }], { duration: 400, easing: 'cubic-bezier(.22,1,.36,1)' });
      });
    }));
  } catch (err) { console.error('[demo filterGrid]', err); }
  // ==/demo==

  // ==demo:magicLine==
  try {
    const nav = $('#mMagic'), line = $('i', nav), links = $$('a', nav);
    const to = a => { line.style.width = a.offsetWidth + 'px'; line.style.transform = `translateX(${a.offsetLeft}px)`; };
    const home = () => to($('a.on', nav));
    links.forEach(a => {
      a.addEventListener('pointerenter', () => to(a));
      a.addEventListener('click', e => { e.preventDefault(); links.forEach(x => x.classList.toggle('on', x === a)); });
    });
    nav.addEventListener('pointerleave', home);
    home(); addEventListener('resize', home); document.fonts?.ready.then(home);
  } catch (err) { console.error('[demo magicLine]', err); }
  // ==/demo==

  // ==demo:overlayMenu==
  try {
    const o = $('#mOver'), btn = $('button', o);
    btn.addEventListener('click', () => btn.setAttribute('aria-expanded', o.classList.toggle('open')));
    $$('.m-over-menu a', o).forEach(a => a.addEventListener('click', e => { e.preventDefault(); o.classList.remove('open'); }));
  } catch (err) { console.error('[demo overlayMenu]', err); }
  // ==/demo==

  // ==demo:bottomNav==
  try {
    const bar = $('#mTabbar'), bubble = $('.m-tabbar-bubble', bar), tabs = $$('button', bar);
    tabs.forEach((t, i) => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.toggle('on', x === t)); bubble.style.setProperty('--k', i);
    }));
  } catch (err) { console.error('[demo bottomNav]', err); }
  // ==/demo==

  // ==demo:scrollSpy==
  try {
    const spy = $('#mSpy'), box = $('.scroll-box', spy), secs = $$('.m-spy-sec', box), dots = $$('nav button', spy);
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) dots.forEach((d, i) => d.classList.toggle('on', secs[i] === e.target));
    }), { root: box, threshold: .6 });
    secs.forEach(s => io.observe(s));
    dots.forEach((d, i) => d.addEventListener('click', () => box.scrollTo({ top: secs[i].offsetTop, behavior: 'smooth' })));
  } catch (err) { console.error('[demo scrollSpy]', err); }
  // ==/demo==

  // ==demo:drillMenu==
  try {
    const d = $('#mDrill');
    $$('[data-go]', d).forEach(b => b.addEventListener('click', () => d.classList.add('deep')));
    $('[data-back]', d).addEventListener('click', () => d.classList.remove('deep'));
  } catch (err) { console.error('[demo drillMenu]', err); }
  // ==/demo==

  // ==demo:blurUp==
  try {
    const b = $('#mBlurUp');
    let t = 0;
    const load = () => { b.classList.remove('loaded'); clearTimeout(t); t = setTimeout(() => b.classList.add('loaded'), 1300); }; // stands in for img.onload
    replayHandlers.blurUp = load;
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { load(); o.disconnect(); } }, { threshold: .6 }).observe(b);
  } catch (err) { console.error('[demo blurUp]', err); }
  // ==/demo==

  // ==demo:waveform==
  try {
    const p = $('#mWavePlayer'), bars = $('.m-wave-bars', p), btn = $('button', p);
    for (let i = 0; i < 28; i++) {
      const b = document.createElement('i');
      b.style.setProperty('--h', (.2 + Math.abs(Math.sin(i * 1.7)) * .7).toFixed(2));
      b.style.setProperty('--d', (.35 + (i * 37 % 9) / 18).toFixed(2) + 's');
      bars.appendChild(b);
    }
    btn.addEventListener('click', () => {
      const on = p.classList.toggle('playing');
      btn.textContent = on ? '❚❚' : '▶'; btn.setAttribute('aria-label', on ? 'Pause' : 'Play');
    });
  } catch (err) { console.error('[demo waveform]', err); }
  // ==/demo==

  // ==demo:svgClock==
  try {
    const svg = $('#mClock'), ticks = $('.ticks', svg), [h, m, s] = $$('line', svg).slice(-3);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', 50 + Math.sin(a) * 40); l.setAttribute('y1', 50 - Math.cos(a) * 40);
      l.setAttribute('x2', 50 + Math.sin(a) * 44); l.setAttribute('y2', 50 - Math.cos(a) * 44);
      ticks.appendChild(l);
    }
    let lastS = -1;
    const tick = () => {
      const d = new Date(), sec = d.getSeconds(), min = d.getMinutes() + sec / 60, hr = d.getHours() % 12 + min / 60;
      s.classList.toggle('wrap', sec === 0 && lastS !== -1); // jump from 59 → 0 without spinning backwards
      s.style.transform = `rotate(${sec * 6}deg)`;
      m.style.transform = `rotate(${min * 6}deg)`;
      h.style.transform = `rotate(${hr * 30}deg)`;
      lastS = sec;
    };
    tick(); setInterval(() => { if (!isPaused()) tick(); }, 1000);
  } catch (err) { console.error('[demo svgClock]', err); }
  // ==/demo==

  // ==demo:fireworks==
  try {
    const host = $('#mFw'), g = setupCanvas(host);
    let rockets = [], sparks = [], last = 0;
    const launch = (x, y) => rockets.push({ x, y: g.h(), tx: y, vy: -(4 + Math.random() * 2), c: PALETTE[Math.floor(Math.random() * 5)] });
    const burst = r => {
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * Math.PI * 2, s = Math.random() * 3.4 + .6;
        sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c: r.c });
      }
    };
    host.addEventListener('pointerdown', e => { const b = host.getBoundingClientRect(); launch(e.clientX - b.left, e.clientY - b.top); });
    addLoop(host, t => {
      const ctx = g.ctx;
      if (t - last > 1400) { last = t; launch(40 + Math.random() * (g.w() - 80), 30 + Math.random() * g.h() * .35); }
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 0, g.w(), g.h()); // trails
      ctx.globalCompositeOperation = 'lighter';
      rockets = rockets.filter(r => {
        r.y += r.vy; r.vy *= .985;
        ctx.globalAlpha = 1; ctx.fillStyle = r.c; ctx.fillRect(r.x - 1, r.y, 2, 6);
        if (r.y <= r.tx || r.vy > -1) { burst(r); return false; }
        return true;
      });
      sparks = sparks.filter(p => {
        p.vy += .05; p.vx *= .985; p.vy *= .985; p.x += p.vx; p.y += p.vy; p.life -= .012;
        ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2); ctx.fill();
        return p.life > 0;
      });
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    });
  } catch (err) { console.error('[demo fireworks]', err); }
  // ==/demo==

  // ==demo:sparkClick==
  try {
    const zone = $('#mSpark');
    zone.addEventListener('pointerdown', e => {
      const r = zone.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      for (let i = 0; i < 10; i++) {
        const star = document.createElement('i'), a = i / 10 * Math.PI * 2 + Math.random() * .4, d = 40 + Math.random() * 40;
        star.textContent = '✦'; star.style.color = PALETTE[i % 5];
        star.style.left = x - 7 + 'px'; star.style.top = y - 9 + 'px';
        zone.appendChild(star);
        star.animate([{ transform: 'translate(0, 0) scale(1.2)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) scale(0) rotate(180deg)`, opacity: .6 }],
          { duration: 650 + Math.random() * 250, easing: 'cubic-bezier(.22,1,.36,1)' }).onfinish = () => star.remove();
      }
    });
  } catch (err) { console.error('[demo sparkClick]', err); }
  // ==/demo==

  // ==demo:emojiRain==
  try {
    const rain = $('#mRain'), set = ['🎉', '🥳', '🎈', '✨', '💜', '🍰'];
    const drop = () => {
      for (let i = 0; i < 26; i++) {
        const e = document.createElement('i');
        e.textContent = set[i % set.length]; e.style.left = Math.random() * 95 + '%';
        rain.appendChild(e);
        const sway = (Math.random() - .5) * 80;
        e.animate([
          { transform: 'translate(0, 0) rotate(0)' },
          { transform: `translate(${sway}px, ${rain.clientHeight + 80}px) rotate(${(Math.random() - .5) * 720}deg)` }
        ], { duration: 1600 + Math.random() * 1400, delay: Math.random() * 500, easing: 'cubic-bezier(.4,0,.8,.6)', fill: 'both' }).onfinish = () => e.remove();
      }
    };
    $('button', rain).addEventListener('click', drop);
  } catch (err) { console.error('[demo emojiRain]', err); }
  // ==/demo==
})();
