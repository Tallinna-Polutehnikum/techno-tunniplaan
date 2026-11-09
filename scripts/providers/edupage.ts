/**
 * Edupage (https://<school>.edupage.org/timetable/): the school publishes one "regular"
 * timetable per week; each is fetched and its cards resolved into lessons.
 */
import { addDays, byTime, campusOf, clean, fetchJson, mondayOf, type Campus, type Lesson, type Period, type SourceData } from "./types";

type Row = Record<string, any>;

/** Edupage's school year starts in August ("schoolyear_turnover": "08-01"). */
function schoolYear(now = new Date()): number {
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * The week a published timetable covers. Edupage's own start date is not always updated when a
 * school copies a timetable forward (Mustamäe's weeks 7-9 all say 05.10), but their names carry
 * the real range ("1per_7n_12.10-18.10.26"), so that wins when present.
 */
function weekMonday(t: Row): string {
  const m = String(t.text).match(/(\d{2})\.(\d{2})-\d{2}\.\d{2}\.(\d{2})/);
  if (m) return mondayOf(`20${m[3]}-${m[2]}-${m[1]}`);
  // published weeks start on Sunday; the Monday after is the one that matters
  const sunday = new Date(`${t.datefrom}T12:00:00Z`).getUTCDay() === 0;
  return mondayOf(sunday ? addDays(t.datefrom, 1) : t.datefrom);
}

function week(r: Row, campus: Campus): { lessons: Lesson[]; periods: Period[]; classes: string[]; teachers: string[] } {
  const T: Record<string, Row[]> = Object.fromEntries(r.dbiAccessorRes.tables.map((t: Row) => [t.id, t.data_rows]));
  const byId = (name: string) => new Map((T[name] ?? []).map((x) => [x.id, x]));
  const periods = byId("periods");
  const subjects = byId("subjects");
  const classes = byId("classes");
  const teachers = byId("teachers");
  const groups = byId("groups");
  const rooms = byId("classrooms");
  const lessonsById = byId("lessons");

  // Schools sometimes add a one-off copy of a class carrying a note in its name
  // ("M-AUM4-26, 25.09 iseseisev õpe al. 5. tunnist"); fold it into the class and keep the note.
  const className = (id: string) => clean(classes.get(id)?.short).split(/,\s*/)[0];
  const classNote = (id: string) => clean(classes.get(id)?.short).split(/,\s*/).slice(1).join(", ");
  // Some schools only publish teachers' surnames
  const teacherName = (t: Row | undefined) => clean(t?.name) || clean(t?.short);

  const out: Lesson[] = [];
  for (const card of T.cards ?? []) {
    // Unplaced cards have no period and no day.
    if (!card.period || !card.days) continue;
    const lesson = lessonsById.get(card.lessonid);
    if (!lesson) continue;
    const first = Number(card.period);
    const last = first + Math.max(1, Number(lesson.durationperiods) || 1) - 1;
    const startP = periods.get(String(first));
    const endP = periods.get(String(last)) ?? startP;
    if (!startP) continue;
    const day = String(card.days).indexOf("1");
    if (day < 0) continue;
    const note = [...new Set((lesson.classids ?? []).map(classNote).filter(Boolean))].join("; ");
    const roomCodes = (card.classroomids ?? []).map((id: string) => clean(rooms.get(id)?.short)).filter(Boolean);
    out.push({
      day,
      start: startP.starttime,
      end: endP!.endtime,
      subject: clean(subjects.get(lesson.subjectid)?.name),
      classes: [...new Set<string>((lesson.classids ?? []).map(className).filter(Boolean))],
      groups: (lesson.groupids ?? [])
        .map((id: string) => groups.get(id))
        .filter((g: Row | undefined) => g && !g.entireclass)
        .map((g: Row) => clean(g.name)),
      teachers: (lesson.teacherids ?? []).map((id: string) => teacherName(teachers.get(id))).filter(Boolean),
      rooms: roomCodes,
      // the school's own campus, unless the room is at another one (M-A138)
      campus: campusOf(roomCodes) ?? campus,
      ...(note && { note }),
    });
  }
  out.sort(byTime);
  return {
    lessons: out,
    periods: [...periods.values()]
      .filter((p) => p.starttime && p.endtime)
      .map((p) => ({ start: p.starttime, end: p.endtime }))
      .sort((a, b) => a.start.localeCompare(b.start)),
    classes: [...new Set([...classes.keys()].map(className).filter(Boolean))],
    teachers: [...teachers.values()].map(teacherName).filter(Boolean),
  };
}

/** Published weeks of an Edupage school, whose timetable is for `campus`, from `fromMonday` on. */
export async function fetchEdupage(server: string, campus: Campus, fromMonday: string, log: (s: string) => void): Promise<SourceData> {
  const call = async (script: string, func: string, args: unknown[]) => {
    const body = await fetchJson<{ r?: Row }>(`${server}/timetable/server/${script}?__func=${func}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ __args: args, __gsh: "00000000" }),
    });
    if (!body.r) throw new Error(`${func}: empty response`);
    return body.r;
  };

  const year = Number(process.env.EDUPAGE_YEAR ?? schoolYear());
  const viewer = await call("ttviewer.js", "getTTViewerData", [null, year]);
  const published = (viewer.regular?.timetables ?? []).filter((t: Row) => !t.hidden);
  if (!published.length) throw new Error(`no published timetables for ${year}`);

  const weeks = new Map<string, SourceData["weeks"][number]>();
  const classes = new Set<string>();
  const teachers = new Set<string>();
  for (const t of published) {
    const monday = weekMonday(t);
    if (monday < fromMonday) continue;
    if (weeks.has(monday)) log(`  two timetables for ${monday}, keeping "${t.text}"`);
    const data = week(await call("regulartt.js", "regularttGetData", [null, t.tt_num]), campus);
    weeks.set(monday, { monday, lessons: data.lessons, periods: { [campus]: data.periods } });
    data.classes.forEach((c) => classes.add(c));
    data.teachers.forEach((c) => teachers.add(c));
    log(`  ${monday}  ${t.text}  ${data.lessons.length} lessons`);
  }
  return { weeks: [...weeks.values()], classes: [...classes], teachers: [...teachers] };
}
