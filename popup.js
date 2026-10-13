'use strict';

const $ = (id) => document.getElementById(id);
let s = WPG.merge();
let lock = { hash: '' };
let cmds = [];
let loaded = false;
let unlocked = false; // only for this popup session; closing the popup locks the settings again
const t = (key, vars) => WPG.t(s.lang, key, vars);

function save(fn) {
  fn(s);
  render();
  WPG.set(s);
}

/* ---------- tabs ---------- */

const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(tab, focus) {
  for (const x of tabs) {
    const on = x === tab;
    x.setAttribute('aria-selected', String(on));
    x.tabIndex = on ? 0 : -1;
    $(x.getAttribute('aria-controls')).hidden = !on;
  }
  if (focus) tab.focus();
  try { localStorage.setItem('tab', tab.id); } catch {}
}
for (const tab of tabs) {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(tab);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    selectTab(tabs[(next + tabs.length) % tabs.length], true);
  });
}
try { const saved = $(localStorage.getItem('tab')); if (saved) selectTab(saved); } catch {}

/* ---------- build ---------- */

for (const el of document.querySelectorAll('[data-icon]')) {
  el.append(WPG.icon(el.dataset.icon, el.classList.contains('gate-icon') ? 32 : 22));
}

for (const key of WPG.AREAS) {
  const input = Object.assign(document.createElement('input'), { type: 'checkbox', className: 'switch', id: `area-${key}` });
  input.setAttribute('role', 'switch');
  input.addEventListener('change', () => save((x) => { x.areas[key] = input.checked; }));
  const txt = document.createElement('span');
  txt.className = 'txt';
  const strong = document.createElement('strong');
  const small = document.createElement('small');
  strong.dataset.i18n = `area.${key}`;
  small.dataset.i18n = `area.${key}.hint`;
  txt.append(strong, small);
  const label = document.createElement('label');
  label.className = 'row';
  label.append(txt, input);
  $('areas').append(label);
}

for (const sel of document.querySelectorAll('select[data-minutes]')) {
  for (const m of sel.dataset.minutes.split(',')) sel.append(new Option(m, m));
}

for (const b of document.querySelectorAll('[data-lang]')) {
  b.addEventListener('click', () => save((x) => { x.lang = b.dataset.lang; }));
}

$('act-blur').addEventListener('click', () => save((x) => { x.enabled = !x.enabled; }));
$('act-hide').addEventListener('click', () => save((x) => { x.hideAll = !x.hideAll; }));
$('act-lock').addEventListener('click', async () => { await WPG.updateLock({ locked: true }); window.close(); });

for (const r of document.getElementsByName('strength')) {
  r.addEventListener('change', () => save((x) => { x.strength = r.value; }));
}
$('reveal').addEventListener('change', (e) => save((x) => { x.reveal = e.target.checked; }));
$('dock').addEventListener('change', (e) => save((x) => { x.dock = e.target.checked; }));

$('autoBlurOn').addEventListener('change', (e) => save((x) => { x.autoBlur.on = e.target.checked; }));
$('autoBlurMin').addEventListener('change', (e) => save((x) => { x.autoBlur.minutes = Number(e.target.value); }));
$('autoLockOn').addEventListener('change', (e) => save((x) => { x.autoLock.on = e.target.checked; }));
$('autoLockMin').addEventListener('change', (e) => save((x) => { x.autoLock.minutes = Number(e.target.value); }));

// Status messages keep their key so they switch language too.
function pinMsg(key) {
  $('pinMsg').dataset.i18n = key;
  $('pinMsg').textContent = t(key);
}

$('gateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await WPG.checkPin($('gatePin').value);
  $('gatePin').value = '';
  if (res.ok) {
    unlocked = true;
    $('gateMsg').textContent = '';
    render();
    return;
  }
  $('gateMsg').textContent = res.wait ? t('tooMany', { n: res.wait }) : t('wrongPin');
  $('gatePin').focus();
});
$('gateLock').addEventListener('click', async () => { await WPG.updateLock({ locked: true }); window.close(); });

$('pinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const [a, b] = [$('pin1').value, $('pin2').value];
  if (a.length < 4) return pinMsg('pinShort');
  if (a !== b) return pinMsg('pinMismatch');
  const salt = crypto.randomUUID();
  unlocked = true; // whoever just set the PIN keeps access for this session
  await WPG.updateLock({ salt, hash: await WPG.hashPin(a, salt), fails: 0, coolUntil: 0 });
  $('pin1').value = $('pin2').value = '';
  pinMsg('pinSaved');
});

$('removePin').addEventListener('click', async () => {
  await WPG.updateLock({ hash: '', salt: '' });
  pinMsg('pinRemoved');
});

$('editKeys').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));

$('reset').addEventListener('click', async () => {
  if (!confirm(t('resetConfirm'))) return;
  const { shortcuts } = await chrome.storage.local.get('shortcuts');
  await chrome.storage.local.clear();
  await chrome.storage.local.set({ shortcuts, settings: { lang: s.lang } }); // keep the chosen language
});

/* ---------- render ---------- */

function translate() {
  document.documentElement.lang = s.lang;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':');
      el.setAttribute(attr, t(key));
    }
  }
  for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === s.lang));
  for (const o of document.querySelectorAll('select[data-minutes] option')) {
    const m = Number(o.value);
    o.textContent = m % 60 === 0 ? `${m / 60} ${t('hour')}` : `${m} ${t('min')}`;
  }
}

function setSelect(sel, value) {
  if (![...sel.options].some((o) => o.value === String(value))) sel.append(new Option(value, value));
  sel.value = String(value);
}

function render() {
  const gated = !!lock.hash && !unlocked;
  const wasGated = !$('gate').hidden;
  $('gate').hidden = !loaded || !gated;
  $('main').hidden = !loaded || gated;
  if (loaded && gated && !wasGated) $('gatePin').focus();

  for (const sel of document.querySelectorAll('select[data-minutes]')) {
    const v = sel === $('autoBlurMin') ? s.autoBlur.minutes : s.autoLock.minutes;
    setSelect(sel, v);
  }
  translate();

  $('act-blur').setAttribute('aria-pressed', String(s.enabled));
  $('act-hide').setAttribute('aria-pressed', String(s.hideAll));
  $('act-blur').querySelector('.ico').replaceChildren(WPG.icon(s.enabled ? 'blur' : 'eye', 22));
  $('act-blur').querySelector('.name').textContent = t(s.enabled ? 'blurOn' : 'blurOff');

  for (const key of WPG.AREAS) {
    $(`area-${key}`).checked = !!s.areas[key];
    $(`area-${key}`).disabled = !s.enabled;
  }
  for (const r of document.getElementsByName('strength')) r.checked = r.value === s.strength;
  $('reveal').checked = s.reveal;
  $('dock').checked = s.dock;

  $('autoBlurOn').checked = s.autoBlur.on;
  $('autoBlurMin').disabled = !s.autoBlur.on;
  $('autoLockOn').checked = s.autoLock.on;
  $('autoLockMin').disabled = !s.autoLock.on;

  $('pinState').textContent = t(lock.hash ? 'pinSet' : 'pinNone');
  $('removePin').disabled = !lock.hash;
  renderKeys();
}

function renderKeys() {
  const keys = Object.fromEntries(cmds.map((c) => [c.name, c.shortcut || '']));
  for (const b of document.querySelectorAll('[data-cmd]')) {
    b.querySelector('kbd').textContent = keys[b.dataset.cmd] || '';
    if (keys[b.dataset.cmd]) b.setAttribute('aria-keyshortcuts', keys[b.dataset.cmd].replace(/\s/g, ''));
  }
  $('keys').replaceChildren(...cmds.filter((c) => c.description).map((c) => {
    const li = document.createElement('li');
    li.append(t(`cmd.${c.name}`), Object.assign(document.createElement('kbd'), { textContent: c.shortcut || t('notSet') }));
    return li;
  }));
}

chrome.storage.onChanged.addListener(async (ch, area) => {
  if (area !== 'local') return;
  if (ch.settings) s = WPG.merge(ch.settings.newValue);
  if (ch.lock) lock = await WPG.getLock();
  if (ch.settings || ch.lock) render();
});

Promise.all([WPG.get(), WPG.getLock(), chrome.commands.getAll()]).then(([x, l, c]) => {
  s = x;
  lock = l;
  cmds = c;
  loaded = true; // nothing is shown until we know whether a PIN is set
  // Keeps the page buttons' shortcut labels current.
  chrome.storage.local.set({ shortcuts: Object.fromEntries(c.map((k) => [k.name, k.shortcut || ''])) });
  render();
});
