/* Shared settings, storage helpers and icons. Used by the page script, the popup and the service worker. */
'use strict';

globalThis.WPG = (() => {
  const AREAS = ['list', 'header', 'messages', 'media'];

  const STRENGTH = { low: 5, medium: 9, high: 16 };

  const STRINGS = {
    en: {
      quickActions: 'Quick actions', settings: 'Settings', language: 'Language',
      blurOn: 'Blur on', blurOff: 'Blur off', hideAll: 'Hide all', lock: 'Lock',
      tabBlur: 'Blur', tabLock: 'Auto-lock', tabMore: 'More',
      'area.list': 'Chat list', 'area.list.hint': 'Names, last messages and photos',
      'area.header': 'Open chat name', 'area.header.hint': 'Name, number and photo at the top',
      'area.messages': 'Messages', 'area.messages.hint': 'Text, sender names and numbers in groups',
      'area.media': 'Photos & videos', 'area.media.hint': 'Everywhere, including profile photos',
      strength: 'Blur strength', low: 'Light', medium: 'Medium', high: 'Strong',
      reveal: 'Show on hover', revealHint: 'Point at something to see it',
      autoBlur: 'Blur when inactive', autoBlurHint: 'Move the mouse to show again', blurAfter: 'Blur after',
      autoLock: 'Lock when inactive', autoLockHint: 'Needs your PIN to open, if one is set', lockAfter: 'Lock after',
      min: 'min', hour: 'hour',
      pin: 'PIN', newPin: 'New PIN', repeatPin: 'Repeat PIN', save: 'Save', removePin: 'Remove PIN',
      pinSet: 'A PIN is set. WhatsApp locks every time it opens, and these settings need the PIN. Save a new one to change it.',
      settingsLocked: 'Settings are locked', settingsLockedHint: 'Enter your PIN to open the settings.',
      lockWhatsApp: 'Lock WhatsApp now',
      pinNone: 'No PIN set. Without one, Unlock opens WhatsApp straight away.',
      pinShort: 'Use at least 4 characters.', pinMismatch: "The PINs don't match.",
      pinSaved: 'PIN saved.', pinRemoved: 'PIN removed.',
      dock: 'Buttons in WhatsApp sidebar', dockHint: "Blur, hide and lock next to WhatsApp's own icons",
      shortcuts: 'Keyboard shortcuts', changeShortcuts: 'Change shortcuts', notSet: 'Not set',
      'cmd.toggle-blur': 'Turn blur on or off', 'cmd.hide-all': 'Hide everything', 'cmd.lock-now': 'Lock WhatsApp Web',
      reset: 'Reset all settings', resetConfirm: 'Reset all settings and remove your PIN?',
      note: 'Everything stays on this computer. WhatsApp Privacy makes no network requests. The lock keeps people looking at your screen out. It does not replace locking your computer.',
      // Page
      blurIsOn: 'Blur is on', blurIsOff: 'Blur is off', hideEverything: 'Hide everything', showEverything: 'Show everything',
      hiddenBanner: 'Everything is hidden. Click to show.',
      locked: 'WhatsApp is locked', enterPin: 'Enter your PIN to continue.',
      noPinLock: 'Click Unlock to continue. Set a PIN in WhatsApp Privacy to require one.',
      unlock: 'Unlock', wrongPin: 'Wrong PIN.', tooMany: 'Too many tries. Wait {n} s.',
    },
    tr: {
      quickActions: 'Hızlı işlemler', settings: 'Ayarlar', language: 'Dil',
      blurOn: 'Bulanık açık', blurOff: 'Bulanık kapalı', hideAll: 'Tümünü gizle', lock: 'Kilitle',
      tabBlur: 'Bulanıklık', tabLock: 'Otomatik kilit', tabMore: 'Diğer',
      'area.list': 'Sohbet listesi', 'area.list.hint': 'İsimler, son mesajlar ve fotoğraflar',
      'area.header': 'Açık sohbetin adı', 'area.header.hint': 'Üstteki ad, numara ve fotoğraf',
      'area.messages': 'Mesajlar', 'area.messages.hint': 'Metin, gruplarda gönderen adları ve numaralar',
      'area.media': 'Fotoğraflar ve videolar', 'area.media.hint': 'Profil fotoğrafları dahil her yerde',
      strength: 'Bulanıklık düzeyi', low: 'Hafif', medium: 'Orta', high: 'Güçlü',
      reveal: 'Üzerine gelince göster', revealHint: 'Görmek için fareyle üzerine gelin',
      autoBlur: 'İşlem yokken bulanıklaştır', autoBlurHint: 'Tekrar göstermek için fareyi oynatın', blurAfter: 'Bulanıklaştırma süresi',
      autoLock: 'İşlem yokken kilitle', autoLockHint: 'PIN belirlediyseniz açmak için gerekir', lockAfter: 'Kilitleme süresi',
      min: 'dk', hour: 'saat',
      pin: 'PIN', newPin: 'Yeni PIN', repeatPin: "PIN'i tekrarla", save: 'Kaydet', removePin: "PIN'i kaldır",
      pinSet: 'Bir PIN belirlendi. WhatsApp her açılışta kilitlenir ve bu ayarlar için PIN gerekir. Değiştirmek için yenisini kaydedin.',
      settingsLocked: 'Ayarlar kilitli', settingsLockedHint: "Ayarları açmak için PIN'inizi girin.",
      lockWhatsApp: "WhatsApp'ı şimdi kilitle",
      pinNone: "PIN yok. PIN olmadan Kilidi aç düğmesi WhatsApp'ı hemen açar.",
      pinShort: 'En az 4 karakter kullanın.', pinMismatch: "PIN'ler eşleşmiyor.",
      pinSaved: 'PIN kaydedildi.', pinRemoved: 'PIN kaldırıldı.',
      dock: 'WhatsApp kenar çubuğunda düğmeler', dockHint: 'WhatsApp simgelerinin yanında bulanıklaştır, gizle ve kilitle',
      shortcuts: 'Klavye kısayolları', changeShortcuts: 'Kısayolları değiştir', notSet: 'Ayarlanmadı',
      'cmd.toggle-blur': 'Bulanıklığı aç veya kapat', 'cmd.hide-all': 'Her şeyi gizle', 'cmd.lock-now': "WhatsApp Web'i kilitle",
      reset: 'Tüm ayarları sıfırla', resetConfirm: 'Tüm ayarlar sıfırlansın ve PIN kaldırılsın mı?',
      note: 'Her şey bu bilgisayarda kalır. WhatsApp Privacy hiçbir ağ isteği yapmaz. Kilit, ekranınıza bakanları uzak tutar; bilgisayarınızı kilitlemenin yerini tutmaz.',
      // Page
      blurIsOn: 'Bulanıklık açık', blurIsOff: 'Bulanıklık kapalı', hideEverything: 'Her şeyi gizle', showEverything: 'Her şeyi göster',
      hiddenBanner: 'Her şey gizlendi. Göstermek için tıklayın.',
      locked: 'WhatsApp kilitli', enterPin: "Devam etmek için PIN'inizi girin.",
      noPinLock: "Devam etmek için Kilidi aç'a tıklayın. PIN istemek için WhatsApp Privacy'de bir PIN belirleyin.",
      unlock: 'Kilidi aç', wrongPin: 'Yanlış PIN.', tooMany: 'Çok fazla deneme. {n} sn bekleyin.',
    },
  };

  const t = (lang, key, vars = {}) =>
    (STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k]);

  const DEFAULTS = {
    lang: 'en',
    enabled: true,
    strength: 'medium',
    reveal: true,
    areas: { list: true, header: false, messages: true, media: true },
    hideAll: false,
    autoBlur: { on: true, minutes: 2 },
    autoLock: { on: true, minutes: 10 },
    dock: true,
  };

  const merge = (s = {}) => ({
    ...DEFAULTS,
    ...s,
    areas: { ...DEFAULTS.areas, ...s.areas },
    autoBlur: { ...DEFAULTS.autoBlur, ...s.autoBlur },
    autoLock: { ...DEFAULTS.autoLock, ...s.autoLock },
  });

  const get = async () => merge((await chrome.storage.local.get('settings')).settings);
  const set = (s) => chrome.storage.local.set({ settings: s });
  async function update(fn) {
    const s = await get();
    fn(s);
    await set(s);
    return s;
  }

  const getLock = async () => ({ locked: false, hash: '', salt: '', fails: 0, coolUntil: 0, ...(await chrome.storage.local.get('lock')).lock });
  async function updateLock(patch) {
    const l = { ...(await getLock()), ...patch };
    await chrome.storage.local.set({ lock: l });
    return l;
  }

  // Checks a PIN with a shared, persistent attempt limit (popup and every WhatsApp tab count together,
  // and closing the popup does not reset it). Every 5th wrong PIN starts a cooldown: 30 s, 1 min, 2 min… max 15 min.
  async function checkPin(pin) {
    const l = await getLock();
    const now = Date.now();
    if (l.coolUntil > now) return { ok: false, wait: Math.ceil((l.coolUntil - now) / 1000) };
    if (l.hash && (await hashPin(pin, l.salt)) === l.hash) {
      if (l.fails) await updateLock({ fails: 0, coolUntil: 0 });
      return { ok: true };
    }
    const fails = (l.fails || 0) + 1;
    const coolUntil = fails % 5 === 0 ? now + Math.min(30000 * 2 ** (fails / 5 - 1), 900000) : 0;
    await updateLock({ fails, coolUntil });
    return { ok: false, wait: coolUntil ? Math.ceil((coolUntil - now) / 1000) : 0 };
  }

  // PBKDF2 so the stored PIN hash is not trivially reversible.
  async function hashPin(pin, salt) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 150000 }, key, 256);
    return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Material icons (24×24).
  const ICONS = {
    blur: 'M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z',
    eye: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
    hide: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z',
    lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
  };

  function icon(name, size = 24) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true', focusable: 'false' })) {
      svg.setAttribute(k, v);
    }
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', ICONS[name]);
    path.setAttribute('fill', 'currentColor');
    svg.append(path);
    return svg;
  }

  return { AREAS, STRENGTH, STRINGS, t, DEFAULTS, merge, get, set, update, getLock, updateLock, hashPin, checkPin, icon };
})();
