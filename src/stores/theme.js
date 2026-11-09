/**
* The colour theme: which one is applied, the automatic light/dark pair and what switches it (the
* device's preference, sunrise and sunset, or the light sensor). A store rather than part of the
* theme picker, so the theme is applied and kept up to date on every page, not only in settings.
*/
import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { getTimes } from 'suncalc';
import EDITOR_THEMES from '../themes/editor.json';

const label = (t) => t[0].toUpperCase() + t.slice(1).replace('-', ' ');
// daisyUI's built-in themes enabled in src/style.css, and which of them are dark
const DAISY_THEMES = ['light', 'dark', 'dim', 'cupcake', 'emerald', 'corporate', 'retro', 'synthwave', 'dracula', 'sunset', 'black'];
const DAISY_DARK = new Set(['dark', 'dim', 'synthwave', 'dracula', 'sunset', 'black']);
const GROUPS = [
  {
    name: 'Tunniplaan',
    themes: [
      { id: 'techno', label: 'Techno', dark: false },
      { id: 'techno-dark', label: 'Techno dark', dark: true },
      { id: 'tunniplaan', label: 'Tunniplaan', dark: true },
    ],
  },
  { name: 'Koodiredaktorid', themes: EDITOR_THEMES },
  { name: 'daisyUI', themes: DAISY_THEMES.map((id) => ({ id, label: label(id), dark: DAISY_DARK.has(id) })) },
];
const ALL = GROUPS.flatMap((g) => g.themes);
const BY_ID = Object.fromEntries(ALL.map((t) => [t.id, t]));
const THEMES = ALL.map((t) => t.id);

// No saved theme means switching: a light and a dark theme (Techno and Techno dark by default), switched by `source`:
// the device's preference ('system'), sunrise and sunset in Tallinn ('sun') or the light sensor ('sensor')
const AUTO = 'auto';
const STORAGE_KEY = 'tahvel.theme'; // also read by the inline script in index.html; absent means AUTO
const AUTO_KEY = 'tahvel.autoTheme'; // { light, dark, source, sun: { rise, set } }, also read by index.html
const COLOR_KEY = 'tahvel.themeColor'; // { theme, color } of the applied theme, for index.html's first paint
const AUTO_DEFAULT = { light: 'techno', dark: 'techno-dark', source: 'system' };
const SOURCES = ['system', 'sun', 'sensor'];

/** WCAG relative luminance of #rrggbb. */
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two #rrggbb colours. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * QR colours from a theme: `{ fg, bg }` as #rrggbb, always dark modules on a lighter ground (phones do not
 * all read inverted codes) with 4.5:1 contrast. A light primary becomes the ground, with the first of the
 * theme's darker colours that contrasts enough (Techno dark: Techno purple on Techno yellow); a dark primary
 * is the modules on white; failing both, the primary darkened on white.
 */
export function qrColors(css) {
  const get = (name) => css.getPropertyValue(`--color-${name}`).trim();
  const primary = get('primary') ? toHex(get('primary')) : '#000000';
  const candidates = ['neutral', 'base-100', 'primary-content', 'base-content'].map(get).filter(Boolean).map(toHex);
  const onPrimary = candidates.find((c) => luminance(c) < luminance(primary) && contrast(c, primary) >= 4.5);
  if (onPrimary) return { fg: onPrimary, bg: primary };
  return { fg: scannableOnWhite(primary), bg: '#ffffff' };
}

/**
 * A colour a phone can scan as QR modules on white: the colour itself when it is dark enough (4.5:1 against
 * white), else the same hue darkened step by step until it is. Scanners want dark modules on a light ground.
 */
export function scannableOnWhite(color, ratio = 4.5) {
  let hex = toHex(color);
  for (let i = 0; i < 20 && 1.05 / (luminance(hex) + 0.05) < ratio; i++) {
    hex = '#' + [1, 3, 5].map((j) => Math.round(parseInt(hex.slice(j, j + 2), 16) * 0.85).toString(16).padStart(2, '0')).join('');
  }
  return hex;
}

/** Any CSS colour (daisyUI's built-in themes use oklch) as #rrggbb, which every browser takes in theme-color. */
export function toHex(color) {
  const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  return '#' + [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export const useThemeStore = defineStore('theme', () => {
  const darkQuery = matchMedia('(prefers-color-scheme: dark)');
  const prefersDark = ref(darkQuery.matches);
  const onSchemeChange = (e) => (prefersDark.value = e.matches);
  darkQuery.addEventListener('change', onSchemeChange);

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && !THEMES.includes(saved)) localStorage.removeItem(STORAGE_KEY); // a theme that has since been removed
  const theme = ref(THEMES.includes(saved) ? saved : AUTO);

  /** The automatic pair, each falling back to the default if it is gone or of the wrong kind. */
  function loadAuto() {
    let a = {};
    try {
      a = JSON.parse(localStorage.getItem(AUTO_KEY) || '{}');
    } catch {}
    // before sunrise/sunset switching this was a { sensor: true } on/off setting
    const source = SOURCES.includes(a.source) ? a.source : a.sensor ? 'sensor' : AUTO_DEFAULT.source;
    return {
      light: BY_ID[a.light]?.dark === false ? a.light : AUTO_DEFAULT.light,
      dark: BY_ID[a.dark]?.dark === true ? a.dark : AUTO_DEFAULT.dark,
      source,
    };
  }
  const auto = ref(loadAuto());

  // Light sensor (Generic Sensor API; few browsers expose it). Dark below DARK_LUX, light above LIGHT_LUX,
  // in between keeps the current one, and a change has to hold for SETTLE_MS so a passing shadow does not flip it.
  const DARK_LUX = 25;
  const LIGHT_LUX = 60;
  const SETTLE_MS = 3000;
  const sensorSupported = typeof window !== 'undefined' && 'AmbientLightSensor' in window;
  const sensorDark = ref(null); // null until a clear reading
  const sensorError = ref('');
  let sensor = null;
  let candidate = null;
  let candidateSince = 0;

  function onReading() {
    const lux = sensor.illuminance;
    const reading = lux < DARK_LUX ? true : lux > LIGHT_LUX ? false : null;
    if (reading === null || reading === sensorDark.value) return void (candidate = null);
    if (sensorDark.value === null) return void (sensorDark.value = reading); // the first clear reading applies at once
    if (candidate !== reading) return void ((candidate = reading), (candidateSince = Date.now()));
    if (Date.now() - candidateSince >= SETTLE_MS) {
      sensorDark.value = reading;
      candidate = null;
    }
  }

  function startSensor() {
    sensorError.value = '';
    try {
      sensor = new window.AmbientLightSensor({ frequency: 1 });
      sensor.addEventListener('reading', onReading);
      sensor.addEventListener('error', (e) => {
        sensorError.value = e.error?.name === 'NotAllowedError' ? 'Valgusanduri kasutamine pole lubatud.' : 'Valgusandurit ei saa kasutada.';
        stopSensor();
      });
      sensor.start();
    } catch (e) {
      sensorError.value = e.name === 'SecurityError' ? 'Valgusanduri kasutamine pole lubatud.' : 'Valgusandurit ei saa kasutada.';
      sensor = null;
    }
  }
  function stopSensor() {
    sensor?.stop();
    sensor = null;
    sensorDark.value = null;
    candidate = null;
  }
  watch(() => sensorSupported && theme.value === AUTO && auto.value.source === 'sensor', (on) => (on ? startSensor() : stopSensor()), {
    immediate: true,
  });

  // Sunrise and sunset in Tallinn, computed on the device (works offline); across Estonia they differ by minutes.
  const TALLINN = [59.437, 24.7536];
  const clock = ref(Date.now());
  setInterval(() => (clock.value = Date.now()), 60_000);
  const hhmm = (d) => d.toLocaleTimeString('et-EE', { timeZone: 'Europe/Tallinn', hour: '2-digit', minute: '2-digit' });
  const sun = computed(() => {
    const t = getTimes(new Date(clock.value), ...TALLINN);
    return { rise: t.sunrise, set: t.sunset };
  });
  const sunDark = computed(() => clock.value < sun.value.rise.getTime() || clock.value >= sun.value.set.getTime());

  /** Automatic is dark by its source; the light sensor goes by the device's preference until a clear reading. */
  const autoDark = computed(() => {
    if (auto.value.source === 'sun') return sunDark.value;
    if (auto.value.source === 'sensor' && sensorDark.value !== null) return sensorDark.value;
    return prefersDark.value;
  });

  // saved with today's sun times, so index.html can pick the right theme before the app loads
  watch([auto, sun], ([a, s]) => localStorage.setItem(AUTO_KEY, JSON.stringify({ ...a, sun: { rise: hhmm(s.rise), set: hhmm(s.set) } })), {
    deep: true,
    immediate: true,
  });
  const applied = computed(() => (theme.value === AUTO ? (autoDark.value ? auto.value.dark : auto.value.light) : theme.value));

  watch(applied, (t) => {
    document.documentElement.dataset.theme = t;
    // match the browser/OS bar (installed app, mobile address bar) to the theme's background
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-base-100').trim();
    if (!bg) return;
    const color = toHex(bg);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
    document.documentElement.style.backgroundColor = color;
    localStorage.setItem(COLOR_KEY, JSON.stringify({ theme: t, color }));
  }, { immediate: true });
  watch(theme, (t) => (t === AUTO ? localStorage.removeItem(STORAGE_KEY) : localStorage.setItem(STORAGE_KEY, t)));

  /** 'switching' (the light/dark pair) or 'single' (one theme throughout). */
  const kind = computed(() => (theme.value === AUTO ? 'switching' : 'single'));
  /** A single theme starts from the one showing, so nothing changes until another is picked. */
  function setKind(k) {
    if (k === 'switching') theme.value = AUTO;
    else if (theme.value === AUTO) theme.value = applied.value;
  }

  return {
    GROUPS, BY_ID, AUTO,
    theme, auto, applied, kind, setKind,
    sensorSupported, sensorError, sun, hhmm,
  };
});
