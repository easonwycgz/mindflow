# UX1 独立合成测试集

全部自然语言均为虚构，未读取、引用或改写用户八卡。公开示例仅由历史原测试使用。实际八卡在仓库外单独验证。

| 类别 | 构造/预期 | 自动化位置 |
| --- | --- | --- |
| 快速层 | 1/2/12 要点、合法长项、否定条件、数字/单位、Unicode、中英文、短/长摘要、有限 Markdown；完整原文可达，不补造要点 | tests/fixtures/ux1.ts；tests/ux1.test.ts；e2e/ux1.spec.ts |
| 提醒/来源 | 空/单条/多条/1000码点 caveat，时间语境与一般限制并存，四种合法 source 组合；不改变原顺序或生成核实状态 | 同上 |
| 树 | 1/2/5/16 层，4500 同名不同 ID 兄弟节点，跨卡相同 ID；深度 17 必须拒绝；路径、一次预览、隐藏焦点和缺失目标回退 | fixture 确定性生成器；单元测试；新 E2E 与原 B-R3 |
| 临时/持久状态 | 不同 section/scroll，150ms 待写、迟到查询、快速连续随机、favorite 补丁、字号/lastCard 并发、结束后程序性滚动、恢复屏障 | src/readingSession.ts；tests/ux1-session.test.ts；e2e/ux1.spec.ts |
| 事务 | 采用新位置时真实 request success 后 abort；写锁等待、保存失败重试；导入中途失败原子回滚；恢复与待写任务交叉 | 新状态单测/E2E，原字号、备份与迁移回归 |
| 非法输入 | JSON 语法、缺失/额外/类型字段、错误版本/URI、source:null/缺子字段、重复 ID、数量/容量/深度超限；全部预期拒绝并保源 | invalidCases() 逐项标注 code；数据/E2E 测试 |
| 安全 | 核心、摘要、caveat、来源和节点中的 HTML/脚本/远程资源作为惰性文本；实际 CSP 下无执行、无外站请求 | e2e/ux1.spec.ts CSP；保留原独立测试 |
| 兼容/离线 | 精确冻结实现与候选双向备份 envelope 相同；临时发现时备份/恢复不含临时游标；SW 受控离线刷新与阅读 | scripts/ux1-backup-compat.mjs；tests/ux1-compat.test.ts；E2E |

合法 fixture 必须经过未改动的正式 validator；宽树使用精简正文以保持卡片≤2MiB。压力树由确定性函数生成，不提交巨大 JSON。非法 fixture 的预期拒绝原因与合法样本分开记录。

原有 Chromium Desktop、Pixel 7 项目继续保留。新增 ux1-desktop 为1363×936，ux1-mobile/ux1-large为390×844；large 项目实际提交字号意图并验证应用大字状态，不用截图缩放冒充。

浏览器迟到查询故障注入保持原生 readonly transaction 活跃，在真实请求循环中延迟结果。不能把 onsuccess 延迟到 transaction 已完成后，再把违反 Dexie 前置条件的结果当作应用缺陷。逻辑层另用可控 Promise 验证陈旧查询丢弃。

WebKit 可由既有 TEST_WEBKIT 诊断入口运行；实际 iPhone、VoiceOver、主屏离线冷启动仍须真机。A 回归与 B 独立验收分开，复跑本测试集不等于 B 已验收。
