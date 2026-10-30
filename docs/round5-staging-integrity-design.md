# 第五轮暂存完整性设计与存储环境边界

## 依据与复现

唯一基线ba60e55110b92658d450036e59ef415b6e946336；B报告3752a12896f903e5636b474b218c9c288f65a70b。只读获取其报告、independent-validation.txt及两个测试，未修改QA分支。复制tests/independent-round4.test.ts及e2e/independent-round4.spec.ts原文作为回归。

修改前实际重跑B收藏数据用例：fulfilled、targetChanged=true、state=complete，断言失败。日志baseline-integrity.txt保留。它是本轮开发者复现，不替代B第四轮原始证据。

## 根因：完整卷曾验证，不等于实际写入的数据已验证

原始导出与卷校验**包含**完整cards、reading、settings，favorite并未遗漏于外部备份checksum。缺口在暂存衍生结构：StageReading只保存record，原始完整文本未保留；ready记录的是先前全卷校验结果。

旧提升代码只重验卡片content hash、字段Schema/ID/引用，不将完整StoredCard元数据和Reading重新绑定到清单链。合法布尔、scroll、时间戳等修改仍符合Schema。事务正常提交错误状态，进而显示成功；不是事务只提交了一半。此问题兼有“提升校验范围不完整”和“验证后衍生数据可变”，不能靠只检查favorite或新增verified标志修复。

## 证据存储与规范化

主MindDB version1及正式Card/备份Schema全部不变。复用独立MigrationWorkspace既有files表：恢复任务index0保存用户选择的原清单原文，index1..N保存各卷原文。每卷原文与cards/reading/receipt/job进度在同一个暂存事务内提交，任一步失败整卷回滚。integrityVersion=1仅表示具备新证明结构，不是有效性判定。

每个恢复卷仍是原v1 envelope。原文按现有hash(text)算法参与外部root.chain：SHA-256的输入是canonical(JSON string text)，**不是raw-file sha256sum**；空白改变也改变链。payload checksum与完整记录比较均采用现有canonical：对象键递归排序，数组顺序保留。无新序列化库，不修改过去文件格式。

完整StoredCard（id、hash、createdAt、updatedAt、content全部字段）及完整Reading（cardId、favorite、section、nodeId、scroll）与原始卷解析值比较；树节点全部字段、层级和数组顺序自然包含于content。原协议没有跨卡外键字段，现有关系是reading.cardId→card UUID、reading.nodeId→同卡节点、settings.lastCardId→全局卡；source URI也作为实际内容字段覆盖，但不伪称它是外键。root.settings校验与每卷投影、全局引用一致。

## 校验对象与提交对象一致

1. 读取ready任务后重新校验原root文本、自身checksum、任务root一致性和各表数量；缺旧版证明直接拒绝，要求只删除相应恢复暂存后从原文件重建。
2. 开启目标cards/reading/settings单个readwrite事务；每次只读取一个不超过8MiB的原卷和receipt，重新校验协议、payload checksum、完整文件checksum、元数据及链。
3. 原卷解析结果是本次调用私有的值快照，未暴露给UI/onProgress。逐批最多4卡读取暂存衍生记录，比较**完整canonical记录及外层索引字段**。
4. 比较成功后直接写入刚验证的私有原卷值；**不再次从暂存查询写入对象**。即使其他连接恰在比较后改写暂存，也不能改变此对象。事务内再读回当前批的实际写入值并逐项比较。
5. 最后核对整链、总卡数、总字节、root证明与计数、目标引用与数量/设置。链不匹配即使已写前面批次也抛错，整个目标事务回滚。
6. 只有native transaction complete后函数才返回complete、UI才显示完整提交。request success、ready和先前校验结果均不足以成功。

没有以额外sleep、增大旧断言超时或放宽原测试维持正确性。首次尝试长期锁定暂存readonly事务并跨事务写目标，fake-indexeddb通过但原生Chromium暴露TransactionInactiveError；最终采用短工作区事务+私有值快照，移除该尝试。失败诊断保留，正常恢复与旧配额注入必须重新通过。

### 并发语义与最后边界

已在比较前改变的暂存记录必须拒绝。已经复制并核验后才改变的暂存记录，不再是目标写入源：允许提交完整原始快照，或后续校验发现不一致后回滚；**绝不提交变化值**。这不是继续信任旧ready。

数据测试在target.cards.bulkAdd入口拦截：已通过产品比较，实际add尚未调用；先等待另一连接真正提交favorite修改，再恢复原add，目标仍逐项等于原备份。浏览器在原生IDBObjectStore.add最后入口发起另一连接修改，确认修改真实提交，目标完整三表仍等于原始备份。该用例是“晚于快照复制的并发变化不污染已验证输出”，不是声称所有并发写入都会被拒绝。

原始外部root仍是无密钥完整性校验，不提供签名/恶意同源脚本防护。能够同时伪造全套文件、root及所有checksum的人可制作另一套合法备份；CSP、无上传原则保持，不把普通SHA-256当认证。

## 内存、配额与旧暂存兼容

保持不设2000卡、40MiB、16卷总量门槛；单卡历史2MiB/16层/50,000值、单卷500卡/8MiB、批次4条及恒定root不变。提升内存由一个原始卷及其解析/规范化/校验表示、当前4条衍生记录组成，不拼整库；这不是原生进程/事务日志恒定内存保证。

恢复暂存现保存原文和衍生索引记录，物理占用通常高于上一候选，必须预留两种表示、索引及主库原子事务日志所需空间。不能用一个简单navigator.storage.estimate余额保证事务必成功，配额是动态且后端实现不同。任何工作区QuotaExceededError都不改变主库，提升QuotaExceededError回滚整个目标，原文件和原库保留。

旧版export缓存可以继续导出；旧版restore ready不含证明，不自动升级信任、不自动提升。用户保留备份，删除**该恢复暂存**并重新选择原清单与分卷。不得让用户清空唯一原库来腾空间。

## 不依赖整库暂存的下载路径

“逐卷下载（无需暂存空间）”复用exportPagedMigration的sink，完全跳过workspace写入。仍从同一个readonly源快照分页读4条，生成最多500卡/8MiB一卷，UI只持有当前卷。用户点击下载后确认继续，前卷释放，再生成下一卷；完成清单在整个源快照成功结束后最后请求下载。每卷等待受既有60秒外部IO截止约束；没有任意固定等待时间。期间原库写入会排队，超时/取消/刷新中止源快照，不改原库。

浏览器无法向网页可靠报告download attribute最终磁盘保存结果。因此只显示“请求下载、磁盘保存尚未验证”，不显示已验证备份成功；用户必须保存所有文件，并重新选择root及全部分卷完成校验，在有空间的目标环境显式恢复。不提供自动清库按钮。浏览器拒绝下载、Blob分配失败、用户取消或页面关闭时，提示部分文件属于不完整集合，保留已请求文件数量/最后名称（当前页面），不悄悄删除设备已下载文件；刷新后这些文件仍在用户下载位置，需重新导出完整集合。

### 实际环境矩阵

| 环境 | 本轮开发者证据 | 能力/失败行为 |
| --- | --- | --- |
| 桌面Chromium，有暂存空间 | 已执行 | 标准分页准备、证明暂存、原子恢复、故障回滚 |
| 移动视口Chromium，有暂存空间 | 已执行 | 相同真实IndexedDB路径；不是iPhone |
| 无Directory API、工作区新增记录全部QuotaExceeded，但原库可读、下载/磁盘可用 | 已执行 | 新逐卷下载实际文件，>2000卡且>40MiB，随后恢复到有暂存空间环境完整比较；不需要先腾出origin整库副本空间 |
| 下载中取消、Blob分配QuotaExceeded | 已执行故障注入 | 没有完成集合成功提示，部分文件明确标记，原库不变 |
| 暂存原文/索引写入或目标提升中QuotaExceeded | 已执行故障注入 | 整卷/目标事务回滚；原库保留 |
| 支持Directory API且本地目录有空间 | 核心真实文件sink既有测试回归；真实权限选择UI未手验 | 逐文件目录导出；无整库workspace副本 |
| 实际物理磁盘填满、浏览器自动下载拦截、OS杀进程 | 未验证 | 网页不能确认下载成功，必须保留源库；不将模拟配额冒充真磁盘测试 |
| 无目录API且下载也被禁止/没有可保存空间/无法在每卷期限内操作 | 已知没有已验证迁出方案 | 中止并保留源库，保留条件性P1；不能声称所有历史库兼容 |
| Safari/WebKit、真实iPhone/VoiceOver | NOT VERIFIED | API、下载、quota、生命周期均需独立平台验证 |

无需目录/暂存的**导出**不等于无空间的原子**恢复**：后者仍要求额外验证空间和目标事务资源。必须将文件带到有空间的环境，不必先删原来源。设备完全无可用保存媒介、下载政策禁止等极端条件，本候选不能创造可靠迁出能力；保留兼容/发布风险，不用错误提示冒充迁出成功。
