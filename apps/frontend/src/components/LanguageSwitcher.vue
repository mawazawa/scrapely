<script setup lang="ts">
/**
 * Language switcher component
 * Allows users to change the UI language
 */

const { locale, locales, setLocale } = useI18n();

const availableLocales = computed(() =>
  (locales.value as Array<{ code: string; name: string }>).map((l) => ({
    code: l.code,
    name: l.name,
  }))
);

const currentLocale = computed(() =>
  availableLocales.value.find((l) => l.code === locale.value)
);

const isOpen = ref(false);

function selectLocale(code: string) {
  setLocale(code);
  isOpen.value = false;
}
</script>

<template>
  <div class="relative">
    <button
      @click="isOpen = !isOpen"
      class="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
        />
      </svg>
      <span class="text-sm">{{ currentLocale?.name || locale }}</span>
      <svg
        class="w-4 h-4 transition-transform"
        :class="{ 'rotate-180': isOpen }"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        class="absolute right-0 mt-2 w-40 rounded-lg bg-slate-800 border border-slate-700 shadow-lg z-50"
      >
        <div class="py-1">
          <button
            v-for="loc in availableLocales"
            :key="loc.code"
            @click="selectLocale(loc.code)"
            class="w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors"
            :class="{
              'text-emerald-400': loc.code === locale,
              'text-slate-300': loc.code !== locale,
            }"
          >
            {{ loc.name }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- Click outside to close -->
    <div
      v-if="isOpen"
      class="fixed inset-0 z-40"
      @click="isOpen = false"
    ></div>
  </div>
</template>
