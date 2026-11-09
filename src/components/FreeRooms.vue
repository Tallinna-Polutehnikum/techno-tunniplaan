<script setup>
import { computed, ref } from 'vue';
import { Monitor, SlidersHorizontal, Users } from '@lucide/vue';
import RoomFeatures from './RoomFeatures.vue';
import { EQUIPMENT } from '../roomFeatures';
import { useRouter } from 'vue-router';
import ChipSelect from './ChipSelect.vue';
import { useTimetableStore } from '../stores/timetable';
const store = useTimetableStore();
const router = useRouter();

/** A free room opens its timetable. */
function openRoom(name) {
    store.openRoom(name);
    router.push({ name: 'timetable' });
}

const campusOptions = computed(() => store.campuses.map((c) => ({ value: c.id, label: c.name })));
const periodOptions = computed(() => store.freePeriods.map((p) => ({ value: p.start, label: `${p.start} - ${p.end}` })));
const freeCampus = computed({ get: () => store.freeCampus, set: (c) => store.setFreeCampus(c) });
const freeSlot = computed({ get: () => store.freeSlot, set: (s) => (store.freeSlot = s) });

const showFilters = ref(false);
const filterCount = computed(() => {
    const f = store.freeFilters;
    return (f.seats ? 1 : 0) + (f.computers ? 1 : 0) + f.equipment.length;
});
const COMPUTER_OPTIONS = [
    { value: '', label: 'Pole oluline' },
    { value: 'any', label: 'Arvutiklass' },
    { value: 'windows', label: 'Windows' },
    { value: 'mac', label: 'Mac' },
];
const computers = computed({ get: () => store.freeFilters.computers, set: (c) => (store.freeFilters.computers = c) });
// the seat filter as a number field that can also be empty (no minimum)
const seats = computed({
    get: () => store.freeFilters.seats ?? '',
    set: (v) => (store.freeFilters.seats = Number(v) > 0 ? Math.round(Number(v)) : null),
});
</script>
<template>
    <div class="mt-2.5">
        <div class="flex flex-wrap items-center gap-2">
            <ChipSelect v-model="freeCampus" :options="campusOptions" label="Õppehoone" class="grow sm:w-40 sm:grow-0"></ChipSelect>
            <!-- while looking at now, the closed select shows the span that works out, which is no period of its own -->
            <ChipSelect v-model="freeSlot" :options="periodOptions" label="Tund" class="grow sm:w-44 sm:grow-0"
                :display="store.freeSlot === 'now' && store.freePeriod ? `${store.freePeriod.start} - ${store.freePeriod.end}` : ''"></ChipSelect>
            <button class="btn btn-sm" :class="store.freeSlot === 'now' ? 'btn-primary' : 'border-neutral'" @click="store.showFreeNow()">Praegu</button>
        </div>

        <!-- filters on the room details a campus publishes (Kesklinn so far) -->
        <template v-if="store.freeHasInfo">
            <button type="button" class="btn btn-sm mt-2 border-neutral" :class="{ 'btn-primary': filterCount }" :aria-expanded="showFilters" @click="showFilters = !showFilters">
                <SlidersHorizontal class="size-4" aria-hidden="true" />
                Filtrid<span v-if="filterCount"> ({{ filterCount }})</span>
            </button>
            <div v-if="showFilters" class="mt-2 grid gap-3 rounded-box border border-base-300 p-3">
                <label class="flex items-center gap-2 text-sm">
                    <Users class="size-4" aria-hidden="true" />
                    Vähemalt
                    <input type="number" min="1" max="200" inputmode="numeric" class="input field-themed input-sm w-20" v-model="seats" placeholder="–" />
                    õpilaskohta
                </label>
                <div class="flex items-center gap-2 text-sm">
                    <Monitor class="size-4" aria-hidden="true" />
                    Arvutid
                    <ChipSelect v-model="computers" :options="COMPUTER_OPTIONS" label="Arvutid" class="w-40"></ChipSelect>
                </div>
                <div class="flex flex-wrap gap-1.5" role="group" aria-label="Varustus">
                    <button v-for="e in EQUIPMENT.filter((x) => x.id !== 'printer')" :key="e.id" type="button" class="chip btn btn-sm rounded-selector"
                        :class="store.freeFilters.equipment.includes(e.id) ? 'btn-primary' : 'border-neutral bg-base-300'"
                        :aria-pressed="store.freeFilters.equipment.includes(e.id)" @click="store.toggleFreeEquipment(e.id)">
                        <component :is="e.icon" class="size-4" aria-hidden="true" />{{ e.label }}
                    </button>
                </div>
                <button v-if="filterCount" type="button" class="btn btn-ghost btn-sm w-fit" @click="store.resetFreeFilters()">Tühjenda filtrid</button>
            </div>
        </template>

        <div v-if="store.freePeriod" class="mt-2.5 text-sm text-base-content/60">
            {{ store.freeRooms.length }} vaba ruumi,
            {{ store.freeWhen }}
            <span v-if="store.freeRoomsUnknown">· {{ store.freeRoomsUnknown }} ruumi andmed puuduvad, need on filtriga peidus</span>
        </div>
        <div class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            <!-- a free room opens its timetable -->
            <button v-for="r in store.freeRooms" :key="r.name" class="lesson rounded-box border border-base-300 bg-base-200 p-3 text-left" @click="openRoom(r.name)">
                <div class="font-bold">{{ r.name }}</div>
                <div v-if="r.info?.title" class="text-[13px] leading-tight">{{ r.info.title }}</div>
                <div class="text-[13px] text-base-content/60">{{ r.until ? `vaba kuni ${r.until}` : 'vaba päeva lõpuni' }}</div>
                <RoomFeatures v-if="r.info" :info="r.info" class="mt-1.5 text-[13px]"></RoomFeatures>
            </button>
        </div>
        <div v-if="store.weekData && (!store.freePeriod || !store.freeRooms.length)" class="mt-2.5 rounded-box border border-dashed border-neutral p-3.5 text-center text-base-content/60">
            {{ store.freePeriod ? 'Selles hoones pole sel ajal ühtki vaba ruumi.' : 'Selle hoone tunniaegu sel nädalal pole.' }}
        </div>
        <!-- a campus with published room details lists its rooms without lessons too -->
        <p class="mt-3 text-xs text-base-content/50">
            Tunniplaani järgi: muud broneeringud{{ store.freeHasInfo ? '' : ' ja ruumid, kus tunde pole,' }} siin ei kajastu.
        </p>
    </div>
</template>
