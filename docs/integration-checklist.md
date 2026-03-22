# 接口联调场景清单

基于 `content-platform-api.postman_collection.json` 生成，覆盖当前前端实现涉及的主流程接口。

## 0. 联调前准备
- `baseUrl` 已配置（例如 `/api/v1` 或后端实际地址）
- 准备两个账号：
  - 普通用户（`USER`）
  - 管理员（`ADMIN`）
- Postman 环境变量：
  - `token`（用户 Token）
  - `adminToken`（管理员 Token）
  - `articleId`（测试文章 ID）
  - `targetUsername`（公开主页用户名）

## 1. 认证模块（9.x）
- `POST /auth/register`：注册成功并返回 token + user
- `POST /auth/login`：用户名/邮箱登录成功
- `POST /auth/logout`：登出后 token 失效
- `POST /auth/password/forgot`：发起找回密码成功
- `POST /auth/password/reset`：使用 token 重置成功

关键校验：
- 错误凭据返回非 200 业务码
- 前端收到 401 时应清理登录态并跳转登录页

## 2. 用户与个人主页（10.x）
- `GET /users/me`：返回当前用户资料
- `PUT /users/me/profile`：更新用户名/签名/头像/封面
- `GET /users/{username}/profile`：公开主页列表与统计

关键校验：
- 更新资料后，前端 Header/Profile 数据同步
- 无权限访问返回 403 时前端跳转 Forbidden

## 3. 文章与草稿（11.x）
- `POST /articles`：新建文章，获取 `articleId`
- `PUT /articles/{articleId}/draft`：自动保存草稿
- `GET /articles/drafts`：草稿箱列表
- `GET /articles/{articleId}`：详情（读/编/审复用）
- `POST /articles/{articleId}/submit`：提交审核
- `POST /articles/{articleId}/cancel-review`：取消审核
- `DELETE /articles/{articleId}`：删除文章

关键校验：
- 状态流转：`DRAFT/RETURNED -> PENDING -> DRAFT`（取消）或审核结果
- 删除后草稿箱与编辑态同步清理
- 重复提交/状态冲突时返回 409 业务冲突提示

## 4. 首页/分类/搜索（12.x）
- `GET /home`：首页 Hero + sections
- `GET /categories/{QUICK|SHORT|DEEP}/articles`：分类列表
- `GET /search/articles`：搜索（P2 占位）

关键校验：
- 分类切换请求参数正确
- 搜索关键词同步到 URL 与 UI store

## 5. 审核模块（13.x）
- `GET /reviews/pending`：管理员待审队列
- `POST /reviews/{articleId}/action`：`APPROVE/RETURN/REJECT`
- `GET /reviews/{articleId}/logs`：审核日志

关键校验：
- `RETURN/REJECT` 必填 reason
- 操作后待审列表更新，日志可刷新看到新记录
- 非管理员访问审核接口返回 403

## 6. 上传模块（14.x）
- `POST /uploads/images`：`AVATAR/COVER/ARTICLE_IMAGE`

关键校验：
- 上传成功返回 `url/width/height/size/dominantColor`
- 非法格式或超限大小返回业务错误
- 前端上传成功后回填对应字段

## 7. 统一错误码回归
- 401：清理 auth，记录 session code，跳登录
- 403：记录 forbidden message，跳 403 页面
- 404：前端进入 404 页面
- 409：前端显示冲突提示（例如审核状态变化）
- 429：前端显示“操作过于频繁”

