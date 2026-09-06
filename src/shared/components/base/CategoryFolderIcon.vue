<script setup lang="ts">
defineProps<{ active?: boolean }>()
</script>

<template>
  <!-- Paths taken from the supplied Folder.zip animation, frames 0 and 7. -->
  <svg class="category-folder" :class="{ 'is-active': active }" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <g transform="translate(14 14)">
      <path d="M-10 -5.25 C-10 -5.25 -10 -7 -10 -7 C-10 -8.104 -9.104 -9 -8 -9 C-8 -9 -3 -9 -3 -9 C-3 -9 -1 -6 -1 -6 C-1 -6 8 -6 8 -6 C9.104 -6 10 -5.104 10 -4 C10 -4 10 -2.188 10 -2.188" />
      <path class="category-folder__front" d="M10 7 C10 8.104 9.104 9 8 9 C8 9 -8 9 -8 9 C-9.104 9 -10 8.104 -10 7 C-10 7 -10 -3.788 -10 -3.788 C-10 -3.788 -10 -7 -10 -7 C-10 -8.104 -9.104 -9 -8 -9 C-8 -9 -3 -9 -3 -9 C-3 -9 -1 -6 -1 -6 C-1 -6 8 -6 8 -6 C9.104 -6 10 -5.104 10 -4 C10 -4 10 7 10 7 Z" />
    </g>
  </svg>
</template>

<style scoped>
.category-folder { display: block; flex: none; }
.category-folder__front { d: path('M10 7 C10 8.104 9.104 9 8 9 C8 9 -8 9 -8 9 C-9.104 9 -10 8.104 -10 7 C-10 7 -10 -3.788 -10 -3.788 C-10 -3.788 -10 -7 -10 -7 C-10 -8.104 -9.104 -9 -8 -9 C-8 -9 -3 -9 -3 -9 C-3 -9 -1 -6 -1 -6 C-1 -6 8 -6 8 -6 C9.104 -6 10 -5.104 10 -4 C10 -4 10 7 10 7 Z'); transition: d 240ms cubic-bezier(.4, 0, .2, 1); }
.is-active .category-folder__front { d: path('M10 7 C10 8.104 9.104 9 8 9 C8 9 -8 9 -8 9 C-9.104 9 -10 8.104 -10 7 C-10 7 -11.375 -0.1 -11.375 -0.1 C-11.375 -0.1 -11.875 -3.312 -11.875 -3.312 C-11.875 -4.416 -10.979 -5.312 -9.875 -5.312 C-9.875 -5.312 -3.625 -5.312 -3.625 -5.312 C-3.625 -5.312 -1.625 -2.312 -1.625 -2.312 C-1.625 -2.312 9.875 -2.312 9.875 -2.312 C10.979 -2.312 11.875 -1.4160000000000001 11.875 -0.312 C11.875 -0.312 10 7 10 7 Z'); }
@media (prefers-reduced-motion: reduce) {
  .category-folder__front { transition: none; }
}
</style>
