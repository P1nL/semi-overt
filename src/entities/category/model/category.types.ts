// src/entities/category/model/category.types.ts
import type { CategoryRespDto } from '@/shared/types/api'
import type { CategoryValue } from './category.constants'
import type { ArticleCardEntityDto, ArticleCardVm } from '@/entities/article/model/article.types'

export interface CategoryEntityDto extends Omit<CategoryRespDto, 'category' | 'list'> {
    category: CategoryValue | string
    list: ArticleCardEntityDto[]
}

export interface CategoryVm {
    value: CategoryValue | string
    label: string
    description: string
    isActive: boolean
    path: string
}

export interface CategorySectionVm {
    category: CategoryVm
    list: ArticleCardVm[]
}