<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { ROUTE_NAME } from '@/shared/constants/routes'

const route = useRoute()
const contentRef = ref<HTMLElement | null>(null)
const animatedHeight = ref<number | null>(null)
const slideDirection = ref<'forward' | 'backward'>('forward')

let resizeObserver: ResizeObserver | null = null

function getAuthRouteOrder(name: unknown): number {
  switch (name) {
    case ROUTE_NAME.LOGIN:
      return 0
    case ROUTE_NAME.REGISTER:
      return 1
    case ROUTE_NAME.FORGOT_PASSWORD:
      return 2
    case ROUTE_NAME.RESET_PASSWORD:
      return 3
    default:
      return 0
  }
}

const authPageMeta = computed(() => {
  switch (route.name) {
    case ROUTE_NAME.REGISTER:
      return {
        eyebrow: '加入 Now',
        title: '注册账号',
        description: '创建新账户后，系统会自动帮你登录。',
        glowClass:
          'pointer-events-none absolute left-[-4rem] top-24 h-52 w-52 rounded-full bg-[rgba(255,255,255,0.42)] blur-3xl dark:bg-[rgba(41,151,255,0.14)]',
      }
    case ROUTE_NAME.FORGOT_PASSWORD:
      return {
        eyebrow: '找回密码',
        title: '重置密码',
        description: '输入注册邮箱，如果账号存在，我们会向你发送重置链接。',
        glowClass:
          'pointer-events-none absolute right-[-5rem] top-28 h-56 w-56 rounded-full bg-[rgba(255,255,255,0.42)] blur-3xl dark:bg-[rgba(41,151,255,0.14)]',
      }
    case ROUTE_NAME.RESET_PASSWORD:
      return {
        eyebrow: '设置新密码',
        title: '选择新的密码',
        description: '为你的账户设置一个新密码，然后返回登录。',
        glowClass:
          'pointer-events-none absolute left-[-4rem] top-28 h-56 w-56 rounded-full bg-[rgba(255,255,255,0.42)] blur-3xl dark:bg-[rgba(41,151,255,0.14)]',
      }
    case ROUTE_NAME.LOGIN:
    default:
      return {
        eyebrow: 'Now',
        title: '登录',
        description: '登录后即可继续写作、编辑和管理你的文章。',
        glowClass:
          'pointer-events-none absolute right-[-5rem] top-24 h-56 w-56 rounded-full bg-[rgba(255,255,255,0.42)] blur-3xl dark:bg-[rgba(41,151,255,0.14)]',
      }
  }
})

function updateHeight() {
  if (!contentRef.value) return
  animatedHeight.value = contentRef.value.offsetHeight
}

function observeContent() {
  resizeObserver?.disconnect()

  if (!contentRef.value || typeof ResizeObserver === 'undefined') return

  resizeObserver = new ResizeObserver(() => {
    updateHeight()
  })

  resizeObserver.observe(contentRef.value)
}

watch(
  () => route.name,
  (nextName, previousName) => {
    slideDirection.value =
      getAuthRouteOrder(nextName) >= getAuthRouteOrder(previousName) ? 'forward' : 'backward'
  },
)

watch(
  () => route.fullPath,
  async () => {
    await nextTick()
    updateHeight()
    observeContent()
  },
  { flush: 'post' },
)

onMounted(async () => {
  await nextTick()
  updateHeight()
  observeContent()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})
</script>

<template>
  <div class="relative min-h-screen overflow-hidden px-4 py-10 md:py-14">
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(0,113,227,0.18),transparent_65%)]"
    />
    <div aria-hidden="true" :class="authPageMeta.glowClass" />

    <div
      class="surface-1 relative mx-auto max-w-[30rem] overflow-hidden rounded-[var(--radius-xl)] transition-[height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
      :style="{ height: animatedHeight ? `${animatedHeight}px` : undefined }"
    >
      <div ref="contentRef" class="p-7 md:p-9">
        <Transition
          mode="out-in"
          enter-active-class="transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          :enter-from-class="slideDirection === 'forward' ? 'translate-x-8 opacity-0' : '-translate-x-8 opacity-0'"
          enter-to-class="translate-x-0 opacity-100"
          leave-active-class="transition duration-220 ease-in"
          leave-from-class="translate-x-0 opacity-100"
          :leave-to-class="slideDirection === 'forward' ? '-translate-x-8 opacity-0' : 'translate-x-8 opacity-0'"
        >
          <div :key="route.fullPath">
            <div class="mb-8 text-center">
              <div class="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">
                {{ authPageMeta.eyebrow }}
              </div>
              <h1 class="text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
                {{ authPageMeta.title }}
              </h1>
              <p class="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
                {{ authPageMeta.description }}
              </p>
            </div>

            <RouterView v-slot="{ Component }">
              <component :is="Component" />
            </RouterView>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>
