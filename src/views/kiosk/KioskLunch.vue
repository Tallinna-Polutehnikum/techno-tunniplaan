<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { DateTime } from 'luxon';
import KioskPage from '../../components/kiosk/KioskPage.vue';
import LunchMenu from '../../components/LunchMenu.vue';
import { DAY_NAMES } from '../../lessonRows';
import { useKioskStore } from '../../stores/kiosk';
import { useLunchStore } from '../../stores/lunch';

/** The kiosk campus's lunch: the day asked for (?date=), else today's or the next day with a menu, and the other days of that week. */
const kiosk = useKioskStore();
const lunch = useLunchStore();
const route = useRoute();
onMounted(() => lunch.load());

const menu = computed(() => lunch.menu(kiosk.campus));
const date = ref(null);
const asked = () => (menu.value?.days.some((d) => d.date === route.query.date) ? route.query.date : null);
watch([() => lunch.data, () => kiosk.now.toISODate()], () => (date.value = asked() ?? lunch.dayFor(kiosk.campus, kiosk.now.toISODate())), { immediate: true });

const mondayOf = (iso) => DateTime.fromISO(iso).startOf('week').toISODate();
const weekDays = computed(() => (date.value ? (menu.value?.days ?? []).filter((d) => mondayOf(d.date) === mondayOf(date.value)) : []));
const day = computed(() => menu.value?.days.find((d) => d.date === date.value) ?? null);
const dayName = (iso) => DAY_NAMES[DateTime.fromISO(iso).weekday - 1];
const sub = computed(() => {
  if (!date.value) return kiosk.campusName;
  const label = date.value === kiosk.now.toISODate() ? 'täna' : dayName(date.value);
  return `${kiosk.campusName} · ${label} ${DateTime.fromISO(date.value).toFormat('dd.MM')}`;
});
</script>
<template>
  <KioskPage title="Koolilõuna" :sub="sub" :qr="{ name: 'lunch', query: { campus: kiosk.campus, ...(date && { date }) } }">
    <div v-if="weekDays.length > 1" class="mb-4 flex gap-2">
      <button v-for="d in weekDays" :key="d.date" type="button" class="btn btn-lg h-auto grow flex-col gap-0 py-2"
        :class="d.date === date ? 'btn-primary' : 'border-neutral bg-base-200'" @click="date = d.date">
        <span class="text-xl">{{ dayName(d.date) }}</span><span class="text-sm font-normal opacity-70">{{ DateTime.fromISO(d.date).toFormat('dd.MM') }}</span>
      </button>
    </div>
    <LunchMenu v-if="day" :day="day" big></LunchMenu>
    <p v-else-if="lunch.data || lunch.missing" class="rounded-box border border-dashed border-neutral p-6 text-center text-xl text-base-content/60">
      {{ lunch.missing ? 'Koolilõuna menüüd ei õnnestunud laadida.' : 'Menüüd pole avaldatud.' }}
    </p>
    <p v-if="menu?.legend.length" class="mt-4 text-base-content/60">{{ menu.legend.join(' · ') }}</p>
  </KioskPage>
</template>
