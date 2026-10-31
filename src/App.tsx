import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type TouchEvent,
  type KeyboardEvent,
} from "react";
import { FONT_INTENT_KEY, FontWriter, pendingFont } from "./settings";
import { exportVolumes, restoreVolumes, type TransferFile } from "./volumes";
import { LargeMigration } from "./LargeMigration";
import { ReadingText } from "./ReadingText";
import { useRegisterSW } from "virtual:pwa-register/react";
import example from "../contracts/mindflow-card-example-v1.json";
import {
  backup,
  db,
  defaults,
  importCard,
  restore,
  type Reading,
  type Settings,
  type StoredCard,
} from "./db";
import { InputIssue, MAX_BYTES, MAX_BACKUP_BYTES, type Branch } from "./model";
import { ReadingSession, type ReadingView } from "./readingSession";
import {
  QuickRead,
  Boundaries,
  sourceDescription,
} from "./readingPresentation";
import { explainImport, type ImportFeedback } from "./importFeedback";
const basis = {
  conversation: "原对话",
  supplement: "补充说明",
  needs_verification: "待核实",
};
function contains(nodes: Branch[], id: string | null): boolean {
  return nodes.some((n) => n.id === id || contains(n.children, id));
}
function Tree({
  nodes,
  selected,
  onSelect,
}: {
  nodes: Branch[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="tree">
      {nodes.map((n) => (
        <li key={n.id}>
          <button
            data-node-id={n.id}
            aria-pressed={selected === n.id}
            onClick={() => onSelect(n.id)}
          >
            {n.title}
          </button>
          <details className="branch-preview">
            <summary aria-label={`预览 ${n.title} 的分支摘要`}>
              分支摘要
            </summary>
            <p>{n.summary}</p>
          </details>
          {n.children.length > 0 && (
            <details
              data-children
              open={contains(n.children, selected) || undefined}
              onToggle={(event) => {
                const details = event.currentTarget;
                if (
                  event.target === details &&
                  !details.open &&
                  details.contains(document.activeElement)
                ) {
                  details.parentElement
                    ?.querySelector<HTMLButtonElement>(":scope > button")
                    ?.focus();
                }
              }}
            >
              <summary aria-label={`展开 ${n.title} 的子节点`}>
                子节点 {n.children.length}
              </summary>
              <Tree
                nodes={n.children}
                selected={selected}
                onSelect={onSelect}
              />
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}
function findNode(nodes: Branch[], id: string | null): Branch | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    const child = findNode(n.children, id);
    if (child) return child;
  }
}
export default function App() {
  const [cards, setCards] = useState<StoredCard[]>([]),
    [states, setStates] = useState<Reading[]>([]),
    [settings, setSettings] = useState<Settings>(defaults);
  const [active, setActive] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [favorites, setFavorites] = useState(false),
    [message, setMessage] = useState(""),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(navigator.onLine);
  const [importFeedback, setImportFeedback] = useState<ImportFeedback | null>(
    null,
  );
  const [pasteOpen, setPasteOpen] = useState(false),
    [paste, setPaste] = useState("");
  function showMessage(text: string) {
    setImportFeedback(null);
    setMessage(text);
  }
  const nodeRef = useRef<HTMLElement>(null);
  const [view, setView] = useState<ReadingView | null>(null);
  const [readingError, setReadingError] = useState(false);
  const [session] = useState(
    () =>
      new ReadingSession(db, () => {
        setReadingError(true);
        showMessage("阅读位置保存失败；原记录保留，请重试保存。");
      }),
  );
  const touch = useRef<{ x: number; y: number; time: number } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const restoreFile = useRef<HTMLInputElement>(null);
  const volumeInput = useRef<HTMLInputElement>(null);
  const [volumeFiles, setVolumeFiles] = useState<TransferFile[]>([]);
  const [fontDraft, setFontDraft] = useState<Settings["fontSize"]>("normal");
  const [fontStatus, setFontStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [fontError, setFontError] = useState("");
  const fontRequest = useRef(0);
  const writer = useRef<FontWriter | null>(null);
  function fontWriter() {
    return writer.current ?? (writer.current = new FontWriter(localStorage));
  }
  async function saveFont(fontSize: Settings["fontSize"]) {
    const request = ++fontRequest.current;
    setFontDraft(fontSize);
    setFontStatus("saving");
    setFontError("");
    try {
      const committed = await fontWriter().choose(fontSize);
      if (request === fontRequest.current) {
        setSettings((prev) => ({ ...prev, fontSize: committed.fontSize }));
        setFontStatus("saved");
      }
    } catch (e) {
      if (request === fontRequest.current) {
        const actual = await db.settings.get("main").catch(() => undefined);
        if (actual)
          setSettings((prev) => ({ ...prev, fontSize: actual.fontSize }));
        setFontStatus("error");
        setFontError(e instanceof Error ? e.message : "数据库不可用");
      }
    }
  }
  function download(name: string, text: string) {
    const url = URL.createObjectURL(
      new Blob([text], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function returnToTree() {
    const tree = document.getElementById("tree-navigation");
    if (!tree) return;
    const buttons = Array.from(
      tree.querySelectorAll<HTMLButtonElement>("button[data-node-id]"),
    );
    const target =
      buttons.find((b) => b.dataset.nodeId === reading?.nodeId) ??
      buttons[0] ??
      tree;
    for (
      let parent = target.parentElement;
      parent && parent !== tree;
      parent = parent.parentElement
    )
      if (parent instanceof HTMLDetailsElement) parent.open = true;
    target.scrollIntoView({ block: "center" });
    target.focus({ preventScroll: true });
  }
  function treeKeys(e: KeyboardEvent<HTMLDivElement>) {
    const current = e.target as HTMLButtonElement;
    if (!current.matches("button[data-node-id]")) return;
    const tree = e.currentTarget;
    const all = Array.from(
      tree.querySelectorAll<HTMLButtonElement>("button[data-node-id]"),
    ).filter((b) => b.getClientRects().length > 0);
    const index = all.indexOf(current);
    let next: HTMLElement | undefined;
    if (e.key === "ArrowDown") next = all[Math.min(index + 1, all.length - 1)];
    if (e.key === "ArrowUp") next = all[Math.max(index - 1, 0)];
    if (e.key === "Home") next = all[0];
    if (e.key === "End") next = all.at(-1);
    const children = current.parentElement?.querySelector<HTMLDetailsElement>(
      ":scope > details[data-children]",
    );
    if (e.key === "ArrowRight" && children) {
      if (children.open)
        next =
          children.querySelector<HTMLButtonElement>("button[data-node-id]") ??
          undefined;
      else children.open = true;
    }
    if (e.key === "ArrowLeft") {
      if (children?.open) children.open = false;
      else
        next =
          current.parentElement?.parentElement
            ?.closest("li")
            ?.querySelector<HTMLButtonElement>(":scope > button") ?? undefined;
    }
    if (
      [
        "ArrowDown",
        "ArrowUp",
        "Home",
        "End",
        "ArrowRight",
        "ArrowLeft",
      ].includes(e.key)
    )
      e.preventDefault();
    if (next) {
      next.focus();
      next.scrollIntoView({ block: "nearest" });
    }
  }
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: () =>
      showMessage("离线资源安装失败，请保持联网并重新打开。"),
  });
  async function load(initial = false, requestedId?: string) {
    const pending = initial ? pendingFont() : null;
    if (pending) {
      setFontDraft(pending.fontSize);
      setFontStatus("saving");
    }

    const [c, r, s] = await Promise.all([
      db.cards.toArray(),
      db.reading.toArray(),
      db.settings.get("main"),
    ]);
    const targetId = requestedId ?? s?.lastCardId ?? null;
    const nextView = await session.initialize(
      targetId,
      requestedId !== undefined,
    );
    if (targetId && !nextView) return;
    setCards(c);
    setStates(r);
    setActive(targetId);
    setView(nextView);
    if (s) {
      setSettings({ ...s, lastCardId: targetId });
      if (
        !pending &&
        (initial || (fontStatus !== "saving" && fontStatus !== "error"))
      )
        setFontDraft(s.fontSize);
    }
    setReady(true);
    if (pending) {
      const request = ++fontRequest.current;
      try {
        const committed = await fontWriter().resume();
        if (committed && request === fontRequest.current) {
          setSettings((prev) => ({ ...prev, fontSize: committed.fontSize }));
          setFontDraft(committed.fontSize);
          setFontStatus("saved");
        }
      } catch (e) {
        if (request === fontRequest.current) {
          setFontStatus("error");
          setFontError(e instanceof Error ? e.message : "恢复保存失败");
        }
      }
    }
  }
  useEffect(() => {
    void load(true).catch(() => {
      showMessage("无法打开本地数据库。请检查浏览器存储权限，勿清除已有数据。");
    });
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const card = cards.find((c) => c.id === active),
    savedReading = states.find((r) => r.cardId === active),
    reading =
      savedReading && view?.cardId === active
        ? { ...savedReading, ...view.cursor }
        : savedReading,
    node = card
      ? findNode(card.content.branches, reading?.nodeId ?? null)
      : undefined;
  const nodePath = useMemo(() => {
    const paths = new Map<string, Branch[]>();
    function visit(nodes: Branch[], parents: Branch[]) {
      for (const branch of nodes) {
        const path = [...parents, branch];
        paths.set(branch.id, path);
        visit(branch.children, path);
      }
    }
    if (card) visit(card.content.branches, []);
    return paths;
  }, [card]);
  useLayoutEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";
    return () => {
      history.scrollRestoration = previous;
    };
  }, []);
  useLayoutEffect(() => {
    if (!view || !session.owns(view)) return;
    // Apply and acknowledge before paint: visible content must already accept
    // user scrolling. No remote media/fonts can change this layout asynchronously.
    if (view.location === "node") {
      nodeRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
      nodeRef.current?.focus({ preventScroll: true });
    } else if (view.location === "top") {
      const heading = document.getElementById("card-title");
      heading?.scrollIntoView({ block: "start", behavior: "instant" });
      heading?.focus({ preventScroll: true });
    } else if (view.location === "saved")
      window.scrollTo(0, view.cursor.scroll);
    session.finishRestore(view, window.scrollY);
  }, [view, session]);
  useEffect(() => {
    const scroll = () => session.noteScroll(window.scrollY);
    const save = () => {
      void session.flush().catch(() => {
        setReadingError(true);
        showMessage("阅读位置保存失败，请重试保存。");
      });
    };
    window.addEventListener("scroll", scroll);
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("pagehide", save);
      session.dispose();
    };
  }, [session]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      showMessage(e instanceof Error ? e.message : "操作失败；原数据保留。");
    } finally {
      setBusy(false);
    }
  }
  async function select(id: string, mode: ReadingView["mode"] = "resume") {
    session.noteScroll(window.scrollY);
    try {
      const next = await session.open(id, mode);
      if (!next) return;
      setView(next);
      setActive(id);
      if (mode === "resume")
        setSettings((prev) => ({ ...prev, lastCardId: id }));
    } catch (error) {
      setView(session.snapshot());
      throw error;
    }
  }
  async function state(change: Partial<Reading>) {
    if (!active) return;
    if (typeof change.favorite === "boolean") {
      const row = await session.favorite(active, change.favorite);
      if (row)
        setStates((prev) => [
          ...prev.filter((x) => x.cardId !== row.cardId),
          row,
        ]);
      return;
    }
    const next = await session.change(change, change.nodeId ? "node" : "top");
    if (next) setView(next);
  }
  async function replaceReading(fn: () => Promise<void>) {
    try {
      await session.pause();
      await fn();
    } finally {
      await load(true);
    }
  }
  async function imported(text: string) {
    let importedCard: StoredCard;
    try {
      importedCard = await importCard(text);
    } catch (error) {
      showMessage("");
      setImportFeedback(explainImport(error));
      return false;
    }
    showMessage("");
    setImportFeedback({
      kind: "success",
      title: "卡片已安全导入",
      guidance: "内容保存在此浏览器，可继续阅读。",
    });
    try {
      await session.flush();
      await load(false, importedCard.id);
    } catch {
      showMessage(
        "卡片已导入，但阅读入口恢复失败；请重新打开卡片，不要重复导入。",
      );
    }
    return true;
  }
  async function file(event: ChangeEvent<HTMLInputElement>, isRestore = false) {
    const f = event.target.files?.[0];
    event.target.value = "";
    if (!f) return;
    await action(async () => {
      if (f.size > (isRestore ? MAX_BACKUP_BYTES : MAX_BYTES)) {
        if (isRestore) throw Error("文件过大");
        showMessage("");
        setImportFeedback(
          explainImport(new InputIssue("capacity", "文件过大（上限 2 MB）")),
        );
        return;
      }
      if (isRestore) {
        await replaceReading(async () => {
          await restore(await f.text());
          localStorage.removeItem(FONT_INTENT_KEY);
        });
        localStorage.removeItem(FONT_INTENT_KEY);
        setFontStatus("idle");
        showMessage("备份恢复成功");
      } else {
        try {
          await imported(await f.text());
        } catch (error) {
          showMessage("");
          setImportFeedback(explainImport(error));
        }
      }
    });
  }
  const visible = cards.filter(
    (c) =>
      (!favorites || states.find((r) => r.cardId === c.id)?.favorite) &&
      [c.content.title, c.content.summary, ...c.content.tags]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  async function move(direction: number) {
    const index = visible.findIndex((c) => c.id === active);
    if (visible.length > 1)
      await select(
        visible[(index + direction + visible.length) % visible.length].id,
      );
  }
  function touchStart(e: TouchEvent<HTMLElement>) {
    const target = e.target as HTMLElement;
    if (
      e.touches.length !== 1 ||
      target.closest("button,a,input,textarea,select,summary,.tree") ||
      window.getSelection()?.toString()
    ) {
      touch.current = null;
      return;
    }
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  }
  function touchEnd(e: TouchEvent<HTMLElement>) {
    const start = touch.current;
    touch.current = null;
    if (
      !start ||
      e.changedTouches.length !== 1 ||
      window.getSelection()?.toString()
    )
      return;
    const t = e.changedTouches[0],
      dx = t.clientX - start.x,
      dy = t.clientY - start.y;
    if (
      Math.abs(dx) >= 80 &&
      Math.abs(dx) > Math.abs(dy) * 2 &&
      Date.now() - start.time < 1200
    )
      void action(() => move(dx < 0 ? 1 : -1));
  }
  return (
    <div className={settings.fontSize === "large" ? "app large" : "app"}>
      <header>
        <a href="#main" className="skip">
          跳到阅读内容
        </a>
        <div className="brand">
          ◈ Mindflow <span>慢读，深想</span>
        </div>
        <span className="status">
          {!online ? "离线模式" : offlineReady ? "可离线阅读" : "仅本机存储"}
        </span>
      </header>
      {needRefresh && (
        <aside className="notice">
          新版本已准备好。导入操作结束后可更新。
          <button
            disabled={busy}
            onClick={() => void updateServiceWorker(true)}
          >
            更新应用
          </button>
        </aside>
      )}
      <div className={card ? "layout has-card" : "layout"}>
        <aside className="library">
          <details className="library-panel" open>
            <summary className="library-toggle">知识库与导入</summary>
            <p className="eyebrow">你的私人知识花园</p>
            <h1>
              让好奇心
              <br />
              继续生长。
            </h1>
            <p className="muted">把值得留下的想法，变成随时可读的知识卡片。</p>
            <div className="tools">
              <button
                disabled={busy || !ready || fontStatus === "saving"}
                onClick={() => setPasteOpen(true)}
              >
                粘贴 JSON
              </button>
              <label className="button primary">
                导入卡片
                <input
                  aria-label="导入卡片"
                  type="file"
                  accept="application/json,.json"
                  disabled={busy || !ready || fontStatus === "saving"}
                  onChange={(e) => void file(e)}
                />
              </label>
              <button
                disabled={busy || !ready || fontStatus === "saving"}
                onClick={() =>
                  void action(async () => {
                    const c = await importCard(JSON.stringify(example));
                    await session.flush();
                    await load(false, c.id);
                    showMessage("演示卡片已添加");
                  })
                }
              >
                体验示例
              </button>
            </div>
            {pasteOpen && (
              <section className="paste" aria-label="粘贴 JSON 导入">
                <label>
                  粘贴 JSON
                  <textarea
                    aria-label="JSON 内容"
                    value={paste}
                    onChange={(e) => setPaste(e.target.value)}
                    placeholder="在此粘贴一张完整卡片的 JSON"
                  />
                </label>
                <p>
                  仅在此设备校验，不上传。每次一张，最多 2
                  MB；可连续导入组成知识库。
                </p>
                <button
                  disabled={busy || !paste.trim() || fontStatus === "saving"}
                  onClick={() =>
                    void action(async () => {
                      if (await imported(paste)) {
                        setPaste("");
                        setPasteOpen(false);
                      }
                    })
                  }
                >
                  校验并导入
                </button>
                <button onClick={() => setPasteOpen(false)}>关闭粘贴</button>
              </section>
            )}
            <label className="search">
              搜索知识
              <input
                type="search"
                placeholder="标题、摘要或标签"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="row">
              <button
                aria-pressed={favorites}
                onClick={() => setFavorites(!favorites)}
              >
                ★ 只看收藏
              </button>
              <button
                disabled={visible.length < 2}
                onClick={() =>
                  void action(async () => {
                    const pool = visible.filter((c) => c.id !== active);
                    await select(
                      pool[Math.floor(Math.random() * pool.length)].id,
                      "discover",
                    );
                  })
                }
              >
                随机一张
              </button>
            </div>
            <p className="count">{visible.length} 张卡片</p>
            <nav aria-label="卡片列表">
              {visible.map((c) => (
                <button
                  className={"card-link " + (active === c.id ? "selected" : "")}
                  key={c.id}
                  onClick={() => void action(() => select(c.id))}
                >
                  <span>{c.content.tags[0]}</span>
                  <strong>{c.content.title}</strong>
                  {states.find((r) => r.cardId === c.id)?.favorite && " ★"}
                </button>
              ))}
            </nav>
            {!visible.length && (
              <p className="muted">
                {cards.length
                  ? "没有匹配的卡片。"
                  : "从一张卡片开始。导入文件，或体验公开示例。"}
              </p>
            )}
            <details className="storage">
              <summary>备份、设置与隐私</summary>
              <p>
                卡片仅保存在此浏览器。清除网站数据、卸载或系统回收存储都可能导致丢失。请定期导出备份。
              </p>
              <p className="backup-warning">
                备份文件未经加密，以明文包含全部知识内容、阅读状态与设置。任何获得文件的人都能读取；请勿公开分享，并妥善保管。
              </p>
              <button
                disabled={!ready || busy || fontStatus === "saving"}
                onClick={() =>
                  void action(async () => {
                    const blob = new Blob([await backup()], {
                      type: "application/json",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "mindflow-backup.json";
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    showMessage("备份已生成，请妥善保管下载文件");
                  })
                }
              >
                导出完整备份
              </button>
              <button
                disabled={!ready || busy || fontStatus === "saving"}
                onClick={() => setConfirmRestore(true)}
              >
                恢复备份
              </button>
              <button
                disabled={!ready || busy || fontStatus === "saving"}
                onClick={() =>
                  void action(async () => {
                    setVolumeFiles(await exportVolumes());
                    showMessage(
                      "分卷备份已生成。请下载清单及每一卷，恢复时同时选择全部文件。",
                    );
                  })
                }
              >
                生成分卷备份
              </button>
              {volumeFiles.length > 0 && (
                <section aria-label="分卷下载">
                  <p>
                    未加密。请完整保存以下 {volumeFiles.length}{" "}
                    个文件；清单用于检验完整性和顺序。
                  </p>
                  {volumeFiles.map((f, i) => (
                    <button
                      key={f.name}
                      onClick={() => download(f.name, f.text)}
                    >
                      {i === 0 ? "下载迁移清单" : `下载分卷 ${i}`}
                    </button>
                  ))}
                </section>
              )}
              <button
                disabled={!ready || busy || fontStatus === "saving"}
                onClick={() => {
                  if (
                    window.confirm(
                      "分卷恢复会替换全部卡片、阅读状态和设置。请先备份；选择清单及全部分卷。",
                    )
                  )
                    volumeInput.current?.click();
                }}
              >
                恢复全部分卷
              </button>
              <input
                ref={volumeInput}
                aria-label="恢复分卷文件"
                hidden
                type="file"
                multiple
                accept=".json"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  if (!files.length) return;
                  void action(async () => {
                    if (
                      files.length > 17 ||
                      files.reduce((n, f) => n + f.size, 0) > MAX_BACKUP_BYTES
                    )
                      throw Error("请选择完整分卷，合计最多40 MB");
                    const inputs: TransferFile[] = [];
                    for (const f of files)
                      inputs.push({ name: f.name, text: await f.text() });
                    await replaceReading(async () => {
                      await restoreVolumes(inputs);
                      localStorage.removeItem(FONT_INTENT_KEY);
                    });
                    localStorage.removeItem(FONT_INTENT_KEY);
                    setVolumeFiles([]);
                    setFontStatus("idle");
                    showMessage("分卷恢复成功，全部数据已原子写入");
                  });
                }}
              />
              {confirmRestore && (
                <div role="group" aria-label="确认恢复">
                  <p>恢复将替换当前全部卡片、阅读状态和设置。请先导出备份。</p>
                  <button
                    onClick={() => {
                      setConfirmRestore(false);
                      restoreFile.current?.click();
                    }}
                  >
                    选择备份并替换
                  </button>
                  <button onClick={() => setConfirmRestore(false)}>取消</button>
                </div>
              )}
              <input
                ref={restoreFile}
                aria-label="恢复备份文件"
                hidden
                type="file"
                accept=".json"
                onChange={(e) => void file(e, true)}
              />
              <a className="button" href="/migration.html">
                打开独立迁移页（不加载整库）
              </a>
              <LargeMigration
                disabled={!ready || busy || fontStatus === "saving"}
                onBusy={setBusy}
                withRestore={replaceReading}
                onRestored={async () => {
                  localStorage.removeItem(FONT_INTENT_KEY);
                  setFontStatus("idle");
                  showMessage("分页迁移恢复成功，所有数据已提交");
                }}
              />
              <label className="font">
                字号
                <select
                  value={fontDraft}
                  disabled={!ready || busy}
                  onChange={(e) =>
                    void saveFont(e.target.value as Settings["fontSize"])
                  }
                >
                  <option value="normal">标准</option>
                  <option value="large">大字</option>
                </select>
              </label>
              <p aria-live="polite" data-testid="font-save-state">
                {fontStatus === "saving"
                  ? "正在保存字号；尚未提交，刷新后会继续完成。"
                  : fontStatus === "saved"
                    ? `字号已保存：${settings.fontSize === "large" ? "大字" : "标准"}`
                    : fontStatus === "error"
                      ? `字号保存失败：${fontError}；未确认保存，请重试。`
                      : "字号与本机已保存设置一致。"}
              </p>
              {fontStatus === "error" && (
                <button onClick={() => void saveFont(fontDraft)}>
                  重试保存字号
                </button>
              )}
              <p>
                无账户、无 AI
                调用、无数据上传。不加载远程图片。内容默认按纯文本安全显示，Markdown
                标记会保留。
              </p>
            </details>
          </details>
        </aside>
        <main id="main" tabIndex={-1}>
          {importFeedback && (
            <div
              role="status"
              aria-live={importFeedback.kind === "error" ? "off" : "polite"}
              className={`notice ${importFeedback.kind === "error" ? "import-error" : ""}`}
            >
              <div role={importFeedback.kind === "error" ? "alert" : undefined}>
                <strong>
                  {importFeedback.kind === "error" ? "导入失败：" : ""}
                  {importFeedback.title}
                </strong>
                <p>{importFeedback.guidance}</p>
              </div>
              {importFeedback.kind === "error" && importFeedback.detail && (
                <details>
                  <summary>技术详情</summary>
                  <pre>{importFeedback.detail}</pre>
                </details>
              )}
              <button
                aria-label="关闭提示"
                onClick={() => setImportFeedback(null)}
              >
                ×
              </button>
            </div>
          )}
          {message && (
            <div role="status" className="notice">
              {message}
              <button aria-label="关闭提示" onClick={() => showMessage("")}>
                ×
              </button>
            </div>
          )}
          {readingError && (
            <button
              onClick={() =>
                void action(async () => {
                  await session.flush();
                  setReadingError(false);
                  showMessage("阅读位置已保存");
                })
              }
            >
              重试保存阅读位置
            </button>
          )}
          {card && reading ? (
            <article
              onTouchStart={touchStart}
              onTouchEnd={touchEnd}
              onTouchCancel={() => {
                touch.current = null;
              }}
            >
              <div className="row">
                <span className="eyebrow">KNOWLEDGE CARD / 知识卡片</span>
                <button
                  aria-pressed={reading.favorite}
                  onClick={() =>
                    void action(() => state({ favorite: !reading.favorite }))
                  }
                >
                  {reading.favorite ? "★ 已收藏" : "☆ 收藏"}
                </button>
              </div>
              <h2 id="card-title" tabIndex={-1}>
                {card.content.title}
              </h2>
              {view?.mode === "discover" && (
                <aside className="discovery" aria-label="临时发现">
                  <p>随看中 · 上次进度已保留；本次探索不会自动替换进度。</p>
                  <button onClick={() => void action(() => select(card.id))}>
                    继续上次阅读
                  </button>
                  <button
                    onClick={() =>
                      void action(async () => {
                        const next = await session.adopt(window.scrollY);
                        if (next) {
                          setView(next);
                          setSettings((prev) => ({
                            ...prev,
                            lastCardId: card.id,
                          }));
                          showMessage("已从这里继续，替换了上次阅读位置。");
                        }
                      })
                    }
                  >
                    从这里继续（替换上次位置）
                  </button>
                </aside>
              )}
              <Boundaries
                key={`boundaries:${active}`}
                caveats={card.content.caveats}
              />
              <details className="card-context" key={`context:${active}`}>
                <summary>问题引子与标签</summary>
                <p className="hook">{card.content.hook}</p>
                <div className="tags">
                  {card.content.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              </details>
              <div className="row card-switch">
                <button
                  disabled={visible.length < 2 || busy}
                  onClick={() => void action(() => move(-1))}
                >
                  上一张
                </button>
                <button
                  disabled={visible.length < 2 || busy}
                  onClick={() => void action(() => move(1))}
                >
                  下一张
                </button>
              </div>
              <nav className="tabs" aria-label="阅读模式">
                {(
                  [
                    ["summary", "30 秒摘要"],
                    ["tree", "知识树"],
                    ["faq", "常见问题"],
                  ] as const
                ).map(([section, label]) => (
                  <button
                    key={section}
                    aria-pressed={reading.section === section}
                    onClick={() =>
                      void action(() => state({ section, scroll: 0 }))
                    }
                  >
                    {label}
                  </button>
                ))}
              </nav>
              {reading.section === "summary" && (
                <QuickRead
                  key={`quick:${active}`}
                  card={card.content}
                  initialFull={
                    view?.mode !== "discover" && (view?.cursor.scroll ?? 0) > 0
                  }
                  onTree={() =>
                    void action(() => state({ section: "tree", scroll: 0 }))
                  }
                  onFaq={() =>
                    void action(() => state({ section: "faq", scroll: 0 }))
                  }
                  onDone={() =>
                    void action(async () => {
                      if (!(await session.end(window.scrollY))) return;
                      const library =
                        document.querySelector<HTMLElement>(".library");
                      if (!library) return;
                      const panel = library.querySelector("details");
                      if (panel) panel.open = true;
                      const target =
                        library.querySelector<HTMLElement>(
                          ".card-link.selected",
                        ) ?? library;
                      target.scrollIntoView({ block: "start" });
                      target.focus({ preventScroll: true });
                    })
                  }
                />
              )}
              {reading.section === "tree" && (
                <>
                  <h3>02 / 沿着问题深入</h3>
                  {node && (
                    <section
                      ref={nodeRef}
                      tabIndex={-1}
                      className="node"
                      aria-label="节点内容"
                    >
                      <nav aria-label="当前知识路径" className="node-path">
                        {nodePath.get(node.id)?.map((part, i) => (
                          <span key={part.id}>
                            {i > 0 && " › "}
                            {part.title}
                          </span>
                        ))}
                      </nav>
                      <h3>{node.title}</h3>
                      <ReadingText text={node.content} />
                      <button onClick={returnToTree}>返回知识树</button>
                    </section>
                  )}
                  <div
                    id="tree-navigation"
                    tabIndex={-1}
                    aria-label="知识树导航"
                    onKeyDown={treeKeys}
                  >
                    <Tree
                      key={active}
                      nodes={card.content.branches}
                      selected={reading.nodeId}
                      onSelect={(id) =>
                        void action(async () => {
                          await state({ nodeId: id });
                        })
                      }
                    />
                  </div>
                </>
              )}
              {reading.section === "faq" && (
                <>
                  <h3>03 / 再多问一步</h3>
                  {card.content.faq.map((q, i) => (
                    <details className="faq" key={`${active}:${i}`}>
                      <summary>{q.question}</summary>
                      <ReadingText text={q.answer} />
                      <small>{basis[q.basis]}</small>
                    </details>
                  ))}
                </>
              )}
              <footer>
                {card.content.caveats.length === 0 && (
                  <p>未提供适用边界说明；这不表示内容不存在风险。</p>
                )}
                <p>来源：{sourceDescription(card.content.source)}</p>
              </footer>
            </article>
          ) : (
            <div className="empty">
              <span>✧</span>
              <h2>为思考留一点空间</h2>
              <p>
                从左侧导入一张知识卡片，
                <br />
                以摘要开始，沿着知识树深入。
              </p>
              <p className="muted">首次联网打开并缓存完成后，可离线阅读。</p>
            </div>
          )}
        </main>
      </div>
      <footer className="bottom">Mindflow V1 · 你的想法，留在你的设备上</footer>
    </div>
  );
}
