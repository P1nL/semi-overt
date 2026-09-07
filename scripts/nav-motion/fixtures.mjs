export const user = { id: 90001, username: 'motion-preview', nickname: '动效体验员', role: 'USER', profileLoaded: true, signature: '本地测试数据，不连接真实后端' }
export const articles = ['在雨停之后散步', '一杯咖啡的时间', '让阅读慢下来', '关于城市的留白', '水面与光', '周末写作札记'].map((title, i) => ({
  id: 91001+i, title, summary: '这是用于导航动画验收的本地样例文章。所有操作均与真实后端隔离。',
  previewText: '这是用于导航动画验收的本地样例文章。', content: '<p>本地动效测试正文。</p>',
  author: user, authorName: user.nickname, authorId: user.id, durationCategory: ['QUICK','SHORT','DEEP'][i%3],
  readMinutes: i+2, wordCount: 460+i*230, status: 'APPROVED', coverColor: '#d8e5ec',
  createdAt: '2026-09-07T09:00:00', updatedAt: '2026-09-07T10:00:00', publishedAt: '2026-09-07T10:00:00'
}))
export const drafts = articles.slice(0,4).map((article,i) => ({ ...article, id: 92001+i,
  title: ['水滴展开验收笔记', '很长的写作箱标题：验证窄屏下文字不被动画拉伸或挤出面板', '等待审核的样例', '需要补充内容的样例'][i],
  status: ['DRAFT','DRAFT','PENDING','RETURNED'][i], draftVisible: true,
  latestReason: i === 3 ? '测试退回原因：请补充说明。' : null
}))
