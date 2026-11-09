<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Clock, Monitor, Users } from '@lucide/vue';
import KioskPage from '../../components/kiosk/KioskPage.vue';
import RoomFeatures from '../../components/RoomFeatures.vue';
import { useFillHeight } from '../../composables/useFillHeight';
import { EQUIPMENT } from '../../roomFeatures';
import { useKioskStore } from '../../stores/kiosk';
import { useTimetableStore } from '../../stores/timetable';
import { roomShort } from '../../codes';
import { openPick } from './kioskPick';

/**
 * Free rooms for a kiosk: always the kiosk's campus, with day, time and (where the campus publishes
 * room details) filters in a sidebar of big buttons, since a kiosk has no keyboard.
 */
const store = useTimetableStore();
const kiosk = useKioskStore();
const router = useRouter();

// opens on now, at the kiosk's campus; coming back from a room's lessons keeps the day and time picked
onMounted(() => {
  const back = String(window.history.state?.forward ?? '').startsWith('/kiosk/tana/');
  if (back) store.mode = 'rooms'; // day buttons pick the free-room day
  else store.showFreeRooms();
  store.setFreeCampus(kiosk.campus);
});

const body = ref(null);
const { height } = useFillHeight(body);

const SEATS = [
  { value: null, label: 'Kõik' },
  { value: 10, label: '10+' },
  { value: 20, label: '20+' },
  { value: 30, label: '30+' },
  { value: 50, label: '50+' },
];
const COMPUTERS = [
  { value: '', label: 'Pole oluline' },
  { value: 'any', label: 'Arvutiklass' },
  { value: 'windows', label: 'Windows' },
  { value: 'mac', label: 'Mac' },
];
const pick = (on) => (on ? 'btn-primary' : 'border-neutral bg-base-200');

/** A room's lessons today when looking at today, else its week (the one looked at). */
function openRoom(name) {
  const today = store.isCurrentWeek && store.freeDay === kiosk.now.weekday - 1;
  openPick(router, today ? 'tana' : 'plaan', 'room', name, store.index?.weeks[store.weekIdx]?.monday);
}

const when = computed(() => {
  const chip = store.chips.find((c) => c.day === store.freeDay);
  return [chip && `${chip.letter} ${chip.date}`, store.freeWhen].filter(Boolean).join(' · ');
});
</script>
<template>
  <KioskPage title="Vabad ruumid" :sub="`${kiosk.campusName} · ${when}`" :qr="{ name: 'free-rooms', query: { hoone: kiosk.campus } }">
    <div ref="body" class="flex gap-4" :style="{ height: `${height}px` }">
      <aside class="grid w-80 shrink-0 content-start gap-5 overflow-y-auto pr-1">
        <section>
          <h3 class="mb-2 font-semibold">Päev</h3>
          <div class="mb-2 flex items-center justify-between">
            <button type="button" class="btn btn-lg btn-square border-neutral" :disabled="!store.hasPrevWeek" aria-label="Eelmine nädal" @click="store.shiftWeek(-1)">‹</button>
            <span class="font-semibold tabular-nums">{{ store.weekRange }}</span>
            <button type="button" class="btn btn-lg btn-square border-neutral" :disabled="!store.hasNextWeek" aria-label="Järgmine nädal" @click="store.shiftWeek(1)">›</button>
          </div>
          <div class="grid grid-cols-4 gap-2">
            <button v-for="c in store.chips" :key="c.day" type="button" class="btn btn-lg h-auto flex-col gap-0 py-2" :class="pick(store.freeDay === c.day)"
              @click="store.chooseDay(c.day)">
              <span class="text-xl">{{ c.letter }}</span><span class="text-xs font-normal opacity-70">{{ c.date }}</span>
            </button>
          </div>
        </section>

        <section>
          <h3 class="mb-2 font-semibold">Kellaaeg</h3>
          <button type="button" class="btn btn-lg mb-2 w-full" :class="pick(store.freeSlot === 'now')" @click="store.showFreeNow()">
            <Clock class="size-5" aria-hidden="true" />Praegu
          </button>
          <div class="grid grid-cols-3 gap-2">
            <button v-for="p in store.freePeriods" :key="p.start" type="button" class="btn btn-lg tabular-nums" :class="pick(store.freeSlot === p.start)"
              @click="store.freeSlot = p.start">
              {{ p.start }}
            </button>
          </div>
        </section>

        <!-- filters on the room details a campus publishes (Kesklinn so far) -->
        <template v-if="store.freeHasInfo">
          <section>
            <h3 class="mb-2 flex items-center gap-2 font-semibold"><Users class="size-5" aria-hidden="true" />Õpilaskohti</h3>
            <div class="grid grid-cols-3 gap-2">
              <button v-for="s in SEATS" :key="s.label" type="button" class="btn btn-lg" :class="pick(store.freeFilters.seats === s.value)"
                @click="store.freeFilters.seats = s.value">
                {{ s.label }}
              </button>
            </div>
          </section>
          <section>
            <h3 class="mb-2 flex items-center gap-2 font-semibold"><Monitor class="size-5" aria-hidden="true" />Arvutid</h3>
            <div class="grid grid-cols-2 gap-2">
              <button v-for="c in COMPUTERS" :key="c.value" type="button" class="btn btn-lg" :class="pick(store.freeFilters.computers === c.value)"
                @click="store.freeFilters.computers = c.value">
                {{ c.label }}
              </button>
            </div>
          </section>
          <section>
            <h3 class="mb-2 font-semibold">Varustus</h3>
            <div class="grid gap-2">
              <button v-for="e in EQUIPMENT.filter((x) => x.id !== 'printer')" :key="e.id" type="button" class="btn btn-lg justify-start"
                :class="pick(store.freeFilters.equipment.includes(e.id))" :aria-pressed="store.freeFilters.equipment.includes(e.id)"
                @click="store.toggleFreeEquipment(e.id)">
                <component :is="e.icon" class="size-5" aria-hidden="true" />{{ e.label }}
              </button>
            </div>
          </section>
          <button v-if="store.freeFiltersActive" type="button" class="btn btn-lg border-neutral" @click="store.resetFreeFilters()">Tühjenda filtrid</button>
        </template>
      </aside>

      <main class="min-w-0 grow overflow-y-auto">
        <p class="mb-3 text-lg text-base-content/70">
          <strong class="text-base-content">{{ store.freeRooms.length }}</strong> vaba ruumi
          <span v-if="store.freeRoomsUnknown"> · {{ store.freeRoomsUnknown }} ruumi andmed puuduvad</span>
        </p>
        <div class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr))">
          <!-- a free room shows its lessons -->
          <button v-for="r in store.freeRooms" :key="r.name" type="button" class="lesson rounded-box border border-base-300 bg-base-200 p-4 text-left"
            @click="openRoom(r.name)">
            <div class="text-2xl font-bold">{{ roomShort(r.name) }}</div>
            <div v-if="r.info?.title" class="leading-tight">{{ r.info.title }}</div>
            <div class="text-base-content/60">{{ r.until ? `vaba kuni ${r.until}` : 'vaba päeva lõpuni' }}</div>
            <RoomFeatures v-if="r.info" :info="r.info" class="mt-2 text-lg"></RoomFeatures>
          </button>
        </div>
        <p v-if="store.weekData && !store.freeRooms.length" class="rounded-box border border-dashed border-neutral p-6 text-center text-xl text-base-content/60">
          {{ store.freePeriod ? 'Sel ajal pole ühtki vaba ruumi.' : 'Selle päeva tunniaegu pole.' }}
        </p>
      </main>
    </div>
  </KioskPage>
</template>
