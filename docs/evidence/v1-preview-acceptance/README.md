# B 独立线上验收证据

固定对象：https://36e604de.001beta.pages.dev；冻结应用 df48c9d2eae22f3fc97487db80ab61b59813adc9；治理档案 31cb07ee4ffe5c373cf797d6d28ce9fe5d7f288f。

本目录全部为 B 本轮取得的记录或合成验收工具。A 历史元数据通过 source-files.json 中的固定 Commit 链接引用，未冒充 B 独立控制面检查。

| 文件 | 用途 |
|---|---|
| source-files.json | 九份正式来源、固定 Commit 和 Git blob SHA |
| browser-trust.json / browser-trust-attempt-*.png | 两次隔离 context 的正常可信 HTTPS 导航、请求、证书校验设置 |
| http-observations.json | 12 公开资源及首页的本轮 HTTP 状态、实际头、摘要和重定向 |
| provenance-and-headers.json | 原 ZIP、13 文件、冻结源码树和 _headers、正式清单核对；实际头对照 |
| functional-results.json | 最终 20 桌面／离线用例、保存状态、SW 控制／缓存、网络请求 |
| mobile-results.json | 7 个 390×844 Chromium 模拟用例、触摸／长文／滚动结果和网络请求 |
| harness-first-run.json | 第一轮 20 次执行原始记录，4 次工具选择器／CSP 等待方式无效，不能当产品 FAIL |
| followup-observations.json | 浏览器 Manifest 解析、浏览器首页安全头、原始 index 308 与 _headers 回退、P3 重复日志 |
| download-record.json / 16-browser-download-record.png | 新合成 profile 的 Chromium 下载管理器记录、完成回执和实际文件摘要 |
| download-observation.txt | 一次未重复的补充下载取证上下文关闭，原因 NOT VERIFIED |
| 01–15*.png | 桌面、摘要／树／FAQ、持久化、离线刷新、离线浏览器重启、移动及长文证据 |
| issue-001-invalid-object-*.png | 输入 {} 的两次 P3 错误文案截图 |
| scripts/ | 本轮实际使用的验收脚本；不是应用代码或构建输入 |
| long-synthetic-card.json | 官方公开 B 派生的三级／80 段公开合成测试卡 |
| evidence-sha256.txt | 本目录附件完整性，不包含该清单自身 |

脚本按本次 `/workspace/work/preview-review` scratch 布局记录，复现时先准备固定 Commit 的公开样例／证明与原 ZIP，并使用全新 profile。HTTP、浏览器测试需要环境合法允许固定域并提供既有代理；始终保留证书校验。不要在私人 profile 执行恢复。无需重新构建或部署。

无真实私人卡片、备份、浏览器 profile、证书数据库、凭据、环境 dump 或产物 ZIP 进入本目录。保存的下载文件本身未提交，只保留合成摘要和回执。Cloudflare NEL/Report-To 是公开响应头，详情及证据覆盖边界见主报告。
