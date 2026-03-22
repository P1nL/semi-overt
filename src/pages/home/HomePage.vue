<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { mapArticleCardDtoToVm } from '@/entities/article/model/article.mapper'
import { ArticleCard } from '@/entities/article/ui'
import { mapCategoryValueToVm } from '@/entities/category/model/category.mapper'
import { categoryApi } from '@/shared/api/modules/category'
import { SectionHeader } from '@/shared/components/layout'
import { ROUTE_NAME } from '@/shared/constants/routes'
import { useUiStore } from '@/stores/ui'
import { AppHeader } from '@/widgets/app-header'
import { HeroSection } from '@/widgets/hero-section'

const router = useRouter()
const uiStore = useUiStore()

const loading = ref(false)
const contentReady = ref(false)
const hiddenHomeSectionKeys = new Set(['QUICK', 'SHORT', 'DEEP'])
const home = ref<{
  heroPrimary: ReturnType<typeof mapArticleCardDtoToVm> | null
  heroSecondary: ReturnType<typeof mapArticleCardDtoToVm>[]
  sections: Array<{
    key: string
    title: string
    description: string
    list: ReturnType<typeof mapArticleCardDtoToVm>[]
  }>
}>({
  heroPrimary: null,
  heroSecondary: [],
  sections: [],
})

const keyword = computed({
  get: () => uiStore.searchQuery,
  set: (value: string) => uiStore.setSearchQuery(value),
})

async function loadHome() {
  loading.value = true

  try {
    const response = await categoryApi.getHomeContent()

    home.value.heroPrimary = response.hero.primary ? mapArticleCardDtoToVm(response.hero.primary) : null
    home.value.heroSecondary = response.hero.secondary.map((item) => mapArticleCardDtoToVm(item))
    home.value.sections = response.sections
      .filter((section) => !hiddenHomeSectionKeys.has(section.category.toUpperCase()))
      .map((section) => {
        const category = mapCategoryValueToVm(section.category, null)

        return {
          key: section.category,
          title: category.label,
          description: category.description,
          list: section.list.map((item) => mapArticleCardDtoToVm(item)),
        }
      })

    contentReady.value = true
  } finally {
    loading.value = false
  }
}

async function onSearch(query: string) {
  const normalized = query.trim()
  if (!normalized) return

  uiStore.setSearchQuery(normalized)
  await router.push({
    name: ROUTE_NAME.SEARCH,
    query: { keyword: normalized },
  })
}

void loadHome()
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="page-container space-y-8 py-8 md:space-y-10 md:py-10">
      <HeroSection
        :primary="home.heroPrimary"
        :secondary="home.heroSecondary"
        :revealed="contentReady"
        :keyword="keyword"
        :searching="loading"
        @update:keyword="keyword = $event"
        @search="onSearch"
      />

      <div v-if="contentReady" class="space-y-8 md:space-y-10">
        <section
          v-for="(section, sectionIndex) in home.sections"
          :key="section.key"
          class="home-section-reveal space-y-5"
          :style="{ '--home-section-delay': `${260 + sectionIndex * 120}ms` }"
        >
          <SectionHeader :title="section.title" :description="section.description" compact />
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div
              v-for="(item, itemIndex) in section.list"
              :key="item.id"
              class="home-card-reveal"
              :style="{ '--home-card-delay': `${320 + sectionIndex * 120 + itemIndex * 55}ms` }"
            >
              <ArticleCard
                :article="item"
                :show-reason="false"
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
.home-section-reveal {
  animation: home-rise-in 680ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--home-section-delay, 0ms);
}

.home-card-reveal {
  opacity: 0;
  animation: home-rise-in 620ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--home-card-delay, 0ms);
}

@keyframes home-rise-in {
  0% {
    opacity: 0;
    transform: translateY(26px);
  }

  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
