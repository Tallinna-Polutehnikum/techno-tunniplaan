<script setup>
import { BellRing, CalendarDays, DoorOpen, UtensilsCrossed } from '@lucide/vue';
import { useRouter } from 'vue-router';
import KioskTiles from '../../components/kiosk/KioskTiles.vue';

// Four things a kiosk is asked for; the first two go on to ask whose lessons. Coloured with four of the
// theme's colours, avoiding the pairs themes often make alike (secondary/success, accent/info).
const TILES = [
  { key: 'today', label: 'Tunnid täna', icons: [BellRing], color: 'bg-primary text-primary-content', to: { name: 'kiosk-pick', params: { purpose: 'tana' } } },
  { key: 'plans', label: 'Tunniplaanid', icons: [CalendarDays], color: 'bg-secondary text-secondary-content', to: { name: 'kiosk-pick', params: { purpose: 'plaan' } } },
  { key: 'free', label: 'Vabad ruumid', icons: [DoorOpen], color: 'bg-accent text-accent-content', to: { name: 'kiosk-free' } },
  { key: 'lunch', label: 'Lõuna', icons: [UtensilsCrossed], color: 'bg-warning text-warning-content', to: { name: 'kiosk-lunch' } },
];
const router = useRouter();
</script>
<template>
  <div class="mt-4">
    <!-- the tiles fill the screen: 2 × 2 on a landscape screen, one column on a portrait one -->
    <KioskTiles :tiles="TILES" @pick="(t) => router.push(t.to)"></KioskTiles>
  </div>
</template>
