<script setup>
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';
import DayChips from '../components/DayChips.vue';
import FreeRooms from '../components/FreeRooms.vue';
import NavTabs from '../components/NavTabs.vue';
import WeekSelect from '../components/WeekSelect.vue';
import { MODE_TABS } from './modeTabs';
import { useKioskStore } from '../stores/kiosk';
import { useTimetableStore } from '../stores/timetable';

const store = useTimetableStore();
const kiosk = useKioskStore();
const route = useRoute();
// opens on now: this week, today, the current period, the selection's campus
onMounted(() => {
  store.showFreeRooms();
  // a kiosk shows its own campus, and so does a link scanned off one (?hoone=K)
  const campus = kiosk.settings.enabled ? kiosk.campus : route.query.hoone;
  if (campus) store.setFreeCampus(campus);
});
</script>
<template>
  <NavTabs :tabs="MODE_TABS" label="Vaade" class="mt-3"></NavTabs>
  <WeekSelect class="mt-3"></WeekSelect>
  <DayChips></DayChips>
  <FreeRooms></FreeRooms>
</template>
