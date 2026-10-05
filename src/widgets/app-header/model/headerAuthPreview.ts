import type { AuthUser } from '@/stores/auth'
import type { DraftBoxItem } from '@/features/draft-box'

/** Temporary navigation-only fixture; never create an authentication token. */
export function createHeaderPreviewUser(isDevelopment: boolean): AuthUser | null {
  if (!isDevelopment) return null
  return {
    id: -1,
    username: 'dev-preview',
    nickname: '临时用户',
    avatar: null,
    role: 'USER',
    profileLoaded: true,
  }
}

export function resolveHeaderIdentity(
  authenticated: boolean,
  realUser: AuthUser | null,
  previewUser: AuthUser | null,
) {
  const isPreview = !authenticated && previewUser !== null
  return {
    user: authenticated ? realUser : previewUser,
    isAuthenticated: authenticated || isPreview,
    isPreview,
  }
}

/** Preview rows use negative IDs and never enter the real draft store/cache. */
export function createHeaderPreviewDrafts(isDevelopment: boolean): DraftBoxItem[] | undefined {
  if (!isDevelopment) return undefined
  return [
    {
      id: -101,
      title: '给生活留一点空白',
      status: { value: 'DRAFT', label: '草稿', variant: 'default' },
      wordCount: 1260, wordCountText: '1,260 字', updatedAt: '今天 10:30',
      latestReason: null, editPath: '', sortAtRaw: '2026-10-02T10:30:00+08:00', canDelete: true,
    },
    {
      id: -102,
      title: '在城市里，寻找自己的节奏',
      status: { value: 'PENDING', label: '待审核', variant: 'info' },
      wordCount: 2380, wordCountText: '2,380 字', updatedAt: '昨天 18:20',
      latestReason: null, editPath: '', sortAtRaw: '2026-10-01T18:20:00+08:00', canDelete: false,
    },
    {
      id: -103,
      title: '让想法自由生长',
      status: { value: 'RETURNED', label: '已退回', variant: 'warning' },
      wordCount: 860, wordCountText: '860 字', updatedAt: '昨天 09:15',
      latestReason: '请补充结尾段落后再次提交。', editPath: '', sortAtRaw: '2026-10-01T09:15:00+08:00', canDelete: true,
    },
  ]
}
