# UX1 历史断言与候选回归映射

任务日期：2026-10-31（Asia/Shanghai）。基线 df48c9d2eae22f3fc97487db80ab61b59813adc9。

负责人批准开发者维护的 UI 断言进行有记录的等价更新；禁止修改独立 B 原件。原始内容仍可通过冻结 SHA 检查。没有删除测试、降低安全断言或为新 UI 静默 skip。

| 原文件/断言 | 改变原因 | 新断言及等价保护 |
| --- | --- | --- |
| e2e/app.spec.ts：通过可见“展开完整标题的子节点”点击 | UX-04 可见文案简化为“子节点 N”，完整辅助技术名称保留在 aria-label | 改用 getByLabel 匹配同一个完整名称；仍实际展开并阅读子节点，保留收藏、刷新、搜索及去重断言 |
| e2e/round2.spec.ts：16 层逐层展开的可见全文 | 同上 | 改用相同完整 aria-label；16 层内容、聚焦、刷新祖先展开及返回仍保留 |
| e2e/app.spec.ts：安全 summary 默认可见 | UX-01 初始短层不铺开完整摘要 | 明确展开“完整摘要”后断言完整恶意原文可见，仍验证不执行脚本、不请求远程图片 |
| e2e/round2.spec.ts：Markdown summary 默认可见 | 同上 | 展开后继续断言标题、列表、粗体、公式原文及实际严格 CSP；没有删掉原保护 |
| e2e/independent-qa.spec.ts：synthetic markdown/math stays inert... | B 原件要求完整 summary 默认可见，与负责人批准的新初始呈现冲突 | **原件完全不改，原失败保留。** e2e/ux1.spec.ts 的 CSP 用例对新核心、提醒、来源和展开后的完整摘要检查原文安全与零外站请求；不能把新用例 PASS 记成 B 原件 PASS |
| B-R2 导入“校验失败”及 status | 新错误需要 alert 语义，仍保留状态上下文 | 外层 status 不重复播报错误，内层 alert 明确说明失败；中文保留“校验失败”，技术信息折叠；旧 B 断言不修改 |
| 字号、Home/End/方向键、节点返回焦点、事务及迁移保护 | 必须保留 | 原独立测试字节不变；新测试另覆盖临时游标、abort、延迟读取、写锁、宽树及跨卡相同节点 ID |

`tests/ux1-compat.test.ts` 自动核对冻结合同、standalone validator、CSP、全部独立测试及历史 docs 文件的原始字节，并执行冻结实现 ↔ 候选实现的真实备份互读。CI checkout 获取完整历史，仅为取得冻结对象，不执行部署。

`npm run test:e2e` 保留完整运行，包括上述 B 原件冲突，因此存在该冲突时必须如实报告红灯；新增项目没有排除原有 Desktop/Pixel 7 配置。既有桌面触摸用例会按其原件声明 skip；该 skip 与本轮断言迁移无关。
