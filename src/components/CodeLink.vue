<script setup>
/** A room, group or teacher on a lesson as a small button to its timetable, or plain text when it has none. */
defineProps({
    to: { type: [Object, null], default: null }, // router location
    size: { type: String, default: 'xs' }, // 'tiny' for week-grid blocks, 'sm' for a kiosk's touch screen
});
const SIZES = { tiny: 'h-5 min-h-0 px-1 text-[11px]', xs: 'btn-xs px-1.5', sm: 'btn-sm px-2' };
</script>
<template>
    <RouterLink v-if="to" :to="to" class="code btn rounded-selector border-neutral bg-base-100 font-semibold"
        :class="SIZES[size]"><slot></slot></RouterLink>
    <span v-else><slot></slot></span>
</template>
