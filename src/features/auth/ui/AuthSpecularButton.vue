<script setup lang="ts">
import Spinner from '@/shared/components/base/Spinner.vue'
import SpecularButton from '@/shared/components/effects/SpecularButton.vue'

withDefaults(
  defineProps<{
    type?: 'button' | 'submit' | 'reset'
    loading?: boolean
    disabled?: boolean
    ariaLabel?: string
  }>(),
  {
    type: 'button',
    loading: false,
    disabled: false,
    ariaLabel: '',
  },
)
</script>

<template>
  <SpecularButton
    class="auth-specular-button"
    :type="type"
    width="18rem"
    height="3.5rem"
    size="md"
    :radius="18"
    :tint-opacity="0"
    :blur="0"
    background-color="#0d1521"
    text-color="#d8ecff"
    line-color="#2997ff"
    base-color="#293442"
    :intensity="0.62"
    :shine-size="8"
    :shine-fade="58"
    :thickness="0.75"
    :speed="0.2"
    :follow-mouse="true"
    :auto-animate="false"
    :disabled="disabled || loading"
    :aria-label="ariaLabel || undefined"
    :aria-busy="loading || undefined"
  >
    <Spinner v-if="loading" size="md" />
    <span v-else class="auth-specular-button__content">
      <slot />
    </span>
  </SpecularButton>
</template>

<style scoped>
.auth-specular-button__content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: currentColor;
}
</style>
