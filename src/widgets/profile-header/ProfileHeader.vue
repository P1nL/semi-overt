<script setup lang="ts">
import { computed } from 'vue'

import type { UserProfileVm } from '@/entities/user'
import { UserRoleBadge } from '@/entities/user/ui'
import { ProfileEditButton } from '@/features/profile-edit'
import { Avatar } from '@/shared/components'
import { useAuthStore } from '@/stores/auth'

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


</script>

<template>
  <section
    class="profile-header-reveal relative overflow-hidden rounded-[var(--radius-xl)]"
  >
    <!-- 有封面图 -->
    <div v-if="profile.coverUrl" class="absolute inset-0">
      <img
        :src="profile.coverUrl"
        :alt="`${profile.displayName} cover`"
        loading="eager"
        decoding="async"
        fetchpriority="high"
        class="size-full object-cover"
        style="mask-image: radial-gradient(ellipse 90% 85% at 50% 40%, black 65%, transparent 100%); -webkit-mask-image: radial-gradient(ellipse 90% 85% at 50% 40%, black 65%, transparent 100%);"
      />
    </div>

    <div class="relative px-4 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6 md:px-8 md:pb-8 md:pt-8">
      <div
        v-if="profile.coverUrl"
        class="relative min-h-[22rem] sm:min-h-[26rem] md:min-h-[30rem]"
      >
        <div class="absolute bottom-3 right-3 z-20 md:bottom-4 md:right-4">
          <ProfileEditButton
            v-if="isOwner"
            :profile="profile"
            @updated="$emit('updated', $event)"
          />
        </div>

        <div class="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center px-4 pb-10 pt-8 text-center sm:px-6 sm:pb-12 sm:pt-10 md:px-8 md:pb-14">
          <div class="inline-flex">
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
          </div>

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

      <!-- 无封面图 -->
      <div v-else class="relative">
        <div class="absolute bottom-0.5 right-0.5 z-20 md:bottom-1 md:right-1">
          <ProfileEditButton
            v-if="isOwner"
            :profile="profile"
            @updated="$emit('updated', $event)"
          />
        </div>

        <div class="mt-10 flex min-h-[18rem] flex-col items-center justify-end pb-8 text-center sm:mt-12 sm:min-h-[20rem] sm:pb-10 md:mt-14 md:min-h-[22rem] md:pb-12">
          <div class="inline-flex">
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
          </div>

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

    </div>


  </section>
</template>

