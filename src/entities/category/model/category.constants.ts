// src/entities/category/model/category.constants.ts
export const CATEGORY_TAB = {
    QUICK: 'QUICK',
    SHORT: 'SHORT',
    DEEP: 'DEEP',
} as const

export type CategoryValue = (typeof CATEGORY_TAB)[keyof typeof CATEGORY_TAB]

export const CATEGORY_LABEL_MAP: Record<CategoryValue, string> = {
    QUICK: '<3min',
    SHORT: '3min~8min',
    DEEP: '>8min',
}

export const CATEGORY_DESCRIPTION_MAP: Record<CategoryValue, string> = {
    QUICK: '',
    SHORT: '',
    DEEP: '',
}

export const CATEGORY_ORDER: CategoryValue[] = ['QUICK', 'SHORT', 'DEEP']
