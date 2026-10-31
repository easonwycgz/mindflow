import type { Branch, Card } from "../../src/model";
// Entirely fictional, deterministic fixtures. No user corpus content is imported here.
export function syntheticCard(patch: Partial<Card> = {}): Card {
  return {
    schema_version: "1.0",
    title: "虚构学习卡 Alpha",
    hook: "如何理解一个虚构系统？",
    summary: "虚构长摘要。".repeat(45),
    topic_type: "exploratory",
    tags: ["合成", "虚构"],
    key_takeaways: [
      "在虚构条件成立时，结果才可能是 42；不满足条件不能直接应用。",
      "第二条只解释合成机制，不提供现实行动建议。",
      "第三条保留数字 3.14 与单位 kg。",
    ],
    branches: tree(2, 2),
    faq: [
      {
        question: "这是真实建议吗？",
        answer: "不是。这只是完全虚构的测试文本。",
        basis: "needs_verification",
      },
    ],
    caveats: [
      "仅供虚构测试，不代表实际建议。",
      "历史日期 2000-01-01 只是原文，不据此判断当前状态。",
    ],
    source: { chat_title: null, chat_url: null },
    ...patch,
  };
}
export function tree(depth = 2, width = 1): Branch[] {
  const make = (level: number, id: string): Branch => ({
    id,
    title: level === 1 ? "合成父节点" : `合成节点 ${level}`,
    summary: `第 ${level} 层完整摘要：仅用于虚构测试。`,
    content:
      width > 100
        ? "虚构正文。"
        : `第 ${level} 层正文。\n\n${"虚构说明。".repeat(50)}`,
    children:
      level < depth
        ? Array.from({ length: level === 1 ? width : 1 }, (_, i) =>
            make(level + 1, `${id}-${i + 1}`),
          )
        : [],
  });
  return [make(1, "root")];
}
export const legalCases: Record<string, Card> = {
  one: syntheticCard({ key_takeaways: ["唯一收获，不补造其他要点。"] }),
  two: syntheticCard({ key_takeaways: ["第一条。", "第二条。"] }),
  twelve: syntheticCard({
    key_takeaways: Array.from(
      { length: 12 },
      (_, i) => `虚构要点 ${i + 1}，仅在条件成立时适用。`,
    ),
  }),
  long: syntheticCard({
    key_takeaways: [
      "长".repeat(470) + "；不满足 42 个条件时不能采用此结论。",
      "辅助一。",
      "辅助二。",
    ],
  }),
  unicode: syntheticCard({
    summary: "## Fiction 虚构\n- **边界**\n- 🧪 é 42 kg",
    key_takeaways: ["🧪 Unicode 中文 English：不是无条件结论。"],
  }),
  noCaveats: syntheticCard({ caveats: [] }),
  oneCaveat: syntheticCard({ caveats: ["普通边界说明。"] }),
  longCaveat: syntheticCard({ caveats: ["界".repeat(1000)] }),
  titleSource: syntheticCard({
    source: { chat_title: "虚构会话", chat_url: null },
  }),
  urlSource: syntheticCard({
    source: { chat_title: null, chat_url: "https://example.invalid/private" },
  }),
  bothSource: syntheticCard({
    source: {
      chat_title: "虚构会话",
      chat_url: "https://example.invalid/private",
    },
  }),
  shallow: syntheticCard({ branches: tree(1) }),
  medium: syntheticCard({ branches: tree(5) }),
  deep: syntheticCard({ branches: tree(16) }),
  wide: syntheticCard({ branches: tree(2, 4500) }),
};
export function invalidCases(): {
  name: string;
  value: unknown;
  code: string;
}[] {
  const duplicate = syntheticCard();
  duplicate.branches[0].children[0].id = "root";
  const missing = { ...syntheticCard() } as Partial<Card>;
  delete missing.title;
  return [
    { name: "missing title", value: missing, code: "protocol" },
    {
      name: "extra field",
      value: { ...syntheticCard(), extra: true },
      code: "protocol",
    },
    {
      name: "wrong type",
      value: { ...syntheticCard(), title: 42 },
      code: "protocol",
    },
    {
      name: "wrong version",
      value: { ...syntheticCard(), schema_version: "2.0" },
      code: "version",
    },
    {
      name: "URI",
      value: {
        ...syntheticCard(),
        source: { chat_title: null, chat_url: "bad uri" },
      },
      code: "uri",
    },
    {
      name: "null source",
      value: { ...syntheticCard(), source: null },
      code: "protocol",
    },
    {
      name: "missing source child",
      value: { ...syntheticCard(), source: { chat_title: null } },
      code: "protocol",
    },
    {
      name: "depth 17",
      value: syntheticCard({ branches: tree(17) }),
      code: "tree",
    },
    { name: "duplicate node", value: duplicate, code: "duplicate-node" },
  ];
}
