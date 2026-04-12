// src/entities/article — 顶级 barrel
// model 层：常量、类型、映射函数
export {
    ARTICLE_STATUS,
    ARTICLE_DURATION_CATEGORY,
    ARTICLE_STATUS_LABEL_MAP,
    ARTICLE_DURATION_LABEL_MAP,
    ARTICLE_STATUS_BADGE_VARIANT_MAP,
    ARTICLE_DEFAULT_COVER_COLOR,
    ARTICLE_DEFAULT_TITLE,
    ARTICLE_DEFAULT_AUTHOR_NAME,
    ARTICLE_WORDS_PER_MINUTE,
} from './model/article.constants'

export type {
    ArticleStatus,
    ArticleDurationCategory,
} from './model/article.constants'

export {
    mapArticleAuthorDtoToVm,
    mapArticleCardDtoToVm,
    mapArticleDetailDtoToVm,
    mapArticleDraftDtoToVm,
    mapArticleCardListDtoToVm,
} from './model/article.mapper'

export type {
    ArticleAuthorEntityDto,
    ArticleCardEntityDto,
    ArticleDetailEntityDto,
    ArticleDraftEntityDto,
    ArticleAuthorVm,
    ArticleMetaVm,
    ArticleStatusVm,
    ArticleCoverVm,
    ArticleSummaryVm,
    ArticleCardVm,
    ArticleDetailVm,
    ArticleDraftVm,
} from './model/article.types'

// ui 层：组件
export {
    ArticleAuthorMeta,
    ArticleCard,
    ArticleCover,
    ArticleMetaLine,
    ArticleStatusBadge,
    ArticleSummary,
} from './ui'
