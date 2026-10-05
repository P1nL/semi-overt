import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHeaderPreviewUser, createHeaderPreviewDrafts, resolveHeaderIdentity } from '../src/widgets/app-header/model/headerAuthPreview.ts'

test('production never creates a preview identity', () => {
  assert.equal(createHeaderPreviewUser(false), null)
  assert.deepEqual(resolveHeaderIdentity(false, null, createHeaderPreviewUser(false)), {
    user: null, isAuthenticated: false, isPreview: false,
  })
})
test('development fixture presents a regular user without credentials', () => {
  const user = createHeaderPreviewUser(true)
  assert.equal(user.nickname, '临时用户')
  assert.equal(user.role, 'USER')
  assert.equal('token' in user, false)
  const identity = resolveHeaderIdentity(false, null, user)
  assert.equal(identity.isAuthenticated, true)
  assert.equal(identity.isPreview, true)
  assert.equal(identity.user, user)
})
test('real sessions always take precedence over the temporary identity', () => {
  const user = { id: 42, username: 'real-user', role: 'ADMIN' }
  const identity = resolveHeaderIdentity(true, user, createHeaderPreviewUser(true))
  assert.equal(identity.user, user)
  assert.equal(identity.isPreview, false)
  assert.equal(identity.isAuthenticated, true)
  assert.equal(resolveHeaderIdentity(true, null, createHeaderPreviewUser(true)).user, null)
})
test('clearing the fixture returns the header to logged-out presentation', () => {
  assert.deepEqual(resolveHeaderIdentity(false, null, null), {
    user: null, isAuthenticated: false, isPreview: false,
  })
})

test('temporary drafts are development-only and have non-routable preview IDs', () => {
  assert.equal(createHeaderPreviewDrafts(false), undefined)
  const items = createHeaderPreviewDrafts(true)
  assert.equal(items.length, 3)
  assert.deepEqual(items.map(item => item.status.value), ['DRAFT', 'PENDING', 'RETURNED'])
  assert.ok(items.every(item => item.id < 0 && item.editPath === ''))
  assert.equal(items[1].canDelete, false)
})
