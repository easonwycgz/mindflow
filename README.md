# Mindflow V1

本地优先的知识卡片 PWA。React + TypeScript + Vite、vite-plugin-pwa、Dexie/IndexedDB、Zod/Ajv、Tailwind。无账户、AI API、云端数据库或埋点；卡片不会上传。导入内容按纯文本显示，不执行 HTML、打开来源链接或加载远程图片。

## 开发与验证

Node 24、npm 11。使用现有隔离仓库，无需 worktree。

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

如使用系统浏览器：`CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`。默认执行桌面与移动视口 Chromium。可选 WebKit：先 `npx playwright install --with-deps webkit`，再 `TEST_WEBKIT=1 npm run test:e2e`。WebKit 模拟不等于真机验收。Playwright 会启动生产预览服务；HTML 报告在 `playwright-report/`，失败 trace 在 `test-results/`。应用测试期间仅使用公开演示或合成数据。实际执行记录见 [docs/qa-evidence.md](docs/qa-evidence.md)。

## 使用和数据安全

- 导入符合 `contracts/mindflow-card-schema-v1.json` 的本地 JSON，或点击“体验示例”。首次为空库。
- 单卡最大 2 MiB，知识树最多 16 层；同一张卡的节点 ID 不可重复。重复内容被拒绝，改变后的内容保留为另一张卡，原卡和阅读状态不受影响。
- 卡片、阅读位置、收藏和设置保存在当前浏览器 IndexedDB。随机切换使用当前搜索/收藏筛选范围，尽量避免当前卡。
- “备份、设置与隐私”可下载包含卡片、阅读状态、设置及完整性摘要的备份。恢复前会提示替换全部数据；校验失败不写入。备份最多 40 MiB / 500 卡，并受安全节点数量限制。校验和不提供加密或身份验证，请妥善保管私人文件。
- 清除网站数据、无痕模式、卸载、系统存储回收可能造成数据丢失。请定期导出并在另一位置保存备份。不要把私人 JSON 或备份放进仓库、public/ 或部署目录。

## Cloudflare Pages 静态部署

只发布构建产物，不发布仓库根目录。

1. 在 Pages 连接此仓库并选择开发分支（验收后再合并 main）。构建命令 `npm ci && npm run build`；输出目录 **dist**；Node 版本设为 **24**。不需要任何应用密钥或数据库。
2. 或在已安全配置 Cloudflare CLI 凭证的本地执行 `npx wrangler pages deploy dist --project-name <你的项目名>`。不要在聊天或仓库中放令牌。
3. `public/_headers` 会被复制到输出，限制外部网络/图片、禁止 iframe，并让 SW 与入口重新验证。Pages HTTPS 是主屏幕安装及 Service Worker 的必要条件（本地测试的 localhost 例外）。
4. 首次联网打开，等待“可离线阅读”；导入卡片。Safari 分享 → 添加到主屏幕。新版本准备好时，完成操作后点击“更新应用”。
5. 部署不包含浏览器内数据。只有公开演示卡片被打包；私人卡片不会被构建读取。不要将用户卡片作为 public 静态资源。

当前部署状态与限制见 QA 记录；没有部署凭证时不会声称已上线。

## iPhone 最短验收

在真实 iPhone Safari HTTPS 站点：首次联网打开，导入公开示例，添加到主屏幕；打开摘要、子节点和 FAQ，收藏并调整字号；关闭重开确认阅读位置；导出备份。开启飞行模式，强制退出后从主屏幕重开，确认可读和可搜索；恢复备份确认收藏、设置仍在。再测畸形 JSON 不影响已有数据。检查刘海/底部安全区、长中文、大字、VoiceOver、文件选择/下载与分享。验证有新版本时更新后数据仍在。

真实 iPhone 离线冷启动、Safari 存储回收行为和更新流程无法用桌面模拟证明，必须单独记录设备型号、iOS 版本及结果。
