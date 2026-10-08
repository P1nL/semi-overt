/** Loopback-only visual fixture. No request is forwarded to the real API/database. */
import http from 'node:http'

const port = Number(process.env.MOTION_FIXTURE_PORT || 5198)
const upstream = Number(process.env.MOTION_VITE_PORT || 5173)
const people = ['motion-a', 'motion-b', 'motion-slow', 'motion-spaces'].map((username, index) => ({
  id: 9101 + index, userId: 9101 + index, username, profilePath: `/u/${username}`,
  nickname: ['转场测试 · 青岚', '转场测试 · 秋野', '转场测试 · 慢速头像', 'Test User'][index],
  role: index === 0 ? 'ADMIN' : 'USER',
  avatarUrl: index === 3 ? null : `/__motion/avatar-${index}.svg${index === 2 ? '?delay=8000' : ''}`,
  coverUrl: index === 3 ? null : `/__motion/cover-${index}.svg`,
  signature: index === 3 ? '这个人很低调，还没有留下签名。' : '这是本机隔离测试数据，用于检查快速字流、乱码替换、像素头像和封面上滑。',
}))
const article = (i, owner = 0) => ({
  id: 9200 + owner * 10 + i, articleId: 9200 + owner * 10 + i, authorId: people[owner].id,
  author: people[owner], authorName: people[owner].username, authorAvatar: people[owner].avatarUrl,
  title: ['山间来信：把目光交给远处', '午后散步，沿着光的方向', '给日常留一点空白'][i % 3],
  summary: '本条内容仅用于本机转场验收。观察文字逐字出现、卡片从中心放大，以及切换时的封面与头像更新，不会写入真实数据库。',
  content: '## 转场验收\n\n隔离的本机测试文章。', coverUrl: `/__motion/cover-${(i + owner) % 3}.svg`,
  coverColor: '#0071e3', status: 'APPROVED', wordCount: 1200, readMinutes: 4, durationCategory: 'SHORT',
  publishedAt: '2026-10-08T00:00:00Z', updatedAt: '2026-10-08T00:00:00Z',
})
const page = list => ({ list, total: list.length, page: 1, pageSize: 20, pages: 1 })
function send(res, data, delay = 0) {
  setTimeout(() => { if (!res.destroyed) { res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify({ code: 200, message: 'LOCAL MOTION FIXTURE', data })) } }, delay)
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`)
  if (url.pathname.startsWith('/__motion/')) {
    const n = Number(url.pathname.match(/-(\d)/)?.[1] ?? 0)
    const color = ['#245749', '#925b39', '#456b94'][n % 3]
    const avatar = url.pathname.includes('avatar')
    const svg = avatar
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="${color}"/><circle cx="80" cy="64" r="32" fill="#e7d8b5"/><path d="M24 160v-14a56 56 0 0 1 112 0v14" fill="#e7d8b5"/><circle cx="70" cy="60" r="3"/><circle cx="91" cy="60" r="3"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="800" viewBox="0 0 1600 800"><rect width="1600" height="800" fill="${color}"/><circle cx="1150" cy="210" r="105" fill="#e7d8b5"/><path d="M0 700 420 180 820 700 1200 320 1600 660V800H0" fill="#163b37"/><path d="M0 760 450 530 900 750 1600 550V800H0" fill="#a6b9a0"/></svg>`
    setTimeout(() => { if (!res.destroyed) { res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' }); res.end(svg) } }, Number(url.searchParams.get('delay') || 0))
    return
  }
  if (url.pathname.startsWith('/api/')) {
    const path = url.pathname.replace('/api/v1', '')
    if (path === '/auth/refresh' || path === '/auth/login') return send(res, { ...people[0], token: 'local-motion-fixture-only' })
    if (req.method !== 'GET') return send(res, null)
    if (path === '/users/me') return send(res, people[0])
    if (path === '/home') return send(res, { hero: { primary: article(0), secondary: [article(1), article(2)] }, sections: [{ category: 'SHORT', list: [article(0), article(1), article(2)] }] })
    if (path === '/search/users') return send(res, { ...page(people.filter(p => `${p.username} ${p.nickname}`.includes(url.searchParams.get('keyword') || ''))), keyword: url.searchParams.get('keyword') })
    if (path === '/search') return send(res, { ...page([article(0), article(1), article(2)]), keyword: url.searchParams.get('keyword') })
    if (/^\/categories\//.test(path)) return send(res, { ...page([article(0), article(1), article(2)]), category: path.split('/')[2] })
    const profile = path.match(/^\/users\/([^/]+)\/profile$/)
    if (profile) {
      const owner = Math.max(0, people.findIndex(p => p.username === decodeURIComponent(profile[1]) || String(p.id) === profile[1]))
      const articles = [article(0, owner), article(1, owner), article(2, owner)]
      return send(res, { user: people[owner], profile: people[owner], articles, ...page(articles), stats: { approved: 3, pending: 2, returned: 0, rejected: 0, draft: 0, totalWordCount: 3600 }, writingCalendar: [{ date: '2026-10-08', wordCount: 3600 }] })
    }
    if (path === '/review/pending') return send(res, page([0, 1, 2].map(i => ({ ...article(i, 1), submitCount: 1, submittedAt: '2026-10-08T00:00:00Z' }))), 2800)
    if (/^\/articles\/\d+$/.test(path)) return send(res, article(0, 1))
    return send(res, page([]))
  }
  const proxy = http.request({ hostname: 'localhost', port: upstream, path: req.url, method: req.method, headers: { ...req.headers, host: `localhost:${upstream}` } }, response => {
    res.writeHead(response.statusCode || 502, response.headers); response.pipe(res)
  })
  proxy.on('error', () => { res.writeHead(502); res.end('Start npm run dev before this fixture.') })
  req.pipe(proxy)
})
server.listen(port, '127.0.0.1', () => console.log(`Motion fixture (synthetic data, no database): http://127.0.0.1:${port}`))
