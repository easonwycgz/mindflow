# UX1：B 验收后容量反馈修复交接

本次基于 B 受测 `2df961f55296065317457e65158297aadcf4ad91`，冻结 base 仍为 `df48c9d2eae22f3fc97487db80ab61b59813adc9`。分支 `feat/mindflow-v1-ux1`，PR #2 保持 Draft。最终完整 head SHA、工作区和对应 push/PR CI 链接以 PR #2 的本轮交接表为准。候选仍未通过独立验收，不合并、不部署、不更新固定 Preview。

## B-UX1-001：根因与最小修复

`src/db.ts::assertCapacity()` 原先用普通 Error 抛出库容量限制；`src/importFeedback.ts::explainImport()` 把所有非 InputIssue 都映射为“本机读取或数据库事务失败”，因此业务拒绝被通用故障覆盖。原数据库拒绝和原子性本身有效。

新增 `src/libraryCapacity.ts::LibraryCapacityError`，携带稳定 `library-count` / `library-bytes` 业务码及 limit。容量检查仅改变抛错类型；计数、字节算法、阈值、事务边界和旧技术 message 保持。反馈层优先按业务错误实例分类，之后才处理 InputIssue 和未知数据库错误；不靠文字或不受信任的 code 属性猜测。

500 张提示明确显示“知识库最多 500 张卡片”；后续说明“本次未导入，原有数据未更改”，建议先备份、暂缓新增，保留原库并联系维护者整理。当前应用没有单卡删除入口，因此未承诺不存在的删除操作，也未扩大范围开发删除功能。40 MiB 单独显示可恢复容量预算。真实事务/存储错误仍显示原通用故障及安全重试指导。

未改 IndexedDB version/字段、正式 Schema、导入校验、备份包、迁移机制、阅读组件、CSP 或服务工作线程。错误类只存在于运行内存，不写入记录或备份。

## 改动文件与测试

|文件|目的|
|---|---|
|src/db.ts|容量检查抛出明确业务错误；其余逻辑不变|
|src/importFeedback.ts|优先显示库容量原因，真正 DB 错误保留原分类|
|src/libraryCapacity.ts|库张数/字节容量业务异常，独立于单卡校验错误|
|tests/fixtures/libraryCapacity.ts|完全虚构、确定性生成合法卡/库；不含实际八卡内容|
|tests/ux1-capacity.test.ts|499/500/501、40 MiB、事务错误/伪造码分类及三表完整性|
|e2e/ux1-capacity.spec.ts|实际文件入口运行上述三个场景；Desktop 和 Pixel 7 各一次|
|tests/ux1-repair-guard.test.ts|冻结零差异超集及 B 受测全部已有文件的只读保护|
|docs/ux1-repair-frozen-superset.json|86 个冻结零差异文件路径及 SHA-256 清单|
|docs/ux1-mobile-entry-design.md、两份 proposal.css、prototype.mjs、measurements.json|仅设计、匿名几何证据；不接入应用构建或发布资源|
|本文件|本轮修复、证据及未解决事项|

实际八卡原件继续在仓库外只读使用。新增 fixture 全部虚构；大型卡经正式校验，每张约 1.83 MB，小于 2 MiB；不以非法大卡冒充库容量边界。

### 先失败、后修复的实际证据

在未修改生产代码的 B 受测版本执行新定向回归：数据测试 1 PASS / 2 FAIL；真实文件浏览器入口（Pixel 7）1 PASS / 2 FAIL。两项失败分别是 500 张与 40 MiB 反馈，实际收到通用数据库提示；真正事务故障对照用例通过。

修复后定向浏览器 **6 PASS / 0 FAIL / 0 SKIP**：桌面/Pixel 7 各 3 项。完整回归中也执行同样 6 项。

1. 预置 498 张合法虚构卡；实际文件入口依次导入第 499、500 张，均成功，实际库计数对应增长。
2. 500 张时通过同一文件入口导入不同合法第 501 张；alert 明确显示 500 上限及备份方向，不显示通用数据库失败。
3. 拒绝前后三表 `cards`、`reading`、`settings` 的所有字段以完整 `getAll()` 序列化 SHA-256 和行数对比，完全相同；包括收藏、时间和 lastCardId。拒绝后等待超过 150ms 保存窗口再核对。为隔离普通滚动自身的合法写入，快照前进入既有临时发现模式；没有修改生产状态逻辑。
4. 真实浏览器原生 IDB 的 reading.add 中途抛出 QuotaExceededError：实际文件导入显示数据库失败，不显示 500/40 限制；整事务回滚，三表完全相同。
5. 数据测试另验证含“500”文字的普通 Error、仿制 code 属性的普通 Error 不会被误识别为容量业务错误。

### 40 MiB 分支状态

本轮 A 使用合成卡实际复现并验证同一反馈路径，不登记为 B 已独立确认的新缺陷。22 张合法大卡的既有算法预算为 **40,342,811 bytes**，低于 **41,943,040 bytes**；第 23 张候选正文 **1,833,047 bytes**，使库预算越界，而张数远小于 500。实际文件入口拒绝并显示 40 MiB，三表完全不变。

保留原算法 `JSON.stringify(cards)` 的 UTF-8 bytes + cards.length×512 +1024；这不是浏览器 origin 可用容量探测，也不是承诺所有浏览器可以存满。未重新定义 40 MiB 上限，没有更改迁移/恢复策略。

## 完整本地回归

环境：Node 24.19.0、npm 11.9.0、Playwright 1.64.1、Chromium 154.0.8037.57。沿用原 Desktop/Pixel 7，继续执行 1363×936、390×844 标准/大字项目。

|命令|实际结果|
|---|---|
|npm ci|PASS|
|npm run typecheck|PASS|
|npm run lint|PASS|
|npm test|112 PASS / 0 FAIL / 0 SKIP；15 文件|
|npm run build|PASS，生产 PWA 构建|
|npm run test:e2e|退出码 1：167 PASS / 2 FAIL / 1 SKIP，共 170；11.6 分钟|
|npm audit --omit=dev|PASS，0 vulnerabilities|

|浏览器项目|PASS|FAIL|SKIP|
|---|---:|---:|---:|
|chromium（原 Desktop）|62|1|1|
|chromium-mobile（原 Pixel 7）|63|1|0|
|ux1-desktop（1363×936）|14|0|0|
|ux1-mobile（390×844）|14|0|0|
|ux1-large（390×844，大字）|14|0|0|

新增数据测试共 5 项（容量 3、只读保护 2），没有替换旧 107 项。保留所有旧浏览器用例及开发者安全回归；新增文件入口 6 个项目实例，没有删/跳过/弱化旧断言。CI 按原 workflow 实际运行并在 PR #2 单列报告；本地与 CI 不混写。

## 两个原 CI FAIL：原样保留

`e2e/independent-qa.spec.ts:26:1` 的 chromium、chromium-mobile 仍因完整 summary 位于折叠区，`getByText(c.summary,{exact:true}).toBeVisible()` 失败。原件字节不变；本次没有修改 App 展示行为，没有改变结果记录方式。两个结果仍是 **FAIL**，没有获得合同替代的治理授权。本轮说明纠正此前交接中可能将折叠方案批准理解为已批准替代历史测试合同的表述；历史文件作为原证据不改写。

现有开发者用例实际展开全文并验证完整恶意原文、脚本不执行、零外站请求；UX1 的额外 CSP 用例继续执行。这些 PASS 不能替代 B 原件，也不能把候选描述为全部通过。唯一既有 SKIP 如存在，为原 Desktop 触摸专用用例；手机对应实际触摸测试继续执行。

## 冻结、安全、备份与状态保护

精确的“57 个指定文件”清单和 B 完整报告在现有附件/仓库/PR 中未取得，已请求其链接或路径，**不声称已逐项识别该清单**。既有自动检查仅列 50 文件，本次没有将其冒称为 57。

补充更强的可复验保护：冻结 base 的 95 个文件中，B 受测 2df 版本已有 **86** 个与 base 字节相同；这些 86 文件当前仍全部相同（清单及 SHA-256 另附）。且对 2df 的全部已有文件，仅允许 `src/db.ts` 和 `src/importFeedback.ts` 两处本次授权改动，其余逐字节相同。因此受测版本中任何已经零差异的冻结子集均保持零差异；精确 57 项身份仍待提供核对。

正式 Schema/副本/validator、所有独立 B 测试、历史报告、CSP/响应头/离线资源文件均未改。数据回归执行冻结实现↔候选的真实备份双向互读、restore 原子性和原生中途失败回滚；浏览器执行严格 CSP、纯文本、零外站上传、离线缓存及已导入内容离线阅读、16 层树/宽树、字号/焦点/续读/随机竞争、备份恢复屏障。逐项通过情况见完整结果；开发回归不等于独立验收。

没有部署动作：Cloudflare 项目只读核对仍 source:null、production-disabled，固定 deployment `36e604de-ef6f-465f-886c-780803941ff9`。没有上传八卡、更新 Preview、修改 main/冻结/治理/历史 QA 分支。

## 未解决事项与停止边界

- UX-01 手机入口仅设计；方案 A 不足，方案 B 的工具区/旧非零滚动布局策略等待负责人确认，生产代码未实施。
- UX-03 维持原实现、原文、原顺序和全部 caveats；关键提醒优先级仍待决定，未将候选映射升级为正式决定。
- 两个历史 summary 可见性 FAIL 保留，测试合同治理待明确决定和处理授权。
- 精确 57 文件清单身份仍是证据缺口；已有 86 文件超集及全部 2df 既有文件保护。
- WebKit、真实 iPhone Safari、VoiceOver、主屏离线冷启动、动态工具栏、OS 强杀及跨版本 SW：NOT VERIFIED。
- QA-004 当前字号按 DEC-002 为 PASS/CLOSED，历史唯一 RCA 仍 NOT CONFIRMED；QA-008 PARTIAL、条件性大库迁移 P1 OPEN。没有擅自更改历史状态或关闭 P1/P2。

提交本轮新完整候选 SHA 后停止，等待 B 对新 SHA 独立复验；本轮不宣布 UX1 完成或验收通过。
