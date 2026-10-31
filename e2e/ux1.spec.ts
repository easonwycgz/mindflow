import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  syntheticCard,
  tree,
  legalCases,
  invalidCases,
} from "../tests/fixtures/ux1";
const upload = (value: unknown) => ({
  name: "ux1-fictional.json",
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(value)),
});
const snapshot = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{
        reading: {
          cardId: string;
          section: string;
          nodeId: string | null;
          scroll: number;
          favorite: boolean;
        }[];
        settings: { lastCardId: string; fontSize: string }[];
        cards: { id: string; content: { title: string } }[];
      }>((resolve, reject) => {
        const r = indexedDB.open("mindflow-v1");
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction(["cards", "reading", "settings"]);
          const cards = tx.objectStore("cards").getAll(),
            reading = tx.objectStore("reading").getAll(),
            settings = tx.objectStore("settings").getAll();
          tx.oncomplete = () => {
            db.close();
            resolve({
              cards: cards.result,
              reading: reading.result,
              settings: settings.result,
            });
          };
        };
      }),
  );
async function add(page: Page, value = syntheticCard()) {
  await page
    .getByLabel("导入卡片", { exact: true })
    .setInputFiles(upload(value));
  await expect(page.locator("article h2")).toHaveText(value.title);
  await page.waitForTimeout(80);
}
async function prepare(page: Page) {
  await page.goto("/");
  await add(page, syntheticCard({ title: "虚构 Alpha" }));
  await add(page, syntheticCard({ title: "虚构 Beta" }));
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const q = indexedDB.open("mindflow-v1");
        q.onerror = () => reject(q.error);
        q.onsuccess = () => {
          const db = q.result,
            tx = db.transaction(["cards", "reading", "settings"], "readwrite"),
            cards = tx.objectStore("cards").getAll();
          cards.onsuccess = () => {
            const a = cards.result.find(
                (c) => c.content.title === "虚构 Alpha",
              ),
              b = cards.result.find((c) => c.content.title === "虚构 Beta");
            tx.objectStore("reading").put({
              cardId: a.id,
              favorite: false,
              section: "tree",
              nodeId: "root-1",
              scroll: 600,
            });
            tx.objectStore("reading").put({
              cardId: b.id,
              favorite: false,
              section: "faq",
              nodeId: null,
              scroll: 800,
            });
            tx.objectStore("settings").put({
              id: "main",
              fontSize: "normal",
              lastCardId: b.id,
            });
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
  );
  await page.reload();
  await expect(page.locator("article h2")).toHaveText("虚构 Beta");
  await page.waitForTimeout(100);
}
test.beforeEach(async ({ page }, info) => {
  if (info.project.name === "ux1-large") {
    await page.addInitScript(() =>
      localStorage.setItem(
        "mindflow-font-intent-v1",
        JSON.stringify({ token: "ux1-large", fontSize: "large" }),
      ),
    );
  }
});
test("UX01: exact core and two points, complete original available and clean ending", async ({
  page,
}) => {
  await page.goto("/");
  const card = syntheticCard();
  await add(page, card);
  await expect(page.getByTestId("quick-core")).toHaveText(
    card.key_takeaways[0],
  );
  await expect(page.locator(".quick-points>li")).toHaveCount(2);
  await expect(page.getByText(card.summary, { exact: true })).toBeHidden();
  await expect(page.locator(".full-summary")).not.toHaveAttribute("open");
  await page.locator(".full-summary>summary").click();
  await expect(page.getByText(card.summary, { exact: true })).toBeVisible();
  await expect(page.locator(".full-summary ol>li")).toHaveText(
    card.key_takeaways,
  );
  await page.locator(".full-summary>summary").click();
  await page.getByRole("button", { name: "这次先到这里", exact: true }).click();
  await expect(
    page
      .getByRole("navigation", { name: "卡片列表" })
      .getByRole("button")
      .first(),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("UX01: one/two/twelve and long Unicode takeaways preserve complete conditions", async ({
  page,
}) => {
  await page.goto("/");
  for (const [name, c] of Object.entries({
    one: legalCases.one,
    two: legalCases.two,
    twelve: legalCases.twelve,
    long: legalCases.long,
    unicode: legalCases.unicode,
  })) {
    await add(page, { ...c, title: `合成 ${name}` });
    await expect(page.locator(".quick-points>li")).toHaveCount(
      Math.min(2, c.key_takeaways.length - 1),
    );
    if (name === "long") {
      await expect(page.getByTestId("quick-long")).toBeVisible();
      await page.locator(".long-takeaway>summary").first().click();
    }
    await expect(page.getByTestId("quick-core")).toContainText(
      c.key_takeaways[0],
    );
  }
});
test("UX02: discovery and temporary tree/FAQ/favorite/pagehide preserve persistent cursor and lastCard", async ({
  page,
}) => {
  await prepare(page);
  const before = await snapshot(page);
  const target = before.cards.find((c) => c.content.title === "虚构 Alpha")!;
  await page.getByRole("button", { name: "随机一张", exact: true }).click();
  await expect(page.locator("article h2")).toHaveText("虚构 Alpha");
  await expect(
    page.getByRole("button", { name: "30 秒摘要", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const y = await page
    .locator("article h2")
    .evaluate((el) => el.getBoundingClientRect().top);
  expect(y).toBeGreaterThanOrEqual(0);
  expect(y).toBeLessThan(30);
  const previewBaseline = await snapshot(page);
  expect(previewBaseline.reading.find((r) => r.cardId === target.id)).toEqual(
    before.reading.find((r) => r.cardId === target.id),
  );
  expect(previewBaseline.settings).toEqual(before.settings);
  await page.getByRole("button", { name: "知识树", exact: true }).click();
  await page.getByRole("button", { name: "合成父节点", exact: true }).click();
  await page.evaluate(() => scrollTo(0, 1200));
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "常见问题", exact: true }).click();
  await page.locator(".faq>summary").click();
  await page.getByRole("button", { name: "☆ 收藏", exact: true }).click();
  await page.evaluate(() => dispatchEvent(new Event("pagehide")));
  await page.waitForTimeout(200);
  const after = await snapshot(page);
  const expected = structuredClone(previewBaseline);
  expected.reading.find((r) => r.cardId === target.id)!.favorite = true;
  expect(after).toEqual(expected);
  await page.reload();
  await expect(page.locator("article h2")).toHaveText("虚构 Beta");
  await expect(
    page.getByRole("button", { name: "常见问题", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("UX02: continue restores old node; explicit from-here commits after real transaction", async ({
  page,
}) => {
  await prepare(page);
  await page.getByRole("button", { name: "随机一张", exact: true }).click();
  await page.getByRole("button", { name: "继续上次阅读", exact: true }).click();
  await expect(page.getByRole("region", { name: "节点内容" })).toContainText(
    "第 2 层正文",
  );
  await page
    .getByRole("navigation", { name: "卡片列表" })
    .getByRole("button")
    .filter({ hasText: "虚构 Beta" })
    .click();
  await page.getByRole("button", { name: "随机一张", exact: true }).click();
  await page.getByRole("button", { name: "常见问题", exact: true }).click();
  await page
    .getByRole("button", { name: "从这里继续（替换上次位置）", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "临时发现" }),
  ).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("已从这里继续");
  await page.reload();
  await expect(page.locator("article h2")).toHaveText("虚构 Alpha");
  await expect(
    page.getByRole("button", { name: "常见问题", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("UX02: continuous random and delayed native get cannot pull a later card to stale position", async ({
  page,
}) => {
  await prepare(page);
  const before = await snapshot(page);
  // Keep the actual readonly transaction alive while delaying its result. Delaying
  // only onsuccess after tx completion would violate Dexie's transaction precondition.
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.get;
    const descriptor = Object.getOwnPropertyDescriptor(
      IDBRequest.prototype,
      "onsuccess",
    )!;
    IDBObjectStore.prototype.get = function (
      ...args: Parameters<IDBObjectStore["get"]>
    ) {
      const r = original.apply(this, args),
        keepAlive = () => original.call(this, "__ux1_delay__");
      if (this.name === "reading")
        Object.defineProperty(r, "onsuccess", {
          configurable: true,
          set(handler: ((e: Event) => void) | null) {
            descriptor.set!.call(
              r,
              handler
                ? function (e: Event) {
                    const until = performance.now() + 200;
                    function spin() {
                      const ping = keepAlive();
                      ping.onsuccess = () => {
                        if (performance.now() < until) spin();
                        else handler!.call(r, e);
                      };
                    }
                    spin();
                  }
                : null,
            );
          },
          get() {
            return descriptor.get!.call(r);
          },
        });
      return r;
    };
  });
  await page
    .getByRole("button", { name: "随机一张", exact: true })
    .evaluate((button) => {
      for (let i = 0; i < 5; i++) (button as HTMLButtonElement).click();
    });
  await expect(page.locator("article h2")).toHaveText("虚构 Alpha");
  await page.waitForTimeout(500);
  const after = await snapshot(page);
  const id = before.cards.find((c) => c.content.title === "虚构 Alpha")!.id;
  expect(after.reading.find((r) => r.cardId === id)).toEqual(
    before.reading.find((r) => r.cardId === id),
  );
  expect(after.settings).toEqual(before.settings);
  expect(
    await page
      .locator("article h2")
      .evaluate((el) => el.getBoundingClientRect().top),
  ).toBeLessThan(30);
});
test("UX02: native abort of from-here is not saved; retry succeeds without losing favorite", async ({
  page,
}) => {
  await prepare(page);
  await page.getByRole("button", { name: "随机一张", exact: true }).click();
  await page.getByRole("button", { name: "☆ 收藏", exact: true }).click();
  const before = await snapshot(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    let once = true;
    Object.assign(window, {
      restoreUXPut: () => {
        IDBObjectStore.prototype.put = original;
      },
    });
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      const r = original.apply(this, args);
      if (this.name === "settings" && once) {
        once = false;
        r.addEventListener("success", () => this.transaction.abort(), {
          once: true,
        });
      }
      return r;
    };
  });
  await page
    .getByRole("button", { name: "从这里继续（替换上次位置）", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "临时发现" }),
  ).toBeVisible();
  expect(await snapshot(page)).toEqual(before);
  await page.evaluate(() =>
    (window as unknown as { restoreUXPut: () => void }).restoreUXPut(),
  );
  await page
    .getByRole("button", { name: "从这里继续（替换上次位置）", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("已从这里继续");
  expect((await snapshot(page)).reading.find((r) => r.favorite)).toBeTruthy();
});
test("UX03/05: original boundary order, all content, source combinations and empty caveats remain honest", async ({
  page,
}) => {
  await page.goto("/");
  for (const [name, card] of Object.entries({
    none: legalCases.noCaveats,
    one: legalCases.oneCaveat,
    long: legalCases.longCaveat,
    title: legalCases.titleSource,
    url: legalCases.urlSource,
    both: legalCases.bothSource,
  })) {
    await add(page, { ...card, title: `来源合成 ${name}` });
    await expect(page.locator("article footer")).toContainText(
      name === "url"
        ? "未提供原对话标题"
        : name === "title"
          ? "未提供原对话链接"
          : name === "both"
            ? "已记录来源链接"
            : "来源元数据缺失",
    );
    if (card.caveats.length) {
      await expect(page.getByTestId("caveat-preview")).toHaveText(
        card.caveats[0],
      );
      await page.locator(".boundaries details>summary").click();
      await expect(page.locator(".boundaries ol>li")).toHaveText(card.caveats);
    } else
      await expect(page.locator("article footer")).toContainText(
        "不表示内容不存在风险",
      );
  }
});
test("UX04: depth16 directions, one-operation summary, accurate path, focus and duplicate IDs across cards", async ({
  page,
}) => {
  await page.goto("/");
  const card = syntheticCard({ title: "合成十六层", branches: tree(16) });
  await add(page, card);
  await page.getByRole("button", { name: "知识树", exact: true }).click();
  await page.locator(".branch-preview>summary").first().click();
  await expect(page.locator(".branch-preview p").first()).toHaveText(
    card.branches[0].summary,
  );
  await page.getByRole("button", { name: "合成父节点", exact: true }).focus();
  for (let i = 1; i < 16; i++) {
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
  }
  const leaf = page.getByRole("button", { name: "合成节点 16", exact: true });
  await expect(leaf).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "节点内容" })).toBeFocused();
  await expect(
    page.getByRole("navigation", { name: "当前知识路径" }).locator("span"),
  ).toHaveCount(16);
  await page.getByRole("button", { name: "返回知识树", exact: true }).click();
  await expect(leaf).toBeFocused();
  await page.keyboard.press("Home");
  await expect(
    page.getByRole("button", { name: "合成父节点", exact: true }),
  ).toBeFocused();
  await add(
    page,
    syntheticCard({
      title: "相同 ID 不同卡",
      branches: [
        {
          id: "root",
          title: "新卡唯一根",
          summary: "新卡摘要",
          content: "新卡独有正文",
          children: [],
        },
      ],
    }),
  );
  await page.getByRole("button", { name: "知识树", exact: true }).click();
  await page.getByRole("button", { name: "新卡唯一根", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "当前知识路径" }),
  ).toHaveText("新卡唯一根");
  await expect(
    page.getByRole("region", { name: "节点内容" }),
  ).not.toContainText("合成节点 16");
});
test("B-ONLINE-001: paste/file classification, alert/status semantics, safe detail and transaction rollback", async ({
  page,
}) => {
  await prepare(page);
  await page.getByRole("button", { name: "随机一张", exact: true }).click();
  const before = await snapshot(page);
  await page.getByRole("button", { name: "粘贴 JSON", exact: true }).click();
  const input = page.getByRole("textbox", { name: "JSON 内容" });
  for (const sample of [
    { name: "syntax", value: null, code: "syntax" },
    ...invalidCases(),
  ]) {
    const text =
      sample.name === "syntax" ? "{bad" : JSON.stringify(sample.value);
    await input.fill(text);
    await page.getByRole("button", { name: "校验并导入", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("导入失败");
    await expect(page.locator(".import-error pre")).toBeHidden();
    expect(await snapshot(page)).toEqual(before);
    await expect(input).toHaveValue(text);
    await page
      .getByLabel("导入卡片", { exact: true })
      .setInputFiles({
        name: "invalid.json",
        mimeType: "application/json",
        buffer: Buffer.from(text),
      });
    await expect(page.getByRole("alert")).toContainText("导入失败");
    expect(await snapshot(page)).toEqual(before);
  }
  await page
    .getByLabel("导入卡片", { exact: true })
    .setInputFiles({
      name: "too-large.json",
      mimeType: "application/json",
      buffer: Buffer.alloc(2 * 1024 * 1024 + 1, 32),
    });
  await expect(page.getByRole("alert")).toContainText("容量超限");
  expect(await snapshot(page)).toEqual(before);
  await page
    .getByLabel("导入卡片", { exact: true })
    .setInputFiles(upload(syntheticCard({ title: "虚构 Alpha" })));
  await expect(page.getByRole("status")).toContainText("已存在");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await snapshot(page)).toEqual(before);
  await input.fill(JSON.stringify(syntheticCard({ title: "修正后合成卡" })));
  await page.getByRole("button", { name: "校验并导入", exact: true }).click();
  await expect(page.locator("article h2")).toHaveText("修正后合成卡");
});
test("CSP: newly rendered surfaces preserve inert raw text and never request external resources", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://localhost:4173")
      external.push(request.url());
  });
  const response = await page.goto("/");
  expect(response!.headers()["content-security-policy"]).toContain(
    "script-src 'self'",
  );
  expect(response!.headers()["content-security-policy"]).not.toContain(
    "unsafe-eval",
  );
  const raw =
    '<img src="https://example.invalid/pixel" onerror="window.uxPwned=1">';
  const c = syntheticCard({
    summary: raw,
    key_takeaways: [raw, "否定条件不能丢失。"],
    caveats: [raw],
    source: { chat_title: raw, chat_url: "javascript:alert(1)" },
  });
  await add(page, c);
  await expect(page.getByTestId("quick-core")).toHaveText(raw);
  await page.locator(".full-summary>summary").click();
  await expect(page.locator(".full-summary")).toContainText(raw);
  expect(await page.evaluate(() => "uxPwned" in window)).toBe(false);
  expect(external).toEqual([]);
  await expect(
    page.locator("article img,article script,article iframe"),
  ).toHaveCount(0);
});
test("offline and v1 backup during discovery retain old cursor through real restore", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName === "webkit",
    "actual iOS offline cold start remains NOT VERIFIED",
  );
  await prepare(page);
  await page.getByRole("button", { name: "随机一张", exact: true }).click();
  await expect(page.locator("article h2")).toHaveText("虚构 Alpha");
  const before = await snapshot(page);
  await page.getByText("备份、设置与隐私", { exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出完整备份", exact: true }).click();
  const downloaded = await pending;
  const bytes = await readFile((await downloaded.path())!);
  const envelope = JSON.parse(bytes.toString());
  expect(envelope.version).toBe(1);
  expect(envelope.payload.reading).toEqual(before.reading);
  await page.getByRole("button", { name: "恢复备份", exact: true }).click();
  await page
    .getByRole("button", { name: "选择备份并替换", exact: true })
    .click();
  await page
    .getByLabel("恢复备份文件")
    .setInputFiles({
      name: "synthetic-backup.json",
      mimeType: "application/json",
      buffer: bytes,
    });
  await expect(page.locator("article h2")).toHaveText("虚构 Beta");
  await page.waitForTimeout(300);
  expect(await snapshot(page)).toEqual(before);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("article h2")).toHaveText("虚构 Beta");
  await page.getByRole("button", { name: "随机一张", exact: true }).click();
  await expect(page.locator("article h2")).toHaveText("虚构 Alpha");
});
test("UX04: wide same-name siblings retain IDs, hidden ancestor focus and missing target fallback", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await add(page, { ...legalCases.wide, title: "合成宽树" });
  await page.getByRole("button", { name: "知识树", exact: true }).click();
  const root = page.getByRole("button", { name: "合成父节点", exact: true });
  await page.getByLabel("展开 合成父节点 的子节点", { exact: true }).click();
  const leaf = page.locator('button[data-node-id="root-4499"]');
  await leaf.click();
  await page.getByRole("button", { name: "返回知识树", exact: true }).click();
  await expect(leaf).toBeFocused();
  await page
    .locator("details[data-children]")
    .first()
    .evaluate((el) => {
      (el as HTMLDetailsElement).open = false;
    });
  await expect(root).toBeFocused();
  await page.getByLabel("展开 合成父节点 的子节点", { exact: true }).click();
  await leaf.click();
  await leaf.evaluate((el) => el.remove());
  await page.getByRole("button", { name: "返回知识树", exact: true }).click();
  await expect(root).toBeFocused();
  await page
    .locator("#tree-navigation button[data-node-id]")
    .evaluateAll((elements) => elements.forEach((el) => el.remove()));
  await page.getByRole("button", { name: "返回知识树", exact: true }).click();
  await expect(page.locator("#tree-navigation")).toBeFocused();
});
test("UX02: native settings write lock, font intent and random discovery preserve lastCardId", async ({
  page,
}) => {
  await prepare(page);
  const before = await snapshot(page);
  await page.getByText("备份、设置与隐私", { exact: true }).click();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("mindflow-v1");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result,
            tx = db.transaction("settings", "readwrite");
          let hold = true;
          Object.assign(window, {
            releaseUXLock: () => {
              hold = false;
            },
          });
          let ready = false;
          function spin() {
            const q = tx.objectStore("settings").get("main");
            q.onsuccess = () => {
              if (!ready) {
                ready = true;
                resolve();
              }
              if (hold) spin();
            };
          }
          spin();
          tx.oncomplete = () => db.close();
        };
      }),
  );
  await page.getByLabel("字号").selectOption("large");
  await expect(page.getByTestId("font-save-state")).toContainText("正在保存");
  await page.getByRole("button", { name: "随机一张", exact: true }).click();
  // A browser may serialize a newly requested read behind pending transactions.
  await page.evaluate(() =>
    (window as unknown as { releaseUXLock: () => void }).releaseUXLock(),
  );
  await expect(page.locator("article h2")).toHaveText("虚构 Alpha");
  await expect(page.getByTestId("font-save-state")).toContainText(
    "字号已保存：大字",
  );
  const after = await snapshot(page);
  expect(after.settings[0]).toEqual({
    ...before.settings[0],
    fontSize: "large",
  });
  expect(
    after.reading.find(
      (r) =>
        r.cardId ===
        after.cards.find((c) => c.content.title === "虚构 Alpha")!.id,
    ),
  ).toEqual(
    before.reading.find(
      (r) =>
        r.cardId ===
        after.cards.find((c) => c.content.title === "虚构 Alpha")!.id,
    ),
  );
});

test("B-ONLINE-001: native mid-import write failure rolls back cards/reading and retry works", async ({
  page,
}) => {
  await prepare(page);
  await page.getByRole("button", { name: "随机一张", exact: true }).click();
  await expect(page.locator("article h2")).toHaveText("虚构 Alpha");
  const before = await snapshot(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    Object.assign(window, {
      restoreUXAdd: () => {
        IDBObjectStore.prototype.add = original;
      },
    });
    let once = true;
    IDBObjectStore.prototype.add = function (
      ...args: Parameters<IDBObjectStore["add"]>
    ) {
      if (this.name === "reading" && once) {
        once = false;
        throw new DOMException(
          "synthetic import failure",
          "QuotaExceededError",
        );
      }
      return original.apply(this, args);
    };
  });
  const card = syntheticCard({ title: "合成失败重试" });
  await page
    .getByLabel("导入卡片", { exact: true })
    .setInputFiles(upload(card));
  await expect(page.getByRole("alert")).toContainText(
    "本机读取或数据库事务失败",
  );
  expect(await snapshot(page)).toEqual(before);
  await page.evaluate(() =>
    (window as unknown as { restoreUXAdd: () => void }).restoreUXAdd(),
  );
  await add(page, card);
  expect((await snapshot(page)).cards).toHaveLength(3);
});
