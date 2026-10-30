# R5-001定向开发者证据

- baseline.txt：应用基线f22d68c，两项B原文案断言实际FAIL，未修改B期望。
- validation.txt：本轮最终定向typecheck/lint/build、28数据PASS、26浏览器PASS（含原两项失败及新增14项）、0 FAIL/SKIP、生产audit0。不是重用B以前的执行数字。
- source-sha256.txt：53条最终应用/测试/配置字节；`sha256sum -c docs/evidence/round5-p2/source-sha256.txt`可复核。

真实acceptDownloads=false失败和可观察DOMException故障注入分别标明；网页无回执仍显示未知，用户报告有明确来源。全部只用公开示例/合成数据，不含私人知识库、下载备份、凭证、环境dump或私有trace。B的原第五轮报告保留在b250a868757cecd9945b436a0011fef98f189ad6，不覆盖。
