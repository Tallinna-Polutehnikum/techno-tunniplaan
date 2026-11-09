<script setup>
import { ref } from 'vue';
import { Check, Link } from '@lucide/vue';

// The address bar already follows what is on screen (see TimetableView), so the page's own address is the link.
const copied = ref(false);
const failed = ref(false);
let timer;
async function copy() {
  clearTimeout(timer);
  try {
    await navigator.clipboard.writeText(location.href);
    copied.value = true;
    failed.value = false;
  } catch {
    // no clipboard (an old browser, or not https)
    failed.value = true;
  }
  timer = setTimeout(() => (copied.value = failed.value = false), 2000);
}
</script>
<template>
    <button type="button" class="btn btn-square btn-ghost btn-sm" :class="{ 'text-success': copied, 'text-error': failed }"
        :aria-label="copied ? 'Link kopeeritud' : failed ? 'Kopeerimine ebaõnnestus' : 'Kopeeri lehe link'"
        :title="copied ? 'Link kopeeritud' : failed ? 'Kopeerimine ebaõnnestus' : 'Kopeeri lehe link'" @click="copy">
        <Check v-if="copied" class="size-5" aria-hidden="true" />
        <Link v-else class="size-5" aria-hidden="true" />
    </button>
</template>
