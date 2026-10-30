import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { db } from "./db";
import type { TransferFile } from "./volumes";
import {
  beginPagedRestore,
  commitPagedRestore,
  discardMigration,
  exportPagedMigration,
  listMigrationJobs,
  manifestName,
  readExportFile,
  stagePagedPart,
  type MigrationJob,
} from "./pagedMigration";
interface LocalDirectory {
  getFileHandle(
    name: string,
    options: { create: boolean },
  ): Promise<{
    createWritable(): Promise<{
      write(text: string): Promise<void>;
      close(): Promise<void>;
    }>;
  }>;
}
export function LargeMigration({
  disabled,
  onBusy,
  onRestored,
}: {
  disabled: boolean;
  onBusy: (value: boolean) => void;
  onRestored: () => Promise<void>;
}) {
  const [jobs, setJobs] = useState<MigrationJob[]>([]),
    [current, setCurrent] = useState<MigrationJob | null>(null),
    [notice, setNotice] = useState(""),
    [running, setRunning] = useState(false),
    [pendingDownload, setPendingDownload] = useState<{
      file: TransferFile;
      requested: boolean;
      accept: () => void;
    } | null>(null),
    [downloadProgress, setDownloadProgress] = useState({ count: 0, last: "" }),
    [page, setPage] = useState(0);
  const manifestInput = useRef<HTMLInputElement>(null),
    partsInput = useRef<HTMLInputElement>(null),
    controller = useRef<AbortController | null>(null),
    rejectDownload = useRef<((reason: Error) => void) | null>(null);
  async function refresh() {
    setJobs(await listMigrationJobs());
  }
  useEffect(() => {
    void refresh().catch(() =>
      setNotice("迁移暂存不可用；原库没有改动。可使用无需暂存空间的逐卷下载。"),
    );
  }, []);
  async function run(fn: () => Promise<void>) {
    setRunning(true);
    onBusy(true);
    controller.current = new AbortController();
    try {
      await fn();
    } catch (e) {
      setNotice(
        (e instanceof Error ? e.message : "迁移失败") +
          "。操作未完成；不会为腾空间而清空原库。已请求下载的部分文件请保留，缺少完成清单或任何分卷都不能恢复。",
      );
    } finally {
      rejectDownload.current?.(
        Error("本次下载快照已结束；未完成集合不能恢复，原库保留"),
      );
      rejectDownload.current = null;
      setPendingDownload(null);
      setRunning(false);
      onBusy(false);
      await refresh().catch(() => undefined);
    }
  }
  async function streamDownloads() {
    setDownloadProgress({ count: 0, last: "" });
    await run(async () => {
      setCurrent(null);
      await exportPagedMigration(db, undefined, {
        signal: controller.current!.signal,
        onProgress: (p) =>
          setNotice(
            `正在逐卷迁出：${p.cards} 卡 / ${p.parts} 卷；尚未生成完整清单`,
          ),
        sink: (file) =>
          new Promise<void>((resolve, reject) => {
            const signal = controller.current!.signal;
            let settled = false;
            const abort = () =>
              finish(Error("迁出已取消，已下载文件是不完整集合；原库保留"));
            const finish = (error?: Error) => {
              if (settled) return;
              settled = true;
              signal.removeEventListener("abort", abort);
              rejectDownload.current = null;
              setPendingDownload(null);
              if (error) reject(error);
              else resolve();
            };
            rejectDownload.current = finish;
            signal.addEventListener("abort", abort, { once: true });
            if (signal.aborted) {
              abort();
              return;
            }
            setPendingDownload({
              file,
              requested: false,
              accept: () => finish(),
            });
            setNotice(
              `等待下载 ${file.name}。这是下载请求，不代表磁盘保存已确认。`,
            );
          }),
      });
      setNotice(
        "全部分卷和完成清单已请求下载；磁盘保存尚未验证。请保留全部文件，重新选择清单和分卷完整校验后再迁移。原库未改动。",
      );
    });
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
  async function chooseDirectory() {
    try {
      const dir = await (
        window as unknown as {
          showDirectoryPicker: (options: {
            mode: string;
          }) => Promise<LocalDirectory>;
        }
      ).showDirectoryPicker({ mode: "readwrite" });
      await run(async () => {
        const job = await exportPagedMigration(db, undefined, {
          signal: controller.current!.signal,
          onProgress: (p) =>
            setNotice(`正在写入本地目录：${p.cards} 卡 / ${p.parts} 卷`),
          sink: async (file) => {
            const handle = await dir.getFileHandle(file.name, { create: true }),
              writer = await handle.createWritable();
            await writer.write(file.text);
            await writer.close();
          },
        });
        setCurrent(job);
        setNotice("目录导出完整完成。请保留清单和全部卷；原数据库没有改动。");
      });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "目录选择取消");
    }
  }
  async function addParts(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!current || !files.length) return;
    await run(async () => {
      let job = current;
      const order = (name: string) =>
        Number(/stream-(\d+)\.json$/.exec(name)?.[1] ?? -1);
      files.sort((a, b) => order(a.name) - order(b.name));
      for (const file of files) {
        if (controller.current!.signal.aborted)
          throw Error("已暂停验证，已验证卷保留；原库未改动");
        if (file.size > 8 * 1024 * 1024) throw Error("单卷最多 8 MiB");
        job = await stagePagedPart(job.id, {
          name: file.name,
          text: await file.text(),
        });
        setCurrent(job);
        setNotice(
          `已验证 ${job.parts}/${job.root?.totalParts} 卷，${job.cards} 卡；原库尚未替换`,
        );
      }
      if (job.state === "ready")
        setNotice("整套验证完成；确认后才会一次性替换原库。");
    });
  }
  const blocked = disabled || running;
  return (
    <details className="large-migration">
      <summary>超大旧库分页迁移</summary>
      <p>
        用于超过 2000 卡或 40 MiB 的合法旧库。每卷最多 500 卡 / 8
        MiB，不一次载入整库；原库在导出和验证阶段保留。文件未经加密，请保管清单和全部卷。
      </p>
      <button
        disabled={blocked}
        onClick={() =>
          void run(async () => {
            setCurrent(null);
            setPage(0);
            const job = await exportPagedMigration(db, undefined, {
              signal: controller.current!.signal,
              onProgress: (p) =>
                setNotice(`正在分页准备：${p.cards} 卡 / ${p.parts} 卷`),
            });
            setCurrent(job);
            setNotice("完整导出已准备。逐卷下载，完成清单最后生成。");
          })
        }
      >
        准备分页迁出
      </button>
      {"showDirectoryPicker" in window && (
        <button disabled={blocked} onClick={() => void chooseDirectory()}>
          直接导出到本地目录
        </button>
      )}
      <button disabled={blocked} onClick={() => void streamDownloads()}>
        逐卷下载（无需暂存空间）
      </button>
      <p>
        无目录 API
        或暂存配额不足时，可逐卷下载到设备文件中；每次只生成一卷，不复制整库到浏览器暂存。
        每卷请在 60
        秒内下载并确认，否则快照中止、原库保留。浏览器必须允许文件下载。
        完成清单最后生成；下载请求不等于磁盘保存成功，必须保留全部文件并重新完整验证。
        恢复仍需要足够暂存及事务空间，不得清空唯一原库腾空间。
      </p>
      {pendingDownload && (
        <section aria-label="无需暂存的逐卷下载">
          <p>{pendingDownload.file.name}</p>
          <button
            onClick={() => {
              try {
                download(pendingDownload.file.name, pendingDownload.file.text);
                if (!pendingDownload.requested)
                  setDownloadProgress((p) => ({
                    count: p.count + 1,
                    last: pendingDownload.file.name,
                  }));
                setPendingDownload({ ...pendingDownload, requested: true });
              } catch (e) {
                rejectDownload.current?.(
                  e instanceof Error ? e : Error("无法发起本地下载"),
                );
              }
            }}
          >
            下载当前文件
          </button>
          <button
            disabled={!pendingDownload.requested}
            onClick={pendingDownload.accept}
          >
            已保存当前文件，继续
          </button>
        </section>
      )}
      {downloadProgress.count > 0 && (
        <p data-testid="direct-download-progress">
          已请求下载 {downloadProgress.count} 个文件，最后为{" "}
          {downloadProgress.last}。
          中断时这些文件仍在设备下载位置；没有完整清单和全部卷不能恢复。
        </p>
      )}
      <p>
        暂存空间不足时，可在支持目录写入的桌面 Chromium
        直接导出；它不复制整库到浏览器暂存。之后可在有空间的新浏览器中恢复，不必先清空原库。当前目录功能未在
        Safari/iPhone 验证。
      </p>
      <button disabled={blocked} onClick={() => manifestInput.current?.click()}>
        选择分页迁移清单
      </button>
      <input
        hidden
        ref={manifestInput}
        aria-label="分页迁移清单"
        type="file"
        accept=".json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          void run(async () => {
            if (file.size > 16 * 1024) throw Error("清单过大");
            const job = await beginPagedRestore({
              name: file.name,
              text: await file.text(),
            });
            setCurrent(job);
            setNotice(
              `恢复暂存已打开：${job.parts}/${job.root?.totalParts} 卷；可分次选择剩余卷，刷新后可继续。`,
            );
          });
        }}
      />
      {current?.kind === "export" &&
        current.state === "ready" &&
        !current.direct && (
          <section aria-label="分页迁出下载">
            <button
              disabled={running}
              onClick={() =>
                void run(async () => {
                  const f = await readExportFile(current.id, 0);
                  download(f.name, f.text);
                })
              }
            >
              下载分页完成清单
            </button>
            {Array.from(
              { length: Math.min(20, Math.max(0, current.parts - page * 20)) },
              (_, i) => page * 20 + i + 1,
            ).map((index) => (
              <button
                disabled={running}
                key={index}
                onClick={() =>
                  void run(async () => {
                    const f = await readExportFile(current.id, index);
                    download(f.name, f.text);
                  })
                }
              >
                下载分页卷 {index}
              </button>
            ))}
            <button
              disabled={page === 0 || running}
              onClick={() => setPage((p) => p - 1)}
            >
              上一组卷
            </button>
            <button
              disabled={(page + 1) * 20 >= current.parts || running}
              onClick={() => setPage((p) => p + 1)}
            >
              下一组卷
            </button>
            <p>
              完整集合：{manifestName(current.setId)} 和 {current.parts}{" "}
              卷。缺少任意卷都不能恢复。
            </p>
          </section>
        )}
      {current?.kind === "restore" && current.state !== "complete" && (
        <section aria-label="分页恢复进度">
          <p>
            {current.parts}/{current.root?.totalParts} 卷，{current.cards}{" "}
            卡，状态 {current.state}。相同重复卷可重选，不同内容会拒绝。
          </p>
          <button
            disabled={blocked || current.state === "ready"}
            onClick={() => partsInput.current?.click()}
          >
            选择下一批分页卷
          </button>
          <input
            ref={partsInput}
            hidden
            multiple
            type="file"
            accept=".json"
            aria-label="分页迁移分卷"
            onChange={(e) => void addParts(e)}
          />
          <button
            disabled={blocked || current.state !== "ready"}
            onClick={() => {
              if (
                !window.confirm(
                  "所有分卷已验证。现在原子替换全部卡片、阅读状态和设置？失败会回滚；请保留原备份。",
                )
              )
                return;
              void run(async () => {
                const job = await commitPagedRestore(
                  current.id,
                  db,
                  undefined,
                  {
                    signal: controller.current!.signal,
                    onProgress: (p) =>
                      setNotice(`正在原子恢复：${p.cards} 卡；尚未提交成功`),
                  },
                );
                setCurrent(job);
                await onRestored();
                setNotice("分页恢复已完整提交成功。可保留或删除迁移暂存。");
              });
            }}
          >
            验证完成后原子替换
          </button>
        </section>
      )}
      {running && (
        <button onClick={() => controller.current?.abort()}>
          取消或暂停当前迁移
        </button>
      )}
      <p aria-live="polite" data-testid="paged-migration-state">
        {notice}
      </p>
      {jobs.length > 0 && (
        <details>
          <summary>继续或清理本机迁移暂存</summary>
          {jobs.map((job) => (
            <div key={job.id}>
              <span>
                {job.kind} · {job.cards} 卡 / {job.parts} 卷 · {job.state}
              </span>
              <button
                disabled={blocked}
                onClick={() => {
                  setCurrent(job);
                  setPage(0);
                  setNotice("已打开暂存。未自动替换原库；恢复需要显式确认。");
                }}
              >
                打开暂存 {job.setId.slice(0, 8)}
              </button>
              <button
                disabled={blocked}
                onClick={() => {
                  if (
                    window.confirm(
                      "只删除此迁移暂存；当前知识库不变。已下载文件不受影响。",
                    )
                  )
                    void run(async () => {
                      await discardMigration(job.id);
                      if (current?.id === job.id) setCurrent(null);
                      setNotice("已删除暂存，当前知识库未改动");
                    });
                }}
              >
                删除暂存 {job.setId.slice(0, 8)}
              </button>
            </div>
          ))}
        </details>
      )}
    </details>
  );
}
