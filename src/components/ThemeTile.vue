<script setup>
/** A theme shown in its own colours: the tile is rendered in that theme, with its name and main colour dots. */
defineProps({
    id: { type: String, required: true }, // theme id
    label: { type: String, required: true },
    caption: { type: String, default: '' }, // small line above the name, e.g. "Hele"
    highlighted: { type: Boolean, default: false }, // primary border: picked, or its list is open
    checked: { type: Boolean, default: false }, // ✓ after the name
});
</script>
<template>
    <button type="button" :data-theme="id" class="rounded-box border-2 bg-base-100 p-2.5 text-left text-base-content"
        :class="highlighted ? 'border-primary' : 'border-base-300'">
        <div v-if="caption" class="text-xs opacity-60">{{ caption }}</div>
        <div class="flex items-center justify-between gap-1 text-sm font-semibold">
            {{ label }}
            <span v-if="checked" class="text-primary" aria-hidden="true">✓</span>
        </div>
        <div class="mt-1.5 flex gap-1">
            <span class="size-3.5 rounded-full bg-primary"></span>
            <span class="size-3.5 rounded-full bg-secondary"></span>
            <span class="size-3.5 rounded-full bg-accent"></span>
            <span class="size-3.5 rounded-full bg-neutral"></span>
        </div>
    </button>
</template>
