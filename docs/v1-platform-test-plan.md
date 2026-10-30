# Mindflow V1 平台与HTTPS验收计划

冻结应用df48c9d2eae22f3fc97487db80ab61b59813adc9。本计划不是执行结果；默认下面平台项目均NOT VERIFIED，只有实际执行后可附证据改变对应格。

## 记录格式和测试数据

每次记录：测试人A/B/Work/真机持有人、时间/Asia-Shanghai、完整源SHA/实际deployment ID/固定URL、设备型号、OS/iOS、浏览器/引擎版本、是否主屏PWA、步骤、预期、实际、PASS/FAIL/BLOCKED/NOT EXECUTED、合成截图/日志。敏感浏览器档案、账号凭据、私人卡片禁止上传。

仅用[公开样例A](synthetic/mindflow-v1-work-example-a.json)、[B](synthetic/mindflow-v1-work-example-b.json)及冻结contracts示例。无痕会话只能用于临时浏览，持久化/主屏测试必须另用正常浏览器。破坏性清理限定已确认合成数据的测试origin；不能清理真实旧库。

## Gate P：非生产部署与线上冒烟（A）

1. 先确认Cloudflare项目001beta归属目标账号且为本次非生产用途；只读检查production_branch与本次rc分支不同。已有项目若用途/生产设置不明确，停止，不擅自变更。
2. 校验冻结dist ZIP及逐文件SHA；提交Cloudflare Preview，commit-hash为冻结SHA、dirty=false，不能是治理commit。验证API environment=preview、固定deployment URL及源metadata，保存脱敏结果。
3. 实际HTTPS访问：有效TLS、最终URL仍为正确固定预览，不因重定向落到生产/别名；页面/独立迁移页可用。
4. 对照dist-sha256逐个核对线上HTML、JS/CSS、icons、manifest、SW/workbox字节。_headers为平台配置文件，不把其不可公开下载当资产404。检查真实响应CSP无unsafe-eval/unsafe-inline，nosniff、Referrer/Permissions策略；SW和入口缓存策略需符合冻结配置。
5. 实际导入JSON、摘要/树/FAQ、搜索、收藏、刷新持久化；manifest/start_url/display/图标尺寸，SW注册控制，控制台无阻断错误，HTTP请求无私有卡片上传/外站跟踪。
6. 如失败原因必须修改冻结应用，先报告B/负责人，另起获批候选；不能修代码后仍标df48c9d。

**当前Gate P线上结果：BLOCKED，Cloudflare未部署；仅本地HTTP资源检查及核心12浏览器PASS，不能覆盖这些线上项。**

## Gate W：ChatGPT Work产品体验（Work，B复核）

Gate P通过并提供固定HTTPS URL后才开始远程产品体验。按照Work交接中的10分钟操作路径，用两张公开卡观察导入理解成本、阅读首屏、树/FAQ定位、搜索收藏、大字保存状态、下载未知/取消的可理解性。不登录私人服务、不访问私人聊天、不把受限公式排版算作已承诺完整功能。用独立浏览器页打开；冻结CSP frame-ancestors none，不支持iframe嵌入，不为Work降低CSP。

发现UI痛点先记录，不在冻结试运行中自动改源码。Work结果是产品体验材料，不是Safari、VoiceOver、生产Go或B独立最终结论。

## Gate I：真实iPhone/Safari/VoiceOver（设备持有人，B复核）

| 项目 | 必须实际执行的步骤/断言 | 当前状态 |
| --- | --- | --- |
| Safari首次使用 | 真实iPhone打开固定HTTPS URL；文件/系统粘贴导入两卡；树/FAQ/搜索/收藏/字号large | NOT VERIFIED |
| 本机持久化 | 等Saved再刷新/关闭重开；另测试Saving时立即刷新及失败重试；确认未假报Saved | NOT VERIFIED |
| 主屏PWA | Safari分享→添加主屏；安全区/大字/横竖屏/44px操作及阅读位置 | NOT VERIFIED |
| 离线冷启动 | 首次联网安装/SW就绪后断网；完全关闭主屏PWA再离线从主屏启动，阅读/搜索已导入卡 | NOT VERIFIED |
| 强杀/生命周期 | 仅合成origin，Saving/导入/恢复阶段分别强制终止；重新打开验证原库或完整新库，没有部分恢复 | NOT VERIFIED |
| VoiceOver | 树16层导航、节点正文返回真实焦点/祖先；按钮/Tab替代、状态播报、FAQ和导入错误；不以滚动截图代替可访问性 | NOT VERIFIED |
| Files下载/取消 | 实际保存明文备份、文件可重新选择；浏览器/OS取消、未确认保存、限空间反馈不作文件存在承诺 | NOT VERIFIED |
| WebKit基础 | 可用时另外跑自动化WebKit，结果单列，不替代真机 | NOT VERIFIED |
| 存储不足/驱逐 | 使用隔离合成库、可恢复副本与安全空间，记录实际OS行为；不能把异常注入冒充真磁盘满 | NOT VERIFIED |

## Gate U：跨版本SW更新（需未来获批版本）

哈希固定预览URL的origin各不相同；在新URL打开不能证明旧origin上的SW/IndexedDB更新。未来需一个**专用稳定非生产origin**上先后部署两个获批版本，记录更新提示、用户明确更新前后本机数据/阅读状态、缓存资源与离线重开。当前只冻结一个版本，本轮不为测更新擅自制作新源码或混用动态别名证明固定版本。状态NOT VERIFIED。

## Gate R：生产决定

负责人和B另行评审：平台门槛、条件性P1目标支持范围、实际安全/数据失败、Work体验、版本/部署证据和剩余风险。DEC-002不再要求把历史RCA改CONFIRMED才能非生产试运行，但不能替代这些门槛。当前Production Release NO-GO，不合并main，不部署生产。
