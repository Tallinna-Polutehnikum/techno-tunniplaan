<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import KioskPage from '../../components/kiosk/KioskPage.vue';
import KioskTiles from '../../components/kiosk/KioskTiles.vue';
import { OTHER, useKioskStore } from '../../stores/kiosk';

/** Pick a building for "Hetke tunnid hoone lõikes". */
const kiosk = useKioskStore();
const router = useRouter();
const tiles = computed(() => kiosk.buildings.map((b) => ({ key: b, label: b === OTHER ? 'Muu' : b, sub: `${kiosk.roomsOfBuilding(b).length} ruumi` })));
</script>
<template>
  <KioskPage title="Hetke tunnid hoone lõikes" :sub="`${kiosk.campusName} · vali hoone`">
    <KioskTiles :tiles="tiles" @pick="(t) => router.push({ name: 'kiosk-building-now', params: { building: t.key } })"></KioskTiles>
  </KioskPage>
</template>
