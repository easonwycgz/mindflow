import { useRef } from "react";
import type { Card } from "./model";
import { ReadingText } from "./ReadingText";

export const codepoints = (text: string) => Array.from(text).length;
export function quickLayer(card: Card) {
  return {
    core: card.key_takeaways[0],
    points: card.key_takeaways.slice(1, 3),
    longCore: codepoints(card.key_takeaways[0]) > 120,
    length: card.key_takeaways
      .slice(0, 3)
      .reduce((sum, item) => sum + codepoints(item), 0),
  };
}
function Takeaway({ text, core = false }: { text: string; core?: boolean }) {
  if (codepoints(text) > (core ? 120 : 180))
    return (
      <details className="long-takeaway">
        <summary>{core ? "核心收获" : "这条要点"}较长，展开完整原文</summary>
        <p className="prose">{text}</p>
      </details>
    );
  return <p className="prose">{text}</p>;
}
export function QuickRead({
  card,
  initialFull,
  onTree,
  onFaq,
  onDone,
}: {
  card: Card;
  initialFull: boolean;
  onTree: () => void;
  onFaq: () => void;
  onDone: () => void;
}) {
  const quick = quickLayer(card);
  const wasOpen = useRef(initialFull);
  return (
    <section aria-label="快速阅读">
      <h3>先带走这一点</h3>
      <div className="core-takeaway" data-testid="quick-core">
        <Takeaway text={quick.core} core />
      </div>
      {quick.points.length > 0 && (
        <>
          <h3>再看{quick.points.length === 1 ? "一" : "两"}点</h3>
          <ol className="takeaways quick-points">
            {quick.points.map((point, i) => (
              <li key={i}>
                <Takeaway text={point} />
              </li>
            ))}
          </ol>
        </>
      )}
      {(quick.longCore || quick.length > 300) && (
        <p className="muted" data-testid="quick-long">
          本卡原文较长，可以分次阅读；“30 秒”是快速入口，不保证读完全部内容。
        </p>
      )}
      <div className="row reading-exits">
        <button className="primary" onClick={onTree}>
          继续探索知识树 →
        </button>
        <button onClick={onFaq}>看看 FAQ</button>
        <button onClick={onDone}>这次先到这里</button>
      </div>
      <details
        className="full-summary"
        open={initialFull || undefined}
        onToggle={(event) => {
          const details = event.currentTarget;
          if (event.target !== details) return;
          if (wasOpen.current && !details.open) {
            const summary = details.querySelector("summary");
            summary?.focus({ preventScroll: true });
            summary?.scrollIntoView({ block: "nearest" });
          }
          wasOpen.current = details.open;
        }}
      >
        <summary>完整摘要与全部 {card.key_takeaways.length} 条要点</summary>
        <h3>完整摘要</h3>
        <ReadingText text={card.summary} />
        <h3>全部要点（原顺序）</h3>
        <ol className="takeaways">
          {card.key_takeaways.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      </details>
    </section>
  );
}
export function Boundaries({ caveats }: { caveats: string[] }) {
  if (!caveats.length) return null;
  return (
    <aside className="boundaries" aria-label="原文适用边界">
      <strong>原文适用边界 · {caveats.length} 条</strong>
      <p>行动前请读原文；应用未作当前核实。</p>
      <p className="boundary-preview" data-testid="caveat-preview">
        {caveats[0]}
      </p>
      <details>
        <summary>查看全部 {caveats.length} 条原文提醒</summary>
        <ol>
          {caveats.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      </details>
    </aside>
  );
}
export function sourceDescription(source: Card["source"]) {
  const title = !!source.chat_title?.trim(),
    url = !!source.chat_url?.trim();
  if (!title && !url)
    return "未提供原对话标题和链接。来源元数据缺失不代表内容没有依据，也不表示已经核实。可查看适用边界和 FAQ 依据标记。";
  return `${title ? source.chat_title : "未提供原对话标题"}；${url ? "已记录来源链接（仅作记录，不自动打开）" : "未提供原对话链接"}`;
}
