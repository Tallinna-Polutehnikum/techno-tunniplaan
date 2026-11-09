<script setup>
import { computed } from 'vue';

/**
 * One day's lunch: the meals to pick from side by side, then what comes with every meal.
 * `big` for a kiosk screen.
 */
const props = defineProps({
    day: { type: Object, required: true }, // a LunchDay of data/lunch.json
    big: { type: Boolean, default: false },
});
const choices = computed(() => props.day.sections.filter((s) => s.choice));
const shared = computed(() => props.day.sections.filter((s) => !s.choice));
</script>
<template>
    <div :class="big ? 'text-lg' : 'text-[15px]'">
        <p v-if="day.intro" class="mb-2 text-base-content/70">{{ day.intro }}</p>
        <div v-if="choices.length" class="grid gap-2.5" :style="{ gridTemplateColumns: `repeat(auto-fit, minmax(${big ? '16rem' : '13rem'}, 1fr))` }">
            <section v-for="s in choices" :key="s.title" class="rounded-box border border-base-300 border-t-4 border-t-primary bg-base-200 p-3">
                <h3 class="mb-1 text-sm font-semibold tracking-wide text-base-content/60 uppercase">{{ s.title }}</h3>
                <div v-for="d in s.dishes" :key="d.name" class="mt-1.5">
                    <div class="font-bold" :class="big ? 'text-2xl' : 'text-base'">{{ d.name }}</div>
                    <div v-if="d.amount || d.kcal" class="text-sm text-base-content/60">{{ [d.amount, d.kcal && `${d.kcal} kcal`].filter(Boolean).join(' · ') }}</div>
                    <div v-if="d.allergens" class="text-sm text-base-content/60">Allergeenid: {{ d.allergens }}</div>
                </div>
            </section>
        </div>
        <section v-for="s in shared" :key="s.title" class="mt-3 rounded-box border border-dashed border-neutral p-3">
            <h3 class="mb-1 text-sm font-semibold tracking-wide text-base-content/60 uppercase">{{ s.title }}</h3>
            <ul class="grid gap-x-6 gap-y-1" :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${big ? '18rem' : '14rem'}, 1fr))` }">
                <li v-for="d in s.dishes" :key="d.name">
                    <span class="font-semibold">{{ d.name }}</span>
                    <span v-if="d.amount" class="text-sm text-base-content/60"> · {{ d.amount }}</span>
                    <span v-if="d.allergens" class="block text-sm text-base-content/60">Allergeenid: {{ d.allergens }}</span>
                </li>
            </ul>
        </section>
    </div>
</template>
