# Mindflow V1 Beta：B 独立线上验收报告

验收人：独立验收者 B。实测日期：2026-10-31，Asia/Shanghai。主要线上观测时间为 14:17–14:25（原始 JSON 保留 UTC 时间）。本报告只评价固定非生产部署，不是生产验收。

**结论：Work Remote UX Readiness = READY WITH NOTES。可以启动仅使用公开合成数据的 ChatGPT Work 独立产品体验验收。** 当前浏览器在证书校验开启时可信访问 HTTPS，核心流程、SW 控制与缓存、离线刷新和关闭浏览器后的离线重新启动均实测通过；未新发现阻断性 P0/P1。发现 1 项 P3 错误文案问题，另保留 1 次未重复的浏览器上下文关闭观测。

**iPhone Device Readiness = NOT VERIFIED。Production Release Readiness = NO-GO / NOT APPROVED。** 既有条件性迁移 P1 OPEN、QA-008 PARTIAL 及历史唯一 RCA NOT CONFIRMED 均保持原状态。

## 1. 对象、证据来源与边界

| 固定项目 | 值 |
|---|---|
| 仓库 | easonwycgz/mindflow |
| 冻结应用 Commit | `df48c9d2eae22f3fc97487db80ab61b59813adc9` |
| 冻结源码树 | `a75bfbecb277fb4071d4880e8cad756c01ac5085` |
| 治理 Commit | `31cb07ee4ffe5c373cf797d6d28ce9fe5d7f288f` |
| 治理分支 | `docs/v1-rc-df48c9d-governance` |
| 唯一实测部署 URL | https://36e604de.001beta.pages.dev |
| Deployment ID | `36e604de-ef6f-465f-886c-780803941ff9` |
| Pages / 部署分支 | `001beta` / `rc-df48c9d` |
| Production branch | `production-disabled` |

已通过 GitHub 连接读取上述治理 Commit 的以下九份完整文件：

1. `docs/v1-cloudflare-preview-deployment.md`
2. `docs/evidence/v1-cloudflare-preview/deployment-evidence.json`
3. `docs/evidence/v1-cloudflare-preview/wrangler-deploy.txt`
4. `docs/evidence/v1-rc/build-provenance.json`
5. `docs/evidence/v1-rc/dist-sha256.txt`
6. `docs/v1-release-decisions.md`
7. `docs/v1-work-handoff.md`
8. `docs/synthetic/mindflow-v1-work-example-a.json`
9. `docs/synthetic/mindflow-v1-work-example-b.json`

[A 的正式部署归档](https://github.com/easonwycgz/mindflow/blob/31cb07ee4ffe5c373cf797d6d28ce9fe5d7f288f/docs/v1-cloudflare-preview-deployment.md)优先于旧交接说明。交接、构建证明与旧决策中的“尚未部署／没有 URL”是部署前历史状态，不据此否定已有部署。

| 证据类型 | 本报告如何使用 |
|---|---|
| A 历史证据 | Cloudflare API 的完整 Deployment ID、preview 环境、project ID、branch、commit_hash、commit_dirty=false、deploy/success、production-disabled、生产部署数 0；原编译过程及历史 CI |
| B 本轮独立证据 | 指定 Commit 文件读取；现存原 ZIP 和 13 文件重算摘要；固定 URL 12 公开资源重新下载；响应头；可信 Chromium；合成 UI 操作、实际下载与恢复；SW、缓存、断网及移动模拟 |
| 本轮无法独立确认 | Cloudflare 控制面当前实时元数据及当前生产部署数量；公网 Cloudflare 原始证书链；真实 iPhone/WebKit 等平台 |

未调用 Cloudflare API，未请求、读取或记录 Cloudflare Token 值。Deployment ID 后缀、环境、源分支与生产隔离的云端元数据来源明确为 A 的归档；公开 URL 和资源摘要不能独立证明这些实时控制面字段。Deployment Identity 的 PASS 指归档身份链一致且 B 所见公开字节匹配冻结制品，不扩大为 B 已重新验证 Cloudflare 控制面。

## 2. 环境与操作约束

- Debian GNU/Linux 13，Linux x86_64；Chromium `154.0.8037.57`；Python Playwright `1.62.0`。桌面 1280×900；移动模拟 390×844，启用触摸并用 CDP 发送触摸事件。
- 继承环境 HTTPS 代理及既有 CA 信任。运行观察为 running/connected、observations_current=true、网络 restricted/enforced。没有改变网络策略、系统或浏览器证书信任。
- `ignore_https_errors=False`，未使用 ignore-certificate-errors、ignoreHTTPSErrors=true、TLS 校验关闭或 CSP 绕过。浏览器显式附加的启动参数只有容器运行所需的 `--no-sandbox`；它不关闭 HTTPS 证书校验。
- 浏览器 profile 全部新建于 `work/preview-review/`，没有打开既有私人浏览器数据库、私人 ChatGPT 对话、知识库或备份。只导入官方公开合成 A/B；长正文用 B 派生的公开合成卡，增加三级节点和 80 段测试文字。
- 仅进行线上 UI 验收和只读制品核对。没有 npm 安装、应用重建、重新部署、Cloudflare 配置修改、main/开发分支修改、PR #1 操作或历史 QA 报告改写。
- 最初受执行沙箱 socket 限制的启动/HTTP 尝试没有到达产品；获得既有授权范围内的命令执行后，通过原代理正常检查。没有绕过目标域策略或 TLS。

## 3. 判定表

| 验收项目 | 状态 | B 证据及限制 |
|---|---|---|
| Deployment Identity | PASS | A 的指定元数据与任务一致；B 固定 URL 的 12/12 公开资源匹配冻结制品。实时控制面元数据仍 NOT VERIFIED |
| Frozen Build Provenance | PASS | B 原 ZIP 大小、整体 SHA、13/13 文件、源码树、冻结 `_headers` 与治理清单一致；原编译过程来源 A，未重建 |
| HTTPS / TLS Browser Trust | PASS | 两次全新隔离 context 正常 HTTP 200；TLS 1.3，secure context；无证书警告、异常跳转或阻断性应用 JS 错误 |
| Static Resources | PASS | 12/12 公开资源 HTTP 200、摘要一致、Content-Type 正确；Manifest 浏览器解析无错误；图标尺寸正确 |
| Security Headers | PASS | 4 个全局安全头逐值匹配；SW no-cache；index.html 原始 308 为 no-cache，最终 `/` 采用 must-revalidate |
| Core JSON Import | PASS | A 粘贴、B 文件、去重、`{}` 和损坏 JSON 拒绝，原合成库保持；错误文案见 P3 |
| Summary / Knowledge Tree / FAQ | PASS | 标题／摘要／要点／标签，子节点展开、三级长正文、返回节点焦点、键盘、FAQ 完整回答 |
| Search / Favorites / Random | PASS | “合成”搜索、空结果恢复、收藏筛选／清除、两卡切换、六次随机切换，状态保持 |
| Persistence / Backup / Restore | PASS | Saving→Saved 后刷新；字号、卡片、收藏、节点保持；实际下载文件、浏览器下载记录、合成恢复和错误恢复拒绝 |
| Service Worker | PASS | 注册 activated，scope `/`，控制当前页；Workbox precache 实际存在 10 条目 |
| Offline Browser Behavior | PASS | 断网刷新、已有卡片摘要阅读；关闭浏览器后断网新进程冷启动并阅读 FAQ；恢复网络成功 |
| Mobile Browser Experience | PASS | 仅 Chromium 390×844：摘要、树、FAQ、大字、横向切卡、纵向滚动、位置保持、无横向溢出 |
| Network Privacy | PASS | 限本轮已记录流量：桌面 45、移动 26 条页面/context 请求均同源 GET，无 JSON 上传、第三方脚本或分析请求；后台上报边界见下文 |

以上 PASS 均限已列场景，不能替代未执行的平台、容量、迁移或生产验证。

## 4. 部署与制品重新核对

原 ZIP：172354 bytes，SHA-256 `e0d83d8e73c2b0510ed4ca9199dc3d6c0d2d4a798520b3803a871c2a5b44d348`。13 个唯一预期非目录文件，无额外文件、路径穿越或符号链接；13 项逐字节摘要和两份正式清单一致。冻结 Git tree 与构建证明一致，ZIP 内 `_headers` 逐字节等于冻结 Commit 的 `public/_headers`。

B 本轮重新取得的线上资源：

| 资源 | 最终状态 | Content-Type | 对冻结 SHA-256 |
|---|---:|---|---|
| `index.html` → `/` | 200（308 同主机规范化） | text/html; charset=utf-8 | MATCH |
| `assets/main-CHwLQiEH.js` | 200 | application/javascript | MATCH |
| `assets/migration-kjdj7X33.js` | 200 | application/javascript | MATCH |
| `assets/style-BGrn-dwi.css` | 200 | text/css; charset=utf-8 | MATCH |
| `assets/style-Bp_TMkjA.js` | 200 | application/javascript | MATCH |
| `assets/workbox-window.prod.es5-BBnX5xw4.js` | 200 | application/javascript | MATCH |
| `icon-192.png` | 200 | image/png，192×192 | MATCH |
| `icon-512.png` | 200 | image/png，512×512 | MATCH |
| `manifest.webmanifest` | 200 | application/manifest+json | MATCH |
| `migration.html` → `/migration` | 200（308 同主机规范化） | text/html; charset=utf-8 | MATCH |
| `sw.js` | 200 | application/javascript | MATCH |
| `workbox-2fbc6a65.js` | 200 | application/javascript | MATCH |

另测 `/` 返回 200 且等于 index 摘要。没有 HTTPS 降级或跨主机重定向。

`/_headers` 本轮返回 200、666 bytes、text/html，SHA 与 index.html 一致，是 SPA 回退；**不是 `_headers` 原文**。因此准确说法仍是“13 项本地制品完整性 + 12 项线上公开资源完整性 + 实际线上响应头”，没有“13 项公网摘要匹配”的结论。

完整逐文件摘要、响应及重定向记录见 [HTTP 证据](evidence/v1-preview-acceptance/http-observations.json)、[本地制品与头对照](evidence/v1-preview-acceptance/provenance-and-headers.json)、[补充观测](evidence/v1-preview-acceptance/followup-observations.json)。

## 5. HTTPS 与实际安全响应头

当前 B 浏览器没有复现 A 的 `ERR_CERT_AUTHORITY_INVALID`。两次初始隔离访问均成功，标题为“Mindflow · 慢读，深想”，正常显示空库。浏览器观测 TLS 1.3，证书 subjectName 为固定部署域名，issuer 为环境代理 `openai.com`。这证明**当前浏览器信任其实际收到的 HTTPS 链**，不声称独立取得 Cloudflare 公网原始证书链。无证书信任修改。

本轮实际响应：

| 响应头 | 实测值／核对 |
|---|---|
| Content-Security-Policy | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`，精确匹配 |
| X-Content-Type-Options | `nosniff`，精确匹配 |
| Referrer-Policy | `no-referrer`，精确匹配 |
| Permissions-Policy | `camera=(), microphone=(), geolocation=()`，精确匹配 |
| Cache-Control：`sw.js` | `no-cache`，精确匹配冻结要求 |
| Cache-Control：原始 `/index.html` | HTTP 308，`no-cache`，Location `/`；精确匹配冻结路径规则 |
| Cache-Control：最终 `/` 及其他公开资源 | `public, max-age=0, must-revalidate`；没有冒充字面 `no-cache` |
| Strict-Transport-Security | 本轮未返回；冻结 `_headers` 未规定，不据此伪造匹配结果 |

4 个全局安全头在 12 资源最终响应及首页上均匹配，另保留原始 index 重定向响应。浏览器读取的首页头与 HTTP 客户端记录一致。未观察到应用资源失败或应用导致的 pageerror；第一轮自动化等待函数触发的 CSP 拒绝单独归于测试工具使用错误，见测试计数说明。

## 6. 本轮实际浏览器测试与数量

**有效独立用例 27 项：27 PASS，0 产品 FAIL，0 用例跳过。** 桌面／离线 20 项，移动模拟 7 项。其他资源与制品检查另计，不把文件数当功能用例数。

| 编号 | 实际动作与结果 | 状态 |
|---|---|---|
| B01 | 可信 HTTPS、空库、导入入口清楚，无初始错误 | PASS |
| B02 | 粘贴官方样例 A，出现完整标题与 1 张卡片 | PASS |
| B03 | 文件导入官方 B，库为 2 张并切至 B | PASS |
| B04 | 重复 A 提示已存在，仍为 2 张 | PASS |
| B05 | `{}` 拒绝，A/B 仍可打开 | PASS（P3 文案） |
| B06 | 损坏 JSON `{` 拒绝，库不变 | PASS |
| B07 | 摘要、关键要点、标签与官方 A 内容一致 | PASS |
| B08 | 树展开、子节点全文、正文焦点、返回原节点；ArrowUp 回父节点 | PASS |
| B09 | 两个 FAQ 均展开且答案完整，切换正常 | PASS |
| B10 | “合成”2 条→不存在词 0 条→“合成”2 条 | PASS |
| B11 | 收藏 A、只看收藏 1 条、随机禁用、清筛选、A/B 切换 | PASS |
| B12 | 连续随机 6 次无相邻重复；搜索与 A 收藏保持 | PASS |
| B13 | large，记录 Saving→Saved，等保存完成刷新，2 卡／收藏／字号／节点保持 | PASS |
| B14 | 明文警告、下载完成回执、保存文件与字节 SHA、结果反馈 | PASS |
| B15 | 改字号与收藏，再从已完成合成备份恢复；原设置／收藏返回 | PASS |
| B16 | `{}` 备份拒绝，卡片／large／收藏保持 | PASS |
| B17 | SW 注册、activated、控制页面及 Workbox 缓存清单 | PASS |
| B18 | 浏览器断网后刷新，原 A/B 库与 B 摘要可读 | PASS |
| B19 | 关闭整个浏览器，原合成 profile 新进程启动前断网，A FAQ 可读 | PASS |
| B20 | 恢复联网刷新，数据保持且 online=true | PASS |
| B21 | 390×844 空库首屏、导入入口、无横向溢出 | PASS |
| B22 | 移动模拟导入 A/B、阅读摘要／层次 | PASS |
| B23 | 移动树展开、子节点内容与返回焦点 | PASS |
| B24 | 移动 FAQ、large Saved、文字正常换行 | PASS |
| B25 | CDP 原生模拟左／右触摸，两卡互切 | PASS |
| B26 | B 派生三级树／80 段长正文；纵向触摸不误切卡；刷新位置保持 | PASS |
| B27 | 390px 无横向溢出，操作按钮可触达，滚至页底查看布局 | PASS |

补充核查：原 ZIP 13/13 文件、公开资源 12/12、初始信任访问 2/2、Manifest 浏览器解析 errors=[]、2 个 PNG 尺寸、下载管理器记录以及 P3 两次重复取证。

**原始执行透明性：** 主用例共执行 47 次（第一轮桌面 20 + 修正工具后新 profile 桌面 20 + 移动 7）；43 次有效通过，4 次因测试工具写法无效，不判产品 FAIL。第一轮 B13/B15/B16 的 `get_by_label('字号', exact=True)` 找不到实际 combobox；B17 的字符串 `wait_for_function` 被真实 CSP 拒绝。仅修正工具选择器为 combobox、等待改为 evaluate 轮询，没有改变应用、CSP、证书或断言目标；新隔离 profile 的全部 20 项通过。[第一轮原始日志](evidence/v1-preview-acceptance/harness-first-run.json)保留，不能把这些自动化错误解释成应用缺陷，也不能省略它们。

最终数据见 [桌面／离线原始结果](evidence/v1-preview-acceptance/functional-results.json) 和 [移动原始结果](evidence/v1-preview-acceptance/mobile-results.json)。

## 7. 阅读、保存、下载与离线证据

摘要的标题、短摘要、两条要点和标签层次可区分；可快速理解这两张短合成卡的主题与用途。此为 B 本轮浏览器观察，不扩展成真实用户可用性评分。

节点正文获得 SECTION 焦点；返回树后焦点恢复 `a-child`，ArrowUp 到 `a-root`。三级长合成节点可逐层展开，80 段正文末段可读。移动纵向触摸将 scrollY 从 1000 移至 1917，没有误切卡；稳定保存位置为 2070，刷新后仍为 2070。文档宽度始终为 390，未观察横向溢出。模拟视口看不到真实刘海／Home Indicator，**真实设备底部安全区仍 NOT VERIFIED**。

字号观察日志明确含“正在保存字号；尚未提交，刷新后会继续完成。”和“字号已保存：大字”。等待 Saved 后才刷新；large、2 张卡、A 收藏和阅读节点保持。这次不是数据库阻塞、写事务 abort 或并发压力复验，未借普通刷新重写历史 RCA。

第一次有效完整备份：`mindflow-backup.json`，3183 bytes，SHA-256 `3deceb4e457b8359f8686d31f0391c8cbc82dc6a9ae995a92e27f4325a61cbb9`；`download.failure()` 为 null，`save_as` 完成且文件存在；随后修改本机字号／收藏，再恢复该文件成功。只记录公开合成备份的摘要与结果，不提交备份文件本身。

另一个新合成 profile 再次导出，已读取 Chromium `chrome://downloads/` 的完成记录并截图（自动化保存采用内部 UUID 名称），3181 bytes，文件存在、回执成功。[下载管理器证据](evidence/v1-preview-acceptance/download-record.json)。两份备份阅读状态不同，不能要求文件 SHA 相等。没有把点击下载或页面“已生成”当作落盘证明，也不声称网页能够验证用户机器的物理介质持久性。

Manifest 名称“Mindflow 知识卡片”，start_url/scope `/`，standalone；浏览器实际读取无解析错误。SW `sw.js` 注册 activated、控制页。Workbox precache 包含 index、migration、manifest、2 图标、5 个 assets，共 10 条目；SW 和 Workbox 自身脚本可访问是另一个检查，未与缓存条目数混淆。

断网通过浏览器 context 离线能力设置；普通 reload、关闭浏览器后新进程（导航前已离线）均能启动和读已有合成内容；原始响应记录有 from_service_worker=true。恢复网络后正常。此为 **Chromium 桌面 profile 的离线冷启动**，不是 iPhone 主屏安装、系统强杀、存储回收或跨版本 SW 更新证明。

## 8. 网络隐私与安全观测

最终桌面记录 45 条页面/context 请求、移动 26 条，全部是固定部署同源 GET。JSON 粘贴、文件导入、搜索、收藏、备份和恢复期间，没有观察到 POST/PUT、卡片 JSON 请求体、远程脚本、远程图片或第三方分析请求。卡片导入后能断网阅读并导出恢复，支持本轮数据在本机处理的判断。下载为本源 blob，不是上传。

**基础设施观测：** 实际响应含 Cloudflare `NEL` / `Report-To`，目标 `https://a.nel.cloudflare.com/report/v4`，success_fraction=0.0。这是可观察的网络错误报告配置；本轮页面/context 网络记录没有实际向该域发送请求，也没有证据表明卡片内容外传。浏览器后台／网络服务级自动上报未获得完整独立记录，不把页面请求日志当成所有后台行为的绝对证明；没有额外制造网络故障来发送上报。生产或私人数据使用前仍需明确该基础设施遥测边界。本轮 Work 继续只用公开合成数据，不新增私人数据使用授权。

本轮未出现疑似卡片数据外传请求，未触发停止条件。

## 9. 新发现问题及非重复观测

### B-ONLINE-001：协议错误直接呈现内部校验结构

| 字段 | 记录 |
|---|---|
| 编号／严重程度 | B-ONLINE-001，P3 |
| 浏览器和环境 | 本报告 Chromium 154 / Linux，桌面 1280×900，可信固定 HTTPS，隔离合成库 |
| 前置条件 | 已导入公开 A/B，2 张卡片 |
| 操作步骤 | 点“粘贴 JSON”→输入 `{}`→点“校验并导入”；重复同一流程 |
| 预期结果 | 拒绝不完整卡片，保留已有内容，提供易理解的中文错误与修正提示 |
| 实际结果 | 拒绝及保留库正确，但直接显示 `[ { "code": "custom", ... "path": [] } ]`，夹杂 `must have required property` 及字段名 |
| 证据 | [重复观测日志](evidence/v1-preview-acceptance/followup-observations.json)，[第 1 次截图](evidence/v1-preview-acceptance/issue-001-invalid-object-1.png)，[第 2 次截图](evidence/v1-preview-acceptance/issue-001-invalid-object-2.png) |
| 可重复性 | 2/2 定向重复一致；主用例 B05 也观察到；库保持 2 张 |
| 建议方向 | 后续授权范围内，将协议校验错误映射为简明中文，把技术诊断放到可选详情；保留现有拒绝与事务保护 |

该 P3 不阻断本轮 Work 准入。没有修改代码，也没有向 A 发出修复要求。

### B-OBS-002：补充下载取证中一次浏览器上下文关闭

在已完成主用例后，首次补充 chrome://downloads 取证时，`Download.save_as` 返回 `TargetClosedError: Target page, context or browser has been closed`，该次未获得补充文件或管理器截图。主用例 B14 的先前下载、已保存文件和 B15 恢复成功均已有独立证据；改用另一个全新合成 profile 后，下载回执、文件字节及管理器记录取得成功。

原因与归属 **NOT VERIFIED**，未重复，不能直接归因于产品、证书或部署；也不能宣称这个失败尝试已经落盘。保留 [原始异常记录](evidence/v1-preview-acceptance/download-observation.txt)。不列为已确认产品 P0/P1/P2，不据此覆盖下载的不确定性。如果后续 Work 同一路径再现，应带浏览器进程日志继续独立归因。

## 10. 未验证项目与阶段准入

以下均保持 NOT VERIFIED 或原有未关闭状态：

- Cloudflare 控制面当前实时 Deployment 元数据、生产部署数量；公网原始证书链（B 经受信环境代理）。
- 真实 iPhone、Safari/WebKit、VoiceOver、真实设备底部安全区、主屏安装与离线主屏冷启动、系统强杀／存储回收、跨版本 SW 更新。
- ChatGPT Work 本身的产品体验；本报告仅判断是否允许开始该独立阶段。
- 浏览器后台基础设施错误上报的完整实际行为；未证明存在卡片外传。
- 大库／逐卷迁移、配额耗尽、下载被策略阻止／取消、所有持久化失败注入、压力／并发及长时间可靠性，本轮没有重复这些历史验收。
- QA-008 PARTIAL；条件性迁移 P1 OPEN；QA-004 当前字号缺陷遵循 DEC-002 维持 PASS/CLOSED，历史唯一 RCA 仍 NOT CONFIRMED。既有历史根因风险接受仅限已批准非生产范围。

### Work Remote UX Readiness：READY WITH NOTES

可以启动固定 URL 上、隔离环境中、公开合成数据限定的 Work 独立产品体验验收。依据是 B 可信 HTTPS、27 个有效核心／离线／移动用例通过，以及没有新的阻断性 P0/P1；SW 和离线此次均已验证，不构成本阶段未验证阻断。备注是 P3 文案、一次未重复浏览器关闭观测、环境代理／后台报告证据边界及上述既有平台与迁移限制。

Work 应直接访问固定 URL；CSP frame-ancestors 'none' 保持，不为嵌入体验放宽。该准入不批准私人数据测试、main 合并、修复、重新部署或生产。

### iPhone Device Readiness：NOT VERIFIED

390×844 Chromium 只能支持浏览器模拟结论，不能标记 iPhone PASS。

### Production Release Readiness：NO-GO / NOT APPROVED

本轮没有改变任何生产门槛或既有风险状态。

### A 与负责人后续职责

本轮证据不要求 A 在 Work 开始前进行定向代码整改。B-ONLINE-001 可进入后续待安排列表，B-OBS-002 需在重复时继续归因；本轮未向开发者发消息或要求修复。负责人无需新增风险豁免即可按既有非生产／合成数据范围启动 Work；私人数据、基础设施遥测边界及生产准入仍须另行决策，不能用本报告替代。

## 11. 证据和提交边界

所有新增文件限本报告及 `docs/evidence/v1-preview-acceptance/`。证据包括文本 JSON、公开合成截图、复现脚本和文件摘要；不含用户备份、浏览器 profile、证书数据库、Token、环境 dump、node_modules、dist 或应用源码改动。复现脚本是验收工具，不是部署内容。

[证据索引](evidence/v1-preview-acceptance/README.md)列出文件用途及安全边界，[证据 SHA-256](evidence/v1-preview-acceptance/evidence-sha256.txt)绑定提交内附件。QA 分支为 `qa/mindflow-v1-preview-deployment-review`，基线精确为治理 Commit `31cb07ee4ffe5c373cf797d6d28ce9fe5d7f288f`；提交只新增 QA 报告和合成证据。本轮完成后停止，不创建修复、PR、部署或生产发布。
