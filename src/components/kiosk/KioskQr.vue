<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import QrcodeVue from 'qrcode.vue';
import { absolute } from '../../deepLink';
import { qrColors, useThemeStore } from '../../stores/theme';

/** A QR code of the same page in the normal app, so a passer-by can take what is on the kiosk with them. */
const props = defineProps({ to: { type: Object, required: true } });
const router = useRouter();
const url = computed(() => absolute(router, props.to));

// Theme colours, kept scannable (see qrColors): Techno purple on white, or on Techno yellow in Techno dark.
const theme = useThemeStore();
const colors = computed(() => {
  theme.applied; // recompute when the theme changes (its data-theme is set before this renders)
  return qrColors(getComputedStyle(document.documentElement));
});
</script>
<template>
  <div class="flex shrink-0 items-center gap-2">
    <span class="w-24 text-right text-sm leading-tight text-base-content/60">Skanni, et telefonis avada</span>
    <!-- Dark modules on a light ground whatever the theme: a low-contrast or inverted QR code does not scan
         everywhere. 128 px keeps the densest of these links (a long teacher name encodes to 45 × 45) above
         2.5 px a module, and the margin is the quiet zone the padding, in the ground colour, then widens. -->
    <QrcodeVue :value="url" :size="128" :margin="2" render-as="svg" level="M" :background="colors.bg" :foreground="colors.fg" class="rounded p-2" :style="{ backgroundColor: colors.bg }" />
  </div>
</template>
