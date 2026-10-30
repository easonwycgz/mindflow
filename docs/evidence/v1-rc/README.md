# 冻结发布候选准备证据

应用源df48c9d2eae22f3fc97487db80ab61b59813adc9；治理文件不改变应用候选。

- build-provenance.json：冻结Git tree、独立archive/clean npm ci构建、本轮10数据/12浏览器实际结果、13个dist文件及ZIP摘要、部署状态（false/URL null）。不是已部署证明。
- build-browser-audit.txt：实际执行会话捕获的构建、12浏览器（25.3秒）及audit输出尾段；此前npm ci/typecheck/lint/10核心数据的实际结果汇总在provenance，不把尾段称为完整安装日志。
- dist-sha256.txt：zip内对应根路径的每个产物SHA256；_headers用于平台配置，不作为可公开下载文件验证。
- local-smoke.json：12个资源字节/本地严格头、manifest/图标和2视口合成UI/持久化/SW/控制台验证；明确LOCAL_HTTP_ONLY、httpsVerified=false，不是Cloudflare或iPhone测试。
- frozen-ci.json：本轮重新读取固定应用候选PR/push公开job步骤，均15项成功且完整SHA绑定；没有读取内部工件。
- governance-check.json：应用/旧跟踪文件无diff、两公开fixture摘要、负责人决策与当前Cloudflare阻碍元数据；不含任何凭据。

本轮没有修改或重跑B的全部独立套件，历史独立结果在v1-release-summary和qa-matrix中按固定QA提交引用。无真实私人卡片、聊天、备份、环境dump或私有trace，ZIP放在仓库外/workspace/artifacts，不提交构建产物。
