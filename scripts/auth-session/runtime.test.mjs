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
    axios: {default:{post, isAxiosError: () => false}},
    './adapters': {normalizeAuthResp: x => ({token:x.token,user:{id:x.userId,username:x.username}})},
    '@/shared/config/env': {ENV:{apiBaseUrl:'/api/v1'}},
    '@/shared/utils/authStorage': {clearLegacyAuthStorage() {}},
  }, {window:{localStorage:store,addEventListener:(n,fn)=>events[n]=fn},navigator:{locks:lock},setTimeout}) }
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
 const offline=async url=>{paths.push(url);throw Error('offline')}
 const a=await runtime(store,lock,offline)
 await assert.rejects(a.api.logoutDevice()); assert.ok(store.getItem(pending))
 const b=await runtime(store,lock,offline)
 await assert.rejects(b.api.refreshAccessToken()); assert.ok(store.getItem(pending))
 assert.deepEqual(paths,['/api/v1/auth/logout','/api/v1/auth/logout'])
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
