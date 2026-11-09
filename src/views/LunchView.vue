<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { DateTime } from 'luxon';
import LunchMenu from '../components/LunchMenu.vue';
import NavTabs from '../components/NavTabs.vue';
import { DAY_LETTERS } from '../lessonRows';
import { MODE_TABS } from './modeTabs';
import { useKioskStore } from '../stores/kiosk';
import { useLunchStore } from '../stores/lunch';
import { useTimetableStore } from '../stores/timetable';

const KEY = 'tahvel.lunchCampus';
const lunch = useLunchStore();
const store = useTimetableStore();
const kiosk = useKioskStore();
const route = useRoute();
onMounted(() => lunch.load());

// A timetable's lunch row asks for its campus and day (?campus=K&date=2026-09-30). Else the campus last looked at;
// at first the kiosk's, or the selected group's or teacher's.
const campus = ref(route.query.campus || localStorage.getItem(KEY) || (kiosk.settings.enabled ? kiosk.campus : store.selectedCampuses[0]) || 'K');
watch(campus, (c) => localStorage.setItem(KEY, c));

const today = DateTime.now().toISODate();
const menu = computed(() => lunch.menu(campus.value));
const date = ref(route.query.date || null);
// on another campus the same day when it has a menu, else today's or the next one
const hasDay = (d) => menu.value?.days.some((x) => x.date === d);
watch([campus, () => lunch.data], () => (date.value = hasDay(date.value) ? date.value : lunch.dayFor(campus.value, today)), { immediate: true });

// The menu's weeks, and the days of the one the picked day is in
const mondayOf = (iso) => DateTime.fromISO(iso).startOf('week').toISODate();
const weeks = computed(() => [...new Set((menu.value?.days ?? []).map((d) => mondayOf(d.date)))]);
const weekIdx = computed(() => (date.value ? weeks.value.indexOf(mondayOf(date.value)) : -1));
const chips = computed(() =>
  (menu.value?.days ?? [])
    .filter((d) => mondayOf(d.date) === weeks.value[weekIdx.value])
    .map((d) => {
      const dt = DateTime.fromISO(d.date);
      return { date: d.date, letter: DAY_LETTERS[dt.weekday - 1], label: dt.toFormat('dd.MM') };
    }),
);
const weekRange = computed(() => {
  const monday = weeks.value[weekIdx.value];
  if (!monday) return '';
  const m = DateTime.fromISO(monday);
  return `${m.toFormat('dd.MM')} - ${m.plus({ days: 6 }).toFormat('dd.MM')}`;
});
/** Another week: its first day, or today when that is the week. */
function shiftWeek(step) {
  const monday = weeks.value[weekIdx.value + step];
  const days = menu.value.days.filter((d) => mondayOf(d.date) === monday);
  date.value = (days.find((d) => d.date === today) ?? days[0]).date;
}
const day = computed(() => menu.value?.days.find((d) => d.date === date.value) ?? null);
</script>
<template>
  <NavTabs :tabs="MODE_TABS" label="Vaade" class="mt-3"></NavTabs>

  <div class="mt-3 flex flex-wrap items-center justify-between gap-2.5">
    <div class="flex flex-wrap gap-1.5" role="group" aria-label="Õppehoone">
      <button v-for="c in store.campuses" :key="c.id" type="button" class="chip btn btn-sm h-9 rounded-selector"
        :class="campus === c.id ? 'btn-primary btn-outline' : 'border-neutral bg-base-300'" :aria-pressed="campus === c.id" @click="campus = c.id">
        {{ c.name }}
      </button>
    </div>
    <div v-if="weeks.length" class="flex items-center gap-1.5 text-sm whitespace-nowrap text-base-content/60">
      <button class="btn btn-square btn-ghost btn-sm" :disabled="weekIdx <= 0" @click="shiftWeek(-1)" aria-label="Eelmine nädal">‹</button>
      <span :class="{ 'font-semibold text-base-content': weeks[weekIdx] === mondayOf(today) }">{{ weekRange }}</span>
      <button class="btn btn-square btn-ghost btn-sm" :disabled="weekIdx >= weeks.length - 1" @click="shiftWeek(1)" aria-label="Järgmine nädal">›</button>
    </div>
  </div>

  <div v-if="chips.length" class="mt-3.5 flex gap-1.5 overflow-x-auto py-1" aria-label="Päevad">
    <button v-for="c in chips" :key="c.date" type="button" class="chip btn btn-sm h-9 rounded-selector"
      :class="date === c.date ? 'btn-primary btn-outline' : 'border-neutral bg-base-300'" @click="date = c.date">
      <span class="w-5 text-center text-base">{{ c.letter }}</span>
      <span class="font-medium opacity-60">{{ c.label }}</span>
    </button>
  </div>

  <LunchMenu v-if="day" :day="day" class="mt-3"></LunchMenu>
  <p v-else-if="lunch.data || lunch.missing" class="mt-3 rounded-box border border-dashed border-neutral p-3.5 text-center text-base-content/60">
    {{ lunch.missing ? 'Koolilõuna menüüd ei õnnestunud laadida.' : 'Selle õppehoone menüüd pole avaldatud.' }}
  </p>

  <details v-if="menu && (menu.notes.length || menu.legend.length)" class="mt-4 rounded-box border border-base-300 p-3 text-sm">
    <summary class="cursor-pointer font-semibold">Märkused ja allergeenide tähised</summary>
    <ul v-if="menu.legend.length" class="mt-2 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
      <li v-for="l in menu.legend" :key="l">{{ l }}</li>
    </ul>
    <ul v-if="menu.notes.length" class="mt-2 list-disc pl-5 text-base-content/70">
      <li v-for="n in menu.notes" :key="n">{{ n }}</li>
    </ul>
  </details>
  <p v-if="lunch.data" class="mt-3 text-sm text-base-content/60">
    Allikas: <a :href="lunch.data.source" class="link" target="_blank" rel="noopener">techno.ee koolilõuna</a>
  </p>
</template>
