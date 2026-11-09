<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import ChipSelect from '../components/ChipSelect.vue';
import { absolute } from '../deepLink';
import { useKioskStore } from '../stores/kiosk';
import { useTimetableStore } from '../stores/timetable';

const store = useTimetableStore();
const kiosk = useKioskStore();
const router = useRouter();
const campusOptions = computed(() => store.campuses.map((c) => ({ value: c.id, label: c.name })));
const kioskCampus = computed({ get: () => kiosk.settings.campus, set: (c) => (kiosk.settings.campus = c) });
/** Switching kiosk mode on keeps the settings open (to pick the campus); the button below starts the kiosk. */
function setKiosk(on) {
  kiosk.settings.enabled = on;
  openedElsewhere.value = false;
}

/**
 * The kiosk opens in a new tab, which has no history: a back gesture there has nowhere to go, so no one can
 * step back into these settings and switch kiosk mode off. This tab then closes if the browser lets it (only
 * tabs a script opened), else says it can be closed. A blocked pop-up opens the kiosk here instead.
 */
const openedElsewhere = ref(false);
function startKiosk() {
  const tab = window.open(absolute(router, { name: 'kiosk' }), '_blank');
  if (!tab) return router.replace({ name: 'kiosk' });
  openedElsewhere.value = true;
  window.close();
}
</script>
<template>
  <div class="grid max-w-md gap-6">
    <section>
      <h3 class="mb-2 text-sm font-semibold text-base-content/60">Kuvamine</h3>
      <label class="flex cursor-pointer items-center justify-between gap-3 py-1.5">
        <span>Näita vabu tunde</span>
        <input type="checkbox" class="toggle toggle-primary" v-model="store.settings.showFree" />
      </label>
      <label class="flex cursor-pointer items-center justify-between gap-3 py-1.5">
        <span>Näita lõunat</span>
        <input type="checkbox" class="toggle toggle-primary" v-model="store.settings.showLunch" />
      </label>
      <label class="flex cursor-pointer items-center justify-between gap-3 py-1.5">
        <span>Peida päevad, kus tunde pole</span>
        <input type="checkbox" class="toggle toggle-primary" v-model="store.settings.hideEmptyDays" />
      </label>
      <label class="flex cursor-pointer items-center justify-between gap-3 py-1.5">
        <span>Ilma animatsioonideta</span>
        <input type="checkbox" class="toggle toggle-primary" v-model="store.settings.noAnimations" />
      </label>
    </section>

    <section>
      <h3 class="mb-2 text-sm font-semibold text-base-content/60">Kioskirežiim</h3>
      <label class="flex cursor-pointer items-center justify-between gap-3 py-1.5">
        <span>Kioskirežiim</span>
        <input type="checkbox" class="toggle toggle-primary" :checked="kiosk.settings.enabled" @change="setKiosk($event.target.checked)" />
      </label>
      <div class="flex items-center justify-between gap-3 py-1.5">
        <span>Õppehoone</span>
        <ChipSelect v-model="kioskCampus" :options="campusOptions" label="Kioski õppehoone" class="w-40"></ChipSelect>
      </div>
      <button v-if="kiosk.settings.enabled" type="button" class="btn btn-primary mt-2 w-full" @click="startKiosk">Ava kioskivaade uues vahelehes</button>
      <p v-if="openedElsewhere" class="mt-2 text-sm text-success">Kiosk avati uues vahelehes. Selle vahelehe võid sulgeda.</p>
      <p class="text-xs text-base-content/60">
        Puutetundliku ekraani vaade ühe õppehoone jaoks: suured paneelid, tänased tunnid ja valikud ilma klaviatuurita. Kui 3 minutit keegi ekraani ei
        puuduta, naaseb see avalehele, lõuna ajal aga näitab lõunamenüüd. Kioskirežiimis avanevad seaded logole 2 sekundit vajutades.
      </p>
    </section>
  </div>
</template>
