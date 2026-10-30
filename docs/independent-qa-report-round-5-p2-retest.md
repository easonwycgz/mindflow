# Mindflow V1 第五轮 P2 独立定向复验

结论：**R5-001 PASS，建议 CLOSED；正式生产发布仍为 NO-GO。** 本轮未发现新的 P1/P2，也未发现已验证的数据完整性机制回归。此结论仅覆盖下述实际执行范围，不批准合并或部署。

## 1. 候选身份与独立性

唯一应用候选：`df48c9d2eae22f3fc97487db80ab61b59813adc9`。

| 核对项目 | 独立结果 |
| --- | --- |
| PR #1 head | 与候选完整 SHA 一致；开始、结束均检查 |
| 远程 feat/mindflow-v1 | 与候选完整 SHA 一致；开始、结束均检查 |
| PR 状态 | DRAFT，未合并 |
| PR CI | [41055762320](https://github.com/easonwycgz/mindflow/actions/runs/41055762320)，SUCCESS；job 124062769809 |
| push CI | [41055755638](https://github.com/easonwycgz/mindflow/actions/runs/41055755638)，SUCCESS；job 124062747699 |
| CI 与候选绑定 | 两个 job 的 15 个步骤均 success；各步骤公开 log URL 均包含候选完整 SHA |
| 测试期间候选变化 | 未发现；结束时 PR head、远程 feature 仍为指定 SHA |

通过公开 PR/Actions HTML 的结构化数据及 check-step 属性核对，而非采信交接文字。两项 CI 的安装、types/lint、数据回归、构建、浏览器回归、生产审计、证据汇总与上传步骤均成功。未下载受访问限制的 Actions 内部完整日志/工件，不将 CI 绿灯当作 B 的执行数量。身份原始提取见 [identity.json](evidence/round5-p2-retest/identity.json)。

在原独立分支 `qa/mindflow-v1-review-round-5` 上保留 `b250a868757cecd9945b436a0011fef98f189ad6` 的完整验收历史，并引入指定候选。实际运行的 `src`、`public`、`contracts`、工作流、依赖锁及构建/浏览器配置与候选完全一致；候选的 53 条源码/配置/测试指纹全部匹配。B 只新增本报告、合成文本证据、两个针对性浏览器场景和证据索引，没有自行修改生产代码或旧测试。

环境：Linux x86_64、Node v24.19.0、npm 11.9.0、系统 Chromium 154.0.8037.57、Playwright 桌面和 Pixel 7 模拟项目；本地生产构建及仓库严格 CSP 预览。数据测试使用 fake-indexeddb，浏览器数据测试使用真实 IndexedDB。仅使用公开示例和合成测试数据。执行时间：2026-10-30 21:03–21:06，Asia/Shanghai。

## 2. 原两项 P2 失败断言

原证据：[第五轮独立报告](independent-qa-report-round-5.md)，R5-001：`acceptDownloads:false` 下浏览器下载失败，但进度宣称“这些文件仍在设备下载位置”。

本轮逐字节保留并执行 `e2e/independent-round5.spec.ts` 中原测试：

`blocked browser download is not verified as saved; cancellation preserves source`

| 项目 | 预期 | 本轮实际 |
| --- | --- | --- |
| 桌面 Chromium | 下载失败时不得承诺设备文件存在；取消后源三表不变 | PASS |
| 移动 Chromium | 同上 | PASS |

复现过程仍为：真实 UI 导入示例 → migration.html → 禁用 Directory API → 发起逐卷下载 → 等待 Playwright 的真实 download.failure → 检查原进度文案断言 → 取消 → 逐项比较 cards/reading/settings。

两个项目中 download.failure 均非空；原错误句不再出现；应用显示“当前无法确认这些请求是否保存成功”，并仅要求保留“已成功保存的文件（如有）”。没有显示完整迁移成功。取消后源数据库完全一致。**原 2 FAIL 现在为 2 PASS，未修改原断言。**

代码证据：`src/LargeMigration.tsx:132` 将 click 正常返回记录为 requested/无法确认；`:317` 的进度不再承诺文件存在；`:465` 区分迁出取消与此前下载的未知保存结果。

## 3. 下载状态矩阵

以下均在桌面、移动 Chromium 独立执行，不以截图或名称推断底层状态。测试检查真实 download 事件/文件字节或明确注入的异常、DOM data-download-state、迁移状态及数据库实际内容。

| 场景 | 实际行为与证据 | 判定 |
| --- | --- | --- |
| 正常发起并实际下载 | download.failure=null，能读取真实文件并解析；产品仍为 requested，“无法确认浏览器是否接受请求或是否保存成功”；不会自动继续 | PASS |
| 真实浏览器策略拒绝，无网页回执 | acceptDownloads=false，外部测试能观察到 failure；网页只得到 click 返回，因此保持 requested/unknown，提示检查下载记录，不虚构自动检测或保存成功 | PASS（无回执语义） |
| 网页可观察的明确拒绝 | 在真实下载点击处分别抛 NotAllowedError、SecurityError；状态 blocked，提示未能启动或被阻止，流程停止，原库不变 | PASS（故障注入） |
| 无下载回执 | 实际允许及实际拒绝下载均未产生产品可用的完成回执；产品始终表达保存结果无法确认 | PASS |
| 用户取消迁出 | 状态 cancelled，说明迁出取消及已有请求保存未知；流程停止、集合不完整、源三表不变 | PASS |
| 网页可观察下载取消 | 点击处抛 AbortError，状态 cancelled、流程未完成，不显示成功 | PASS（故障注入） |
| 下载异常 | 点击处抛 QuotaExceededError，状态 failed，明确失败/保存未知、原库保留；解除故障后实际重试下载正常 | PASS（故障注入） |
| 用户报告被阻止或取消 | 点击用户反馈按钮，明确使用“你已报告”；状态 blocked/cancelled、停止迁出，不称浏览器已确认 | PASS |
| 用户声明已保存并继续 | 当前卷确实有请求才允许继续；下一文件等待状态清除反馈且继续按钮重新禁用；全套请求结束仍为“磁盘保存尚未验证” | PASS |
| 重复请求 | 相同文件内容一致，distinct 文件请求计数仍为 1，不提升保存状态 | PASS |
| 重试及跨文件状态 | 新迁出清空反馈/计数；每个新文件清空前文件反馈；失败后真实重试恢复 requested/unknown，不沿用 blocked/failed/cancelled | PASS |
| 已请求一次后再次请求异常 | 原请求后注入同步 QuotaExceededError，failed 覆盖 requested；旧计数仍准确表示历史请求，进度保持未知；全新重试先清零再实际下载 | PASS |

真实策略拒绝在本环境的外部 failure 文本为 `Pass { acceptDownloads: true } when you are creating your browser context.`。这是浏览器测试上下文的下载策略控制；网页没有因此获得 DOM 下载结果回执。测试没有把外部 Playwright 的知识伪造为产品能力。独立观察到的“未自动切换 blocked”符合无回执时应报告未知的要求；用户反馈后才明确记录用户报告的 blocked。

异常注入覆盖产品可观察的分类分支，不代表已验证操作系统磁盘写满、OS 下载取消或 Safari 的错误回执。上述真实平台场景继续 NOT VERIFIED。

代码核对：`LargeMigration.tsx:84` 重置每次迁出；`:116` 新文件重置；`:144` 按可观察错误分类；`:168` 用户报告使用独立措辞；`:279` 仅成功发起请求后启用用户继续；`:127` 全套请求完成仍不确认磁盘保存。没有新增 saved/system-verified 状态，也没有异步下载完成回调把后续失败覆盖成成功。Object URL 定时清理仅负责释放资源，不修改反馈状态。

## 4. 必要数据保护回归

| 边界 | 独立执行与实际结果 |
| --- | --- |
| 取消、拒绝、异常 | 每个相关 UI 测试在开始/结束比较源 cards、reading、settings 的全部记录；一致 |
| 不完整文件 | 仅选清单时原子替换按钮 disabled；不能把请求次数当成可恢复备份 |
| 下载后文件替换/篡改 | 将实际下载卷同名内容换成 `{}`，明确拒绝，不能提交，源库不变；重新选择原始文件可完整恢复，最终三表完全一致 |
| 正常逐卷下载 | 实际下载单卷及清单、验证 totalParts/totalBytes、重新导入后完整恢复；严格 CSP 响应包含 script-src self、无 unsafe-eval |
| 原始收藏篡改及业务字段 | 真实 IndexedDB 原生故障测试修改已暂存的数据，完整性拒绝、目标全量一致；刷新后重新暂存原文件可恢复 |
| 验证后、目标事务开始前篡改 | B 数据测试确实修改参与恢复的暂存 reading；拒绝且目标三表完全回滚 |
| 私有快照实际写入边界 | B 数据测试在目标 reading.bulkAdd 前提交另一连接的内容/收藏/阅读位置修改；最终写入仍与原始验证快照全量一致；原生浏览器 add 边界竞争测试同样通过 |
| 最终设置证明边界 | 外部修改 manifest 证明后，目标仍写原已验证 settings 私有值，无污染 |
| 写入后取消及重试 | 实际产生写请求后取消；目标三表回滚；相同原始暂存重试成功且与源完整相等 |

`src/pagedMigration.ts`、db/model/settings/volumes/schema 均与第五轮已通过版本字节相同。完整性证明及私有值写入可见 `pagedMigration.ts:475`、`:528`、`:571`、`:596`、`:615`。本轮保持 **R4-001 PASS/CLOSED**，没有要求开发者重新整改已通过的机制。

## 5. B 实际执行数量与命令

| B 本轮实际执行 | PASS | FAIL | SKIP |
| --- | ---: | ---: | ---: |
| tests/independent-round5.test.ts | 4 | 0 | 0 |
| 原 B e2e/independent-round5.spec.ts | 4 | 0 | 0 |
| A e2e/round5-p2.spec.ts，经 B 独立执行和检查断言 | 14 | 0 | 0 |
| B 新增跨文件/先请求再异常场景，2 场景 × 2 项目 | 4 | 0 | 0 |
| 选取 e2e/round5.spec.ts 原生字段及提交竞争场景，2 × 2 项目 | 4 | 0 | 0 |
| **数据合计** | **4** | **0** | **0** |
| **浏览器合计（包含原两项 P2）** | **26** | **0** | **0** |

浏览器两次命令分别为 18 PASS / 8 PASS；不是把 A 交接所称“26 项”直接作为 B 的结果。虽然合计碰巧相同，本轮选取的测试不同，没有重跑 A 的 2001 卡大型下载场景。14 项复用测试的源码及断言已检查，本轮由 B 实际执行，未视为 B 新设计的 14 项。

```sh
npm run typecheck
npm run lint
npm test -- tests/independent-round5.test.ts --reporter=verbose
npm run build
npm audit --omit=dev --json
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e -- \
  e2e/independent-round5.spec.ts e2e/round5-p2.spec.ts
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e -- \
  e2e/independent-round5-p2-retest.spec.ts e2e/round5.spec.ts \
  -g 'B-P2:|R5 all-field native|R5 final native'
sha256sum -c docs/evidence/round5-p2/source-sha256.txt
```

Typecheck、lint、build 均退出 0；新增 QA 测试后再执行 typecheck/lint 也退出 0。生产依赖审计退出 0，已知漏洞总数 0。原两项 P2 及其他旧测试逐字节保留；没有删除、削弱断言或新增 skip。

完整日志：[independent-validation.txt](evidence/round5-p2-retest/independent-validation.txt)；新增测试：[independent-round5-p2-retest.spec.ts](../e2e/independent-round5-p2-retest.spec.ts)。证据仅为合成数据文本/指标，没有提交下载备份、浏览器私有 trace 或真实用户内容。

本轮没有再次 npm ci：复用第五轮安装的依赖，package-lock 未变。没有完整执行全套数据/浏览器测试、未重跑大型压力矩阵；这些属于 **本轮 NOT VERIFIED/未重新执行**，此前独立证据原样保留。开发者的 28 数据/26 浏览器、既往 65/75 等数字均不作为本轮 B 的执行总数。CI 全套成功另列在身份核对，不冒充本地全套验证。

## 6. 问题状态与发布限制

| 项目 | 本轮最终状态 | 限制 |
| --- | --- | --- |
| R5-001 | **PASS，建议 CLOSED** | 原两项失败及状态转换、安全回归均通过 |
| R4-001 | PASS/CLOSED | 保持第五轮结论，必要回归通过 |
| 条件性 P1 | **OPEN** | 下载被禁止、物理空间不足等环境仍无普遍已验证安全迁出保证；安全拒绝不等于成功迁移 |
| 历史唯一 RCA | **NOT CONFIRMED** | 未重新调查，未改变历史归因 |
| QA-004 | **OPEN** | 未收到负责人正式变更门槛的决定，不自行关闭 |
| QA-003 | PASS | 保留原独立结论；本轮没有完整重验树导航 |
| QA-008 | PARTIAL | 保留已批准受限 Markdown 范围；未提高状态 |
| 其他既往 PASS | 保留历史结论 | 没有把本轮定向测试扩大为完整 V1 复验 |
| 新增 P1/P2 | 本轮未发现 | 仅限实际检查范围 |

Safari/WebKit、真实 iPhone、VoiceOver、主屏离线冷启动、系统强杀恢复、跨版本 Service Worker 更新、Cloudflare HTTPS、线上响应头继续全部 **NOT VERIFIED**。实际操作系统下载后落盘/取消/磁盘不足的反馈也未在真机上验证。本轮 Chromium 下载文件及本地 CSP 通过，不提高这些平台状态。

**最终决定：R5-001 的定向修复验收通过，建议关闭；正式生产发布仍为 NO-GO。** 不合并 main，不部署生产，不关闭条件性 P1 或 QA-004，不调整历史 RCA 门槛。将本报告及原始证据提交到原独立 QA 分支后停止验收，等待负责人下一步决策。
