/* Service worker: keyboard shortcuts, the toolbar badge, and shortcut labels for the page buttons. */
importScripts('common.js');

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd === 'toggle-blur') await WPG.update((s) => { s.enabled = !s.enabled; });
  else if (cmd === 'hide-all') await WPG.update((s) => { s.hideAll = !s.hideAll; });
  else if (cmd === 'lock-now') await WPG.updateLock({ locked: true });
});

async function updateBadge() {
  const [s, lock] = await Promise.all([WPG.get(), WPG.getLock()]);
  const [text, color] =
    lock.locked ? ['LOCK', '#b3261e'] :
    s.hideAll ? ['HIDE', '#b3261e'] :
    !s.enabled ? ['OFF', '#6b6b6b'] : ['', '#000'];
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color });
}

// The page cannot read chrome.commands, so keep a copy of the current keys in storage.
async function saveShortcuts() {
  const cmds = await chrome.commands.getAll();
  await chrome.storage.local.set({ shortcuts: Object.fromEntries(cmds.map((c) => [c.name, c.shortcut || ''])) });
}

chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'local' && (ch.settings || ch.lock)) updateBadge();
});
for (const ev of [chrome.runtime.onInstalled, chrome.runtime.onStartup]) {
  ev.addListener(() => { updateBadge(); saveShortcuts(); });
}

// With a PIN, WhatsApp starts locked every time the browser starts.
chrome.runtime.onStartup.addListener(async () => {
  if ((await WPG.getLock()).hash) await WPG.updateLock({ locked: true });
});
