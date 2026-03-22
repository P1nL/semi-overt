import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { pinia } from '@/app/providers/pinia'
import { mapPendingReviewItemDtoToVm, mapReviewLogListDtoToVm } from '@/entities/review/model/review.mapper'
import type { PendingReviewItemVm, ReviewLogVm } from '@/entities/review/model/review.types'
import { reviewApi } from '@/shared/api/modules/review'
import { useAuthStore } from '@/stores/auth'

export const useReviewStore = defineStore('review', () => {
    const authStore = useAuthStore(pinia)
    const pendingList = ref<PendingReviewItemVm[]>([])
    const reviewLogs = ref<ReviewLogVm[]>([])
    const loading = ref(false)
    const acting = ref(false)
    const logsLoading = ref(false)
    const initialized = ref(false)
    const lastLoadedAt = ref('')

    const pendingCount = computed(() => pendingList.value.length)
    const hasPending = computed(() => pendingCount.value > 0)

    function setPendingList(nextList: PendingReviewItemVm[]) {
        pendingList.value = nextList
    }

    function setReviewLogs(nextLogs: ReviewLogVm[]) {
        reviewLogs.value = nextLogs
    }

    function removePendingByArticleId(articleId: number | string) {
        pendingList.value = pendingList.value.filter(
            (item) => String(item.id) !== String(articleId),
        )
    }

    function resetReviewState() {
        pendingList.value = []
        reviewLogs.value = []
        loading.value = false
        acting.value = false
        logsLoading.value = false
        initialized.value = false
        lastLoadedAt.value = ''
    }

    async function loadPendingList() {
        if (!authStore.isAdmin) {
            resetReviewState()
            return pendingList.value
        }

        loading.value = true
        try {
            const response = await reviewApi.getPendingReviews()
            pendingList.value = response.list.map(mapPendingReviewItemDtoToVm)
            initialized.value = true
            lastLoadedAt.value = new Date().toISOString()
            return pendingList.value
        } finally {
            loading.value = false
        }
    }

    async function refreshPendingListIfInitialized() {
        if (!authStore.isAdmin || !initialized.value) {
            return pendingList.value
        }

        return loadPendingList()
    }

    async function loadReviewLogs(articleId: number | string) {
        logsLoading.value = true
        try {
            const response = await reviewApi.getReviewLogs(articleId)
            reviewLogs.value = mapReviewLogListDtoToVm(response)
            return reviewLogs.value
        } finally {
            logsLoading.value = false
        }
    }

    return {
        pendingList,
        reviewLogs,
        loading,
        acting,
        logsLoading,
        initialized,
        lastLoadedAt,

        pendingCount,
        hasPending,

        setPendingList,
        setReviewLogs,
        removePendingByArticleId,
        resetReviewState,
        loadPendingList,
        refreshPendingListIfInitialized,
        loadReviewLogs,
    }
})
