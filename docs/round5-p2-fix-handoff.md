# Mindflow 第五轮 R5-001 P2 定向修复交接

状态：**NO-GO，开发者修复候选，R5-001待B定向复验**。本轮唯一生产代码变更在src/LargeMigration.tsx的下载反馈，不修改完整性、分卷、校验、私有快照或原子提交机制。

## 第五轮独立验收结论记录

依据B提交[b250a868757cecd9945b436a0011fef98f189ad6](https://github.com/easonwycgz/mindflow/blob/b250a868757cecd9945b436a0011fef98f189ad6/docs/independent-qa-report-round-5.md)，被验收应用为f22d68c3bed8e6ab23da2fb09373ac50c1c43124。A只读取得报告、原始文本及两份测试；qa/mindflow-v1-review-round-5保持独立，历史文件不覆盖。

- **R4-001：PASS/CLOSED**，收藏篡改拒绝及原库保护通过。
- 私有快照与提交边界保护：**PASS（B已测范围）**。
- 无Directory API、workspace不能新增记录、源可读且允许下载/目标空间充足：**PASS**。
- 2001卡、7卷、54,301,665字节实际逐卷下载及完整恢复：**PASS**。
- 大型回归：**PASS**；10001卡/21卷、50,337,817及88,493,973字节数据集完整往返：**PASS**。

以上是B第五轮已批准的独立记录，不是本轮A新增执行数量。不因P2重新打开R4-001。

继续保持：条件性P1 OPEN、历史RCA NOT CONFIRMED、QA-004 OPEN、QA-003 PASS、QA-008 PARTIAL。没有负责人正式改变门槛，不自行关闭。

## 根因和两项原始失败

B的两项失败是同一场景在桌面和移动Chromium执行：acceptDownloads=false使真实download.failure非空；应用progress仍显示“这些文件仍在设备下载位置”。A在修改前原样重跑两项，**2 FAIL**，源库保护断言仍过。见baseline.txt。

`HTMLAnchorElement.click()`正常返回仅表示网页发起请求，没有网页可用的下载管理器接受/拒绝/最终保存回执。原计数本来是请求过的不同文件数，但进度尾句错误地将其转换成文件存在承诺，和顶部未确认保存提示矛盾。

## 修改与状态转换

生产变更仅src/LargeMigration.tsx：

| 证据/事件 | 状态与反馈 | 是否推进/确认备份 |
| --- | --- | --- |
| 尚未请求当前文件 | 等待下载；继续按钮disabled | 不推进 |
| click返回，无网页回执 | requested：已发起请求，检查下载记录；无法确认浏览器接受或保存成功 | 不自动推进；用户检查后才可继续，仍非备份验证 |
| 可观察NotAllowedError/SecurityError | blocked：未启动或被阻止，停止迁出，解除限制后重试 | 拒绝，原库保留 |
| 可观察AbortError | cancelled：下载已取消，停止迁出 | 拒绝，原库保留 |
| Blob/其他异常 | failed：下载失败、保存未知，检查空间/记录后重试 | 拒绝，保留部分集合提示 |
| 下载管理器静默拒绝，网页无回执 | 保持requested/unknown，不伪造自动检测 | 用户可选择“下载未启动或被阻止”，明确记录“你已报告”并停止 |
| 用户报告取消 | cancelled，明确“你已报告下载已取消” | 停止；不误称网页看到了OS回执 |
| 用户取消整个迁出 | “迁出已取消”，已发起请求的保存结果仍未知 | 中止快照，原库不变 |
| 再次迁出/重试 | 重置旧反馈/计数，重新请求后仍unknown | 不继承saved或旧错误状态 |

进度文本统一为检查下载记录，仅“已成功保存的文件（如有）”应保留。保留“下载请求不等于物理保存”“磁盘保存尚未验证”和完整集合重新校验要求，不新增网页无法兑现的saved状态。“已保存当前文件，继续”仍是**用户声明**的按钮，非应用观测结论；不会自动验证备份或清空原库。

已发起的下载与正在进行的浏览器下载可能在应用取消后继续；因此“迁出取消”和“下载取消”分开表述。无法观察的OS取消、后台失败或磁盘写入结果均不得推断；没有通过测试专用API伪造产品回执。

异常仍经原rejectDownload/run失败路径终止，不弱化取消或失败检测；Object URL在finally清理。未触及src/pagedMigration.ts、src/db.ts、model/settings/volumes、Schema、合同、CSP、依赖或工作流。

## 本轮实际执行与安全回归

| 本轮A实际命令/范围 | 通过 | 失败 | 跳过 |
| --- | ---: | ---: | ---: |
| 相关数据2文件，round5 + B round5 | 28 | 0 | 0 |
| 相关浏览器3文件，桌面/移动 | 26 | 0 | 0 |
| 其中B原2项失败断言 | 2 | 0 | 0 |
| 其中本轮新增反馈/重试测试 | 14 | 0 | 0 |
| typecheck / lint / build | 全部退出0 | 0 | 0 |
| npm audit --omit=dev | 退出0，0已知生产漏洞 | 0 | 0 |

数据1.74秒，浏览器3.4分钟，日期2026-10-30（Asia/Shanghai）。原两项基线失败单独保留，不混算为修复后失败。26项浏览器=原R5八项+B第五轮四项+本轮十四项；没有完整重跑整个V1。本轮共53条应用/配置/测试指纹，原完整性等生产源码及所有旧测试字节保持。

新增e2e/round5-p2.spec.ts为7场景×桌面/移动=14项：真实成功下载仍显示未知、重复请求、迁出取消、用户报告下载取消、4类可观察异常各自安全失败+实际下载重试、真实浏览器政策拒绝后用户报告阻止及再次拒绝。前述异常是明确的故障注入，不冒充OS实机现象。

B第五轮两份测试从b250a86逐字节复制，包含原2项失败及实际重复/篡改文件/不完整文件拒绝恢复；没有改期望文案来变绿。数据回归保留24项字段/完整性故障与B4项提交边界/取消；浏览器保留原R5私有快照、2001卡7卷实际下载/完整恢复、取消和Blob异常。下载后替换文件拒绝、无分卷时提升禁用、原文件重试成功及源三表保护均有实际断言。

原35/65或B此前34/36等数字不作为本轮A的执行数量。自动PR/push CI按既有工作流跑全套，不为P2缩小CI、删测试、增skip或降低断言。本轮本地只做上述定向检查。

可重复命令：

```sh
npm run typecheck
npm run lint
npm run build
npm test -- tests/round5.test.ts tests/independent-round5.test.ts --reporter=verbose
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e -- e2e/independent-round5.spec.ts e2e/round5-p2.spec.ts e2e/round5.spec.ts
npm audit --omit=dev
sha256sum -c docs/evidence/round5-p2/source-sha256.txt
```

## 环境支持矩阵与未解决项

| 环境 | 状态 | 本轮反馈/边界 |
| --- | --- | --- |
| 无Directory API、origin工作区新增受限、允许下载且目标有空间 | 第五轮B已验证支持；本轮实际下载恢复回归 | 不能扩大为任意环境支持 |
| 浏览器禁止下载 | 不支持成功迁移，条件性P1 OPEN | 原生拒绝时若无网页回执只报未知；用户报告阻止后安全终止。可观察安全异常直接拒绝 |
| Blob/暂存/目标quota或空间不足 | 安全失败；成功迁移不保证 | 本轮回归模拟异常及原库保护，不冒称真磁盘已填满 |
| 物理空间不足、OS下载限制/崩溃、没有保存媒介 | NOT VERIFIED或无已验证迁出方案 | 不报告成功，不删除唯一源库、不把部分请求当完整备份 |
| Safari/WebKit、真实iPhone、VoiceOver | NOT VERIFIED | Chromium移动视口不是iPhone |
| 主屏离线冷启动、系统强杀恢复、跨版本SW、Cloudflare HTTPS/线上响应头 | NOT VERIFIED | 本轮不扩大验证范围 |

## 候选身份及交接

应用基线f22d68c3bed8e6ab23da2fb09373ac50c1c43124；修复提交在feat/mindflow-v1，继续[PR #1](https://github.com/easonwycgz/mindflow/pull/1)。**承载本报告的新应用commit为本轮候选**；其完整SHA、PR head SHA及固定PR/push CI链接在最终交接消息核对列出，不能将B的b250a86当作应用候选。源码指纹绑定实际受测字节，不在同一提交内虚构自身未来哈希/CI ID。

公开合成原始日志位于docs/evidence/round5-p2，不含私人卡片、下载备份、凭证、环境dump或私有trace；可从新候选GitHub blob读取，无需受限Actions工件API。PR及push均须绑定同一新SHA，实际结果在最终交接给出。

R5-001由B定向复验决定，A不自行标独立PASS；R4-001保持CLOSED。其余OPEN/PARTIAL与NO-GO不改。不合并main、不生产部署。交付候选后停止开发，等待B和负责人下一步决定。
