<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { BellRing, Building2, DoorOpen, GraduationCap, Users } from '@lucide/vue';
import KioskPage from '../../components/kiosk/KioskPage.vue';
import KioskTiles from '../../components/kiosk/KioskTiles.vue';
import { useKioskStore } from '../../stores/kiosk';
import { PURPOSE_LABEL } from './kioskPick';

/** Whose lessons to look at: a group's, a teacher's or a room's. */
const props = defineProps({ purpose: { type: String, required: true } });
const kiosk = useKioskStore();
const router = useRouter();

const BY_TYPE = [
  { key: 'group', label: 'Rühm', icons: [Users], to: { name: 'kiosk-groups' } },
  { key: 'teacher', label: 'Õpetaja', icons: [GraduationCap], to: { name: 'kiosk-teachers' } },
  { key: 'room', label: 'Ruum', icons: [DoorOpen], to: { name: 'kiosk-rooms' } },
];
// Boards of what is on right now: they show everyone at once, so they belong to today only, and
// they need no purpose of their own.
const NOW = [
  { key: 'all', label: 'Kogu maja', icons: [BellRing], to: { name: 'kiosk-now' } },
  { key: 'building', label: 'Hoone', icons: [Building2], to: { name: 'kiosk-building' } },
];
const tiles = computed(() => {
  const typed = BY_TYPE.map((t) => ({ ...t, to: { ...t.to, params: { purpose: props.purpose } } }));
  return props.purpose === 'tana' ? [...NOW, ...typed] : typed;
});
</script>
<template>
  <KioskPage :title="PURPOSE_LABEL[purpose]" :sub="`${kiosk.campusName} · vali, mida vaadata`">
    <KioskTiles :tiles="tiles" @pick="(t) => router.push(t.to)"></KioskTiles>
  </KioskPage>
</template>
