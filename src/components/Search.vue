<script setup>
import { computed } from 'vue';
import { History, Star } from '@lucide/vue';
import FavoritesMenu from './FavoritesMenu.vue';
import { useBookmarksStore } from '../stores/bookmarks';
import { useTimetableStore } from '../stores/timetable';
const store = useTimetableStore();
const bookmarks = useBookmarksStore();

/** The timetable on screen, when the box still names it (not while something else is being typed). */
const shown = computed(() => (store.selectedSearch?.name === store.searchValue ? store.selectedSearch : null));
const favorite = computed(() => bookmarks.isFavorite(shown.value));

/** Clicking into the box offers the most viewed, unless something new is half typed there. */
const suggest = () => store.autocomplete(shown.value ? '' : store.searchValue);
const close = () => (store.options = []);
function onFocusOut(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) close();
}
</script>
<template>
    <div class="flex gap-2">
        <div class="relative flex-1" @focusout="onFocusOut" @keydown.esc="close">
            <label class="input field-themed w-full">
                <input v-model="store.searchValue" @input="store.autocomplete(store.searchValue)" @focus="suggest" type="text" class="text-base"
                    placeholder="Otsi õpperühma, õpetajat või ruumi…" autocomplete="off" aria-autocomplete="list" :aria-expanded="store.options.length > 0" />
                <button v-if="shown" type="button" class="btn btn-ghost btn-xs btn-square" :class="favorite ? 'text-primary' : 'text-base-content/60'"
                    :aria-pressed="favorite" :aria-label="favorite ? 'Eemalda lemmikutest' : 'Lisa lemmikutesse'" :title="favorite ? 'Eemalda lemmikutest' : 'Lisa lemmikutesse'"
                    @click="bookmarks.toggleFavorite(shown)">
                    <Star class="size-4" :fill="favorite ? 'currentColor' : 'none'" aria-hidden="true" />
                </button>
                <button v-if="store.searchValue" class="btn btn-ghost btn-xs btn-square text-lg text-base-content/60" title="Puhasta" @click="store.clearSearch()">×</button>
            </label>
            <!-- pointerdown.prevent keeps focus in the box, so the list stays until the click lands (Safari does not focus buttons) -->
            <ul v-if="store.options.length" class="menu absolute inset-x-0 top-full z-20 mt-1.5 max-h-75 w-full flex-nowrap overflow-y-auto rounded-box border border-neutral bg-base-100 p-1"
                @pointerdown.prevent>
                <li v-for="option in store.options" :key="option.id">
                    <button class="flex justify-between font-semibold" @click="store.select(option)">
                        <span class="flex items-center gap-2">
                            <History v-if="option.frequent" class="size-4 text-base-content/50" aria-label="Sageli vaadatud" />
                            {{ option.name }}
                        </span>
                        <!-- the campuses it has lessons at -->
                        <span class="flex gap-1">
                            <span v-if="option.type === 'room'" class="badge badge-outline badge-sm font-normal">Ruum</span>
                            <span v-for="c in option.campuses" :key="c" class="badge badge-ghost badge-sm font-normal">{{ c }}</span>
                        </span>
                    </button>
                </li>
            </ul>
        </div>
        <FavoritesMenu></FavoritesMenu>
    </div>
</template>
