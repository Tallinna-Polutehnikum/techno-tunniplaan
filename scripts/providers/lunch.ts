/**
 * School lunch menus from https://menuu.techno.ee/menu.php?format=json: every campus, its weeks and
 * their days, as data. It replaces reading them out of the page at techno.ee, which had to cope with
 * markup that was not always well-formed — a week left open swallowing the next, a day listed twice,
 * a leftover test entry beside the real one — and with each campus writing its menu differently.
 *
 * The feed gives a day its meals to choose between and the things served with all of them, with the
 * ingredients, amount, energy and allergens of each. Days carry no date: they are the weekdays from
 * the week's Monday, in order.
 */
import { clean, type Campus } from "./types";

export interface Dish {
  name: string;
  ingredients?: string;
  allergens?: string;
  amount?: string; // "180 g"
  kcal?: string; // "217"
}
export interface LunchSection {
  title: string; // "Koolilõuna", "Taimetoit", "Kõigi valikute juurde"
  choice: boolean; // one of the meals to pick from, rather than served with every meal
  dishes: Dish[];
}
export interface LunchDay {
  date: string; // ISO
  intro?: string; // the kitchen's own words, or on a day without lunch why there is none
  sections: LunchSection[];
  closed?: boolean; // no lunch that day, rather than no menu published
}
export interface CampusLunch {
  days: LunchDay[];
  notes: string[];
  legend: string[]; // "G – sisaldab gluteeni"
}

/** The feed names its campuses; these are the letters the rest of the app knows them by. */
const CAMPUS_OF: Record<string, Campus> = { kesklinn: "K", mustamae: "M", jarve: "J", lasnamae: "L" };

/** The fourteen the EU asks to be declared, in the words a menu would use here. */
const ALLERGEN: Record<string, string> = {
  gluten: "gluteen",
  crustaceans: "koorikloomad",
  eggs: "muna",
  fish: "kala",
  peanuts: "maapähkel",
  soybeans: "soja",
  soya: "soja",
  milk: "piim",
  nuts: "pähklid",
  celery: "seller",
  mustard: "sinep",
  sesame: "seesam",
  sulphites: "sulfitid",
  lupin: "lupiin",
  molluscs: "limused",
};

type Row = Record<string, any>;

/** "125.00" + "g" → "125 g"; a number is written without the noughts it does not need. */
function amountOf(quantity: unknown, unit: unknown): string | undefined {
  const n = Number(quantity);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return `${Math.round(n * 100) / 100} ${clean(unit) || "g"}`.trim();
}

function dish(c: Row): Dish {
  const allergens = (c.allergens ?? []).map((a: string) => ALLERGEN[a] ?? a);
  return {
    name: clean(c.name),
    ingredients: clean(c.ingredients) || undefined,
    allergens: allergens.length ? allergens.join(", ") : undefined,
    amount: amountOf(c.quantity, c.unit),
    kcal: Number(c.energy) > 0 ? String(Math.round(Number(c.energy))) : undefined,
  };
}

/** ISO date `days` after an ISO date. */
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function day(d: Row, date: string): LunchDay | null {
  const note = clean(d.note) || undefined;
  // A day can be listed only to say there is no lunch. Keep it: dropping it made the app fall back
  // to another day's menu, as if that were today's.
  if (d.closed) return { date, intro: note ?? "Koolilõunat ei pakuta.", sections: [], closed: true };

  const sections: LunchSection[] = (d.choices ?? [])
    .map((c: Row): LunchSection => ({ title: clean(c.name), choice: true, dishes: (c.components ?? []).map(dish) }))
    .filter((s: LunchSection) => s.dishes.length);
  const shared = (d.shared ?? []).map(dish).filter((x: Dish) => x.name);
  if (shared.length) sections.push({ title: "Kõigi valikute juurde", choice: false, dishes: shared });

  return sections.length ? { date, intro: note, sections } : null;
}

/**
 * Mustamäe's kitchen reports through a different provider, and the feed passes it on as it comes:
 * the day carries its own date and one flat list of what is served, with a second of what is there
 * besides, and no choice to make between them.
 *
 * Its allergens are numbers, and they are not the EU's: a yoghurt cream is marked 2, which there
 * would be crustaceans, and bread 1, 2, 3. Nothing in the feed says what the numbers mean, so they
 * are left out rather than guessed at — the campus's own note already says to ask the kitchen.
 */
function dailyDay(d: Row): LunchDay | null {
  const plain = (c: Row): Dish => ({ ...dish(c), allergens: undefined });
  const sections: LunchSection[] = [];
  const lunch = (d.lunch ?? []).map(plain).filter((x: Dish) => x.name);
  const extra = (d.additional ?? []).map(plain).filter((x: Dish) => x.name);
  if (lunch.length) sections.push({ title: "Koolilõuna", choice: false, dishes: lunch });
  if (extra.length) sections.push({ title: "Lisaks", choice: false, dishes: extra });
  const date = clean(d.date);
  return date && sections.length ? { date, sections } : null;
}

/** Every campus's menus from `fromDate` on, by the letter the app knows the campus by. */
export async function fetchLunch(url: string, fromDate: string): Promise<Partial<Record<Campus, CampusLunch>>> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(60_000),
    headers: { "user-agent": "tahvel-tunniplaan (+https://kasparsu.github.io/tahvel-tunniplaan/)" },
  });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const body = (await res.json()) as Row;

  const out: Partial<Record<Campus, CampusLunch>> = {};
  for (const entry of body.campuses ?? []) {
    const campus = CAMPUS_OF[clean(entry.campus?.slug)];
    if (!campus) continue;

    const days = new Map<string, LunchDay>();
    const notes = new Set<string>();
    for (const week of entry.menus ?? []) {
      const menu = week.menu ?? {};
      const monday = clean(week.week_start || menu.week_start);
      if (!monday) continue;
      // when the kitchen serves, which the page used to leave unsaid
      const serves = clean(menu.service_time);
      if (serves) notes.add(`Koolilõunat pakutakse kell ${serves}.`);
      for (const text of [week.campus_notes, menu.notes]) if (clean(text)) notes.add(clean(text));

      // the daily provider dates its own days; the other numbers them from the Monday
      (menu.days ?? []).forEach((d: Row, i: number) => {
        const made = menu.provider === "daily" ? dailyDay(d) : day(d, addDays(monday, i));
        if (made && made.date >= fromDate) days.set(made.date, made);
      });
    }

    out[campus] = {
      days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
      notes: [...notes],
      // the feed names its allergens outright, so there is no longer a key of letters to carry
      legend: [],
    };
  }

  if (!Object.keys(out).length) throw new Error(`${url}: no campus menus found (feed shape changed?)`);
  return out;
}
