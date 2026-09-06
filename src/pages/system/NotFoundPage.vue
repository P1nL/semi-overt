<script setup lang="ts">
import { useRouter } from 'vue-router'

import { Button } from '@/shared/components/base'

const router = useRouter()

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }

  void router.push('/')
}
</script>

<template>
  <div class="min-h-[calc(100vh-var(--header-height))] md:min-h-[calc(100vh-var(--header-height-md))]">
    <main class="page-container py-16 md:py-24">
      <section class="surface-1 mx-auto max-w-2xl rounded-[var(--radius-xl)] px-8 py-12 text-center">
        <div class="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">页面不存在</div>
        <h1 class="text-5xl font-semibold tracking-[-0.06em] text-[var(--color-text)]">404</h1>
        <p class="mt-4 text-sm leading-6 text-[var(--color-text-muted)]">
          这个页面可能已被删除，或链接地址有误。
        </p>
        <div class="mt-8 flex flex-wrap justify-center gap-3">
          <Button type="button" variant="secondary" pill @click="goBack">返回上一页</Button>
          <Button type="button" pill @click="router.push('/')">返回首页</Button>
        </div>
      </section>
    </main>
  </div>
</template>
