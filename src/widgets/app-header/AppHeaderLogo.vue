<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ROUTE_NAME } from '@/shared/constants/routes'
import darkLogoSrc from '@/shared/assets/wlogo.png'
import lightLogoSrc from '@/shared/assets/blogo.png'

// isDark 控制哪张图可见，但更新时机延迟到 theme-settling 阶段，
// 避免在 theme-switching（transition:none）期间触发瞬间跳变。
const isDark = ref(document.documentElement.classList.contains('dark'))

let observer: MutationObserver | null = null

onMounted(() => {
  observer = new MutationObserver(() => {
    const root = document.documentElement
    const nowDark = root.classList.contains('dark')

    if (nowDark === isDark.value) return

    if (root.classList.contains('theme-settling')) {
      // 已在 settling 阶段（底层颜色稳定），直接切换，CSS transition 生效
      isDark.value = nowDark
    } else {
      // 仍在 switching 阶段，等 settling 开始时再切换
      const wait = () => {
        if (root.classList.contains('theme-settling')) {
          isDark.value = nowDark
          observer2.disconnect()
        }
      }
      const observer2 = new MutationObserver(wait)
      observer2.observe(root, { attributes: true, attributeFilter: ['class'] })
    }
  })

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <RouterLink
      :to="{ name: ROUTE_NAME.HOME }"
      class="inline-flex items-center rounded-[var(--radius-pill)] px-2 py-1.5 text-[var(--color-text)]"
      aria-label="返回首页"
  >
    <span class="logo-stack">
      <img :src="lightLogoSrc" alt="Now" class="logo-img" :style="{ opacity: isDark ? 0 : 1 }" />
      <img :src="darkLogoSrc"  alt=""   class="logo-img" :style="{ opacity: isDark ? 1 : 0 }" aria-hidden="true" />
    </span>
  </RouterLink>
</template>

<style>
.logo-stack {
  position: relative;
  display: block;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
}

.logo-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: opacity 320ms ease-out;
}
</style>
