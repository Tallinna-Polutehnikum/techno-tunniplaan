/** The campuses' school lunch menus (data/lunch.json, read from techno.ee at deploy time). */
import { ref } from 'vue';
import { defineStore } from 'pinia';

export const useLunchStore = defineStore('lunch', () => {
  const data = ref(null); // { source, generated, campuses: { K: { days, notes, legend } } }
  const missing = ref(false); // the deploy could not read the menus
  let loading = null;

  /** Load once; `fresh` re-reads (a kiosk stays open for days). */
  function load(fresh = false) {
    if (loading && !fresh) return loading;
    loading = fetch(`${import.meta.env.BASE_URL}data/lunch.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        data.value = d;
        missing.value = false;
      })
      .catch(() => {
        if (!data.value) missing.value = true;
      });
    return loading;
  }

  const menu = (campus) => data.value?.campuses?.[campus] ?? null;
  /** The day to open on: `today` (ISO) when it has a menu, else the next day that has one, else the last. */
  function dayFor(campus, today) {
    const days = menu(campus)?.days ?? [];
    return (days.find((d) => d.date >= today) ?? days.at(-1))?.date ?? null;
  }
  /**
   * A day's lunch in a few words for a timetable row: the meals to pick from, else the first dishes served,
   * without the allergen letters ("Kanakarri (G, L)" is "Kanakarri").
   */
  function summary(campus, date) {
    const day = menu(campus)?.days.find((d) => d.date === date);
    if (!day) return [];
    if (day.closed) return [day.intro]; // "Koolilõunat ei pakuta."
    const choices = day.sections.filter((s) => s.choice).map((s) => s.dishes[0]?.name);
    const names = choices.length ? choices : (day.sections[0]?.dishes ?? []).slice(0, 2).map((d) => d.name);
    return names.filter(Boolean).map((n) => n.replace(/\s*\([A-ZÕÄÖÜ]{1,3}(,\s*[A-ZÕÄÖÜ]{1,3})*\)$/, ''));
  }
  return { data, missing, load, menu, dayFor, summary };
});
