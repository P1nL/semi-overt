<script setup lang="ts">
import { computed, nextTick, ref, useId, watch, type ComponentPublicInstance } from 'vue'
import { useRoute } from 'vue-router'
import { onClickOutside, useMediaQuery } from '@vueuse/core'
import { useMagneticButton } from '@/shared/composables/useMagneticButton'
import { createLiquidButtonPath, type LiquidButtonMotion } from '@/shared/utils/magneticSpring'
import { useHomeIntro, HOME_INTRO, INTRO_MOTION, progress } from '@/features/home-intro'
import { categoryIntroImpulse } from './introImpulse'

import { mapCategoryValueToVm } from '@/entities/category'
import { CATEGORY_ORDER } from '@/entities/category'
import CategoryFolderIcon from '@/shared/components/base/CategoryFolderIcon.vue'

const props = withDefaults(
    defineProps<{
      activeCategory?: string | null
    }>(),
    {
      activeCategory: null,
    },
)

const emit = defineEmits<{ 'magnetic-move': [offset: LiquidButtonMotion] }>()
const route = useRoute()
const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)')
const intro = useHomeIntro()
const introActive = computed(() => intro?.active.value ?? false)
const introTime = computed(() => intro?.time.value ?? HOME_INTRO.end)
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const magneticEnabled = computed(() => finePointer.value && !reducedMotion.value && !introActive.value)
const { offset: magneticOffset, style: magneticStyle, onPointerMove: onMagneticPointerMove, returnToRest: returnMagneticToRest } = useMagneticButton(
  rootRef, magneticEnabled, offset => emit('magnetic-move', offset),
)
const compactNavigation = useMediaQuery('(max-width: 767px)')
const launchOrigin = computed(() => {
  const home = intro?.rects.value.home, category = intro?.rects.value.category
  return home && category ? home.left + home.width / 2 - category.left - category.width / 2 : -56
})
const entryPose = computed(() => categoryIntroImpulse(introTime.value, launchOrigin.value))
const effectiveMotion = computed(() => introActive.value ? entryPose.value : magneticOffset.value)
const liquidButtonPath = computed(() => createLiquidButtonPath(compactNavigation.value ? 25 : 26.8, effectiveMotion.value))
const magneticBackgroundTransform = computed(() => introActive.value
  ? `translate(${entryPose.value.x} ${entryPose.value.y}) scale(${entryPose.value.scaleX} ${entryPose.value.scaleY})`
  : `translate(${magneticOffset.value.x} ${magneticOffset.value.y})`)
const visualStyle = computed(() => introActive.value ? {
  transform: `translateX(${entryPose.value.x}px) scale(${entryPose.value.iconScale})`,
  opacity: progress(introTime.value, HOME_INTRO.category, INTRO_MOTION.categoryFade),
} : magneticStyle.value)
watch(effectiveMotion, value => { if (introActive.value) emit('magnetic-move', value) })
const open = ref(false)
const triggerHovered = ref(false)
const triggerFocused = ref(false)
const itemRefs = ref<HTMLAnchorElement[]>([])
const instanceId = useId().replace(/:/g, '-')
const panelId = 'header-category-menu-' + instanceId
const gooFilterId = 'category-goo-' + instanceId
const nodePositions = [{ x: -54, y: 66 }, { x: 0, y: 92 }, { x: 54, y: 66 }]
function nodeStyle(index: number) {
  const point = nodePositions[index % nodePositions.length]!
  return { '--node-x': point.x + 'px', '--node-y': point.y + 'px', '--node-delay': index * 35 + 'ms' }
}
const currentCategory = computed(() => {
  if (props.activeCategory) return props.activeCategory
  if (route.name === 'category') return String(route.params.tab || '')
  return null
})

const items = computed(() =>
    CATEGORY_ORDER.map((category) => mapCategoryValueToVm(category, currentCategory.value)),
)

function getTimerIconVariant(category: string | null | undefined): 'quick' | 'short' | 'deep' {
  switch (category?.toUpperCase()) {
    case 'QUICK':
      return 'quick'
    case 'DEEP':
      return 'deep'
    case 'SHORT':
    default:
      return 'short'
  }
}

function toggleMenu() {
  open.value = !open.value
}

function setItemRef(element: Element | ComponentPublicInstance | null, index: number) {
  // Extract the DOM element if element is a Vue component instance
  const el = element && '$el' in element ? element.$el : element
  if (!(el instanceof HTMLAnchorElement)) return
  itemRefs.value[index] = el
}

function focusItem(index: number) {
  const items = itemRefs.value.filter(Boolean)
  if (!items.length) return

  const nextIndex = (index + items.length) % items.length
  items[nextIndex]?.focus()
}

async function openMenuWithKeyboard(index = 0) {
  if (!open.value) {
    open.value = true
  }

  await nextTick()
  focusItem(index)
}

function closeMenu(eventOrOptions?: PointerEvent | { restoreFocus?: boolean }) {
  open.value = false

  const restoreFocus = eventOrOptions && !(eventOrOptions instanceof Event) && eventOrOptions.restoreFocus
  if (restoreFocus) {
    void nextTick(() => {
      triggerRef.value?.focus()
      // Restoring keyboard focus must not reopen the folder after dismissal.
      triggerFocused.value = false
    })
  }
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    void openMenuWithKeyboard(0)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    void openMenuWithKeyboard(itemRefs.value.length - 1)
    return
  }

  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    closeMenu({ restoreFocus: true })
  }
}

function onPanelKeydown(event: KeyboardEvent) {
  const items = itemRefs.value.filter(Boolean)
  const currentIndex = items.findIndex((item) => item === document.activeElement)

  if (event.key === 'Escape') {
    event.preventDefault()
    closeMenu({ restoreFocus: true })
    return
  }

  if (!items.length) return

  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
    event.preventDefault()
    focusItem(currentIndex < 0 ? 0 : currentIndex + 1)
    return
  }

  if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    event.preventDefault()
    focusItem(currentIndex < 0 ? items.length - 1 : currentIndex - 1)
    return
  }

  if (event.key === 'Home') {
    event.preventDefault()
    focusItem(0)
    return
  }

  if (event.key === 'End') {
    event.preventDefault()
    focusItem(items.length - 1)
  }
}

onClickOutside(rootRef, closeMenu)
watch(() => route.fullPath, () => closeMenu())
function onFocusOut(event: FocusEvent) {
  if (event.relatedTarget instanceof Node && !rootRef.value?.contains(event.relatedTarget)) {
    closeMenu()
  }
}


watch(open, async (isOpen) => {
  returnMagneticToRest()
  if (!isOpen) {
    triggerHovered.value = false
    triggerFocused.value = false
    return
  }

  await nextTick()
  itemRefs.value = itemRefs.value.filter(Boolean)
})
</script>

<template>
  <div ref="rootRef" class="category-orbit" data-intro-anchor="category" :style="introActive ? { opacity: introTime >= HOME_INTRO.category ? 1 : 0 } : undefined" :class="{ 'is-open': open }" @focusout="onFocusOut">
    <!-- Only the colored silhouettes are filtered: labels and icons stay sharp. -->
    <svg class="category-goo" width="240" height="200" viewBox="-120 -40 240 200" aria-hidden="true" focusable="false">
      <defs>
        <filter :id="gooFilterId" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="goo" />
          <feComposite in="SourceGraphic" in2="goo" operator="over" />
        </filter>
      </defs>
      <g :filter="`url(#${gooFilterId})`">
        <path class="category-goo-main" :d="liquidButtonPath" :transform="magneticBackgroundTransform" />
        <!-- Closed-menu nodes are normally hidden under the resting button.
             Do not expose their stationary dots while the intro moves it. -->
        <template v-if="!introActive">
          <circle v-for="(item, index) in items" :key="item.value" class="category-goo-node" cx="0" cy="0" r="22" :style="nodeStyle(index)" />
        </template>
      </g>
    </svg>
    <button
      ref="triggerRef"
      type="button"
      class="category-menu-trigger"
      :aria-expanded="open"
      :aria-controls="panelId"
      aria-label="选择分类"
      aria-haspopup="true"
      @pointerenter="onMagneticPointerMove"
      @pointermove="onMagneticPointerMove"
      @pointerleave="returnMagneticToRest"
      @pointercancel="returnMagneticToRest"
      @mouseenter="triggerHovered = true"
      @mouseleave="triggerHovered = false"
      @focus="triggerFocused = triggerRef?.matches(':focus-visible') ?? false"
      @blur="triggerFocused = false"
      @click="toggleMenu"
      @keydown="onTriggerKeydown"
    >
      <span class="category-menu-trigger__visual" :style="visualStyle">
        <CategoryFolderIcon class="category-menu-trigger__icon" :active="open || triggerHovered || triggerFocused" />
      </span>
    </button>
    <nav :id="panelId" class="category-orbit-panel" :aria-hidden="!open" :inert="!open" aria-label="栏目导航" @keydown="onPanelKeydown">
      <ul class="category-orbit-list">
        <li v-for="(item, index) in items" :key="item.value" class="category-orbit-node" :style="nodeStyle(index)">
          <RouterLink
            :ref="(element) => setItemRef(element, index)"
            :to="item.path"
            :tabindex="open ? 0 : -1"
            :aria-label="item.label"
            :aria-current="item.isActive ? 'page' : undefined"
            class="category-menu-item"
            :class="{ 'is-active': item.isActive }"
            @click="closeMenu()"
          >
              <svg
                  class="category-menu-item__icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  focusable="false"
              >
                <circle cx="12" cy="12" r="10" />
                <line class="minute-hand" x1="12" y1="12" x2="12" y2="6" />
                <line class="hour-hand" x1="12" y1="12"
                    :x2="getTimerIconVariant(item.value) === 'quick' ? 16 : getTimerIconVariant(item.value) === 'short' ? 12 : 7.5"
                    :y2="getTimerIconVariant(item.value) === 'short' ? 16.5 : 12"
                />
              </svg>
            <span class="category-orbit-label">{{ item.label }}</span>
          </RouterLink>
        </li>
      </ul>
    </nav>
  </div>
</template>

<style scoped>
.category-orbit {
  position: relative;
  width: 3.35rem;
  height: 3.35rem;
  flex: none;
  isolation: isolate;
  --orbit-duration: 520ms;
  --orbit-easing: cubic-bezier(0.22, 1, 0.36, 1);
  --orbit-radius: 1.675rem;
}
/* Keep the circular hit target stationary; only its visuals follow the pointer.
   The radial links and their background circles stay in the stationary orbit. */
.category-menu-trigger:hover .category-menu-trigger__visual { will-change: transform; }
.category-goo {
  position: absolute;
  left: calc(50% - 120px);
  top: calc(50% - 40px);
  width: 240px;
  height: 200px;
  /* The fixed SVG viewport must not inherit the global media max-width: 100%. */
  max-width: none;
  max-height: none;
  overflow: visible;
  pointer-events: none;
  fill: var(--color-brand-logo-bg);
  z-index: 0;
}
.category-goo-node {
  transform: translate(0, 0) scale(0.3);
  transition: transform var(--orbit-duration) var(--orbit-easing);
  transition-delay: var(--node-delay);
}
.is-open .category-goo-node {
  transform: translate(var(--node-x), var(--node-y)) scale(1);
}
.category-menu-trigger {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--color-brand-logo-fg);
  cursor: pointer;
}
.category-menu-trigger__visual {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.category-menu-trigger__icon { position: relative; z-index: 1; }
.category-menu-trigger__icon,
.category-menu-item__icon {
  display: block;
  flex: none;
  width: 1.75rem;
  height: 1.75rem;
}
.category-orbit-panel {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  visibility: hidden;
  transition: visibility 0s linear 600ms;
}
.is-open .category-orbit-panel { visibility: visible; transition-delay: 0s; }
.category-orbit-list { margin: 0; padding: 0; list-style: none; }
.category-orbit-node {
  position: absolute;
  left: calc(50% - 22px);
  top: calc(50% - 22px);
  width: 44px;
  height: 44px;
  transform: translate(0, 0) scale(0.3);
  transition: transform var(--orbit-duration) var(--orbit-easing);
  transition-delay: var(--node-delay);
}
.is-open .category-orbit-node { transform: translate(var(--node-x), var(--node-y)) scale(1); }
.category-menu-item {
  position: relative;
  display: flex;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-brand-logo-bg);
  color: var(--color-brand-logo-fg);
  opacity: 0;
  transition: opacity 100ms ease;
  pointer-events: none;
  text-decoration: none;
}
.is-open .category-menu-item {
  opacity: 1;
  transition-delay: calc(170ms + var(--node-delay));
  pointer-events: auto;
}
.category-menu-item.is-active { box-shadow: inset 0 0 0 1.5px var(--color-brand-logo-fg); }
.category-menu-item:hover { box-shadow: none; }
.category-menu-trigger:focus-visible,
.category-menu-item:focus-visible { outline: 2px solid var(--color-brand-logo-fg); outline-offset: 3px; }
.category-orbit-label {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 11px;
  line-height: 1.4;
  color: var(--color-text);
  background: var(--color-surface);
  border-radius: var(--radius-pill);
  padding: 2px 6px;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 120ms ease, visibility 120ms ease;
}
.is-open .category-menu-item:focus-visible .category-orbit-label {
  opacity: 1;
  visibility: visible;
}
@media (hover: hover) {
  .is-open .category-menu-item:hover .category-orbit-label {
    opacity: 1;
    visibility: visible;
  }
}
.minute-hand, .hour-hand { transform-origin: 12px 12px; transition: transform 600ms ease; }
.category-menu-item:hover .minute-hand,
.category-menu-item:focus-visible .minute-hand { transform: rotate(360deg); }
.category-menu-item:hover .hour-hand,
.category-menu-item:focus-visible .hour-hand { transform: rotate(30deg); }
@media (max-width: 767px) {
  .category-orbit { width: 3.125rem; height: 3.125rem; --orbit-radius: 1.5625rem; }
}
@media (prefers-reduced-motion: reduce) {
  .category-goo-node, .category-orbit-node, .category-menu-item, .category-orbit-label,
  .category-orbit-panel, .minute-hand, .hour-hand { transition: none; }
  .is-open .category-menu-item, .is-open .category-orbit-label { transition-delay: 0s; }
}
@media (forced-colors: active) {
  .category-goo { display: none; }
  .category-menu-trigger__surface { display: none; }
  .category-menu-trigger, .category-menu-item { background: ButtonFace; color: ButtonText; border: 1px solid ButtonText; }
  .category-menu-trigger:focus-visible, .category-menu-item:focus-visible { outline-color: Highlight; }
}
</style>
