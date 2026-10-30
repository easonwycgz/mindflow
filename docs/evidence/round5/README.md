# 第五轮公开合成证据

开发者执行，不是B独立验收。只含公开示例/合成数据、命令输出、度量及源码指纹，不含真实知识库、认证值、环境dump或私有trace。

- local-validation.txt：最终同一应用/测试字节的干净安装→types→lint→65数据→build→75浏览器通过/1历史skip→audit0。包含实际命令和退出码。
- source-sha256.txt：50条应用/测试/配置指纹；source-verification.txt是校验结果。可用`sha256sum -c docs/evidence/round5/source-sha256.txt`重验。
- stress-metrics.json：从最终原始stdout抽取的B数量/容量、旧组合压力及新无暂存下载度量。JS堆只是阶段采样，不是进程/原生峰值。
- baseline-integrity.txt：修改前B原始数据故障实际失败；筛选测试产生的filtered skip不是最终套件skip。
- browser-first.txt：第一版跨库持锁方法的真实原生失败（8失败/10通过），含新测试50MB buffer限制；该版本不是最终候选。
- browser-second.txt：修正产品生命周期后仅新测试临时文件名不符导致2失败/10通过；改为保留建议文件名的实际落盘路径，未改大小或数据一致性断言。最终全套结果独立记录。

B第四轮测试文件与3752a12896f903e5636b474b218c9c288f65a70b原文一致。正式协议、旧测试、依赖和工作流不改；历史RCA仍NOT CONFIRMED、QA-004 OPEN；新P1与极端环境风险由B/负责人判定。
