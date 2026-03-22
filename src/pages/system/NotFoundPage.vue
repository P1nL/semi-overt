<script setup lang="ts">
import { Button } from '@/shared/components/base'
import { AppHeader } from '@/widgets/app-header'
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="page-container py-16 md:py-24">
      <section class="surface-1 mx-auto max-w-2xl rounded-[var(--radius-xl)] px-8 py-12 text-center">
        <div class="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">Not found</div>
        <h1 class="text-5xl font-semibold tracking-[-0.06em] text-[var(--color-text)]">404</h1>
        <p class="mt-4 text-sm leading-6 text-[var(--color-text-muted)]">
          The page you are looking for no longer exists or the link is incorrect.
        </p>
        <div class="mt-8">
          <Button type="button" pill @click="$router.push('/')">Back home</Button>
        </div>
      </section>
    </main>
  </div>
</template>
