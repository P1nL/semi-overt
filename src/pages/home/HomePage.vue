<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'

import { mapArticleCardDtoToVm } from '@/entities/article/model/article.mapper'
import { mapCategoryValueToVm } from '@/entities/category/model/category.mapper'
import { useHomeQuery } from '@/shared/api/queries'
import { SectionHeader } from '@/shared/components/layout'
import { AppHeader } from '@/widgets/app-header'
import { HeroSection } from '@/widgets/hero-section'
import HomeShowcaseRail from '@/widgets/home-showcase/HomeShowcaseRail.vue'

const homeQuery = useHomeQuery()

const hiddenHomeSectionKeys = new Set(['QUICK', 'SHORT', 'DEEP'])
const contentReady = computed(() => homeQuery.isSuccess.value)

onMounted(() => {
  document.documentElement.classList.add('home-scroll-locked')
  document.body.classList.add('home-scroll-locked')
})

onBeforeUnmount(() => {
  document.documentElement.classList.remove('home-scroll-locked')
  document.body.classList.remove('home-scroll-locked')
})

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

    <main class="pt-8 pb-0 md:pt-10 md:pb-0">
      <HeroSection
        :primary="home.heroPrimary"
        :secondary="home.heroSecondary"
        :revealed="contentReady"
      />

      <div v-if="contentReady" class="home-sections space-y-8 pt-8 md:space-y-10 md:pt-10 lg:pt-0">
        <section
          v-for="(section, sectionIndex) in home.sections"
          :key="section.key"
          class="space-y-5"
        >
          <div
            class="page-container home-section-header-reveal"
            :style="{ '--home-section-delay': `${260 + sectionIndex * 120}ms` }"
          >
            <SectionHeader :title="section.title" :description="section.description" compact />
          </div>
          <HomeShowcaseRail
            :items="section.list"
            :category-label="section.title"
            :revealed="contentReady"
            :delay-base="320 + sectionIndex * 120"
          />
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
:global(html.home-scroll-locked),
:global(body.home-scroll-locked) {
  overflow: hidden;
}

.home-sections {
  position: relative;
  z-index: 1;
}

.home-section-header-reveal {
  animation: home-rise-in 680ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--home-section-delay, 0ms);
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
  .home-section-header-reveal {
    opacity: 1;
    transform: none;
    animation: none;
  }
}
</style>
