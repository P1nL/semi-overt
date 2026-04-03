<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ArticleCard } from '@/entities/article/ui'
import { EmptyState } from '@/shared/components/base'
import { usePendingReviewsQuery, useUserProfileQuery } from '@/shared/api/queries'
import { SectionHeader } from '@/shared/components/layout'
import { getErrorMessage } from '@/shared/utils/error'
import { useAuthStore } from '@/stores/auth'
import { type ProfileArticleTab } from '@/stores/profile'
import { AppHeader } from '@/widgets/app-header'
import { ProfileHeader } from '@/widgets/profile-header'
import { ProfileTabs } from '@/widgets/profile-tabs'
import { ReviewQueueStrip } from '@/widgets/review-queue-strip'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const username = computed(() => String(route.params.username || '').trim())
const activeTab = computed<ProfileArticleTab>(() => {
  const rawTab = String(route.query.tab || 'approved').toLowerCase()
  if (['all', 'approved', 'pending', 'returned', 'rejected', 'draft'].includes(rawTab)) {
    return rawTab as ProfileArticleTab
  }
  return 'approved'
})

const profileQuery = useUserProfileQuery(username, computed(() => ({
  tab: activeTab.value,
  page: 1,
  pageSize: 10,
})))

const profile = computed(() => profileQuery.data.value ?? null)
const articles = computed(() => profile.value?.articles ?? [])
const pageError = computed(() =>
  profileQuery.error.value
    ? getErrorMessage(profileQuery.error.value, '个人主页加载失败，请稍后重试。')
    : '',
)

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
  if (articles.value.length) return 'content'
  return 'empty'
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
    tab: tab === 'approved' ? undefined : tab,
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
        <SectionHeader title="待审核文章" description="仅管理员可见，点击卡片可直接进入审核。" compact />

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

      <section class="surface-1 rounded-[var(--radius-xl)] p-3 sm:p-4 md:p-5">
        <ProfileTabs
          :model-value="activeTab"
          :counts="tabCounts"
          :public-only="!isOwnerProfile"
          @change="onTabChange"
        />
      </section>

      <Transition name="content-fade" mode="out-in">
        <div
          v-if="contentState === 'loading'"
          key="profile-loading"
          class="content-loading-shell"
        />

        <div
          v-else-if="contentState === 'content'"
          key="profile-content"
          class="grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
        >
          <div
            v-for="(item, index) in articles"
            :key="item.id"
            class="content-rise-in"
            :style="{ '--content-rise-delay': `${index * 55}ms` }"
          >
            <ArticleCard
              :article="item"
              :show-status="true"
              :show-reason="true"
            />
          </div>
        </div>

        <div v-else key="profile-empty" class="surface-1 rounded-[var(--radius-xl)] p-8">
          <EmptyState
            title="还没有文章"
            :description="pageError || '这个主页下暂时没有可见文章。'"
            emoji="P"
          />
        </div>
      </Transition>
    </main>
  </div>
</template>
