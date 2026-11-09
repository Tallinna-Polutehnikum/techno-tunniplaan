<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { DateTime } from 'luxon';
import CodeLink from './CodeLink.vue';
import { useCodeLinks } from '../composables/useCodeLinks';
import { useLunchStore } from '../stores/lunch';
import { useTimetableStore } from '../stores/timetable';

/**
 * The timetable's lesson rows (src/lessonRows.js). By default the selected timetable's, with a divider
 * per day in week view; the kiosk passes its own and the time now, fading lessons that have ended.
 * The lesson going on now stands out. Rooms, groups and teachers are small buttons to their own timetables.
 */
const props = defineProps({
    rows: { type: Array, default: null },
    dividers: { type: Boolean, default: null },
    now: { type: String, default: '' }, // HH:mm
    // where a lunch row leads ({ campus, date } → route, or null): by default the lunch page on that campus and day
    lunchTo: { type: Function, default: (lunch) => ({ name: 'lunch', query: lunch }) },
    // where a room, group or teacher leads (type, name → route): by default its timetable, in the view and week on screen
    codeTo: { type: Function, default: null },
});
const store = useTimetableStore();
const lunch = useLunchStore();
onMounted(() => lunch.load());
const list = computed(() => props.rows ?? store.lessons);
const showDividers = computed(() => props.dividers ?? store.displayType === 'week');
const ended = (lesson) => props.now && lesson.time.end <= props.now;

const codeLink = useCodeLinks(() => props.codeTo);

const clock = ref(DateTime.now());
const tick = setInterval(() => (clock.value = DateTime.now()), 30_000);
onBeforeUnmount(() => clearInterval(tick));
const current = (lesson) => {
    const time = props.now || clock.value.toFormat('HH:mm');
    return lesson.iso === clock.value.toISODate() && lesson.time.start <= time && time < lesson.time.end;
};
</script>
<template>
    <div class="mt-2.5 grid gap-2.5">
        <template v-for="(lesson, i) in list">
            <div v-if="showDividers && lesson.day !== list[i - 1]?.day" class="divider divider-primary my-1 text-sm font-semibold">
                {{ lesson.dayName }}
            </div>
            <!-- a lunch row opens that day's menu -->
            <component :is="lesson.lunch && lunchTo(lesson.lunch) ? RouterLink : 'div'" :to="lesson.lunch && lunchTo(lesson.lunch)"
                class="grid grid-cols-[auto_auto_1fr] items-start gap-2.5 rounded-box border p-3 md:grid-cols-[30px_140px_1fr] max-[360px]:grid-cols-[30px_140px]"
                :class="[
                    lesson.free ? ['border-dashed text-base-content/60', current(lesson) ? 'border-primary' : 'border-neutral']
                    : current(lesson) ? ['border-primary bg-primary/10 ring-1 ring-primary', { lesson: !lesson.lunch }]
                    : lesson.lunch ? 'border-secondary bg-secondary/10'
                    : ['lesson border-base-300', lesson.isToday ? 'bg-today' : 'bg-base-200'],
                    { 'opacity-50': ended(lesson) },
                ]">
                <div class="letter mt-0.5 size-8 rounded-field text-center text-xl leading-8 font-bold"
                    :class="lesson.free ? 'bg-neutral/40 text-neutral-content/70' : lesson.lunch ? 'bg-secondary text-secondary-content' : 'bg-neutral text-neutral-content'">{{ lesson.day }}</div>
                <div class="font-bold whitespace-nowrap tabular-nums">
                    <div>{{ lesson.date }}</div>
                    <div>{{ lesson.time.start }} - {{ lesson.time.end }}</div>
                    <!-- which numbered lessons of the day this is, and how many; nothing off the bell schedule -->
                    <div v-if="lesson.span" class="text-[13px] font-normal text-base-content/60">
                        {{ lesson.span.label }}
                        <span class="text-base-content/45" :title="lesson.span.countLabel">({{ lesson.span.count }})</span>
                    </div>
                </div>
                <div v-if="lesson.free" class="flex items-center gap-2 self-center text-[15px] md:text-base">
                    Vaba<span v-if="current(lesson)" class="badge badge-sm badge-primary">Praegu</span>
                </div>
                <div v-else-if="lesson.lunch" class="max-[360px]:col-span-full">
                    <div class="flex items-center gap-2 text-[15px] font-bold md:text-base">
                        Lõuna<span v-if="current(lesson)" class="badge badge-sm badge-primary">Praegu</span>
                    </div>
                    <div class="text-[13px] text-base-content/60">{{ lunch.summary(lesson.lunch.campus, lesson.lunch.date).join(' / ') }}</div>
                </div>
                <div v-else class="max-[360px]:col-span-full">
                    <div class="text-[15px] font-bold md:text-base">
                        {{ lesson.name }}<span v-if="current(lesson)" class="badge badge-sm badge-primary ml-2 align-middle">Praegu</span>
                    </div>
                    <div class="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-base-content/60">
                        <span v-if="lesson.campus" class="font-semibold text-base-content/80">{{ lesson.campus }}</span>
                        <span v-if="lesson.showRoom && lesson.rooms.length" class="inline-flex flex-wrap items-center gap-1">
                            Ruum:
                            <template v-for="r in lesson.rooms" :key="r">
                                <CodeLink :to="codeLink('room', r)">{{ r }}</CodeLink>
                            </template>
                        </span>
                        <span v-if="lesson.showGroup && lesson.group" class="inline-flex flex-wrap items-center gap-1">
                            Rühm:
                            <template v-for="g in lesson.classes" :key="g">
                                <CodeLink :to="codeLink('group', g)">{{ g }}</CodeLink>
                            </template>
                            <span v-if="lesson.subgroups.length">{{ lesson.subgroups.join(' ') }}</span>
                        </span>
                        <span v-if="lesson.showTeacher && lesson.teachers.length" class="inline-flex flex-wrap items-center gap-1">
                            Õpetaja:
                            <template v-for="t in lesson.teachers" :key="t">
                                <CodeLink :to="codeLink('teacher', t)">{{ t }}</CodeLink>
                            </template>
                        </span>
                        <span v-if="lesson.note" class="basis-full italic">{{ lesson.note }}</span>
                    </div>
                </div>
            </component>
        </template>
    </div>
</template>
