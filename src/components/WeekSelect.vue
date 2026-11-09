<script setup>
import { useTimetableStore } from '../stores/timetable';
const store = useTimetableStore();
</script>
<template>
    <div class="flex items-center gap-1.5 text-sm whitespace-nowrap text-base-content/60">
        <button class="btn btn-square btn-ghost btn-sm" :disabled="!store.hasPrevWeek" @click="store.shiftWeek(-1)" aria-label="Eelmine nädal">‹</button>
        <span :class="{ 'font-semibold text-base-content': store.isCurrentWeek }">{{ store.weekRange }}</span>
        <button class="btn btn-square btn-ghost btn-sm" :disabled="!store.hasNextWeek" @click="store.shiftWeek(1)" aria-label="Järgmine nädal">›</button>
    </div>
</template>
