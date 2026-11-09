<script setup>
import { computed } from 'vue';
import KioskLessons from '../../components/kiosk/KioskLessons.vue';
import KioskPage from '../../components/kiosk/KioskPage.vue';
import { OTHER, useKioskStore } from '../../stores/kiosk';
import { roomBuilding } from '../../codes';

/** Lessons going on now and the next ones to start, at the kiosk's campus or in one of its buildings. */
const props = defineProps({ building: { type: String, default: '' } });
const kiosk = useKioskStore();
const inBuilding = (l) => l.rooms.some((r) => (roomBuilding(r) ?? OTHER) === props.building);
const lessons = computed(() => kiosk.nowAndNext(props.building ? inBuilding : undefined));
const byGroup = (list) => [...list].sort((a, b) => (a.classes[0] ?? '').localeCompare(b.classes[0] ?? '', 'et', { numeric: true }));
const title = computed(() => (props.building ? `Hetke tunnid · hoone ${props.building === OTHER ? 'muu' : props.building}` : 'Hetke tunnid'));
</script>
<template>
  <KioskPage :title="title" :sub="`${kiosk.campusName} · kell ${kiosk.time}`">
    <template v-if="lessons.ongoing.length">
      <h3 class="mb-2 text-lg font-semibold">Praegu</h3>
      <KioskLessons :lessons="byGroup(lessons.ongoing)" dense></KioskLessons>
    </template>
    <template v-if="lessons.next.length">
      <h3 class="mt-5 mb-2 text-lg font-semibold">Järgmised, kell {{ lessons.nextStart }}</h3>
      <KioskLessons :lessons="byGroup(lessons.next)" :hide="['time']" dense></KioskLessons>
    </template>
    <p v-if="!lessons.ongoing.length && !lessons.next.length" class="rounded-box border border-dashed border-neutral p-6 text-center text-xl text-base-content/60">
      Täna rohkem tunde pole.
    </p>
  </KioskPage>
</template>
