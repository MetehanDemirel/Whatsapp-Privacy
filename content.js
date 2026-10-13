/* WhatsApp Privacy page script. Runs only on https://web.whatsapp.com/* and processes everything locally.
 *
 * Staying reliable when WhatsApp changes:
 *  - Blur targets are whole blocks (chat rows, message rows, images) found through ARIA roles and plain
 *    elements, never WhatsApp's generated class names.
 *  - The chat list and conversation are found through a chain of fallbacks (REGIONS). If a region is
 *    found but its contents no longer match, the whole region is blurred instead (fails closed).
 *  - "Hide everything", auto-blur and the lock blur the page itself and need no WhatsApp selectors.
 */
(() => {
  'use strict';

  const root = document.documentElement;
  const ROW = '[role="row"], [role="listitem"]';
  const outermost = (sel) => `:is(${sel}):not(:is(${sel}) *)`; // one blur per block, never stacked
  const q = (sel, ctx = document) => ctx.querySelector(sel);

  // Tried in order. When WhatsApp renames something, add a candidate here.
  const REGIONS = {
    list: () => q('#pane-side') || q('#side [role="grid"]') || q('[aria-label="Chat list"]') || q('#side'),
    conv: () => q('#main') || convFromComposer(),
  };

  function convFromComposer() {
    let el = q('footer [contenteditable="true"]')?.closest('footer')?.parentElement;
    while (el && el !== document.body) {
      if (q('header', el)) return el;
      el = el.parentElement;
    }
    return null;
  }

  // region: 'list' | 'conv' | 'page'. expect: must match when the region has content, otherwise blur the region.
  const RULES = [
    // Whole chat rows: name, last message, time and photo (story ring included) blur as one block.
    { area: 'list', region: 'list', sel: ROW, expect: true, clip: true },
    { area: 'header', region: 'conv', sel: 'header :is(img, svg:has(image), span):not([data-icon], [data-icon] *)' },
    // Whole message rows, so group sender names and phone numbers are covered too.
    { area: 'messages', region: 'conv', sel: ':is(.message-in, .message-out, [data-id]):not(header *, footer *)', expect: true, clip: true },
    { area: 'media', region: 'page', sel: ':is(img, video, svg:has(image)):not(.emoji, [data-plain-text], .wpg-ui *)' },
    { area: 'media', region: 'conv', sel: 'canvas' },
  ];

  let settings = WPG.merge();
  let lock = { locked: false, hash: '', salt: '' };
  let shortcuts = {};
  let idle = false;
  let lastActivity = Date.now();
  const regions = { list: null, conv: null };
  const ui = { lock: null, banner: null, dock: null };
  const inerted = new Set();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const style = document.createElement('style');
  style.id = 'wpg-style';
  root.appendChild(style);

  // Fail closed on load: if this page last saw a PIN, start locked until storage confirms.
  try { if (localStorage.getItem('wpg-pin') === '1') { lock.locked = true; lock.hash = 'pending'; root.classList.add('wpg-locked'); } } catch {}

  const alive = () => !!chrome.runtime?.id; // false after the extension is reloaded or removed
  const safe = (fn) => { try { fn(); } catch (e) { console.warn('[WhatsApp Privacy]', e); } };

  /* ---------- CSS ---------- */

  const scope = (region) => (region === 'page' ? 'body' : `[data-wpg-region="${region}"]`);

  function buildCss() {
    if (!settings.enabled) return '';
    const px = WPG.STRENGTH[settings.strength] ?? WPG.STRENGTH.medium;
    const anim = reduceMotion ? '' : 'transition:filter .2s ease;';
    // clip-path keeps a block's blur inside its own box, so it doesn't smear into its neighbours.
    const blur = (clip) => `{filter:blur(${px}px)!important;${clip ? 'clip-path:inset(0);' : ''}${anim}}`;
    const clear = '{filter:none!important;clip-path:none!important}';
    const out = [];
    for (const r of RULES) {
      if (!settings.areas[r.area]) continue;
      const s = scope(r.region);
      const t = outermost(r.sel);
      out.push(`${s} ${t}${blur(r.clip)}`);
      if (settings.reveal) out.push(`${s} ${t}:hover, ${s} :is(${ROW}, header):hover ${t}${clear}`);
    }
    out.push(`[data-wpg-region][data-wpg-fallback]${blur(true)}`);
    if (settings.reveal) out.push(`[data-wpg-region][data-wpg-fallback]:hover${clear}`);
    return out.join('\n');
  }

  function render() {
    if (!alive()) return;
    const css = buildCss();
    if (style.textContent !== css) style.textContent = css;
    if (!style.isConnected) root.appendChild(style);
    root.classList.toggle('wpg-curtain', settings.hideAll || idle);
    root.classList.toggle('wpg-locked', !!lock.locked);
    if (!document.body) return; // rendered again on DOMContentLoaded
    setInert(!!lock.locked);
    showLock(!!lock.locked);
    showBanner(settings.hideAll && !lock.locked);
    showDock(settings.dock && !lock.locked);
  }

  /* ---------- DOM scanning ---------- */

  function scan() {
    if (!alive()) return;
    for (const [name, find] of Object.entries(REGIONS)) {
      let el = null;
      safe(() => { el = find(); });
      if (regions[name] && regions[name] !== el) {
        regions[name].removeAttribute('data-wpg-region');
        regions[name].removeAttribute('data-wpg-fallback');
      }
      if (el && el.getAttribute('data-wpg-region') !== name) el.setAttribute('data-wpg-region', name);
      regions[name] = el;
    }
    checkCoverage();
    render();
    placeDockSoon();
  }

  function checkCoverage() {
    for (const name of ['list', 'conv']) {
      const region = regions[name];
      if (!region) continue;
      const expected = RULES.filter((r) => r.expect && r.region === name && settings.enabled && settings.areas[r.area]);
      const hasContent = expected.length && (q(ROW, region) || region.textContent.length > 40);
      const broken = !!hasContent && expected.some((r) => !q(outermost(r.sel), region));
      region.toggleAttribute('data-wpg-fallback', broken);
    }
  }

  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; safe(scan); }, 150);
  }

  /* ---------- page UI ---------- */

  function h(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
      else if (v != null && v !== false) e.setAttribute(k, v === true ? '' : v);
    }
    e.append(...kids);
    return e;
  }

  const t = (key, vars) => WPG.t(settings.lang, key, vars);
  const withKey = (label, cmd) => (shortcuts[cmd] ? `${label} (${shortcuts[cmd]})` : label);

  // Buttons in the empty part of WhatsApp's left icon bar.
  function showDock(on) {
    if (!on) { ui.dock?.remove(); ui.dock = null; return; }
    if (!ui.dock) {
      const btn = (id, cmd, onClick) => h('button', { type: 'button', class: 'wpg-dock-btn', 'data-id': id, 'data-cmd': cmd, on: { click: onClick } });
      ui.dock = h('div', { class: 'wpg-ui wpg-dock', role: 'toolbar', 'aria-label': 'WhatsApp Privacy', 'aria-orientation': 'vertical' },
        btn('blur', 'toggle-blur', () => WPG.update((s) => { s.enabled = !s.enabled; })),
        btn('hide', 'hide-all', () => WPG.update((s) => { s.hideAll = !s.hideAll; })),
        btn('lock', 'lock-now', () => WPG.updateLock({ locked: true })));
    }
    if (!ui.dock.isConnected) { document.body.append(ui.dock); placeDockSoon(true); }

    const state = {
      blur: [settings.enabled ? 'blur' : 'eye', t(settings.enabled ? 'blurIsOn' : 'blurIsOff'), settings.enabled],
      hide: ['hide', t(settings.hideAll ? 'showEverything' : 'hideEverything'), settings.hideAll],
      lock: ['lock', t('lock'), null],
    };
    for (const b of ui.dock.children) {
      const [icon, label, pressed] = state[b.dataset.id];
      if (b.dataset.icon !== icon) { b.replaceChildren(WPG.icon(icon)); b.dataset.icon = icon; }
      const full = withKey(label, b.dataset.cmd);
      b.setAttribute('aria-label', full);
      b.title = full;
      if (shortcuts[b.dataset.cmd]) b.setAttribute('aria-keyshortcuts', shortcuts[b.dataset.cmd].replace(/\s/g, ''));
      if (pressed !== null) b.setAttribute('aria-pressed', String(pressed));
    }
  }

  // Finds WhatsApp's left icon bar by its shape (a tall, narrow column on the left edge), so it
  // does not depend on labels or class names. Falls back to a floating dock.
  function findRail() {
    const hit = document.elementsFromPoint(24, Math.round(innerHeight / 2)).find((e) => !e.closest('.wpg-ui'));
    for (let el = hit; el && el !== document.body; el = el.parentElement) {
      const r = el.getBoundingClientRect();
      if (r.left <= 2 && r.width >= 40 && r.width <= 110 && r.height >= innerHeight * 0.6) return el;
    }
    return null;
  }

  function isDark(el) {
    for (; el; el = el.parentElement) {
      const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
      if (m && (m[3] === undefined || Number(m[3]) > 0.5)) return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) < 128;
    }
    return matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function placeDock() {
    const rail = findRail();
    root.classList.toggle('wpg-dark', isDark(rail || q('#side') || q('#app') || document.body));
    const d = ui.dock;
    if (!d?.isConnected) return;
    if (!rail) { d.classList.add('wpg-dock-float'); d.style.left = d.style.top = ''; return; }

    // Put the dock at the top of the largest empty gap between the bar's own buttons.
    const r = rail.getBoundingClientRect();
    const items = [...rail.querySelectorAll('button, [role="button"], a[href]')]
      .map((b) => b.getBoundingClientRect()).filter((b) => b.height > 0).sort((a, b) => a.top - b.top);
    let bottom = r.top;
    let gap = { top: r.top, size: 0 };
    for (const b of items) {
      if (b.top - bottom > gap.size) gap = { top: bottom, size: b.top - bottom };
      bottom = Math.max(bottom, b.bottom);
    }
    if (r.bottom - bottom > gap.size) gap = { top: bottom, size: r.bottom - bottom };
    if (gap.size < d.offsetHeight + 24) { d.classList.add('wpg-dock-float'); d.style.left = d.style.top = ''; return; }
    d.classList.remove('wpg-dock-float');
    d.style.left = `${Math.round(r.left + (r.width - d.offsetWidth) / 2)}px`;
    d.style.top = `${Math.round(gap.top + 12)}px`;
  }

  let lastPlace = 0;
  function placeDockSoon(force) {
    if (!force && Date.now() - lastPlace < 1000) return;
    lastPlace = Date.now();
    requestAnimationFrame(() => safe(placeDock));
  }
  window.addEventListener('resize', () => placeDockSoon(true));

  function showBanner(on) {
    if (ui.banner && (!on || ui.banner.lang !== settings.lang)) { ui.banner.remove(); ui.banner = null; }
    if (!on) return;
    if (!ui.banner) {
      ui.banner = h('button', { type: 'button', class: 'wpg-ui wpg-banner', lang: settings.lang, on: { click: () => WPG.update((s) => { s.hideAll = false; }) } },
        WPG.icon('eye', 18), h('span', {}, t('hiddenBanner')));
    }
    if (!ui.banner.isConnected) document.body.append(ui.banner);
  }

  function setInert(on) {
    if (on) {
      for (const c of document.body.children) {
        if (!c.classList.contains('wpg-ui') && !c.inert) { c.inert = true; inerted.add(c); }
      }
    } else {
      for (const c of inerted) c.inert = false;
      inerted.clear();
    }
  }

  async function tryUnlock(input, msg) {
    if (lock.hash) {
      const res = await WPG.checkPin(input.value);
      input.value = '';
      if (!res.ok) {
        msg.textContent = res.wait ? t('tooMany', { n: res.wait }) : t('wrongPin');
        input.focus();
        return;
      }
    }
    lastActivity = Date.now();
    await WPG.updateLock({ locked: false });
  }

  function showLock(on) {
    const key = `${!!lock.hash}|${settings.lang}`; // rebuild when the PIN or language changes
    if (ui.lock && (!on || ui.lock.dataset.key !== key)) { ui.lock.remove(); ui.lock = null; }
    if (!on) return;
    if (ui.lock) { if (!ui.lock.isConnected) document.body.append(ui.lock); return; }

    const msg = h('p', { class: 'wpg-msg', role: 'status', 'aria-live': 'polite' });
    const input = lock.hash
      ? h('input', { type: 'password', class: 'wpg-input', inputmode: 'numeric', autocomplete: 'off', maxlength: '64', 'aria-label': 'PIN', placeholder: 'PIN' })
      : null;
    const form = h('form', { class: 'wpg-card', on: { submit: (e) => { e.preventDefault(); tryUnlock(input, msg); } } },
      h('div', { class: 'wpg-lock-icon' }, WPG.icon('lock', 28)),
      h('h2', { id: 'wpg-lock-title' }, t('locked')),
      h('p', { id: 'wpg-lock-desc' }, t(lock.hash ? 'enterPin' : 'noPinLock')),
      ...(input ? [input] : []),
      h('button', { type: 'submit', class: 'wpg-btn' }, t('unlock')),
      msg);
    ui.lock = h('div', {
      class: 'wpg-ui wpg-lock', role: 'dialog', 'aria-modal': 'true', lang: settings.lang,
      'aria-labelledby': 'wpg-lock-title', 'aria-describedby': 'wpg-lock-desc', 'data-key': key,
    }, form);
    // Keep typing inside the lock away from WhatsApp's own keyboard handlers.
    for (const ev of ['keydown', 'keyup', 'keypress', 'beforeinput', 'input', 'paste']) {
      ui.lock.addEventListener(ev, (e) => e.stopPropagation());
    }
    document.body.append(ui.lock);
    (input || q('button', form)).focus();
  }

  /* ---------- activity, auto-blur, auto-lock ---------- */

  function onActivity() {
    lastActivity = Date.now();
    if (idle) { idle = false; render(); }
  }
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) {
    window.addEventListener(ev, onActivity, { capture: true, passive: true });
  }

  window.addEventListener('keydown', (e) => {
    if (!lock.locked) return;
    if (ui.lock?.contains(e.target)) {
      if (e.key === 'Tab') { // keep focus inside the lock
        const f = [...ui.lock.querySelectorAll('input, button')];
        const i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    ui.lock?.querySelector('input, button')?.focus();
  }, true);

  const timer = setInterval(() => {
    if (!alive()) { clearInterval(timer); return; }
    const away = Date.now() - lastActivity;
    const { autoBlur, autoLock } = settings;
    if (autoLock.on && !lock.locked && away > autoLock.minutes * 60000) {
      WPG.updateLock({ locked: true }).catch(() => {});
    } else if (autoBlur.on && !idle && !lock.locked && away > autoBlur.minutes * 60000) {
      idle = true;
      render();
    }
  }, 5000);

  /* ---------- boot ---------- */

  // Remember on this page whether a PIN exists, so the next load can lock instantly,
  // before storage answers and before WhatsApp draws anything.
  function setLock(l) {
    lock = { locked: false, hash: '', salt: '', ...l };
    try { localStorage.setItem('wpg-pin', lock.hash ? '1' : ''); } catch {}
  }

  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local') return;
    if (ch.settings) settings = WPG.merge(ch.settings.newValue);
    if (ch.lock) setLock(ch.lock.newValue);
    if (ch.shortcuts) shortcuts = ch.shortcuts.newValue || {};
    if (ch.settings || ch.lock || ch.shortcuts) safe(document.body ? scan : render);
  });

  Promise.all([WPG.get(), WPG.getLock(), chrome.storage.local.get('shortcuts')]).then(([s, l, k]) => {
    settings = s;
    setLock(l);
    shortcuts = k.shortcuts || {};
    // With a PIN, WhatsApp is always locked when it opens or reloads.
    if (lock.hash && !lock.locked) {
      lock.locked = true;
      WPG.updateLock({ locked: true }).catch(() => {});
    }
    safe(document.body ? scan : render);
  }).catch((e) => console.warn('[WhatsApp Privacy]', e));

  function ready() {
    safe(render);
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    schedule();
  }
  if (document.body) ready(); else document.addEventListener('DOMContentLoaded', ready, { once: true });
})();
