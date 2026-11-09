<script setup>
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { DateTime } from 'luxon';
import KioskPage from '../../components/kiosk/KioskPage.vue';
import WeekGrid from '../../components/WeekGrid.vue';
import { useKioskStore } from '../../stores/kiosk';
import { useTimetableStore } from '../../stores/timetable';
import { roomShort } from '../../codes';
import { linkTo } from '../../deepLink';

/** A group's, teacher's or room's whole week on one screen (WeekGrid). `week` (a Monday) picks the week. */
const props = defineProps({
  type: { type: String, required: true }, // 'group', 'teacher' or 'room'
  name: { type: String, required: true },
  week: { type: String, default: '' },
});
const store = useTimetableStore();
const kiosk = useKioskStore();
const router = useRouter();

const FIELD = { group: 'classes', teacher: 'teachers', room: 'rooms' };
const TITLES = { group: 'Õpperühm', teacher: 'Õpetaja', room: 'Ruum' };

// The week: as asked, else this one, or next week from Saturday on
const weeks = computed(() => store.index?.weeks ?? []);
const weekIdx = computed(() => {
  const list = weeks.value;
  if (!list.length) return -1;
  const at = (monday) => list.findIndex((w) => w.monday === monday);
  if (props.week && at(props.week) >= 0) return at(props.week);
  const thisMonday = kiosk.now.startOf('week');
  const monday = kiosk.now.weekday >= 6 ? thisMonday.plus({ weeks: 1 }) : thisMonday;
  const exact = at(monday.toISODate());
  if (exact >= 0) return exact;
  const later = list.findIndex((w) => w.monday > monday.toISODate());
  return later >= 0 ? later : list.length - 1;
});
const monday = computed(() => (weekIdx.value >= 0 ? DateTime.fromISO(weeks.value[weekIdx.value].monday) : null));
const weekRange = computed(() => monday.value && `${monday.value.toFormat('dd.MM')} - ${monday.value.plus({ days: 6 }).toFormat('dd.MM')}`);
const shift = (step) => router.replace({ query: { week: weeks.value[weekIdx.value + step].monday } });

const data = ref(null);
watch(
  () => weeks.value[weekIdx.value]?.file,
  async (file) => {
    data.value = null;
    if (!file) return;
    try {
      data.value = await store.fetchWeek(file);
    } catch {
      data.value = { lessons: [] };
    }
  },
  { immediate: true },
);

// a room, group or teacher opens its own week, the same week, kept in the kiosk
const codeTo = (type, name) => ({ name: 'kiosk-week', params: { type, name }, query: monday.value ? { week: monday.value.toISODate() } : {} });

const lessons = computed(() => (data.value?.lessons ?? []).filter((l) => l[FIELD[props.type]].includes(props.name) && l.subject !== 'BRON'));
</script>
<template>
  <KioskPage :title="type === 'room' ? `Ruum ${roomShort(name)}` : name" :sub="`${TITLES[type]} · nädala tunniplaan`"
    :qr="monday ? linkTo({ type, name, monday: monday.toISODate() }) : null">
    <div class="-mt-2 mb-2 flex items-center justify-end gap-3">
      <button type="button" class="btn btn-lg btn-square border-neutral" :disabled="weekIdx <= 0" aria-label="Eelmine nädal" @click="shift(-1)">‹</button>
      <span class="text-xl font-semibold tabular-nums">{{ weekRange }}</span>
      <button type="button" class="btn btn-lg btn-square border-neutral" :disabled="weekIdx < 0 || weekIdx >= weeks.length - 1" aria-label="Järgmine nädal" @click="shift(1)">›</button>
    </div>

    <WeekGrid :lessons="lessons" :type="type" :monday="monday" :code-to="codeTo"></WeekGrid>
    <p v-if="data && !lessons.length" class="mt-3 text-center text-xl text-base-content/60">Sel nädalal tunde pole.</p>
  </KioskPage>
</template>
