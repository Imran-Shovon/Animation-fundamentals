---
name: animation-playground
description: Add, edit, fix or reorganize demos in the "Animation Principles & Web Motion Playground" (single-file index.html with 226 live HTML/CSS/JS animation demos). Use whenever working on this project — adding a new animation demo, changing an existing one, adding a section, fixing a "Show code" panel, renumbering demos, or touching the shared page JS (pause, replay, reveal, canvas ticker).
---

# Animation Principles & Web Motion Playground

A static, dependency-free reference page. **Everything lives in one file: `index.html`** (~14.4k lines, ~820 KB). No build step, no package.json, no external assets — open the file in a browser to test.

## File layout (top → bottom)

| Lines (approx.) | Part |
|---|---|
| 1–12 | `<head>`; inline `<script>` adds `.js` to `<html>` (gates the `.reveal` styles) |
| 13–2044 | The one `<style>` block |
| 2047–2050 | Hidden `<svg>` with shared filters `#goo` and `#goo-lava` |
| 2051 | `#pageProgress` scroll progress bar |
| 2053–2072 | Hero (`header.hero`, `#pauseAll` button, `.motion-note`) |
| 2074–2099 | Sticky TOC `nav.toc` — one `<li><a href="#id">` per section |
| 2100–13433 | `<main>` — 22 `<section class="section" id="…">` blocks |
| 13434 | Footer |
| 13435–14387 | The one `<script>` (IIFE) — shared helpers + per-demo JS |

Use `grep -n '<!-- ================= ' index.html` to jump between sections; never read the whole file at once.

### CSS block order
1 Design tokens (`:root`) · 2 Base · 3 Hero · 4 TOC · 5 Layout (`.grid`, `.card`, `.stage`, `.tiles`, `.box`, `.dot`, `.scene`, `.lanes`, `.reveal`) · 6 Anatomy · 7+ one commented block per section/demo (`/* 01 Squash & stretch */`) · best practices / footer / reduced-motion / mobile · **PERFORMANCE HELPERS** (`.offscreen`, `.rs`) · "NEW DEMOS — part 2" (`/* ---------- more <section> ---------- */` blocks) · **DEMO LAYOUT** (`.demos`, `.demo`, `.badge`, `.demo-box`, `.demo-foot`, `.code-panel`).

### Sections (id → number → badge text)
`anatomy` 00 · `disney` 01 *Classic principle* · `ux` 02 *UX principle* · `easing` 03 *Easing* · `entrance` 04 *Entrance* · `exit` 05 *Exit* · `attention` 06 *Attention* · `hover` 07 *Hover* · `pointer` 08 *Pointer* · `loaders` 09 *Loader* · `text` 10 *Text* · `scroll` 11 *Scroll* · `micro` 12 *Micro-interaction* · `ui` 13 *UI transition* · `pages` 14 *Page transition* · `media` 15 *Image &amp; media* · `data` 16 *Data viz* · `physics` 17 *Physics* · `bg` 18 *Background* · `svg` 19 *SVG* · `three` 20 *3D* · `best` 21 (no demos).

Note: some HTML comments carry stale numbers (e.g. `<!-- 15 SVG -->` is section 19). Trust the `sec-num` span, not the comment.

## Design tokens — always use these, never hard-code new colors
```
--bg #0c0e14  --panel #141821  --panel-2 #1b202c  --line #262c3b
--text #e9ebf3  --muted #9aa3b8
--violet #7c5cff  --pink #ff5c8a  --cyan #22d3ee  --amber #fbbf24  --green #34d399
--grad: linear-gradient(135deg, violet, pink)   --radius: 14px   --mono
--ease-out cubic-bezier(.22,1,.36,1)  --ease-in cubic-bezier(.55,0,1,.45)  --ease-back cubic-bezier(.34,1.56,.64,1)
```
Canvas demos use `PALETTE = ['#7c5cff','#ff5c8a','#22d3ee','#fbbf24','#34d399']`.
Shared shapes: `.box` (56px gradient square, `.box.sm` 46px), `.dot` (cyan circle), `.scene` (fake sunset "photo"), `.lanes > .lane > i` (dot racing across, driven by `--fn`, `--d`, `--c`), `.lbl` (small mono caption positioned inside a stage).

## Anatomy of a demo (copy this exactly)

Each demo is one `<article>` written on as few lines as possible:

```html
<article class="demo reveal">
  <div class="demo-meta">
    <span class="badge">Hover</span>
    <span class="badge js">JS</span>            <!-- only if the demo needs JavaScript -->
    <span class="count">NN / 226</span>
  </div>
  <h3>Demo title</h3>
  <p class="desc">What it is, with <b>the key idea</b> in bold.</p>
  <p class="desc use"><b>On the web:</b> where real sites use it.</p>  <!-- principles; tiles use <b>Used for:</b> -->
  <div class="demo-box">
    <div class="stage">                         <!-- .short / .tall, data-loop, data-js-replay="key" -->
      … live markup …
    </div>
    <div class="demo-foot">
      <button aria-expanded="false" class="foot-btn show-code" type="button">Show code</button>
      <button class="foot-btn replay-btn" type="button">Replay <span class="ico">↻</span></button>
    </div>
    <div class="code-panel" hidden="">
      <div class="code-block key">…Key idea…</div>   <!-- optional, 1–3 lines -->
      <div class="code-block">…HTML…</div>
      <div class="code-block">…CSS…</div>
      <div class="code-block">…JavaScript…</div>     <!-- only for JS demos -->
    </div>
  </div>
</article>
```

Each code block:
```html
<div class="code-block"><div class="code-head"><span>CSS</span><button class="copy-code" type="button">Copy</button></div><pre><code>…</code></pre></div>
```
- Labels are exactly `Key idea`, `HTML`, `CSS`, `JavaScript`.
- The HTML block shows the stage's inner markup **HTML-escaped** (`&lt;` `&gt;` `&amp;`).
- The CSS block starts with the comment `/* var(--violet), var(--ease-out)… are design tokens defined once in :root */`, then a blank line, then **every rule the demo uses** — including shared ones like `.box` — expanded one declaration per line, followed by its `@keyframes`. It is a copy of the real stylesheet rules: if you change a demo's CSS in `<style>`, update its panel too (and vice-versa).
- The JavaScript block is the demo's `{ … }` block from the script (the code between its `// ==demo:id==` markers).

Containers: Part‑1 sections and most catalog sections use `<div class="demos">` (wide cards). Tile galleries use `<div class="demos mini loop-gallery">` (entrance, exit, …) — stages inside `.loop-gallery` auto-replay every 3.4 s.

## Adding a demo — checklist

1. **Markup**: add the `<article>` in the right section's `.demos` container, following the template above.
2. **CSS**: add rules to `<style>` under that section's block (or a `/* ---------- more <section> ---------- */` block). Prefix class names to avoid collisions — the file has hundreds of demos; `grep -n '\.myclass\b' index.html` and `grep -n '@keyframes myname' index.html` before choosing a name.
3. **JS (only if needed)**: add a block inside the IIFE, near its section's group comment (`/* ---------- Micro-interactions ---------- */` etc.):
   ```js
   // ==demo:myDemoId==
   {
     const el = $('#myDemoId');
     …
   }
   // ==/demo==
   ```
   and add `<span class="badge js">JS</span>` to the demo meta.
4. **Code panel**: fill Key idea / HTML / CSS / JavaScript as described above.
5. **Renumber**: counts are global and sequential (`01 / 226` … `226 / 226`). Inserting a demo shifts every later number *and* the total. Also update the total in the hero `.lead` text ("226 live demos"). A safe way:
   ```bash
   python - <<'EOF'
   import re, io
   p='index.html'; s=open(p,encoding='utf-8').read()
   n=len(re.findall(r'<span class="count">\d+ / \d+</span>', s)); i=0
   def f(m):
       global i; i+=1; return f'<span class="count">{i:02d} / {n}</span>'
   s=re.sub(r'<span class="count">\d+ / \d+</span>', f, s)
   s=re.sub(r'\b\d+ live demos', f'{n} live demos', s)
   open(p,'w',encoding='utf-8',newline='').write(s)
   print(n)
   EOF
   ```
6. **New section?** Add `<section class="section" id="x">` with `<div class="sec-head reveal"><span class="sec-num">NN</span><h2>…</h2></div>` and a `<p class="sec-intro reveal">`, a TOC `<li>`, and renumber later `sec-num`s.

## Shared JS helpers (inside the IIFE — reuse, don't re-implement)

| Helper | Purpose |
|---|---|
| `$(sel, root)`, `$$(sel, root)` | querySelector / querySelectorAll → array |
| `clamp(v, a, b)` | clamp |
| `isPaused()` | true when the global pause is on (`body.paused`) |
| `live(el)` | true only if el's `.stage` is on screen, not paused, tab visible — **gate every `setInterval` / timer-driven demo with it** |
| `replay(stage)` | restarts CSS animations (adds `.rs` for two frames) and calls `replayHandlers[stage.dataset.jsReplay]` |
| `replayHandlers.key = fn` | JS replay hook; pair with `data-js-replay="key"` on the stage |
| `restart(el, cls)` | remove/reflow/re-add a class to retrigger a one-shot CSS animation |
| `setupCanvas(host)` | DPR-aware canvas sizing → `{cv, ctx, w(), h()}`; host contains a `<canvas>` |
| `addLoop(el, fn(t))` | register on the single shared rAF ticker; auto-skipped when off screen/paused |
| `copyText(str)` | clipboard with fallback |
| `[data-split="chars"|"words"]` | auto-splits text into `<span style="--i:n">` for staggered CSS (`animation-delay: calc(var(--i) * 40ms)`) |

## Performance & accessibility rules this project follows

- Animate **`transform` and `opacity`** (occasionally `filter`/`clip-path`). Don't animate layout properties; fade a pseudo-element instead of animating `box-shadow`.
- No `backdrop-filter` blur on sticky/scrolling elements; prefer gradients over `filter: blur` for big soft shapes.
- Every stage is observed: off-screen stages get `.offscreen` (CSS animations paused). JS loops must use `addLoop` or check `live()`; pointer-driven rAF loops start on `pointerenter`/`pointerdown` and stop when settled or on `pointerleave`.
- Scroll handlers are `{ passive: true }`; batch writes in `requestAnimationFrame`.
- Global pause (`body.paused`) must stop the demo — CSS animations pause automatically; SMIL is handled; JS timers must check `isPaused()`/`live()`.
- `prefers-reduced-motion: reduce` → page starts paused and `.motion-note` shows. Don't add motion that bypasses this.
- Use real `<button type="button">` for controls, keep `aria-expanded`/`aria-label` in sync, `aria-hidden` on decorative split spans.
- Progressive features (`animation-timeline`, `startViewTransition`) need a fallback: `@supports` / feature-detect (see the scroll-driven demo and the FLIP fallback in `vtGrid`).
- Mobile: layouts must work down to ~360px (`min(100%, 500px)` grid columns, `@media (max-width: 520px)` block).

## Verifying a change
1. Open `index.html` in a browser (or `python -m http.server` and visit it) and check the demo animates, Replay works, Show code opens/copies, and Pause all motion stops it.
2. Check the console has no errors — one failing `$('#id')` throws and kills **every** later demo in the IIFE.
3. Confirm counts are sequential: `grep -o '<span class="count">[^<]*' index.html | tail -3`.

## Known quirks
- Footer text says "every demo's source is in `styles.css`" but CSS is inline in `index.html`.
- README is minimal; there is no build tooling — edits are made directly to `index.html`.
