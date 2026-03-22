<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { ArticleCard } from '@/entities/article/ui'
import { EmptyState } from '@/shared/components/base'
import { SectionHeader } from '@/shared/components/layout'
import { getErrorMessage } from '@/shared/utils/error'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore, type ProfileArticleTab } from '@/stores/profile'
import { useReviewStore } from '@/stores/review'
import { AppHeader } from '@/widgets/app-header'
import { ProfileHeader } from '@/widgets/profile-header'
import { ProfileTabs } from '@/widgets/profile-tabs'
import { ReviewQueueStrip } from '@/widgets/review-queue-strip'

const route = useRoute()
const authStore = useAuthStore()
const profileStore = useProfileStore()
const reviewStore = useReviewStore()

const pageError = ref('')
const reviewQueueError = ref('')
const username = computed(() => String(route.params.username || '').trim())

const tabCounts = computed(() => {
  const stats = profileStore.profile?.stats || []
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

const contentState = computed(() => {
  if (profileStore.loading) return 'loading'
  if (profileStore.articles.length) return 'content'
  return 'empty'
})

const isOwnerProfile = computed(
  () => authStore.user?.username === profileStore.profile?.username,
)

const showAdminReviewQueue = computed(
  () => authStore.isAdmin && isOwnerProfile.value,
)

async function loadProfile(tab?: ProfileArticleTab) {
  if (!username.value) return

  pageError.value = ''

  try {
    await profileStore.loadProfile(username.value, {
      tab: tab ?? profileStore.activeTab,
    })
  } catch (error) {
    pageError.value = getErrorMessage(error, '个人主页加载失败，请稍后重试。')
  }
}

async function loadPendingQueue() {
  if (!showAdminReviewQueue.value) return

  reviewQueueError.value = ''

  try {
    await reviewStore.loadPendingList()
  } catch {
    reviewQueueError.value = '待审核列表加载失败，请稍后重试。'
  }
}

async function onTabChange(tab: ProfileArticleTab) {
  profileStore.setActiveTab(tab)
  await loadProfile(tab)
}

watch(
  showAdminReviewQueue,
  (visible) => {
    if (!visible) return
    void loadPendingQueue()
  },
  { immediate: true },
)

if (username.value) {
  profileStore.resetProfileState()
  void loadProfile('approved')
}
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="page-container space-y-8 py-8 md:space-y-10 md:py-10">
      <ProfileHeader
        v-if="profileStore.profile"
        :profile="profileStore.profile"
      />

      <section
        v-if="showAdminReviewQueue"
        class="surface-1 rounded-[var(--radius-xl)] p-4 md:p-5"
      >
        <SectionHeader title="待审核文章" description="仅管理员可见，点击卡片可直接进入审核。" compact>
          <template v-if="false" #actions>
            <Button
              type="button"
              variant="secondary"
              pill
              size="sm"
              :loading="reviewStore.loading"
              @click="loadPendingQueue"
            >
              刷新
            </Button>
          </template>
        </SectionHeader>

        <div class="mt-4">
          <ReviewQueueStrip :items="reviewStore.pendingList" :loading="reviewStore.loading" />
        </div>

        <p
          v-if="!reviewStore.loading && reviewQueueError"
          class="mt-3 text-sm text-[var(--color-danger)]"
        >
          {{ reviewQueueError }}
        </p>
      </section>

      <section class="surface-1 rounded-[var(--radius-xl)] p-4 md:p-5">
        <ProfileTabs
          v-model="profileStore.activeTab"
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
          class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          <div
            v-for="(item, index) in profileStore.articles"
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
