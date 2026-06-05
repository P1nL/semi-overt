<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value: number
}>()

const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
const formattedValue = computed(() =>
  Math.max(0, Math.round(Number(props.value) || 0)).toLocaleString('zh-CN'),
)
const characters = computed(() => formattedValue.value.split(''))

function isDigit(character: string): boolean {
  return /^\d$/.test(character)
}
</script>

<template>
  <span class="rolling-number" :aria-label="formattedValue">
    <span
      v-for="(character, index) in characters"
      :key="index"
      class="rolling-number__slot"
      :class="{ 'rolling-number__slot--digit': isDigit(character) }"
    >
      <span
        v-if="isDigit(character)"
        class="rolling-number__track"
        :style="{ '--rolling-digit': Number(character) }"
        aria-hidden="true"
      >
        <span
          v-for="digit in digits"
          :key="digit"
          class="rolling-number__digit"
        >
          {{ digit }}
        </span>
      </span>
      <span v-else class="rolling-number__separator" aria-hidden="true">
        {{ character }}
      </span>
    </span>
  </span>
</template>

<style scoped>
.rolling-number {
  display: inline-flex;
  align-items: baseline;
  color: inherit;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.rolling-number__slot {
  display: inline-block;
  line-height: 1;
}

.rolling-number__slot--digit {
  width: 0.62em;
  height: 1em;
  overflow: hidden;
}

.rolling-number__track {
  display: flex;
  flex-direction: column;
  transform: translateY(calc(var(--rolling-digit) * -1em));
  transition: transform 560ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
}

.rolling-number__digit {
  display: block;
  height: 1em;
  line-height: 1;
  text-align: center;
}

.rolling-number__separator {
  display: inline-block;
  min-width: 0.28em;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .rolling-number__track {
    transition-duration: 0.01ms !important;
  }
}
</style>
