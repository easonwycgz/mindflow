import { defaults, newReading, type MindDB, type Reading } from "./db";

export type Cursor = Pick<Reading, "section" | "nodeId" | "scroll">;
export interface ReadingView {
  cardId: string;
  mode: "resume" | "discover";
  cursor: Cursor;
  token: number;
  render: number;
  location: "saved" | "top" | "node" | "keep";
}
type Pending = { cardId: string; scroll: number };
const cursorOf = ({ section, nodeId, scroll }: Reading): Cursor => ({
  section,
  nodeId,
  scroll,
});

// Page-local entry/cursor ownership. Nothing in this class changes the v1 data format.
export class ReadingSession {
  private epoch = 0;
  private render = 0;
  private view: ReadingView | null = null;
  private restored = false;
  private ignoredScroll: number | null = null;
  private paused = false;
  private pending: Pending | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private db: MindDB,
    private onError: (error: unknown) => void = () => {},
  ) {}
  snapshot() {
    return this.view;
  }
  owns(view: ReadingView) {
    return (
      !this.paused &&
      this.view?.token === view.token &&
      this.view.render === view.render &&
      this.epoch === view.token
    );
  }
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const task = this.queue.catch(() => {}).then(fn);
    this.queue = task;
    return task;
  }
  private cancelTimer() {
    clearTimeout(this.timer);
    this.timer = undefined;
  }
  noteScroll(scroll: number) {
    if (
      !this.view ||
      !this.restored ||
      this.paused ||
      this.view.token !== this.epoch
    )
      return;
    if (this.view.mode === "discover") return;
    // A scroll event queued by layout replay can arrive after ownership is ready.
    if (scroll === this.ignoredScroll) return;
    this.ignoredScroll = null;
    this.pending = { cardId: this.view.cardId, scroll: Math.max(0, scroll) };
    this.cancelTimer();
    this.timer = setTimeout(() => {
      void this.flush().catch(this.onError);
    }, 150);
  }
  async flush() {
    this.cancelTimer();
    const pending = this.pending;
    if (!pending) {
      await this.queue.catch(() => {});
      return;
    }
    await this.enqueue(() =>
      this.db.transaction("rw", this.db.reading, async () => {
        // Only patch scroll, never replace a record captured before a concurrent favorite.
        await this.db.reading.update(pending.cardId, {
          scroll: pending.scroll,
        });
      }),
    );
    if (this.pending === pending) this.pending = null;
  }
  async open(
    cardId: string,
    mode: ReadingView["mode"],
    updateLast = true,
  ): Promise<ReadingView | null> {
    if (this.paused) throw Error("恢复正在进行，请稍后再切换卡片。");
    const token = ++this.epoch;
    const previous = this.view;
    this.restored = false;
    this.ignoredScroll = null;
    try {
      await this.flush();
      const row = (await this.db.reading.get(cardId)) ?? newReading(cardId);
      if (token !== this.epoch) return null;
      if (mode === "resume" && updateLast)
        await this.enqueue(() =>
          this.db.transaction("rw", this.db.settings, async () => {
            const settings = (await this.db.settings.get("main")) ?? defaults;
            if (token === this.epoch)
              await this.db.settings.put({ ...settings, lastCardId: cardId });
          }),
        );
      if (token !== this.epoch) return null;
      this.view = {
        cardId,
        mode,
        cursor:
          mode === "discover"
            ? { section: "summary", nodeId: null, scroll: 0 }
            : cursorOf(row),
        token,
        render: ++this.render,
        location: mode === "discover" ? "top" : "saved",
      };
      return this.view;
    } catch (error) {
      if (token === this.epoch) {
        this.view = previous
          ? { ...previous, token, render: ++this.render, location: "keep" }
          : null;
        this.restored = true;
      }
      throw error;
    }
  }
  finishRestore(view: ReadingView, scroll: number, appliedScroll = scroll) {
    if (!this.owns(view)) return;
    this.restored = true;
    this.ignoredScroll = appliedScroll;
    // A deliberate navigation should save its resulting position; replaying a saved
    // position must not clamp and overwrite that saved value merely because layout changed.
    if (view.location === "node" || view.location === "top") {
      this.ignoredScroll = null;
      this.noteScroll(scroll);
    } else if (scroll !== appliedScroll) this.noteScroll(scroll);
  }
  async change(
    change: Partial<Cursor>,
    location: ReadingView["location"] = "top",
  ) {
    const view = this.view;
    if (!view || !this.owns(view)) return null;
    this.restored = false;
    try {
      const next = { ...view.cursor, ...change };
      await this.flush();
      if (!this.owns(view)) return null;
      if (view.mode === "resume")
        await this.enqueue(() =>
          this.db.transaction("rw", this.db.reading, async () => {
            if (this.owns(view))
              await this.db.reading.update(view.cardId, change);
          }),
        );
      if (!this.owns(view)) return null;
      this.view = { ...view, cursor: next, render: ++this.render, location };
      return this.view;
    } catch (error) {
      if (this.owns(view)) this.restored = true;
      throw error;
    }
  }
  async favorite(cardId: string, favorite: boolean) {
    return this.enqueue(() =>
      this.db.transaction("rw", this.db.reading, async () => {
        await this.db.reading.update(cardId, { favorite });
        return this.db.reading.get(cardId);
      }),
    );
  }
  async adopt(scroll: number) {
    const view = this.view;
    if (!view || !this.owns(view) || view.mode !== "discover") return null;
    const next = { ...view.cursor, scroll: Math.max(0, scroll) };
    await this.enqueue(() =>
      this.db.transaction("rw", this.db.reading, this.db.settings, async () => {
        const settings = (await this.db.settings.get("main")) ?? defaults;
        if (!this.owns(view)) return;
        await this.db.reading.update(view.cardId, next);
        await this.db.settings.put({ ...settings, lastCardId: view.cardId });
      }),
    );
    if (!this.owns(view)) return null;
    this.view = {
      ...view,
      mode: "resume",
      cursor: next,
      render: ++this.render,
      location: "keep",
    };
    return this.view;
  }
  async end(scroll: number) {
    const view = this.view;
    if (!view || !this.owns(view)) return false;
    this.noteScroll(scroll);
    this.restored = false;
    try {
      await this.flush();
      return this.owns(view);
    } catch (error) {
      if (this.owns(view)) this.restored = true;
      throw error;
    }
  }
  async pause() {
    this.paused = true;
    this.restored = false;
    ++this.epoch;
    await this.flush();
    this.view = null;
  }
  async initialize(cardId: string | null, updateLast = false) {
    this.cancelTimer();
    this.pending = null;
    ++this.epoch;
    this.view = null;
    this.paused = false;
    return cardId ? this.open(cardId, "resume", updateLast) : null;
  }
  dispose() {
    this.cancelTimer();
    ++this.epoch;
    this.restored = false;
  }
}
