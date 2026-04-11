# AGENTS.md

## Commands

```sh
npm run dev           # Vite dev server (proxies /api and /static → localhost:8080)
npm run build         # Type-check via vue-tsc, then Vite production build
npm run preview       # Serve the dist/ output locally
npm run generate:api  # Generate TS types from OpenAPI specs (see API codegen below)
```

No test runner is configured. No lint script exists in `package.json`.  
Type-check is embedded in `build`; run `npx vue-tsc --noEmit` to type-check without building.

---

## Architecture — Feature-Sliced Design (FSD)

`src/` uses a strict FSD layering. Dependency direction is **top → bottom only**:

```
pages → widgets → features → entities → shared
                                    ↘ stores (cross-cutting)
app  (bootstrap only, never imported by other layers)
```

| Layer | Purpose |
|---|---|
| `app/` | Bootstrap: `main.ts`, `App.vue`, router, providers, global styles |
| `pages/` | Route-level components — compose widgets/features/entities, handle load/error/empty states |
| `widgets/` | Large self-contained UI regions reused across pages (header, reader, profile sections) |
| `features/` | One user action per feature (login, edit, submit-review, cancel-review, etc.) |
| `entities/` | Domain models + minimal display units: `article`, `category`, `review`, `user` |
| `shared/` | Infrastructure only — API, base components, utils, composables, constants, config |
| `stores/` | Pinia stores for cross-page state: `auth`, `session`, `ui`, `editor`, `draft`, `profile`, `review` |

**Do not** put business logic in `pages/`. Pages only orchestrate; logic lives in feature `model/` or entity `model/`.

---

## Key Conventions

### Barrel exports
Every feature/entity/widget exposes an `index.ts` barrel. Always import from the barrel, not from internal paths:
```ts
// correct
import { ArticleCard } from '@/entities/article'
// wrong
import ArticleCard from '@/entities/article/ui/ArticleCard.vue'
```

### `model/` vs `ui/` inside features and entities
- `model/` — pure logic, types, mappers, validation, DTO↔VM conversion
- `ui/` — Vue components only

### DTO → VM mapping
Never use raw API DTOs in templates. Always run through the entity mapper:
- `entities/article/model/article.mapper.ts`
- `entities/review/model/review.mapper.ts`
- `entities/user/model/user.mapper.ts`
- `entities/category/model/category.mapper.ts`

`shared/api/adapters.ts` normalises raw backend responses *before* mappers run.

### Path alias
`@` resolves to `src/`. Use it for all cross-directory imports.

---

## Routing

Route meta fields (all optional):

| Field | Type | Effect |
|---|---|---|
| `requiresAuth` | boolean | Redirect to `/login?redirect=...` if unauthenticated |
| `publicOnly` | boolean | Redirect authenticated users away (login/register pages) |
| `roles` | `('USER'\|'ADMIN')[]` | Redirect to `/forbidden` if role doesn't match |
| `presentation` | `'sheet'` | Render inside `PageSheet` overlay, not full-page navigation |
| `sheetVariant` | `'default'\|'full'` | Sheet size |
| `sheetInset` | `'default'\|'article'` | Sheet inset style |
| `drawerAware` | boolean | If `false`, skips drawer-close guard on navigation |

**Sheet routing**: `/articles/:id` and review sheet routes render as `PageSheet` (overlay on top of the previous page). `App.vue` manages which route is the "background" page and which is the sheet.

**Drawer close guard**: If `uiStore.drawerOpen` is true, any navigation is deferred until the drawer finishes closing. Don't bypass this by calling `router.push` directly from within a drawer without closing it first.

---

## API Layer

### Base URL
Default: `/api/v1` (proxied to `http://localhost:8080` in dev via `vite.config.ts`).  
Override with `VITE_API_BASE_URL` env var.

### Request flow
```
shared/api/modules/*.ts  →  shared/api/request.ts  →  shared/api/http.ts (Axios)
                                       ↓
                          shared/api/response.ts (business error normalisation)
                                       ↓
                          app/providers/setupApiSideEffects.ts (401/403/404 → navigation)
```

- `request.ts` wraps `get/post/put/patch/delete/upload` and unwraps the business response envelope.
- `http.ts` auto-attaches `Authorization: Bearer <token>` and persists refreshed tokens from response headers (`new-token`, `x-new-token`, `x-access-token`, `authorization`).
- Global error handling: 401 → clear auth + redirect to login; 403 → redirect to `/forbidden`; 404 → redirect to not-found. **Pages do not need to handle these themselves.**

### Vue Query
All data fetching uses `@tanstack/vue-query` hooks defined in `shared/api/queries.ts`.  
Cache keys are centralised in `shared/api/queryKeys.ts` — always use `queryKeys.*` for invalidation.  
Default: `staleTime=30s`, `gcTime=5min`, retry only on 5xx errors, no refetch on window focus.

### API codegen
`npm run generate:api` reads OpenAPI specs from environment variables and writes to `src/shared/api/generated/openapi.ts`.  
Required env vars (set at least one):
```
OPENAPI_AUTH_URL
OPENAPI_CONTENT_URL
OPENAPI_REVIEW_URL
OPENAPI_SEARCH_URL
OPENAPI_FILE_URL
```
The generated file is committed as `src/shared/api/generated/contracts.ts` (manually curated subset). Re-run codegen after backend contract changes.

---

## Stores

| Store | Holds |
|---|---|
| `auth` | Current user, token, `isAuthenticated`, `role` |
| `session` | Redirect target, forbidden message (session-scoped) |
| `ui` | Dark mode, search keyword, `drawerOpen`, `isDrawerClosing`, `pendingRoute` |
| `editor` | Current article being edited, dirty flag, save/submit state, last-saved timestamp |
| `draft` | Draft list |
| `profile` | Current profile page data |
| `review` | Pending review queue and review logs |

Token is persisted via `shared/utils/authStorage.ts`. Storage key defaults to `now.token` (override with `VITE_TOKEN_STORAGE_KEY`).

---

## Styling

- **Tailwind CSS v4** via `@tailwindcss/vite` plugin. No `tailwind.config.js` — configuration is in CSS.
- **Design tokens** live exclusively in `src/app/styles/theme.css` as CSS custom properties. Use these variables, not hardcoded colours:
  - `--color-primary`, `--color-bg`, `--color-surface`, `--color-surface-glass`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-danger`, `--color-success`, `--color-warning`
  - `--shadow-xs/sm/md/lg`, `--shadow-glass-card`, `--shadow-button`
  - `--radius-sm/md/lg/xl/pill`, `--backdrop-blur`
- Dark mode: toggled by adding `html.dark` class. All token overrides are in `theme.css` under `html.dark`.
- Font stack prioritises Chinese fonts: HarmonyOS Sans SC → MiSans → PingFang SC → Noto Sans SC → Microsoft YaHei.
- Rich-text/article prose styles: `src/app/styles/prose.css`.

---

## Design Principles (from `.impeccable.md`)

This is a Chinese-language editorial platform. Keep these in mind when building UI:

1. **Content first** — public screens help users decide what to read within seconds.
2. **One dominant action** per screen; no equal-weight competing CTAs.
3. **Calm over clever** — motion and blur support orientation, not spectacle.
4. **Plain language** — labels and status copy explain value and state directly.
5. **Aesthetic**: light-first, frosted/glass surfaces, restrained blue (`#0071e3` / `#2997ff` dark), minimal typography. Avoid decorative gradients, dashboard-card excess, generic AI-SaaS tropes.

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `VITE_APP_NAME` | `Now` | Browser title prefix |
| `VITE_API_BASE_URL` | `/api/v1` | API base path |
| `VITE_ASSET_BASE_URL` | `''` | CDN prefix for assets |
| `VITE_TOKEN_STORAGE_KEY` | `now.token` | localStorage key for auth token |
| `BASE_URL` | `/` | Router history base (set by Vite) |

---

## Placeholder / Stub Directories

These exist in the tree but have no implementation files yet:
- `src/types/` — reserved for future global type consolidation
- `src/features/article-delete/` — user-side article delete (separate from `admin-article-delete`)
- `src/widgets/fullpage-drawer/`
- `src/widgets/publish-dropdown/`

Don't add logic inside them without a matching feature spec.

---

## Git / Repo Notes

- Push uses SSH (not HTTPS). Ensure SSH key is configured before `git push`.
- No CI workflow files found (no `.github/workflows/`). No pre-commit hooks detected.
- Commits are not enforced by any hook; run type-check manually before pushing: `npx vue-tsc --noEmit`.
