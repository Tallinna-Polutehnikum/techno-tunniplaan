<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import KioskPage from '../../components/kiosk/KioskPage.vue';
import { useKioskStore } from '../../stores/kiosk';
import { openPick, PURPOSE_LABEL } from './kioskPick';

/** Teachers of the campus by surname, with a letter rail on the side to jump through the list. */
defineProps({ purpose: { type: String, required: true } });
const kiosk = useKioskStore();
const router = useRouter();
const sections = ref({});
const jump = (letter) => sections.value[letter]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
</script>
<template>
  <KioskPage :title="PURPOSE_LABEL[purpose]" :sub="`${kiosk.campusName} · vali õpetaja`">
    <div class="flex gap-3">
      <div class="grid min-w-0 grow gap-5">
        <section v-for="[letter, names] in kiosk.teachersByLetter" :key="letter" :ref="(el) => (sections[letter] = el)" class="scroll-mt-4">
          <h3 class="mb-2 text-2xl font-bold text-primary">{{ letter }}</h3>
          <div class="grid gap-2" style="grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr))">
            <button v-for="t in names" :key="t" type="button" class="btn btn-lg h-auto min-h-14 justify-start border-neutral text-left font-normal"
              @click="openPick(router, purpose, 'teacher', t)">
              {{ t }}
            </button>
          </div>
        </section>
      </div>
      <!-- the letter rail stays in view while the list scrolls -->
      <nav class="sticky top-2 flex h-fit max-h-[calc(100vh-1rem)] flex-col gap-1 overflow-y-auto" aria-label="Perekonnanime algustäht">
        <button v-for="[letter] in kiosk.teachersByLetter" :key="letter" type="button" class="btn btn-square btn-md border-neutral text-lg" @click="jump(letter)">
          {{ letter }}
        </button>
      </nav>
    </div>
  </KioskPage>
</template>
