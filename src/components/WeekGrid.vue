<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { DateTime } from 'luxon';
import CodeLink from './CodeLink.vue';
import { useCodeLinks } from '../composables/useCodeLinks';
import { useFillHeight } from '../composables/useFillHeight';
import { roomShort } from '../codes';

/**
 * A group's, teacher's or room's whole week on one screen: a column per day, time running down with
 * the week's lesson start and end times marked, lessons at the same time side by side within their
 * day. Fills the screen down to the footer, but no lower than `minHeight`. A block tall enough names
 * its rooms, groups and teachers as small buttons to their timetables.
 */
const props = defineProps({
  lessons: { type: Array, required: true }, // the week's lessons, as in week-<monday>.json
  type: { type: String, required: true }, // 'group', 'teacher' or 'room': what the blocks leave out
  monday: { type: Object, default: null }, // luxon DateTime
  minHeight: { type: Number, default: 240 },
  codeTo: { type: Function, default: null }, // where a room, group or teacher leads (see useCodeLinks)
});
const codeLink = useCodeLinks(() => props.codeTo);

const DAY_NAMES = ['Esmaspäev', 'Teisipäev', 'Kolmapäev', 'Neljapäev', 'Reede', 'Laupäev', 'Pühapäev'];
const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

const now = ref(DateTime.now());
const tick = setInterval(() => (now.value = DateTime.now()), 30_000);
onBeforeUnmount(() => clearInterval(tick));
const lessons = computed(() => props.lessons);
const monday = computed(() => props.monday);

/** Monday to Friday always, the weekend only when it has lessons. */
const days = computed(() => {
  const withLessons = new Set(lessons.value.map((l) => l.day));
  return [0, 1, 2, 3, 4, 5, 6].filter((d) => d < 5 || withLessons.has(d));
});

/** The time axis: from a little before the week's first lesson to a little after its last (8 to 16 when there are none). */
const axis = computed(() => {
  const list = lessons.value;
  const from = list.length ? Math.min(...list.map((l) => minutes(l.start))) - 10 : 8 * 60;
  const to = list.length ? Math.max(...list.map((l) => minutes(l.end))) + 10 : 16 * 60;
  const hours = [];
  for (let h = Math.ceil(from / 60); h * 60 <= to; h++) hours.push(`${String(h).padStart(2, '0')}:00`);
  return { from, to, hours };
});
const y = (t) => `${((minutes(t) - axis.value.from) / (axis.value.to - axis.value.from)) * 100}%`;
const length = (l) => `${((minutes(l.end) - minutes(l.start)) / (axis.value.to - axis.value.from)) * 100}%`;

/**
 * Each day's lessons, overlapping ones side by side: lessons that overlap (directly or through each
 * other) share the column's width in lanes, a lesson going in the first lane free at its start; the
 * rest keep the full width.
 */
const columns = computed(() =>
  days.value.map((day) => {
    const sorted = lessons.value.filter((l) => l.day === day).sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end));
    const placed = [];
    let cluster = [];
    let lanes = [];
    let clusterEnd = '';
    const close = () => cluster.forEach((p) => (p.lanes = lanes.length));
    for (const l of sorted) {
      if (l.start >= clusterEnd) {
        close();
        cluster = [];
        lanes = [];
      }
      let lane = lanes.findIndex((end) => end <= l.start);
      if (lane < 0) lane = lanes.push('') - 1;
      lanes[lane] = l.end;
      if (l.end > clusterEnd) clusterEnd = l.end;
      const p = { l, lane, lanes: 1 };
      cluster.push(p);
      placed.push(p);
    }
    close();
    const date = monday.value?.plus({ days: day });
    return { day, date, placed, today: !!date && date.hasSame(now.value, 'day') };
  }),
);

/**
 * What a block names besides time and subject: whichever of rooms, groups and teachers the week is not
 * about, short (a room without its building's name, a teacher by surname).
 */
function details(l) {
  return [
    ...(props.type !== 'room' ? l.rooms.map((r) => ({ type: 'room', name: r, label: roomShort(r) })) : []),
    ...(props.type !== 'group' ? l.classes.map((g) => ({ type: 'group', name: g, label: g })) : []),
    ...(props.type !== 'teacher' ? l.teachers.map((t) => ({ type: 'teacher', name: t, label: t.split(' ')[0] })) : []),
  ];
}

const body = ref(null);
const { height } = useFillHeight(body, undefined, () => props.minHeight);
const HEAD = 48; // px for the day names
const pxPerMinute = computed(() => (height.value - HEAD) / Math.max(1, axis.value.to - axis.value.from));

/**
 * The week's lesson start and end times along the time line. Where two would overlap (10:00 and 10:15
 * on a short screen), a lesson's start wins over another's end.
 */
const LABEL_GAP = 15; // px a label needs
const marks = computed(() => {
  const starts = new Set(lessons.value.map((l) => l.start));
  const times = [...new Set(lessons.value.flatMap((l) => [l.start, l.end]))].sort();
  const kept = [];
  for (const t of times) {
    const prev = kept.at(-1);
    const close = prev && (minutes(t) - minutes(prev.t)) * pxPerMinute.value < LABEL_GAP;
    if (!close) kept.push({ t, start: starts.has(t) });
    else if (starts.has(t) && !prev.start) kept[kept.length - 1] = { t, start: true };
  }
  return kept;
});

/** How many lines of the subject fit a block, below its time and above its details; the rest ends in "…". */
function subjectLines(p) {
  const blockHeight = (minutes(p.l.end) - minutes(p.l.start)) * pxPerMinute.value - 4;
  const detailsHeight = blockHeight > 70 ? 22 : 0;
  return Math.max(1, Math.floor((blockHeight - 8 - 16 - detailsHeight) / 20));
}
const nowY = computed(() => {
  const t = now.value.toFormat('HH:mm');
  return minutes(t) >= axis.value.from && minutes(t) <= axis.value.to ? y(t) : null;
});
</script>
<template>
  <div ref="body" class="grid" :style="{ height: `${height}px`, gridTemplateColumns: `4rem repeat(${days.length}, minmax(0, 1fr))`, gridTemplateRows: `${HEAD}px 1fr` }">
    <!-- day names across the top -->
    <div></div>
    <div v-for="c in columns" :key="c.day" class="flex flex-col items-center justify-center border-l border-base-300" :class="{ 'bg-today': c.today }">
      <span class="text-lg leading-tight font-bold">{{ DAY_NAMES[c.day] }}</span>
      <span class="text-sm text-base-content/60">{{ c.date?.toFormat('dd.MM') }}</span>
    </div>

    <!-- the lesson start and end times down the side -->
    <div class="relative">
      <span v-for="m in marks" :key="m.t" class="absolute right-2 -translate-y-1/2 text-sm tabular-nums"
        :class="m.start ? 'font-semibold' : 'text-base-content/60'" :style="{ top: y(m.t) }">{{ m.t }}</span>
    </div>

    <div v-for="c in columns" :key="c.day" class="relative border-l border-base-300" :class="{ 'bg-today': c.today }">
      <!-- faint hour lines, and a line at every lesson start and end -->
      <span v-for="h in axis.hours" :key="h" class="absolute inset-x-0 h-px bg-base-300/50" :style="{ top: y(h) }"></span>
      <span v-for="m in marks" :key="m.t" class="absolute inset-x-0 h-px bg-base-300" :style="{ top: y(m.t) }"></span>
      <!-- not .lesson: the Techno themes' hover bar makes those position: relative -->
      <div v-for="(p, i) in c.placed" :key="i" data-block
        class="absolute overflow-hidden rounded-field border border-base-300 border-t-4 border-t-primary bg-base-200 px-2 py-1 leading-tight"
        :style="{ top: y(p.l.start), height: length(p.l), left: `calc(${(p.lane / p.lanes) * 100}% + 3px)`, width: `calc(${100 / p.lanes}% - 6px)` }">
        <div class="text-xs font-semibold text-base-content/70 tabular-nums">{{ p.l.start }}–{{ p.l.end }}</div>
        <!-- narrow side-by-side blocks hyphenate long Estonian words (the page is lang="et") where the browser can,
             else break them anywhere rather than cutting them off -->
        <div class="overflow-hidden text-base font-bold hyphens-auto [overflow-wrap:anywhere]" :style="{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: subjectLines(p) }">
          {{ p.l.subject }}
        </div>
        <!-- one row of buttons; what does not fit stays hidden -->
        <div v-if="(minutes(p.l.end) - minutes(p.l.start)) * pxPerMinute > 70" class="mt-0.5 flex h-5 flex-wrap gap-0.5 overflow-hidden text-xs text-base-content/70">
          <CodeLink v-for="d in details(p.l)" :key="d.type + d.name" :to="codeLink(d.type, d.name)" :title="d.name" size="tiny">{{ d.label }}</CodeLink>
        </div>
      </div>
      <!-- the time now -->
      <span v-if="c.today && nowY" class="absolute inset-x-0 h-0.5 bg-error" :style="{ top: nowY }" aria-label="praegu"></span>
    </div>
  </div>
</template>
