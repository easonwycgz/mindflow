# Mindflow V1 第五轮独立定向验收

**整体结论：No-Go（正式发布）。** 第四轮暂存完整性P1 R4-001在本轮已测范围内 **PASS，可关闭**。无Directory API且origin工作区不能新增记录、但下载和目标存储可用时，逐卷下载及完整恢复 **PASS**。条件性存储/下载兼容P1仍保留；历史唯一RCA仍NOT CONFIRMED、QA-004 OPEN。另发现下载失败告知P2 R5-001，不把它与已修复的数据完整性P1混为一谈。

## A. 精确候选与独立执行范围

- 唯一应用候选：`f22d68c3bed8e6ab23da2fb09373ac50c1c43124`；精确检出后创建 `qa/mindflow-v1-review-round-5`，不在开发分支或main改代码。
- [PR #1](https://github.com/easonwycgz/mindflow/pull/1)开始及结束复查的headSha均完整匹配，state=DRAFT、mergedTime=null。没有用变动后的HEAD沿用旧测试。
- [PR CI41049135890](https://github.com/easonwycgz/mindflow/actions/runs/41049135890)，job124040546070；[push CI41049124604](https://github.com/easonwycgz/mindflow/actions/runs/41049124604)，job124040511537：均SUCCESS。独立读取官方run/job网页，完整步骤log-url含同一最终SHA，types/lint、data、build、browser、audit成功。
- 开发交接/设计/公开日志可读，50条源码摘要匹配。开发者65数据、75浏览器通过/1跳过的完整记录与成功CI对应，但本轮**没有独立完整重跑65/75**，实际定向执行结果另列，不借用开发者数字作为B通过数。
- 实际测试窗口：**2026-10-30约19:55～20:04，Asia/Shanghai**。Linux、Node24.19.0/npm11.9.0、系统Chromium154.0.8037.57。只用公开示例和合成数据。
- 第四轮两份原B测试与3752a12逐字节一致，原收藏失败案例没有改期望。恢复候选未携带的第二～四轮报告和门槛请求原文，历史分支/提交保留。
- 应用/原测试/依赖/锁文件/Schema/CSP没有B修改；新增两份B定向测试、本报告及合成文本索引。source diff及摘要核对确保实际受测应用字节未变。不合并、不部署、不替A修代码。

## B. R4-001完整性P1：PASS

### 第四轮原始故障原文复验

原B数据测试和原生浏览器测试均重新执行：原备份及清单不改，真实工作区ready后的`reading.record.favorite`翻转，然后通过实际恢复入口提升。结果：**rejected、targetChanged=false、任务仍ready**；桌面/移动均未显示完整成功，目标状态仍为原值。修改的是实际参与比对的工作区记录，不是脱离数据库的测试对象。

原始记录：data-targeted.log中 `B-R4 staged reading fault {"outcome":"rejected","targetChanged":false,"actualState":"ready"}`；browser-targeted.log的B-R4 native staged-state用例两项目通过。故障前后完整源/目标三表比较，未产生部分恢复。

### 扩展字段及原文证明

本轮独立运行`tests/round5.test.ts`全部24项，并审查实际注入点；与原B六项合计30 PASS。代表性变化包括：

| 变化 | 实际结果 |
| --- | --- |
| favorite、scroll、section、合法另一nodeId | 拒绝，原目标完整相同 |
| createdAt、updatedAt | 拒绝，不能只靠内容hash掩盖元数据变化 |
| 摘要、子节点内容、父子关系、节点顺序、source URI，且重算合法content hash | 仍拒绝，源/目标完整保留 |
| 卡片ID、reading.cardId关联 | 拒绝 |
| 删除/截断/替换卷、receipt、job.root.settings或原root证明变化 | 拒绝 |
| 同时改卷正文、payload checksum、receipt及衍生favorite，外部root不变 | 最终原链不匹配；已有9次目标写入请求仍整体回滚 |
| 后续批次才失配 | 前8条已写请求全部回滚；原文件重新暂存后可重试成功 |
| 保存原文时配额失败 | 整卷暂存回滚，无半卷cards/receipt，主库不变 |
| 旧ready任务没有原文证明 | 不继承信任，明确拒绝；仅要求重建该恢复暂存，不删除主库 |

原生浏览器第五轮多字段故障循环还覆盖11类实际工作区改动、刷新及原文件重试，两项目通过。它不是仅对代码中出现snapshot/hash字样作判断。

### 私有快照与验证/使用边界

代码证据：`src/pagedMigration.ts` 的begin/stage把原始清单与每卷精确文本和衍生记录同事务暂存；commit约470～700行重新验证root、原卷、receipt、整链及数量/字节。对**完整StoredCard及完整Reading**做canonical比对，不只验证content hash。每次原卷解析值属于调用私有对象，当前批取自它；完成比对后直接bulkAdd同一批cards/reading，未从可变工作区重取写入对象；再在目标事务内读回比对，native complete后才返回成功。

独立B新增`tests/independent-round5.test.ts`四个边界场景全通过：

1. **预检完成、目标事务尚未开始**：在目标transaction入口先把真实工作区favorite改动并提交；提升拒绝，sentinel目标三表完整不变。
2. **卡片已写、当前reading尚未实际写入**：在reading.bulkAdd边界等待另一真实连接提交内容/时间戳/hash与收藏/scroll变化，再调用原写入；目标仍逐项等于原备份，工作区变化不污染已验证私有值。
3. **最终证明校验后、settings.put前**：改变原root证明的字号并重算自校验后落库，最终写入仍为之前已验证的原settings快照，没有从变化的外部证明重取值。
4. **已有批次写入后取消**：确有写入请求，取消使目标三表完整回滚；未破坏的原暂存可重试成功。

A测试的cards.bulkAdd前等待另一连接完成写入，以及原生IDBObjectStore.add最后入口发起真实并发改动，也由B实际运行通过。后者断言外部写入确实完成、目标仍等于原三表。

结论：覆盖验证前、事务入口、实际写入和最终settings边界；较早变化拒绝/回滚，较晚变化可以提交原来核验的私有快照。**不机械要求每次外部变化都报错；核心是未经验证值不得进入目标。** 已测边界未发现该污染路径，R4-001可关闭。这不等于穷尽任意同源恶意脚本、被替换的密码学原语或全部文件重签攻击；原格式没有身份认证承诺。

## C. 逐卷下载：对已测环境PASS

### 实际大文件下载与完整恢复

B实际执行原生浏览器`R5 no Directory API and zero workspace quota...`，两项目均完成：

- 删除Directory API；对workspace新增记录注入QuotaExceededError；源库可读。
- 2001张合成卡；**7个数据卷，总54,301,665字节，最后另下载完成清单**。数据字节含完整v1卷、内容/子树、元数据、reading及卷设置，不含另计的清单，不是物理数据库占用。
- 等待真实download事件，读取实际落盘文件并保留建议文件名；不是仅点击按钮、复用内存导出字符串或声称操作系统一定保存成功。
- 不写整库workspace副本，逐卷确认再生成下一卷，清单最后；源码审查sink分支跳过工作区写入，与实际workspace.add失败仍可导出相符。
- 刷新清除注入，在有足够空间环境重新选择这些实际磁盘文件，逐卷验证并显式恢复。源库保留，恢复后三表完整一致。原始stdout两次 `R5_STREAM_DOWNLOAD` 均确认2001/54,301,665/7及realDownloadsRestored=true。

这是“无Directory+无法新增工作区记录+允许下载”的安全替代路径证据，**不是物理磁盘已完全耗尽仍可导出**的证明。Blob分配/浏览器下载栈也需要资源，恢复原文+衍生索引和目标原子事务仍需要空间。测试刷新后恢复有空间，未先删除唯一源库腾空间。

### 下载异常、重复和文件变更

| 情况 | 本轮实际结果 |
| --- | --- |
| 连续实际下载7卷及root | PASS，完整恢复 |
| 同一待下载卷重复点击 | B实际下载两份：建议名/字节完全相同，进度不把它计作两份不同卷；之后正常root+单卷恢复完整 |
| 没有选任何分卷 | root后提升按钮disabled，不能不完整恢复 |
| 实际下载字节构造替换文件 `{}` | 拒绝、提升仍disabled、三表不变；改回正确文件可恢复 |
| 更隐蔽的合法替换/截断/改hash | 24项字段矩阵中的原文/receipt/链故障拒绝；没有用仅Schema校验替代链验证 |
| 应用迁出取消/Blob分配错误 | 原生浏览器通过：没有完成集合提示，部分文件标记不完整，源三表保留 |
| 浏览器下载政策拒绝 | B以acceptDownloads=false得到真实download failure；不当作落盘成功，取消后源库完整；但发现R5-001文案P2，见下 |
| OS级下载中途终止、断电、真磁盘满 | NOT VERIFIED，不能从Blob错误或应用取消推断 |

网页本身不能可靠读取下载管理器最终保存结果。完成后明确说“已请求下载；磁盘保存尚未验证”，要求重新选择全部文件校验。这个限制合理且不能被删除；但其他位置也应一致，不能另称文件已经在设备中。

## D. 新P2 R5-001：下载失败后仍断言文件存在设备上

- 位置：`src/LargeMigration.tsx:262–267`，direct-download-progress。
- 复现：禁用Directory API，以Chromium `acceptDownloads:false`拒绝下载，启动逐卷下载并点击当前文件。外部测试取得非空download.failure，文件不可用；界面仍显示“中断时这些文件仍在设备下载位置”。桌面/移动均复现。
- 预期：始终区分请求、用户确认与可验证文件，不能承诺失败文件存在。
- 实际：顶层提示说未确认保存，进度文案却作存在性断言，互相矛盾。应用取消和源库保留断言仍通过，未错误显示已验证恢复成功。
- 证据：`e2e/independent-round5.spec.ts`下载政策拒绝用例最终告知断言两项目FAIL；info附件含实际failure/progress；截图denied-download-*.png和trace可重现。
- 严重度：**P2**，可能误导备份保管，未观察到自动删源或错误提交，不把它升级为新数据完整性P1。
- 建议：改成“已成功保存的文件（如有）请保留；请检查下载状态，完整集合须重新验证”，保留当前未验证提示；浏览器没有回执时不要伪造失败已被产品自动识别或文件保存保证。
- 状态：OPEN。未修改产品文案来消除失败。

## E. 环境支持与条件性P1

| 环境/能力 | 本轮独立判定 | 边界 |
| --- | --- | --- |
| 无Directory、工作区新增记录受限、源可读、允许下载且文件系统有空间 | **PASS** | 桌面/移动Chromium实测54.3MB，实际文件恢复 |
| 允许重复请求，但可重新选完整文件 | **PASS** | B单卷重复、缺文件拒绝、原文件重试通过 |
| 无Directory且下载也被政策禁止 | **迁出能力未通过/条件性P1保留** | B实际拒绝可见；取消保源PASS，不等于能迁出；存在P2矛盾文案 |
| Blob/暂存原文/目标quota失败 | **失败保护PASS，成功迁出/恢复不保证** | 整卷或目标回滚；需空间恢复后重试 |
| 用户无法在每卷期限内操作、无任何可保存媒介 | **无已验证迁出方案** | 旧库保留，仍是兼容限制 |
| 实际物理空间为零、OS/下载管理器崩溃、目录授权UI | **NOT VERIFIED** | 不把模拟quota当真磁盘测试 |
| Safari/iPhone相关能力 | **NOT VERIFIED** | Chromium移动视口不是设备验证 |

**R4-C01条件性P1仍OPEN**，支持范围比第四轮显著扩大，但不能关闭全部极端条件。失败时安全拒绝/保留源库是保护证据，不代表该环境可以完成迁移。用户必须保留原数据库和已下载文件，使用有空间的受支持环境；不能为恢复证明占用空间而清空唯一源。

## F. 大型回归与已有结论

本轮重新执行第四轮B六项原数据测试，不是仅引用历史表：

| 第五轮实际复验 | 数据卷字节/结果 |
| --- | --- |
| 501/2000/2001低容量 | 各完整往返PASS；2001为6,320,692字节 |
| 10,001卡、21卷 | 31,607,689字节，完整往返PASS |
| 34张合法大卡、7卷 | 50,337,817字节，完整往返PASS |
| 60张合法大卡、12卷 | 88,493,973字节，超过80MiB，完整往返PASS |
| 新逐卷下载组合 | 2001卡、54,301,665字节、7卷，真实浏览器完整恢复PASS |

字节是完整数据卷UTF-8文本之和，清单另计。比较包含完整内容、父子层级/顺序、子节点、收藏、阅读引用、时间元数据、settings；未只看卡数。原4条批次、单卡2MiB/16层/50,000值、每卷500卡/8MiB安全限制保持，没有重新引入2000/40MiB整库门槛。保护原文导致恢复暂存成本提高，不能把有界JS工作集说成原生进程/事务日志恒定资源保证。

QA-003继续PASS；原备份恢复、request-success后abort及Saved真实性、字号重开、深层焦点、文件导入/去重、收藏、粘贴、CSP和基本离线本轮定向浏览器回归通过。QA-008按已批准受限V1范围保持PARTIAL；不要求本轮完成公式/表格/代码排版。其他原PASS不因未全重跑而自动改判，也不把未执行项目计作本轮新PASS。

## G. 实际命令结果、失败与未执行区分

| 范围 | B实际执行结果 |
| --- | --- |
| npm ci、typecheck、lint、build、生产audit | 全部退出0；生产审计0已知漏洞 |
| 原B round4六项 + round5二十四项数据 | **30 PASS**，41.59秒，退出0 |
| B新增提交边界/取消数据 | **4 PASS**，退出0 |
| 原B round4浏览器 + round5浏览器 + app/round3必要回归 | **30 PASS**，1.4分钟，退出0 |
| 粘贴/文件一致性及实际严格CSP抽查 | **4 PASS**，退出0 |
| B新增重复/替换下载及政策拒绝告知 | **2 PASS / 2 FAIL**，退出1；失败只对应R5-001告知准确性 |
| 新增B测试typecheck/lint | PASS，未改生产代码绕过检查 |

本轮独立数据合计34 PASS；浏览器分次执行合计36 PASS /2 FAIL，**不是同一次完整套件结果**。P2被识别后，给原本已过的拒绝下载功能保护用例补充了具体告知断言；数据保护仍过，最终文案断言保留失败。没有删除/降低原断言或给失败增加skip。

开发者公开完整日志记录65数据PASS、75浏览器PASS/1原不适用skip，所有命令退出0；源码摘要与精确候选匹配，最终CI步骤成功。B没有完整本地重跑该65/75，也未下载Actions内部trace，不能声称远端每个断言由B逐项复核。定向未选测试属于**未执行**，不是跳过/失败。唯一旧skip仍来自桌面不适用触摸条件，移动对应场景在完整开发日志执行；本轮没有新增跳过或retry。

定向命令：

```sh
npm test -- tests/independent-round4.test.ts tests/round5.test.ts --reporter=verbose --silent=false
npm test -- tests/independent-round5.test.ts --reporter=verbose
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e -- e2e/independent-round4.spec.ts e2e/round5.spec.ts e2e/app.spec.ts e2e/independent-round3.spec.ts
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e -- e2e/round2.spec.ts -g 'paste and file|basic Markdown'
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e -- e2e/independent-round5.spec.ts
```

## H. 历史门槛、平台与最终决定

| 项目 | 最终状态 |
| --- | --- |
| R4-001暂存完整性P1 | **PASS，可关闭已测缺陷** |
| 验证/私有快照/写入一致性、原子恢复及异常保护 | **PASS（已测范围）** |
| 逐卷下载替代迁出 | **PASS，仅环境矩阵Case A** |
| 全环境迁移兼容性 | **PARTIAL**，条件性P1 OPEN |
| 新问题 | **P2 R5-001 OPEN**；未另发现新的可复现P1 |
| QA-003及原通过功能 | 维持PASS；必要抽查通过 |
| QA-008 | **PARTIAL** |
| 历史唯一RCA | **NOT CONFIRMED** |
| QA-004整体 | **OPEN**，无负责人正式变更门槛决定 |
| 正式生产发布 | **No-Go，不批准** |

本轮没有重复无价值的历史RCA调查。第四轮负责人门槛请求按原文保留，未获明确批准；当前迁移修复不能替代历史归因或关闭QA-004。

以下继续 **NOT VERIFIED**：Safari/WebKit、真实iPhone、VoiceOver、主屏离线冷启动、系统强杀/驱逐恢复、跨版本Service Worker更新、Cloudflare HTTPS、线上响应头。实际物理磁盘满与真实Directory授权UI也未手验。Chromium和本地CSP不扩大为真实平台通过。

下一步：修正P2矛盾告知；负责人明确处理历史门槛及剩余受限环境的支持/风险决策；按获批范围进行真实平台验收。不是要求A重做已通过的字体、焦点或完整性机制。报告和证据提交后等待负责人决定，不合并main、不生产部署。

## I. 保存位置

- 独立分支：qa/mindflow-v1-review-round-5。
- 报告：docs/independent-qa-report-round-5.md。
- 合成原始文本：docs/evidence/round5/independent-validation.txt。
- 新增B测试：tests/independent-round5.test.ts、e2e/independent-round5.spec.ts；原测试保留。
- 当前实例原始目录：`/tmp/mindflow-qa-r5/`，包含前后PR网页、最终CI job网页、命令输出；denied-download-*.png和test-results失败trace对应P2。临时目录不保证新机器恢复，关键失败及原始文本已提交公开可复查。

未提交真实用户文件、下载备份、环境dump、凭证或私有trace；合成文本遵守AGENTS第五轮证据例外。QA报告提交不是应用修复候选SHA，后续代码变更必须另锁新的完整应用SHA。
