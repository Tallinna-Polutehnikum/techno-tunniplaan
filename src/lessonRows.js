/**
 * Lessons as the rows the timetable lists: one per lesson, with free periods ("Vaba") before the
 * first lesson of a day and between lessons (not after the last), from the bell times of the campus
 * the next lesson is at, and lunch where that campus's lunch break falls between two lessons or
 * after those free periods (or a "Söögitund" lesson is). Used by the timetable and by the kiosk's "today" screens.
 */
import { DateTime } from 'luxon';

export const DAY_LETTERS = ['E', 'T', 'K', 'N', 'R', 'L', 'P']; // Mon-Sun
export const DAY_NAMES = ['Esmaspäev', 'Teisipäev', 'Kolmapäev', 'Neljapäev', 'Reede', 'Laupäev', 'Pühapäev'];

/** Bell periods lying wholly between `from` and `to`, back-to-back ones merged (08:30-09:15 + 09:15-10:00 = one block). */
function freeBlocks(periods, from, to) {
  const blocks = [];
  for (const p of periods) {
    if (p.start < from || p.end > to) continue;
    const last = blocks.at(-1);
    if (last?.end === p.start) last.end = p.end;
    else blocks.push({ start: p.start, end: p.end });
  }
  return blocks;
}

/**
 * Which numbered lessons a span covers, from the campus's bell times: the periods lying inside it.
 * A lesson is 45 minutes, so a double block covers two, and one running across the lunch break still
 * covers only the two it teaches, the break being no period. Anything off the bell schedule (an early
 * consultation, an all-day course) lies inside none and gets no number.
 */
function periodSpan(periods, start, end) {
  const inside = periods.map((p, i) => ({ p, i })).filter(({ p }) => p.start >= start && p.end <= end);
  if (!inside.length) return null;
  const first = inside[0].i + 1;
  const last = inside.at(-1).i + 1;
  const count = inside.length;
  return {
    first,
    last,
    count,
    label: first === last ? `${first}. tund` : `${first}.-${last}. tund`,
    // the count spelled out, for the title on the bare number next to the label
    countLabel: count === 1 ? '1 tund' : `${count} tundi`,
  };
}

/** Järve's groups have their lunch as a lesson. */
const isLunchLesson = (l) => /^söögitund$/i.test(l.subject.trim());

/** A note about one date ("25.09 iseseisva õppe päev") belongs only on that day's lessons; undated notes on all. */
function noteFor(note, date) {
  const m = note?.match(/^(\d{1,2})\.(\d{1,2})\b/);
  if (!m) return note;
  return Number(m[1]) === date.day && Number(m[2]) === date.month ? note : undefined;
}

/**
 * lessons     one selection's lessons, in day and time order
 * type        what was selected ('group', 'teacher', 'room'): its own field is left off the rows
 * monday      the week's Monday (luxon DateTime)
 * periods     the week's bell times per campus
 * lunch       the week's lunch break per campus ({ start, end })
 * showFree    insert free periods
 * showLunch   insert lunch breaks
 * tintToday   mark today's rows (the week list does)
 * campusLabel lesson → the campus name to show on its row, or ''
 */
export function lessonRows({ lessons, type, monday, periods = {}, lunch = {}, showFree = true, showLunch = true, tintToday = false, campusLabel = () => '' }) {
  const periodsOf = (l) => periods[l.campus] ?? [];
  const withFree = [];
  let cursor = { day: -1 };
  for (const l of lessons) {
    if (l.day !== cursor.day) cursor = { day: l.day, end: periodsOf(l)[0]?.start ?? l.start, started: false };
    // a room has no lunch; a group's or teacher's lunch break, when it falls between two of their lessons (or
    // after the free periods a day starting later begins with)
    const brk = lunch[l.campus];
    const eats = showLunch && type !== 'room' && (cursor.started || showFree) && brk && brk.start >= cursor.end && brk.end <= l.start;
    const free = showFree ? freeBlocks(periodsOf(l), cursor.end, l.start).filter((b) => !eats || b.end <= brk.start || b.start >= brk.end) : [];
    if (eats) free.push({ ...brk, lunch: true, campus: l.campus });
    free.sort((a, b) => a.start.localeCompare(b.start));
    // the span is worked out here, while the campus whose bells the block came from is still known
    for (const b of free) withFree.push({ day: l.day, ...b, free: !b.lunch, span: b.lunch ? null : periodSpan(periodsOf(l), b.start, b.end) });
    if (showLunch && isLunchLesson(l)) withFree.push({ day: l.day, start: l.start, end: l.end, lunch: true, campus: l.campus });
    else withFree.push(l);
    if (l.end > cursor.end) cursor.end = l.end;
    cursor.started = true;
  }

  return withFree.map((l) => {
    const date = monday.plus({ days: l.day });
    const row = {
      day: DAY_LETTERS[l.day],
      dayName: DAY_NAMES[l.day],
      date: date.toFormat('dd.MM'),
      iso: date.toISODate(),
      time: { start: l.start, end: l.end },
      isToday: tintToday && date.hasSame(DateTime.now(), 'day'),
    };
    if (l.free) return { ...row, free: true, span: l.span };
    if (l.lunch) return { ...row, lunch: { campus: l.campus, date: date.toISODate() } };
    return {
      ...row,
      span: periodSpan(periodsOf(l), l.start, l.end),
      name: l.subject,
      room: l.rooms.join(', '),
      group: [...l.classes, ...l.groups].join(' '),
      rooms: l.rooms,
      classes: l.classes,
      subgroups: l.groups, // "rühm 1": part of a group, not a timetable of its own
      teachers: l.teachers,
      teacher: l.teachers.join(', '),
      note: noteFor(l.note, date),
      campus: campusLabel(l),
      // each row leaves out what was searched for: a group's names the teacher, a room's the group and teacher
      showGroup: type !== 'group',
      showTeacher: type !== 'teacher',
      showRoom: type !== 'room',
    };
  });
}
