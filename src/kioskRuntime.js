/**
 * What a kiosk does on its own: start on its home screen, return there when nobody has touched it
 * for a while (to the lunch menu around lunch time), keep the timetable and lunch data fresh, and reload
 * once a night to pick up new app versions.
 */
import { onBeforeUnmount, watch } from 'vue';
import { DateTime } from 'luxon';
import { useRoute, useRouter } from 'vue-router';
import { useKioskStore } from './stores/kiosk';
import { useLunchStore } from './stores/lunch';
import { useTimetableStore } from './stores/timetable';

const IDLE_MS = 3 * 60_000;
const IDLE_CHECK_MS = 15_000;
const LUNCH_LEAD_MIN = 15; // the menu shows from this long before the lunch break
// Järve has no break of its own in the timetable (its groups have "Söögitund" lessons), so this stands in
const FALLBACK_BREAK = { start: '11:45', end: '12:45' };
const REFRESH_MS = 10 * 60_000;
const RELOAD_HOUR = 4; // a quiet hour for the nightly reload
const ACTIVITY = ['pointerdown', 'keydown', 'wheel', 'touchstart'];

/**
 * A screen can be set up from its address, so it needs no hands on the settings:
 *   ?kiosk=1&linnak=K       kiosk mode on, for Kesklinn (kiosk=0 turns it off)
 *   ?kiosk=mustamae         the same in one: a campus letter or name turns kiosk mode on for it
 * `campus` works for `linnak`. Read from the address (before the #) or from the route (after it), then
 * dropped from it, since the setting is kept in the browser from there on.
 */
const ON = ['1', 'jah', 'on', 'true'];
const OFF = ['0', 'ei', 'off', 'false'];
const CAMPUS_NAMES = { kesklinn: 'K', mustamae: 'M', 'mustamäe': 'M', jarve: 'J', 'järve': 'J', lasnamae: 'L', 'lasnamäe': 'L' };
const campusFrom = (v) => {
  const s = String(v ?? '').trim().toLowerCase();
  return CAMPUS_NAMES[s] ?? (/^[kmjl]$/.test(s) ? s.toUpperCase() : null);
};
function applyAddress(kiosk) {
  const search = new URLSearchParams(location.search);
  const [hashPath, hashQuery = ''] = location.hash.split('?');
  const hash = new URLSearchParams(hashQuery);
  const get = (key) => hash.get(key) ?? search.get(key);
  const mode = get('kiosk');
  const campus = campusFrom(get('linnak') ?? get('campus')) ?? campusFrom(mode);
  if (mode === null && !campus) return;
  if (campus) kiosk.settings.campus = campus;
  const value = String(mode ?? '').toLowerCase();
  if (ON.includes(value) || campusFrom(mode)) kiosk.settings.enabled = true;
  else if (OFF.includes(value)) kiosk.settings.enabled = false;
  for (const key of ['kiosk', 'linnak', 'campus']) {
    search.delete(key);
    hash.delete(key);
  }
  const keep = (q) => (q.toString() ? `?${q}` : '');
  history.replaceState(history.state, '', `${location.pathname}${keep(search)}${hashPath}${keep(hash)}`);
}

export function useKioskRuntime() {
  const kiosk = useKioskStore();
  const timetable = useTimetableStore();
  const lunch = useLunchStore();
  const router = useRouter();
  const route = useRoute();
  let idle, refresh, reload;
  let lastActivity = Date.now();
  applyAddress(kiosk); // before the watch below starts (or skips) the kiosk

  /** Whether an idle kiosk should show the lunch menu: around its campus's lunch break, on a day with lunch. */
  function lunchTime() {
    const now = DateTime.now();
    const brk = kiosk.week?.lunch?.[kiosk.campus] ?? FALLBACK_BREAK;
    const from = DateTime.fromFormat(brk.start, 'HH:mm').minus({ minutes: LUNCH_LEAD_MIN }).toFormat('HH:mm');
    const hm = now.toFormat('HH:mm');
    if (hm < from || hm >= brk.end) return false;
    const day = lunch.menu(kiosk.campus)?.days.find((d) => d.date === now.toISODate());
    return !!day && !day.closed;
  }

  /**
   * Checked every few seconds rather than once, so an idle kiosk also turns to the menu when lunch time comes
   * and back to its home screen when it ends. Replace, not push: nobody is there to go back.
   */
  const whenIdle = () => {
    if (Date.now() - lastActivity < IDLE_MS) return;
    if (route.path.startsWith('/seaded')) return; // not while someone is changing the settings
    const target = lunchTime() ? 'kiosk-lunch' : 'kiosk';
    if (route.name !== target) router.replace({ name: target });
  };
  const onActivity = () => (lastActivity = Date.now());

  function start() {
    router.isReady().then(() => route.name === 'timetable' && router.replace({ name: 'kiosk' }));
    ACTIVITY.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    onActivity();
    lunch.load();
    idle = setInterval(whenIdle, IDLE_CHECK_MS);
    refresh = setInterval(() => {
      timetable.refresh();
      lunch.load(true);
    }, REFRESH_MS);
    const next = new Date();
    next.setHours(RELOAD_HOUR, 0, 0, 0);
    if (next <= new Date()) next.setDate(next.getDate() + 1);
    reload = setTimeout(() => location.reload(), next - new Date());
  }
  function stop() {
    ACTIVITY.forEach((e) => window.removeEventListener(e, onActivity));
    clearInterval(idle);
    clearInterval(refresh);
    clearTimeout(reload);
  }

  watch(() => kiosk.settings.enabled, (on) => (on ? start() : stop()), { immediate: true });
  onBeforeUnmount(stop);
}
