<script setup>
import NavTabs from '../components/NavTabs.vue';

const TABS = [
  { to: { name: 'settings' }, label: 'Üldine' },
  { to: { name: 'theme-settings' }, label: 'Teema' },
];
</script>
<template>
  <div class="mt-3 flex items-center gap-2">
    <RouterLink :to="{ name: 'timetable' }" class="btn btn-ghost btn-sm btn-square" aria-label="Tagasi tunniplaani" title="Tagasi tunniplaani">‹</RouterLink>
    <h2 class="text-lg font-bold">Seaded</h2>
  </div>
  <NavTabs :tabs="TABS" label="Seaded" class="mt-3"></NavTabs>
  <div class="mt-4">
    <RouterView></RouterView>
  </div>
</template>
