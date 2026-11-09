<script setup>
import { useTimetableStore } from '../stores/timetable';
const store = useTimetableStore();
</script>

<template>
    <div class="mt-3.5 flex gap-1.5 overflow-x-auto py-1" aria-label="Nädalapäevad">
        <button class="chip btn btn-sm h-9 rounded-selector" :class="store.activeDay === chip.day ? 'btn-primary btn-outline' : 'border-neutral bg-base-300'" v-for="chip in store.chips" :key="chip.day" @click="store.chooseDay(chip.day)">
            <span class="w-5 text-center text-base">{{ chip.letter }}</span>
            <span class="font-medium opacity-60">{{ chip.date }}</span>
        </button>
    </div>
</template>
