<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ArticleCardVm } from '@/entities/article'
import { AnimatedArticleList } from '@/widgets/animated-article-list'
import { ArticleInfiniteMenu } from '@/widgets/article-infinite-menu'
import { motionTimer } from '@/shared/utils/motionClock'
import { usePageMotion } from '@/shared/composables/usePageMotion'
import ResultViewToggle from './ResultViewToggle.vue'
import { type ResultViewMode } from './result-view'
import { VIEW_SWITCH_DURATION, viewSwitchPose, type ViewPose } from './view-motion'

const props = withDefaults(defineProps<{
  items: ArticleCardVm[]; view: ResultViewMode; fullscreen?: boolean
  centerLabel?: string; resultCount?: number; showViewToggle?: boolean
}>(), { fullscreen: false, centerLabel: '', resultCount: 0, showViewToggle: true })
const emit = defineEmits<{ 'update:view': [value: ResultViewMode]; 'layout:view': [value: ResultViewMode] }>()
const stage = ref<HTMLElement | null>(null)
const infinitePanel = ref<HTMLElement | null>(null)
const listPanel = ref<HTMLElement | null>(null)
const menu = ref<InstanceType<typeof ArticleInfiniteMenu> | null>(null)
const settled = ref(props.view)
const switching = ref(false)
const preparing = ref(false)
const mountedInfinite = ref(props.view === 'infinite')
const mountedList = ref(props.view === 'list')
const stageHeight = ref<number>()
const showInfinite = computed(() => settled.value === 'infinite' || switching.value)
const showList = computed(() => settled.value === 'list' || switching.value)
let pose: ViewPose = props.view === 'infinite'
  ? { press: 0, infiniteOpacity: 1, infiniteScale: 1, listX: 1 }
  : { press: 1, infiniteOpacity: 0, infiniteScale: .88, listX: 0 }
let generation = 0
let cancel: (() => void) | undefined
let releaseReady: (() => void) | undefined
let media: MediaQueryList | undefined
function stop() { cancel?.(); cancel = undefined; releaseReady?.(); releaseReady = undefined }
function paint(next: ViewPose) {
  pose = next
  if (infinitePanel.value) {
    infinitePanel.value.style.opacity = String(next.infiniteOpacity)
    infinitePanel.value.style.transform = `scale(${next.infiniteScale})`
  }
  if (listPanel.value) listPanel.value.style.transform = `translateX(${next.listX * (stage.value?.clientWidth ?? innerWidth)}px)`
  menu.value?.setViewPress(next.press)
}
function finish(target: ResultViewMode) {
  paint(target === 'list' ? { press: 1, infiniteOpacity: 0, infiniteScale: .88, listX: 0 } : { press: 0, infiniteOpacity: 1, infiniteScale: 1, listX: -1 })
  settled.value = target
  switching.value = false
  preparing.value = false
  stageHeight.value = undefined
  menu.value?.setViewPress(null)
  infinitePanel.value?.style.removeProperty('transform')
  listPanel.value?.style.removeProperty('transform')
  emit('layout:view', target)
}
watch(() => props.view, async target => {
  const token = ++generation
  stop()
  if (preparing.value && target === settled.value) { finish(target); return }
  if (!switching.value && target === settled.value) return
  const returningInfinite = !showInfinite.value
  if (!showList.value) pose.listX = 1
  if (!showInfinite.value) { pose.press = 1; pose.infiniteOpacity = 0; pose.infiniteScale = .88 }
  const oldHeight = stage.value?.getBoundingClientRect().height ?? 0
  stageHeight.value = oldHeight
  mountedInfinite.value = true; mountedList.value = true
  preparing.value = true; switching.value = true
  await nextTick()
  if (token !== generation) return
  if (returningInfinite) menu.value?.setViewPress(1, true)
  stageHeight.value = Math.max(oldHeight, listPanel.value?.scrollHeight ?? 0, innerHeight - (stage.value?.getBoundingClientRect().top ?? 0))
  paint({ ...pose })
  const start = () => {
    if (token !== generation) return
    preparing.value = false
    if (media?.matches) { finish(target); return }
    const from = { ...pose }
    cancel = motionTimer(VIEW_SWITCH_DURATION[target], time => paint(viewSwitchPose(target, time, from)), () => {
      if (token === generation) finish(target)
    })
  }
  releaseReady = menu.value?.whenReady(start)
  if (!menu.value) start()
}, { flush: 'post' })
const pageMotion = usePageMotion()
if (pageMotion) watch(pageMotion.phase, phase => {
  if (phase === 'leave' && switching.value) { generation++; stop(); finish(props.view) }
})
const mediaChanged = () => { if (media?.matches && switching.value) { generation++; stop(); finish(props.view) } }
onMounted(() => { media = matchMedia('(prefers-reduced-motion: reduce)'); media.addEventListener('change', mediaChanged) })
onBeforeUnmount(() => { generation++; stop(); media?.removeEventListener('change', mediaChanged) })
</script>

<template>
  <section class="article-result-stream" :data-result-view="view" :data-view-switch="switching ? view : undefined">
    <div v-if="showViewToggle" class="article-result-stream__view-toggle">
      <ResultViewToggle :model-value="view" @update:model-value="emit('update:view', $event)" />
    </div>
    <div ref="stage" class="article-result-stream__stage" :style="{ height: stageHeight === undefined ? undefined : `${stageHeight}px` }">
      <div v-show="showInfinite" ref="infinitePanel" class="article-result-stream__panel article-result-stream__panel--infinite"
        :class="{ 'article-result-stream__panel--flow': !switching && settled === 'infinite', 'article-result-stream__panel--preparing': preparing && settled !== 'infinite' }"
        :inert="switching || !showInfinite" :aria-hidden="!showInfinite || undefined">
        <ArticleInfiniteMenu v-if="mountedInfinite" ref="menu" :items="items" :fullscreen="fullscreen" :center-label="centerLabel" :result-count="resultCount" :active="showInfinite" />
      </div>
      <div v-show="showList" ref="listPanel" class="article-result-stream__panel article-result-stream__panel--list"
        :class="{ 'article-result-stream__panel--flow': !switching && settled === 'list', 'article-result-stream__panel--preparing': preparing && settled !== 'list' }"
        :inert="switching || !showList" :aria-hidden="!showList || undefined">
        <div v-if="mountedList" class="article-result-stream__list-content" data-page-motion="result-list">
          <slot name="list-header" />
          <AnimatedArticleList :items="items" />
          <!-- <slot name="list-footer" /> -->
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.article-result-stream { position: relative; display: flex; flex-direction: column; min-width: 0; overflow: visible; }
.article-result-stream__view-toggle { position: absolute; top: 1.25rem; right: 0; z-index: 20; }
.article-result-stream__stage { position: relative; width: 100vw; margin-left: calc(50% - 50vw); }
.article-result-stream__panel { position: absolute; inset: 0; display: flow-root; min-width: 0; width: 100%; }
.article-result-stream__panel--flow { position: relative; }
.article-result-stream__panel--infinite { transform-origin: 50% 40%; }
.article-result-stream__panel--preparing { visibility: hidden; }
.article-result-stream__list-content { width: min(100% - 1.5rem, 1200px); margin-inline: auto; padding-block: 4.25rem 2.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
.article-result-stream[data-view-switch] .article-result-stream__panel { will-change: transform, opacity; pointer-events: none; }
.article-result-stream[data-view-switch] :deep(.animated-article-list-item) { opacity: 1; filter: none; transform: none; transition: none; }
@media (max-width: 640px) { .article-result-stream__view-toggle { top: .85rem; right: .25rem; } }
</style>
