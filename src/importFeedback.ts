import { InputIssue } from "./model";
import { LibraryCapacityError } from "./libraryCapacity";
export interface ImportFeedback {
  kind: "error" | "success" | "duplicate";
  title: string;
  guidance: string;
  detail?: string;
}
export function explainImport(error: unknown): ImportFeedback {
  if (error instanceof LibraryCapacityError)
    return {
      kind: "error",
      title:
        error.code === "library-count"
          ? `知识库最多 ${error.limit} 张卡片`
          : `知识库超过 ${error.limit / 1024 / 1024} MiB 可恢复容量预算`,
      guidance:
        "本次未导入，原有数据未更改。请先导出备份，暂缓新增导入；当前版本没有单卡删除入口，请保留原库并联系维护者协助整理。",
      detail: error.message,
    };
  if (!(error instanceof InputIssue))
    return {
      kind: "error",
      title: "导入未完成：本机读取或数据库事务失败",
      guidance:
        "原有卡片和阅读进度保留。请检查浏览器存储权限和可用空间后重试；不要清除唯一原库。",
    };
  const descriptions: Record<InputIssue["code"], [string, string]> = {
    syntax: ["JSON 格式错误", "请复制完整 JSON，检查括号、引号和逗号后重试。"],
    protocol: [
      "知识卡片校验失败：缺少字段、字段类型或结构不符合 V1 格式",
      "请用正式 V1 示例核对完整卡片，包括来源对象及其两个子字段。",
    ],
    version: [
      "知识卡片校验失败：Schema 版本不受支持",
      "请使用 schema_version 为 1.0 的完整 V1 知识卡片。",
    ],
    uri: [
      "知识卡片校验失败：来源链接格式无效",
      "请提供合法 URI；未提供链接时使用 null，不要删除必需字段。",
    ],
    tree: [
      "知识卡片校验失败：JSON 层级、节点数量或知识树深度超限",
      "请缩减过深或过大的结构；知识树最多 16 层，每张卡片最多 50000 个 JSON 值。",
    ],
    "duplicate-node": [
      "知识卡片校验失败：节点 ID 重复",
      "请在生成卡片时为同一卡中的每个节点提供不同 ID，然后重新导入。",
    ],
    capacity: ["文件容量超限", "单张卡片最多 2 MB；请缩减文件后重试。"],
    "duplicate-card": [
      "该内容已存在；原卡片与阅读状态保持不变",
      "可以继续阅读原卡片，无需重复导入。",
    ],
  };
  const [title, guidance] = descriptions[error.code];
  return {
    kind: error.code === "duplicate-card" ? "duplicate" : "error",
    title,
    guidance:
      error.code === "duplicate-card"
        ? guidance
        : `${guidance} 本次未导入，原卡片和阅读进度保留。`,
    detail: error.message,
  };
}
