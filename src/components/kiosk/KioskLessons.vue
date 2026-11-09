<script setup>
import CodeLink from '../CodeLink.vue';
import { useCodeLinks } from '../../composables/useCodeLinks';
import { kioskCodeTo } from '../../views/kiosk/kioskPick';
import { roomShort } from '../../codes';

/**
 * Lessons as big cards, readable from a step away. `hide` leaves out what the page is already about.
 * Groups, rooms and teachers are buttons to their lessons today.
 */
defineProps({
    lessons: { type: Array, required: true },
    hide: { type: Array, default: () => [] }, // any of 'time', 'group', 'room', 'teacher'
    dense: { type: Boolean, default: false }, // smaller cards, for lists of a whole campus
});
const codeLink = useCodeLinks(() => kioskCodeTo);
</script>
<template>
    <div class="grid" :class="dense ? 'gap-2' : 'gap-3'" :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${dense ? '14rem' : '17rem'}, 1fr))` }">
        <div v-for="(l, i) in lessons" :key="i" class="lesson rounded-box border border-base-300 bg-base-200" :class="dense ? 'p-2.5' : 'p-4'">
            <div v-if="!hide.includes('time')" class="font-bold tabular-nums" :class="dense ? 'text-base' : 'text-lg'">{{ l.start }} - {{ l.end }}</div>
            <div class="leading-tight font-semibold" :class="dense ? 'text-lg' : 'text-xl'">{{ l.subject }}</div>
            <div class="mt-1.5 grid gap-1 text-base-content/70" :class="dense ? 'text-sm' : 'text-base'">
                <span v-if="!hide.includes('group') && l.classes.length" class="flex flex-wrap items-center gap-1">
                    <CodeLink v-for="g in l.classes" :key="g" :to="codeLink('group', g)" size="sm">{{ g }}</CodeLink>
                    <span v-if="l.groups.length">{{ l.groups.join(', ') }}</span>
                </span>
                <span v-if="!hide.includes('room') && l.rooms.length" class="flex flex-wrap items-center gap-1">
                    Ruum <CodeLink v-for="r in l.rooms" :key="r" :to="codeLink('room', r)" size="sm">{{ roomShort(r) }}</CodeLink>
                </span>
                <span v-if="!hide.includes('teacher') && l.teachers.length" class="flex flex-wrap items-center gap-1">
                    <CodeLink v-for="t in l.teachers" :key="t" :to="codeLink('teacher', t)" size="sm">{{ t }}</CodeLink>
                </span>
            </div>
        </div>
    </div>
</template>
