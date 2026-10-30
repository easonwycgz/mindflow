import validate from "./generated/card-validator.js";
import { z } from "zod";

export interface Branch {
  id: string;
  title: string;
  summary: string;
  content: string;
  children: Branch[];
}
export interface Card {
  schema_version: "1.0";
  title: string;
  hook: string;
  summary: string;
  topic_type: string;
  tags: string[];
  key_takeaways: string[];
  branches: Branch[];
  faq: {
    question: string;
    answer: string;
    basis: "conversation" | "supplement" | "needs_verification";
  }[];
  caveats: string[];
  source: { chat_title: string | null; chat_url: string | null };
}
export const MAX_BYTES = 2 * 1024 * 1024,
  MAX_DEPTH = 16;
export const MAX_CARD_VALUES = 50000;
export const MAX_LIBRARY_CARDS = 500,
  MAX_BACKUP_BYTES = 40 * 1024 * 1024;
// Backup budget is the sum of per-card limits plus bounded metadata, not one card's budget.
export const MAX_BACKUP_VALUES =
  MAX_LIBRARY_CARDS * (MAX_CARD_VALUES + 32) + 32;
export function bounded(
  value: unknown,
  maxValues = MAX_CARD_VALUES,
  maxDepth = 64,
) {
  const stack: { v: unknown; depth: number }[] = [{ v: value, depth: 0 }];
  let count = 0;
  while (stack.length) {
    const { v, depth } = stack.pop()!;
    if (depth > maxDepth || ++count > maxValues)
      throw Error("JSON 层级或节点数量超限");
    if (v && typeof v === "object")
      for (const child of Object.values(v))
        stack.push({ v: child, depth: depth + 1 });
  }
}
export function parseJSON(
  text: string,
  max = MAX_BYTES,
  maxValues = MAX_CARD_VALUES,
  maxDepth = 64,
): unknown {
  if (new TextEncoder().encode(text).length > max)
    throw Error(`文件过大（上限 ${max / 1024 / 1024} MB）`);
  try {
    const value: unknown = JSON.parse(text);
    bounded(value, maxValues, maxDepth);
    return value;
  } catch (e) {
    if (e instanceof SyntaxError) throw Error("JSON 格式错误");
    throw e;
  }
}
export function validateCard(value: unknown): Card {
  bounded(value);
  if (!validate(value))
    throw Error(
      "卡片协议校验失败：" +
        (validate.errors ?? [])
          .slice(0, 5)
          .map((e) => `${e.instancePath || "/"} ${e.message}`)
          .join("；"),
    );
  const card = value as Card;
  if (new TextEncoder().encode(JSON.stringify(card)).length > MAX_BYTES)
    throw Error("卡片超过 2 MB");
  const ids = new Set<string>();
  const stack = card.branches.map((b) => ({ b, depth: 1 }));
  while (stack.length) {
    const { b, depth } = stack.pop()!;
    if (depth > MAX_DEPTH) throw Error("知识树深度超过 16 层");
    if (ids.has(b.id)) throw Error("重复节点 ID：" + b.id);
    ids.add(b.id);
    stack.push(...b.children.map((c) => ({ b: c, depth: depth + 1 })));
  }
  return card;
}
// Zod boundary delegates protocol validation to the authoritative JSON Schema.
export const cardBoundary = z.unknown().transform((value, ctx) => {
  try {
    return validateCard(value);
  } catch (e) {
    ctx.addIssue({ code: "custom", message: (e as Error).message });
    return z.NEVER;
  }
});
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map(
          (k) =>
            JSON.stringify(k) +
            ":" +
            canonical((value as Record<string, unknown>)[k]),
        )
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export async function hash(value: unknown) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonical(value)),
      ),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
