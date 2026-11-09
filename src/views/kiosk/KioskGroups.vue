<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import KioskPage from '../../components/kiosk/KioskPage.vue';
import KioskTiles from '../../components/kiosk/KioskTiles.vue';
import { OTHER, useKioskStore } from '../../stores/kiosk';
import { openPick, PURPOSE_LABEL } from './kioskPick';

/** Year, then group: two screens of big tiles instead of a scrolling list. */
const props = defineProps({ purpose: { type: String, required: true }, year: { type: String, default: '' } });
const kiosk = useKioskStore();
const router = useRouter();

const yearLabel = (y) => (y === OTHER ? 'Muu' : `20${y}`);
const tiles = computed(() =>
  props.year
    ? kiosk.groupsOfYear(props.year).map((g) => ({ key: g, label: g }))
    : kiosk.years.map((y) => ({ key: y, label: yearLabel(y), sub: `${kiosk.groupsOfYear(y).length} rühma` })),
);
function pick(t) {
  if (!props.year) router.push({ name: 'kiosk-groups', params: { purpose: props.purpose, year: t.key } });
  else openPick(router, props.purpose, 'group', t.key);
}
</script>
<template>
  <KioskPage :title="PURPOSE_LABEL[purpose]" :sub="`${kiosk.campusName} · ${year ? `${yearLabel(year)} · vali rühm` : 'vali õppeaasta algus'}`">
    <KioskTiles :tiles="tiles" @pick="pick"></KioskTiles>
  </KioskPage>
</template>
