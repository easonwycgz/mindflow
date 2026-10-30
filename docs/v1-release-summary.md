# Mindflow V1 正式发布候选档案

RC标识：**Mindflow V1 RC df48c9d**。本档案不是Production Release；负责人批准冻结与非生产试运行准备，生产仍NO-GO。

## 固定身份与分支边界

- 应用：[df48c9d2eae22f3fc97487db80ab61b59813adc9](https://github.com/easonwycgz/mindflow/commit/df48c9d2eae22f3fc97487db80ab61b59813adc9)，tree a75bfbecb277fb4071d4880e8cad756c01ac5085。
- 原[PR #1](https://github.com/easonwycgz/mindflow/pull/1)：归档开始检查DRAFT、未关闭/合并，head为冻结SHA。feat/mindflow-v1不提交归档文档；main仍e061135f1b197347bbdd35c519334405aa0a12c5。
- 治理分支：`docs/v1-rc-df48c9d-governance`，仅文档/证据/公开合成fixture。独立QA分支不写入、不合并进应用。
- 冻结CI：[PR41055762320](https://github.com/easonwycgz/mindflow/actions/runs/41055762320)、[push41055755638](https://github.com/easonwycgz/mindflow/actions/runs/41055755638)，B在b8eadd2独立核对均SUCCESS、15步骤全部成功并绑定完整冻结SHA。内部工件未由本轮重新下载，不声称其内容逐条重验。

## 开发—独立验收历史

| 轮次 | 应用候选 | B的固定报告提交 | 当时结论及演进 |
| --- | --- | --- | --- |
| 第一轮 | 740b98bb0d6f0bf9214e12345bdb51b3e4d605fa | [656b50f](https://github.com/easonwycgz/mindflow/blob/656b50fb739943e29dfddc55fe0661e48ff3d14f/docs/independent-qa-report.md) | No-Go：正常备份、粘贴、长树、CI及体验/告知问题 |
| 第二轮 | f784ccf806edcf070381484a657948ebd7752613 | [32319f4](https://github.com/easonwycgz/mindflow/blob/32319f4dc987578190c05482d2619e5ac2d5b187/docs/independent-qa-report-round-2.md) | 备份/粘贴等PASS；字号时序、返回焦点、旧库迁移及历史RCA仍阻断 |
| 第三轮 | dc5525552d1da11a4a5126fdc3440a5dffb688da | [6e53ec9](https://github.com/easonwycgz/mindflow/blob/6e53ec9279aada44f2bff5e706d74734c4ea49b6/docs/independent-qa-report-round-3.md) | 当前字号/树焦点/501卡PASS；唯一RCA及更大旧库风险未关闭 |
| 第四轮 | ba60e55110b92658d450036e59ef415b6e946336 | [3752a12](https://github.com/easonwycgz/mindflow/blob/3752a12896f903e5636b474b218c9c288f65a70b/docs/independent-qa-report-round-4.md) | 数量/容量扩展通过；新增暂存完整性P1 R4-001、受限环境风险 |
| 第五轮 | f22d68c3bed8e6ab23da2fb09373ac50c1c43124 | [b250a86](https://github.com/easonwycgz/mindflow/blob/b250a868757cecd9945b436a0011fef98f189ad6/docs/independent-qa-report-round-5.md) | R4-001 PASS/CLOSED；允许下载的无Directory/暂存不足路径PASS；新增R5-001文案P2 |
| 第五轮P2 | **df48c9d2eae22f3fc97487db80ab61b59813adc9** | [b8eadd2](https://github.com/easonwycgz/mindflow/blob/b8eadd2a9a9171c875b5d5086237cc373add69b8/docs/independent-qa-report-round-5-p2-retest.md) | R5-001 PASS、建议关闭；没有新增已确认P1/P2；生产仍No-Go |
| 本次治理 | 应用不变 | [负责人决策记录](v1-release-decisions.md)，2026-10-30 | QA-004当前缺陷PASS/CLOSED；历史RCA NOT CONFIRMED，风险接受仅支持非生产；平台与条件性P1不跳过 |

这些状态不是把后来的通过倒写入旧报告；所有历史失败及No-Go原文继续有效地描述当时版本/门槛。

## 当前产品与容量承诺

本地知识卡片PWA；文件或粘贴单张正式JSON卡片，校验/去重，摘要/递归树/FAQ、搜索、收藏、阅读位置、字号保存反馈、备份/恢复。没有账号、付费AI API、云数据库、同步、用户知识上传、追踪、远程图片或脚本执行。

V1支持纯文本与受限Markdown标题/列表/粗体；完整数学公式、表格、代码块排版不是本次承诺，QA-008保持PARTIAL、后续V1.1。正式Schema和合同锁定。

单卡2MiB/16层/50,000值；正常整库备份500卡/40MiB并预留元数据空间；旧有限分卷2000卡/40MiB/16卷。大库独立migration.html走另一分页路径，不重新引入旧总量门槛：单卷500卡/8MiB、批次4卡、恒定清单、全量验证后一个主库事务、私有已验证值写入。实际独立规模包含10001卡/21卷、50,337,817与88,493,973字节；无Directory/工作区新增受限但允许下载的实际Chromium往返为2001卡/7卷/54,301,665数据卷字节。不是无限资源或所有平台保证。

## 本次冻结构建与检查

从冻结commit git archive导出95个跟踪文件，构建前后逐一比较均一致；依赖按冻结锁npm ci，非从治理head构建。Node24.19.0/npm11.9.0。typecheck/lint/build通过；核心数据10 PASS、浏览器12 PASS（桌面/移动Chromium，0 FAIL/SKIP）；audit0已知生产漏洞。另检查12个可访问构建资源的字节/本地头、2视口基本阅读流程、SW受控、控制台无阻断错误。它们是**A本次本地检查**，不是新B结论或Cloudflare HTTPS测试。

证据：[build-provenance.json](evidence/v1-rc/build-provenance.json)、[构建/浏览器/审计输出](evidence/v1-rc/build-browser-audit.txt)、[本地资源与冒烟](evidence/v1-rc/local-smoke.json)。部署包13文件、仅dist；没有把私有库、环境文件、测试、下载备份或治理文档放入包。检查是输入/产物边界与已知标记核验，不冒称通用秘密扫描证明。

## 四种状态不能混淆

| 事项 | 当前判定 |
| --- | --- |
| 技术功能通过 | 对应B报告与平台范围，见QA矩阵 |
| 风险被接受 | **仅历史唯一RCA证据不足，由负责人接受用于非生产** |
| 尚未验证 | 真实平台、Cloudflare部署/HTTPS/线上头等仍NOT VERIFIED |
| 正式发布批准 | **没有；Production Release仍NO-GO** |

最终试运行准备状态见[v1-nonproduction-handoff.md](v1-nonproduction-handoff.md)，Work操作材料见[v1-work-handoff.md](v1-work-handoff.md)。
