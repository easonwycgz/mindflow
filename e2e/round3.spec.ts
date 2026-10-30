import { test, expect, type Page } from "@playwright/test";
import example from "../contracts/mindflow-card-example-v1.json" with { type: "json" };
import type { StoredCard } from "../src/db";
import { readFile } from "node:fs/promises";
async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "体验示例" }).click();
  await expect(
    page.getByRole("heading", { name: example.title }),
  ).toBeAttached();
  await page.getByText("备份、设置与隐私", { exact: true }).click();
}
async function lock(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("mindflow-v1");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const connection = request.result,
            tx = connection.transaction("settings", "readwrite");
          let released = false;
          Object.assign(window, {
            r3Release: () => {
              released = true;
            },
          });
          const keep = () => {
            if (!released)
              tx.objectStore("settings").get("main").onsuccess = keep;
          };
          keep();
          tx.oncomplete = () => connection.close();
          resolve();
        };
      }),
  );
}
async function release(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { r3Release: () => void }).r3Release();
  });
}
test("R3 font: explicit committed status, real write lock Saving, rapid changes and reload", async ({
  page,
}) => {
  await start(page);
  const select = page.getByLabel("字号"),
    status = page.getByTestId("font-save-state");
  await select.selectOption("normal");
  await expect(status).toContainText("字号已保存");
  await lock(page);
  await select.selectOption("large");
  await expect(status).toContainText("正在保存");
  await expect(status).not.toContainText("字号已保存");
  await expect(page.locator(".app")).toHaveClass("app");
  await select.selectOption("normal");
  await select.selectOption("large");
  await release(page);
  await expect(status).toContainText("字号已保存：大字");
  await expect(page.locator(".app")).toHaveClass("app large");
  await page.reload();
  await page.getByText("备份、设置与隐私", { exact: true }).click();
  await expect(select).toHaveValue("large");
});
test("R3 font: refresh before transaction commit replays durable intent, not a false Saved", async ({
  page,
}) => {
  await start(page);
  await lock(page);
  await page.getByLabel("字号").selectOption("large");
  await expect(page.getByTestId("font-save-state")).toContainText("正在保存");
  await page.reload();
  await page.getByText("备份、设置与隐私", { exact: true }).click();
  await expect(page.getByLabel("字号")).toHaveValue("large");
  await expect(page.getByTestId("font-save-state")).toContainText(
    "字号已保存：大字",
  );
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("mindflow-font-intent-v1")),
    )
    .toBeNull();
});
test("R3 font: database error feedback, committed style preserved and retry succeeds", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    Object.assign(window, {
      r3RestorePut: () => {
        IDBObjectStore.prototype.put = original;
      },
    });
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "settings")
        throw new DOMException("synthetic write denied", "QuotaExceededError");
      return original.apply(this, args);
    };
  });
  await page.getByLabel("字号").selectOption("large");
  await expect(page.getByTestId("font-save-state")).toContainText(
    "字号保存失败",
  );
  await expect(page.locator(".app")).toHaveClass("app");
  await page.evaluate(() => {
    (window as unknown as { r3RestorePut: () => void }).r3RestorePut();
  });
  await page.getByRole("button", { name: "重试保存字号" }).click();
  await expect(page.getByTestId("font-save-state")).toContainText(
    "字号已保存：大字",
  );
});
test("R3 tree: deep keyboard return, repeat, arrow navigation and removed-node fallback", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: "知识树", exact: true }).click();
  const root = page.getByRole("button", {
    name: example.branches[0].title,
    exact: true,
  });
  await root.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const child = page.getByRole("button", {
    name: "一个两区域示意",
    exact: true,
  });
  await expect(child).toBeFocused();
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press("Enter");
    await expect(page.getByRole("region", { name: "节点内容" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "返回知识树" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(child).toBeFocused();
  }
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("button", { name: example.branches[1].title, exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(child).toBeFocused();
  await page.keyboard.press("Enter");
  // Synthetic DOM removal represents navigation changing while a body remains open.
  await page
    .locator('#tree-navigation button[data-node-id="b1-1"]')
    .evaluate((el) => el.remove());
  await page.getByRole("button", { name: "返回知识树" }).click();
  await expect(root).toBeFocused();
});
test("R3 legacy UI: 501 valid cards download all volumes, clear, atomic restore and exact comparison", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await page.getByRole("button", { name: "体验示例" }).click();
  await expect(
    page.getByRole("heading", { name: example.title }),
  ).toBeAttached();
  await page.evaluate(async (example) => {
    const canonical = (value: unknown): string =>
      Array.isArray(value)
        ? "[" + value.map(canonical).join(",") + "]"
        : value && typeof value === "object"
          ? "{" +
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
          : JSON.stringify(value);
    const cards: StoredCard[] = [];
    for (let i = 0; i < 501; i++) {
      const content = {
          ...example,
          title: "Legacy UI " + i,
        } as unknown as StoredCard["content"],
        digest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(canonical(content)),
        );
      cards.push({
        id: crypto.randomUUID(),
        hash: Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
        content,
        createdAt: 1,
        updatedAt: 2,
      });
    }
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("mindflow-v1");
      req.onsuccess = () => {
        const connection = req.result,
          tx = connection.transaction(
            ["cards", "reading", "settings"],
            "readwrite",
          );
        for (const name of ["cards", "reading", "settings"])
          tx.objectStore(name).clear();
        for (const c of cards) {
          tx.objectStore("cards").add(c);
          tx.objectStore("reading").add({
            cardId: c.id,
            favorite: true,
            section: "tree",
            nodeId: "b1-1",
            scroll: 99,
          });
        }
        tx.objectStore("settings").put({
          id: "main",
          fontSize: "large",
          lastCardId: cards[500].id,
        });
        tx.oncomplete = () => {
          connection.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, example);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Legacy UI 500", exact: true }),
  ).toBeAttached();
  await page.getByText("备份、设置与隐私", { exact: true }).click();
  await page.getByRole("button", { name: "生成分卷备份" }).click();
  await expect(
    page.getByRole("region", { name: "分卷下载" }).getByRole("button"),
  ).toHaveCount(3);
  const uploads = [];
  for (const label of ["下载迁移清单", "下载分卷 1", "下载分卷 2"]) {
    const waiting = page.waitForEvent("download");
    await page.getByRole("button", { name: label, exact: true }).click();
    const file = await waiting;
    uploads.push({
      name: file.suggestedFilename(),
      mimeType: "application/json",
      buffer: await readFile((await file.path())!),
    });
  }
  const payloads = uploads
    .slice(1)
    .map((f) => JSON.parse(f.buffer.toString()).payload);
  const expected = {
    cards: payloads
      .flatMap((p) => p.cards)
      .sort((a, b) => a.id.localeCompare(b.id)),
    reading: payloads
      .flatMap((p) => p.reading)
      .sort((a, b) => a.cardId.localeCompare(b.cardId)),
    settings: JSON.parse(uploads[0].buffer.toString()).settings,
  };
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open("mindflow-v1");
        req.onsuccess = () => {
          const connection = req.result,
            tx = connection.transaction(
              ["cards", "reading", "settings"],
              "readwrite",
            );
          for (const name of ["cards", "reading", "settings"])
            tx.objectStore(name).clear();
          tx.oncomplete = () => {
            connection.close();
            resolve();
          };
        };
      }),
  );
  await page.reload();
  await page.getByText("备份、设置与隐私", { exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "恢复全部分卷" }).click();
  await page.getByLabel("恢复分卷文件").setInputFiles(uploads);
  await expect(page.getByRole("status")).toContainText("分卷恢复成功");
  const actual = await page.evaluate(
    () =>
      new Promise<{
        cards: { id: string }[];
        reading: { cardId: string }[];
        settings: unknown;
      }>((resolve) => {
        const req = indexedDB.open("mindflow-v1");
        req.onsuccess = () => {
          const connection = req.result,
            tx = connection.transaction(
              ["cards", "reading", "settings"],
              "readonly",
            ),
            c = tx.objectStore("cards").getAll(),
            r = tx.objectStore("reading").getAll(),
            s = tx.objectStore("settings").get("main");
          tx.oncomplete = () => {
            connection.close();
            resolve({ cards: c.result, reading: r.result, settings: s.result });
          };
        };
      }),
  );
  actual.cards.sort((a, b) => a.id.localeCompare(b.id));
  actual.reading.sort((a, b) => a.cardId.localeCompare(b.cardId));
  expect(actual).toEqual(expected);
});
