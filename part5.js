/* =========================================================
   part5.js — page framework (same as script.js) + the demos of part5.html
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

  // The five studies use CSS animations; no per-demo JavaScript is required.
})();
