# Mindflow V1 Cloudflare Preview 部署与线上基础核验

更新时间：2026-10-31T13:42:15+08:00（Asia/Shanghai）。此为部署阶段的实际观测结果；本次仅归档已有证据，不重新部署或重跑线上检查。

## 结果

| 项目 | 当前状态 | 证据及边界 |
|---|---|---|
| Frozen Build Integrity | PASS | 原 ZIP 大小、SHA-256、恰好 13 个文件、13 项逐文件摘要与治理证明全部一致 |
| Cloudflare Authorization | PASS | 负责人确认 Account/Pages Edit 资源范围；Token Verify active、目标 Account Pages API 可访问，项目创建和 Preview 部署实际成功 |
| Non-production Preview Deployment | SUCCESS | API environment=preview，冻结 Commit/分支匹配，production branch=production-disabled，无生产部署 |
| Online Smoke Test | PARTIAL | 固定 HTTPS、12 个公开文件摘要及冻结安全响应头 PASS；Chromium 受本环境代理 CA 信任问题阻断，SW 注册/离线与核心交互未执行 |

**固定 Deployment HTTPS URL：https://36e604de.001beta.pages.dev**

- Deployment ID：`36e604de-ef6f-465f-886c-780803941ff9`。
- Cloudflare 返回的分支别名（会随后续部署变化，不作固定版本交付地址）：https://rc-df48c9d.001beta.pages.dev。
- 项目：`001beta`；项目 ID：`6c86da89-cf52-49e7-b193-38703c693933`。
- Account：`9218ff438dcbf07fe98a9a24695ba776`，与负责人明确确认的目标 Account 一致。
- Deployment environment：`preview`；Branch：`rc-df48c9d`。
- 实际部署源 Commit：`df48c9d2eae22f3fc97487db80ab61b59813adc9`。
- API 元数据 commit_dirty=false；latest_stage deploy/success；created_on=`2026-10-31T05:31:56.984511Z`。

源版本证明不只依赖自填 CLI 元数据：原 ZIP 与治理正式构建证明相同，上传前再次核对解压目录 13 个文件，线上 12 个公开文件也逐字节摘要匹配。

## 1. 环境与安全凭据

当前已发布配置运行观察：running、connected、observations_current=true；spec_revision=observed_spec_revision=1。已发布版本与运行时观察匹配；归档省略内部环境配置标识。网络 restricted/enforced，api.cloudflare.com、001beta.pages.dev、*.001beta.pages.dev 在允许域内，package_managers 预设保留。未修改配置或网络权限。

- CLOUDFLARE_ACCOUNT_ID 与 CLOUDFLARE_PAGES_PROJECT 运行时 ready，实际项目值为 001beta。
- CLOUDFLARE_API_TOKEN 安全绑定 ready，目标域限定 api.cloudflare.com；使用当前运行时继承的代理、CA 及安全注入凭据。
- 未新增 CLOUDFLARE_PAGES，未重命名环境变量。
- 负责人已明确确认 Account Cloudflare Pages Edit 覆盖本 Account；本轮不要求 Account Details 或 API Tokens Read，也未调用这些接口。
- Token Verify：HTTP 200，active；目标 Account Pages 列表 HTTP 200；创建前目标项目 HTTP 404，与负责人确认“项目尚不存在”一致，随后按明确授权创建。
- 无 Token 输出、秘密文件读取、环境 dump、秘密写盘或 GitHub 提交。Wrangler 部署禁用遥测和磁盘调试日志，并启用日志脱敏；npm 缓存与 CLI 配置均放在 work/ 下。

## 2. 仓库与冻结版本

仓库 `/workspace/mindflow`，origin fetch/push 均为 `https://github.com/easonwycgz/mindflow.git`。当前治理分支 HEAD 为 `8a46eaef581b0d2b496947079498395170f5d0ef`；本地 origin/main 为 `e061135f1b197347bbdd35c519334405aa0a12c5`。初始及结束工作区均干净。

冻结应用 Commit 为 `df48c9d2eae22f3fc97487db80ab61b59813adc9`；治理档案仅用于读取正式证明，未整体作为部署源码。本轮未重新构建，未运行 npm ci/typecheck/lint/test/build，未创建功能改动或工作树。上传的是从已核验原 ZIP 解压出的独立目录：`/workspace/work/mindflow-preview/run-05tfmrhy/deployment/dist`。

结束时 GitHub 连接重新确认 PR #1 为 Open/Draft/merged=false，head 为冻结 Commit，base 为 main、base_sha=e061135f1b197347bbdd35c519334405aa0a12c5。未修改 Git 引用、源码、package.json、lockfile、PR 或 main。

## 3. 原 ZIP 完整性

- 取得的文件：`/workspace/artifacts/mindflow-v1-rc-df48c9d.zip`。
- 实际大小：**172354 bytes**，与历史预期 172354 一致。
- 实际 ZIP SHA-256：`e0d83d8e73c2b0510ed4ca9199dc3d6c0d2d4a798520b3803a871c2a5b44d348`，与历史预期一致。
- 正式证明直接读取治理 Commit 的 `docs/evidence/v1-rc/build-provenance.json` 与 `docs/evidence/v1-rc/dist-sha256.txt`。
- ZIP 内恰好 13 个非目录文件，无重复条目、路径穿越、符号链接或额外包装目录；文件集合与归档清单完全相同。没有环境文件、私人数据库、用户备份或治理文档等额外文件。
- `_headers` 同时逐字节等于冻结应用 Commit 的 public/_headers。
- 未重新压缩、生成或替换 ZIP；解压目录上传前和收尾时再次摘要核对均未变化。

| 文件 | 字节数 | ZIP 解压文件实际 SHA-256 | 对治理清单 | 线上核验 |
|---|---:|---|---|---|
| `_headers` | 459 | `dc2326989f4e958341cfffc316f0f38f07e2b23c37a38992ae7dc4f313a8259f` | PASS | 配置文件：公开字节摘要不适用；实际响应头 PASS |
| `assets/main-CHwLQiEH.js` | 26335 | `a484415ad1fb8dffe68ade475c1dd932f6ac361bdf62aa2f74059d0fbf54d49e` | PASS | PASS（HTTP 200，SHA-256 相同） |
| `assets/migration-kjdj7X33.js` | 1019 | `ad7711baf98398a41876e9ac40dda706770ae7e98570e2c1395e74c37aabdc23` | PASS | PASS（HTTP 200，SHA-256 相同） |
| `assets/style-BGrn-dwi.css` | 10284 | `447de589b096e724903a9e2a13aa78f07a1bd7e280de49f080a50e2408dcaeba` | PASS | PASS（HTTP 200，SHA-256 相同） |
| `assets/style-Bp_TMkjA.js` | 473373 | `475d7afdff4a66b36d7da06c6552afc4a0d734710c50b26526f4d3b741d6b8b2` | PASS | PASS（HTTP 200，SHA-256 相同） |
| `assets/workbox-window.prod.es5-BBnX5xw4.js` | 5748 | `cadd21be4a88598a4dec91a26a025df0a5790ff6baec54a884e401c3f5c95557` | PASS | PASS（HTTP 200，SHA-256 相同） |
| `icon-192.png` | 1097 | `5de02cf3c52a5e00883c3b391b7c6760886fbdf99a1af8970409dd3c18624692` | PASS | PASS（HTTP 200，SHA-256 相同） |
| `icon-512.png` | 3776 | `7fd4acae02111223b969363b17b9c57bbb6a8acc1370e68cbba07a7176a86351` | PASS | PASS（HTTP 200，SHA-256 相同） |
| `index.html` | 666 | `f03d96fe6a84524394d1395da2439cabe12208d3f42bd78b86eb1e836c6cfe56` | PASS | PASS（HTTP 200，SHA-256 相同） |
| `manifest.webmanifest` | 333 | `f8a35bdac22aa8b9be559a1c0276741334a1fe1370cf064bdab03fa00c88ba58` | PASS | PASS（HTTP 200，SHA-256 相同） |
| `migration.html` | 560 | `4d99f3d48cea2a98fbd726d0825d316332b12c70dbd5b392809364abf982686b` | PASS | PASS（HTTP 200，SHA-256 相同） |
| `sw.js` | 1650 | `703df3599d43f563b05b795a0ac05074e0de429b0c2f95a589b350d6e4ce17e6` | PASS | PASS（HTTP 200，SHA-256 相同） |
| `workbox-2fbc6a65.js` | 15026 | `39c2e6ae44c3f29666f6a328b6523bf13a053a1d95c74af8ddea82b1045b0b6e` | PASS | PASS（HTTP 200，SHA-256 相同） |

### 13 个构建文件与 12 个公开资源的区别

Wrangler 实际输出为 Uploaded 12 files，随后单独 Uploading _headers。Cloudflare Pages 将 `_headers` 消费为部署配置，不将其作为静态文件公开。

实际访问 `/_headers` 返回 HTTP 200，内容为 SPA index.html 回退（666 bytes，SHA-256=`f03d96fe6a84524394d1395da2439cabe12208d3f42bd78b86eb1e836c6cfe56`），没有返回配置原文。因此不能声称“线上 13 个文件都通过公开 HTTP SHA-256”。准确结果是：**13/13 上传输入摘要通过；12/12 公开资源线上摘要通过；第 13 项配置通过本地字节和线上实际响应头验证。** 此行为与治理档案 docs/v1-nonproduction-handoff.md:68 所述“线上12个公开静态文件”一致，不是静态应用内容漂移；本轮没有为了公开该配置而修改应用或制品。

## 4. 项目创建、Wrangler 与生产隔离

项目创建使用 Cloudflare 官方 API：

```text
POST /client/v4/accounts/{confirmed_account_id}/pages/projects
{"name":"001beta","production_branch":"production-disabled"}
```

返回 HTTP 200/success=true。随后 GET 同一 Account 下的项目，确认 name=001beta、production_branch=production-disabled、source=null；canonical_deployment 和 latest_deployment 均为 null，创建本身没有引发部署。source=null，未连接 GitHub 自动部署。

临时 npx 使用 Wrangler **4.156.0**，实际 help 已确认 deploy 参数。没有修改项目依赖。实际部署参数：

```sh
WRANGLER_SEND_METRICS=false npx --yes wrangler@4.156.0 pages deploy "$TASK_DEPLOY_DIR/dist" \
  --project-name 001beta --branch rc-df48c9d \
  --commit-hash df48c9d2eae22f3fc97487db80ab61b59813adc9 --commit-dirty=false \
  --commit-message 'Mindflow V1 frozen RC; NON-PRODUCTION ONLY'
```

另设置 WRANGLER_WRITE_LOGS=false、WRANGLER_LOG_SANITIZE=true，配置/缓存路径限定 work/；TASK_DEPLOY_DIR 对应上述独立 deployment 目录。

Wrangler 退出码 **0**，上传12个公开资源及_headers，实际返回固定 URL 与分支别名。随后通过 API 列表及部署详情确认固定 URL 对应本 Deployment ID，environment=preview、branch/commit/commit_dirty 与授权一致。

部署后重新查询项目：production branch 仍 production-disabled，source=null，canonical_deployment=null；项目中仅 1 个部署，属于 preview，生产部署数量为 0。rc-df48c9d 与 production-disabled 不同。未修改任何生产项目或生产分支配置，没有生产发布。

## 5. 固定 HTTPS、资源与响应头

固定 URL 来自 Wrangler 实际结果，并由 Cloudflare Deployment API 返回值核对。最终首页 HTTP 200，12 个公开资源均 HTTP 200、SHA-256 与原 ZIP 完全一致；index.html 和 migration.html 分别规范化到同 HTTPS 主机的 / 和 /migration。重定向检查限定同主机 HTTPS，未出现 HTTPS 降级。

通过继承的可信环境 HTTPS 代理访问，Python 默认 CA/主机名校验保持开启，未使用忽略证书错误选项。观测 TLS 为 `TLSv1.3` / `TLS_AES_256_GCM_SHA384`，证书主体为部署域名，观测链由环境代理 CA 签发。这证明本环境经可信代理的 HTTPS 可访问，**不等于独立取得并验证 Cloudflare 公网原始证书链**。

实际首页响应头：

| 响应头 | 实测值 |
|---|---|
| `content-security-policy` | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` |
| `x-content-type-options` | `nosniff` |
| `referrer-policy` | `no-referrer` |
| `permissions-policy` | `camera=(), microphone=(), geolocation=()` |
| `cache-control` | `public, max-age=0, must-revalidate` |
| `content-type` | `text/html; charset=utf-8` |
| `strict-transport-security` | 未返回 |
| `server` | `envoy` |

冻结要求的 CSP、Referrer-Policy、X-Content-Type-Options 和 Permissions-Policy 均精确匹配。SW 实测 Cache-Control=no-cache。首页 / 为 public,max-age=0,must-revalidate；未把它写成字面上的 no-cache。Strict-Transport-Security 本次未观测到（冻结 _headers 也没有规定该头），未擅自补加。

初始通用 Python-urllib 客户端曾出现一次503，随后首页/JS返回403、error code 1010。使用明确标识为 MindflowV1-PreviewVerification/1.0 的核验客户端后，首页及全部公开资源正常返回200；未修改 Cloudflare 防护设置、认证、代理、路由或安全头。未把错误页面的摘要误判为应用文件差异。

## 6. Manifest、图标、Service Worker 与核心交互

- Manifest：HTTP 200，摘要相同；name=Mindflow 知识卡片，start_url=/，scope=/，display=standalone，lang=zh-CN。
- 图标：两个 PNG 均 HTTP 200、摘要相同，实际 PNG 尺寸为192×192及512×512。
- sw.js 和 workbox 脚本：HTTP 200、摘要相同，SW no-cache 头通过。
- **SW 注册、实际控制页面、缓存使用和离线重载：NOT VERIFIED。** 不能从脚本可下载推断浏览器执行成功。
- **线上合成 JSON 导入、30秒摘要、知识树、FAQ、搜索、收藏、随机切卡、刷新和本地持久化：NOT VERIFIED。** 未向线上上传真实或合成卡片；浏览器未成功打开应用，未导入数据。

实际 Chromium/Playwright 尝试：系统 Chromium 154.0.8037.57，Playwright 1.64.1，ignoreHTTPSErrors=false，经同一环境代理访问固定 URL，在页面内容执行前报 `page.goto: net::ERR_CERT_AUTHORITY_INVALID at https://36e604de.001beta.pages.dev/`。未使用 ignoreHTTPSErrors、ignore-certificate-errors 或证书校验跳过参数。

随后仅在 work/ 下隔离的测试浏览器 profile 检查了 Certificate Manager，尝试导入已经存在于系统信任库的公开环境代理 CA；自动化未收到该 WebUI 原生文件选择事件，10秒超时，导入未完成。未将证书导入系统或既有 HOME 信任库，没有更改已发布环境配置，也没有通过降低 TLS 校验继续测试。该诊断是本环境 Chromium 的 CA 信任阻断，不能据此断言 Cloudflare 公网证书无效或应用功能失败。

## 7. 剩余问题及下一阶段建议

1. 在支持的隔离浏览器测试配置中正确提供现有环境代理 CA 信任，保持 TLS/主机名校验开启，然后在同一个固定 Deployment URL 完成 Chromium 核心功能、SW 注册、控制、缓存及离线重载。无需重新构建或重新部署。
2. 也可由负责人/B 在具有正常受信 HTTPS 链的独立浏览器访问固定 URL 进行下一阶段验证；本轮未代替 B 或 Work 完成独立验收。
3. 一些通用自动化客户端可能遇到 Cloudflare 1010；已记录明确标识核验客户端成功的事实，不泛化为所有客户端已可访问。
4. 公开 HTTP 无法取回 `_headers` 配置原文，不能提供第13项的公网文件摘要；采用上述13项本地输入+12项公开摘要+真实安全头的证据边界，待负责人/B复核。
5. 真实 Safari/iPhone、VoiceOver、主屏安装、离线冷启动、系统强杀/存储回收、跨版本 Service Worker 更新仍 NOT VERIFIED。Chromium 移动视口或任何模拟均不能代替真机。
6. QA-004 当前字号持久化维持负责人决定 PASS/CLOSED；历史唯一 RCA 仍 NOT CONFIRMED。条件性迁移 P1 OPEN；QA-008 PARTIAL；历史证据不足风险仅在非生产试运行范围接受。

| Readiness | 当前结果 |
|---|---|
| Non-production Preview Readiness | DEPLOYED / PARTIAL；版本、制品、隔离及公开资源/安全头通过，浏览器基础冒烟待补齐 |
| Work Remote UX Readiness | NOT READY / 独立验收未完成；本轮不宣称通过，不建议跳过 Chromium 基础冒烟门槛 |
| iPhone Device Readiness | NOT VERIFIED |
| Production Release Readiness | NO-GO / NOT APPROVED |

## 8. GitHub 正式归档及证据索引

归档整理时间：2026-10-31T13:50:35+08:00。目标仓库 easonwycgz/mindflow，治理分支 docs/v1-rc-df48c9d-governance，归档基线 Commit 为 8a46eaef581b0d2b496947079498395170f5d0ef。

本次只归档治理文档和必要脱敏文本证据，没有重新部署、重新构建、修改应用或运行新的线上测试。构建/部署时间与本次归档时间分别记录，不能将归档当作新一轮验收。

- [部署证据 JSON](evidence/v1-cloudflare-preview/deployment-evidence.json)：保存已有 authorization、ZIP与13项摘要、项目创建/复查/隔离、部署API、12项线上资源/TLS/响应头、Manifest/图标、访问诊断及Chromium错误记录。各节保留原观测值，不将摘要或状态重新推断为已完成浏览器交互。
- [Wrangler 实际输出](evidence/v1-cloudflare-preview/wrangler-deploy.txt)：保留原部署输出及实际返回的URL，移除ANSI颜色控制字符；不包含凭据。
- [正式构建证明](evidence/v1-rc/build-provenance.json)及[正式dist摘要清单](evidence/v1-rc/dist-sha256.txt)：此前治理归档原件，未修改。

JSON原始观测中的 /workspace 路径仅标识部署执行时的位置，B无需依赖旧Task文件系统；此处链接的已提交文本足以读取本轮所归档证据。未归档 ZIP、dist、node_modules、浏览器profile、证书数据库、用户数据、环境dump或秘密。

### 历史核查概要

此前环境核查中，Token Verify active，Account Details/API Token权限明细不可读，项目尚不存在。负责人随后明确确认真实Account ID及Account Cloudflare Pages Edit资源范围，并授权创建独立非生产项目。此后创建和Preview部署实际成功，因此早先授权/部署BLOCKED不再是当前状态；Chromium环境代理CA问题仍未解决，Online Smoke Test仍为PARTIAL。完整早期工作区日志保留在本地工作报告，不改写任何已存在的QA历史档案。

归档不改变发布门槛：等待负责人及B完成后续独立验收；Work Remote UX NOT READY，iPhone NOT VERIFIED，Production NO-GO / NOT APPROVED。冻结应用Commit及原ZIP不发生变化。
