import { db, defaults, type MindDB, type Settings } from "./db";
export const FONT_INTENT_KEY = "mindflow-font-intent-v1";
type Intent = { token: string; fontSize: Settings["fontSize"] };
export function pendingFont(storage: Storage = localStorage): Intent | null {
  try {
    const value = JSON.parse(storage.getItem(FONT_INTENT_KEY) ?? "null");
    return value &&
      typeof value.token === "string" &&
      ["normal", "large"].includes(value.fontSize)
      ? value
      : null;
  } catch {
    return null;
  }
}
// Read/modify/write inside one transaction prevents unrelated settings overwrites, including other tabs.
export async function patchSettings(
  patch: Partial<Omit<Settings, "id">>,
  target: MindDB = db,
  shouldApply: () => boolean = () => true,
): Promise<Settings> {
  return target.transaction("rw", target.settings, async () => {
    const current = (await target.settings.get("main")) ?? defaults;
    if (!shouldApply()) return current;
    const next = {
      ...current,
      ...patch,
      id: "main" as const,
    };
    await target.settings.put(next);
    return next;
  });
}
export class FontWriter {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private storage: Storage,
    private target: MindDB = db,
  ) {}
  choose(fontSize: Settings["fontSize"]) {
    const intent: Intent = { token: crypto.randomUUID(), fontSize };
    // Synchronous tiny intent journal survives a refresh before IndexedDB commits. No cards are stored here.
    this.storage.setItem(FONT_INTENT_KEY, JSON.stringify(intent));
    return this.enqueue(intent);
  }
  resume() {
    const intent = pendingFont(this.storage);
    return intent ? this.enqueue(intent) : null;
  }
  private enqueue(intent: Intent) {
    const task = this.queue
      .catch(() => undefined)
      .then(async () => {
        const saved = await patchSettings(
          { fontSize: intent.fontSize },
          this.target,
          () => pendingFont(this.storage)?.token === intent.token,
        );
        if (pendingFont(this.storage)?.token === intent.token)
          this.storage.removeItem(FONT_INTENT_KEY);
        return saved;
      });
    this.queue = task;
    return task;
  }
}
