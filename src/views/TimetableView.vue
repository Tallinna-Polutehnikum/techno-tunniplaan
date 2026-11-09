<script setup>
import { onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CalendarSync from '../components/CalendarSync.vue';
import DayChips from '../components/DayChips.vue';
import DayWeekToggle from '../components/DayWeekToggle.vue';
import LessonsGrid from '../components/LessonsGrid.vue';
import NavTabs from '../components/NavTabs.vue';
import Search from '../components/Search.vue';
import WeekGrid from '../components/WeekGrid.vue';
import WeekSelect from '../components/WeekSelect.vue';
import { MODE_TABS } from './modeTabs';
import { canSubscribe } from '../calendar';
import { linkFrom, linkTo } from '../deepLink';
import { useTimetableStore } from '../stores/timetable';

const store = useTimetableStore();
const route = useRoute();
const router = useRouter();
onMounted(() => (store.mode = 'timetable'));

// A #/plaan/... link opens what it names, once the snapshot it has to be looked up in has loaded.
watch(
  [() => store.index, () => route.fullPath],
  () => route.name === 'timetable-for' && store.index && store.openLink(linkFrom(route)),
  { immediate: true },
);

// The address bar then follows what is on screen, so it stays a link to this view and can be copied.
// Replacing only on a real difference is also what keeps this from looping with the watch above.
watch(
  () => store.linkState,
  (state) => {
    const to = state ? linkTo(state) : { name: 'timetable' };
    if (router.resolve(to).fullPath !== route.fullPath) router.replace(to);
  },
);
</script>
<template>
  <NavTabs :tabs="MODE_TABS" label="Vaade" class="mt-3"></NavTabs>

  <div class="mt-3 grid grid-cols-[auto_auto] justify-between gap-2.5 md:grid-cols-[1fr_auto_auto] md:justify-stretch">
    <Search class="col-span-full md:col-span-1"></Search>
    <WeekSelect></WeekSelect>
    <DayWeekToggle></DayWeekToggle>
  </div>

  <DayChips></DayChips>
  <!-- the week grid needs a wide screen; a phone keeps the list -->
  <template v-if="store.showWeekGrid">
    <div class="mt-2.5 hidden md:block">
      <WeekGrid :lessons="store.weekLessons" :type="store.selectedSearch.type" :monday="store.monday" :min-height="520"></WeekGrid>
    </div>
    <LessonsGrid class="md:hidden"></LessonsGrid>
  </template>
  <LessonsGrid v-else></LessonsGrid>
  <div class="mt-2.5 rounded-box border border-dashed border-neutral p-3.5 text-center text-base-content/60" v-if="store.emptyMessage">
    {{ store.emptyMessage }}
  </div>
  <CalendarSync v-if="canSubscribe(store.selectedSearch)" :selection="store.selectedSearch"></CalendarSync>
</template>
