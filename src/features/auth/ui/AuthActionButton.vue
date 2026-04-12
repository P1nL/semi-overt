<script setup lang="ts">
import { Button } from '@/shared/components/base'

withDefaults(
  defineProps<{
    type?: 'button' | 'submit' | 'reset'
    loading?: boolean
    disabled?: boolean
    iconOnly?: boolean
    ariaLabel?: string
  }>(),
  {
    type: 'button',
    loading: false,
    disabled: false,
    iconOnly: false,
    ariaLabel: '',
  },
)
</script>

<template>
  <Button
    :type="type"
    variant="secondary"
    size="lg"
    class="auth-action-button"
    :class="iconOnly ? 'auth-action-button--icon-only' : ''"
    :icon-only="iconOnly"
    :loading="loading"
    :disabled="disabled"
    :aria-label="ariaLabel || undefined"
  >
    <span v-if="!iconOnly" aria-hidden="true" class="auth-action-button__glow" />
    <span class="auth-action-button__label" :class="iconOnly ? 'auth-action-button__label--icon-only' : ''">
      <slot />
    </span>
  </Button>
</template>

<style scoped>
.auth-action-button {
  position: relative;
  isolation: isolate;
  width: 14rem;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--color-primary) 12%, var(--color-border));
  background:
    linear-gradient(180deg, rgb(255 255 255 / 0.94), rgb(255 255 255 / 0.76)),
    color-mix(in srgb, var(--color-surface) 88%, white);
  box-shadow:
    0 16px 34px rgb(0 113 227 / 0.12),
    inset 0 1px 0 rgb(255 255 255 / 0.86);
  transition:
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 220ms ease,
    box-shadow 220ms ease,
    background-color 220ms ease,
    filter 220ms ease;
}

.auth-action-button--icon-only {
  width: 5.5rem;
  border-color: transparent;
  border-radius: var(--radius-lg);
  background: transparent;
  box-shadow: none;
}

.auth-action-button:hover {
  border-color: color-mix(in srgb, var(--color-primary) 12%, var(--color-border));
  background:
    linear-gradient(180deg, rgb(255 255 255 / 0.94), rgb(255 255 255 / 0.76)),
    color-mix(in srgb, var(--color-surface) 88%, white);
  box-shadow:
    0 16px 34px rgb(0 113 227 / 0.12),
    inset 0 1px 0 rgb(255 255 255 / 0.86);
  transform: none;
}

.auth-action-button--icon-only:hover {
  border-color: transparent;
  background: transparent;
  box-shadow: none;
}

.auth-action-button:active {
  box-shadow:
    0 12px 24px rgb(0 113 227 / 0.14),
    inset 0 1px 0 rgb(255 255 255 / 0.9);
}

.auth-action-button--icon-only:active {
  box-shadow: none;
}

.auth-action-button:disabled {
  box-shadow:
    0 12px 24px rgb(15 23 42 / 0.08),
    inset 0 1px 0 rgb(255 255 255 / 0.75);
}

.auth-action-button--icon-only:disabled {
  box-shadow: none;
}

.auth-action-button__glow {
  position: absolute;
  inset: -1px;
  z-index: 0;
  background:
    radial-gradient(circle at 16% 24%, rgb(0 113 227 / 0.22), transparent 34%),
    radial-gradient(circle at 52% 50%, rgb(52 199 89 / 0.18), transparent 38%),
    radial-gradient(circle at 84% 26%, rgb(255 159 10 / 0.22), transparent 34%);
  opacity: 0.8;
  transition:
    opacity 220ms ease,
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 220ms ease;
}

.auth-action-button:active .auth-action-button__glow {
  filter: saturate(1.12);
}

.auth-action-button__label {
  position: relative;
  z-index: 1;
  font-size: 1.125rem;
  font-weight: 600;
  background: linear-gradient(90deg, #0071e3 0%, #34c759 45%, #ff9f0a 100%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}

.auth-action-button__label--icon-only {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  -webkit-background-clip: initial;
  color: currentColor;
}
</style>
