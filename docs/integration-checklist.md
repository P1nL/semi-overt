# 接口联调清单

> 源码核对：2026-10-11。依据 shared/api/modules、authRuntime、response 与路由定义，不再依赖仓库中不存在的 Postman 集合。下表是前端调用契约，不代表本轮已对真实后端验收。

## 准备

- 默认请求前缀为 /api/v1；下表路径均省略该前缀。
- 准备 USER 与 ADMIN 测试账号、可修改的测试文章和图片；删除与审核仅使用测试数据。
- 默认 Vite 将 /api 和 /static 代理到 localhost:8080。
- 会话测试使用浏览器 Cookie 或支持 Cookie jar 的客户端，不能只复制 bearer token。

## 认证与用户

| 方法 | 路径 | 检查点 |
| --- | --- | --- |
| POST | /auth/register-code | 邮箱验证码；按后端配置携带 cfTurnstileToken |
| POST | /auth/register | 注册响应被归一化并接纳为当前会话 |
| POST | /auth/login | 登录、rememberMe 与后端 Cookie 行为一致 |
| POST | /auth/refresh | Cookie 恢复会话；返回新的内存 access token |
| POST | /auth/logout | Cookie 授权的设备退出，不要求 bearer |
| POST | /auth/forgot-password | 发起密码找回；错误留在表单 |
| POST | /auth/reset-password | 完成密码重置；错误留在表单 |
| GET | /users/me | 当前用户资料 |
| PUT | /users/me | 更新资料，不是 /users/me/profile |
| GET | /users/{username}/profile | 公开主页；用户名编码、分页和统计 |

会话重点：刷新页面恢复、并发 401 共享刷新、跨标签页退出、刷新接口暂时失败、退出失败后的重试。access token 不应写入 localStorage/sessionStorage；旧 token 键应清除。协调标记可以存在，不能把它们误判为保存了凭据。

## 内容、搜索与上传

| 方法 | 路径 | 检查点 |
| --- | --- | --- |
| GET | /home | 首页内容，空列表与加载失败 |
| GET | /categories/{QUICK或SHORT或DEEP}/articles | 分类与分页 |
| GET | /search | 文章搜索，keyword 与分页；不是 /search/articles |
| GET | /search/users | 作者搜索与分页 |
| POST | /articles | 创建文章 |
| PUT | /articles/{id}/draft | 保存草稿、状态与 draftVisible |
| GET | /articles/drafts | 写作箱；前端只保留 DRAFT / PENDING / RETURNED |
| GET | /articles/{id} | 阅读、编辑、审核共用详情入口，错误策略依上下文不同 |
| POST | /articles/{id}/submit | 提交审核 |
| POST | /articles/{id}/cancel-review | 取消审核 |
| DELETE | /articles/{id} | 作者删除；以服务端权限和状态检查为准 |
| DELETE | /admin/articles/{id} | 管理员删除 |
| POST | /upload | multipart：file、bizType，可选 articleId、oldUrl |

上传返回 url、size，可带 width、height、dominantColor；前端补齐缺省值。验收头像、封面和正文图片回填、类型/大小错误和替换旧资源行为。

## 审核

| 方法 | 路径 | 检查点 |
| --- | --- | --- |
| GET | /review/pending | 管理员待审队列与分页 |
| POST | /review/{id}/decision | APPROVE / RETURN / REJECT，原因校验 |
| GET | /review/{id}/logs | 审核记录与刷新 |

三个动作使用不同的 PENDING 测试文章，不能在同一篇已审核文章上连续验证三种决定。审核成功后核对列表、文章状态与日志；非管理员不得获得审核能力。

状态常量为 DRAFT、PENDING、APPROVED、RETURNED、REJECTED；提交/取消/重审资格以 feature、页面校验和服务端返回共同判断，不能只依赖按钮是否出现。

## 错误策略不是“一律跳转”

| errorPolicy | 行为 |
| --- | --- |
| local | 不触发全局错误导航，由当前表单/页面展示 |
| auth（默认） | 401 进入会话处理；403/404 保留给调用方 |
| route | 401 会话处理，并允许 403/404 全局路由副作用 |

- HTTP 层在符合条件的 401 上先尝试刷新并重试，不对登录、注册、刷新等排除请求循环刷新。
- 全局 401 清理失效状态；只有受保护路由需要引导登录，当前实现使用首页 auth=login 入口并保留返回目标。
- 全局权限页为 /403，不是 /forbidden。
- 公开文章详情显式 withAuth=false、errorPolicy=local；错误不应强制把读者踢到登录页。
- 409、429、网络错误和上传错误应有局部反馈；记录实际返回，不能把业务错误冒充成功。

## 留证格式

每条场景记录：日期、前后端版本、账号角色、请求路径、脱敏响应、界面结果、是否通过。不要记录 token、Cookie、邮箱验证码或密钥。
