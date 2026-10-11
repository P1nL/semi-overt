# 源码与维护指南

> 依据当前工作树核对：2026-10-11。产品名为 Semi-Overt；package.json 中的 now 是包名，不代表另一套应用。本文替换旧的逐文件清单，以实际维护入口组织，避免新增组件后索引立即失效。

## 1. 运行与验证

Node engines 为 `^20.19.0 || >=22.12.0`，CI 使用 Node 22。建议本地使用 Node 22.18+ 运行直接导入 TypeScript 的专项测试。

```sh
npm ci
npm run dev
npm run build
npm run test:auth-session
npm run test:page-scroll
npm run test:page-motion
```

`build` 先运行 `vue-tsc --noEmit` 再运行 `vite build`。没有统一 npm test 或 lint 脚本；scripts 中另有首页、导航、编辑器和动画预算等专项测试。源码约束测试、运行时测试、真实浏览器验收是不同证据，不能相互替代。

`npm run preview` 只预览 dist；Vite 开发代理不能作为生产反向代理配置。生产托管需支持 createWebHistory 的 SPA 路由回退，以及 /api、/static、Cookie 会话。


### 已知测试环境依赖

`test:auth-session` 中的公开资料投影测试会读取相邻的
`../semi-overt-backend/src/main/java/com/platform/semiovert/auth/api/user/`
下的 `UserProfileController.java` 与 `PublicUserProfileResponse.java`。
它不是完全自包含的前端测试：缺少该后端源码布局会报 ENOENT，不能据此宣称前端会话逻辑失败或整套测试通过。

2026-10-11 本轮验证：build 通过；page-scroll 6/6、page-motion 51/51 通过；
auth-session 13/14 通过，剩余 1 项因上述外部文件缺失失败。未修改测试或业务代码以掩盖失败，未执行真实后端/浏览器业务验收。
构建保留 Lottie eval 与大于 500 kB chunk 的告警。

## 2. 启动与分层

```text
index.html
  → src/app/main.ts
  → Pinia / MotionPlugin / Vue Query / API 副作用 / Router
  → 初始化主题偏好
  → router.isReady()
  → App.vue 挂载页面、Sheet 与全局交互
```

main.ts 当前将共享 GSAP ticker 限制为 60 次更新/秒。页面动效另使用共享 motionClock；这只是更新频率上限，不是设备实际帧率承诺。

| 目录 | 职责 | 代表入口 |
| --- | --- | --- |
| app | 装配、路由、全局壳层与样式 | App.vue、router、providers、styles |
| pages | 查询组合、页面状态和流程编排 | home、category、search、profile、article、review |
| widgets | 大块可组合 UI | app-header、article-reader、article-result-stream、article-infinite-menu、page-sheet |
| features | 业务动作及独立交互 | auth、article-editor、draft-box、review-action、home-intro、page-transition |
| entities | 领域模型、DTO→VM 与小型展示 | article、category、user、review |
| shared | API、基础组件、工具与资源 | api、components、utils、assets |
| stores | 跨页面状态 | auth、session、ui、editor、draft |

目标依赖方向为 pages → widgets → features → entities → shared；app 负责装配。使用 barrel 导出与 @ 路径别名。model 放逻辑/类型/映射，ui 放组件。

**现状不等于绝对约束已全部满足**：例如 shared/constants/article.ts 仍向 entities/article 反向 re-export 以兼容旧引用；页面也有现存流程代码。新增业务规则应沉入 feature/entity，不照搬兼容例外。当前没有 profile.ts 或 review.ts store，不要引用这些已不存在的入口。

## 3. 路由、浮层与滚动

来源：src/shared/constants/routes.ts、src/app/router/routes、src/app/router/index.ts。

| 页面 | 路径 | 呈现/访问 |
| --- | --- | --- |
| 首页 | / | 公开 |
| 登录、注册 | /login、/register | publicOnly，另有全局认证对话框入口 |
| 找回、重置密码 | /forgot-password、/reset-password | publicOnly |
| 分类、搜索 | /category/:tab?、/search | 公开；结果布局按查询参数与页面状态切换 |
| 文章 | /articles/:id | 公开 Sheet，article inset、content scroll |
| 新建、编辑 | /article-editor-new、/editor/:id | USER/ADMIN Sheet，editor inset、content scroll |
| 个人主页 | /u/:username | 公开 |
| 审核台、审核文章 | /review、/review/articles/:id | ADMIN；详情使用 Sheet |
| 无权限、不存在 | /403、catch-all | 系统页面 |

RouteMeta 包括 title、access（public/creator/admin）、requiresAuth、publicOnly、roles、drawerAware，以及：

- presentation: sheet
- sheetVariant: default / full
- sheetInset: default / article / editor
- sheetScroll: sheet / content

App.vue 与 PageSheet 管理背景路由和浮层。滚动恢复涉及 app/model/pageScrollMode.ts、shared/utils/pageScroll.ts 和路由 scrollBehavior；不要只用 window.scrollTo 假定所有页面都由 window 滚动。

抽屉关闭、未保存内容、认证恢复与路由切换有协调逻辑。改导航时应读 guards.ts，不要绕过关闭时序。受保护入口的登录提示可使用首页 auth=login 并保留目标，而不是一律跳 /login。

## 4. API 与设备会话

```text
页面 / feature / Vue Query
  → shared/api/modules/*
  → request.ts → http.ts → 后端
  → response.ts 解包与错误策略
  → adapters.ts 归一化
  → entities/*/model/*mapper.ts → 视图模型
```

### 会话

- authRuntime.ts 在内存持有 access token，并通过 Cookie 调用 /auth/refresh 恢复/更新会话。
- http.ts 携带内存 bearer，在符合条件的 HTTP 401 上尝试刷新与重试；不再从响应头读取并持久化 token。
- authStorage.ts 只用于清除旧 localStorage/sessionStorage 中的 token 和用户缓存，不是当前凭据存储方案。
- authRuntime 包含共享刷新、Web Locks/BroadcastChannel 协调及退出标记；本地协调标记不包含 access token。
- logout 使用 Cookie 授权，失败重试与待退出状态不能省略。
- Cookie 是否成功设置及其服务端属性，必须在实际后端/代理环境验收，不能由前端代码推断为部署已完成。

### 错误策略

request 默认 errorPolicy=auth。local 不触发全局副作用；auth 只处理 401；route 才对 403/404 启用全局页面跳转。公开文章详情使用 withAuth=false、local 错误策略。

全局 401 不意味着所有公开页面都强制跳登录；只有受保护上下文需要引导。全局权限路由为 /403。详见 [接口联调清单](integration-checklist.md)。

### 服务端状态

shared/api/queries.ts 提供查询 Hook，queryKeys.ts 集中定义缓存键。默认 staleTime=30 秒、gcTime=5 分钟、窗口聚焦不重新获取；最多重试一次，ApiBusinessError 仅在 code≥500 时重试，其他异常可重试。写操作仍可直接调用 API，不要声称所有请求都是查询 Hook。

## 5. 主要业务入口

| 需求 | 优先阅读 |
| --- | --- |
| 首页数据与展示 | pages/home/HomePage.vue、widgets/hero-section、shared/api/modules/home.ts |
| 首页开场 | features/home-intro、docs/home-intro.md |
| 桌面页面编排 | features/page-transition、shared/composables/usePageMotion.ts、docs/page-transitions.md |
| 分类/搜索结果 | pages/category、pages/search、widgets/article-infinite-menu、widgets/article-result-stream |
| 登录与认证浮层 | features/auth、widgets/auth-dialog、stores/auth.ts、shared/api/authRuntime.ts |
| 阅读与目录 | pages/article/ArticleReadPage.vue、widgets/article-reader、widgets/article-toc |
| 编辑器与自动保存 | features/article-editor、pages/article/ArticleEditorPage.vue、stores/editor.ts |
| 写作箱 | features/draft-box、stores/draft.ts、shared/api/modules/article.ts |
| 审核 | features/review-action、pages/review、pages/article/ArticleReviewPage.vue |
| 个人主页 | pages/profile、widgets/profile-header、profile-card-queue、profile-writing-calendar |

上表代码路径均相对 src，docs 路径相对仓库根目录。

文章状态：DRAFT / PENDING / APPROVED / RETURNED / REJECTED。写作箱在 API 模块过滤为 DRAFT / PENDING / RETURNED；不是所有文章的管理列表。审核动作分别为 APPROVE / RETURN / REJECT。不要把审核动作字符串与文章状态混用。

## 6. 样式与移动端边界

- Tailwind CSS 4 通过 @tailwindcss/vite 接入，没有 tailwind.config.js。
- theme.css 管理核心颜色、表面、阴影和圆角；fonts.css 维护本地 Hero Pressure（Roboto Flex 子集）与 Zhaohua Display 字体和对应变量。
- base.css 与组件局部样式仍有布局/交互变量，不应宣称所有 CSS 变量只存在于 theme.css。
- 深色使用 html.dark，正文样式在 prose.css。
- 当前视觉不再只是静态磨砂界面：包含轨道字形、超立方体、WebGL 结果和页面编排。新增内容要延续已有视觉，但避免把长动画扩散到普通反馈。
- 桌面编排门槛为 ≥1024px；窄屏不直接复用整套桌面时序。尚未配置 PWA/原生 App，移动端一致性是后续工程选择，不是现有能力声明。

## 7. 配置

| 变量 | 默认/用途 |
| --- | --- |
| VITE_APP_NAME | Semi-Overt，应用标题 |
| VITE_API_BASE_URL | /api/v1，请求前缀 |
| VITE_ASSET_BASE_URL | 空字符串，资源地址前缀 |
| VITE_TOKEN_STORAGE_KEY | now.token，仅兼容清理旧存储键；不是启用 token 持久化 |
| VITE_TURNSTILE_SITE_KEY | 注册验证码使用的公开 site key |
| VITE_NAV_LIQUID_MOTION | 仅字符串 false 关闭对应液态面板动效 |
| BASE_URL | Vite 提供的基础路径；通过 Vite base 配置，不是普通业务 VITE_* 变量 |

VITE_* 会进入客户端构建，不能保存密码、JWT 签名密钥或 Turnstile secret。修改构建变量后需重启开发服务/重新构建。

### API 类型生成

给进程设置以下至少一个变量后运行 npm run generate:api：OPENAPI_AUTH_URL、OPENAPI_CONTENT_URL、OPENAPI_REVIEW_URL、OPENAPI_SEARCH_URL、OPENAPI_FILE_URL。

脚本输出 src/shared/api/generated/openapi.ts。现有 contracts.ts 是手工维护的契约，**不是生成文件的改名结果**，脚本不会自动同步它。模块通过 shared/types/api.ts 使用当前类型，更新契约后仍须核对 adapters 与 mapper。

### 字体工具

npm run font:subset 调用 Python，依赖 `fonttools[woff]`，输入 assets-source/fonts/ZhaohuaMinB-Black.woff2，输出本地字体子集；这不是日常 npm ci/build 的必要步骤。首页字形资产另由 scripts/generate-intro-glyphs.py 维护。

## 8. CI、协作与文档时效

.github/workflows/frontend-ci.yml 对匹配路径的 PR、main push 和手动触发执行 npm ci + npm run build。专项测试没有接入该工作流；文档与 scripts 的独立变更也不在当前路径筛选中。

Git remote URL 属于本地配置，不写死 SSH 或 HTTPS；操作前用 git remote -v 核验。生产 SSH 凭据不得进入公开前端仓库，部署协调保留在私有后端仓库。

修改接口时同步联调清单；修改脚本/路由/会话时同步本指南和 AGENTS.md；修改动效时同步专门文档。许可证和历史证据不作为普通说明文档改写。未执行的验收明确标记“未验证”。
