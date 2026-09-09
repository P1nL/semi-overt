import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const root = new URL('../../', import.meta.url)
const source = async p => readFile(new URL(p, root), 'utf8')
async function load(p, deps, globals = {}) {
  const exports = {}
  const code = ts.transpileModule(await source(p), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, require: n => { if (!(n in deps)) throw Error(n); return deps[n] }, ...globals })
  return exports
}
function storage() { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) } }
function locks() { let tail = Promise.resolve(); return { request: (_n,_o,fn) => { const result = tail.then(fn); tail = result.catch(() => {}); return result } } }
const response = () => ({status:200,data:{code:200,data:{token:'fresh',userId:1,username:'reader'}}})
async function runtime(store, lock, post) {
  const events = {}
  return { events, api: await load('src/shared/api/authRuntime.ts', {
    axios: {default:{post, isAxiosError: error => Boolean(error?.isAxiosError)}},
    './adapters': {normalizeAuthResp: x => ({token:x.token,user:{id:x.userId,username:x.username}})},
    '@/shared/config/env': {ENV:{apiBaseUrl:'/api/v1'}},
    '@/shared/utils/authStorage': {clearLegacyAuthStorage() {}},
  }, {window:{localStorage:store,addEventListener:(n,fn)=>events[n]=fn},navigator:{locks:lock},setTimeout,globalThis:{setTimeout}}) }
}
const pending = 'now.auth.pending-logout.v1'
test('no Web Locks: concurrent tabs fail closed without HTTP or localStorage lease', async()=>{
 const store=storage(); let calls=0; const post=async()=>{calls++;return response()}
 const a=await runtime(store,undefined,post), b=await runtime(store,undefined,post)
 const results=await Promise.allSettled([a.api.refreshAccessToken(),b.api.refreshAccessToken()])
 assert.ok(results.every(x=>x.status==='rejected')); assert.equal(calls,0)
 assert.equal(store.getItem('now.auth.refresh-lease.v1'),null)
})
test('pending logout survives offline reload, flushes before refresh, explicit login clears it',async()=>{
 const store=storage(), lock=locks(); let paths=[]
 const offline=async url=>{paths.push(url);throw Object.assign(Error('offline'),{isAxiosError:true})}
 const a=await runtime(store,lock,offline)
 await assert.rejects(a.api.logoutDevice()); assert.ok(store.getItem(pending))
 const b=await runtime(store,lock,offline)
 await assert.rejects(b.api.refreshAccessToken()); assert.ok(store.getItem(pending))
 assert.equal(paths.length,6); assert.ok(paths.every(x=>x==='/api/v1/auth/logout'))
 const c=await runtime(store,lock,async url=>{paths.push(url);return {data:{code:200}}})
 await assert.rejects(c.api.refreshAccessToken(), e=>e.kind==='cancelled')
 assert.equal(store.getItem(pending),null); assert.ok(paths.every(x=>x.endsWith('/logout')))
 c.api.beginLogout(); c.api.acceptSession({token:'explicit',user:{id:1}})
 assert.equal(store.getItem(pending),null); assert.equal(c.api.getAccessToken(),'explicit')
})
test('in-flight refresh finishes cookie mutation before logout; storage event fences stale result',async()=>{
 const store=storage(), lock=locks(); let release, started
 const ready=new Promise(r=>started=r), gate=new Promise(r=>release=r), paths=[]
 const a=await runtime(store,lock,async url=>{paths.push('refresh-start');started();await gate;paths.push('refresh-end');return response()})
 const b=await runtime(store,lock,async url=>{paths.push('logout');return {data:{code:200}}})
 const refreshed=a.api.refreshAccessToken(); const rejected=assert.rejects(refreshed,e=>e.kind==='cancelled')
 await ready
 const loggedOut=b.api.logoutDevice()
 a.events.storage({key:'now.auth.logout.v1'})
 assert.equal(a.api.getAccessToken(),null)
 release(); await rejected; await loggedOut
 assert.deepEqual(paths,['refresh-start','refresh-end','logout'])
 assert.equal(a.api.getAccessToken(),null)
})
test('successful refresh then retried API errors preserve original status/code/message',async()=>{
 for (const status of [400,403,500]) {
  let handler, refreshes=0
  class BusinessError extends Error {constructor(message,options){super(message);Object.assign(this,options)}}
  const original=new BusinessError('original '+status,{code:status,status,details:'original-details'})
  const instance={interceptors:{request:{use(){}},response:{use(_ok,err){handler=err}}},request:async()=>{throw original}}
  await load('src/shared/api/http.ts',{
    axios:{default:{create:()=>instance}},
    '@/shared/config/env':{ENV:{apiBaseUrl:'/api/v1'}},
    './authRuntime':{getAccessToken:()=>null,isAuthRefreshCancelledError:()=>false,isAuthRefreshError:()=>false,isAuthRefreshUnauthorizedError:()=>false,refreshAccessToken:async()=>{refreshes++}},
    '../types/api':{ApiBusinessError:BusinessError},'./response':{runApiSideEffects:async()=>{}},
  })
  await assert.rejects(handler({config:{url:'/protected',headers:{}},response:{status:401}}),e=>e===original)
  assert.equal(refreshes,1)
 }
})

test('logout automatically retries transient response loss but not deterministic client errors',async()=>{
 const store=storage(), lock=locks(); let calls=0
 const recovered=await runtime(store,lock,async url=>{
  calls++; assert.equal(url,'/api/v1/auth/logout')
  if(calls===1) throw Object.assign(Error('response lost'),{isAxiosError:true})
  return {data:{code:200}}
 })
 await recovered.api.logoutDevice()
 assert.equal(calls,2); assert.equal(store.getItem(pending),null)

 const store2=storage(); let clientCalls=0
 const clientError=Object.assign(Error('bad request'),{isAxiosError:true,response:{status:400,data:{code:400,message:'退出参数无效'}}})
 const rejected=await runtime(store2,lock,async()=>{clientCalls++;throw clientError})
 await assert.rejects(rejected.api.logoutDevice(),e=>e.kind==='permanent'&&e.status===400&&e.message==='退出参数无效')
 assert.equal(clientCalls,1); assert.ok(store2.getItem(pending))
})

test('successful deliberate logout is not presented as a pending failure', async()=>{
 const store=storage(), lock=locks(); const runtimeEvents=[]
 const active=await runtime(store,lock,async()=>({data:{code:200}}))
 active.api.subscribe(event=>runtimeEvents.push(event))
 await active.api.logoutDevice()
 assert.equal(store.getItem(pending),null)
 assert.deepEqual(runtimeEvents.map(event=>event.type),['remote-logout','remote-logout'])
 assert.ok(runtimeEvents.every(event=>event.type!=='logout-pending'))
})
