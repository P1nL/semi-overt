async (page) => {
  const results=[]
  const errors=[]
  try {
  page.on('pageerror',error=>errors.push(error.message))
  const base='http://127.0.0.1:4178/'
  const assert=(value,message)=>{if(!value)throw new Error(message)}
  const outsideHeader = async selector => {
    const gap=await page.locator(selector).evaluate(el=>{
      const panel=el.getBoundingClientRect(),header=el.closest('[data-panel-origin-surface]').getBoundingClientRect()
      return (panel.top-header.bottom)/(panel.height/el.offsetHeight)
    })
    assert(Math.abs(gap-12)<0.6,selector+' intrudes into header or has wrong gap: '+gap)
  }
  const settle=selector=>page.waitForFunction(selector=>{
    const el=document.querySelector(selector)
    return el && !el.hasAttribute('data-liquid-progress') && !el.getAnimations().some(a=>a.playState==='running')
  },selector)
  await page.setViewportSize({width:1440,height:1000})
  await page.goto(base+'?navMotion=liquid')
  await page.bringToFront()
  await page.getByRole('button',{name:'草稿箱',exact:true}).waitFor()
  if (await page.locator('html').evaluate(el=>el.classList.contains('dark'))) {
    await page.getByRole('button',{name:'切换到浅色模式，长按进入 ZEN',exact:true}).click()
  }
  for (const [name,selector] of [['栏目','.category-menu-panel'],['打开用户菜单','.header-menu-panel'],['草稿箱','.draft-box-panel']]) {
    const sample=await page.getByRole('button',{name,exact:true}).evaluate(async (button,selector)=>{
      button.focus();button.click()
      for(let frame=0;frame<120;frame++){
        await new Promise(resolve=>requestAnimationFrame(resolve))
        const el=document.querySelector(selector)
        if(el?.querySelector('.liquid-panel-visual-surface'))return {clip:getComputedStyle(el).clipPath,animated:el.querySelector('clipPath')?.getAttribute('clipPathUnits')==='objectBoundingBox'}
      }
      return {clip:'',animated:false}
    },selector)
    assert(sample.animated,name+' missing isolated surface animation')
    assert(sample.clip==='none',name+' clips its interactive content')
    await settle(selector)
    await outsideHeader(selector)
    assert(await page.locator(selector).evaluate(el=>getComputedStyle(el).clipPath==='none'),name+' retained clipping')
    await page.keyboard.press('Escape')
    await page.locator(selector).waitFor({state:'hidden'})
    results.push(name+': contour entry, cleanup, Escape close PASS')
  }
  await page.getByRole('button',{name:'打开搜索',exact:true}).click()
  const input=page.locator('input[type="search"], input[placeholder]').first()
  await input.fill('水滴')
  await page.getByRole('listbox',{name:'搜索建议'}).waitFor()
  await settle('.search-dropdown')
  await outsideHeader('.search-dropdown')
  await page.locator('main').click({position:{x:700,y:250}})
  await page.locator('.search-dropdown').waitFor({state:'hidden'})
  results.push('search extension / outside close PASS')
  // Dispatch intentional fast toggles without Playwright waiting for visual stability.
  for (const [name,selector] of [['打开用户菜单','.header-menu-panel'],['草稿箱','.draft-box-panel']]) {
    await page.getByRole('button',{name,exact:true}).evaluate(async el=>{
      el.focus(); for(let i=0;i<7;i++){el.click();await new Promise(r=>setTimeout(r,35))}
    })
    await settle(selector)
    assert(await page.locator(selector).isVisible(),name+' rapid toggle did not end open')
    await page.keyboard.press('Escape')
    await page.locator(selector).waitFor({state:'hidden'})
    results.push(name+': 7 rapid toggles PASS')
  }
  await page.getByRole('button',{name:'打开用户菜单',exact:true}).click()
  await page.locator('.header-menu-panel').evaluate(el=>{
    el.querySelector('.liquid-panel-visual-surface').getAnimations().forEach(a=>a.finish())
    document.querySelector('[aria-controls="header-user-menu"]').click()
  })
  await page.locator('.header-menu-panel').waitFor({state:'hidden'})
  results.push('finish / close same-frame race PASS')
  await page.getByRole('button',{name:'切换到深色模式，长按进入 ZEN',exact:true}).click()
  await page.getByRole('button',{name:'草稿箱',exact:true}).click()
  await settle('.draft-box-panel')
  await page.screenshot({path:'D:/Codex/backups/semi-overt-nav-liquid-20260907-01/evidence-v3/dark-drafts.png'})
  await page.keyboard.press('Escape')
  await page.locator('.draft-box-panel').waitFor({state:'hidden'})
  results.push('dark draft panel PASS')
  await page.setViewportSize({width:390,height:844})
  for (const [name,selector] of [['栏目','.category-menu-panel'],['草稿箱','.draft-box-panel'],['打开用户菜单','.header-menu-panel']]) {
    await page.getByRole('button',{name,exact:true}).click()
    await settle(selector)
    await outsideHeader(selector)
    const box=await page.locator(selector).boundingBox()
    assert(box && box.x>=0 && box.x+box.width<=391,name+' mobile overflow')
    await page.keyboard.press('Escape')
    await page.locator(selector).waitFor({state:'hidden'})
    results.push(name+': mobile bounds PASS')
  }
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.getByRole('button',{name:'草稿箱',exact:true}).click()
  assert(await page.locator('.draft-box-panel').evaluate(el=>el.getAnimations({subtree:true}).length===0 && !el.querySelector('.liquid-panel-visual-surface')),'reduced motion still animated')
  await page.keyboard.press('Escape')
  await page.locator('.draft-box-panel').waitFor({state:'hidden'})
  results.push('reduced motion PASS')
  await page.emulateMedia({reducedMotion:'no-preference'})
  await page.setViewportSize({width:1440,height:1000})
  await page.goto(base+'?navMotion=legacy')
  await page.getByRole('button',{name:'打开用户菜单',exact:true}).click()
  assert(await page.locator('.header-menu-panel').evaluate(el=>getComputedStyle(el).clipPath==='none'),'legacy uses liquid contour')
  await settle('.header-menu-panel')
  await page.keyboard.press('Escape')
  await page.locator('.header-menu-panel').waitFor({state:'hidden'})
  results.push('legacy A/B PASS')
  // Observe actual playback (not seeked keyframes): content must never be clipped.
  await page.goto(base+'?navMotion=liquid')
  await page.bringToFront()
  await page.mouse.move(800,700)
  await page.getByRole('button',{name:'栏目',exact:true}).focus()
  await page.keyboard.press('ArrowDown')
  const observe = (closing=false) => page.locator('.category-menu-panel').evaluate((el,closing)=>new Promise(resolve=>{
    const samples=[]
    const sample=()=>{
      const p=Number(el.dataset.liquidProgress ?? (closing ? 0 : 1))
      samples.push({p,clip:getComputedStyle(el).clipPath,opacity:Number(getComputedStyle(el.querySelector('ul')).opacity)})
      if(!el.hasAttribute('data-liquid-progress'))return resolve(samples)
      requestAnimationFrame(sample)
    };sample()
  }),closing)
  const opening=await observe()
  assert(opening.length>5,'insufficient real playback samples; keep verification tab visible')
  assert(opening.every(x=>x.clip==='none' && (x.p>=.74||x.opacity===0)),'partially clipped content during entry')
  results.push('normal playback entry / complete content only PASS ('+opening.length+' frames)')
  await page.keyboard.press('Escape')
  const closing=await observe(true)
  assert(closing.every(x=>!x.clip||x.clip==='none'),'root clipping during exit')
  assert(closing.every(x=>x.p>=.74||x.opacity===0),'content visible while surface contracts')
  await page.locator('.category-menu-panel').waitFor({state:'hidden'})
  results.push('normal playback exit / content hidden before contraction PASS ('+closing.length+' frames)')
  await page.evaluate(()=>{document.body.style.zoom='1.25'})
  await page.getByRole('button',{name:'栏目',exact:true}).focus()
  await page.keyboard.press('ArrowDown')
  await settle('.category-menu-panel')
  await outsideHeader('.category-menu-panel')
  const contained=await page.locator('.category-menu-panel').evaluate(el=>{
    const p=el.getBoundingClientRect()
    return [...el.querySelectorAll('li svg')].every(icon=>{const b=icon.getBoundingClientRect();return b.left>=p.left&&b.right<=p.right&&b.top>=p.top&&b.bottom<=p.bottom})
  })
  assert(contained,'125% zoom clips category icons')
  await page.locator('.category-menu-panel').screenshot({path:'D:/Codex/backups/semi-overt-nav-liquid-20260907-01/evidence-v3/category-zoom125.png',scale:'css'})
  await page.keyboard.press('Escape')
  await page.locator('.category-menu-panel').waitFor({state:'hidden'})
  results.push('125% zoom / full category icons PASS')
  const blocked=await page.evaluate(async()=>{const r=await fetch('/api/v1/articles',{method:'POST'});return r.status})
  assert(blocked===405,'fixture write protection missing')
  results.push('fixture write protection PASS')
  assert(errors.length===0,'runtime errors: '+errors.join('; '))
  await page.goto(base+'?navMotion=liquid')
  return {results,errors}
  } catch(error) { return {results,errors,failure:String(error)} }
}
