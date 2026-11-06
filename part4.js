/* =========================================================
   part4.js — page framework (same as script.js) + the demos of part4.html
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

  // ==demo:startingStyle==
  try {
    const ss = $('#p4Ss');
    $('button', ss).addEventListener('click', () => $('.p4-ss-card', ss).classList.toggle('on'));
  } catch (err) { console.error('[demo startingStyle]', err); }
  // ==/demo==

  // ==demo:dialog==
  try {
    const dlg = $('#p4Dlg');
    $('#p4DlgOpen').addEventListener('click', () => dlg.showModal());
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); }); // click on the backdrop closes it
  } catch (err) { console.error('[demo dialog]', err); }
  // ==/demo==

  // ==demo:sharedVT==
  try {
    const app = $('#p4Vt'), detail = $('.p4-vt-detail', app), hero = $('.p4-vt-hero', detail);
    let thumb = null;
    const vt = fn => (document.startViewTransition ? document.startViewTransition(fn).finished : (fn(), Promise.resolve()));
    $$('.p4-vt-list button', app).forEach(card => card.addEventListener('click', () => {
      thumb = $('i', card);
      thumb.style.viewTransitionName = 'p4-hero';
      vt(() => {
        thumb.style.viewTransitionName = '';
        hero.style.viewTransitionName = 'p4-hero';
        detail.style.setProperty('--c', card.style.getPropertyValue('--c'));
        $('h4', detail).textContent = card.dataset.t;
        app.classList.add('detail');
      });
    }));
    $('.p4-btn', detail).addEventListener('click', () => {
      vt(() => {
        hero.style.viewTransitionName = '';
        thumb.style.viewTransitionName = 'p4-hero';
        app.classList.remove('detail');
      }).then(() => { thumb.style.viewTransitionName = ''; });
    });
  } catch (err) { console.error('[demo sharedVT]', err); }
  // ==/demo==

  // ==demo:otp==
  try {
    const otp = $('#p4Otp'), boxes = $$('input', otp);
    const check = () => {
      const code = boxes.map(b => b.value).join('');
      if (code.length < boxes.length) return;
      if (code === '123456') { otp.classList.add('ok'); boxes.forEach(b => b.blur()); }
      else { restart(otp, 'err'); setTimeout(() => { boxes.forEach(b => (b.value = '')); otp.classList.remove('err'); boxes[0].focus(); }, 450); }
    };
    boxes.forEach((b, i) => {
      b.addEventListener('input', () => {
        otp.classList.remove('ok');
        b.value = b.value.replace(/\D/g, '').slice(-1);
        if (b.value) { restart(b, 'filled'); boxes[i + 1]?.focus(); }
        check();
      });
      b.addEventListener('keydown', e => { if (e.key === 'Backspace' && !b.value && i) boxes[i - 1].focus(); });
      b.addEventListener('paste', e => {
        e.preventDefault();
        const digits = (e.clipboardData.getData('text').match(/\d/g) || []).slice(0, boxes.length);
        digits.forEach((d, k) => { boxes[k].value = d; restart(boxes[k], 'filled'); });
        boxes[Math.min(digits.length, boxes.length - 1)].focus(); check();
      });
    });
  } catch (err) { console.error('[demo otp]', err); }
  // ==/demo==

  // ==demo:pwStrength==
  try {
    const pw = $('#p4Pw'), input = $('input', pw), items = $$('li', pw);
    const rules = [/.{8,}/, /\d/, /[A-Z]/, /[^A-Za-z0-9]/];
    input.addEventListener('input', () => {
      const met = rules.map(r => r.test(input.value));
      met.forEach((ok, i) => items[i].classList.toggle('ok', ok));
      pw.dataset.score = met.filter(Boolean).length;
    });
  } catch (err) { console.error('[demo pwStrength]', err); }
  // ==/demo==

  // ==demo:multiStep==
  try {
    const st = $('#p4Steps'), back = $('[data-back]', st), next = $('[data-next]', st);
    let s = 0;
    const go = n => {
      s = clamp(n, 0, 2);
      st.style.setProperty('--s', s); st.dataset.s = s;
      back.disabled = s === 0; next.textContent = s === 1 ? 'Finish' : s === 2 ? 'Restart' : 'Next';
    };
    next.addEventListener('click', () => go(s === 2 ? 0 : s + 1));
    back.addEventListener('click', () => go(s - 1));
    go(0);
  } catch (err) { console.error('[demo multiStep]', err); }
  // ==/demo==

  // ==demo:dropzone==
  try {
    const wrap = $('#p4Drop'), zone = $('.p4-drop', wrap), list = $('.p4-files', wrap), input = $('input', wrap);
    const upload = name => {
      const li = document.createElement('li');
      li.innerHTML = '<span></span><em>0%</em><i></i>'; li.firstChild.textContent = name;
      list.prepend(li); while (list.children.length > 3) list.lastChild.remove();
      const t0 = performance.now(), dur = 1200 + Math.random() * 1600;
      const step = now => {
        const p = Math.min(1, (now - t0) / dur);
        li.style.setProperty('--p', p); $('em', li).textContent = Math.round(p * 100) + '%';
        if (p < 1) requestAnimationFrame(step); else { li.classList.add('done'); $('em', li).textContent = '✓ done'; }
      };
      requestAnimationFrame(step);
    };
    ['dragenter', 'dragover'].forEach(t => zone.addEventListener(t, e => { e.preventDefault(); zone.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(t => zone.addEventListener(t, () => zone.classList.remove('over')));
    zone.addEventListener('drop', e => { e.preventDefault(); [...e.dataTransfer.files].forEach(f => upload(f.name)); });
    input.addEventListener('change', () => { [...input.files].forEach(f => upload(f.name)); input.value = ''; });
    let n = 0;
    $('.p4-btn', wrap).addEventListener('click', () => upload(['holiday-photo.jpg', 'invoice-0425.pdf', 'brand-guide.fig', 'demo-reel.mp4'][n++ % 4]));
  } catch (err) { console.error('[demo dropzone]', err); }
  // ==/demo==

  // ==demo:creditCard==
  try {
    const cc = $('#p4Cc'), f = k => $(`[data-f="${k}"]`, cc), num = $('.p4-card-num', cc);
    const renderNum = () => {
      const d = f('num').value.replace(/\D/g, '').slice(0, 16);
      f('num').value = d.replace(/(.{4})(?=.)/g, '$1 ');
      const shown = num.textContent.replace(/[\s•]/g, '');
      const groups = (d + '•'.repeat(16 - d.length)).match(/.{4}/g);
      num.innerHTML = groups.map(g => [...g].map(ch => `<span>${ch}</span>`).join('')).join(' ');
      // only the newly typed digit animates
      $$('span', num).forEach((s, i) => { if (i !== d.length - 1 || d.length <= shown.length) s.style.animation = 'none'; });
    };
    f('num').addEventListener('input', renderNum);
    f('name').addEventListener('input', () => ($('.p4-card-name', cc).textContent = f('name').value || 'YOUR NAME'));
    f('exp').addEventListener('input', () => {
      const d = f('exp').value.replace(/\D/g, '').slice(0, 4);
      f('exp').value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
      $('.p4-card-exp', cc).textContent = f('exp').value || 'MM/YY';
    });
    f('cvc').addEventListener('input', () => ($('.p4-card-cvc', cc).textContent = f('cvc').value.replace(/\D/g, '') || '•••'));
    f('cvc').addEventListener('focus', () => cc.classList.add('p4-flipped'));
    f('cvc').addEventListener('blur', () => cc.classList.remove('p4-flipped'));
    renderNum();
  } catch (err) { console.error('[demo creditCard]', err); }
  // ==/demo==

  // ==demo:autocomplete==
  try {
    const ac = $('#p4Ac'), input = $('input', ac), ul = $('ul', ac);
    const all = ['Andorra', 'Angola', 'Argentina', 'Bangladesh', 'Canada', 'Denmark', 'France', 'Ghana', 'Iran', 'Japan', 'Jordan', 'Panama', 'Rwanda', 'Spain', 'Sudan', 'Tanzania', 'Uganda', 'Vietnam'];
    let shown = [], sel = 0;
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const open = o => { ac.classList.toggle('open', o); input.setAttribute('aria-expanded', o); };
    const render = () => {
      const q = input.value.trim();
      shown = q ? all.filter(c => c.toLowerCase().includes(q.toLowerCase())).slice(0, 5) : [];
      sel = 0;
      ul.innerHTML = shown.map((c, i) => `<li role="option" style="--i:${i}" class="${i ? '' : 'on'}">${c.replace(new RegExp(esc(q), 'i'), m => `<mark>${m}</mark>`)}</li>`).join('');
      open(shown.length > 0);
    };
    const pick = i => { if (!shown[i]) return; input.value = shown[i]; open(false); };
    input.addEventListener('input', render);
    input.addEventListener('keydown', e => {
      if (!ac.classList.contains('open')) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length; $$('li', ul).forEach((li, i) => li.classList.toggle('on', i === sel)); }
      if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
      if (e.key === 'Escape') open(false);
    });
    ul.addEventListener('pointerdown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); pick($$('li', ul).indexOf(li)); } });
    input.addEventListener('blur', () => open(false));
  } catch (err) { console.error('[demo autocomplete]', err); }
  // ==/demo==

  // ==demo:holdBtn==
  try {
    const b = $('#p4Hold'), label = $('span', b);
    let holding = false;
    const start = () => { if (b.classList.contains('done')) return; holding = true; b.classList.add('holding'); };
    const stop = () => { holding = false; b.classList.remove('holding'); };
    b.addEventListener('pointerdown', e => { b.setPointerCapture(e.pointerId); start(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, stop));
    b.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(); } });
    b.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') stop(); });
    b.addEventListener('transitionend', e => {
      if (e.propertyName !== 'stroke-dashoffset' || !holding) return;
      holding = false; b.classList.remove('holding'); b.classList.add('done'); label.textContent = 'Deleted';
      setTimeout(() => { b.classList.remove('done'); label.textContent = 'Hold to delete'; }, 2200);
    });
  } catch (err) { console.error('[demo holdBtn]', err); }
  // ==/demo==

  // ==demo:slideConfirm==
  try {
    const sl = $('#p4Slide'), knob = $('button', sl), label = $('span', sl);
    let x0 = null, max = 0;
    const set = x => { sl.style.setProperty('--x', x + 'px'); sl.style.setProperty('--k', (x / max).toFixed(3)); };
    knob.addEventListener('pointerdown', e => {
      if (sl.classList.contains('done')) return;
      max = sl.clientWidth - 56; x0 = e.clientX; sl.classList.remove('back'); knob.setPointerCapture(e.pointerId);
    });
    knob.addEventListener('pointermove', e => { if (x0 !== null) set(clamp(e.clientX - x0, 0, max)); });
    const release = () => {
      if (x0 === null) return;
      x0 = null;
      const x = parseFloat(sl.style.getPropertyValue('--x')) || 0;
      sl.classList.add('back');
      if (x > max * .9) {
        set(max); sl.classList.add('done'); label.textContent = 'Paid ✓'; knob.textContent = '✓';
        setTimeout(() => { sl.classList.remove('done'); label.textContent = 'Slide to pay $49 →'; knob.textContent = '›'; set(0); }, 2200);
      } else set(0);
    };
    knob.addEventListener('pointerup', release); knob.addEventListener('pointercancel', release);
    knob.addEventListener('keydown', e => { if (e.key === 'Enter') { max = sl.clientWidth - 56; x0 = 0; set(max); release(); } }); // keyboard alternative
  } catch (err) { console.error('[demo slideConfirm]', err); }
  // ==/demo==

  // ==demo:chat==
  try {
    const chat = $('#p4Chat'), log = $('.p4-chat-log', chat), input = $('input', chat);
    const replies = ['Nice! 🎉', 'Ship it 🚀', 'Love the bounce on that bubble', 'Haha 😂'];
    let r = 0;
    const add = (html, cls) => { const p = document.createElement('p'); p.className = cls; p.innerHTML = html; log.appendChild(p); log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' }); return p; };
    $('form', chat).addEventListener('submit', e => {
      e.preventDefault();
      const text = input.value.trim(); if (!text) return;
      input.value = '';
      const p = add('', 'me'); p.textContent = text;
      const tick = document.createElement('small'); tick.textContent = '✓'; p.appendChild(tick);
      setTimeout(() => (tick.textContent = '✓✓'), 600);
      setTimeout(() => tick.classList.add('read'), 1200);
      setTimeout(() => {
        const typing = add('<i></i><i></i><i></i>', 'them typing');
        setTimeout(() => { typing.remove(); add('', 'them').textContent = replies[r++ % replies.length]; }, 1300);
      }, 1500);
    });
  } catch (err) { console.error('[demo chat]', err); }
  // ==/demo==

  // ==demo:island==
  try {
    const isl = $('#p4Island'), pill = $('.p4-pill', isl);
    let t = 0;
    $$('nav button', isl).forEach(b => b.addEventListener('click', () => {
      pill.className = 'p4-pill ' + b.dataset.k;
      clearTimeout(t); t = setTimeout(() => (pill.className = 'p4-pill'), 2800);
    }));
    $$('.p4-pill button', isl).forEach(b => b.addEventListener('click', () => { clearTimeout(t); pill.className = 'p4-pill'; }));
  } catch (err) { console.error('[demo island]', err); }
  // ==/demo==

  // ==demo:aiStream==
  try {
    const ai = $('#p4Ai'), out = $('.p4-ai-out', ai), btn = $('button', ai);
    const answer = 'Easing is the speed curve of an animation. Ease-out starts fast and slows down, so things feel like they arrive with weight; ease-in does the opposite and suits exits.';
    let busy = false;
    btn.addEventListener('click', () => {
      if (busy) return; busy = true;
      out.className = 'p4-ai-out'; out.innerHTML = '<span class="p4-ai-think">Thinking…</span>';
      setTimeout(() => {
        out.innerHTML = ''; out.classList.add('streaming');
        const words = answer.split(' ');
        let i = 0;
        const next = () => {
          if (i >= words.length) { out.classList.remove('streaming'); busy = false; return; }
          const s = document.createElement('span'); s.className = 'w'; s.textContent = words[i++] + ' ';
          out.appendChild(s); setTimeout(next, 45 + Math.random() * 70);
        };
        next();
      }, 1500);
    });
  } catch (err) { console.error('[demo aiStream]', err); }
  // ==/demo==

  // ==demo:reorder==
  try {
    const list = $('#p4Sort');
    let drag = null;
    const flip = (el, before) => { const after = el.getBoundingClientRect().top; el.animate([{ transform: `translateY(${before - after}px)` }, { transform: 'none' }], { duration: 220, easing: 'ease-out' }); };
    list.addEventListener('pointerdown', e => {
      const h = e.target.closest('b'); if (!h) return;
      const item = h.parentElement;
      drag = { item, grab: e.clientY - item.getBoundingClientRect().top, listTop: list.getBoundingClientRect().top };
      item.classList.remove('settle'); item.classList.add('lift'); h.setPointerCapture(e.pointerId);
    });
    list.addEventListener('pointermove', e => {
      if (!drag) return;
      const { item } = drag, top = e.clientY - drag.listTop - drag.grab; // wanted top inside the list
      const prev = item.previousElementSibling, next = item.nextElementSibling;
      if (next && top + item.offsetHeight / 2 > next.offsetTop + next.offsetHeight / 2) { const b = next.getBoundingClientRect().top; list.insertBefore(next, item); flip(next, b); }
      else if (prev && top + item.offsetHeight / 2 < prev.offsetTop + prev.offsetHeight / 2) { const b = prev.getBoundingClientRect().top; list.insertBefore(item, prev); flip(prev, b); }
      item.style.transform = `translateY(${top - item.offsetTop}px)`;
    });
    const drop = () => {
      if (!drag) return;
      const { item } = drag; drag = null;
      item.classList.add('settle'); item.classList.remove('lift'); item.style.transform = '';
    };
    list.addEventListener('pointerup', drop); list.addEventListener('pointercancel', drop);
  } catch (err) { console.error('[demo reorder]', err); }
  // ==/demo==

  // ==demo:kanban==
  try {
    const kb = $('#p4Kb');
    let dragging = null;
    kb.addEventListener('dragstart', e => { dragging = e.target.closest('p'); if (!dragging) return; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); requestAnimationFrame(() => dragging.classList.add('dragging')); });
    kb.addEventListener('dragend', () => { dragging?.classList.remove('dragging'); dragging = null; $$('.p4-kb-col', kb).forEach(c => c.classList.remove('over')); });
    $$('.p4-kb-col', kb).forEach(col => {
      col.addEventListener('dragover', e => {
        if (!dragging) return;
        e.preventDefault(); col.classList.add('over');
        const below = $$('p:not(.dragging)', col).find(p => e.clientY < p.getBoundingClientRect().top + p.offsetHeight / 2);
        if (below) col.insertBefore(dragging, below); else col.appendChild(dragging);
      });
      col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('over'); });
      col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('over'); });
    });
  } catch (err) { console.error('[demo kanban]', err); }
  // ==/demo==

  // ==demo:fling==
  try {
    const box = $('#p4Fling'), track = $('.p4-fling-track', box), STEP = 132;
    let x = 0, v = 0, down = false, lastX = 0, lastT = 0, raf = 0;
    const min = () => Math.min(0, box.clientWidth - 40 - track.scrollWidth);
    const draw = () => (track.style.transform = `translateX(${x}px)`);
    const loop = () => {
      if (!down) {
        x += v; v *= .95;
        const lo = min();
        if (x > 0) { x += -x * .2; v *= .5; } else if (x < lo) { x += (lo - x) * .2; v *= .5; }
        else if (Math.abs(v) < .6) { const target = clamp(Math.round(x / STEP) * STEP, lo, 0); x += (target - x) * .15; }
      }
      draw();
      raf = down || Math.abs(v) > .05 || Math.abs(x - clamp(Math.round(x / STEP) * STEP, min(), 0)) > .3 ? requestAnimationFrame(loop) : 0;
    };
    box.addEventListener('pointerdown', e => { down = true; v = 0; lastX = e.clientX; lastT = performance.now(); box.setPointerCapture(e.pointerId); if (!raf) raf = requestAnimationFrame(loop); });
    box.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - lastX, now = performance.now();
      const lo = min(), outside = x > 0 || x < lo;
      x += outside ? dx * .35 : dx;                       // resistance past the edges
      v = dx / Math.max(1, now - lastT) * 16;             // px per frame
      lastX = e.clientX; lastT = now;
    });
    const up = () => { down = false; if (!raf) raf = requestAnimationFrame(loop); };
    box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  } catch (err) { console.error('[demo fling]', err); }
  // ==/demo==

  // ==demo:zoomPan==
  try {
    const z = $('#p4Zoom'), img = $('.p4-zoom-img', z), out = $('output', z);
    let s = 1, x = 0, y = 0;
    const pts = new Map(); let pinch0 = null, pan0 = null;
    const fit = () => { const W = z.clientWidth, H = z.clientHeight; x = clamp(x, W - W * s, 0); y = clamp(y, H - H * s, 0); };
    const apply = () => { fit(); img.style.transform = `translate(${x}px, ${y}px) scale(${s})`; out.textContent = Math.round(s * 100) + '%'; z.classList.toggle('zoomed', s > 1); };
    const zoomAt = (px, py, ns) => { ns = clamp(ns, 1, 4); x = px - (px - x) * (ns / s); y = py - (py - y) * (ns / s); s = ns; apply(); };
    const local = e => { const r = z.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    z.addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); const [px, py] = local(e); zoomAt(px, py, s * Math.exp(-e.deltaY * .01)); }, { passive: false });
    z.addEventListener('dblclick', e => { const [px, py] = local(e); zoomAt(px, py, s > 1.5 ? 1 : 2.5); });
    z.addEventListener('pointerdown', e => { z.setPointerCapture(e.pointerId); pts.set(e.pointerId, local(e)); z.classList.add('dragging'); pan0 = [...local(e), x, y]; pinch0 = null; });
    z.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, local(e));
      if (pts.size === 2) {
        const [[ax, ay], [bx, by]] = [...pts.values()], d = Math.hypot(ax - bx, ay - by), cx = (ax + bx) / 2, cy = (ay + by) / 2;
        if (!pinch0) pinch0 = { d, s }; else zoomAt(cx, cy, pinch0.s * d / pinch0.d);
      } else if (s > 1) { const [px, py] = local(e); x = pan0[2] + px - pan0[0]; y = pan0[3] + py - pan0[1]; apply(); }
    });
    const lift = e => { pts.delete(e.pointerId); if (!pts.size) z.classList.remove('dragging'); pinch0 = null; if (pts.size === 1) { const [p] = pts.values(); pan0 = [...p, x, y]; } };
    z.addEventListener('pointerup', lift); z.addEventListener('pointercancel', lift);
  } catch (err) { console.error('[demo zoomPan]', err); }
  // ==/demo==

  // ==demo:spin360==
  try {
    const zone = $('#p4Spin'), box = $('.p4-spin-box', zone);
    let ry = 30, rx = -18, vy = 0, vx = 0, down = false, lx = 0, ly = 0, idle = 0;
    addLoop(zone, t => {
      if (!down) {
        ry += vy; rx = clamp(rx + vx, -60, 60); vy *= .95; vx *= .9;
        if (Math.abs(vy) < .05 && t - idle > 1500) ry += .25;   // gentle auto-rotate when resting
      }
      box.style.setProperty('--ry', ry + 'deg'); box.style.setProperty('--rx', rx + 'deg');
    });
    zone.addEventListener('pointerdown', e => { down = true; lx = e.clientX; ly = e.clientY; vx = vy = 0; zone.setPointerCapture(e.pointerId); });
    zone.addEventListener('pointermove', e => {
      if (!down) return;
      vy = (e.clientX - lx) * .5; vx = -(e.clientY - ly) * .3; ry += vy; rx = clamp(rx + vx, -60, 60);
      lx = e.clientX; ly = e.clientY;
    });
    const up = () => { down = false; idle = performance.now(); };
    zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up);
  } catch (err) { console.error('[demo spin360]', err); }
  // ==/demo==

  // ==demo:cursorLabel==
  try {
    const zone = $('#p4Cl'), dot = $('.p4-cl-dot', zone);
    let x = 0, y = 0, tx = 0, ty = 0, raf = 0;
    const loop = () => { x += (tx - x) * .2; y += (ty - y) * .2; dot.style.transform = `translate(${x}px, ${y}px)`; raf = Math.abs(tx - x) + Math.abs(ty - y) > .2 ? requestAnimationFrame(loop) : 0; };
    zone.addEventListener('pointermove', e => {
      const r = zone.getBoundingClientRect(); tx = e.clientX - r.left; ty = e.clientY - r.top;
      const label = e.target.closest('[data-cursor]')?.dataset.cursor;
      dot.classList.toggle('big', !!label); dot.textContent = label || '';
      if (!raf) raf = requestAnimationFrame(loop);
    });
    zone.addEventListener('pointerenter', e => { const r = zone.getBoundingClientRect(); x = tx = e.clientX - r.left; y = ty = e.clientY - r.top; });
  } catch (err) { console.error('[demo cursorLabel]', err); }
  // ==/demo==

  // ==demo:blendCursor==
  try {
    const bc = $('#p4Bc'), ball = $('b', bc);
    bc.addEventListener('pointermove', e => {
      const r = bc.getBoundingClientRect();
      ball.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`;
    });
    bc.addEventListener('pointerleave', () => (ball.style.transform = 'translate(-200px, -200px)'));
  } catch (err) { console.error('[demo blendCursor]', err); }
  // ==/demo==

  // ==demo:imageTrail==
  try {
    const tr = $('#p4Trail');
    const looks = ['linear-gradient(135deg,#7c5cff,#ff5c8a)', 'linear-gradient(135deg,#22d3ee,#34d399)', 'linear-gradient(135deg,#fbbf24,#f97316)', 'linear-gradient(180deg,#fbbf24,#f97316 40%,#7c3aed)', 'linear-gradient(135deg,#ff5c8a,#fbbf24)'];
    let lx = -999, ly = -999, k = 0;
    tr.addEventListener('pointermove', e => {
      const r = tr.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (Math.hypot(x - lx, y - ly) < 70) return;
      lx = x; ly = y;
      const img = document.createElement('i');
      img.style.background = looks[k++ % looks.length];
      img.style.transform = `translate(${x}px, ${y}px) rotate(${(Math.random() - .5) * 16}deg)`;
      tr.appendChild(img);
      img.addEventListener('animationend', () => img.remove());
    });
  } catch (err) { console.error('[demo imageTrail]', err); }
  // ==/demo==

  // ==demo:fullSnap==
  try {
    const box = $('#p4Snap');
    const io = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('in', e.isIntersecting)), { root: box, threshold: .6 });
    $$('.p4-snap-p', box).forEach(p => io.observe(p));
  } catch (err) { console.error('[demo fullSnap]', err); }
  // ==/demo==

  // ==demo:splitScroll==
  try {
    const box = $('#p4Split'), pics = $$('.p4-split-pin i', box), paras = $$('.p4-split-text p', box);
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const i = paras.indexOf(e.target);
      paras.forEach((p, k) => p.classList.toggle('on', k === i)); pics.forEach((p, k) => p.classList.toggle('on', k === i));
    }), { root: box, rootMargin: '-45% 0px -45% 0px' });
    paras.forEach(p => io.observe(p));
  } catch (err) { console.error('[demo splitScroll]', err); }
  // ==/demo==

  // ==demo:frameParallax==
  try {
    const box = $('#p4Fp'), frames = $$('.p4-fp > div', box);
    const update = () => {
      const vh = box.clientHeight;
      frames.forEach(f => {
        const top = f.offsetTop - box.scrollTop, p = clamp((top + f.offsetHeight) / (vh + f.offsetHeight), 0, 1);
        f.firstElementChild.style.transform = `translateY(${(p - .5) * 30}%)`;
      });
    };
    box.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
    update();
  } catch (err) { console.error('[demo frameParallax]', err); }
  // ==/demo==

  // ==demo:preloader==
  try {
    const pre = $('#p4Pre'), cover = $('.p4-pre-cover', pre), num = $('b', cover);
    let raf = 0;
    const run = () => {
      cancelAnimationFrame(raf); pre.classList.remove('done');
      const t0 = performance.now();
      const tick = now => {
        const p = Math.min(1, (now - t0) / 1800), e = 1 - Math.pow(1 - p, 3);
        num.textContent = Math.round(e * 100); cover.style.setProperty('--p', e);
        if (p < 1) raf = requestAnimationFrame(tick); else setTimeout(() => pre.classList.add('done'), 200);
      };
      raf = requestAnimationFrame(tick);
    };
    replayHandlers.preloader = run;
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { run(); o.disconnect(); } }, { threshold: .6 }).observe(pre);
  } catch (err) { console.error('[demo preloader]', err); }
  // ==/demo==

  // ==demo:topBar==
  try {
    const tb = $('#p4Tb'), bar = $('.p4-tb-bar', tb), fill = $('i', bar), page = $('.p4-tb-page', tb);
    let p = 0, timer = 0;
    const set = v => fill.style.setProperty('--p', (p = v));
    $$('nav a', tb).forEach(a => a.addEventListener('click', e => {
      e.preventDefault(); clearInterval(timer);
      $$('nav a', tb).forEach(x => x.classList.toggle('on', x === a));
      bar.classList.add('on'); set(.08); page.classList.add('loading');
      timer = setInterval(() => set(p + (0.9 - p) * .15), 200);               // trickle
      setTimeout(() => {                                                       // "page loaded"
        clearInterval(timer); set(1);
        const h = $('h4', page); h.textContent = a.textContent; h.style.animation = 'none'; void h.offsetWidth; h.style.animation = ''; page.classList.remove('loading'); // replay the heading's entrance
        setTimeout(() => { bar.classList.remove('on'); setTimeout(() => set(0), 400); }, 300);
      }, 900 + Math.random() * 900);
    }));
  } catch (err) { console.error('[demo topBar]', err); }
  // ==/demo==

  // ==demo:hotspots==
  try {
    const hot = $('#p4Hot'), btns = $$('button', hot);
    btns.forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const on = !b.classList.contains('on'); btns.forEach(x => x.classList.remove('on')); b.classList.toggle('on', on); }));
    document.addEventListener('click', () => btns.forEach(x => x.classList.remove('on')));
  } catch (err) { console.error('[demo hotspots]', err); }
  // ==/demo==

  // ==demo:pieExplode==
  try {
    const pie = $('#p4Pie'), svg = $('svg', pie), label = $('b', pie), name = $('span', pie);
    const data = [['Design', 38, '#7c5cff'], ['Code', 27, '#ff5c8a'], ['Testing', 20, '#22d3ee'], ['Docs', 15, '#fbbf24']];
    let a = -Math.PI / 2;
    data.forEach(([n, v, c], i) => {
      const b = a + v / 100 * Math.PI * 2, R = 100, r = 52, mid = (a + b) / 2, large = b - a > Math.PI ? 1 : 0;
      const P = (ang, rad) => `${Math.cos(ang) * rad} ${Math.sin(ang) * rad}`;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${P(a, R)} A ${R} ${R} 0 ${large} 1 ${P(b, R)} L ${P(b, r)} A ${r} ${r} 0 ${large} 0 ${P(a, r)} Z`);
      path.setAttribute('fill', c);
      path.style.cssText = `--i:${i};--dx:${Math.cos(mid) * 10}px;--dy:${Math.sin(mid) * 10}px`;
      path.addEventListener('pointerenter', () => { label.textContent = v + '%'; name.textContent = n; });
      path.addEventListener('pointerleave', () => { label.textContent = '100%'; name.textContent = 'Total'; });
      svg.appendChild(path); a = b;
    });
  } catch (err) { console.error('[demo pieExplode]', err); }
  // ==/demo==

  // ==demo:heatmap==
  try {
    const heat = $('#p4Heat'), shades = ['#1b202c', '#3b2f7a', '#5b45c9', '#7c5cff', '#b3a3ff'];
    const cols = innerWidth < 520 ? 22 : 26;
    for (let c = 0; c < cols; c++) for (let r = 0; r < 7; r++) {
      const v = Math.max(0, Math.round(Math.sin(c * .5 + r) * 2 + Math.random() * 3 - .5)), lvl = Math.min(4, v);
      const i = document.createElement('i');
      i.style.cssText = `--c:${shades[lvl]};--d:${(c + r) * 18}ms`; i.title = v * 3 + ' contributions';
      heat.appendChild(i);
    }
  } catch (err) { console.error('[demo heatmap]', err); }
  // ==/demo==

  // ==demo:barRace==
  try {
    const race = $('#p4Race2');
    const rows = [['React', '#22d3ee'], ['Vue', '#34d399'], ['Svelte', '#ff5c8a'], ['Angular', '#e11d48'], ['Solid', '#7c5cff']].map(([n, c], k) => {
      const el = document.createElement('div');
      el.innerHTML = `<span>${n}</span><i style="--c:${c}"></i><b>0</b>`; race.appendChild(el);
      return { el, bar: $('i', el), num: $('b', el), v: 40 + k * 12, shown: 0 };
    });
    const tween = r => {
      const from = r.shown, to = Math.round(r.v), t0 = performance.now();
      const step = now => { const p = Math.min(1, (now - t0) / 600); r.shown = from + (to - from) * (1 - Math.pow(1 - p, 3)); r.num.textContent = Math.round(r.shown); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    };
    const render = () => {
      const max = Math.max(...rows.map(r => r.v));
      [...rows].sort((a, b) => b.v - a.v).forEach((r, rank) => { r.el.style.transform = `translateY(${rank * 34}px)`; r.bar.style.transform = `scaleX(${r.v / max})`; tween(r); });
    };
    render();
    setInterval(() => { if (!live(race)) return; rows.forEach(r => (r.v = Math.max(5, r.v + (Math.random() - .45) * 26))); render(); }, 2000);
  } catch (err) { console.error('[demo barRace]', err); }
  // ==/demo==

  // ==demo:scratch==
  try {
    const sc = $('#p4Scratch'), cv = $('canvas', sc), ctx = cv.getContext('2d');
    let down = false, moves = 0;
    const paint = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = sc.clientWidth * dpr; cv.height = sc.clientHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = ctx.createLinearGradient(0, 0, sc.clientWidth, sc.clientHeight);
      g.addColorStop(0, '#9ca3af'); g.addColorStop(.5, '#e5e7eb'); g.addColorStop(1, '#9ca3af');
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = g; ctx.fillRect(0, 0, sc.clientWidth, sc.clientHeight);
      ctx.fillStyle = '#4b5563'; ctx.font = '700 15px system-ui'; ctx.textAlign = 'center'; ctx.fillText('SCRATCH HERE', sc.clientWidth / 2, sc.clientHeight / 2 + 5);
      sc.classList.remove('won');
    };
    const cleared = () => { const d = ctx.getImageData(0, 0, cv.width, cv.height).data; let clear = 0, n = 0; for (let i = 3; i < d.length; i += 64) { n++; if (d[i] === 0) clear++; } return clear / n; };
    const scratch = e => {
      const r = cv.getBoundingClientRect();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(e.clientX - r.left, e.clientY - r.top, 18, 0, Math.PI * 2); ctx.fill();
      if (++moves % 8 === 0 && cleared() > .5) sc.classList.add('won');
    };
    cv.addEventListener('pointerdown', e => { down = true; cv.setPointerCapture(e.pointerId); scratch(e); });
    cv.addEventListener('pointermove', e => { if (down) scratch(e); });
    cv.addEventListener('pointerup', () => (down = false));
    $('.p4-btn', sc).addEventListener('click', paint);
    paint();
  } catch (err) { console.error('[demo scratch]', err); }
  // ==/demo==

  // ==demo:wheel==
  try {
    const w = $('#p4Wheel'), disc = $('.p4-wheel-disc', w), out = $('output', w);
    const prizes = ['10% off', 'Free ship', '🎁 Gift', 'Try again', '20% off', 'Sticker', '50% off', '🍀 Lucky'];
    prizes.forEach((p, i) => disc.insertAdjacentHTML('beforeend', `<span style="--a:${i * 45}deg" data-t="${p}"></span>`));
    let angle = 0, busy = false;
    $('.p4-btn', w).addEventListener('click', () => {
      if (busy) return; busy = true;
      const k = Math.floor(Math.random() * prizes.length);
      angle += 360 * 5 + ((360 - k * 45) - (angle % 360) + 360) % 360;
      disc.style.transition = 'rotate 4s cubic-bezier(.12, .8, .2, 1)'; disc.style.rotate = angle + 'deg';
      w.classList.add('spinning'); out.classList.remove('p4-win'); out.textContent = 'Spinning…';
      setTimeout(() => w.classList.remove('spinning'), 2600);
      disc.addEventListener('transitionend', () => { busy = false; out.textContent = 'You got: ' + prizes[k]; restart(out, 'p4-win'); }, { once: true });
    });
  } catch (err) { console.error('[demo wheel]', err); }
  // ==/demo==

  // ==demo:dice==
  try {
    const dice = $('#p4Dice'), die = $('.p4-die', dice), out = $('output', dice);
    const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };   // cells 1–9 of a 3×3 grid
    $$('i', die).forEach(f => { for (let c = 1; c <= 9; c++) f.insertAdjacentHTML('beforeend', PIPS[f.dataset.n].includes(c) ? '<u></u>' : '<s></s>'); });
    const FACE = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
    let spins = 0;
    $('button', dice).addEventListener('click', () => {
      const n = 1 + Math.floor(Math.random() * 6), [x, y] = FACE[n];
      spins += 2;
      die.style.transform = `rotateX(${x + spins * 360 - 20}deg) rotateY(${y + spins * 360 + 25}deg)`;
      out.textContent = '';
      die.addEventListener('transitionend', () => (out.textContent = 'You rolled ' + n), { once: true });
    });
  } catch (err) { console.error('[demo dice]', err); }
  // ==/demo==

  // ==demo:colorSwap==
  try {
    const sw = $('#p4Swap'), item = $('.p4-swap-item i', sw), name = $('.p4-swap-info span', sw);
    $$('.p4-swap-sw button', sw).forEach(b => b.addEventListener('click', () => {
      $$('.p4-swap-sw button', sw).forEach(x => x.classList.toggle('on', x === b));
      sw.style.setProperty('--c', b.style.getPropertyValue('--c'));
      restart(item, 'p4-bounce');
      name.textContent = b.dataset.n; name.style.animation = 'none'; void name.offsetWidth; name.style.animation = '';
    }));
  } catch (err) { console.error('[demo colorSwap]', err); }
  // ==/demo==

  // ==demo:priceFlash==
  try {
    const tbody = $('#p4Tick tbody');
    const rows = [['ACME', 182.4], ['GLOBX', 54.12], ['INITECH', 9.87], ['UMBRL', 311.05]].map(([sym, p]) => {
      const tr = document.createElement('tr'); tr.innerHTML = `<td>${sym}</td><td>${p.toFixed(2)}</td>`; tbody.appendChild(tr);
      return { cell: tr.lastChild, p };
    });
    setInterval(() => {
      if (!live(tbody)) return;
      const r = rows[Math.floor(Math.random() * rows.length)], old = r.p;
      r.p = Math.max(1, r.p * (1 + (Math.random() - .5) * .03));
      r.cell.textContent = r.p.toFixed(2);
      r.cell.classList.remove('up', 'down'); void r.cell.offsetWidth;
      r.cell.classList.add(r.p >= old ? 'up' : 'down');
    }, 700);
  } catch (err) { console.error('[demo priceFlash]', err); }
  // ==/demo==
})();
