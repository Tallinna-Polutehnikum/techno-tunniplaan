<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useFillHeight } from '../../composables/useFillHeight';

/**
 * Big touch tiles that together fill the screen below them, however many there are: the grid takes
 * the column count giving the biggest tiles, and text and icons grow with the tiles.
 * tiles: [{ key, label, sub?, icons?: [component], color?: 'bg-… text-…' }]
 */
const props = defineProps({ tiles: { type: Array, required: true } });
defineEmits(['pick']);

const GAP = 12; // px, the grid's gap-3
const WIDE = 1.3; // tiles slightly wider than tall suit short labels best

const root = ref(null);
const layout = ref({ cols: 1, height: 0, w: 0, h: 0 });
const { measure } = useFillHeight(root, arrange);

/** The column count giving the biggest tiles in `height` below the grid's top. */
function arrange(height) {
  if (!props.tiles.length) return;
  const width = root.value.clientWidth;
  const n = props.tiles.length;
  let best = null;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const w = (width - GAP * (cols - 1)) / cols;
    const h = (height - GAP * (rows - 1)) / rows;
    const size = Math.min(w / WIDE, h); // how big a tile of the preferred shape fits
    if (!best || size > best.size) best = { cols, size, w, h };
  }
  layout.value = { cols: best.cols, height, w: best.w, h: best.h };
}

watch(() => props.tiles.length, () => nextTick(measure));

// Labels as big as the tiles allow. A label's longest word must fit the tile's width (about 0.65 em a
// character); labels that wrap or come with icons need room for more lines. The size suits the usual
// label length, and a rare long one ("J-elektriosakond") shrinks on its own tile instead of shrinking all.
const CHAR_EM = 0.65;
const longestWord = (label) => Math.max(1, ...label.split(' ').map((word) => word.length));
const fitWidth = (chars) => (layout.value.w * 0.85) / (chars * CHAR_EM);
const baseSize = computed(() => {
  const { h } = layout.value;
  const lengths = props.tiles.map((t) => longestWord(t.label)).sort((a, b) => a - b);
  const usual = lengths[Math.floor((lengths.length - 1) * 0.8)] ?? 1; // what 4 in 5 labels fit within
  const lines = props.tiles.some((t) => t.label.includes(' ')) ? 3 : 1;
  const extras = props.tiles.some((t) => t.icons?.length || t.sub) ? 1.2 : 0;
  return Math.min(fitWidth(usual), (h * 0.8) / (lines * 1.25 + extras * 1.5), 72);
});
const fontSize = (t) => `${Math.max(14, Math.min(baseSize.value, fitWidth(longestWord(t.label))))}px`;
const iconSize = computed(() => `${Math.min(64, Math.max(20, Math.min(layout.value.w, layout.value.h) * 0.2))}px`);
</script>
<template>
    <div ref="root" class="grid auto-rows-fr gap-3" :style="{ height: `${layout.height}px`, gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))` }">
        <button v-for="t in tiles" :key="t.key" type="button" @click="$emit('pick', t)"
            class="flex min-h-0 flex-col items-center justify-center gap-[0.3em] overflow-hidden rounded-box p-2 text-center leading-tight font-medium transition-transform active:scale-95"
            :class="t.color ?? 'border border-neutral bg-base-200'" :style="{ fontSize: fontSize(t) }">
            <span v-if="t.icons?.length" class="flex gap-[0.3em]" aria-hidden="true">
                <component v-for="(icon, i) in t.icons" :key="i" :is="icon" :style="{ width: iconSize, height: iconSize }" />
            </span>
            <!-- wrap between words only, never at a code's hyphen ("A-007A") -->
            <span><template v-for="(word, i) in t.label.split(' ')" :key="i">{{ i ? ' ' : '' }}<span class="inline-block whitespace-nowrap">{{ word }}</span></template></span>
            <span v-if="t.sub" class="text-[0.5em] font-normal opacity-70">{{ t.sub }}</span>
        </button>
    </div>
</template>
