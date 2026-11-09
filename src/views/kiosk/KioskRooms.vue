<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import KioskPage from '../../components/kiosk/KioskPage.vue';
import KioskTiles from '../../components/kiosk/KioskTiles.vue';
import { OTHER, useKioskStore } from '../../stores/kiosk';
import { roomShort } from '../../codes';
import { openPick, PURPOSE_LABEL } from './kioskPick';

/** Building, then room. */
const props = defineProps({ purpose: { type: String, required: true }, building: { type: String, default: '' } });
const kiosk = useKioskStore();
const router = useRouter();

const buildingLabel = (b) => (b === OTHER ? 'Muu' : b);
const tiles = computed(() =>
  props.building
    ? kiosk.roomsOfBuilding(props.building).map((r) => ({ key: r, label: roomShort(r) }))
    : kiosk.buildings.map((b) => ({ key: b, label: buildingLabel(b), sub: `${kiosk.roomsOfBuilding(b).length} ruumi` })),
);
function pick(t) {
  if (!props.building) router.push({ name: 'kiosk-rooms', params: { purpose: props.purpose, building: t.key } });
  else openPick(router, props.purpose, 'room', t.key);
}
</script>
<template>
  <KioskPage :title="PURPOSE_LABEL[purpose]" :sub="`${kiosk.campusName} · ${building ? `hoone ${buildingLabel(building)} · vali ruum` : 'vali hoone'}`">
    <KioskTiles :tiles="tiles" @pick="pick"></KioskTiles>
  </KioskPage>
</template>
