import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const panel = read('../src/features/draft-box/ui/DraftBoxDrawer.vue')
const item = read('../src/features/draft-box/ui/DraftListItem.vue')
const theme = read('../src/app/styles/theme.css')
test('count stays next to heading instead of pushing to the right edge', () => {
  const css = panel.match(/\.draft-count-value\s*\{([^}]+)\}/)[1]
  assert.match(css, /margin-left:\s*0/)
  assert.doesNotMatch(css, /margin-left:\s*auto/)
  assert.match(panel, /\.draft-box-panel__heading\s*\{[^}]*gap:\s*12px/)
})
test('item backgrounds are rounded for hover, keyboard focus and returned drafts', () => {
  const css = panel.match(/:deep\(\.draft-item\)\s*\{([^}]+)\}/)[1]
  assert.match(css, /border-radius:\s*var\(--radius-md\)/)
  assert.match(panel, /:deep\(\.draft-item:focus-within\)/)
  assert.match(panel, /:deep\(\.draft-item--returned\)/)
})
test('both themes share the navigation background and the new action has a contrasting palette', () => {
  assert.equal((theme.match(/--color-draft-panel-bg:\s*var\(--color-brand-logo-bg\)/g) ?? []).length, 2)
  assert.match(panel, /background:\s*var\(--color-draft-create-bg\)/)
  assert.match(panel, /color:\s*var\(--color-draft-create-fg\)/)
  assert.match(theme, /--color-draft-create-bg:\s*#e2ead9/)
  const transition = read('../src/features/draft-box/ui/DraftBungeeTransition.vue')
  assert.match(transition, /var\(--color-draft-panel-bg\)/)
})
test('only delete action remains; the main title button still opens the draft', () => {
  assert.doesNotMatch(item, /name="edit"|ariaLabel="打开文章"/)
  assert.match(item, /aria-label="删除文章"/)
  assert.match(item, /<div v-if="canDelete" ref="rail" class="draft-item-delete-track/)
  assert.match(item, /:disabled="deleting \|\| !deleteExposed"/)
  assert.match(item, /@click="emit\('delete', item\)"/)
  assert.equal((item.match(/@click="emit\('open', item\)"/g) ?? []).length, 1)
})

test('draft row animation is clipped inside a stationary layout box, not the scroller', () => {
  const list = readFileSync(new URL('../src/features/draft-box/ui/DraftList.vue', import.meta.url), 'utf8')
  const rowRule = list.match(/\.draft-list :deep\(\.animated-list__item\)\s*\{([^}]+)\}/)?.[1]
  assert.ok(rowRule)
  assert.match(rowRule, /overflow: clip;/)
  assert.match(rowRule, /transform: none;/)
  assert.match(rowRule, /transition-property: opacity;/)
  const scrollRule = list.match(/\.draft-list\s*\{([^}]+)\}/)?.[1]
  assert.match(scrollRule, /overflow-y: auto;/)
  assert.match(scrollRule, /max-height:/)
  assert.doesNotMatch(scrollRule, /overflow[^:]*: (hidden|clip);|scrollbar-width: none/)
})

test('ZEN draft icon follows theme text color rather than the solid capsule foreground', () => {
  const header = read('../src/widgets/app-header/AppHeader.vue')
  const icon = read('../src/shared/components/base/AnimatedDraftBoxIcon.vue')
  const zenRule = header.match(/\.header-shell--appreciation \.header-capsule :deep\(\.header-draft-entry \.tool-icon-button\)\s*\{([^}]+)\}/)?.[1]
  assert.ok(zenRule)
  assert.match(zenRule, /color:\s*var\(--color-text-muted\)/)
  assert.match(icon, /--lord-icon-primary:\s*currentColor/)
  assert.match(icon, /--lord-icon-secondary:\s*currentColor/)
  const textColors = [...theme.matchAll(/--color-text-muted:\s*([^;]+);/g)].map(match => match[1])
  assert.ok(new Set(textColors).size >= 2, 'light and dark text colors must differ')
})
