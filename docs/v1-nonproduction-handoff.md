# Mindflow V1 非生产试运行准备交接报告

日期2026-10-30（Asia/Shanghai）；A负责工程归档，不代替B简短复核，不宣布生产Go。

## A–D：冻结、治理决策与剩余风险

- **A 冻结应用**：df48c9d2eae22f3fc97487db80ab61b59813adc9；Git tree a75bfbecb277fb4071d4880e8cad756c01ac5085。PR #1仍Draft、head匹配、未合并；原功能分支不新增提交。
- **B 治理档案**：[独立治理分支](https://github.com/easonwycgz/mindflow/tree/docs/v1-rc-df48c9d-governance/docs)。[发布摘要](v1-release-summary.md)、[QA矩阵](v1-qa-matrix.md)、[风险登记](v1-risk-register.md)、[发布决策](v1-release-decisions.md)、[平台计划](v1-platform-test-plan.md)。最终归档commit由交接消息给出，可用固定commit链接审阅。
- **C QA-004正式决定**：负责人2026-10-30 DEC-002，当前字号缺陷基于B第三轮及后续回归PASS/CLOSED；历史唯一RCA仍NOT CONFIRMED，其证据不足风险仅为非生产试运行被明确接受。原门槛、原话、批准角色、技术证据、范围与排除项见决策记录。历史报告不改写。
- **D 剩余条件性P1**：下载被禁/OS受限/物理空间不足等环境仍OPEN。允许下载的无Directory/workspace新增不足场景已独立PASS，不能扩大为所有环境可迁出。失败不得删除唯一原库，不得用部分请求假报完整备份。

R4-001 PASS/CLOSED；R5-001 PASS、B建议关闭；QA-003 PASS；QA-008 PARTIAL。没有把风险接受写成技术根因确认或生产批准。

## E–F：Cloudflare Preview与构建证明

**E Preview URL：无。Cloudflare尚未部署，状态BLOCKED。** 用户指定目标项目001beta；账号由CLOUDFLARE_ACCOUNT_ID安全配置确认。没有deployment ID、实际deployed commit或可声称已上线的地址，不猜测`001beta.pages.dev`或分支别名已对应本候选。

**F 已完成的冻结构建**：

1. `git archive df48c9d2eae22f3fc97487db80ab61b59813adc9`导出至独立临时副本，不创建工作树、不从治理head构建。
2. npm ci、typecheck、lint、核心10数据、build、核心12浏览器、生产audit均通过；生成前后95个原跟踪文件逐个与冻结Git对象比较一致。
3. 仅dist制成`mindflow-v1-rc-df48c9d.zip`：13文件，172,354字节；SHA-256：`e0d83d8e73c2b0510ed4ca9199dc3d6c0d2d4a798520b3803a871c2a5b44d348`。包内直接是index.html/assets/_headers等，无父目录包装。
4. [构建证明与逐文件摘要](evidence/v1-rc/build-provenance.json)、[dist-sha256](evidence/v1-rc/dist-sha256.txt)、[实际构建/浏览器/审计输出](evidence/v1-rc/build-browser-audit.txt)。当前机器包在/workspace/artifacts，ZIP未提交到Git，防止把构建产物当治理源码。
5. 包检查仅dist、_headers与冻结public一致、无unsafe-eval、未包含环境文件/浏览器数据库/下载备份/治理文档/测试。构建输入全来自公开Git对象，唯一预置卡为公开合成contract示例；无真实用户知识输入。没有把标记扫描夸大成通用无秘密证明。

**实际部署commit：无**；“构建源commit”是冻结SHA，不能用它冒充已部署证明。

### 明确阻碍及最小授权

已检查：无Cloudflare工具连接；无CLOUDFLARE_API_TOKEN/API_KEY/EMAIL/ACCOUNT_ID配置；无Wrangler OAuth配置文件；运行网络为restricted，原允许域不含Cloudflare。没有绕过代理、TLS或借用GitHub权限去猜测Cloudflare账户。

通过Cloud Environment Onboarding已保存**可审阅草稿**，status=saved、requires_publish=true；不是已应用/已生效：

- 仅增加api.cloudflare.com、001beta.pages.dev、*.001beta.pages.dev；既有package presets保留。
- 个人密钥需求CLOUDFLARE_API_TOKEN，代理目标仅api.cloudflare.com；账号ID及项目名为非密钥变量，项目建议值001beta。
- 原安装脚本、仓库成员和其他设置保留。

需要用户完成的具体操作：

1. 在Cloudflare创建/选择**仅目标账号 Cloudflare Pages:Edit**所需范围的Token，不使用Global API Key、不授予DNS/KV/Workers编辑等无关权限。账号ID单独填写；若实际CLI只读操作要求额外权限，先报告具体缺项，不盲目扩大。
2. 在环境设置中安全填入Token与CLOUDFLARE_ACCOUNT_ID，核对CLOUDFLARE_PAGES_PROJECT=001beta，审阅网络增量，保存并发布环境配置；不要在聊天、仓库、日志或VITE_变量中填Token。
3. 运行环境更新后重新检查observations_current/ready、变量是否可用，再做目标项目只读预检。草稿保存本身不等于运行时已授权。

本路径Direct Upload复用已有Git读权限，不需要新增GitHub PAT或把Cloudflare GitHub App授权到所有仓库。用户也可在自己的已授权终端执行下面同一冻结包步骤；但在本轮尚未执行它们，不能预报成功。

### 待授权后执行的非生产部署步骤

CLI版本固定4.156.0；本轮已实际执行deploy/project create的`--help`确认参数，只验证语法，不代表Cloudflare账号或部署成功。

- 先只读核对账号中的001beta项目。若已有，确认是本次非生产用途、production_branch与`rc-df48c9d`不同；用途不清/涉及现有生产则停止，不改生产配置。
- 仅当项目不存在且账号已明确时新建独立Direct Upload项目，production branch使用不会被部署的`production-disabled`。
- 无需新增Git预览分支；Direct Upload的部署branch元数据从冻结包指明，不修改feat或main。

```sh
# 先完成账号/项目只读预检；只有项目不存在时执行create。
WRANGLER_SEND_METRICS=false npx --yes wrangler@4.156.0 pages project create 001beta --production-branch production-disabled

# 在独立目录解压本轮ZIP，仅将dist根内容交给Pages。
TASK_DEPLOY_DIR=$(mktemp -d)
unzip -q /workspace/artifacts/mindflow-v1-rc-df48c9d.zip -d "$TASK_DEPLOY_DIR/dist"
(cd "$TASK_DEPLOY_DIR/dist" && sha256sum -c /workspace/mindflow/docs/evidence/v1-rc/dist-sha256.txt)
WRANGLER_SEND_METRICS=false npx --yes wrangler@4.156.0 pages deploy "$TASK_DEPLOY_DIR/dist" \
  --project-name 001beta --branch rc-df48c9d \
  --commit-hash df48c9d2eae22f3fc97487db80ab61b59813adc9 --commit-dirty=false \
  --commit-message 'Mindflow V1 frozen RC; NON-PRODUCTION ONLY'
```

部署后必须实际核实API environment=preview、commit/branch、构建/上传成功状态，记录deployment ID及**本次固定deployment URL**；分支alias只作辅助。不能只信自填的commit标签：还要将实际线上12个公开静态文件逐一与dist摘要比较，检查TLS/响应头/SW/图标，并运行平台计划Gate P基本操作。未完成这些，不提高Work/HTTPS状态。不要以Dashboard默认首个生产上传替代Preview，也不把项目主域名当本次固定预览。

如发现必须改源码/头策略才能安全上线，停止并先向负责人/B报告，不能把改过的包继续标为冻结SHA。

## G–I：合成数据、冒烟和限制

**G 合成数据**：[A](synthetic/mindflow-v1-work-example-a.json)、[B](synthetic/mindflow-v1-work-example-b.json)，本轮通过冻结正式Schema及单卡安全校验。无私人来源。Work具体操作路径见[v1-work-handoff.md](v1-work-handoff.md)。

**H 本轮A实际检查**：

| 范围 | 实际结果 | 不能替代 |
| --- | --- | --- |
| npm ci/typecheck/lint/build | PASS，退出0 | 不等于远端Cloudflare构建 |
| 冻结核心数据 | 10 PASS /0 FAIL/SKIP | 不是重用B或此前69项数字 |
| 冻结核心浏览器 | 12 PASS /0 FAIL/SKIP，25.3秒 | Linux Chromium桌面/移动视口，不是Safari/iPhone |
| 额外资源/控制台冒烟 | 12个资源本地HTTP字节与安全头一致；2视口导入、浏览、树、FAQ、搜索、收藏、刷新、SW控制通过；无阻断控制台错误/外站请求 | 不是Cloudflare线上头或有效公网TLS |
| Manifest/icons/SW | 本地可取、manifest/start_url/display/两个PNG尺寸正确、SW控制 | 不是iOS主屏离线冷启动 |
| 生产依赖审计 | 0已知漏洞，退出0 | 不是全供应链/全安全保证 |
| 实际HTTPS Preview冒烟 | **NOT EXECUTED / BLOCKED** | 没有公网URL，不能标PASS |

[本地冒烟原始JSON](evidence/v1-rc/local-smoke.json)明确cloudflareDeployed=false、httpsVerified=false。当前没有新确认的源码修改需求；Cloudflare授权不足是环境阻碍，不伪装成已测试的程序缺陷。

**I 未解决/平台限制**：条件性P1仍OPEN；历史RCA仍NOT CONFIRMED（仅风险被接受）；QA-008 PARTIAL；Safari/WebKit、真实iPhone、VoiceOver、主屏离线冷启动、系统强杀恢复、跨版本SW、Cloudflare HTTPS/线上响应头均NOT VERIFIED。真实目录授权UI、真实磁盘写满也未验。固定部署URL不同origin会隔离本机数据，跨版本升级另需专用同源测试。

## J：是否开始产品验收

| Readiness | 当前建议 |
| --- | --- |
| Non-production Preview Readiness | **构建/风险归档材料READY；实际部署BLOCKED**，先补安全授权与线上Gate P |
| Work UX Readiness | **材料READY，远程体验BLOCKED**；拿到固定HTTPS URL并冒烟通过后可按合成路径开始，不重复请求原则性批准 |
| iPhone Device Readiness | **计划READY，设备/线上结果NOT VERIFIED**；HTTPS就绪后执行真机步骤，不声称已通过 |
| Production Release Readiness | **NO-GO / NOT APPROVED**，不合并main、不关闭PR、不部署生产 |

治理分支推送后交B对归档/试运行准备作简短复核。本轮停止，不擅自扩展功能。Cloudflare授权落实后继续的是已批准部署与验证步骤，不是重新申请原则性同意。
