# Mindflow V1 UX1：开发者 A 实现交接

任务日期：2026-10-31（Asia/Shanghai）。状态：**开发候选，等待负责人/B独立验收；不代表UX1正式通过。**

应用起点为 df48c9d2eae22f3fc97487db80ab61b59813adc9。新分支 feat/mindflow-v1-ux1；独立 Draft PR 以 feat/mindflow-v1 为 base，仅评审增量，不授权合入冻结分支。完整最终 SHA、PR身份、最终工作区状态和当前 push/PR CI 的实际运行结论记录在本 PR 说明中，避免将治理文档提交误当另一个已测试应用。

## 前置检查与部署边界

初始现有隔离 checkout 干净，无未提交文件；HEAD/main=e061135f1b197347bbdd35c519334405aa0a12c5。原 feat/mindflow-v1 与 PR #1 head 精确为冻结 SHA，PR #1 OPEN/DRAFT/未合并；治理 head=31cb07ee4ffe5c373cf797d6d28ce9fe5d7f288f。创建前远程无 UX1 分支。

Cloudflare只读控制面核查了当前账号的全部1个Pages项目：001beta的source=null，production_branch=production-disabled，未连接Git自动部署。冻结仓库没有部署workflow或Wrangler配置。没有创建部署、修改项目或更新固定Preview；未修改main、原开发分支、治理/QA分支，未合并PR。

## 六项实现与保护

|项目|实现及涉及文件|保留行为与新增验证|限制|
|---|---|---|---|
|UX-02|src/readingSession.ts；App.tsx；LargeMigration.tsx的可选恢复屏障|页面内存保存临时入口/游标，视图令牌拒绝迟到查询；旧位置150ms任务先排空；位置恢复在绘制前同步确认，忽略恢复自身的迟到滚动事件；浏览器自动滚动恢复设为manual避免竞争；收藏仅补丁favorite；采用新位置时reading+settings同一事务；恢复前停止新写入并排空旧写入；结束入口不把跳往列表的程序性滚动写成阅读进度|当前v1仍只有一个持久游标，FAQ展开/任意树枝展开不新增持久化；浏览器关闭时写入仍是best effort|
|UX-01|src/readingPresentation.tsx；App.tsx；style.css|第一条原文只作一次核心收获，随后最多两条；全文及全部要点可展开；Hook/标签一键可达；树/FAQ/结束入口；长核心/要点完整折叠降级，不截断条件|120/300是软目标，不能保证所有卡30秒读完，也不证明陌生读者理解|
|UX-03|Boundaries组件；相对字号与对比样式|标题附近按原顺序预览首条、完整提醒一键展开；没有关键词排序、日期推断、网络核实或风险徽标；空边界不解释成无风险|实际八卡关键caveat候选映射等待负责人确认，首条规则不能代替后续关键限制|
|UX-04|App.tsx Tree/路径索引及样式|展开行可见子节点数，aria-label保留父标题语境；摘要一次操作完整读取；路径按ID生成；保留父子关系、排序、方向键、Home/End、返回焦点与回退|不是并列比较、搜索或完整虚拟化树改造|
|UX-05|sourceDescription展示函数|四种元数据组合分别解释，不推测脱敏/依据/核实；URI只作记录，不生成链接或外部预览|source对象与两个必需子字段仍按原Schema校验|
|B-ONLINE-001|src/importFeedback.ts；model.ts的内存InputIssue；db.ts导入错误类型；App.tsx反馈|仍使用原standalone validator与相同大小/深度/唯一性检查；中文类别+下一步，错误alert、成功/重复status、技术详情折叠；拒绝及事务失败保源，输入可重试|未改备份/迁移的历史错误模型；未知读写异常不输出整个用户对象|

普通选卡、上一张/下一张、手势切卡继续正常续读；随机只改变临时视图，lastCardId不变。临时树/FAQ/滚动不保存；继续上次读取最新持久记录；“从这里继续（替换上次位置）”仅在真实事务提交后确认保存。字号仍由原FontWriter/patchSettings机制提交，不用旧settings整行覆盖并发字号。

不改变Schema、根合同副本、IndexedDB version(1)或记录形状、备份v1 envelope、分页迁移证明链与私有快照、下载不确定性文案、CSP或受限Markdown渲染器。LargeMigration只增加可选外围恢复屏障；独立迁移页未提供该钩子时沿用原流程，核心迁移算法未改。

## 测试与材料

- [实际八卡身份、统计、内容观察和候选关键caveat映射](ux1-corpus-review.md)：8/8 Schema合法；24组私有本地浏览器检查通过。实际材料不在仓库、发布资源、CI或公开工件中。
- [合成fixture、生成器及覆盖矩阵](ux1-synthetic-tests.md)：tests/fixtures/ux1.ts完全虚构；覆盖长短层、空边界/来源、16层/宽树、跨卡同ID、延迟/写锁/abort/恢复、安全及非法输入。
- [历史断言映射](ux1-test-mapping.md)：仅更新开发者维护的四处断言。独立B文件和旧报告保持字节不变；原“完整summary默认可见”的B用例冲突保留，不伪造通过。
- scripts/ux1-backup-compat.mjs执行精确冻结实现↔候选双向备份比较。tests/ux1-compat.test.ts同时保护合同、validator、CSP、独立测试和历史docs字节。
- 原Desktop/Pixel7配置保持；新增1363×936、390×844标准/大字项目。所有E2E使用production build和实际严格响应头。

必需命令均执行并按真实退出码记录：npm ci、npm run typecheck、npm run lint、npm test、npm run build、npm run test:e2e、npm audit --omit=dev。最新完整数量与CI链接见PR说明；不能用开发中失败后的定向复验替代最终完整结果。

## 尚未解决或未验证

1. UX-03实际八卡关键提醒优先级尚未批准；尤其C7第4条时间限制不会被首条规则自动提升。此产品可见性约束继续待负责人/B判断，A不关闭该P2。
2. 原B默认摘要全文可见的断言与批准的新呈现冲突；原件保持，新增等价安全用例另计，完整命令有失败就保持失败/红灯。
3. 真实陌生读者30秒理解、长期碎片阅读和留存未验证；长卡软目标及双主题覆盖不足不能通过字数冒充解决。
4. WebKit、真实iPhone Safari、VoiceOver、安全区真机、主屏离线冷启动、OS强杀/存储回收、跨版本SW升级均NOT VERIFIED；基本Chromium离线不代替这些平台证据。
5. QA-004当前字号按DEC-002为PASS/CLOSED；历史唯一RCA仍NOT CONFIRMED。QA-008 PARTIAL，条件性大库迁移P1 OPEN，所有历史治理风险状态不变。

没有实施AI、账号/云同步、任何数据上传、新JSON字段/DB版本、全文搜索、推荐去重、完整公式排版、比较视图、备份迁移重构、埋点或大规模视觉重设计。没有合并或部署；候选交付后停止等待B独立验收。
