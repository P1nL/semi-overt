# 导航水滴动画：本地验收与回滚

## 范围
栏目、头像菜单、写作箱使用形状展开；搜索建议从输入框下缘展开。
不修改其他页面过渡、背景材质、Dock 或已有图标动画。

## 手动预览
在仓库目录运行 `node scripts/nav-motion/preview.mjs`，访问：
- 水滴：http://127.0.0.1:4178/?navMotion=liquid
- 原版：http://127.0.0.1:4178/?navMotion=legacy
- 三倍慢放：http://127.0.0.1:4178/?navMotion=liquid&motionSpeed=slow

独立端口、仅监听本机；自动提供虚构登录身份、6 篇文章和 4 条不同状态的写作箱数据。
所有 /api/ 请求由本地中间件处理，未覆盖的接口返回本地错误；非 GET 请求一律 405，不落库。
这些数据与预览工具不从应用入口导入，不进入生产包。页面左下角有对照入口。

验收顺序：栏目、头像、写作箱开关；搜索输入“水滴”；快速连点；Esc 与点击空白关闭；
深浅色；390px 窄屏；系统减少动态效果。关注中间轮廓与收回过程、文字是否变形、关闭后能否正常点击。
“原版”是动效 A/B，不等同于源码回滚（写作箱仍保留本次 v-show / inert 的生命周期改进）。

## 测试
- Node 22.18+ / 24：`node --test scripts/nav-motion/geometry.test.mjs`
- `npm run build`
- `browser-check.js` 是可交给 Playwright MCP `browser_run_code_unsafe` 的 page 函数，
  已执行轮廓入场/清理、关闭、快速开关、深色、窄屏、减少动态、原版对照与禁止写入检查。
  截图输出路径记录在函数中。

## 回滚
构建开关：`VITE_NAV_LIQUID_MOTION=false`，重启开发服务或重新构建后回到旧动效。
源码快照与带哈希保护的回滚脚本保存在：
`D:/Codex/backups/semi-overt-nav-liquid-20260907-01/`

先检查（不改文件）：
`node D:/Codex/backups/semi-overt-nav-liquid-20260907-01/rollback.mjs`
确认回滚：
`node D:/Codex/backups/semi-overt-nav-liquid-20260907-01/rollback.mjs --apply`

脚本只还原本次修改的 4 个已有文件、删除本次新增的指定文件。
快照包含开始时栏目菜单和导航动作区已有的未提交修改，不使用 git reset。
任意目标文件在本次完成后又发生变化时，脚本拒绝覆盖，需人工合并回滚。

## 第二版修正与联网参考（2026-09-07）

第一版把像素坐标 CSS path 裁切施加在整个菜单上，文字也会被形状截断；
“最终开关正常”的检查不足以验收这种视觉效果。第二版移除菜单根节点裁切：

- 独立装饰背景层负责圆滴、短连接颈和面板形变；内容不参与裁切。
- 使用 SVG objectBoundingBox 归一化坐标，每帧按当前尺寸及触发点更新。
- 轮廓完成后才显示文字；收起时先隐藏文字，再收缩背景。
- 结束后移除临时图层并恢复原材质和内联样式，不增加全屏模糊滤镜。

在线阅读的原始资料（参考原理，没有整段拷贝示例源码）：
1. Lucas Bebber / Codrops, Creative Gooey Effects (2015-03-10)：
   https://tympanus.net/codrops/2015/03/10/creative-gooey-effects/
   示例：https://tympanus.net/Development/CreativeGooeyEffects/menu.html
   借鉴连接、拉伸、分离的视觉关系；未把示例的模糊/alpha 阈值滤镜套到整块菜单上。
2. MDN, clipPathUnits：
   https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/clipPathUnits
   用于核对归一化裁切坐标系，形状只作用在装饰背景层。

第二版测试：15 项几何/内容显隐约束；17 项浏览器检查。
其中真实播放采集到展开 50 帧、收起 33 帧，另检查了 125% CSS 缩放与完整栏目图标。
慢放中间帧及完成态截图：备份目录的 evidence-v2 子目录。
第一版源码快照另保存在 revision-2-before；原根目录回滚脚本仍用于撤销整个导航动效改动。
测试通过仅证明这些行为及裁切约束，不代表用户已经接受视觉效果。

## 第三版：从导航栏底边展开（2026-09-07）

本版取代第二版的圆滴/连接颈结构：单个连续轮廓先从按钮对应的导航栏底边铺宽，再向下延展。
起点在同一次开关期间保持不变；仅窗口/导航栏尺寸改变时重新适配。
内容仍只在轮廓完整之后出现，收起时先隐藏内容。

完成态位置也已修改（取代此前“保留最终位置”的说明）：栏目、用户菜单、写作箱、搜索建议均在导航栏外，
顶部与导航栏底边保留 12 CSS px；ResizeObserver 和窗口 resize 维持位置，退出时清理临时位置样式。
原版 A/B 仍保留原来的动画和布局，供对照；ZEN 无可见导航容器时不强制套用此锚点。

验证：19 项几何测试；17 项浏览器检查（增加完成态间距断言，覆盖桌面、窄屏、125% 缩放）。
另实测头像/写作箱展开与收起的源点一致，以及菜单保持展开时从桌面缩到 390px 后仍有 12px 间距。
本轮正常播放采集为展开 40 帧、收起 31 帧。截图与数据保存在 evidence-v3。
第二版修改前快照位于 revision-3-before，最初的完整回滚入口仍保留在备份根目录。
手动访问：http://127.0.0.1:4178/?navMotion=liquid&revision=3
