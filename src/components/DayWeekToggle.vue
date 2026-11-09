<script setup>
import { CalendarRange } from '@lucide/vue';
import { useTimetableStore } from '../stores/timetable';
const store = useTimetableStore();
</script>
<template>
    <div class="flex gap-2">
        <button class="btn" :class="store.showingToday ? 'btn-primary' : 'border-neutral'" @click="store.toggle('today')">Täna</button>
        <button class="btn" :class="store.displayType==='week' ? 'btn-primary' : 'border-neutral'" @click="store.toggle('week')">Nädal</button>
        <!-- the whole week as one grid: in week view, on screens wide enough for day columns -->
        <button v-if="store.displayType === 'week'" class="btn hidden md:inline-flex" :class="store.settings.weekGrid ? 'btn-primary' : 'border-neutral'"
            :aria-pressed="store.settings.weekGrid" title="Kogu nädal ühel vaatel" @click="store.settings.weekGrid = !store.settings.weekGrid">
            <CalendarRange class="size-5" aria-hidden="true" />Täisvaade
        </button>
    </div>
</template>
