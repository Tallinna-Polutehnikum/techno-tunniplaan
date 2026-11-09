/** One lesson in the app's format, whatever system it came from. */
export interface Lesson {
  day: number; // 0 = Monday
  start: string; // "08:30"
  end: string;
  subject: string;
  classes: string[];
  groups: string[]; // part of a class; empty = whole class
  teachers: string[]; // "Last First", as Edupage writes them
  rooms: string[];
  campus?: Campus; // where the lesson takes place, see campusOf
  note?: string; // e.g. Edupage's one-off class variants ("25.09 iseseisev õpe")
}

/** Techno TLN's campuses, by the letter that starts their group and room codes (K-TA-24A, M-A138). */
export const CAMPUSES = { K: "Kesklinn", M: "Mustamäe", J: "Järve", L: "Lasnamäe" } as const;
export type Campus = keyof typeof CAMPUSES;

/** A room that only names a campus: Kesklinn's Edupage books lessons held elsewhere into a room called "Lasnamäe". */
export function campusRoom(room: string): Campus | undefined {
  return (Object.keys(CAMPUSES) as Campus[]).find((c) => CAMPUSES[c].toLowerCase() === room.toLowerCase());
}

/** The campus a group or room code names: a campus letter prefix (K-TA-24A, M-A138) or a campus-named room. */
export function campusOf(codes: string[]): Campus | undefined {
  for (const code of codes) {
    const letter = code.match(/^([A-Z])-/)?.[1];
    if (letter && letter in CAMPUSES) return letter as Campus;
    if (campusRoom(code)) return campusRoom(code);
  }
}

/** One bell period. Free periods are shown for periods that fall wholly inside a gap. */
export interface Period {
  start: string;
  end: string;
}

export interface SourceWeek {
  monday: string; // ISO date
  lessons: Lesson[];
  periods: Partial<Record<Campus, Period[]>>; // bell schedule per campus
}

export interface SourceData {
  weeks: SourceWeek[];
  classes: string[];
  teachers: string[];
}

/** Base URL for an upstream host, through the Cloudflare Worker relay when FETCH_PROXY is set. */
export function upstream(host: string, proxyPrefix: string): string {
  const proxy = process.env.FETCH_PROXY?.replace(/\/$/, "");
  return proxy ? `${proxy}/${proxyPrefix}` : `https://${host}`;
}

/** fetch with a timeout: a blocked connection otherwise hangs for the OS connect timeout (over 2 minutes). */
export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const clean = (s: unknown) => String(s ?? "").replace(/ /g, " ").trim();

/** Monday of the week containing an ISO date. */
export function mondayOf(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const byTime = (a: Lesson, b: Lesson) =>
  a.day - b.day || a.start.localeCompare(b.start) || a.classes.join().localeCompare(b.classes.join());
