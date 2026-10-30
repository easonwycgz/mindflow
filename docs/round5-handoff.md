# Mindflow V1 第五轮开发者修复交接

本报告是开发者A的候选交付，**不是B的独立验收结论**。R4-001/P1修复待B第五轮复验；条件性P1不由开发者关闭。QA-004整体继续OPEN，历史唯一RCA继续NOT CONFIRMED。未合并main，未生产部署。

## 候选和证据身份

- 分支feat/mindflow-v1，原[PR #1](https://github.com/easonwycgz/mindflow/pull/1)继续更新。
- 修复基线ba60e55110b92658d450036e59ef415b6e946336。
- 独立依据3752a12896f903e5636b474b218c9c288f65a70b；原报告和原始证据只读取得，qa/mindflow-v1-review-round-4未写入。前几轮QA历史、报告、RCA文件不覆盖。
- **本报告所在的第五轮应用提交即最终候选**，不是3752a12验收提交。完整候选SHA、PR head SHA及最终PR/push run的固定链接在本轮最终交接消息列出；仓库本地用`git rev-parse HEAD`、远程用`git ls-remote origin refs/heads/feat/mindflow-v1`核对。报告不能在同一提交内包含自身未来哈希/Actions run ID，不将上一轮SHA冒充当前候选。
- [source-sha256.txt](evidence/round5/source-sha256.txt)固定最终受测应用/测试/配置的字节；本地验证先于提交，同一源码提交后由push及PR各自执行完整CI。最终交接仅在查明真实CI状态后给结论，不预先假定绿色。
- 证据仅公开示例和合成数据。没有用户知识库、密钥、环境dump或私有浏览器trace上传。提交的文本可通过对应GitHub blob读取，不依赖验收者下载受限Actions工件。

## A. P1根因与修复

第四轮原备份checksum已经包含favorite等字段；问题是提升阶段只查Schema、content hash和关系，没有将完整暂存业务值重新绑定到原始卷。ready标志在底层状态变化后仍可存在，因此错误值正常提交并显示成功。

修复位置：

- src/pagedMigration.ts，beginPagedRestore/stagePagedPart：原清单及每卷精确原文与衍生行一起暂存；旧ready无原始证明不得直接提升。
- src/pagedMigration.ts，commitPagedRestore：重新校验原文、完整链、清单、所有StoredCard/Reading字段及settings，逐批完整canonical比较。写入的是**同一刚验证的私有原始值**，不重新读取可变暂存作为写入源；目标事务内再读回比较，最后native complete后确认成功。
- src/LargeMigration.tsx：失败不显示成功；旧暂存/完整性/配额错误明确反馈。新逐卷下载不复制整库到workspace，且不把“下载请求”描述成磁盘已保存。

详见[完整性设计、并发语义及环境矩阵](round5-staging-integrity-design.md)。没有修改正式协议、主库结构、依赖、CSP、设置管理、焦点或Markdown功能。

## B. 故障证明

以下为A实际执行的回归，B须在新候选上独立判定。

| 故障 | 测试/实际断言 | 开发者结果 |
| --- | --- | --- |
| B原始仅favorite改变，备份及清单不变 | B-R4 corrupted staged reading；B浏览器原生篡改用例 | 修改前fulfilled/targetChanged=true；修复后rejected/targetChanged=false，桌面/移动目标不变 |
| 合法业务元数据变化 | R5 post-verification favorite/scroll/section/reading-node-reference/createdAt/updatedAt | 全部拒绝，三表完整保留 |
| 内容/子节点/顺序/父子/关联变化 | R5 post-verification content/order/parent-child/child-content/source-association/id/card-association | 包括同步重算合法content hash的情况仍拒绝，不能只靠旧content hash |
| 卷替换、删除、截断；receipt/root变化 | R5 post-verification各卷/清单故障 | 拒绝；原始导出文件独立副本不变 |
| 同时改卷、receipt及衍生favorite，但外部root不变 | R5 coordinated part/receipt/derived-row alteration | 已产生9个目标写入请求，最终链拒绝，整个目标回滚 |
| 最后add入口修改暂存 | R5 private verified value snapshot | 等待另一连接修改真实提交后才调用实际add；目标仍完整等于原备份 |
| 原生add边界并发写入 | R5 final native add boundary… | 桌面/移动发起并确认真实暂存修改完成，目标仍为已验证原值 |
| 末批错误、刷新及重试 | R5 late-batch mismatch；R5 all-field native faults… | 前8卡写入全部回滚，重新暂存原文件/刷新后可完整恢复 |
| 原文存储空间突然不足 | R5 original proof quota failure | 整卷暂存事务回滚，卡/receipt不留半卷，原库/目标不变 |
| 主库目标quota及clear后刷新 | 原R4 combined stress用例 | 原断言保持，错误/刷新原子回滚，恢复可重试 |

“边界后变化”语义：变动发生在取值/比较前必须拒绝；发生在私有原值复制后，输出仍是该已验证快照，不从变化的暂存再取值。不能以对整库加一个verified标志代替此保障，也不声称同源恶意脚本与重签全套文件是普通checksum能防御的攻击模型。

## C. 极端存储环境

新增“逐卷下载（无需暂存空间）”。无Directory API、workspace新增记录全部QuotaExceeded时，真实下载2001卡、54,301,665字节的7卷和最后清单，随后使用实际磁盘文件重新暂存恢复，源/目标三表完整一致，桌面及移动Chromium均执行。

导出每卷仍最多500卡/8MiB、主库只读快照、批次4卡、清单最后；不提高2000/40限制常量来回避问题。每卷确认受既有60秒IO期限限制，取消/超时/Blob失败保留原库，部分文件提示不完整。网页无法确认用户文件最终写盘，因此只显示请求下载，并要求重选所有文件完成验证；不会自动清库。

恢复依然需要原文证明+衍生记录+目标原子事务的额外空间。空间不足整卷/整库回滚，不建议清空唯一原库腾空间。真正物理磁盘耗尽、下载政策禁止、Safari/iPhone等仍未验证或无已验证迁出路径；**保留条件性P1/发布风险**，不宣布所有极端合法旧库都已兼容。环境矩阵在设计文档，明确区分实际执行、核心sink测试、未验证与已知缺口。

## D. 完整回归结果

最终原始记录见[local-validation.txt](evidence/round5/local-validation.txt)，其中命令与退出码逐项记录。新增数据24项；B第四轮复制数据6项、浏览器3场景×2项目，原文不改。

| 最终命令/范围 | 实际结果 |
| --- | --- |
| npm ci | 退出0，干净安装 |
| npm run typecheck | 退出0 |
| npm run lint | 退出0 |
| npm test -- --reporter=verbose | 9文件、65 PASS、0 FAIL/SKIP，85.76秒；原35+B第四轮6+本轮24 |
| npm run build | 退出0；13个PWA预缓存资源；严格CSP保持 |
| CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e | 75 PASS / 1原有SKIP / 0 FAIL，6.0分钟；原61+B第四轮6+本轮8 |
| npm audit --omit=dev | 退出0，0已知生产漏洞 |
| 最终源码指纹 | 50条全部匹配；无受测源码后续修改 |

本地完整执行日期2026-10-30（Asia/Shanghai）。新增24项数据及8项浏览器全部通过，无新增跳过。B原第四轮6项数据及6项浏览器均通过开发者复跑；仍需B独立执行与判定。

原35数据与原61浏览器均保留；未删除原断言、扩大skip、增加retry或提高原超时。唯一历史skip仍为桌面不适用的触摸测试，移动端对应场景实际执行。QA-003及QA-001/002/005/006/007/009、第三轮字号/提交后Saved等回归仍以既有平台范围解释。QA-008继续PARTIAL，完整公式/表格/代码排版保持V1.1，不增加本轮范围。

B独立扩展规模重新执行：501/2000/2001/10001卡，后者21卷；50,337,817及88,493,973字节独立容量样本；原组合2001卡、49,424,718字节。逐项内容/节点/数组顺序/元数据/reading/settings比对，不只看卡数。阶段堆度量不是进程峰值保证。

## E. 诊断历史与可复现性

保留修改前真实失败baseline-integrity.txt与首次浏览器诊断browser-first.txt。第一版跨库长期锁持有方式通过fake-indexeddb但原生Chromium出现TransactionInactiveError；已修代码，未删旧压力/配额/恢复断言。新大文件浏览器测试还碰到Playwright50MB buffer传输限制及临时下载文件名问题，改为保留建议文件名的真实磁盘路径上传；原大小/数量/逐项比较不变。最终原始结果单独列出，不把诊断失败当作最终成功。

可复现：

```sh
npm ci
npm run typecheck
npm run lint
npm test -- --reporter=verbose
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
npm audit --omit=dev
sha256sum -c docs/evidence/round5/source-sha256.txt
```

CI使用`npx playwright install --with-deps chromium`后不设置CHROMIUM_PATH；本地系统Chromium为154.0.8037.57，Node24.19.0/npm11.9.0。不将版本声明当作Safari/真机验证。

## F. 剩余风险与B的判定边界

1. R4-001已实现修复并提供反例到正例证据，开发者已测覆盖不再出现错误数据提交；**P1状态待B独立复验，A不自行标PASS**。
2. Conditional P1保留。新路径已覆盖“无目录+无workspace记录配额+可下载”组合；不保证下载被禁/设备无外部空间/所有平台都可安全迁出。恢复proof增加空间，不隐藏代价。
3. 没有在本轮已执行检查中确认额外新的P1/P2；这不是无缺陷保证。B可继续故障注入和原生压力复验。
4. 历史RCA NOT CONFIRMED，QA-004 OPEN。没有重复无价值日志调查，没有将新P1冒充历史唯一根因。用户此前要求提交负责人/B正式评议，评议前OPEN；没有收到正式批准变更门槛。
5. NOT VERIFIED：Safari/WebKit、真实iPhone、VoiceOver、主屏离线冷启动、OS强制终止/驱逐恢复、跨版本SW更新、Cloudflare HTTPS与线上响应头；实际Directory授权UI与真磁盘填满也未手验。
6. 不合并main、不正式公网发布、不生产部署。部署网址：无新增生产部署。由B决定第五轮独立结论，负责人另行决定RCA门槛，不能用开发者绿灯替代。

## 真实iPhone待完成的验收事项

仅使用合成卡片：验证Safari/主屏PWA的多卷保存到“文件”及重新选择、低空间/下载取消时原库保留；VoiceOver树焦点和Saved状态；主屏离线冷启动、强制终止后的恢复、跨版本SW更新。Cloudflare HTTPS及线上响应头由获批后的实际部署环境另验。这些项目本轮均未执行，不据Chromium视口测试标为通过。
