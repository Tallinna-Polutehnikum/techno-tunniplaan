/** Room equipment as the room details name it (scripts/providers/rooms.ts), with labels and icons. */
import { Eraser, Presentation, Printer, Projector, SquarePen, Tv } from '@lucide/vue';

export const EQUIPMENT = [
  { id: 'projector', label: 'Projektor', icon: Projector },
  { id: 'interactive_display', label: 'Interaktiivne ekraan', icon: Presentation },
  { id: 'television', label: 'Teler', icon: Tv },
  { id: 'whiteboard', label: 'Valge tahvel', icon: SquarePen },
  { id: 'chalkboard', label: 'Kriiditahvel', icon: Eraser },
  { id: 'printer', label: 'Printer', icon: Printer },
];

export const PLATFORMS = { windows: 'Windows', mac: 'Mac' };
export const PLATFORM_SHORT = { windows: 'Win', mac: 'Mac' };
