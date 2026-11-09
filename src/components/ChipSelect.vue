<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * A select whose options are chips, styled like the day chips (native <select> options cannot be
 * styled). `display` overrides the closed button's text, e.g. "Praegu (10:30)" when no option is picked.
 */
const props = defineProps({
    modelValue: { type: [String, Number, null], default: null },
    options: { type: Array, required: true }, // [{ value, label }]
    label: { type: String, required: true }, // accessible name
    display: { type: String, default: '' },
    columns: { type: Number, default: 2 },
});
const emit = defineEmits(['update:modelValue']);

const details = ref(null);
const close = () => details.value && (details.value.open = false);
function pick(value) {
    emit('update:modelValue', value);
    close();
}

const onOutside = (e) => details.value && !details.value.contains(e.target) && close();
const onKey = (e) => e.key === 'Escape' && close();
onMounted(() => {
    document.addEventListener('click', onOutside);
    document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
    document.removeEventListener('click', onOutside);
    document.removeEventListener('keydown', onKey);
});

const current = () => props.display || props.options.find((o) => o.value === props.modelValue)?.label || '';
</script>
<template>
    <details ref="details" class="group relative">
        <summary class="btn btn-sm w-full list-none justify-between gap-2 border-neutral font-normal group-open:border-primary group-open:outline-2 group-open:outline-offset-2 group-open:outline-primary"
            :aria-label="label">
            <span class="tabular-nums">{{ current() }}</span>
            <svg class="size-3 transition-transform group-open:rotate-180" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
        </summary>
        <div class="absolute top-full left-0 z-30 mt-2 grid max-h-72 w-max min-w-full gap-1.5 overflow-y-auto rounded-box border border-neutral bg-base-100 p-2 shadow-lg"
            :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }" role="listbox" :aria-label="label">
            <button v-for="o in options" :key="o.value" type="button" role="option" :aria-selected="o.value === modelValue"
                class="chip btn btn-sm rounded-selector tabular-nums" :class="o.value === modelValue ? 'btn-primary' : 'border-neutral bg-base-300'" @click="pick(o.value)">
                {{ o.label }}
            </button>
        </div>
    </details>
</template>
