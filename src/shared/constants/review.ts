// src/shared/constants/review.ts
// 业务域常量统一由 entities/review 层维护，此处 re-export 保持向后兼容
export { REVIEW_ACTION } from '@/entities/review'

// shared 层独有的约束配置
export const REVIEW_REASON_MAX_LENGTH = 500
