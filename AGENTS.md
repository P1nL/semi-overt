# AGENTS.md

> Repository facts checked against source on 2026-10-11. Product: Semi-Overt; npm package name: now. Recheck runtime/deployment claims instead of treating this file as live acceptance evidence.

## Commands

```sh
npm ci
npm run dev                  # Vite; /api and /static → localhost:8080
npm run build                # vue-tsc --noEmit, then vite build
npm run preview              # Preview dist locally, not a deployment service
npm run test:auth-session     # Node session policy/runtime tests
npm run test:page-scroll      # Node scroll-mode tests
npm run test:page-motion      # Node motion contract tests
npm run dev:motion-fixture    # Loopback fixture on 5198; needs Vite on 5173
npm run generate:api          # Requires explicit OPENAPI_* sources
npm run font:subset          # Optional Python font asset generation
```

Node engines: `^20.19.0 || >=22.12.0`; prefer Node 22.18+ for tests importing TypeScript. More focused Node tests live in scripts/. No aggregate npm test or lint script exists. Type-check alone: `npx vue-tsc --noEmit`.

The auth-session projection test reads Java files from ../semi-overt-backend; missing sibling sources cause ENOENT. This is not a self-contained frontend suite. See the known test dependency in docs/source-code-guide.md. Do not mask that failure.

## Architecture — FSD-style layering

Target dependency direction: pages → widgets → features → entities → shared. app owns bootstrap, router, global providers/styles and the application shell; stores is cross-cutting.

- pages compose UI, query/load/error states and workflows; new business rules belong in feature/entity model code.
- widgets are reusable large UI regions; features implement actions and independent interactions.
- entities own domain models, mappers and minimal displays; shared owns infrastructure and base components.
- Current stores are auth, session, ui, editor and draft. There are no profile/review stores.
- Known legacy exception: shared/constants/article.ts re-exports entities/article. Do not extend reverse dependencies or claim all current imports strictly satisfy FSD.
- Use feature/entity/widget index.ts barrels for cross-module imports, not internal UI paths.
- Use @ for cross-directory imports. model/ holds logic/types/mappers; ui/ holds Vue components.
- Do not render raw DTOs directly: shared/api/adapters.ts normalizes backend shapes, entity mappers create VMs.
- Empty/reserved directories are not feature specifications; do not implement them without matching requirements.

## Routing, Sheet and scroll

Source of truth: shared/constants/routes.ts and app/router/routes/*.ts.

- Public: /, /category/:tab?, /search, /articles/:id, /u/:username.
- Auth routes: /login, /register, /forgot-password, /reset-password; global auth-dialog entry also exists.
- Creator: /article-editor-new, /editor/:id (USER/ADMIN).
- Admin: /review, /review/articles/:id.
- Forbidden: /403; not-found: catch-all. Do not document /forbidden as the current route.

RouteMeta: title; access=public|creator|admin; requiresAuth; publicOnly; roles; drawerAware; presentation=sheet; sheetVariant=default|full; sheetInset=default|article|editor; sheetScroll=sheet|content.

Article, editor and review detail use PageSheet. App.vue owns background route preservation. Article/editor use content scrolling and their own inset. Preserve background scroll and do not replay its entrance on closing a sheet.

Respect drawer-close deferral, unsaved-editor guards and auth destination restoration. Read guards.ts before changing navigation. Login prompting may use /?auth=login with a stored destination, not always /login?redirect=... . Scroll ownership includes app/model/pageScrollMode.ts and shared/utils/pageScroll.ts, not just window.

## API and auth

Default base: /api/v1. Modules → request.ts → http.ts (Axios); response.ts unwraps business envelopes; adapters and entity mappers normalize display data.

- Access tokens are memory-only in shared/api/authRuntime.ts. Refresh and logout use Cookie-backed device sessions.
- http.ts adds the memory bearer and retries eligible HTTP 401 requests after refresh. Do not restore response-header token persistence.
- authStorage.ts removes legacy token/user state from localStorage/sessionStorage; it is not the active storage mechanism.
- Preserve concurrent refresh coordination, cross-tab logout and pending-logout retry behavior.
- API errorPolicy defaults to auth: local has no global side effects; auth handles 401; route additionally handles 403/404 navigation.
- Public article reads explicitly use withAuth=false and local errors. Do not redirect all public failures to login.
- Cookie properties and deployment behavior require backend/runtime verification; frontend code alone does not prove them.

Use shared/api/queries.ts and centralized queryKeys for query caching/invalidation; mutations can call API modules directly. Defaults: staleTime 30s, gcTime 5min, no refetch on focus, at most one retry. ApiBusinessError retries only for code >=500; other thrown errors may retry.

Current endpoints and acceptance boundaries are in docs/integration-checklist.md. In particular: PUT /users/me, GET /search, POST /upload, /review/pending and /review/:id/decision.

## API codegen

npm run generate:api reads at least one of OPENAPI_AUTH_URL, OPENAPI_CONTENT_URL, OPENAPI_REVIEW_URL, OPENAPI_SEARCH_URL, OPENAPI_FILE_URL from the process environment. It writes src/shared/api/generated/openapi.ts. Existing contracts.ts is manually maintained, not a renamed generated output; reconcile contracts/adapters/mappers explicitly after backend changes.

## Styling and motion

- Tailwind CSS 4 uses @tailwindcss/vite; no tailwind.config.js.
- Core design tokens are in app/styles/theme.css: use color/surface/text/border/status, shadow and radius variables rather than introducing arbitrary colors.
- Font declarations and --font-pressure / --font-display are in fonts.css; base/component styles also contain local variables. Do not claim every token lives only in theme.css.
- html.dark switches theme; rich-text styles are in prose.css.
- Follow .impeccable.md: content-led Chinese editorial identity, legible workflows and a restrained shell, with existing expressive home/results/profile scenes.
- Home intro and desktop navigation choreography are separate: docs/home-intro.md and docs/page-transitions.md.
- Desktop page choreography is >=1024px; mobile does not inherit full desktop timing. Preserve reduced-motion behavior, cancellation, first-paint readiness and cleanup.
- main.ts caps GSAP ticker at 60; motionClock and WebGL renderers have their own update budgets. This is not a guaranteed delivered FPS.
- No PWA/Capacitor/native app is configured. Do not present proposals as shipped functionality.

## Environment

| Variable | Default / role |
| --- | --- |
| VITE_APP_NAME | Semi-Overt |
| VITE_API_BASE_URL | /api/v1 |
| VITE_ASSET_BASE_URL | Empty; asset prefix |
| VITE_TOKEN_STORAGE_KEY | now.token; legacy cleanup key only |
| VITE_TURNSTILE_SITE_KEY | Public registration challenge site key |
| VITE_NAV_LIQUID_MOTION | String false disables the liquid panel transition |
| BASE_URL | Vite-provided router base; configure through Vite base |

Never put backend secrets in VITE_* variables or public source. Font subset generation needs Python, fonttools[woff], and assets-source/fonts/ZhaohuaMinB-Black.woff2; it is not required for a normal build.

## Git, CI and documentation

- Check git status before editing; preserve unrelated work. Inspect git remote -v instead of assuming SSH or HTTPS.
- Frontend CI installs and builds for configured PR/main path filters and workflow_dispatch. It does not currently run Node tests or deploy. Docs-only/scripts-only changes do not match its file filters.
- Production credentials must not enter this public repository; production deployment orchestration belongs to the private backend repository.
- Build before pushing when practical. Do not commit or push without authorization.
- Keep README product-focused; keep implementation details in docs/source-code-guide.md. Update interface/regression/motion documents when their contracts change.
- Preserve third-party license notices. Historical test counts and machine-local backups are not current acceptance evidence.
