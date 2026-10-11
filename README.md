<div align="center">
  <img src="public/favicon.svg" width="72" height="72" alt="Semi-Overt 标志" />
  <h1>Semi-Overt · 半公开</h1>
  <p><strong>把片刻的想法，写成值得停留的内容。</strong></p>
  <p>一个面向中文阅读与创作的内容网站：从发现文章，到专注阅读，再到写作与审核。</p>
  <p><code>Vue 3</code> &nbsp; / &nbsp; <code>TypeScript</code> &nbsp; / &nbsp; <code>Vite 7</code> &nbsp; / &nbsp; <code>Tailwind CSS 4</code></p>
  <p><a href="#网站体验">网站体验</a> · <a href="#本地启动">本地启动</a> · <a href="#工程结构">工程结构</a> · <a href="#文档导航">文档导航</a></p>
</div>

---

## 网站体验

**发现，让阅读从兴趣开始。** 首页以轨道标题、超立方体与文章卡片构成视觉入口；分类与搜索提供继续探索内容的路径。

**阅读，不打断来时的上下文。** 文章以 Sheet 浮层打开，配合正文排版、代码高亮与目录定位，让阅读和返回之间保持连续。

**写作，让草稿逐渐成为作品。** Tiptap 编辑器支持富文本、图片、表格与 Markdown 相关操作；自动保存、写作箱、送审和退回修改连接完整的创作过程。

<table>
  <tr><th>面向读者</th><th>面向作者</th><th>面向管理员</th></tr>
  <tr>
    <td>首页文章展示<br>按阅读时长分类<br>文章与作者搜索<br>文章阅读与作者主页</td>
    <td>注册、登录与密码找回<br>富文本创作与草稿保存<br>提交与取消审核<br>头像、封面与个人资料</td>
    <td>待审队列<br>通过、退回与拒绝<br>审核记录<br>管理员文章删除</td>
  </tr>
</table>

### 不止于静态页面

- **有辨识度的首页**：眼睛、环绕文字与超立方体组成开场；自动播放受冷却和次数限制，也可以主动跳过。
- **连贯的浏览体验**：桌面首页、结果页和个人主页拥有独立的入场、离场与内容切换编排，阅读浮层不重播背景动画。
- **多种结果呈现**：分类和搜索结合 WebGL 卡片视图与文章列表，个人主页包含文章队列和写作日历。
- **浅色与深色主题**：玻璃表面、字体与颜色共同适配主题；减少动态效果设置有对应处理。

> **当前边界**：这是 Web 前端仓库，需要后端提供真实业务数据。桌面完整转场限定在宽度 ≥ 1024px；窄屏有独立布局和导航处理，不承诺与桌面逐像素一致。仓库尚未接入 PWA、Capacitor 或原生移动 App，也不包含完整后端和一键生产部署。

## 技术组成

| 层面 | 实现 |
| --- | --- |
| 应用 | Vue 3.5、TypeScript 5.9、Vite 7、Vue Router 5 |
| 状态与请求 | Pinia 3、TanStack Vue Query 5、Axios |
| 写作与正文 | Tiptap 3、Markdown-it、DOMPurify、Highlight.js |
| 视觉与交互 | Tailwind CSS 4、GSAP、OGL、Lottie、Lucide、VueUse |
| 会话 | 内存 access token、Cookie 刷新会话、跨标签页协调 |
| 验证 | vue-tsc、Vite build、Node 原生测试、手动浏览器回归 |

版本范围以 [package.json](package.json) 为准，安装结果由 [package-lock.json](package-lock.json) 锁定。

## 本地启动

### 1. 准备环境

- Node.js：`^20.19.0 || >=22.12.0`（package.json 声明）；运行直接导入 TypeScript 的 Node 测试时，建议使用 Node 22.18+。
- npm，以及提供当前 API 契约的后端。
- 默认后端地址为 `http://localhost:8080`。

### 2. 安装与启动

```sh
npm ci
npm run dev
```

打开终端输出的开发地址。Vite 将 `/api` 和 `/static` 代理到本地 8080 端口；仅启动前端并不会创建用户、文章或数据库。

### 3. 按需配置

在本地新建 `.env.local`，不要放入服务端密钥：

```dotenv
VITE_APP_NAME=Semi-Overt
VITE_API_BASE_URL=/api/v1
VITE_ASSET_BASE_URL=
# 注册验证码的人机验证：仅填写公开 site key，须与后端配置匹配
VITE_TURNSTILE_SITE_KEY=
```

完整变量、会话策略与部署注意事项见 [源码与维护指南](docs/source-code-guide.md)。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | Vite 开发服务 |
| `npm run build` | TypeScript 检查，再构建到 dist |
| `npm run preview` | 本地预览已有构建，不是生产部署服务 |
| `npm run test:auth-session` | 会话策略与运行时测试 |
| `npm run test:page-scroll` | 页面滚动模式测试 |
| `npm run test:page-motion` | 页面动效约束测试 |
| `npm run dev:motion-fixture` | 隔离的页面动效假数据服务；另需正常 Vite 服务 |
| `npm run generate:api` | 根据显式提供的 OpenAPI 地址生成类型 |
| `npm run font:subset` | Python 字体子集工具，另需其字体源文件和依赖 |

**测试环境提示**：会话套件有一项依赖相邻 `semi-overt-backend` 的 Java 源文件，单独克隆此前端仓库可能报 ENOENT；详见 [已知测试环境依赖](docs/source-code-guide.md#已知测试环境依赖)。

没有统一的 `npm test` 或 lint 脚本。更多专项 Node 测试位于 `scripts/`；测试通过不替代真机、浏览器和后端联调验收。

## 工程结构

```text
src/
├── app/         应用装配、路由、全局样式与页面壳层
├── pages/       路由页面与流程编排
├── widgets/     导航、阅读器、结果视图、个人主页等完整区域
├── features/    登录、写作、审核、开场与页面转场
├── entities/    文章、用户、分类、审核的领域模型与展示单元
├── shared/      API、基础组件、通用能力与静态资源
└── stores/      auth / session / ui / editor / draft
```

采用 FSD 风格分层：页面组合模块，业务动作沉到 feature，DTO 经 API 适配和领域 mapper 转为展示模型。当前分层约束与已知兼容例外见 [AGENTS.md](AGENTS.md)。

## 文档导航

| 文档 | 内容 |
| --- | --- |
| [源码与维护指南](docs/source-code-guide.md) | 启动、架构、路由、会话、配置与维护入口 |
| [接口联调清单](docs/integration-checklist.md) | 当前接口路径、错误策略与联调边界 |
| [手动回归脚本](docs/manual-regression-script.md) | 读者、作者、管理员及交互动效验收 |
| [首页开场](docs/home-intro.md) | 播放资格、时间线与调试方式 |
| [桌面页面转场](docs/page-transitions.md) | 转场编排、渲染生命周期与隔离预览 |
| [导航动效记录](scripts/nav-motion/README.md) | 本地预览限制与历史迭代记录 |

## 交付与使用说明

- GitHub Actions 当前执行安装、类型检查和生产构建；**没有自动运行专项 Node 测试或部署网站**。仅文档改动不在当前 CI 路径触发范围内。
- 生产环境需配置 SPA 路由回退，以及 API、静态上传资源与 Cookie 会话的服务端支持；开发代理不会自动进入生产包。
- 本仓库未提供项目级 LICENSE。公开可见不等于已授予任意再分发或商用权限；第三方素材遵循各自附带许可，不要移除署名与许可文件。

---

<div align="center"><sub>内容是主角，交互为它留出空间。<br>文档依据本仓库源码核对于 2026-10-11。</sub></div>
