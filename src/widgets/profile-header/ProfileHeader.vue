<script setup lang="ts">
import { computed } from 'vue'

import type { UserProfileVm } from '@/entities/user/model/user.types'
import { UserRoleBadge } from '@/entities/user/ui'
import { ProfileEditButton } from '@/features/profile-edit'
import { Avatar } from '@/shared/components'
import { useAuthStore } from '@/stores/auth'
import ProfileHeaderStats from './ProfileHeaderStats.vue'

const props = defineProps<{
  profile: UserProfileVm
}>()

defineEmits<{
  updated: [UserProfileVm]
}>()

const authStore = useAuthStore()

const isOwner = computed(
  () => authStore.user?.username === props.profile.username,
)

const visibleStats = computed(() => {
  if (isOwner.value) return props.profile.stats

  return props.profile.stats.filter((item) =>
    item.key === 'approved' || item.key === 'totalWordCount',
  )
})

const coverStyle = computed(() => {
  if (!props.profile.coverUrl) return undefined

  return {
    backgroundImage: `url("${props.profile.coverUrl}")`,
  }
})
</script>

<template>
  <section class="surface-1 relative overflow-hidden rounded-[var(--radius-xl)]">
    <div class="absolute inset-0">
      <div
        v-if="profile.coverUrl"
        class="absolute inset-x-4 top-4 h-48 scale-[1.02] rounded-[calc(var(--radius-xl)+0.5rem)] bg-cover bg-center opacity-16 blur-lg sm:inset-x-6 sm:top-6 sm:h-64 md:inset-x-8 md:top-8 md:h-72"
        :style="coverStyle"
      />
      <div class="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.06)_42%,transparent)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03)_42%,transparent)]" />
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,113,227,0.16),transparent_46%)]" />
    </div>

    <div class="relative px-4 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6 md:px-8 md:pb-8 md:pt-8">
      <div
        v-if="profile.coverUrl"
        class="relative mt-3 h-[18rem] overflow-hidden rounded-[calc(var(--radius-xl)+0.25rem)] border border-white/35 bg-[var(--color-surface-elevated)] shadow-[0_24px_60px_rgb(15_23_42_/_0.12)] sm:mt-4 sm:h-[22rem] md:h-[26rem]"
      >
        <img
          :src="profile.coverUrl"
          :alt="`${profile.displayName} cover`"
          loading="eager"
          decoding="async"
          fetchpriority="high"
          class="absolute inset-0 size-full object-cover"
        />
        <div class="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,15,34,0.18),rgba(8,15,34,0.1)_34%,rgba(8,15,34,0.62))]" />
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.22),transparent_42%)]" />

        <div class="absolute right-4 top-4 z-20 md:right-5 md:top-5">
          <ProfileEditButton
            v-if="isOwner"
            :profile="profile"
            @updated="$emit('updated', $event)"
          />
        </div>

        <div class="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center px-4 pb-4 pt-8 text-center sm:px-6 sm:pb-5 sm:pt-10 md:px-8 md:pb-6">
          <Avatar
            :src="profile.avatarUrl ?? undefined"
            :alt="profile.displayName"
            :name="profile.displayName"
            :fallback="profile.displayName.slice(0, 1)"
            size="xl"
            rounded
            loading="eager"
            decoding="async"
            fetchpriority="high"
            class="size-[4.5rem] border-white/70 bg-white/15 text-xl text-white shadow-[0_18px_40px_rgb(15_23_42_/_0.3)] ring-4 ring-white/35 backdrop-blur-sm sm:size-20 sm:text-2xl md:size-24 md:text-3xl"
          />

          <div class="mt-3 space-y-2">
            <div>
              <h1 class="text-[1.55rem] font-semibold tracking-[-0.04em] text-white drop-shadow-[0_4px_20px_rgb(8_15_34_/_0.35)] sm:text-2xl md:text-3xl">
                {{ profile.displayName }}
              </h1>
              <p class="mt-1 text-sm text-white/78 md:text-base">
                @{{ profile.username }}
              </p>
            </div>

            <div class="flex justify-center">
              <UserRoleBadge v-if="profile.role" :role="profile.role" />
            </div>

            <p
              v-if="profile.signature"
              class="mx-auto max-w-2xl text-sm leading-6 text-white/82 md:text-base"
            >
              {{ profile.signature }}
            </p>
          </div>
        </div>
      </div>

      <div v-else>
        <div class="flex justify-end">
          <ProfileEditButton
            v-if="isOwner"
            :profile="profile"
            @updated="$emit('updated', $event)"
          />
        </div>

        <div class="mt-2 flex flex-col items-center text-center">
          <Avatar
            :src="profile.avatarUrl ?? undefined"
            :alt="profile.displayName"
            :name="profile.displayName"
            :fallback="profile.displayName.slice(0, 1)"
            size="xl"
            rounded
            loading="eager"
            decoding="async"
            fetchpriority="high"
            class="size-24 border-white/50 bg-[color-mix(in_srgb,var(--color-surface-elevated)_88%,transparent)] text-2xl text-[var(--color-text)] shadow-[0_18px_40px_rgb(15_23_42_/_0.16)] ring-4 ring-white/40 sm:size-28 sm:text-3xl md:size-36 md:text-4xl"
          />

          <div class="mt-4 space-y-3 sm:mt-5">
            <div>
              <h1 class="text-[1.9rem] font-semibold tracking-[-0.04em] text-[var(--color-text)] sm:text-3xl md:text-4xl">
                {{ profile.displayName }}
              </h1>
              <p class="mt-2 text-sm text-[var(--color-text-muted)] md:text-base">
                @{{ profile.username }}
              </p>
            </div>

            <div class="flex justify-center">
              <UserRoleBadge v-if="profile.role" :role="profile.role" />
            </div>

            <p
              v-if="profile.signature"
              class="mx-auto max-w-2xl text-sm leading-7 text-[var(--color-text-muted)] md:text-base"
            >
              {{ profile.signature }}
            </p>
          </div>
        </div>
      </div>

      <div class="mt-6 flex justify-center sm:mt-7">
        <ProfileHeaderStats :stats="visibleStats" />
      </div>
    </div>
  </section>
</template>
