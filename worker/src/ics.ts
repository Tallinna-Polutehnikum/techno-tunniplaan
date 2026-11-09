/**
 * Builds an iCalendar feed (RFC 5545) for one group's or teacher's lessons, from the snapshot the
 * deploy publishes. Served by the worker rather than written as files: there are 500-odd groups and
 * teachers, and a file each would be ~17 MB on every deploy, into a branch committed twice an hour.
 */

export interface Lesson {
  day: number; // 0 = Monday
  start: string; // "08:30"
  end: string;
  subject: string;
  classes: string[];
  groups: string[];
  teachers: string[];
  rooms: string[];
  campus?: string;
  note?: string;
}

export interface Week {
  monday: string; // ISO date
  lessons: Lesson[];
}

export interface Index {
  generated: string;
  campuses: Record<string, string>;
  weeks: { monday: string; file: string }[];
  classes: { name: string }[];
  teachers: { name: string }[];
}

export type Kind = "group" | "teacher";

/** The lesson field each kind is found in. */
const FIELD: Record<Kind, "classes" | "teachers"> = { group: "classes", teacher: "teachers" };

/** Bookings, not lessons; the week view hides them too. */
const isBooking = (l: Lesson) => l.subject === "BRON";

const words = (s: string) =>
  s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * The snapshot's spelling of a name. Matched on words regardless of order, so a link written with
 * Tahvel's "First Last" still finds Edupage's "Last First", as the app's own lookup does.
 */
export function canonical(pool: { name: string }[], name: string): string | null {
  const exact = pool.find((e) => e.name === name);
  if (exact) return exact.name;
  const key = words(name).sort().join(" ");
  return pool.find((e) => words(e.name).sort().join(" ") === key)?.name ?? null;
}

// --- time ---------------------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");

/** Europe/Tallinn's offset from UTC in minutes at an instant (+120 in winter, +180 in summer). */
function tallinnOffset(at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Tallinn", timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")!.value; // "GMT+03:00"
  const m = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 120;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/**
 * A wall-clock date and time in Tallinn as a UTC stamp ("20260928T053000Z"). Lessons are published as
 * local times, and a UTC stamp needs no VTIMEZONE and stays right for a reader in another zone.
 * The offset is looked up twice, the second time at the instant the first one implies, so a lesson
 * either side of a DST change still lands correctly.
 */
export function utcStamp(date: string, time: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  let utc = naive - tallinnOffset(new Date(naive)) * 60_000;
  utc = naive - tallinnOffset(new Date(utc)) * 60_000;
  const t = new Date(utc);
  return (
    `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}` +
    `T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00Z`
  );
}

/** ISO date `days` after an ISO date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// --- writing ------------------------------------------------------------------------------------

/** Escapes a text value: backslash, semicolon, comma and newlines (RFC 5545 §3.3.11). */
const esc = (s: string) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/**
 * Folds a content line to 75 octets, counting UTF-8 bytes rather than characters so Estonian
 * diacritics cannot be split across the fold or push a line over the limit.
 */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let used = 0; // octets on the line being filled, 1 for the leading space on continuations
  let current = "";
  for (const ch of line) {
    const size = new TextEncoder().encode(ch).length;
    if (used + size > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
      used = 1;
    }
    current += ch;
    used += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

/** A tiny stable hash (FNV-1a), so a lesson keeps its UID between regenerations. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/**
 * The feed. `kind` decides what each event leaves out: a group's events name the teacher, a
 * teacher's name the group, as the app's own rows do.
 */
export function buildIcs({ kind, name, index, weeks }: { kind: Kind; name: string; index: Index; weeks: Week[] }): string {
  const stamp = utcStamp(index.generated.slice(0, 10), index.generated.slice(11, 16));
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Techno TLN//Tunniplaan//ET",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)} tunniplaan`,
    "X-WR-TIMEZONE:Europe/Tallinn",
    // the snapshot is rebuilt every 30 minutes; an hour is often as close as clients will poll
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const week of weeks) {
    const mine = week.lessons.filter((l) => !isBooking(l) && l[FIELD[kind]].includes(name));
    for (const l of mine) {
      const date = addDays(week.monday, l.day);
      const rooms = l.rooms.join(", ");
      const campus = l.campus ? (index.campuses[l.campus] ?? l.campus) : "";
      // what the event says besides the subject: whichever of room, group and teacher it is not about
      const details = [
        kind !== "group" && [...l.classes, ...l.groups].join(" "),
        kind !== "teacher" && l.teachers.join(", "),
        l.note,
      ].filter(Boolean) as string[];
      lines.push(
        "BEGIN:VEVENT",
        `UID:${date}-${l.start.replace(":", "")}-${hash(`${l.subject}|${rooms}|${l.teachers.join()}|${l.classes.join()}`)}@kasparsu.github.io`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${utcStamp(date, l.start)}`,
        `DTEND:${utcStamp(date, l.end)}`,
        `SUMMARY:${esc(rooms ? `${l.subject} (${rooms})` : l.subject)}`,
        ...(rooms || campus ? [`LOCATION:${esc([rooms, campus].filter(Boolean).join(", "))}`] : []),
        ...(details.length ? [`DESCRIPTION:${esc(details.join(" · "))}`] : []),
        "END:VEVENT",
      );
    }
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
