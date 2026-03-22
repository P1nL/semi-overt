// src/entities/category/model/category.constants.ts
export const CATEGORY_TAB = {
    QUICK: 'QUICK',
    SHORT: 'SHORT',
    DEEP: 'DEEP',
} as const

export type CategoryValue = (typeof CATEGORY_TAB)[keyof typeof CATEGORY_TAB]

export const CATEGORY_LABEL_MAP: Record<CategoryValue, string> = {
    QUICK: '速读',
    SHORT: '短读',
    DEEP: '深读',
}

export const CATEGORY_DESCRIPTION_MAP: Record<CategoryValue, string> = {
    QUICK: '适合快速浏览，短时间完成阅读。',
    SHORT: '轻量阅读，适合碎片时间。',
    DEEP: '完整深入，适合专注阅读。',
}

export const CATEGORY_ORDER: CategoryValue[] = ['QUICK', 'SHORT', 'DEEP']