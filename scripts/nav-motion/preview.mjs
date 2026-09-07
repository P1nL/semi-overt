import { createServer } from 'vite'
import { user, articles, drafts } from './fixtures.mjs'

// Separate loopback-only origin. Intercept every API request; no backend fallback.
const fixturePlugin = {
  name: 'local-navigation-motion-fixtures',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = new URL(req.url, 'http://127.0.0.1')
      if (!url.pathname.startsWith('/api/')) return next()
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      if (req.method !== 'GET') {
        res.statusCode=405
        return res.end(JSON.stringify({code:405,message:'本地动效预览禁止写操作，未连接真实后端。',data:null}))
      }
      const p=url.pathname, list=articles, page={list,total:list.length,page:1,pageSize:20,pages:1}
      let data
      if(p.endsWith('/users/me')) data=user
      else if(p.endsWith('/articles/drafts')) data=drafts
      else if(p.includes('/home')) data={hero:{primary:list[0],secondary:list.slice(1,3)},sections:['QUICK','SHORT','DEEP'].map(category=>({category,list:list.filter(a=>a.durationCategory===category)}))}
      else if(p.includes('/categories/')) data={...page,category:p.split('/')[4]}
      else if(p.includes('/search/users')) data={...page,list:[user],total:1,keyword:url.searchParams.get('keyword')||''}
      else if(p.includes('/search')) data={...page,keyword:url.searchParams.get('keyword')||''}
      else if(p.endsWith('/profile')) data={...page,user,articles:list,stats:{approved:6,draft:2,pending:1,returned:1}}
      else if(/\/articles\/\d+$/.test(p)) data=[...list,...drafts].find(a=>String(a.id)===p.split('/').pop())||list[0]
      else {res.statusCode=404;return res.end(JSON.stringify({code:404,message:'未提供此接口的本地测试数据：'+p,data:null}))}
      res.end(JSON.stringify({code:200,message:'local fixture',data}))
    })
  },
  transformIndexHtml() {
    return [{tag:'script',injectTo:'head-prepend',children:
      'sessionStorage.setItem("now.token","local-motion-preview-not-a-real-token");sessionStorage.setItem("now.authUser",'+JSON.stringify(JSON.stringify(user))+');'
    },{tag:'script',injectTo:'body',children:
      `const bar=document.createElement('div');bar.style.cssText='position:fixed;bottom:12px;left:12px;z-index:9999;padding:10px 14px;border-radius:14px;background:#17212eee;color:white;font:13px system-ui;display:flex;gap:14px;align-items:center;box-shadow:0 3px 18px #0002';bar.innerHTML='<span>本地假数据 · 禁止写入</span><a style="color:#b9dcff" href="/?navMotion=liquid">水滴</a><a style="color:#b9dcff" href="/?navMotion=legacy">原版</a><a style="color:#b9dcff" href="/?navMotion=liquid&motionSpeed=slow">慢放</a>';document.body.append(bar);`
    }]
  }
}
const server=await createServer({server:{host:'127.0.0.1',port:4178,strictPort:true,proxy:{}},plugins:[fixturePlugin]})
await server.listen()
server.printUrls()
