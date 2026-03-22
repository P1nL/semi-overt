import { ARTICLE_DURATION_CATEGORY } from './article'

export const CATEGORY_TAB = {
    ALL: 'all',
    QUICK: 'quick',
    SHORT: 'short',
    DEEP: 'deep',
} as const

export type CategoryTab = (typeof CATEGORY_TAB)[keyof typeof CATEGORY_TAB]

export const CATEGORY_TAB_LABEL_MAP: Record<CategoryTab, string> = {
    all: '全部',
    quick: '速读',
    short: '短读',
    deep: '深读',
}

export const CATEGORY_TAB_TO_DURATION_MAP = {
    [CATEGORY_TAB.QUICK]: ARTICLE_DURATION_CATEGORY.QUICK,
    [CATEGORY_TAB.SHORT]: ARTICLE_DURATION_CATEGORY.SHORT,
    [CATEGORY_TAB.DEEP]: ARTICLE_DURATION_CATEGORY.DEEP,
} as const

export const CATEGORY_DEFAULT_TAB = CATEGORY_TAB.ALL