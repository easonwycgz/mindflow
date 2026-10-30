import { useState } from "react";
import { createRoot } from "react-dom/client";
import { LargeMigration } from "./LargeMigration";
import "./style.css";
function MigrationPage() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <div className="app">
      <header>
        <div className="brand">◈ Mindflow · 本地迁移</div>
      </header>
      <main>
        <h1>独立迁移页</h1>
        <p>
          本页不载入整库内容。原数据库在备份和验证期间保留，只有全部验证完成并确认后才替换。文件未经加密，不上传服务器。
        </p>
        <LargeMigration
          disabled={busy}
          onBusy={setBusy}
          onRestored={async () => {
            setMessage(
              "分页恢复已完整提交。请保留清单和全部分卷；本页可继续导出验证，不会自动清空数据。",
            );
          }}
        />
        <p aria-live="polite">{message}</p>
        <a className="button" href="/">
          返回普通阅读器
        </a>
        <p>
          普通阅读器仍会加载全库；极大库请优先在本页迁出到有足够空间的环境。
        </p>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<MigrationPage />);
