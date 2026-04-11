import type { RouteLocationRaw } from 'vue-router'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { UI_TIMING } from '@/shared/constants/ui'
import { STORAGE_KEY } from '@/shared/constants/storage'
import { localStore } from '@/shared/utils/storage'

export type DrawerType = 'menu' | 'search' | null

function readDarkModeFromStorage() {
    return localStore?.get<boolean>(STORAGE_KEY.DARK_MODE, false) ?? false
}

function writeDarkModeToStorage(enabled: boolean) {
    localStore?.set(STORAGE_KEY.DARK_MODE, enabled)
}

function readSearchQueryFromStorage() {
    return localStore?.get<string>(STORAGE_KEY.SEARCH_QUERY, '') ?? ''
}

function writeSearchQueryToStorage(value: string) {
    localStore?.set(STORAGE_KEY.SEARCH_QUERY, value)
}

function applyDarkMode(enabled: boolean) {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle('dark', enabled)
}

function markThemeSwitching(duration = 620) {
    if (typeof document === 'undefined' || typeof window === 'undefined') return

    const root = document.documentElement
    root.classList.add('theme-switching')

    window.clearTimeout((root as typeof root & { __themeSwitchTimer?: number }).__themeSwitchTimer)
    ;(root as typeof root & { __themeSwitchTimer?: number }).__themeSwitchTimer = window.setTimeout(() => {
        root.classList.remove('theme-switching')
    }, duration)
}

export const useUiStore = defineStore('ui', () => {
    const drawerOpen = ref(false)
    const drawerType = ref<DrawerType>(null)
    const pendingRoute = ref<RouteLocationRaw | null>(null)
    const isDrawerClosing = ref(false)
    const suppressNextPageTransition = ref(false)

    const darkMode = ref(readDarkModeFromStorage())
    const searchQuery = ref(readSearchQueryFromStorage())

    const isMenuDrawer = computed(() => drawerType.value === 'menu')
    const isSearchDrawer = computed(() => drawerType.value === 'search')
    const hasSearchQuery = computed(() => Boolean(searchQuery.value.trim()))
    const hasPendingRoute = computed(() => pendingRoute.value !== null)

    function openDrawer(type: Exclude<DrawerType, null> = 'menu') {
        drawerType.value = type
        isDrawerClosing.value = false
        drawerOpen.value = true
    }

    function closeDrawer() {
        if (!drawerOpen.value) return
        isDrawerClosing.value = true
        drawerOpen.value = false
    }

    function finishDrawerClosing() {
        isDrawerClosing.value = false
        drawerType.value = null
    }

    function toggleDrawer(type: Exclude<DrawerType, null> = 'menu') {
        if (drawerOpen.value && drawerType.value === type) {
            closeDrawer()
            return
        }
        openDrawer(type)
    }

    function setPendingRoute(route: RouteLocationRaw | null) {
        pendingRoute.value = route
    }

    function clearPendingRoute() {
        pendingRoute.value = null
    }

    function skipNextPageTransition(duration = UI_TIMING.DRAWER_LEAVE + UI_TIMING.MICRO) {
        suppressNextPageTransition.value = true

        if (typeof window !== 'undefined') {
            window.setTimeout(() => {
                suppressNextPageTransition.value = false
            }, duration)
        }
    }

    function clearNextPageTransitionSuppression() {
        suppressNextPageTransition.value = false
    }

    function setSearchQuery(value: string) {
        searchQuery.value = value
        writeSearchQueryToStorage(value)
    }

    function clearSearchQuery() {
        setSearchQuery('')
    }

    function setDarkMode(enabled: boolean) {
        if (darkMode.value === enabled) return

        const commitTheme = () => {
            darkMode.value = enabled
            writeDarkModeToStorage(enabled)
            applyDarkMode(enabled)
        }

        // 不使用 View Transition API：
        // 页面包含 filter:blur、isolation:isolate、复杂合成层的卡片，
        // startViewTransition 截图时部分区域无法正确光栅化，导致闪白/缺失。
        // 已有的 CSS transition 体系（theme-switching class + 540ms 过渡 +
        // #app::before/::after 背景交叉淡入）足以提供平滑的主题切换效果。
        markThemeSwitching()
        commitTheme()
    }

    function toggleDarkMode() {
        setDarkMode(!darkMode.value)
    }

    function initializeUiPreferences() {
        applyDarkMode(darkMode.value)
    }

    function resetUiState() {
        drawerOpen.value = false
        drawerType.value = null
        pendingRoute.value = null
        isDrawerClosing.value = false
        suppressNextPageTransition.value = false
        searchQuery.value = readSearchQueryFromStorage()
        darkMode.value = readDarkModeFromStorage()
        applyDarkMode(darkMode.value)
    }

    return {
        drawerOpen,
        drawerType,
        pendingRoute,
        isDrawerClosing,
        suppressNextPageTransition,
        darkMode,
        searchQuery,

        isMenuDrawer,
        isSearchDrawer,
        hasSearchQuery,
        hasPendingRoute,

        openDrawer,
        closeDrawer,
        finishDrawerClosing,
        toggleDrawer,

        setPendingRoute,
        clearPendingRoute,
        skipNextPageTransition,
        clearNextPageTransitionSuppression,

        setSearchQuery,
        clearSearchQuery,

        setDarkMode,
        toggleDarkMode,
        initializeUiPreferences,
        resetUiState,
    }
})
