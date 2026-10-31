import { hash, validateCard, type Card } from "../../src/model";
import {
  defaults,
  newReading,
  type Payload,
  type StoredCard,
} from "../../src/db";
import { syntheticCard } from "./ux1";

// Entirely fictional. Large cards stay below 2MiB; the library crosses 40MiB
// through several legal cards rather than by inserting an invalid oversized card.
export function capacityCard(index: number, large = false): Card {
  const content = syntheticCard({
    title: `合成容量卡 ${index}`,
    hook: "完全虚构的容量测试。",
    summary: "合成摘要。",
    tags: ["合成容量"],
    key_takeaways: ["合成收获。"],
    caveats: [],
    branches: [
      {
        id: "root",
        title: "合成根",
        summary: "合成预览",
        content: "合成正文",
        children: large
          ? Array.from({ length: 96 }, (_, i) => ({
              id: `leaf-${i}`,
              title: "合成叶",
              summary: "合成摘要",
              content: "x".repeat(19000),
              children: [],
            }))
          : [],
      },
    ],
  });
  return validateCard(content);
}
export async function capacityLibrary(
  count: number,
  large = false,
): Promise<Payload> {
  const cards: StoredCard[] = [];
  for (let i = 0; i < count; i++) {
    const content = capacityCard(i, large),
      id = `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
    cards.push({
      id,
      content,
      hash: await hash(content),
      createdAt: 1,
      updatedAt: 1,
    });
  }
  return {
    cards,
    reading: cards.map((c, i) => ({
      ...newReading(c.id),
      favorite: i % 2 === 0,
    })),
    settings: { ...defaults, lastCardId: cards[0]?.id ?? null },
  };
}
