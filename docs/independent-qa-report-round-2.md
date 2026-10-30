# Mindflow V1 第二轮独立回归验收

日期：2026-10-30（Asia/Shanghai）。身份：独立验收者 B。结论：**No-Go**。正常容量下的大库备份、粘贴入口及深树正文定位已有修复证据，但 QA-004 尚不能关闭；还存在返回树焦点问题、设置保存反馈不足及旧超容量库迁移风险。只允许使用合成数据的非生产临时环境继续验证，不作为正式技术验收通过。

## 1. 版本与独立性

- 被验收的唯一最终候选：`f784ccf806edcf070381484a657948ebd7752613`。实际检出 HEAD 与此完整 SHA 一致，未使用动态分支 HEAD 代替。前序功能提交是 `a8178a6373743f11cda60cf00097c5f963f63ef3`；二者差异仅 docs/plan.md、docs/round2-handoff.md。
- [PR #1](https://github.com/easonwycgz/mindflow/pull/1) 网页数据：headSha 精确匹配最终 SHA，headBranch=feat/mindflow-v1，baseBranch=main，state=DRAFT，mergedTime/closedTime/mergedBy 均为 null。未合并 main。
- 从最终候选建立 `qa/mindflow-v1-review-round-2`，保留本地及远端第一轮 QA 分支。没有整体合并历史 QA 提交，以免改变最终候选；候选保留的第一轮报告及两个测试与 `656b50fb739943e29dfddc55fe0661e48ff3d14f` **逐字节相同**。
- 未修改生产逻辑、依赖、锁文件、生成校验器、正式协议、原始测试或开发分支。新增本报告、独立测试及 QA 证据索引。检查 git diff 确认候选 src/ 等受保护文件无差异。
- 阅读最终版本 handoff、第一轮完整报告、AGENTS、README、正式合同、Schema、示例、源代码、原测试和本轮测试/脚本；contracts 副本与根目录 byte-identical，协议及合同相对原生产版无变更。
- 历史诊断使用 `git archive 993122a706d40e978c1f5bed3f1ee130d4051854` 导出无 Git 元数据临时副本；不是新 worktree，未改其生产代码。该历史快照的 src/e2e/lockfile 与 `740b98b` 无差异。
- 全程只有公开示例或合成数据；清空三表、事务故障和旧库模拟均限定独立测试数据库。

## 2. 当前实例独立执行结果

环境：Linux、Node24.19.0、npm11、系统 Chromium。候选 `npm ci` 清理重装 node_modules，使用自身锁文件；prepare/prebuild/pretest 生成静态 validator，最终生成文件无 tracked diff。以下是实际执行，不引用开发者数字代替测试。

| 命令/范围 | 结果 | 证据（/tmp/mindflow-qa-r2/） |
| --- | --- | --- |
| npm ci | PASS，退出0 | install.log |
| npm run typecheck | PASS，退出0 | typecheck.log |
| npm run lint | PASS，退出0 | lint.log |
| npm test（最终候选原有套件） | 17 PASS，0 FAIL/SKIP，退出0 | unit.log |
| npm run build | PASS，退出0；严格CSP静态PWA产物生成 | build.log |
| CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e（新增B测试前） | 31 PASS / 1 SKIP / 0 FAIL，29.9s，退出0 | e2e-baseline.log |
| npm audit --omit=dev --json | 0已知生产漏洞，退出0 | audit.log |
| B独立存储测试 | 2 PASS，退出0 | independent-data.log |
| 加入B测试后 npm test | 19 PASS，0 FAIL/SKIP，退出0 | combined-unit.log |
| B新增UI/诊断测试，分次执行 | 第一批6 PASS / 4 FAIL；另大库UI两项目2 PASS；无新增skip | independent-ui.log、large-ui.log |
| 加入B测试后的 typecheck/lint | PASS，退出0 | qa-typecheck.log、qa-lint.log |
| 历史原始桌面字号场景×30 | 30 PASS，55.0s | history-repeat.log |
| 最终候选同一原始场景×30 | 30 PASS，53.7s | candidate-repeat.log |
| 历史版受控字体诊断 | 等待保存完成：PASS；写锁期间立即刷新：FAIL，退出1 | history-font-diagnostic.log |

原套件唯一跳过：第一轮独立触摸测试在桌面 Chromium 项目不适用，原条件未改变；移动 Chromium 真正执行通过。没有新增skip、retry或放宽断言。WebKit的原离线测试另有专用skip；本轮未运行WebKit，不能将它计入当前31项通过。

为保留全部最终 trace，另完整执行含B测试的44项E2E：**39 PASS / 4 FAIL / 1 SKIP，57.5秒，退出1**。四个失败是字号写锁立即刷新和返回树焦点各两个项目，不是四个独立问题。失败断言作为回归证据保留，不因影响QA分支CI而删除。

首次合并执行另有1项B手势测试辅助代码在异步切换树后过早查询DOM（null dispatchEvent），该次为38 PASS / 5 FAIL / 1 SKIP。只修正B辅助代码，等待目标节点真实出现，未改产品代码或放宽“不切卡”断言；完整复跑结果如上。首次日志和trace保留在 e2e-first-combined.log、first-combined-traces/，不将QA脚本自身问题记作产品缺陷。

## 3. QA-001～QA-009逐项结论

| 项目 | 状态 | 预期与实际复验 | 代码与证据 |
| --- | --- | --- | --- |
| QA-001 备份往返 | **PASS（正常容量）** | 两张各4500子节点卡从文件UI导入→完整导出→清空全部cards/reading/settings→重新打开空库→UI恢复；逐项比较cards完整内容/层级/ID/hash/时间、reading、settings相同，两项目通过。独立DB测试再比较完整快照，错误版本、checksum、重算checksum后的错误hash/引用均拒绝且快照不变；最终settings写入中断回滚三表。原单卡边界保留，整库预算独立。旧超限库兼容另列，不计为已解决。 | src/db.ts:71、114、124、146、193；src/model.ts:37；tests/independent-round2.test.ts；e2e/independent-round2.spec.ts；large-ui.log、independent-data.log |
| QA-002 粘贴JSON | **PASS（Chromium UI）** | 从真实“粘贴JSON”按钮、textarea、“校验并导入”完成；坏JSON、缺字段、额外字段、版本错、重复均拒绝；文件/粘贴规则一致；连续两卡、刷新、关闭page后同context重开及离线重开成功。独立将clipboard.readText设为抛错仍可导入，未申请读取剪贴板权限；监测无外站请求。系统实际粘贴/iOS生命周期仍需真机。 | src/App.tsx:190、326；e2e/round2.spec.ts、e2e/independent-round2.spec.ts；independent-ui.log |
| QA-003 长树/定位 | **PARTIAL** | 原P1“正文在约6668px外”已解决；原长树回归通过。16层逐层展开、点击深层正文进入<200px视口且获得焦点，刷新后选中节点/祖先展开与位置恢复，均通过。普通竖向滚动未设置locate，不主动夺焦点。但“返回知识树”只scroll，未把焦点返回导航，新增B断言两项目失败，见R2-010。 | src/App.tsx:30–64、124–129、578–608；e2e/round2.spec.ts、independent-round2.spec.ts |
| QA-004 历史字号CI失败 | **FAIL / 未关闭** | 历史具体表现已由用户提供；正常重复60次未重现；候选未实质改变设置保存/加载及原始刷新测试同步方式。受控IDB锁竞争在旧/新均复现选择large后刷新得到normal，等待应用完成则通过。该机制不能证明历史当次唯一根因；不能据当前绿色CI关闭。详见下一节。 | 历史App:16、23、40；候选App:93–109、166–179、462–473；e2e/app.spec.ts:35；independent-font-diagnostic.spec.ts |
| QA-005 390×844首屏 | **PASS（已覆盖状态）** | 已有卡片时正文在管理区前，摘要入口落在首屏，原390px断言两项目通过；查看本轮截图确认阅读优先。空库仍提供导入；清空后空库状态在大库UI测试中确认。长标题/任意状态并非穷尽验证。 | src/style.css `.layout.has-card`移动规则；first-screen-mobile.png；原独立首屏测试 |
| QA-006 手势切卡 | **PASS（Chromium范围）** | 原移动CDP真实横触摸切卡通过；两项目原竖向真实触摸能滚动、不切卡；额外DOM TouchEvent测试覆盖按钮、模式标签、树按钮、已有文本选择、多指、79px低于阈值的排除；上一/下一张按钮可用。阈值代码80px、横纵比2、1.2s；排除测试为模拟事件，不冒称真机多指体验。 | src/App.tsx:231–278、497–535；e2e/round2.spec.ts、independent-round2.spec.ts |
| QA-007 明文告知 | **PASS** | 导出入口旁明确未经加密/明文、含知识与阅读状态、获得文件可读取及妥善保管；原独立UI断言两项目通过。 | src/App.tsx备份warning，e2e/independent-qa.spec.ts |
| QA-008 Markdown/公式 | **PARTIAL** | 标题、列表、粗体结构化显示；普通中文可读。恶意HTML惰性文本、链接/图片无外站加载，原安全测试通过。数学公式原文保留；完整公式/表格/代码块**未实现**。原协议允许plain text/restricted Markdown、无数学排版硬性条款，因此不是擅自删除既有门槛；不能宣称完整知识排版已验收。依赖复杂公式的目标卡片需要另验。 | src/ReadingText.tsx:3–18；e2e/round2.spec.ts、原安全/数学原文场景 |
| QA-009 CSP | **PASS（本地生产服务器）** | Ajv构建阶段standalone生成，浏览器不compile；dist头无unsafe-eval。测试服务器实际应用dist/_headers，导入/Markdown/备份/离线套件在严格头下运行，无对应执行错误/XSS路径。Cloudflare线上头**NOT VERIFIED**。 | scripts/generate-validator.mjs；src/model.ts:1；scripts/preview.mjs；public/_headers；e2e/round2.spec.ts |

## 4. QA-004：历史失败、根因调查及关闭依据判断

### 已知事实

历史 [run41014649370](https://github.com/easonwycgz/mindflow/actions/runs/41014649370)、job123928110503、step7；用户取得的历史日志说明原12项11通过1失败，桌面 `random recommendation excludes current card, favorites filter and large text fit` 在刷新后得到normal，预期large；移动该场景通过。本轮将其作为**用户提供的历史日志事实**，不声称重新下载到了这份日志。

历史合并快照993122a与原生产740b98b的应用、原E2E和锁文件无差异。该快照独立npm ci/build后，运行原场景30次全部通过；候选同场景30次全部通过。说明当前本地通常时序下可用，**不证明历史失败没有真实原因**。

### 代码与实验证据

1. 旧、新字体事件均是 `void action(async()=>{ const s={...settings,fontSize}; await db.settings.put(s); setSettings(s); })`。load读取三表后再setSettings，select也写整条settings；本轮未提供针对历史失败的相关逻辑修复。
2. 原测试 `selectOption('large'); page.reload()` 没有等待DB事务完成、应用large状态或保存完成信号。Playwright选择事件完成不等于异步存储事务提交。
3. B独立诊断用真实IndexedDB readwrite事务临时占用settings store（循环请求保持事务5秒），随后由真实UI选择large并立即刷新。无mock生产函数或修改代码。旧历史桌面及候选桌面/移动均复现 **Expected large / Received normal**。
4. 对照实验不增加存储锁，选择后等待 `.app.large` 等实际应用状态（该状态是在await put之后设置），再刷新，循环normal/large十次：历史桌面通过、候选桌面/移动通过。不是将失败断言改成normal。

### 可下与不可下的结论

已证明**原测试存在未同步异步提交的时序脆弱性，候选仍有同类未完成保存窗口**；已完成保存后的持久化在本地对照通过。实验失败是延迟写入条件下的立即刷新行为，不能被夸大成“正常完成保存的数据必然丢失”。候选busy只禁用了部分操作，字号无显式保存中/已保存反馈。

**历史失败表现已确认，但根因仍未确认。** 缺少历史当时DB提交/页面卸载时序证据，不能把受控写锁直接断言为GitHub当次实际条件，也不能猜测网络、浏览器或偶发波动。当前CI绿色与60次正常通过不能补上这个证据缺口。按本轮明确门槛，QA-004仍P1开放，**不能关闭，足以阻止正式技术验收通过**。

开发者下一步：提供原失败完整trace/时序或可验证根因证据；明确设置保存生命周期，给出保存中/已保存状态，处理刷新/卸载的未提交窗口；回归测试等待可观察的真实提交完成，另保留延迟存储诊断和提交后刷新断言。等待提交是同步正确性，不应删除持久化断言、增加跳过或仅重跑到绿色。

## 5. 最终SHA的托管CI与工件

| 运行 | SHA核实方式 | 状态与步骤 | 工件 |
| --- | --- | --- | --- |
| [PR41021910946](https://github.com/easonwycgz/mindflow/actions/runs/41021910946) | run标题f784ccf，job123950942502各步骤log-url含完整最终SHA；PR head完整匹配 | SUCCESS；checkout、setup、npm ci、检查链、安装浏览器、E2E、audit、上传全部success | browser-evidence-41021910946-1，273KB，网页SHA256 fe80781790560a8774d4eb0dcc397e975a1688d26c6469704e85c3b31ea31fb4 |
| [Push41021903483](https://github.com/easonwycgz/mindflow/actions/runs/41021903483) | run commit链接及job123950918516 log-url含完整最终SHA | SUCCESS，同样各完整步骤success | browser-evidence-41021903483-1，234KB，网页SHA256 27cd060bd16767248e0f244b137d5cbf435e112fbc13249da69a0a35791bf3dc |

这两次确属最终候选，未采用a8178a6的前序CI冒充。CI配置 `always` 上传报告/trace，保留14天。**工件存在、名称/摘要/步骤上传成功已核实；内容NOT VERIFIED**：`gh run download` 两次均在artifact API返回Forbidden，`gh run view --log`也Forbidden。没有下载到zip，不能声称校验过zip内容、内部E2E数字或远端每条断言；本地17/31数字是本轮自己执行得到。网页摘要SHA256不是本地文件校验成功的证据。

## 6. 本轮新增问题与兼容风险

### R2-010 / P2：返回知识树未返回键盘焦点

- 文件：src/App.tsx:587–595。
- 复现：导入示例→知识树→选节点，正文获得焦点→按“返回知识树”。
- 预期：可见导航与操作焦点一致，回到选中树节点或导航容器，继续按键可浏览树。
- 实际：只scrollIntoView；`document.activeElement.closest('#tree-navigation')`为false，焦点留在正文的返回按钮。桌面/移动独立断言均失败。
- 影响：视觉滚动正常但键盘/辅助技术上下文未跟随。不是声称已测VoiceOver。
- 建议：返回时聚焦所选树按钮/可聚焦导航，使用preventScroll配合定位；保存清晰返回路径。原QA-003正文可读性P1已修，但本扩展项使完整结论PARTIAL。

### R2-011 / P2：设置写入窗口缺少保存反馈，刷新回归未等待提交

- 文件：src/App.tsx:166–174、462–477；e2e/app.spec.ts:35–40。
- 复现：运行 independent-font-diagnostic.spec.ts 的write-contention场景；真实settings事务竞争期间，选择large后立即刷新。
- 预期：明确告知未完成保存，或在离开前确保用户理解/等待真实提交；测试应区别已触发事件与已提交。
- 实际：候选两个项目normal，历史桌面同样normal；完成保存后重复刷新则正确。
- 影响与边界：不是本轮新引入的存储算法回归，而是本轮独立确认、仍未处理的保存反馈/测试同步问题。历史CI同症状的唯一根因仍不能定论；不把本P2替代原QA-004的P1门槛。
- 建议：显式保存生命周期与失败反馈、避免旧settings覆盖并测试延迟存储；保留提交后持久化要求。

### R2-C01 / P1兼容风险：旧版合法超容量库无法从新版UI导出迁移

- 文件：src/db.ts:114–147；payloadSchema最大500卡；README容量说明。
- 复现：在独立fake-indexeddb构造旧v1同表结构501张有效、不同hash的合成卡及501条reading；新版读取仍保留这些记录，但backup被500卡限制拒绝。原版import无整库上限，因此并非只有损坏库才可能出现。
- 预期：升级已有用户时保留读取与安全迁出能力；不能把超出新限制的既有数据当作可丢弃异常数据。
- 实际：记录未被删除，但没有分卷/原始数据迁出UI；新增导入也拒绝。这是开发者已声明但**尚未解决**的限制，当前测试证实风险，非本轮新发现未披露功能。
- 影响：现有超限用户无法按常规UI制作新备份；没有证据证明当前存在真实受影响用户，也未观察到自动删除。若要支持旧版用户升级，此为P1迁移阻断；只用合成新库的临时验证不受影响。
- 建议：发布前确认用户范围并提供经过往返验证的分卷/迁出方案或明确兼容路径。不要清空真实数据、悄悄截断卡片、将旧合法库统称损坏库。

未确认P0。没有证据显示本轮修改新增了未经授权上传或XSS。R2-010是新增界面的具体P2；R2-011是继承风险的本轮实证；R2-C01是已知兼容缺口。

## 7. 隐私、协议与未验证范围

- 所有破坏性恢复均为合成；两张4500节点UI测试对三表真实清空再恢复，非仅同库覆盖或调用底层import装作UI测试。
- 新粘贴没有clipboard.readText调用或权限申请；测试替换为拒绝也通过。网络监测未见外站请求，源代码未发现上传/遥测/危险HTML解释器；受限Markdown只构建React元素。source URL和图片保持惰性，数学原文不执行。
- 原正式合同允许纯文本或受限Markdown，没有完整公式、表格、代码块排版条款。V1.1延期不使基本文本协议自动不合格；但数学密集实际目标样本尚需产品验收，QA-008只能PARTIAL，不能改成全部PASS。
- CSP在本地生产服务器真实施加，浏览器没有动态Ajv compile。Cloudflare响应头不因此自动通过；npm audit只覆盖生产已知漏洞，不是全面安全保证。

以下全部 **NOT VERIFIED**：

1. WebKit/Safari。前次下载403，当前未安装/运行；Chromium移动仿真不是Safari。
2. 真实iPhone设备、主屏安装、离线冷启动、强制终止后的恢复与系统驱逐。
3. VoiceOver、真实iOS系统粘贴/文件下载分享/手势及安全区。
4. 跨版本Service Worker更新和升级数据存活；当前离线刷新自动化已过，但不代表更新链。
5. Cloudflare HTTPS部署、真实线上CSP/缓存头、站点发布SHA一致性。
6. 两次最终CI浏览器工件的实际文件内容（API拒绝）。
7. 旧超容量库分卷迁移UI未实现，不能标作仅“测试未跑”的功能。

暂不执行Cloudflare部署或合并PR；无真实私人数据用于上述测试。

## 8. 发布决定与下一步

1. **QA-001、002、003是否真正修复？** 正常容量大库备份、真实UI粘贴、深树正文位置这三项原P1核心均有独立通过证据；QA-003完整复验仍PARTIAL，返回焦点P2未修。QA-001的PASS不覆盖旧超容量迁移。
2. **QA-004能否关闭？** 不能。历史具体失败已确认，正常重复未重现；受控实验揭示未提交窗口在新旧均存在，但历史当次唯一根因仍未确认，不能以CI绿关闭。
3. **新P1/P2？** 新确认返回焦点P2、继承的保存反馈/测试同步P2；已知旧超容量迁移存在条件性P1兼容风险。QA-004原P1继续开放。
4. **能否进入下一阶段？** 按本轮门槛，不作为已通过技术验收的候选进入正式Cloudflare/iPhone阶段；最多用合成数据、非生产临时环境继续取得HTTPS与真机证据。
5. **是否仍禁止正式部署？** 是，不批准正式生产部署、稳定发布或合并。先解释/解决QA-004，处理需支持的旧库迁移，再明确候选SHA与未验证设备门槛。

修复后复验应针对新的完整SHA；本次QA分支提交只增加报告与测试，不能视为应用修复候选。若仅补根因证据而未改变代码，可继续检验f784ccf，但仍需明确关闭依据；不要悄悄换用feature动态HEAD。

## 9. 证据和复现入口

- 报告：docs/independent-qa-report-round-2.md；第一轮 docs/independent-qa-report.md 保留。
- 新增：tests/independent-round2.test.ts、e2e/independent-round2.spec.ts、e2e/independent-font-diagnostic.spec.ts。既有独立及开发者测试未改。
- 原始日志、两次最终CI及PR网页、截图在 **/tmp/mindflow-qa-r2/**；历史无Git副本在 **/tmp/mindflow-history-993122a/**。旧日志与本轮目录分开。工件未提交，遵守AGENTS。
- 当前最终HTML/trace在ignored playwright-report/、test-results/；本地临时文件不保证能在新机器恢复，关键数字/结论已写入报告。只有这些实际本地证据可读，不虚构远端工件下载成功。

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
npm audit --omit=dev

# 不含新增B测试时复验开发者数字，须用精确文件列表
npm test -- tests/data.test.ts tests/independent-qa.test.ts tests/round2.test.ts
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e -- e2e/app.spec.ts e2e/independent-qa.spec.ts e2e/round2.spec.ts
# 历史/候选相同原桌面场景，在各自工作目录执行
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e -- e2e/app.spec.ts --project=chromium -g 'random recommendation' --repeat-each=30
```

运行含B诊断的完整E2E应保留焦点和写锁立即刷新失败，不应为了交付绿色QA分支而删除。新增诊断明确区分存储竞争条件和一般用户操作。

本轮最终完整浏览器日志：`/tmp/mindflow-qa-r2/e2e-with-independent.log`；当前HTML报告为 `playwright-report/index.html`，四个失败的trace在 `test-results/`。原套件31/1与加入独立回归后的39/4/1分别报告，不能混为同一次全绿。最终B测试typecheck/lint均通过；19项数据测试全部通过。
