<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { usePendingReviewsQuery, useUserProfileQuery } from '@/shared/api/queries'
import { SectionHeader } from '@/shared/components/layout'
import { getErrorMessage } from '@/shared/utils/error'
import { useAuthStore } from '@/stores/auth'
import { type ProfileArticleTab } from '@/stores/profile'
import { AppHeader } from '@/widgets/app-header'
import { ProfileHeader } from '@/widgets/profile-header'
import { ProfileCardQueue } from '@/widgets/profile-card-queue'
import { ProfileTabs } from '@/widgets/profile-tabs'
import { ReviewQueueStrip } from '@/widgets/review-queue-strip'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const username = computed(() => String(route.params.username || '').trim())
const defaultTab = computed<ProfileArticleTab>(() => (
  authStore.user?.username === username.value ? 'all' : 'approved'
))
const activeTab = computed<ProfileArticleTab>(() => {
  const rawTab = String(route.query.tab || defaultTab.value).toLowerCase()
  if (['all', 'approved', 'pending', 'returned', 'rejected', 'draft'].includes(rawTab)) {
    return rawTab as ProfileArticleTab
  }
  return defaultTab.value
})

const profileQuery = useUserProfileQuery(username, computed(() => ({
  tab: activeTab.value,
  page: 1,
  pageSize: 10,
})))

const profile = computed(() => profileQuery.data.value ?? null)
const articles = computed(() => profile.value?.articles ?? [])
const tabCounts = computed(() => {
  const stats = profile.value?.stats || []
  const statusTotal = stats.reduce((sum, item) => {
    if (
      item.key === 'approved' ||
      item.key === 'pending' ||
      item.key === 'returned' ||
      item.key === 'rejected' ||
      item.key === 'draft'
    ) {
      return sum + item.value
    }

    return sum
  }, 0)

  const result: Partial<Record<ProfileArticleTab, number>> = {
    all: statusTotal,
  }

  stats.forEach((item) => {
    if (
      item.key === 'approved' ||
      item.key === 'pending' ||
      item.key === 'returned' ||
      item.key === 'rejected' ||
      item.key === 'draft'
    ) {
      result[item.key] = item.value
    }
  })

  return result
})

const hasResolvedProfile = computed(() => profile.value !== null)
const contentState = computed(() => {
  if (!hasResolvedProfile.value && profileQuery.isFetching.value) return 'loading'
  return null
})

const isOwnerProfile = computed(
  () => authStore.user?.username === profile.value?.username,
)

const showAdminReviewQueue = computed(
  () => authStore.isAdmin && isOwnerProfile.value,
)

const pendingReviewsQuery = usePendingReviewsQuery(1, 10, showAdminReviewQueue)
const pendingItems = computed(() => pendingReviewsQuery.data.value?.list ?? [])
const reviewQueueError = computed(() =>
  pendingReviewsQuery.error.value
    ? getErrorMessage(pendingReviewsQuery.error.value, '待审核列表加载失败，请稍后重试。')
    : '',
)

async function onTabChange(tab: ProfileArticleTab) {
  const nextQuery = {
    ...route.query,
    tab: tab === defaultTab.value ? undefined : tab,
  }

  await router.replace({
    query: nextQuery,
  })
}
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="page-container space-y-8 py-8 md:space-y-10 md:py-10">
      <ProfileHeader
        v-if="profile"
        :profile="profile"
      />

      <section
        v-if="showAdminReviewQueue"
        class="surface-1 rounded-[var(--radius-xl)] p-4 md:p-5"
      >
        <SectionHeader title="审核" description="" compact />

        <div class="mt-4">
          <ReviewQueueStrip
            :items="pendingItems"
            :loading="pendingReviewsQuery.isFetching.value"
          />
        </div>

        <p
          v-if="!pendingReviewsQuery.isFetching.value && reviewQueueError"
          class="mt-3 text-sm text-[var(--color-danger)]"
        >
          {{ reviewQueueError }}
        </p>
      </section>

      <section class="profile-content-layout">
        <aside class="profile-content-layout__tabs">
          <ProfileTabs
            :model-value="activeTab"
            :counts="tabCounts"
            :public-only="!isOwnerProfile"
            orientation="vertical"
            @change="onTabChange"
          />
        </aside>

        <div class="profile-content-layout__main">
          <div class="profile-content-layout__tabs-mobile surface-1 rounded-[var(--radius-xl)] p-3 sm:p-4">
            <ProfileTabs
              :model-value="activeTab"
              :counts="tabCounts"
              :public-only="!isOwnerProfile"
              @change="onTabChange"
            />
          </div>

          <Transition name="content-fade" mode="out-in">
            <div
              v-if="contentState === 'loading'"
              key="profile-loading"
              class="content-loading-shell"
            />

            <div v-else key="profile-content">
              <ProfileCardQueue :articles="articles" />
            </div>
          </Transition>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.profile-content-layout {
  display: block;
}

.profile-content-layout__tabs {
  display: none;
}

.profile-content-layout__main {
  display: grid;
  gap: 1rem;
}

@media (min-width: 1024px) {
  .profile-content-layout {
    display: grid;
    grid-template-columns: 11rem minmax(0, 1fr);
    align-items: start;
    gap: 1.5rem;
  }

  .profile-content-layout__tabs {
    position: sticky;
    top: calc(var(--header-height-md) + 1rem);
    display: block;
    border-radius: var(--radius-xl);
    padding: 0.75rem;
  }

  .profile-content-layout__main {
    position: relative;
  }

  .profile-content-layout__main::before {
    content: '';
    position: absolute;
    left: -0.75rem;
    top: 0.75rem;
    bottom: 22rem;
    width: 1px;
    background: var(--color-profile-divider);
    pointer-events: none;
  }

  .profile-content-layout__tabs-mobile {
    display: none;
  }
}
</style>
