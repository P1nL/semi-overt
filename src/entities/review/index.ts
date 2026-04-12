// src/entities/review — 顶级 barrel
// model 层
export {
    REVIEW_ACTION,
    REVIEW_ACTION_LABEL_MAP,
    REVIEW_ACTION_BADGE_VARIANT_MAP,
} from './model/review.constants'

export type { ReviewAction } from './model/review.constants'

export {
    mapPendingReviewItemDtoToVm,
    mapReviewLogDtoToVm,
    mapReviewLogListDtoToVm,
} from './model/review.mapper'

export type {
    PendingReviewItemEntityDto,
    ReviewLogEntityDto,
    PendingReviewItemVm,
    ReviewActionVm,
    ReviewLogVm,
} from './model/review.types'

// ui 层
export {
    ReviewActionTag,
    ReviewLogItem,
    ReviewLogList,
} from './ui'
