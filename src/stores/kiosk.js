/**
 * Kiosk mode: the app as a touch screen on a campus wall. Big panels instead of search, today's
 * lessons of the kiosk's campus, and pickers (year → group, building → room, surname letter →
 * teacher) that need no keyboard.
 */
import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { DateTime } from 'luxon';
import { useTimetableStore } from './timetable';
import { groupYear, roomBuilding, surnameLetter } from '../codes';

const KEY = 'tahvel.kiosk';
const DEFAULTS = { enabled: false, campus: 'K' };
/** Group codes without a year, and rooms without a building code, are grouped under this. */
export const OTHER = 'muu';
/** Kesklinn's room bookings ("BRON") are not lessons: free rooms count them, the kiosk does not show them. */
const isBooking = (l) => l.subject === 'BRON' || l.classes.includes('BRON');

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

const byEt = (a, b) => a.localeCompare(b, 'et', { numeric: true });

export const useKioskStore = defineStore('kiosk', () => {
  const timetable = useTimetableStore();
  const settings = ref(load());
  watch(settings, (s) => localStorage.setItem(KEY, JSON.stringify(s)), { deep: true });

  const campus = computed(() => settings.value.campus);
  const campusName = computed(() => timetable.index?.campuses?.[campus.value] ?? campus.value);

  // The clock the "now" views follow
  const now = ref(DateTime.now());
  setInterval(() => (now.value = DateTime.now()), 30_000);
  const time = computed(() => now.value.toFormat('HH:mm'));
  const todayIdx = computed(() => now.value.weekday - 1);

  // This week's lessons, loaded apart from the week the timetable view is on
  const week = ref(null);
  async function loadWeek() {
    const monday = now.value.startOf('week').toISODate();
    const w = timetable.index?.weeks.find((x) => x.monday === monday);
    try {
      week.value = w ? await timetable.fetchWeek(w.file) : null;
    } catch {
      week.value = null;
    }
  }
  watch([() => timetable.index, () => now.value.toISODate()], loadWeek, { immediate: true });

  /** Today's lessons anywhere: a group's or room's lessons are shown even at another campus. */
  const today = computed(() => (week.value?.lessons ?? []).filter((l) => l.day === todayIdx.value && !isBooking(l)));
  /** Today's lessons at the kiosk's campus. */
  const todayHere = computed(() => today.value.filter((l) => l.campus === campus.value));

  /** Lessons going on now and the next ones to start, of those passing `keep`. */
  function nowAndNext(keep = () => true) {
    const t = time.value;
    const list = todayHere.value.filter(keep);
    const ongoing = list.filter((l) => l.start <= t && t < l.end);
    const nextStart = list.filter((l) => l.start > t).map((l) => l.start).sort()[0];
    const next = nextStart ? list.filter((l) => l.start === nextStart) : [];
    return { ongoing, next, nextStart };
  }

  // Pickers, limited to the kiosk's campus
  const here = (list) => (list ?? []).filter((e) => e.campuses.includes(campus.value)).map((e) => e.name);
  const groups = computed(() => here(timetable.index?.classes).filter((g) => g !== 'BRON').sort(byEt));
  const years = computed(() => [...new Set(groups.value.map((g) => groupYear(g) ?? OTHER))].sort((a, b) => (a === OTHER) - (b === OTHER) || byEt(a, b)));
  const groupsOfYear = (year) => groups.value.filter((g) => (groupYear(g) ?? OTHER) === year);

  const rooms = computed(() => here(timetable.index?.rooms).sort(byEt));
  const buildings = computed(() => [...new Set(rooms.value.map((r) => roomBuilding(r) ?? OTHER))].sort((a, b) => (a === OTHER) - (b === OTHER) || byEt(a, b)));
  const roomsOfBuilding = (b) => rooms.value.filter((r) => (roomBuilding(r) ?? OTHER) === b);

  const teachers = computed(() => here(timetable.index?.teachers).filter((t) => t !== 'BRON').sort(byEt));
  /** Teachers by the letter their surname starts with, in alphabetical order. */
  const teachersByLetter = computed(() => {
    const map = new Map();
    for (const t of teachers.value) map.set(surnameLetter(t), [...(map.get(surnameLetter(t)) ?? []), t]);
    return [...map].sort(([a], [b]) => byEt(a, b));
  });

  return {
    settings, campus, campusName, now, time, week, today, todayHere, nowAndNext,
    groups, years, groupsOfYear, rooms, buildings, roomsOfBuilding, teachers, teachersByLetter,
  };
});
