/**
 * Favourite groups, teachers and rooms, and how often each has been looked at. Both stay on the device;
 * the visit counts put the often viewed ones first in the search's suggestions.
 */
import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';

const FAVORITES_KEY = 'tahvel.favorites'; // [{ type, name }] in the order they were added
const VISITS_KEY = 'tahvel.visits'; // { 'type:name': { type, name, count, last } }
const MAX_VISITS = 100; // the least visited are forgotten past this

const keyOf = (sel) => `${sel.type}:${sel.name}`;

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

export const useBookmarksStore = defineStore('bookmarks', () => {
  const favorites = ref(load(FAVORITES_KEY, []));
  const visits = ref(load(VISITS_KEY, {}));
  watch(favorites, (f) => localStorage.setItem(FAVORITES_KEY, JSON.stringify(f)), { deep: true });
  watch(visits, (v) => localStorage.setItem(VISITS_KEY, JSON.stringify(v)), { deep: true });

  const favoriteKeys = computed(() => new Set(favorites.value.map(keyOf)));
  const isFavorite = (sel) => !!sel && favoriteKeys.value.has(keyOf(sel));

  function toggleFavorite(sel) {
    if (!sel) return;
    favorites.value = isFavorite(sel) ? favorites.value.filter((f) => keyOf(f) !== keyOf(sel)) : [...favorites.value, { type: sel.type, name: sel.name }];
  }

  function recordVisit(sel) {
    const key = keyOf(sel);
    const seen = visits.value[key];
    visits.value[key] = { type: sel.type, name: sel.name, count: (seen?.count ?? 0) + 1, last: Date.now() };
    const all = Object.entries(visits.value);
    if (all.length > MAX_VISITS) {
      all.sort(([, a], [, b]) => a.count - b.count || a.last - b.last);
      delete visits.value[all[0][0]];
    }
  }

  /** How many times a selection has been looked at, for ranking search hits. */
  const visitCount = (sel) => visits.value[keyOf(sel)]?.count ?? 0;

  /** The most visited first, the latest breaking a tie. */
  const topVisits = computed(() => Object.values(visits.value).sort((a, b) => b.count - a.count || b.last - a.last));

  return { favorites, isFavorite, toggleFavorite, recordVisit, visitCount, topVisits };
});
