<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'

import { useInfiniteUserProfileQuery, usePendingReviewsQuery } from '@/entities/queries'
import type { ArticleCardVm } from '@/entities/article'
import { queryKeys } from '@/shared/api/queryKeys'
import { SectionHeader } from '@/shared/components/layout'
import { ARTICLE_STATUS } from '@/shared/constants/article'
import { REVIEW_AUTO_REFRESH_INTERVAL_MS } from '@/shared/constants/review'
import type { ProfileArticleTab } from '@/shared/types/profile'
import { isPublishedArticle } from '@/shared/utils/article'
import { getErrorMessage } from '@/shared/utils/error'
import { preloadImages } from '@/shared/utils/preloadImage'
import { useAuthStore } from '@/stores/auth'
import { ProfileHeader } from '@/widgets/profile-header'
import { ProfileCardQueue } from '@/widgets/profile-card-queue'
import { ProfileTabs } from '@/widgets/profile-tabs'
import { ProfileWritingCalendar } from '@/widgets/profile-writing-calendar'
import { ReviewQueueStrip } from '@/widgets/review-queue-strip'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
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

const profileQuery = useInfiniteUserProfileQuery(username, computed(() => ({
  tab: activeTab.value,
  pageSize: 10,
})))

const profilePages = computed(() => profileQuery.data.value?.pages ?? [])
const profile = computed(() => profilePages.value[0] ?? null)
const isOwnerProfile = computed(
  () => authStore.user?.username === profile.value?.username,
)

function isPublicReadableProfileArticle(article: ArticleCardVm): boolean {
  const status = article.status?.value
  return isPublishedArticle(status) || isPublicReadableDraft(article)
}

function isPublicReadableDraft(article: ArticleCardVm): boolean {
  return article.status?.value === ARTICLE_STATUS.DRAFT && article.draftVisible
}

const articles = computed(() => {
  const seen = new Set<string>()

  return profilePages.value
    .flatMap((page) => page.articles)
    .filter((article) => {
      const key = String(article.id)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .filter((article) => isOwnerProfile.value || isPublicReadableProfileArticle(article))
})

watch(
  () => [profile.value?.coverUrl, profile.value?.avatarUrl] as const,
  ([coverUrl, avatarUrl]) => {
    void preloadImages([coverUrl, avatarUrl], 'high')
  },
  { immediate: true },
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

  if (!isOwnerProfile.value && activeTab.value === 'draft') {
    const visibleDraftsOnLoadedPages = profilePages.value
      .flatMap((page) => page.articles)
      .filter(isPublicReadableDraft)
      .length

    if (visibleDraftsOnLoadedPages === 0) {
      result.draft = 0
      result.all = result.approved ?? 0
    }
  }

  return result
})

watch(
  () => [profile.value !== null, isOwnerProfile.value, activeTab.value, tabCounts.value.draft ?? 0] as const,
  ([resolved, isOwner, tab, publicDraftCount]) => {
    if (!resolved || isOwner || tab === 'approved') return
    if (tab === 'draft' && publicDraftCount > 0) return

    void router.replace({
      query: {
        ...route.query,
        tab: undefined,
      },
    })
  },
  { flush: 'post' },
)

const hasResolvedProfile = computed(() => profile.value !== null)
const contentState = computed(() => {
  if (!hasResolvedProfile.value && profileQuery.isFetching.value) return 'loading'
  return null
})

const showAdminReviewQueue = computed(
  () => authStore.isAdmin && isOwnerProfile.value,
)

const pendingReviewsQuery = usePendingReviewsQuery(1, 10, showAdminReviewQueue, {
  refetchIntervalMs: REVIEW_AUTO_REFRESH_INTERVAL_MS,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
})
const pendingItems = computed(() => pendingReviewsQuery.data.value?.list ?? [])
const showReviewQueueSkeleton = computed(() =>
  pendingReviewsQuery.isFetching.value && !pendingReviewsQuery.data.value,
)
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

function loadMoreArticles() {
  if (!profileQuery.hasNextPage.value || profileQuery.isFetchingNextPage.value) return
  void profileQuery.fetchNextPage()
}

onBeforeUnmount(() => {
  queryClient.removeQueries({
    queryKey: queryKeys.userProfileInfinite(username.value, activeTab.value, 10),
    exact: true,
  })
})
</script>

<template>
  <div class="min-h-[calc(100vh-var(--header-height))] md:min-h-[calc(100vh-var(--header-height-md))]">
    <main class="page-container py-8 md:py-10">
      <Transition name="content-fade" mode="out-in">
        <div
          v-if="contentState === 'loading'"
          key="profile-page-loading"
          class="grid min-h-[calc(100vh-var(--header-height)-4rem)] place-items-center md:min-h-[calc(100vh-var(--header-height-md)-5rem)]"
          role="status"
          aria-live="polite"
          aria-label="正在加载个人页"
        >
          <div class="surface-1 flex size-14 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--color-border)_80%,transparent)] text-[var(--color-text-muted)] shadow-[var(--shadow-md)]">
            <span
              class="inline-block size-5 animate-[spin_0.8s_linear_infinite] rounded-full border-2 border-current border-r-transparent"
              aria-hidden="true"
            />
          </div>
        </div>

        <div
          v-else-if="profile"
          key="profile-page-content"
          class="space-y-8 md:space-y-10"
        >
          <ProfileHeader :profile="profile" />

          <ProfileWritingCalendar :days="profile.writingCalendar" />

          <section
            v-if="showAdminReviewQueue"
            class="surface-1 rounded-[var(--radius-xl)] p-4 md:p-5"
          >
            <SectionHeader title="审核" description="" compact />

            <div class="mt-4">
              <ReviewQueueStrip
                :items="pendingItems"
                :loading="showReviewQueueSkeleton"
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

              <ProfileCardQueue
                :articles="articles"
                :public-reader-mode="!isOwnerProfile"
                :has-more="profileQuery.hasNextPage.value"
                :loading-more="profileQuery.isFetchingNextPage.value"
                @load-more="loadMoreArticles"
              />
            </div>
          </section>
        </div>
      </Transition>
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
    --profile-tabs-radius: 10px;
    position: sticky;
    top: calc(var(--header-height-md) + 1rem);
    display: block;
    isolation: isolate;
    overflow: hidden;
    border-radius: var(--profile-tabs-radius);
    padding: 0.75rem;
    background: color-mix(in srgb, var(--color-surface-glass) 74%, transparent);
  }

  .profile-content-layout__tabs::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    border-radius: calc(var(--profile-tabs-radius) - 1px);
    background:
      radial-gradient(
        circle at 50% 48%,
        color-mix(in srgb, var(--color-surface-glass-strong) 8%, transparent) 0%,
        color-mix(in srgb, var(--color-surface-glass) 16%, transparent) 34%,
        color-mix(in srgb, var(--color-surface-glass-strong) 32%, transparent) 100%
      ),
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--color-surface-glass-strong) 24%, transparent),
        color-mix(in srgb, var(--color-surface-glass) 18%, transparent)
      );
    backdrop-filter: blur(24px) saturate(168%);
    -webkit-backdrop-filter: blur(24px) saturate(168%);
    mask-image: radial-gradient(circle at 50% 50%, transparent 16%, rgb(0 0 0 / 0.34) 50%, black 100%);
    -webkit-mask-image: radial-gradient(circle at 50% 50%, transparent 16%, rgb(0 0 0 / 0.34) 50%, black 100%);
  }

  .profile-content-layout__tabs > * {
    position: relative;
    z-index: 1;
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
