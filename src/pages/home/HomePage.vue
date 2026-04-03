<script setup lang="ts">
import { computed } from 'vue'

import { mapArticleCardDtoToVm } from '@/entities/article/model/article.mapper'
import { ArticleCard } from '@/entities/article/ui'
import { mapCategoryValueToVm } from '@/entities/category/model/category.mapper'
import { useHomeQuery } from '@/shared/api/queries'
import { SectionHeader } from '@/shared/components/layout'
import { AppHeader } from '@/widgets/app-header'
import { HeroSection } from '@/widgets/hero-section'

const homeQuery = useHomeQuery()

const hiddenHomeSectionKeys = new Set(['QUICK', 'SHORT', 'DEEP'])
const contentReady = computed(() => homeQuery.isSuccess.value)
const home = computed(() => {
  const response = homeQuery.data.value

  if (!response) {
    return {
      heroPrimary: null,
      heroSecondary: [],
      sections: [],
    }
  }

  return {
    heroPrimary: response.hero.primary ? mapArticleCardDtoToVm(response.hero.primary) : null,
    heroSecondary: response.hero.secondary.map((item) => mapArticleCardDtoToVm(item)),
    sections: response.sections
      .filter((section) => !hiddenHomeSectionKeys.has(section.category.toUpperCase()))
      .map((section) => {
        const category = mapCategoryValueToVm(section.category, null)

        return {
          key: section.category,
          title: category.label,
          description: category.description,
          list: section.list.map((item) => mapArticleCardDtoToVm(item)),
        }
      }),
  }
})
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="page-container space-y-8 py-8 md:space-y-10 md:py-10">
      <HeroSection
        :primary="home.heroPrimary"
        :secondary="home.heroSecondary"
        :revealed="contentReady"
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

@media (prefers-reduced-motion: reduce) {
  .home-section-reveal,
  .home-card-reveal {
    opacity: 1;
    transform: none;
    animation: none;
  }
}
</style>
