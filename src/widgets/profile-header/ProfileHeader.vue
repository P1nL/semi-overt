<script setup lang="ts">
import { computed } from 'vue'

import type { UserProfileVm } from '@/entities/user'
import { UserRoleBadge } from '@/entities/user/ui'
import { ProfileEditButton } from '@/features/profile-edit'
import { Avatar, TiltedCard } from '@/shared/components'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  profile: UserProfileVm
}>()

defineEmits<{
  updated: [UserProfileVm]
}>()

const authStore = useAuthStore()

const isOwner = computed(() => {
  const currentUser = authStore.user
  if (!currentUser) return false

  if (String(currentUser.id) === String(props.profile.id)) return true

  return currentUser.username.trim().toLowerCase()
    === props.profile.username.trim().toLowerCase()
})
</script>

<template>
  <TiltedCard
    :rotate-amplitude="5.5"
    :scale-on-hover="1"
    perspective="1400px"
    class="profile-header-tilt profile-header-reveal"
  >
    <section
      class="profile-card"
      :class="profile.coverUrl ? 'profile-card--cover' : 'profile-card--plain'"
    >
      <div class="profile-card__media" aria-hidden="true">
        <img
          v-if="profile.coverUrl"
          :src="profile.coverUrl"
          alt=""
          loading="eager"
          decoding="async"
          fetchpriority="high"
          class="profile-card__cover-image"
        />
      </div>

      <div
        v-if="isOwner"
        class="profile-card__edit"
      >
        <ProfileEditButton
          :profile="profile"
          @updated="$emit('updated', $event)"
        />
      </div>

      <div class="profile-card__content">
        <div class="profile-card__avatar-layer">
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
            class="profile-card__avatar"
          />
        </div>

        <div class="profile-card__identity-layer">
          <h1 class="profile-card__name">
            {{ profile.displayName }}
          </h1>
          <p class="profile-card__username">
            @{{ profile.username }}
          </p>
        </div>

        <div
          v-if="profile.role"
          class="profile-card__role-layer"
        >
          <UserRoleBadge :role="profile.role" />
        </div>

        <p
          v-if="profile.signature"
          class="profile-card__signature"
        >
          {{ profile.signature }}
        </p>
      </div>
    </section>
  </TiltedCard>
</template>

<style scoped>
.profile-header-tilt {
  border-radius: var(--radius-xl);
}

.profile-card {
  position: relative;
  min-height: 22rem;
  overflow: visible;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 72%, white 28%);
  border-radius: var(--radius-xl);
  background: var(--color-surface-elevated);
  box-shadow:
    0 34px 80px rgb(15 23 42 / 0.16),
    0 10px 28px rgb(15 23 42 / 0.08);
  transform-style: preserve-3d;
}

.profile-card__media {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  border-radius: inherit;
  background: color-mix(in srgb, var(--color-surface-elevated) 96%, var(--color-bg) 4%);
  transform: translateZ(0);
}

.profile-card--cover .profile-card__media::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgb(8 15 34 / 0.08) 0%, rgb(8 15 34 / 0.12) 36%, rgb(8 15 34 / 0.72) 100%),
    linear-gradient(90deg, rgb(8 15 34 / 0.12), transparent 28%, transparent 72%, rgb(8 15 34 / 0.12));
  pointer-events: none;
}

.profile-card__cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.profile-card__content {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 0.65rem;
  padding: 2rem 1.25rem 2.25rem;
  text-align: center;
  pointer-events: none;
  transform-style: preserve-3d;
}

.profile-card__avatar-layer {
  display: inline-flex;
  transform: translateZ(76px);
}

.profile-card__avatar {
  width: 5rem;
  height: 5rem;
  border-color: rgb(255 255 255 / 0.7);
  background: rgb(255 255 255 / 0.16);
  color: white;
  font-size: 1.5rem;
  box-shadow:
    0 22px 48px rgb(8 15 34 / 0.34),
    0 0 0 5px rgb(255 255 255 / 0.24);
  backdrop-filter: blur(10px) saturate(140%);
}

.profile-card--plain .profile-card__avatar {
  border-color: color-mix(in srgb, var(--color-border-strong) 82%, white 18%);
  background: color-mix(in srgb, var(--color-surface-glass-strong) 92%, transparent);
  color: var(--color-text);
  box-shadow:
    0 22px 48px rgb(15 23 42 / 0.14),
    0 0 0 5px color-mix(in srgb, var(--color-surface) 66%, transparent);
}

.profile-card__identity-layer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  transform: translateZ(58px);
}

.profile-card__name {
  margin: 0;
  color: white;
  font-size: clamp(1.75rem, 4vw, 2.55rem);
  font-weight: 650;
  letter-spacing: -0.045em;
  line-height: 1.08;
  text-wrap: balance;
  text-shadow: 0 5px 24px rgb(8 15 34 / 0.48);
}

.profile-card__username {
  margin: 0;
  color: rgb(255 255 255 / 0.74);
  font-size: 0.86rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  text-shadow: 0 3px 16px rgb(8 15 34 / 0.38);
}

.profile-card--plain .profile-card__name {
  color: var(--color-text);
  text-shadow: none;
}

.profile-card--plain .profile-card__username {
  color: var(--color-text-muted);
  text-shadow: none;
}

.profile-card__role-layer {
  display: flex;
  justify-content: center;
  pointer-events: auto;
  transform: translateZ(48px);
}

.profile-card__signature {
  max-width: min(42rem, 92%);
  margin: 0.15rem 0 0;
  color: rgb(255 255 255 / 0.84);
  font-size: 0.875rem;
  line-height: 1.65;
  text-wrap: balance;
  text-shadow: 0 3px 18px rgb(8 15 34 / 0.5);
  transform: translateZ(34px);
}

.profile-card--plain .profile-card__signature {
  color: var(--color-text-muted);
  text-shadow: none;
}

.profile-card__edit {
  position: absolute;
  right: 1.75rem;
  bottom: 1rem;
  z-index: 40;
  display: flex;
  color: rgb(255 255 255 / 0.86);
  filter: drop-shadow(0 2px 8px rgb(8 15 34 / 0.46));
  pointer-events: auto;
  transform: translateZ(82px);
}

.profile-card--plain .profile-card__edit {
  color: var(--color-text-muted);
  filter: none;
}

html.dark .profile-card--plain {
  border-color: rgb(255 255 255 / 0.08);
  background: var(--color-surface);
  box-shadow:
    0 34px 80px rgb(0 0 0 / 0.36),
    0 10px 28px rgb(0 0 0 / 0.22);
}

@media (min-width: 640px) {
  .profile-card {
    min-height: 26rem;
  }

  .profile-card__content {
    gap: 0.75rem;
    padding: 2.5rem 2rem 2.75rem;
  }

  .profile-card__avatar {
    width: 5.75rem;
    height: 5.75rem;
    font-size: 1.75rem;
  }

  .profile-card__signature {
    font-size: 0.9375rem;
  }
}

@media (min-width: 768px) {
  .profile-card {
    min-height: 30rem;
  }

  .profile-card__content {
    gap: 0.85rem;
    padding-bottom: 3.25rem;
  }

  .profile-card__avatar {
    width: 6.5rem;
    height: 6.5rem;
    font-size: 2rem;
  }

  .profile-card__edit {
    right: 2.5rem;
    bottom: 1.25rem;
  }
}

@media (max-width: 767px), (hover: none), (pointer: coarse) {
  .profile-card,
  .profile-card__content {
    transform-style: flat;
  }

  .profile-card__avatar-layer,
  .profile-card__identity-layer,
  .profile-card__role-layer,
  .profile-card__signature,
  .profile-card__edit {
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .profile-card,
  .profile-card__content {
    transform-style: flat;
  }

  .profile-card__avatar-layer,
  .profile-card__identity-layer,
  .profile-card__role-layer,
  .profile-card__signature,
  .profile-card__edit {
    transform: none;
  }
}
</style>
