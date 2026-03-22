<!-- src/entities/user/ui/UserAvatarName.vue -->
<script setup lang="ts">
import { Avatar } from '@/shared/components'
import type { UserProfileVm } from '../model/user.types'

withDefaults(
    defineProps<{
      user: Pick<UserProfileVm, 'displayName' | 'username' | 'avatarUrl' | 'profilePath'>
      size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
      clickable?: boolean
      showUsername?: boolean
    }>(),
    {
      size: 'md',
      clickable: true,
      showUsername: false,
    },
)
</script>

<template>
  <component
      :is="clickable ? 'RouterLink' : 'div'"
      :to="clickable ? user.profilePath : undefined"
      class="inline-flex items-center gap-3"
  >
    <Avatar
        :src="user.avatarUrl ?? undefined"
        :alt="user.displayName"
        :name="user.displayName"
        :fallback="user.displayName.slice(0, 1)"
        :size="size"
        rounded
    />
    <div class="min-w-0">
      <div class="truncate text-sm font-medium tracking-[-0.01em] text-[var(--color-text)]">{{ user.displayName }}</div>
      <div v-if="showUsername" class="truncate text-xs text-[var(--color-text-muted)]">@{{ user.username }}</div>
    </div>
  </component>
</template>
