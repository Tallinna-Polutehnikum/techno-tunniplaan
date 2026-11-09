/**
 * Tahvel (https://tahveltp.edu.ee): a school's public timetable events for a date range, the
 * same data as its school board (#/schoolBoard/<id>). Events are single 45-minute periods, so
 * back-to-back periods of the same lesson are merged into one lesson like Edupage's, and the bell
 * schedule is read off the event times since Tahvel does not publish it separately.
 */
import { addDays, byTime, campusOf, clean, fetchJson, type Campus, type Lesson, type Period, type SourceData } from "./types";

type Row = Record<string, any>;
const PAGE_SIZE = 2000;

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** All events of one week, following Tahvel's pages. */
async function weekEvents(server: string, schoolId: number, monday: string): Promise<Row[]> {
  const events: Row[] = [];
  for (let page = 0; ; page++) {
    const params = new URLSearchParams({
      from: `${monday}T00:00:00.000Z`,
      thru: `${addDays(monday, 6)}T23:59:59.999Z`,
      lang: "ET",
      schoolId: String(schoolId),
      page: String(page),
      size: String(PAGE_SIZE),
    });
    const body = await fetchJson<Row>(`${server}/hois_back/timetableevents/timetableSearch?${params}`);
    events.push(...(body.content ?? []));
    if (body.last !== false) return events;
  }
}

/** Tahvel's "First Last" as Edupage's "Last First", so the same teacher is recognised in both. */
const teacherName = (t: Row) => clean([t.lastname, t.firstname].filter(Boolean).join(" ")) || clean(t.name);

/**
 * "PM - E243", as Tahvel shows it: the same room code can exist in several buildings. Kesklinn's
 * rooms (K-A301) are written as Kesklinn's Edupage writes them (A-301), so both systems' lessons in
 * a room are seen together, which the free-room search relies on.
 */
const roomName = (r: Row) => {
  const code = clean(r.roomCode);
  const kesklinn = code.match(/^K-([A-Z])(\d.*)$/);
  if (kesklinn) return `${kesklinn[1]}-${kesklinn[2]}`;
  const building = clean(r.buildingCode);
  return building && code ? `${building} - ${code}` : code;
};

/**
 * Where an event takes place: its room's building (Tahvel room codes do not always say the
 * campus), else a campus-lettered room code, else its group's code (groups can move campus, so last).
 */
function eventCampus(e: Row, buildings: Record<string, Campus>): Campus | undefined {
  for (const r of e.rooms ?? []) if (buildings[clean(r.buildingCode)]) return buildings[clean(r.buildingCode)];
  return campusOf((e.rooms ?? []).map((r: Row) => clean(r.roomCode))) ?? campusOf((e.studentGroups ?? []).map((g: Row) => clean(g.code)));
}

function toLesson(e: Row, monday: string, buildings: Record<string, Campus>): Lesson {
  return {
    day: Math.round((Date.parse(e.date) - Date.parse(`${monday}T00:00:00Z`)) / 86_400_000),
    start: e.timeStart,
    end: e.timeEnd,
    subject: clean(e.nameEt),
    classes: (e.studentGroups ?? []).map((g: Row) => clean(g.code)).filter(Boolean),
    groups: (e.subgroups ?? []).map((g: Row) => clean(g.code ?? g.name)).filter(Boolean),
    teachers: (e.teachers ?? []).map(teacherName).filter(Boolean),
    rooms: (e.rooms ?? []).map(roomName).filter(Boolean),
    campus: eventCampus(e, buildings),
  };
}

/** Join periods of the same lesson that follow each other without a break (08:30-09:15 + 09:15-10:00). */
function mergePeriods(lessons: Lesson[]): Lesson[] {
  const key = (l: Lesson) => JSON.stringify([l.day, l.subject, l.classes, l.groups, l.teachers, l.rooms, l.campus]);
  const sorted = [...lessons].sort((a, b) => key(a).localeCompare(key(b)) || a.start.localeCompare(b.start));
  const out: Lesson[] = [];
  for (const l of sorted) {
    const prev = out.at(-1);
    if (prev && key(prev) === key(l) && prev.end === l.start) prev.end = l.end;
    else out.push({ ...l });
  }
  return out.sort(byTime);
}

/** The bell schedule: 45-minute slots that many events use, the most used first, skipping any that overlap. */
function bellPeriods(lessons: Lesson[]): Period[] {
  const counts = new Map<string, number>();
  for (const l of lessons) {
    if (minutes(l.end) - minutes(l.start) === 45) counts.set(`${l.start}-${l.end}`, (counts.get(`${l.start}-${l.end}`) ?? 0) + 1);
  }
  const periods: Period[] = [];
  for (const [slot, n] of [...counts].sort((a, b) => b[1] - a[1])) {
    if (n < 5) break;
    const [start, end] = slot.split("-");
    if (periods.every((p) => end <= p.start || start >= p.end)) periods.push({ start, end });
  }
  return periods.sort((a, b) => a.start.localeCompare(b.start));
}

/** A Tahvel school's lessons for the given weeks; `buildings` maps Tahvel building codes to campuses. */
export async function fetchTahvel(
  server: string,
  schoolId: number,
  buildings: Record<string, Campus>,
  mondays: string[],
  log: (s: string) => void,
): Promise<SourceData> {
  const weeks = [];
  const classes = new Set<string>();
  const teachers = new Set<string>();
  for (const monday of mondays) {
    // events without a group or teacher (room bookings, open days) cannot be searched for
    const raw = (await weekEvents(server, schoolId, monday))
      .filter((e) => e.studentGroups?.length || e.teachers?.length)
      .map((e) => toLesson(e, monday, buildings))
      .filter((l) => l.day >= 0 && l.day < 7);
    const lessons = mergePeriods(raw);
    // each campus keeps its own bells (Järve and Lasnamäe differ)
    const periods: Partial<Record<Campus, Period[]>> = {};
    for (const campus of new Set(raw.map((l) => l.campus))) {
      if (!campus) continue;
      const bells = bellPeriods(raw.filter((l) => l.campus === campus));
      if (bells.length) periods[campus] = bells;
    }
    weeks.push({ monday, lessons, periods });
    lessons.forEach((l) => {
      l.classes.forEach((c) => classes.add(c));
      l.teachers.forEach((t) => teachers.add(t));
    });
    log(`  ${monday}  ${raw.length} periods -> ${lessons.length} lessons`);
  }
  return { weeks, classes: [...classes], teachers: [...teachers] };
}
