<script setup>
import { useRoute } from 'vue-router';

defineProps({
    tabs: { type: Array, required: true }, // [{ to, label, names? }]
    label: { type: String, required: true },
});
// Not exact-active-class: the timetable is also at #/plaan/<type>/<name>, where its own tab is still the current one.
const route = useRoute();
const isCurrent = (t) => (t.names ?? [t.to.name]).includes(route.name);
</script>
<template>
    <!-- bordered like the chips; the current page's tab filled in the theme's primary colour, like the selected Nädal button -->
    <nav class="tabs tabs-box w-fit border border-neutral" :aria-label="label">
        <RouterLink v-for="t in tabs" :key="t.label" :to="t.to" class="tab" :class="{ 'tab-active bg-primary! text-primary-content!': isCurrent(t) }">
            {{ t.label }}
        </RouterLink>
    </nav>
</template>
