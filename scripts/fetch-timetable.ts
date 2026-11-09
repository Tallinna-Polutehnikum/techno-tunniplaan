/**
 * Snapshot Techno TLN's timetables into static JSON for the app.
 *
 * Edupage and Tahvel send no CORS headers, so the browser cannot ask them directly. Instead this
 * runs in the deploy workflow (on a schedule) and writes public/data/, which Vite copies into the
 * site. The campuses use different systems (see SOURCES); their lessons are merged, so one search
 * covers every campus and a teacher working at several shows up once:
 *
 *   index.json           sources, campuses, the weeks available, every class, teacher and room with
 *                        the campuses they have lessons at
 *   week-<monday>.json   that week's lessons (each tagged with its campus), each campus's bells and lunch break
 *   lunch.json           the campuses' school lunch menus (menuu.techno.ee), when the feed could be read
 *
 * Kesklinn and Mustamäe each have their own Edupage; Järve and Lasnamäe share Tahvel. Each lesson's
 * campus comes from its room when that says (groups and teachers do move between campuses), else
 * from which Edupage it is in, else from its group code (K-, M-, J-, L-).
 *
 * Weeks start from last week, so a deploy does not keep fetching the past.
 *
 * Edupage's school server drops connections from some GitHub Actions IPs, so the deploy workflow
 * sets FETCH_PROXY to the Cloudflare Worker in worker/, which relays the requests.
 *
 *   bun run fetch
 *   FETCH_PROXY=https://tahvel-edupage-proxy.<account>.workers.dev bun run fetch
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fetchEdupage } from "./providers/edupage";
import { fetchLunch } from "./providers/lunch";
import { fetchRoomInfo, type RoomInfo } from "./providers/rooms";
import { fetchTahvel } from "./providers/tahvel";
import { addDays, byTime, CAMPUSES, campusRoom, mondayOf, upstream, type Campus, type Lesson, type Period, type SourceData } from "./providers/types";

type Source = { id: string; label: string; url: string } & (
  | { provider: "edupage"; school: string; campus: Campus }
  | { provider: "tahvel"; schoolId: number; buildings: Record<string, Campus> }
);

/** Credited in this order. Edupage first so its teacher spelling and bell times win. */
const SOURCES: Source[] = [
  { id: "kesklinn", label: "Edupage Kesklinn", provider: "edupage", school: "kesklinn-techno", campus: "K", url: "https://kesklinn-techno.edupage.org/timetable/" },
  { id: "mustamae", label: "Edupage Mustamäe", provider: "edupage", school: "mustamae-techno", campus: "M", url: "https://mustamae-techno.edupage.org/timetable/" },
  {
    id: "tahvel",
    label: "Tahvel",
    provider: "tahvel",
    schoolId: 24,
    // Tahvel's building codes; Lasnamäe's room codes (E243) do not carry the campus letter
    buildings: { Peamaja: "J", Praktikamaja: "J", PM: "L", TK: "L", A: "K" },
    url: "https://tahveltp.edu.ee/#/schoolBoard/24",
  },
];
/** Tahvel has every week of the year; fetch this many from this week on (it is ~2.5 MB per week). */
const TAHVEL_WEEKS_AHEAD = 4;

/** The school lunch menus of every campus. */
const LUNCH_URL = "https://menuu.techno.ee/menu.php?format=json";

/** Room details (seats, computers, equipment) the campuses publish; only Kesklinn so far. */
const ROOM_LISTS: { campus: Campus; url: string }[] = [{ campus: "K", url: "https://technoweb.blob.core.windows.net/ruumiplaanid/kesklinn.json" }];

const OUT = fileURLToPath(new URL("../public/data/", import.meta.url));
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Tallinn" });
const thisMonday = mondayOf(today);
const fromMonday = addDays(thisMonday, -7);

// --- fetch every source ---------------------------------------------------------------------

const data = new Map<string, SourceData>();
for (const s of SOURCES) {
  if (s.provider !== "edupage") continue;
  console.log(`${s.label} (${s.school})`);
  const server = upstream(`${s.school}.edupage.org`, `edupage/${s.school}`);
  data.set(s.id, await fetchEdupage(server, s.campus, fromMonday, console.log));
}
// Tahvel for the same weeks the Edupage schools publish, and at least a few weeks ahead
const edupageMondays = [...data.values()].flatMap((d) => d.weeks.map((w) => w.monday));
const aheadMondays = Array.from({ length: TAHVEL_WEEKS_AHEAD + 2 }, (_, i) => addDays(fromMonday, i * 7));
const tahvelMondays = [...new Set([...aheadMondays, ...edupageMondays])].sort();
for (const s of SOURCES) {
  if (s.provider !== "tahvel") continue;
  console.log(`${s.label} (school ${s.schoolId})`);
  data.set(s.id, await fetchTahvel(upstream("tahveltp.edu.ee", "tahvel"), s.schoolId, s.buildings, tahvelMondays, console.log));
}

// --- one name per teacher -------------------------------------------------------------------

const words = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const teacherNames = SOURCES.flatMap((s) => data.get(s.id)!.teachers);
const wordSet = (name: string) => words(name).sort().join(" ");
const canonical = new Map<string, string>(); // word set -> first spelling seen
for (const name of teacherNames) if (!canonical.has(wordSet(name))) canonical.set(wordSet(name), name);
const fullNames = [...new Set(canonical.values())].filter((n) => words(n).length > 1);
/** Same person, same name: word order does not matter, and a bare surname maps to the one full name that starts with it. */
function teacherKey(name: string): string {
  const w = words(name);
  if (w.length === 1) {
    const matches = fullNames.filter((n) => words(n)[0] === w[0]);
    if (matches.length === 1) return matches[0];
  }
  return canonical.get(wordSet(name)) ?? name;
}

// --- merge per week -------------------------------------------------------------------------

const weeks = new Map<string, { lessons: Lesson[]; periods: Partial<Record<Campus, Period[]>> }>();
const classes = new Map<string, Set<Campus>>();
const teachers = new Map<string, Set<Campus>>();
const rooms = new Map<string, Set<Campus>>();
const add = (map: Map<string, Set<Campus>>, name: string, campus?: Campus) => {
  const set = map.get(name) ?? new Set();
  if (campus) set.add(campus);
  map.set(name, set);
};
for (const s of SOURCES) {
  for (const w of data.get(s.id)!.weeks) {
    const week = weeks.get(w.monday) ?? { lessons: [], periods: {} };
    // the first source with a campus's bells wins: Edupage's are published, Tahvel's derived
    for (const [campus, bells] of Object.entries(w.periods) as [Campus, Period[]][]) week.periods[campus] ??= bells;
    for (const l of w.lessons) {
      week.lessons.push({ ...l, teachers: [...new Set(l.teachers.map(teacherKey))] });
    }
    weeks.set(w.monday, week);
  }
}

// --- one lesson per lesson --------------------------------------------------------------------

/**
 * A lesson entered in two systems (a Kesklinn group taught at Lasnamäe is in Kesklinn's Edupage
 * with the room "Lasnamäe" and in Tahvel with the real room) is kept once, with the real room.
 */
function dedupe(lessons: Lesson[]): Lesson[] {
  const key = (l: Lesson) => JSON.stringify([l.day, l.start, l.end, l.subject.toLowerCase(), [...l.classes].sort(), [...l.teachers].sort()]);
  const placeholder = (l: Lesson) => l.rooms.length === 0 || l.rooms.every((r) => campusRoom(r));
  const kept = new Map<string, Lesson>();
  for (const l of lessons) {
    const other = kept.get(key(l));
    if (!other) kept.set(key(l), l);
    else if (placeholder(other) && !placeholder(l)) kept.set(key(l), { ...l, note: l.note ?? other.note });
  }
  return [...kept.values()];
}
let duplicates = 0;
for (const week of weeks.values()) {
  const before = week.lessons.length;
  week.lessons = dedupe(week.lessons);
  duplicates += before - week.lessons.length;
  for (const l of week.lessons) {
    l.classes.forEach((c) => add(classes, c, l.campus));
    l.teachers.forEach((t) => add(teachers, t, l.campus));
    // placeholder rooms named after a campus are not rooms anyone can look up
    l.rooms.filter((r) => !campusRoom(r)).forEach((r) => add(rooms, r, l.campus));
  }
}

// --- lunch breaks -----------------------------------------------------------------------------

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
/**
 * Each campus's lunch break, which no system publishes: the midday gap between lessons (30 min or more, starting
 * 11:00 to 13:30) its groups' days most often have, if at least a quarter of the days with lessons on both sides of
 * noon have it. Järve has none this way: its groups eat in "Söögitund" lessons of their own.
 */
function lunchBreaks(lessons: Lesson[]): Partial<Record<Campus, Period>> {
  const out: Partial<Record<Campus, Period>> = {};
  for (const campus of Object.keys(CAMPUSES) as Campus[]) {
    const days = new Map<string, Lesson[]>(); // a group's day
    for (const l of lessons) {
      if (l.campus !== campus) continue;
      for (const c of l.classes) days.set(`${c}|${l.day}`, [...(days.get(`${c}|${l.day}`) ?? []), l]);
    }
    const gaps = new Map<string, number>();
    let spanning = 0;
    for (const day of days.values()) {
      day.sort((a, b) => a.start.localeCompare(b.start));
      if (day[0].start < "12:00" && day.some((l) => l.end > "12:30")) spanning++;
      let end = day[0].end;
      for (const l of day.slice(1)) {
        if (end >= "11:00" && end <= "13:30" && minutes(l.start) - minutes(end) >= 30) gaps.set(`${end}-${l.start}`, (gaps.get(`${end}-${l.start}`) ?? 0) + 1);
        if (l.end > end) end = l.end;
      }
    }
    const [gap, count] = [...gaps].sort((a, b) => b[1] - a[1])[0] ?? [];
    if (gap && count >= spanning / 4) {
      const [start, end] = gap.split("-");
      out[campus] = { start, end };
    }
  }
  return out;
}

// --- write ----------------------------------------------------------------------------------

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (/^week-.*\.json$/.test(f)) rmSync(`${OUT}${f}`);
const index = [];
for (const [monday, week] of [...weeks].sort(([a], [b]) => a.localeCompare(b))) {
  const file = `week-${monday}.json`;
  week.lessons.sort(byTime);
  writeFileSync(`${OUT}${file}`, JSON.stringify({ monday, periods: week.periods, lunch: lunchBreaks(week.lessons), lessons: week.lessons }));
  index.push({ monday, file, lessons: week.lessons.length });
}
// Room details are extra: without them the timetable still works, so a failure only warns.
// A listed room is matched to the timetable's name for it, which may add spaces, the campus letter or a note
// ("B-103 - 105" is "B-103-105", "K-B136 (raamatukogu)" is "B-136"); listed rooms no lesson uses are added,
// so free-room search can offer them too.
const roomKey = (code: string) =>
  code.replace(/\s*\(.*\)$/, "").replace(/^[KMJL]-(?=[A-Z])/, "").replace(/\s+/g, "").replace(/^([A-Z])-?(\d)/, "$1-$2").toUpperCase();
const roomInfo = new Map<string, RoomInfo>();
for (const { campus, url } of ROOM_LISTS) {
  try {
    const timetableNames = new Map([...rooms].filter(([, c]) => c.has(campus)).map(([name]) => [roomKey(name), name]));
    for (const [code, info] of await fetchRoomInfo(url)) {
      const name = timetableNames.get(roomKey(code)) ?? code;
      roomInfo.set(name, info);
      add(rooms, name, campus);
    }
  } catch (e) {
    console.warn(`room details unavailable, continuing without: ${(e as Error).message}`);
  }
}

const sortEt = (a: string, b: string) => a.localeCompare(b, "et");
const campusOrder = Object.keys(CAMPUSES) as Campus[];
const list = (map: Map<string, Set<Campus>>, details?: Map<string, RoomInfo>) =>
  [...map]
    .sort(([a], [b]) => sortEt(a, b))
    .map(([name, campuses]) => ({ name, campuses: campusOrder.filter((c) => campuses.has(c)), ...(details?.has(name) && { info: details.get(name) }) }));
writeFileSync(
  `${OUT}index.json`,
  JSON.stringify({
    generated: new Date().toISOString(),
    sources: SOURCES.map(({ id, label, url }) => ({ id, label, url })),
    campuses: CAMPUSES,
    weeks: index,
    classes: list(classes),
    teachers: list(teachers),
    rooms: list(rooms, roomInfo),
  }),
);
// Lunch menus are extra too: without them the timetable works, so a failure only warns (and that deploy has no menu).
try {
  const lunch = await fetchLunch(LUNCH_URL, fromMonday);
  writeFileSync(`${OUT}lunch.json`, JSON.stringify({ source: LUNCH_URL, generated: new Date().toISOString(), campuses: lunch }));
  const days = Object.entries(lunch).map(([c, l]) => `${c} ${l!.days.length}`).join(", ");
  console.log(`lunch menus: ${days} days`);
} catch (e) {
  console.warn(`lunch menus unavailable, continuing without: ${(e as Error).message}`);
}

console.log(`${index.length} weeks, ${classes.size} classes, ${teachers.size} teachers, ${rooms.size} rooms (${roomInfo.size} with details), ${duplicates} duplicates merged -> ${OUT}${process.env.FETCH_PROXY ? ` (via ${process.env.FETCH_PROXY})` : ""}`);
