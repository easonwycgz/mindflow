# Mindflow V1 发布候选与负责人决策记录

决策日期：**2026-10-30，Asia/Shanghai（UTC+08）**。批准人：项目负责人，即本任务指令的会话用户；未提供实名，不代填。记录人：工程负责人A。本文件是新治理记录，不修改任何历史QA报告。

## DEC-001：冻结应用候选

负责人原话：“批准冻结当前应用候选版本，建立正式发布候选档案。”

- 唯一应用候选：`df48c9d2eae22f3fc97487db80ab61b59813adc9`。
- 冻结Git tree：`a75bfbecb277fb4071d4880e8cad756c01ac5085`。
- 原开发分支feat/mindflow-v1与PR #1继续保留；归档核对时head精确匹配、DRAFT、mergedTime=null。
- 治理文档仅在docs/v1-rc-df48c9d-governance提交。治理commit不成为应用候选，不把其commit-hash标为部署源。
- 部署包从`git archive <冻结SHA>`的独立无Git源码副本构建；仅部署dist，排除治理文档、测试、日志、源码根目录和本机数据。

## DEC-002：QA-004现缺陷与历史唯一RCA分开管理

### 原门槛及历史状态

第二轮B报告将“当前字号持久化修复”与“解释/确认原CI失败根因”共同列为QA-004关闭条件。第三轮已测当前持久化机制PASS，但历史唯一因果不足，QA-004整体仍OPEN。第四轮请求R4-QA004-GATE-20261030提出两种规则供负责人决定，彼时PENDING。第五轮及P2复验仍未获新决定，因此仍记OPEN。

不可改写的原始证据：

- [第二轮报告，32319f4](https://github.com/easonwycgz/mindflow/blob/32319f4dc987578190c05482d2619e5ac2d5b187/docs/independent-qa-report-round-2.md)：真实写锁复现、完成保存对照、唯一历史因果未证。
- [第三轮报告，6e53ec9](https://github.com/easonwycgz/mindflow/blob/6e53ec9279aada44f2bff5e706d74734c4ea49b6/docs/independent-qa-report-round-3.md)：写锁/立即刷新/未提交意图、request success后abort、真实complete后Saved、重试和并发均在已测范围PASS。
- [第四轮门槛请求，3752a12](https://github.com/easonwycgz/mindflow/blob/3752a12896f903e5636b474b218c9c288f65a70b/docs/qa-004-gate-decision-request-round-4.md)。
- [历史技术RCA，冻结候选原文](https://github.com/easonwycgz/mindflow/blob/df48c9d2eae22f3fc97487db80ab61b59813adc9/docs/qa-004-historical-ci-rca.md)。
- 历史失败[run41014649370/job123928110503](https://github.com/easonwycgz/mindflow/actions/runs/41014649370/job/123928110503)，产品740b98bb0d6f0bf9214e12345bdb51b3e4d605fa。步骤失败可核实；精确DB提交/卸载时序、原上下文和实际二进制证据未恢复。受限API/404不能证明日志永久丢失，也不能证明已发现唯一根因。

### 本次正式批准的新规则

负责人原话：“QA-004 当前字号持久化缺陷，可根据此前独立验收证据认定 PASS/CLOSED。”“历史唯一 RCA 继续记录为 NOT CONFIRMED。”“负责人正式接受历史唯一根因证据不足这一剩余风险，使其不再单独阻断非生产试运行。”

| 管理对象 | 新状态 | 依据/权限 |
| --- | --- | --- |
| QA-004当前字号持久化缺陷 | **PASS/CLOSED** | B已有独立技术证据 + 本次负责人批准拆分关闭规则 |
| QA-004历史当次唯一RCA | **NOT CONFIRMED** | 未新增因果证据；不改成LIKELY/CONFIRMED |
| 历史唯一RCA证据不足风险 | **ACCEPTED，仅本次非生产试运行范围** | 负责人明确承担；不再作为单独非生产阻断项 |
| 历史报告原OPEN/No-Go | 原文保留 | 它们是当时门槛下的正确历史记录，本决策在新档案中向前生效 |

风险接受不是技术证明，不改变历史因果置信度。当前已通过实现没有为归档而重写；新的数据损坏、安全或持久化失败仍须单独调查并按严重度阻断。

## DEC-003：只准备非生产HTTPS预览

负责人原话：“批准在风险归档后准备非生产 HTTPS 预览，用于 ChatGPT Work 和后续 iPhone 真机产品验收。”

- 用户提供的目标项目名按`001beta`准备，账号由安全配置中的CLOUDFLARE_ACCOUNT_ID指定，不猜测账号归属。
- 优先Cloudflare Pages **Preview**；固定部署URL优先，分支动态别名不得冒充固定版本。
- 只有合成/公开测试卡片；无访问控制的预览可能公开，不能导入私人聊天或知识库。
- 本批准不是正式生产发布、不是合并main、不是关闭PR #1，也不是把未验证平台写PASS。
- Cloudflare当前无凭据/账号ID、当前运行网络未允许目标域；配置需求已保存草稿但未应用。部署仍BLOCKED，没有实际Preview URL或部署ID。

## 明确不包含的批准

条件性P1仍OPEN；QA-008仍PARTIAL；Safari/WebKit、真实iPhone、VoiceOver、主屏离线冷启动、系统强杀恢复、跨版本SW、Cloudflare HTTPS及线上响应头仍NOT VERIFIED。没有批准绕过这些验证、静默丢数据、先删除唯一原库腾空间或正式生产发布。

本记录来源是负责人本轮显式任务指令，不是A/B自行推定或沉默同意。B下一步只需对归档和试运行准备作简短复核；本文件不代替B的新复核结论。
