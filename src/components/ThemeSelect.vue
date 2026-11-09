<script setup>
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import ThemeTile from './ThemeTile.vue';
import { useThemeStore } from '../stores/theme';

const themeStore = useThemeStore();
const { GROUPS, BY_ID, sensorSupported, hhmm } = themeStore;
const { theme, auto, kind, sensorError, sun } = storeToRefs(themeStore);

// The theme being picked: 'light' or 'dark' of the switching pair, 'single', or null while no list is open
const picking = ref(null);
const pickedId = computed(() => (picking.value === 'single' ? theme.value : picking.value ? auto.value[picking.value] : null));
/** The themes the open list offers: light ones for the light slot, dark for the dark, all for a single theme. */
const pickGroups = computed(() =>
    GROUPS.map((g) => ({ ...g, themes: g.themes.filter((t) => (picking.value === 'light' ? !t.dark : picking.value === 'dark' ? t.dark : true)) })).filter(
        (g) => g.themes.length,
    ),
);
const PICK_TITLES = { light: 'Vali hele teema', dark: 'Vali tume teema', single: 'Vali teema' };

function toggle(slot) {
    picking.value = picking.value === slot ? null : slot;
}
function pick(id) {
    if (picking.value === 'single') theme.value = id;
    else auto.value[picking.value] = id;
    picking.value = null;
}
function setKind(k) {
    themeStore.setKind(k);
    picking.value = null;
}
const kindTab = (k) => (kind.value === k ? 'tab-active bg-primary! text-primary-content!' : '');
</script>
<template>
    <div class="grid gap-5">
        <section>
            <h3 class="mb-2 text-sm font-semibold text-base-content/60">Teema tüüp</h3>
            <div class="tabs tabs-box w-fit border border-neutral" role="radiogroup" aria-label="Teema tüüp">
                <button type="button" role="radio" class="tab" :class="kindTab('switching')" :aria-checked="kind === 'switching'" @click="setKind('switching')">
                    Vahetuv
                </button>
                <button type="button" role="radio" class="tab" :class="kindTab('single')" :aria-checked="kind === 'single'" @click="setKind('single')">
                    Üks teema
                </button>
            </div>
            <p class="mt-1.5 text-xs text-base-content/60">
                {{ kind === 'switching' ? 'Hele ja tume teema, mis vahetuvad ise.' : 'Alati sama teema.' }}
            </p>
        </section>

        <section v-if="kind === 'switching'">
            <h3 class="mb-2 text-sm font-semibold text-base-content/60">Millal vahetada</h3>
            <fieldset class="grid gap-1.5">
                <label class="flex cursor-pointer items-center gap-2.5">
                    <input type="radio" class="radio radio-primary radio-sm" value="system" v-model="auto.source" />
                    <span class="text-sm">seadme heleda või tumeda režiimi järgi</span>
                </label>
                <label class="flex cursor-pointer items-center gap-2.5">
                    <input type="radio" class="radio radio-primary radio-sm" value="sun" v-model="auto.source" />
                    <span class="text-sm">
                        päikesetõusu ja -loojangu järgi
                        <span class="block text-xs text-base-content/60">Tallinnas täna {{ hhmm(sun.rise) }} ja {{ hhmm(sun.set) }}</span>
                    </span>
                </label>
                <label class="flex items-center gap-2.5" :class="sensorSupported ? 'cursor-pointer' : 'opacity-50'">
                    <input type="radio" class="radio radio-primary radio-sm" value="sensor" v-model="auto.source" :disabled="!sensorSupported" />
                    <span class="text-sm">valgusanduri järgi</span>
                </label>
            </fieldset>
            <p v-if="!sensorSupported" class="mt-1.5 text-xs text-base-content/60">See brauser ei anna valgusandurile ligi.</p>
            <p v-else-if="auto.source === 'sensor' && sensorError" class="mt-1.5 text-xs text-error">{{ sensorError }}</p>
        </section>

        <section>
            <h3 class="mb-2 text-sm font-semibold text-base-content/60">{{ kind === 'switching' ? 'Teemad' : 'Teema' }}</h3>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <template v-if="kind === 'switching'">
                    <ThemeTile :id="auto.light" :label="BY_ID[auto.light].label" caption="Hele" :highlighted="picking === 'light'"
                        :aria-expanded="picking === 'light'" @click="toggle('light')"></ThemeTile>
                    <ThemeTile :id="auto.dark" :label="BY_ID[auto.dark].label" caption="Tume" :highlighted="picking === 'dark'"
                        :aria-expanded="picking === 'dark'" @click="toggle('dark')"></ThemeTile>
                </template>
                <ThemeTile v-else :id="theme" :label="BY_ID[theme].label" caption="Kasutusel" :highlighted="picking === 'single'"
                    :aria-expanded="picking === 'single'" @click="toggle('single')"></ThemeTile>
            </div>
            <p v-if="!picking" class="mt-1.5 text-xs text-base-content/60">Puuduta teemat, et valida teine.</p>
        </section>

        <section v-if="picking">
            <h3 class="mb-2 text-sm font-semibold text-base-content/60">{{ PICK_TITLES[picking] }}</h3>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" :aria-label="PICK_TITLES[picking]">
                <template v-for="group in pickGroups" :key="group.name">
                    <h4 class="col-span-full mt-2 text-xs font-semibold tracking-wide text-base-content/60 uppercase">{{ group.name }}</h4>
                    <ThemeTile v-for="t in group.themes" :key="t.id" :id="t.id" :label="t.label" role="radio" :aria-checked="t.id === pickedId"
                        :highlighted="t.id === pickedId" :checked="t.id === pickedId" @click="pick(t.id)"></ThemeTile>
                </template>
            </div>
        </section>
    </div>
</template>
