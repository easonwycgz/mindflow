# Mindflow V1 独立技术验收报告

验收日期：2026-10-30（Asia/Shanghai）。结论：**No-Go（当前版本不宜发布稳定版，也不宜作为已通过技术验收的部署候选）**。

## 1. 版本、隔离和证据范围

- 唯一被验收的生产代码 Commit：`740b98bb0d6f0bf9214e12345bdb51b3e4d605fa`。
- 通过 Git fetch 获取对象，确认 Commit 存在；从该 Commit 创建并检出 `qa/mindflow-v1-review`。安装前 checkout 干净，无旧 node_modules。未修改 main 或 feat/mindflow-v1。
- 开发 PR：[easonwycgz/mindflow#1](https://github.com/easonwycgz/mindflow/pull/1)。Git `refs/pull/1/head` 和 PR 网页 headSha 均等于上述 SHA；网页 headBranch 为 feat/mindflow-v1。
- 读取全部 src/、现有 tests/、e2e/、配置、README、AGENTS、正式合同、contracts、docs/qa-evidence.md、docs/decisions.md 和 docs/plan.md。原始根目录协议/示例/验收合同相对初始基线未变；contracts 两份副本字节相同。
- QA 新增文件仅为本报告和独立测试，不修改生产逻辑、原测试、协议、依赖或锁文件。故失败测试保留为回归验收依据。
- 环境：Linux，Node 24.19.0；npm ci 使用提交的锁文件；系统 Chromium。桌面和 Chromium 移动模拟不是 Safari 或 iPhone 真机。
- 全程仅使用公开示例及合成数据，没有使用真实私人对话或备份。

## 2. 执行结果

以下原有命令在新增 QA 测试之前执行，退出码均保存；不将新增测试失败混淆为原测试通过。

| 检查 | 独立执行结果 | 与开发者报告比较 |
| --- | --- | --- |
| npm ci | PASS，退出 0 | 一致 |
| npm run typecheck | PASS，退出 0 | 一致 |
| npm run lint | PASS，退出 0 | 一致 |
| npm test（原套件） | PASS，10/10，退出 0 | 一致 |
| npm run build | PASS，退出 0；10 个预缓存条目，599.18 KiB | 一致；仍有主 JS 591.11 kB 警告 |
| CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e（原套件） | PASS，12/12，15.1 秒，退出 0 | 一致；系统浏览器覆盖 |
| npm audit --omit=dev --json | PASS，退出 0，生产依赖 0 已知漏洞 | 一致；不代表全供应链无风险 |
| 新增独立单元/IndexedDB 测试 | **3 PASS / 1 FAIL**，退出 1 | 发现原测试遗漏的自有备份不可恢复 |
| 新增独立 E2E | **2 PASS / 9 FAIL / 1 SKIPPED**，42 秒，退出 1 | 6 场景×2项目；桌面项目跳过触摸专用场景 |
| 加入 QA 测试后的 typecheck / lint | PASS | 新增失败不是语法或类型错误 |
| Playwright WebKit 安装 | BLOCKED，退出 1，下载域名返回 HTTP 403 Domain forbidden | **NOT VERIFIED**，未执行 WebKit 测试 |

独立新增测试通过：16 层边界接受/17 层与161字标题拒绝；导入时 reading 创建失败使 cards/reading 一起回滚且可重试；并发重复导入只成功一次；恶意 HTML、Markdown、数学符号、链接以惰性文本显示，无脚本执行、无外站请求（两个 Chromium 项目）。

独立失败用例反映 5 类产品/告知问题和 1 类备份问题，并非 10 个不同缺陷。未删除、跳过或反转这些失败断言。滑动、首屏、长树定位属于本次明确产品要求，不能倒称原合同已经逐字规定了它们。

### GitHub Actions：与本地分开判断

- [push run #1](https://github.com/easonwycgz/mindflow/actions/runs/41012863492)：网页列出指定 Commit `740b98b`，结论 SUCCESS。
- [PR run #2](https://github.com/easonwycgz/mindflow/actions/runs/41014649370)：指定 Commit，结论 **FAILURE**。网页详情显示安装依赖、typecheck/lint/unit/build 和浏览器安装成功；[步骤7 npm run test:e2e](https://github.com/easonwycgz/mindflow/actions/runs/41014649370/job/123928110503#step:7:64) 失败，退出 1。
- GitHub API 查询 PR/check-runs 均 Forbidden；使用可访问网页和 Git refs 交叉核实。尝试详细日志路由返回404，**具体失败断言及根因 NOT VERIFIED**；不能推断为环境问题或忽略，也不能以本地12项通过替代 PR CI。
- ci.yml 包含 install、类型/lint/unit/build、Chromium E2E，但未执行 npm audit、WebKit，也未配置失败时上传 trace/HTML 报告。建议补充证据保留。

## 3. 缺陷清单与开发者 A 交接

未确认 P0。确认 P1 四项、P2 五项（含 CI 尚未解释的阻断项）。P1/P2 表示缺陷严重度，不把合同“P0验收门槛”标题机械转换为每项缺陷的严重度。

### QA-001 / P1：合法知识库导出的完整备份无法被本应用恢复

- 位置：src/db.ts:27–32；src/model.ts:10–16。
- 复现：运行 `npm test -- tests/independent-qa.test.ts` 最后一项；导入两张不同标题的合成卡，每张一个根节点加4500个直接子节点；两次导入成功；调用 backup；再 restore 该字符串。
- 预期：成功生成的“完整备份”可恢复内容、阅读状态和设置；若库超限，导出前明确拦截并提供可恢复的分卷方案。
- 实际：导出成功，恢复抛出“JSON 层级或节点数量超限”。单卡合法且小于2 MiB，但整库共享50,000 JSON value计数导致失败。backup 没有对齐 restore 的约束；同样存在导入无限卡而恢复最多500卡/40MiB的不对称路径（后两项为代码证据，未另跑极限规模测试）。
- 证据：independent-unit.log，测试第36行拒绝而非 resolve，栈为 bounded → parseJSON → restore。3项其他独立测试通过。
- 影响：用户可能在相信备份成功后清理原库，才发现无法恢复。尚未观察到本次失败恢复破坏现有数据，因此定 P1，而非声称已发生P0数据损坏。
- 建议：统一导入容量、导出和恢复限制；对整库设合理独立预算并逐卡约束；确保每个可导出库往返通过，或提供明确分卷且可恢复的导出。不要仅扩大一个魔数或删除失败用例。
- **发布前必须修复。**

### QA-002 / P1：缺少直接粘贴 JSON 导入，核心使用流程中断

- 位置：src/App.tsx:26、32，只有 file input，没有 textarea/contenteditable/粘贴入口。
- 复现：打开应用，复制完整合法 JSON，寻找直接粘贴导入；执行独立 E2E “direct JSON paste entry exists”。
- 预期：ChatGPT → 复制 → iPhone PWA → 粘贴 → 校验并导入，不要求先创建文件。
- 实际：只有文件选择器和“体验示例”；两个 Chromium 项目均未找到粘贴入口。用户需借助其他应用创建 JSON 文件，显著增加 iPhone 核心路径成本。
- 证据：independent-e2e.log，入口计数0；源代码复核。不是剪贴板授权失败，而是功能不存在。
- 建议：增加本地多行文本入口，支持系统粘贴并复用 importCard、字节/深度/去重校验、错误提示和原库保留；不必依赖可能被 iOS 限制的自动 clipboard.readText。
- 原合同未逐字要求剪贴板；本次产品明确核心流程下为**发布前必须修复**。

### QA-003 / P1：长知识树选择节点后正文远离视口，缺少逐层展开导航

- 位置：src/App.tsx:7–8、45。
- 复现：导入独立 E2E 的12个分支、每个80次重复中文摘要的合法合成卡；390×844视口进入知识树，点第一个分支。
- 预期：能在点击位置或可见的独立阅读区域阅读该节点；分层导航可以逐层展开，避免整树占满页面。
- 实际：所有后代永远展开，正文仅追加在完整树之后；点击后正文仍位于视口坐标 y=6668.484375，两项目一致。没有滚动、焦点移动或可折叠树；易误以为点击无效。
- 证据：独立 “selecting tree node…” 测试失败；测试证明正文存在但不可在当前屏幕阅读，非数据丢失。
- 建议：内联展开正文/可折叠层级或独立节点阅读页；选择后使正文可见并管理键盘/辅助技术焦点，保留返回路径与状态；测试16层和长中文。
- **发布前必须修复核心节点可读性；动画与高级树布局可延后。**

### QA-004 / P1：指定 Commit 的 PR CI E2E 失败且原因未解释

- 位置：.github/workflows/ci.yml；PR #1，run41014649370，job123928110503，step7。
- 复现：打开上述失败 run 与 job 页面。
- 预期：发布候选对应的 PR 检查通过，或有明确、可复现且已解决的失败解释。
- 实际：push run成功但PR run E2E失败；本地原测试12项通过。失败步骤与退出1已确认，详细日志不可获得。
- 证据：独立保存的 Actions/运行/job网页和步骤属性；不是推测“CI没运行”。
- 建议：开发者获取该 run 完整日志，复现并修复原因；增加 always/失败工件上传；使用新候选 SHA 获得绿色 PR CI。禁止直接归因为瞬时波动而关闭缺陷。
- **进入正式部署验收前解除；详细根因 NOT VERIFIED。**

### QA-005 / P2：返回用户首屏仍以库管理为主

- 位置：src/App.tsx:31–43；src/style.css 移动媒体查询。
- 复现：390×844导入公开示例，关提示，刷新回到已有卡片。查看截图 first-screen-chromium-mobile.png。
- 预期：已有卡片时首屏可直接看到主要阅读内容及模式入口。
- 实际：品牌、口号、导入、搜索、收藏筛选、列表、设置全部排在正文之前；“30秒摘要”标签 y=1036.546875，超出844px首屏。需先滚过管理区。全页截图人工查看确认该布局；这不是人工 Safari 测试。
- 证据：两个项目均以390px运行的首屏断言失败，截图和测量附件；原“无横向溢出”通过并不能证明阅读优先。
- 建议：已有库默认阅读优先；将库管理置于抽屉/独立页，提供清晰可触达的切卡与返回库入口。建议在下一候选修正；不是应用完全不可用。

### QA-006 / P2：缺少触摸滑动切卡

- 位置：src/App.tsx 全部交互，无 touch/pointer 手势处理；src/style.css 无相应实现。
- 复现：移动 Chromium 导入两卡，在阅读区用CDP真实触摸序列从 x340 滑至 x40；独立 “real Chromium touch swipe…” 测试。
- 预期：产品要求的自然横向滑动可切到另一张卡，竖向知识树阅读不受干扰。
- 实际：标题仍为第二张，第一张未切入DOM；当前仅列表按钮和随机按钮可切卡。桌面项目该触摸场景跳过，iPhone实机 NOT VERIFIED。
- 证据：移动触摸测试失败及无手势处理的代码证据。
- 建议：限定阅读区、方向锁定与阈值，保留竖向滚动；提供显式上一张/下一张可访问按钮。原正式合同仅要求随机切换，不能据此声称违背逐字“滑动”条款；按本次产品目标列为待修，若本轮承诺滑动则应纳入发布范围。

### QA-007 / P2：备份界面没有明确“未加密/明文”提示

- 位置：src/App.tsx:37–40。
- 复现：展开“备份、设置与隐私”，导出备份并阅读当前提示。
- 预期：用户在导出前知道文件为未加密私人数据，可能被读取/同步/分享，应安全存放。
- 实际：只有浏览器数据丢失和妥善保管提示；未声明未加密。README 已声明，产品界面未声明。
- 证据：两个项目的独立 warning 测试失败；backup 输出明文 JSON。
- 建议：导出入口旁明确说明，避免让用户把校验和误当加密。建议发布前随修；未发现真实泄漏。

### QA-008 / P2：纯文本渲染不提供结构化 Markdown/公式阅读

- 位置：src/App.tsx:44–46；docs/decisions.md。
- 复现：导入合成 summary 含 `## 标题`、`**专业术语**`、`$x^2$`、Markdown链接；进入摘要、节点或FAQ。
- 预期：至少能理解基本知识文本；专业数学内容如承诺支持，需要适当排版。
- 实际：原标记直接显示，不能形成富文本标题、表格或排版公式；普通中文、树内容与FAQ可读，HTML无执行。独立安全场景通过。
- 证据：安全测试看到完整原始字符串；README和决策已明确该限制。
- 建议：V1普通文本阅读可接受此受限行为，**不把缺少通用富Markdown直接定为阻断**。若首批卡片依赖复杂公式/表格，则应先验证目标样本，提供安全受限渲染或调整内容生产规范；禁止直接启用任意HTML或远程图片。

### QA-009 / P2：CSP 对全部同源脚本允许 unsafe-eval

- 位置：public/_headers:2；src/model.ts:8–9。
- 复现：读取生成 dist/_headers；追踪 Ajv 运行时 compile。
- 预期：静态已知协议可预编译，减少生产页面动态代码执行权限。
- 实际：script-src 包含 unsafe-eval，当前 Ajv编译依赖它；不是未经诊断可直接删除的权限。未发现用户内容进入 eval 的路径，未证明可利用XSS。
- 证据：部署头及运行时编译代码。Vite preview 不执行 Cloudflare _headers，因此部署头实际生效 **NOT VERIFIED**。
- 建议：构建时生成 Ajv standalone validator，并在严格CSP下回归；移除运行时编译后去掉 unsafe-eval。属于纵深防御，不虚构为已发生隐私泄漏。

## 4. 正式合同覆盖与差异

| 合同要求 | 本次结论 |
| --- | --- |
| 唯一Schema/示例、内容与阅读分离、生成ID/hash、深度/大小限制 | PASS，原字节保留，现有与新增测试支持 |
| 无效JSON、缺字段、重复ID/内容、畸形树不破坏旧数据 | PASS（现有自动化）；新增导入事务故障/并发重复测试通过 |
| 主屏PWA离线启动 | Chromium SW受控刷新 PASS；iPhone主屏安装及离线冷启动 **NOT VERIFIED** |
| 存储、收藏、字号、阅读位置跨刷新持久化 | Chromium自动化 PASS；操作系统杀进程/驱逐/真机重启 **NOT VERIFIED** |
| 摘要、递归树、FAQ、随机、搜索、收藏 | 基本功能 PASS；长树阅读存在 QA-003，滑动不是合同逐字要求 |
| 备份完整性及失败不破坏旧数据 | 小库往返、错误备份保留、事务回滚 PASS；完整备份可恢复不满足 QA-001 |
| 安全区、可触达、长中文及可访问性交互 | 样例移动无横向溢出 PASS，已查看390px截图；首屏/长树问题存在，真机安全区及VoiceOver **NOT VERIFIED** |
| 私人内容不部署、不上传 | 当前代码、目标Commit文件与dist审查未发现真实私人数据或上传路径；不是对未知用户身份数据的绝对证明 |
| 单元/集成/E2E及可复现结果 | 原套件PASS；新增测试暴露失败；PR CI E2E失败 |
| Cloudflare构建/部署文档 | build及部署说明 PASS；真实Cloudflare部署、HTTPS头和更新 **NOT VERIFIED** |
| 区分自动化、手工、iOS | 本报告严格分开；浏览器截图人工查看不等于手动端到端走查 |

正式合同实际存在于根目录，未缺失或降低标准。A/B/C来自本次产品补充要求；Markdown富渲染是已声明限制，不能与HTML安全等同。

## 5. 隐私与安全审查

- 源代码未发现 fetch/XMLHttpRequest/sendBeacon/WebSocket、第三方分析或后端上传逻辑；应用所需网络为同源程序资源及SW。恶意合成内容请求监测未见外站请求，两项目均通过。
- React将所有用户内容渲染为文本；无 dangerouslySetInnerHTML，来源URL不自动打开，Markdown图片不加载。javascript链接也仅显示文本。
- 私人内容存于IndexedDB；显式下载备份使用Blob URL，未把卡片串入页面URL或控制台日志。对目标Commit追踪文件、源代码和dist资源清单的检查只发现公开演示样本，未发现真实私人JSON/备份/.env。未穷尽所有远端历史、用户设备或外部部署。
- SW仅预缓存10个程序资源，没有私人IndexedDB导出或运行时私人内容缓存规则；IndexedDB和CacheStorage均属于同源设备存储，不等于公开网络发布。离线E2E验证了程序和本地数据可读，不证明iOS生命周期行为。
- CSP限制同源连接/图片、禁frame/object，但 unsafe-eval 尚可收紧，见QA-009；生产站点实际响应头未验证。
- 备份checksum为无密钥SHA-256，只检出意外损坏，不提供保密性或来源认证。README说明正确，UI需补提示QA-007。
- 生产审计0漏洞不覆盖dev依赖，也不证明没有未知漏洞。未发现可确认的P0泄漏。

## 6. 未验证范围与iPhone真机清单

以下全部标记 **NOT VERIFIED**，不可写成通过：WebKit/Safari、真实Cloudflare部署、iPhone安装、iOS离线冷启动、VoiceOver、系统回收、跨版本更新。即使未来WebKit自动化通过，也不替代真实设备。

开发者修复并给出新SHA后，部署该候选至无真实私人数据的HTTPS验收站，记录URL、实际构建SHA、iPhone型号、iOS/Safari版本、安装方式和日期，完成：

1. 首次联网缓存完成；Safari分享添加到主屏；已有卡片启动直接进入阅读。
2. 从ChatGPT复制公开JSON，系统粘贴导入；拒绝错误/超大/重复/过深输入，旧数据保持。
3. 多层树展开、节点正文、长中文、FAQ、术语/公式目标样本；滑动阈值不抢竖向滚动。
4. 搜索/收藏/随机或前后切卡；字体、节点、阅读位置跨退出重开持久化；横竖屏和大字不遮挡。
5. 飞行模式、强制退出后主屏冷启动；刷新、阅读、搜索与切卡，证明无需内容服务器。
6. iOS文件下载/分享与备份恢复；小库及接近容量上限完整往返；错误校验和/版本/引用保留原库；导出前显示未加密风险。
7. VoiceOver/键盘顺序、焦点、按钮名称、触控尺寸；刘海和Home Indicator安全区。
8. 安装新SW版本，显式更新且卡片/收藏/设置保留；HTTPS实际CSP/缓存头；禁止外站网络。
9. 存储不可用、空间不足、后台中断的提示与恢复；明确系统驱逐风险，不以破坏真实私人数据测试。

## 7. 证据保存和复现

代码：`tests/independent-qa.test.ts`、`e2e/independent-qa.spec.ts`；本报告为 `docs/independent-qa-report.md`。

原始当前实例证据保留在 **/tmp/mindflow-qa/**：install.log、typecheck.log、lint.log、unit.log、build.log、audit.log、e2e-original.log、independent-unit.log、independent-e2e.log、webkit-install.log、PR/Actions/失败run/job网页、PR refs、first-screen截图等。失败trace/测量附件和HTML报告在 checkout 的 ignored `test-results/`、`playwright-report/`。按AGENTS不提交生成构建/测试工件；这些本地证据不保证在另一台机器存在，应在本实例取阅，关键结果已写入本报告。

复现（QA分支）：

```sh
npm ci
npm run typecheck
npm run lint
npm test  # 合并套件预计13通过、1失败；不能把退出1描述为通过
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e -- e2e/app.spec.ts
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e -- e2e/independent-qa.spec.ts --timeout=6000
npm audit --omit=dev
```

WebKit下载策略允许且浏览器就绪后再执行 `npx playwright install --with-deps webkit` 和 `TEST_WEBKIT=1 npm run test:e2e`；原离线测试会主动skip WebKit，不能以总套件完成误称离线验证。新增触摸测试仅Chromium移动项目可执行，也不能误称为iPhone测试。

## 8. 发布建议与下一轮

**No-Go**。必须先交开发者A修复QA-001/002/003，并解释和解除QA-004；建议同时处理QA-005/006/007。QA-008/009可在明确受限内容支持和安全风险下安排后续，不能隐瞒。

目前可建立仅含公开合成数据的临时部署以辅助排查，但**不能作为通过独立技术验收后进入正式部署验收的候选，也不能稳定发布**。修复P1并取得新SHA的PR绿色CI后，可以进入Cloudflare HTTPS与真实iPhone验收；真机结果完成前仍不能宣称发布门槛全部通过。

下一轮应针对开发者A修复后提供的**新的完整Commit SHA**（继承本次基线并包含上述修复），当前无法预先知道该SHA。QA报告/测试提交的SHA不是应用修复版本，不能拿来替代开发者候选。使用同一新SHA复跑原套件及保留的QA回归，再核对部署构建SHA与iPhone证据。
