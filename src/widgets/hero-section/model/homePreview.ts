import { mapArticleCardDtoToVm, type ArticleCardVm } from '@/entities/article'

// 临时首页视觉预览：仅供开发环境调用，不写入数据库。
export function createHomePreviewArticles(): ArticleCardVm[] {
  const titles = [
    '给生活留一点空白',
    '在城市里慢下来',
    '一扇没有关上的门',
    '光落在书页之间',
    '我们如何理解时间',
    '不急着给出答案',
    '日常里的微小发现',
    '从一杯咖啡开始',
    '记录那些未完成',
    '在半公开的空间相遇',
    '让想法自由生长',
  ]
  return titles.map((title, index) => ({
    ...mapArticleCardDtoToVm({
      id: -(index + 1),
      title,
      coverUrl: null,
      coverColor: null,
      summary: '临时预览文章，仅用于查看首页卡片排布与悬停效果。',
      durationCategory: ['QUICK', 'SHORT', 'DEEP'][index % 3],
      readMinutes: [2, 5, 10][index % 3],
    }),
    // 预览内容没有真实文章详情；点击行为也会在展示带中拦截。
    articlePath: '/',
  }))
}
