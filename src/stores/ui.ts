import type { RouteLocationRaw } from 'vue-router'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { UI_TIMING } from '@/shared/constants/ui'
import { STORAGE_KEY } from '@/shared/constants/storage'
import { localStore } from '@/shared/utils/storage'

export type DrawerType = 'menu' | 'search' | null

type DocumentWithViewTransition = Document & {
    startViewTransition?: (callback: () => void) => {
        finished: Promise<void>
    }
}

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

function prefersReducedMotion() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
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

        const doc = typeof document !== 'undefined' ? (document as DocumentWithViewTransition) : null

        if (!doc?.startViewTransition || prefersReducedMotion()) {
            markThemeSwitching()
            commitTheme()
            return
        }

        markThemeSwitching(700)
        void doc.startViewTransition(() => {
            commitTheme()
        }).finished.catch(() => {
            // Fall back silently if the browser cancels the transition.
        })
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
