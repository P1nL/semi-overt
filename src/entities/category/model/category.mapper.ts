// src/entities/category/model/category.mapper.ts
import { mapArticleCardListDtoToVm } from '@/entities/article/model/article.mapper'
import type { CategoryEntityDto, CategorySectionVm, CategoryVm } from './category.types'
import { CATEGORY_DESCRIPTION_MAP, CATEGORY_LABEL_MAP } from './category.constants'

function normalizeCategory(value?: string | null): string {
    return value?.toUpperCase() || 'SHORT'
}

function normalizeActiveCategory(value?: string | null): string | null {
    return value?.trim() ? value.toUpperCase() : null
}

export function mapCategoryValueToVm(category: string, activeCategory?: string | null): CategoryVm {
    const normalized = normalizeCategory(category)
    const typed = normalized in CATEGORY_LABEL_MAP ? (normalized as keyof typeof CATEGORY_LABEL_MAP) : undefined

    return {
        value: normalized,
        label: typed ? CATEGORY_LABEL_MAP[typed] : normalized,
        description: typed ? CATEGORY_DESCRIPTION_MAP[typed] : '',
        isActive: normalizeActiveCategory(activeCategory) === normalized,
        path: `/category/${normalized}`,
    }
}

export function mapCategoryDtoToSectionVm(dto: CategoryEntityDto, activeCategory?: string | null): CategorySectionVm {
    return {
        category: mapCategoryValueToVm(dto.category, activeCategory),
        list: mapArticleCardListDtoToVm(dto.list),
    }
}
