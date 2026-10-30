# Mindflow V1 开发者第三轮修复交接报告

2026-10-30（Asia/Shanghai）。开发者 A 提交新候选给 B 独立复验；不代替 B 宣布关闭 P1、Go 或生产批准。原分支 feat/mindflow-v1 / 原 PR #1 继续使用，不合并 main，不部署正式产品。

## 依据与边界

读取并 fetch 固定 QA 提交 `32319f4dc987578190c05482d2619e5ac2d5b187` 的完整报告和三份新增测试，基线为 `f784ccf806edcf070381484a657948ebd7752613`。三个测试复制到开发分支后逐字节一致，原17项数据测试及B加入后的19项继续保留。第一、二轮QA分支与历史报告不修改，未整体合并QA分支。

所有正式卡片协议、Schema、示例和验收合同相对基线无差异。备份v1 envelope不加字段、不换版本。仅使用公开示例/合成数据做清表、故障与迁移测试。最终完整候选SHA、PR/push运行链接及结论由交付消息给出；可用 `git rev-parse HEAD` 与PR head核对。

## 修复及证据矩阵

| 项目 | 修改/代码位置 | 新证据 | 开发者结论 |
| --- | --- | --- | --- |
| QA-004 字号提交窗口 | `src/settings.ts` patchSettings/FontWriter：事务内读最新记录、字段补丁、串行队列、revision检查；`src/App.tsx` saveFont/load及font-save-state：Saving/Saved/Failed，commit后才应用/确认字体 | B未改的真实IDB锁立即刷新及十次提交后重开均通过；新增真实锁下Saving而非Saved、解除后提交；快速切换、两个writer/lastCard并发、失败/重试、journal失败、提交前刷新重放 | 已确认的持久化/反馈机制完成修复，是否关闭QA-004由B决定 |
| QA-004 历史因果 | 历史run41014649370表现为桌面字号预期large收到normal；B报告记录的历史/候选正常×30通过、受控写锁可复现同症状 | 本轮保留其独立诊断不改、不skip；当前修复针对确证机制。没有历史当次commit/unload时序trace | **不能证明历史唯一根因，仍待确认**；不虚构为已确认 |
| QA-003 焦点 | `src/App.tsx` returnToTree/treeKeys及data-node-id：找到当前节点，展开祖先，滚动并focus；缺失则首节点/容器回退；方向/Home/End键与原生Tab/Enter | B原焦点失败断言通过；新键盘独立进入/返回、连续两次、真实activeElement、箭头继续导航、节点移除回退；原16层和位置恢复测试继续通过 | 本地修复通过，不声称VoiceOver通过 |
| 旧501卡兼容 | `src/volumes.ts` exportVolumes/restoreVolumes + `src/db.ts` replacePayload；清单是包装侧车，每卷仍为正式v1备份；全局验证后一个三表事务 | 501张合法旧库正常打开；完整下载清单/两卷；清空→恢复→全部cards/reading/settings相同；缺/重/乱序/混/损卷及重算checksum后的跨卷重复拒绝；最终写入中断回滚 | 验证的501卡迁移通过；受2000卡/合计40MiB边界约束，不代表无限迁移 |
| QA-001/002 | 原正常容量备份、原子失败、粘贴导入未重设计 | 原17项+B2项存储测试保留；B两张4500子节点UI清库恢复、粘贴规则/无外站/重开全部通过 | 保持通过（已执行范围） |
| QA-005/006/007/009 | 保留移动阅读优先、手势排除、明文告知、预编译validator和严格CSP | 全套桌面/移动Chromium继续运行；竖滚不切卡、离线、本地实际CSP均通过 | 未发现新增回归；不推广到未测平台 |
| QA-008 | 正式合同允许plain text/restricted Markdown，B已确认无完整公式/表格/代码块硬条款；保留安全降级 | 原Markdown/XSS/惰性数学测试继续；`docs/v1.1-backlog.md`列出后续实现及安全门槛 | **PARTIAL**，不是完整PASS，也未私自删除V1硬门槛 |

## 保存状态、刷新与并发的具体语义

选择器展示请求值，页面字号及“已保存”对应已提交的IndexedDB值；保存期间可以不同，并明确显示“尚未提交”。本轮未用任意固定延迟、sleep或放宽超时完成修复。

在发起异步写入前，仅字号/token同步记入 `mindflow-font-intent-v1`；刷新后读取它并继续提交。数据库提交成功且token仍最新才清日志；失败保留请求并显示失败、提供重试。日志写入失败不伪造保存成功。卡片没有存入localStorage。字体写入与lastCardId更新使用事务补丁，避免旧React settings快照覆盖其他字段；过时请求在获得锁后也会再次检查token。

测试锁是原生IDB readwrite事务，被显式释放后才允许提交；刷新实验则让原页面退出并重新播放意图。UI真实提交信号和实际数据库/重开值都受到断言，不只是延长测试等待。

## 501卡方案的协议、关系和资源说明

完整设计见 [round3-compatibility.md](round3-compatibility.md)。旧版没有整库上限，501卡是合法状态，不称为损坏库。branch.id是同卡内标识；reading.cardId/nodeId和settings.lastCardId均被检查并保留，不丢弃阅读状态或树节点。

普通单卷backup仍最多500卡，B原单卷拒绝501测试不删除。新版独立“生成分卷备份”路径将完整卡和所属reading放在同卷，原全局settings放清单并正确投影到各卷；“恢复全部分卷”验证清单、每卷hash/数量、连续编号/所属set、全局UUID/hash去重和引用后再原子替换。文件选择顺序任意，清单序列严格。只选一部分或混入其他set不会留下部分新库。

迁移最多2000卡、16卷、每卷8MiB，**总计40MiB（含清单）**，并保留每卡2MiB/16层/50,000值安全限制。没有取消全部限制，也没有把总内存预算放大为16×40MiB。验证仍使用多个内存表示；实际iPhone内存/空间不足尚需实测。超过迁移边界的旧库需要另行设计流式暂存/崩溃恢复流程，本候选明确拒绝、保留原数据，不声称覆盖。每个卷仍无加密，完整性hash不是身份认证。

## 当前实例真实执行

完整清洁安装链（Node24.19.0 / npm11.9.0 / 系统Chromium154.0.8037.57）：

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
npm audit --omit=dev
```

- 上述完整链退出0，types/lint/build PASS。
- 数据：5文件、27 PASS、0 FAIL/SKIP。构成为原17 + B独立2 + 第三轮8；B所谓19项合并数据套件全部保留通过。
- 浏览器：54场景、53 PASS / 1原有不适用SKIP / 0 FAIL；唯一SKIP仍是第一轮独立触摸测试的桌面条件，移动确实执行，未新增skip/retry。
- 第二轮4个失败（字号写锁和返回焦点×2项目）原测试字节不变，本轮通过。
- 生产依赖audit0已知漏洞。构建保留第三方注释及弃用警告，不掩盖；主JS约479kB、预缓存约489KiB。
- Playwright在应用实际dist/_headers的本地生产服务器运行；不含unsafe-eval，未降低CSP。Tailwind扫描限制到src，避免公开日志内容改变构建CSS。

## B可直接读取的脱敏证据

- [完整本地检查文本](evidence/round3/local-validation.txt)：实际命令输出、全部浏览器测试名称、exit0；测试仅公开/合成内容，无环境dump或真实用户知识库。
- [数据测试详细文本](evidence/round3/data-details.txt)：逐条数据测试实际结果。
- [源文件SHA256清单](evidence/round3/source-sha256.txt)：在候选根目录运行 `sha256sum -c docs/evidence/round3/source-sha256.txt` 可核对证据对应的应用、测试、配置、脚本。
- 这些文件提交在公开仓库，可用Git show、raw网页或blob网页直接读取，不依赖Actions工件API。此为用户明确授权的合成文本证据例外，不上传私人备份、凭证或环境信息。
- CI配置额外写入GITHUB_STEP_SUMMARY文本（带产品head SHA），工件保留完整HTML/trace和文本14天。不过本轮公开run/job页面未显示摘要正文，工件内部内容未下载复核，**不把它们称为已验证公开可读的证据**；B可直接读取的证据以本仓库上述文本/摘要清单为准。
- 功能修复提交 `54c3da525e429c5fcb3ba6056e52df573731f3fd` 的 [PR run41029931957](https://github.com/easonwycgz/mindflow/actions/runs/41029931957) 和 [push run41029924833](https://github.com/easonwycgz/mindflow/actions/runs/41029924833) 公开网页均核实SUCCESS（均约1m31s）。仓库blob页面实际读到了27 passed、53 passed、VALIDATION_EXIT_STATUS=0；源文件38条SHA256均匹配。
- 随后的交接证据文档补充提交不改变应用或测试；最终PR/push运行仍须对应同一交付head，结果在交付消息另行核实，不拿前一个SHA的绿灯代替。

## 九个交付回答与未验证范围

1. 字号确证机制已修复并有原失败测试、新提交状态/锁/错误/并发/重放测试支持；QA-004关闭由B独立判断。
2. 历史当次唯一根因仍无充分时序证据；不将相同症状等同唯一因果。
3. 树返回真实DOM焦点和键盘继续导航已完成本地自动化。
4. 合成501旧卡可完整导出/清库/恢复，事务故障和无效分卷不残留部分写入；范围限上述资源预算。
5. QA-001/002原及独立用例继续通过。
6. 已执行范围没有观察到新的P1/P2；未验证平台和更大旧库仍是明确边界，不给出无缺陷保证。
7. QA-008符合已确认的受限V1范围，完整数学等登记V1.1，仍PARTIAL。
8. 本地完整链实际通过；最终托管CI状态/链接见交付消息，不用本地结果代替。
9. WebKit/Safari、真实iPhone、VoiceOver、主屏离线冷启动、系统驱逐/强制终止恢复、跨版本SW更新、Cloudflare真实HTTPS响应头及生产部署均未验证/未执行。Chromium仿真与本地CSP不能替代。

原历史记录保留，不合并main、不发布生产。请B对交付的精确完整SHA进行第三轮独立验收。
