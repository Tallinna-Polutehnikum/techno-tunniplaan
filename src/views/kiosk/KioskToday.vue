<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import KioskPage from '../../components/kiosk/KioskPage.vue';
import LessonsGrid from '../../components/LessonsGrid.vue';
import { lessonRows } from '../../lessonRows';
import { useKioskStore } from '../../stores/kiosk';
import { useTimetableStore } from '../../stores/timetable';
import { roomShort } from '../../codes';
import { linkTo } from '../../deepLink';
import { kioskCodeTo } from './kioskPick';

/**
 * A group's, teacher's or room's lessons today, at any campus, listed like the timetable with its free
 * periods; lessons already over are faded.
 */
const props = defineProps({ type: { type: String, required: true }, name: { type: String, required: true } });
const kiosk = useKioskStore();
const timetable = useTimetableStore();
const router = useRouter();
const FIELD = { group: 'classes', teacher: 'teachers', room: 'rooms' };
const field = computed(() => FIELD[props.type]);
const lessons = computed(() => kiosk.today.filter((l) => l[field.value].includes(props.name)).sort((a, b) => a.start.localeCompare(b.start)));
const rows = computed(() =>
  lessonRows({
    lessons: lessons.value,
    type: props.type,
    monday: kiosk.now.startOf('week'),
    periods: kiosk.week?.periods,
    lunch: kiosk.week?.lunch,
    // a lesson at another campus than the kiosk's says where
    campusLabel: (l) => (l.campus && l.campus !== kiosk.campus ? (timetable.index?.campuses?.[l.campus] ?? l.campus) : ''),
  }),
);
// the kiosk's own campus's lunch opens its lunch page
const lunchTo = (lunch) => (lunch.campus === kiosk.campus ? { name: 'kiosk-lunch', query: { date: lunch.date } } : null);
const fullTimetable = () => router.push({ name: 'kiosk-week', params: { type: props.type, name: props.name } });
</script>
<template>
  <KioskPage :title="type === 'room' ? `Ruum ${roomShort(name)}` : name" :sub="`Tänased tunnid · kell ${kiosk.time}`"
    :qr="linkTo({ type, name, display: 'today' })">
    <!-- the timetable's own rows, enlarged for a screen read from a step away -->
    <div v-if="rows.length" class="mx-auto max-w-4xl [zoom:1.4]">
      <LessonsGrid :rows="rows" :dividers="false" :now="kiosk.time" :lunch-to="lunchTo" :code-to="kioskCodeTo" class="mt-0"></LessonsGrid>
    </div>
    <p v-else class="rounded-box border border-dashed border-neutral p-6 text-center text-xl text-base-content/60">Täna tunde pole.</p>
    <button type="button" class="btn btn-lg mt-5 border-neutral" @click="fullTimetable">Vaata nädala tunniplaani</button>
  </KioskPage>
</template>
