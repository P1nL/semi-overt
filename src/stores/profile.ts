import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { mapUserProfilePageDtoToVm } from '@/entities/user/model/user.mapper'
import type { UserProfileVm } from '@/entities/user/model/user.types'
import type { ArticleCardVm } from '@/entities/article/model/article.types'
import { userApi } from '@/shared/api/modules/user'

export type ProfileArticleTab = 'all' | 'approved' | 'pending' | 'returned' | 'rejected' | 'draft'

export const useProfileStore = defineStore('profile', () => {
    const profile = ref<UserProfileVm | null>(null)
    const articles = ref<ArticleCardVm[]>([])
    const activeTab = ref<ProfileArticleTab>('approved')
    const loading = ref(false)
    const username = ref('')
    const page = ref(1)
    const pageSize = ref(10)
    const total = ref(0)
    const initialized = ref(false)

    const hasProfile = computed(() => Boolean(profile.value))
    const isEmpty = computed(() => initialized.value && !loading.value && articles.value.length === 0)

    function setActiveTab(tab: ProfileArticleTab) {
        activeTab.value = tab
    }

    function setProfile(nextProfile: UserProfileVm | null) {
        profile.value = nextProfile
    }

    function setArticles(nextArticles: ArticleCardVm[]) {
        articles.value = nextArticles
    }

    function resetProfileState() {
        profile.value = null
        articles.value = []
        activeTab.value = 'approved'
        loading.value = false
        username.value = ''
        page.value = 1
        pageSize.value = 10
        total.value = 0
        initialized.value = false
    }

    async function loadProfile(
        targetUsername: string,
        options: {
            tab?: ProfileArticleTab
            page?: number
            pageSize?: number
        } = {},
    ) {
        loading.value = true

        try {
            const tab = options.tab ?? activeTab.value
            const nextPage = options.page ?? page.value
            const nextPageSize = options.pageSize ?? pageSize.value

            const response = await userApi.getUserProfile(targetUsername, {
                tab,
                page: nextPage,
                pageSize: nextPageSize,
            })

            const vm = mapUserProfilePageDtoToVm(response)
            setProfile(vm)
            setArticles(vm.articles)

            activeTab.value = tab
            username.value = targetUsername
            page.value = vm.page
            pageSize.value = vm.pageSize
            total.value = vm.total
            initialized.value = true

            return vm
        } finally {
            loading.value = false
        }
    }

    return {
        profile,
        articles,
        activeTab,
        loading,
        username,
        page,
        pageSize,
        total,
        initialized,

        hasProfile,
        isEmpty,

        setActiveTab,
        setProfile,
        setArticles,
        resetProfileState,
        loadProfile,
    }
})
