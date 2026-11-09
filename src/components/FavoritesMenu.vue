<script setup>
import { ref } from 'vue';
import { Star, X } from '@lucide/vue';
import { linkTo } from '../deepLink';
import { useBookmarksStore } from '../stores/bookmarks';

const bookmarks = useBookmarksStore();
const open = ref(false);
const TYPE_LABEL = { group: 'Rühm', teacher: 'Õpetaja', room: 'Ruum' };

// closes when focus leaves the button and the list (a click elsewhere, Tab past it)
function onFocusOut(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) open.value = false;
}
</script>
<template>
    <div class="relative" @focusout="onFocusOut" @keydown.esc="open = false">
        <button type="button" class="btn btn-square border-neutral" :class="{ 'border-primary': open }" aria-label="Lemmikud" title="Lemmikud" aria-haspopup="true"
            :aria-expanded="open" @click="open = !open">
            <Star class="size-5" aria-hidden="true" />
        </button>
        <!-- pointerdown.prevent keeps focus on the button, so the list stays until the click lands (Safari does not focus links) -->
        <div v-if="open" class="absolute right-0 top-full z-20 mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded-box border border-neutral bg-base-100 p-1" @pointerdown.prevent>
            <p v-if="!bookmarks.favorites.length" class="p-3 text-sm text-base-content/60">
                Lemmikuid veel pole. Lisa õpperühm, õpetaja või ruum lemmikuks tähega otsingukastis.
            </p>
            <ul v-else class="menu max-h-75 w-full flex-nowrap overflow-y-auto p-0">
                <li v-for="f in bookmarks.favorites" :key="`${f.type}:${f.name}`">
                    <div class="flex items-center gap-1 p-0">
                        <RouterLink :to="linkTo(f)" class="flex flex-1 items-center justify-between gap-2 px-3 py-1.5 font-semibold" @click="open = false">
                            {{ f.name }}
                            <span class="badge badge-ghost badge-sm font-normal">{{ TYPE_LABEL[f.type] }}</span>
                        </RouterLink>
                        <button type="button" class="btn btn-ghost btn-xs btn-square text-base-content/60" :aria-label="`Eemalda ${f.name} lemmikutest`"
                            title="Eemalda lemmikutest" @click="bookmarks.toggleFavorite(f)">
                            <X class="size-4" aria-hidden="true" />
                        </button>
                    </div>
                </li>
            </ul>
        </div>
    </div>
</template>
