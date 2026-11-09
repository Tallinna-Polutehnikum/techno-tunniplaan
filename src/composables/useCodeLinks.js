/**
 * Where a room, group or teacher named on a lesson leads, for the small buttons on lesson cards and
 * week-grid blocks. Only names with a timetable of their own get one (not Kesklinn's placeholder rooms
 * named after a campus). By default a name opens its timetable in the view and week on screen; a kiosk
 * passes its own `codeTo` to stay in the kiosk. Links are pushed, so Back returns to where one was clicked.
 */
import { computed } from 'vue';
import { linkTo } from '../deepLink';
import { useTimetableStore } from '../stores/timetable';

export function useCodeLinks(codeTo = () => null) {
  const store = useTimetableStore();
  const known = computed(() => {
    const names = (list) => new Set((list ?? []).map((e) => e.name));
    return { room: names(store.index?.rooms), group: names(store.index?.classes), teacher: names(store.index?.teachers) };
  });
  return (type, name) => {
    if (!known.value[type]?.has(name)) return null;
    const custom = codeTo();
    return custom ? custom(type, name) : linkTo({ ...store.linkState, type, name });
  };
}
