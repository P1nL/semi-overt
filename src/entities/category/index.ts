// src/entities/category — 顶级 barrel
// model 层
export {
    CATEGORY_TAB,
    CATEGORY_LABEL_MAP,
    CATEGORY_DESCRIPTION_MAP,
    CATEGORY_ORDER,
} from './model/category.constants'

export type { CategoryValue } from './model/category.constants'

export {
    mapCategoryValueToVm,
    mapCategoryDtoToSectionVm,
} from './model/category.mapper'

export type {
    CategoryEntityDto,
    CategoryVm,
    CategorySectionVm,
} from './model/category.types'

// ui 层
export {
    CategoryBadge,
    CategoryChip,
} from './ui'
