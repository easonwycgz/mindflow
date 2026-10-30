# Mindflow V1

本地优先的知识卡片 PWA。React + TypeScript + Vite、vite-plugin-pwa、Dexie/IndexedDB、Zod/Ajv、Tailwind。无账户、AI API、云端数据库或埋点；卡片不会上传。支持安全的 Markdown 标题、列表和粗体；不执行 HTML、不打开来源链接或加载远程图片。数学公式暂保留原文。

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

如使用系统浏览器：`CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`。默认执行桌面与移动视口 Chromium。可选 WebKit：先 `npx playwright install --with-deps webkit`，再 `TEST_WEBKIT=1 npm run test:e2e`。WebKit 模拟不等于真机验收。Playwright 会启动应用 dist/_headers 的生产测试服务器（含实际严格 CSP）；HTML 报告在 `playwright-report/`，失败 trace 在 `test-results/`。应用测试期间仅使用公开演示或合成数据。第一轮历史记录见 [docs/qa-evidence.md](docs/qa-evidence.md)，当前候选见 [第二轮交接报告](docs/round2-handoff.md)。

## 使用和数据安全

- 可直接点击“粘贴 JSON”，粘贴 ChatGPT 生成的完整卡片并“校验并导入”，无需创建文件。也可通过文件导入符合 `contracts/mindflow-card-schema-v1.json` 的本地 JSON，或点击“体验示例”。首次为空库。每次导入一张卡片，可连续导入组成多卡知识库；不增加协议之外的多卡包装字段。
- 单卡最大 2 MiB，知识树最多 16 层；同一张卡的节点 ID 不可重复。重复内容被拒绝，改变后的内容保留为另一张卡，原卡和阅读状态不受影响。
- 卡片、阅读位置、收藏和设置保存在当前浏览器 IndexedDB。随机切换使用当前搜索/收藏筛选范围，尽量避免当前卡。
- “备份、设置与隐私”可下载包含卡片、阅读状态、设置及完整性摘要的备份。恢复前会提示替换全部数据；校验失败不写入。知识库采用统一可恢复容量预算：最多 500 张、40 MiB（为阅读状态及设置预留空间）。单卡保持 50,000 个 JSON 值的限制；整库按逐卡预算校验，不再错误地共用单卡计数。导入超限在事务写入前拒绝，导出与恢复使用同一规则。旧版合法超过500卡的库可使用“生成分卷备份”与“恢复全部分卷”迁移；单卷普通备份仍保留500卡上限。迁移整体最多2000卡/40MiB，单卷最多500卡/8MiB，最多16卷；超出边界会明确拒绝并保留全部原数据。校验和不提供加密或身份验证，请妥善保管私人文件。
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

## 第二轮交互与安全变化

移动端已有卡片时阅读区排在知识库管理区前面；管理功能仍可向下滚动访问。节点正文位于树导航前方，点击节点会滚动并聚焦正文，可返回知识树；子树逐层展开，恢复选中节点时自动展开祖先。阅读区支持水平滑动及上一张/下一张按钮，垂直滚动、表单、树操作和文本选择不触发切卡。

Ajv 校验器在 `npm ci` / typecheck / test / build 前从正式协议生成，浏览器不再运行 Ajv compile，生产 CSP 已去除 unsafe-eval。仅支持基本 Markdown；代码块、表格、LaTeX/KaTeX 完整排版留待 V1.1，仍不执行用户 HTML。

## 第三轮保存、焦点与旧库迁移

- 字号旁明确显示正在保存、已保存或保存失败。已保存仅表示IndexedDB事务已经完成；选择值与已应用字号在保存期间可以不同。刷新前仍在保存的意图（仅字号与随机token，不含卡片）保存在一个小型localStorage日志中，重新打开后继续写入。失败可以重试；卡片仍只保存在IndexedDB。
- 从节点正文“返回知识树”会聚焦原节点并展开必要祖先；节点不存在则回退首节点或导航容器。上下箭头移动可见节点、左右箭头展开/折叠/返回父节点，Home/End定位两端，Enter阅读，Tab保持原生顺序。
- 501张旧版库：点击“生成分卷备份”，逐个下载迁移清单和所有分卷；每卷仍是原v1备份，清单是独立包装信息。恢复时点击“恢复全部分卷”，确认替换后在文件选择器里同时选择清单和所有卷。文件选择顺序无关，清单顺序、缺卷/混卷/校验和/总数/全部引用必须通过后才进行一次原子恢复。只恢复其中一卷仅恢复那部分数据，请勿用普通恢复代替整套恢复。所有文件未经加密，需一同妥善保管。
- 依赖关系、容量/内存风险见 [第三轮兼容性设计](docs/round3-compatibility.md)；当前候选交接见 [第三轮报告](docs/round3-handoff.md)。超过迁移预算的旧库仍需单独评审的流式/暂存迁移方案，不能视为已支持。
- B可直接读取仓库中的 [合成数据测试日志](docs/evidence/round3/local-validation.txt) 和源文件SHA256清单，无需Actions API；CI也配置了脱敏Summary输出，但公开run/job网页尚未读到正文；可直接读取的证据以仓库文本为准。不会公开真实用户备份、密钥或浏览器私人内容。
