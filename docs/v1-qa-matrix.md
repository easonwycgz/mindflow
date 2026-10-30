# Mindflow V1 QA矩阵（冻结df48c9d）

日期2026-10-30，Asia/Shanghai。PASS只覆盖引用的独立执行范围；不默认所有设备通过。B报告使用固定提交链接，不用会变动的QA分支head作唯一依据。

证据缩写：

- [B2=32319f4](https://github.com/easonwycgz/mindflow/blob/32319f4dc987578190c05482d2619e5ac2d5b187/docs/independent-qa-report-round-2.md)
- [B3=6e53ec9](https://github.com/easonwycgz/mindflow/blob/6e53ec9279aada44f2bff5e706d74734c4ea49b6/docs/independent-qa-report-round-3.md)
- [B4=3752a12](https://github.com/easonwycgz/mindflow/blob/3752a12896f903e5636b474b218c9c288f65a70b/docs/independent-qa-report-round-4.md)
- [B5=b250a86](https://github.com/easonwycgz/mindflow/blob/b250a868757cecd9945b436a0011fef98f189ad6/docs/independent-qa-report-round-5.md)
- [B5P2=b8eadd2](https://github.com/easonwycgz/mindflow/blob/b8eadd2a9a9171c875b5d5086237cc373add69b8/docs/independent-qa-report-round-5-p2-retest.md)

| 项目 | 状态 | 真实证据及关闭依据 | 保留范围/限制 |
| --- | --- | --- | --- |
| QA-001 正常备份完整恢复 | PASS | B2两卡各4500子节点完整UI往返、异常/事务回滚；B3～B5回归 | 不代表所有物理存储条件 |
| QA-002 粘贴JSON/文件导入、去重 | PASS（Chromium） | B2真实UI、坏JSON、重复/缺字段、关闭/离线重开、无外站请求；B3/B5抽查 | 实际iOS剪贴板/文件选择仍未验 |
| QA-003 深树定位/返回焦点 | PASS | B3实际16层DOM焦点、返回/重复/方向键及目标缺失回退；B4/B5保持 | VoiceOver未验 |
| QA-004 当前字号持久化 | **PASS/CLOSED** | B3真实写锁、立即刷新/意图恢复、request-success后abort不Saved、commit后成功、失败重试与并发；[负责人DEC-002](v1-release-decisions.md)批准拆分关闭 | 不将历史因果写CONFIRMED |
| QA-004 历史唯一RCA | **NOT CONFIRMED / 风险ACCEPTED（非生产）** | 原运行41014649370、历史RCA与B2～B5P2证据缺口；负责人正式接受剩余风险 | 不是已证根因；不单独阻断非生产，不批准生产 |
| QA-005 移动首屏阅读 | PASS（既有Chromium状态） | B2/B3/B4阅读优先与390px回归 | 非真机/非任意标题布局穷尽 |
| QA-006 横滑/竖滚保护 | PASS（Chromium） | B2/B3真实Chromium触摸及边界事件/按钮排除，后续保持 | iPhone触摸/选择未验 |
| QA-007 未加密备份告知 | PASS | B2/B3导出入口明文提示，大库/下载沿用 | 文件确实未加密，需妥善保管 |
| QA-008 Markdown/公式 | **PARTIAL，维持已批准V1范围** | B2/B3确认受限Markdown/惰性安全显示；完整公式、表格、代码块排版未实现 | 不以V1.1计划替代未满足V1硬条款；当前无完整排版PASS声明 |
| QA-009 本地严格CSP | PASS（本地生产构建服务器） | B2/B3/B4/B5P2；无unsafe-eval、浏览器无Ajv compile；实际头下功能正常 | Cloudflare线上头NOT VERIFIED |
| 基本离线存储/阅读 | PASS（Chromium已测） | B2/B3及冻结本次核心SW离线/持久化测试 | 主屏离线冷启动/OS终止未验 |
| R4-001 已验证暂存状态篡改 | **PASS/CLOSED** | B5原收藏场景及全字段、proof/链故障、私有快照/写入边界；B5P2回归 | 非穷尽任意恶意同源脚本/全套重签攻击 |
| R5-001 下载状态错误承诺 | **PASS，B建议CLOSED** | B5P2原两项真实拒绝失败变PASS，未知/可观察拒绝/取消/异常/重试及跨文件状态 | 保留B“建议关闭”措辞，不伪造独立Issue关闭动作；无下载回执时始终未知 |
| 大库数量/容量扩展 | PASS（已测环境） | B4/B5：501/2000/2001/10001卡，21卷；50,337,817及88,493,973数据卷字节完整往返 | 总量无旧门槛≠无限资源承诺；普通/有限备份界面仍有各自限制 |
| 无Directory+工作区新增不足但允许下载 | PASS（已测环境） | B5真实2001卡/7卷/54,301,665字节下载后恢复，B5P2保留结论 | 原库可读、下载/设备空间可用、目标恢复有空间 |
| 极端存储/下载受限环境 | **条件性P1 OPEN** | B4/B5/B5P2：安全拒绝/保源≠成功迁出；下载禁用、物理空间不足等未普遍支持 | 本次负责人未关闭/接受正式用户升级风险 |
| Safari/WebKit、真实iPhone、VoiceOver | **NOT VERIFIED** | 无对应独立真机/引擎证据 | 必须按平台计划实际执行 |
| 主屏离线冷启动、系统强杀/驱逐、跨版本SW | **NOT VERIFIED** | localhost离线刷新不是这些场景 | 同源升级和硬件测试另记 |
| Cloudflare HTTPS/线上响应头/实际部署 | **NOT VERIFIED / BLOCKED** | 无现成Cloudflare账号绑定/凭据与运行网络；只完成本地包/模拟头 | 无URL，不冒充已部署 |

正式生产发布仍**NO-GO**。非生产原则批准、技术PASS、风险接受、平台待验是不同维度。
