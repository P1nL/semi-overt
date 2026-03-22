<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onKeyStroke } from '@vueuse/core'

import { ForgotPasswordForm, LoginForm, RegisterForm } from '@/features/auth'
import Icon from '@/shared/components/base/Icon.vue'
import AuthDialogTabs, { type AuthDialogMode } from './AuthDialogTabs.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    initialMode?: AuthDialogMode
    title?: string
    closeOnSuccess?: boolean
  }>(),
  {
    initialMode: 'login',
    title: '',
    closeOnSuccess: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [boolean]
  success: []
}>()

const mode = ref<AuthDialogMode>(props.initialMode)
const slideDirection = ref<'forward' | 'backward'>('forward')
const formKey = ref(0)
const contentRef = ref<HTMLElement | null>(null)
const animatedHeight = ref<number | null>(null)

let resizeObserver: ResizeObserver | null = null

function getModeOrder(value: AuthDialogMode): number {
  switch (value) {
    case 'login':
      return 0
    case 'register':
      return 1
    case 'forgot':
      return 2
    default:
      return 0
  }
}

watch(
  () => props.initialMode,
  (value) => {
    if (!props.modelValue) {
      mode.value = value
    }
  },
)

watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen) {
      mode.value = props.initialMode
      slideDirection.value = 'forward'
      await nextTick()
      updateHeight()
      observeContent()
    } else {
      resizeObserver?.disconnect()
      animatedHeight.value = null
    }

    formKey.value += 1
  },
)

watch(
  () => mode.value,
  async () => {
    formKey.value += 1
    await nextTick()
    updateHeight()
    observeContent()
  },
  { flush: 'post' },
)

onKeyStroke('Escape', () => {
  if (props.modelValue) {
    closeDialog()
  }
})

const dialogTitle = computed(() => {
  if (props.title) return props.title
  if (mode.value === 'register') return '注册账号'
  if (mode.value === 'forgot') return '找回密码'
  return '登录账号'
})

const dialogSubtitle = computed(() => {
  if (mode.value === 'register') return '创建账号后即可开始发布与管理文章。'
  if (mode.value === 'forgot') return '输入注册邮箱，我们会向你发送重置密码邮件。'
  return '登录后即可访问草稿箱、发布入口和个人页面。'
})

const formTransitionKey = computed(() => `${mode.value}-${formKey.value}`)

function updateHeight() {
  if (!contentRef.value) return
  animatedHeight.value = contentRef.value.offsetHeight
}

function observeContent() {
  resizeObserver?.disconnect()

  if (!props.modelValue || !contentRef.value || typeof ResizeObserver === 'undefined') return

  resizeObserver = new ResizeObserver(() => {
    updateHeight()
  })

  resizeObserver.observe(contentRef.value)
}

function closeDialog() {
  emit('update:modelValue', false)
}

function switchMode(next: AuthDialogMode) {
  if (next === mode.value) return
  slideDirection.value = getModeOrder(next) >= getModeOrder(mode.value) ? 'forward' : 'backward'
  mode.value = next
}

function handleSuccess() {
  emit('success')
  if (props.closeOnSuccess) {
    closeDialog()
  }
}

function handleLoginSwitch(next: 'register' | 'forgot-password') {
  switchMode(next === 'register' ? 'register' : 'forgot')
}

function handleRegisterSwitch(next: 'login' | 'forgot-password') {
  switchMode(next === 'login' ? 'login' : 'forgot')
}

function handleForgotSwitch() {
  switchMode('login')
}

onMounted(async () => {
  if (!props.modelValue) return
  await nextTick()
  updateHeight()
  observeContent()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <button
        v-if="modelValue"
        type="button"
        class="fixed inset-0 z-[60] bg-[color-mix(in_srgb,var(--color-text)_18%,transparent)] backdrop-blur-sm"
        aria-label="关闭登录弹窗"
        @click="closeDialog"
      />
    </Transition>

    <Transition
      enter-active-class="transition duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
      enter-from-class="translate-y-10 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-300 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-6 opacity-0"
    >
      <section
        v-if="modelValue"
        class="surface-1 fixed bottom-0 left-1/2 z-[61] flex w-[min(31.25rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col rounded-t-[var(--radius-xl)] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-[var(--shadow-lg)] md:px-6"
        role="dialog"
        aria-modal="true"
        :aria-label="dialogTitle"
        @click.stop
      >
        <div
          class="overflow-hidden transition-[height] duration-550 ease-[cubic-bezier(0.22,1,0.36,1)]"
          :style="{ height: animatedHeight ? `${animatedHeight}px` : undefined }"
        >
          <div ref="contentRef">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0 flex-1 overflow-hidden">
                <Transition
                  mode="out-in"
                  enter-active-class="transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  :enter-from-class="slideDirection === 'forward' ? 'translate-x-6 opacity-0' : '-translate-x-6 opacity-0'"
                  enter-to-class="translate-x-0 opacity-100"
                  leave-active-class="transition duration-220 ease-in"
                  leave-from-class="translate-x-0 opacity-100"
                  :leave-to-class="slideDirection === 'forward' ? '-translate-x-6 opacity-0' : 'translate-x-6 opacity-0'"
                >
                  <div :key="`${mode}-header`">
                    <h2 class="mt-2 text-[1.75rem] font-semibold tracking-[-0.04em] text-[var(--color-text)]">
                      {{ dialogTitle }}
                    </h2>
                    <p class="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                      {{ dialogSubtitle }}
                    </p>
                  </div>
                </Transition>
              </div>

              <button
                type="button"
                class="surface-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors duration-200 hover:text-[var(--color-text)]"
                aria-label="关闭登录弹窗"
                @click="closeDialog"
              >
                <Icon name="close" :size="16" />
              </button>
            </div>

            <div class="mt-6">
              <AuthDialogTabs :model-value="mode" @update:model-value="switchMode" />
            </div>

            <div class="mt-6 overflow-hidden">
              <Transition
                mode="out-in"
                enter-active-class="transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                :enter-from-class="slideDirection === 'forward' ? 'translate-x-8 opacity-0' : '-translate-x-8 opacity-0'"
                enter-to-class="translate-x-0 opacity-100"
                leave-active-class="transition duration-220 ease-in"
                leave-from-class="translate-x-0 opacity-100"
                :leave-to-class="slideDirection === 'forward' ? '-translate-x-8 opacity-0' : 'translate-x-8 opacity-0'"
              >
                <div :key="formTransitionKey" class="pt-1">
                  <LoginForm
                    v-if="mode === 'login'"
                    @success="handleSuccess"
                    @switch-mode="handleLoginSwitch"
                  />

                  <RegisterForm
                    v-else-if="mode === 'register'"
                    @success="handleSuccess"
                    @switch-mode="handleRegisterSwitch"
                  />

                  <ForgotPasswordForm
                    v-else
                    @success="handleSuccess"
                    @switch-mode="handleForgotSwitch"
                  />
                </div>
              </Transition>
            </div>
          </div>
        </div>
      </section>
    </Transition>
  </Teleport>
</template>
