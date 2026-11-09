import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { DateTime, Settings } from 'luxon';
import { DAY_LETTERS, lessonRows } from '../lessonRows';
import { useBookmarksStore } from './bookmarks';
Settings.defaultZone = 'Europe/Tallinn';

// Snapshot of every campus's timetable (Edupage and Tahvel), written by scripts/fetch-timetable.ts at deploy time.
const DATA_URL = `${import.meta.env.BASE_URL}data/`;
const STORAGE_KEY = 'tahvel.selection';
const SETTINGS_KEY = 'tahvel.settings';
const FILTERS_KEY = 'tahvel.freeFilters';
// How long a room has to stay free to count as free "praegu": one lesson's length.
const FREE_WINDOW = 45;
const NO_FILTERS = {
  seats: null, // at least this many student seats
  computers: '', // '' any room, 'any' a computer class, or a platform: 'windows', 'mac'
  equipment: [], // all of these: 'projector', 'interactive_display', 'television', 'whiteboard', 'chalkboard'
};
const DEFAULT_SETTINGS = {
  showFree: true, // "Vaba" cards for free periods
  showLunch: true, // lunch cards in the lunch break
  hideEmptyDays: false, // day chips only for days with lessons
  weekGrid: false, // the week as a grid of day columns (wide screens)
  noAnimations: false, // hover and press effects without motion (style.css, [data-motion="off"])
};

function loadFreeFilters() {
  try {
    return { ...structuredClone(NO_FILTERS), ...JSON.parse(localStorage.getItem(FILTERS_KEY) || '{}') };
  } catch {
    return structuredClone(NO_FILTERS);
  }
}

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// Helpers
const words = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const sameWords = (a, b) => words(a).sort().join(' ') === words(b).sort().join(' ');
const matches = (query, name) => {
  const have = words(name);
  const compact = (s) => words(s).join('');
  // "ta24a" should find "K-TA-24A", "suursalu" should find "Suursalu Kaspar Martin"
  return words(query).every((q) => have.some((w) => w.startsWith(q))) || compact(name).includes(compact(query));
};

async function getJson(file) {
  const response = await fetch(`${DATA_URL}${file}`);
  if (!response.ok) throw new Error(`${file}: ${response.status}`);
  return response.json();
}

// the lesson field a selection of each type is looked up in
const FIELD = { group: 'classes', teacher: 'teachers', room: 'rooms' };
const lessonsFor = (sel, lessons) => lessons.filter((l) => l[FIELD[sel.type]].includes(sel.name));
/** index.json's list of groups, teachers or rooms */
const poolFor = (index, type) => (type === 'teacher' ? index.teachers : type === 'room' ? index.rooms : index.classes) ?? [];

/** This week if it is published, otherwise the nearest week that is. */
function currentWeekIdx(weeks) {
  const thisMonday = DateTime.now().startOf('week').toISODate();
  const exact = weeks.findIndex((w) => w.monday === thisMonday);
  if (exact >= 0) return exact;
  const next = weeks.findIndex((w) => w.monday > thisMonday);
  return next >= 0 ? next : weeks.length - 1;
}

export const useTimetableStore = defineStore('timetable', () => {
  const bookmarks = useBookmarksStore();
  // state
  const index = ref(null);
  const weekIdx = ref(0);
  const weekData = ref(null);
  const day = ref(null);
  const displayType = ref('week');
  // "Täna" showing the next lessons (today's, or a later day's when today has none left): the link then says
  // "today" rather than that day, so it keeps meaning the next lessons whenever it is opened
  const followingNext = ref(false);
  const searchValue = ref('');
  const options = ref([]);
  const selectedSearch = ref(null);
  const loadError = ref('');
  const weekCache = {};
  const settings = ref(loadSettings());
  watch(settings, (s) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)), { deep: true });
  // 'timetable' (a group's, teacher's or room's lessons) or 'rooms' (rooms free at a time)
  const mode = ref('timetable');
  const freeCampus = ref('K');
  const freeDay = ref(0);
  const freeSlot = ref(null); // start time of the bell period looked at, or 'now'
  const freeFilters = ref(loadFreeFilters());
  watch(freeFilters, (f) => localStorage.setItem(FILTERS_KEY, JSON.stringify(f)), { deep: true });
  // the clock "Praegu" looks at; ticks so the free-room list follows the time
  const nowTime = ref(DateTime.now().toFormat('HH:mm'));
  setInterval(() => (nowTime.value = DateTime.now().toFormat('HH:mm')), 30_000);

  // Computed
  const week = computed(() => index.value?.weeks[weekIdx.value] ?? null);
  const monday = computed(() => (week.value ? DateTime.fromISO(week.value.monday) : DateTime.now().startOf('week')));
  const isCurrentWeek = computed(() => monday.value.hasSame(DateTime.now(), 'week'));
  const todayIdx = computed(() => DateTime.now().weekday - 1);
  const showingToday = computed(
    () => displayType.value === 'today' || followingNext.value || (displayType.value === 'day' && isCurrentWeek.value && day.value === todayIdx.value),
  );
  const hasPrevWeek = computed(() => weekIdx.value > 0);
  const hasNextWeek = computed(() => !!index.value && weekIdx.value < index.value.weeks.length - 1);

  const chips = computed(() => {
    const all = Array.from({ length: 7 }, (_, i) => ({
      day: i,
      date: monday.value.plus({ days: i }).toFormat('dd.MM'),
      letter: DAY_LETTERS[i],
    }));
    // with "hide days without lessons", only the selection's days; free rooms always get the whole week
    const sel = selectedSearch.value;
    if (!settings.value.hideEmptyDays || mode.value !== 'timetable' || !sel || !weekData.value) return all;
    const days = new Set(lessonsFor(sel, weekData.value.lessons).map((l) => l.day));
    return all.filter((c) => days.has(c.day));
  });

  const weekRange = computed(() => `${monday.value.toFormat('dd.MM')} - ${monday.value.plus({ days: 6 }).toFormat('dd.MM')}`);

  const updated = computed(() => (index.value ? DateTime.fromISO(index.value.generated).toFormat('dd.MM HH:mm') : ''));
  const sources = computed(() => index.value?.sources ?? []);
  const campusName = (c) => index.value?.campuses?.[c] ?? c;
  /** Campuses the selected group or teacher has lessons at; cards name the campus when there are several. */
  const selectedCampuses = computed(() => {
    const sel = selectedSearch.value;
    if (!sel || !index.value) return [];
    return poolFor(index.value, sel.type).find((e) => e.name === sel.name)?.campuses ?? [];
  });

  /** The selection's lessons this week, as they are in the snapshot (for the week grid). */
  const weekLessons = computed(() => (selectedSearch.value && weekData.value ? lessonsFor(selectedSearch.value, weekData.value.lessons) : []));
  /** The week grid stands in for the list in week view, on screens wide enough for it. */
  const showWeekGrid = computed(() => settings.value.weekGrid && displayType.value === 'week' && !!selectedSearch.value);

  const lessons = computed(() => {
    const sel = selectedSearch.value;
    if (!sel || !weekData.value) return [];
    let list = lessonsFor(sel, weekData.value.lessons);
    // when today is past the published weeks, the nearest week is not this week and has no "today"
    if (displayType.value === 'today') list = isCurrentWeek.value ? list.filter((l) => l.day === todayIdx.value) : [];
    if (displayType.value === 'day') list = list.filter((l) => l.day === day.value);

    return lessonRows({
      lessons: list,
      type: sel.type,
      monday: monday.value,
      periods: weekData.value.periods,
      lunch: weekData.value.lunch,
      showFree: settings.value.showFree,
      showLunch: settings.value.showLunch,
      tintToday: displayType.value === 'week',
      // a selection at several campuses names the campus on each row
      campusLabel: (l) => (selectedCampuses.value.length > 1 && l.campus ? campusName(l.campus) : ''),
    });
  });

  // Free rooms ------------------------------------------------------------------------------

  const campuses = computed(() => Object.entries(index.value?.campuses ?? {}).map(([id, name]) => ({ id, name })));
  /** The looked-at campus's bell periods this week; the ones the free-room search offers. */
  const freePeriods = computed(() => weekData.value?.periods?.[freeCampus.value] ?? []);
  const freeIsToday = computed(() => isCurrentWeek.value && freeDay.value === todayIdx.value);
  /**
   * "Praegu" looks for a room free for a whole lesson's length, not just this minute: from now while
   * a lesson is on, and from the next lesson's start during a break or lunch (a room that frees up in
   * five minutes is of no use). Outside the day's bells it falls back to the first one, so an early
   * morning or a late evening shows the morning slot.
   */
  const nowWindow = computed(() => {
    const periods = freePeriods.value;
    if (!periods.length) return null;
    const now = nowTime.value;
    const inLesson = periods.some((p) => p.start <= now && now < p.end);
    const start = inLesson ? now : (periods.find((p) => p.start > now)?.start ?? periods[0].start);
    return { start, end: DateTime.fromFormat(start, 'HH:mm').plus({ minutes: FREE_WINDOW }).toFormat('HH:mm'), now: true };
  });

  /** The time span looked at: a bell period, or for 'now' the 45 minutes the window above works out. */
  const freePeriod = computed(() => {
    if (freeSlot.value === 'now') return freeIsToday.value ? nowWindow.value : null;
    return freePeriods.value.find((p) => p.start === freeSlot.value) ?? null;
  });

  /** The span in words: "praegu 14:12 - 14:57", "järgmine tund 12:45 - 13:30", or a picked period's range. */
  const freeWhen = computed(() => {
    const p = freePeriod.value;
    if (!p) return '';
    const range = `${p.start} - ${p.end}`;
    if (!p.now) return range;
    if (p.start === nowTime.value) return `praegu ${range}`;
    return `${p.start > nowTime.value ? 'järgmine tund' : 'esimene tund'} ${range}`;
  });

  /**
   * Rooms of the campus with no lesson overlapping the chosen period, and until when each stays
   * free that day. Only what the timetables show: other bookings, and rooms no lesson uses, are unknown.
   */
  const freeRoomsAll = computed(() => {
    const period = freePeriod.value;
    if (!period || !weekData.value || !index.value) return [];
    const dayLessons = weekData.value.lessons.filter((l) => l.day === freeDay.value);
    return (index.value.rooms ?? [])
      .filter((r) => r.campuses.includes(freeCampus.value))
      .map((r) => {
        const inRoom = dayLessons.filter((l) => l.rooms.includes(r.name));
        if (inRoom.some((l) => l.start < period.end && l.end > period.start)) return null;
        const next = inRoom.filter((l) => l.start >= period.end).sort((a, b) => a.start.localeCompare(b.start))[0];
        return { name: r.name, until: next?.start ?? null, info: r.info ?? null };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name, 'et', { numeric: true }));
  });

  // Filters work on the room details a campus publishes (seats, computers, equipment); only Kesklinn has them so far.
  const freeHasInfo = computed(() => (index.value?.rooms ?? []).some((r) => r.info && r.campuses.includes(freeCampus.value)));
  const freeFiltersActive = computed(() => {
    const f = freeFilters.value;
    return !!(f.seats || f.computers || f.equipment.length);
  });
  function matchesFilters(info) {
    const f = freeFilters.value;
    if (f.seats && info.seats < f.seats) return false;
    if (f.computers === 'any' && !info.computers) return false;
    if (f.computers && f.computers !== 'any' && !info.platforms.includes(f.computers)) return false;
    return f.equipment.every((e) => info.equipment.includes(e));
  }
  /** Free rooms passing the filters; with a filter on, rooms without details cannot be checked and are left out. */
  const freeRooms = computed(() =>
    freeHasInfo.value && freeFiltersActive.value ? freeRoomsAll.value.filter((r) => r.info && matchesFilters(r.info)) : freeRoomsAll.value,
  );
  /** Free rooms a filter left out only because their details are unknown. */
  const freeRoomsUnknown = computed(() => (freeHasInfo.value && freeFiltersActive.value ? freeRoomsAll.value.filter((r) => !r.info).length : 0));
  function toggleFreeEquipment(e) {
    const list = freeFilters.value.equipment;
    freeFilters.value.equipment = list.includes(e) ? list.filter((x) => x !== e) : [...list, e];
  }
  function resetFreeFilters() {
    freeFilters.value = structuredClone(NO_FILTERS);
  }

  /** Right now when looking at today, else the day's first bell period. */
  function currentSlot() {
    return freeIsToday.value ? 'now' : (freePeriods.value[0]?.start ?? null);
  }

  /** Open the free-room search on now: this week, today, the current period, the selection's campus. */
  function showFreeRooms() {
    mode.value = 'rooms';
    if (selectedCampuses.value.length) freeCampus.value = selectedCampuses.value[0];
    const current = currentWeekIdx(index.value?.weeks ?? []);
    if (weekIdx.value !== current) weekIdx.value = current;
    freeDay.value = isCurrentWeek.value ? todayIdx.value : 0;
    freeSlot.value = currentSlot(); // null until the week's bell periods have loaded, then the watch picks one
  }

  /** "Praegu": back to this week and today, at the current minute. */
  function showFreeNow() {
    const current = currentWeekIdx(index.value?.weeks ?? []);
    if (weekIdx.value !== current) weekIdx.value = current;
    freeDay.value = todayIdx.value;
    freeSlot.value = 'now';
  }

  // keep something valid picked as the campus, day or week (and so the bells) change
  watch([freePeriods, freeDay, freeIsToday], () => {
    const valid = freeSlot.value === 'now' ? freeIsToday.value : freePeriods.value.some((p) => p.start === freeSlot.value);
    if (!valid) freeSlot.value = currentSlot();
  });

  function setFreeCampus(c) {
    freeCampus.value = c;
  }

  /** From a free room to its timetable. */
  function openRoom(name) {
    mode.value = 'timetable';
    select({ type: 'room', name });
  }

  /** Day chips pick the free-room day in that mode, the timetable's day otherwise. */
  function chooseDay(d) {
    if (mode.value === 'rooms') freeDay.value = d;
    else setDay(d);
  }
  const activeDay = computed(() => (mode.value === 'rooms' ? freeDay.value : day.value));

  const emptyMessage = computed(() => {
    if (loadError.value) return loadError.value;
    if (!selectedSearch.value) return 'Vali õpperühm, õpetaja või ruum, et näha tunniplaani.';
    if (weekData.value && !lessons.value.length) return displayType.value === 'week' ? 'Sel nädalal pole tunde.' : 'Sel päeval pole tunde.';
    return '';
  });

  // Loading
  function fetchWeek(file) {
    weekCache[file] ??= getJson(file).catch((e) => {
      delete weekCache[file];
      throw e;
    });
    return weekCache[file];
  }

  async function loadWeek() {
    if (!week.value) return;
    try {
      weekData.value = await fetchWeek(week.value.file);
    } catch (e) {
      loadError.value = 'Tunniplaani laadimine ebaõnnestus.';
    }
  }

  /**
   * Open the day of the selection's next lesson that has not ended yet: today if lessons remain, else a later day or week.
   * Resolves false when there is nothing to show, leaving the view as it was.
   */
  let jumps = 0; // a jump still waiting on its week files gives way to anything asked for since
  async function showNextLessons() {
    const sel = selectedSearch.value;
    const jump = ++jumps;
    if (!sel) return false;
    const weeks = index.value?.weeks ?? [];
    const now = DateTime.now();
    for (let i = currentWeekIdx(weeks); i < weeks.length; i++) {
      let data;
      try {
        data = await fetchWeek(weeks[i].file);
      } catch {
        return false;
      }
      if (selectedSearch.value !== sel || jump !== jumps) return true; // something else asked for meanwhile, leave the view alone
      const monday = DateTime.fromISO(weeks[i].monday);
      const ends = (l) => DateTime.fromISO(`${monday.plus({ days: l.day }).toISODate()}T${l.end}`);
      const next = lessonsFor(sel, data.lessons)
        .filter((l) => ends(l) > now)
        .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start))[0];
      if (next) {
        weekIdx.value = i;
        setDay(next.day);
        followingNext.value = true;
        return true;
      }
    }
    return false;
  }

  watch(weekIdx, () => {
    weekData.value = null;
    loadWeek();
  });

  /** Re-read the snapshot (a kiosk stays open for days; the deploy refreshes the data every 30 minutes). */
  async function refresh() {
    let fresh;
    try {
      fresh = await getJson('index.json');
    } catch {
      return; // offline: keep what there is
    }
    for (const file of Object.keys(weekCache)) delete weekCache[file];
    index.value = fresh;
    await loadWeek();
  }

  async function init() {
    try {
      index.value = await getJson('index.json');
    } catch (e) {
      loadError.value = 'Tunniplaani andmeid ei õnnestunud laadida.';
      return;
    }
    weekIdx.value = currentWeekIdx(index.value.weeks);
    restoreSelection();
    loadWeek();
  }

  // Selection
  function restoreSelection() {
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch {
      saved = null;
    }
    if (!saved?.name) return;
    // Selections saved by the old Tahvel version store Tahvel's spelling
    // ("Kaspar Martin Suursalu"); Edupage has "Suursalu Kaspar Martin". Same words, so match on those.
    const pool = poolFor(index.value, saved.type).map((e) => e.name);
    const name = pool.find((n) => n === saved.name) ?? pool.find((n) => sameWords(n, saved.name));
    if (name) select({ type: saved.type, name }, { record: false });
    else localStorage.removeItem(STORAGE_KEY);
  }

  const hit = (type) => (e) => ({ id: `${type}:${e.name}`, name: e.name, type, campuses: e.campuses.map(campusName) });

  /**
   * Search hits for what is typed, the often viewed ones first. Under two characters (an empty box that
   * was clicked into) the suggestions are the most viewed instead, those still in the snapshot.
   */
  function autocomplete(value) {
    if (!index.value) {
      options.value = [];
      return;
    }
    if (String(value).trim().length < 2) {
      options.value = bookmarks.topVisits
        .map((v) => {
          const e = poolFor(index.value, v.type).find((e) => e.name === v.name);
          return e && { ...hit(v.type)(e), frequent: true };
        })
        .filter(Boolean)
        .slice(0, 6);
      return;
    }
    const find = (type) => poolFor(index.value, type).filter((e) => matches(value, e.name)).map(hit(type));
    const [groups, teachers, rooms] = ['group', 'teacher', 'room'].map(find);
    // a space usually means a person's name, otherwise a group or room code
    const all = value.includes(' ') ? [...teachers, ...groups, ...rooms] : [...groups, ...rooms, ...teachers];
    // a stable sort, so hits never viewed keep the order above
    options.value = all
      .map((o) => ({ ...o, frequent: bookmarks.visitCount(o) > 0 }))
      .sort((a, b) => bookmarks.visitCount(b) - bookmarks.visitCount(a))
      .slice(0, 30);
  }

  /**
   * `jump` opens the next lessons; a deep link brings its own view and turns that off. `record` counts it
   * as viewed (not when the last selection is put back on start); only a change counts, as a link is
   * opened again each time the view on it changes.
   */
  function select(selected, { jump = true, record = true } = {}) {
    if (!selected) return;
    const prev = selectedSearch.value;
    if (record && (prev?.type !== selected.type || prev?.name !== selected.name)) bookmarks.recordVisit(selected);
    selectedSearch.value = { type: selected.type, name: selected.name };
    searchValue.value = selected.name;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedSearch.value));
    options.value = [];
    if (jump) showNextLessons();
  }

  /**
   * Open what a shareable link asks for. Resolves the name against the snapshot (an old Tahvel spelling
   * still finds its group), so a link that names nothing known leaves the view alone and reports false.
   */
  function openLink({ type, name, display = 'week', weekday = 0, monday = '' }) {
    if (!index.value || !FIELD[type]) return false;
    const pool = poolFor(index.value, type).map((e) => e.name);
    const found = pool.find((n) => n === name) ?? pool.find((n) => sameWords(n, name));
    if (!found) return false;
    // already showing it (the address bar was just updated to what is on screen): nothing to redo
    const cur = linkState.value;
    const same = cur && cur.type === type && cur.name === found && cur.display === display;
    if (same && (display === 'today' || (cur.monday === monday && (display !== 'day' || cur.weekday === weekday)))) {
      if (display !== 'today') jumps++; // a link to a week or day wins over a jump still loading (a restored selection's)
      return true;
    }
    mode.value = 'timetable';
    select({ type, name: found }, { jump: false }); // a new selection object, so a pending showNextLessons bails
    const weeks = index.value.weeks ?? [];
    const at = weeks.findIndex((w) => w.monday === monday);
    weekIdx.value = at >= 0 ? at : currentWeekIdx(weeks);
    displayType.value = display;
    day.value = display === 'day' ? weekday : null;
    followingNext.value = false;
    // "today" means the next lessons, worked out now: today's, or the next day that has some
    if (display === 'today') showNextLessons();
    return true;
  }

  /**
   * What a link to the timetable as it stands would say, or null while nothing is picked. The current
   * week is left unpinned, so a link copied off it keeps opening on the current week rather than ageing
   * into this one; a week paged to is pinned, that being the point of going there.
   */
  const linkState = computed(() => {
    const sel = selectedSearch.value;
    if (!sel) return null;
    const monday = isCurrentWeek.value ? '' : (week.value?.monday ?? '');
    if (followingNext.value) return { type: sel.type, name: sel.name, display: 'today', weekday: null, monday: '' };
    return { type: sel.type, name: sel.name, display: displayType.value, weekday: day.value, monday };
  });

  function clearSearch() {
    selectedSearch.value = null;
    followingNext.value = false;
    searchValue.value = '';
    options.value = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  // Navigation
  async function toggle(type) {
    // "Täna" jumps ahead to the next lessons when today has none left
    if (type === 'today' && (await showNextLessons())) return;
    followingNext.value = false;
    day.value = null;
    if (type === 'today') weekIdx.value = currentWeekIdx(index.value?.weeks ?? []);
    displayType.value = type;
  }

  function setDay(d) {
    followingNext.value = false; // a day picked; showNextLessons sets it back after picking its own
    day.value = d; // 0=Mon ... 6=Sun
    displayType.value = 'day';
  }

  function shiftWeek(step) {
    const next = weekIdx.value + step;
    if (!index.value || next < 0 || next >= index.value.weeks.length) return;
    weekIdx.value = next;
    followingNext.value = false;
    if (displayType.value === 'today') displayType.value = 'week';
  }

  return {
    index, weekIdx, weekData, monday, weekLessons, showWeekGrid, day, displayType, searchValue, options, selectedSearch, loadError, settings,
    selectedCampuses, isCurrentWeek, showingToday, hasPrevWeek, hasNextWeek, chips, weekRange, updated, sources, lessons, emptyMessage,
    init, refresh, fetchWeek, autocomplete, select, clearSearch, toggle, setDay, shiftWeek, openLink, linkState,
    mode, campuses, freeCampus, freeDay, freeSlot, freePeriods, freePeriod, freeWhen, freeRooms, activeDay,
    freeFilters, freeHasInfo, freeFiltersActive, freeRoomsUnknown, toggleFreeEquipment, resetFreeFilters,
    showFreeRooms, showFreeNow, setFreeCampus, openRoom, chooseDay,
  };
});
