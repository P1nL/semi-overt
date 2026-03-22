import { computed, ref } from 'vue'
import { UI_PAGINATION } from '@/shared/constants/ui'

export interface PaginationState {
    page: number
    pageSize: number
    total: number
}

export interface UsePaginationOptions {
    initialPage?: number
    initialPageSize?: number
    initialTotal?: number
}

export function usePagination(options: UsePaginationOptions = {}) {
    const page = ref(options.initialPage ?? UI_PAGINATION.DEFAULT_PAGE)
    const pageSize = ref(options.initialPageSize ?? UI_PAGINATION.DEFAULT_PAGE_SIZE)
    const total = ref(options.initialTotal ?? 0)

    const totalPages = computed(() => {
        if (total.value <= 0) return 1
        return Math.max(1, Math.ceil(total.value / pageSize.value))
    })

    const offset = computed(() => (page.value - 1) * pageSize.value)
    const hasPrev = computed(() => page.value > 1)
    const hasNext = computed(() => page.value < totalPages.value)

    function setPage(nextPage: number): void {
        const normalized = Math.max(1, Math.floor(nextPage || 1))
        page.value = Math.min(normalized, totalPages.value)
    }

    function setPageSize(nextPageSize: number): void {
        const normalized = Math.max(1, Math.floor(nextPageSize || UI_PAGINATION.DEFAULT_PAGE_SIZE))
        pageSize.value = normalized
        page.value = 1
    }

    function setTotal(nextTotal: number): void {
        total.value = Math.max(0, Math.floor(nextTotal || 0))
        if (page.value > totalPages.value) {
            page.value = totalPages.value
        }
    }

    function next(): void {
        if (hasNext.value) {
            page.value += 1
        }
    }

    function prev(): void {
        if (hasPrev.value) {
            page.value -= 1
        }
    }

    function reset(): void {
        page.value = options.initialPage ?? UI_PAGINATION.DEFAULT_PAGE
        pageSize.value = options.initialPageSize ?? UI_PAGINATION.DEFAULT_PAGE_SIZE
        total.value = options.initialTotal ?? 0
    }

    function toQuery() {
        return {
            page: page.value,
            pageSize: pageSize.value,
        }
    }

    return {
        page,
        pageSize,
        total,
        totalPages,
        offset,
        hasPrev,
        hasNext,
        setPage,
        setPageSize,
        setTotal,
        next,
        prev,
        reset,
        toQuery,
    }
}