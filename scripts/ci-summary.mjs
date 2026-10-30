import { readFile, appendFile } from "node:fs/promises";
const sha = process.env.EVIDENCE_HEAD_SHA ?? "local";
let text = `## Synthetic regression evidence\n\nProduct head: ${sha}\n\nAll fixtures are public examples or synthetic. No browser backups, credentials or environment dumps are included. This is developer test evidence, not independent acceptance.\n`;
for (const name of ["static", "unit", "build", "e2e", "audit"]) {
  try {
    const log = await readFile(`ci-evidence/${name}.log`, "utf8");
    const clean = log.replace(/\u001b\[[0-9;]*m/g, "").slice(-80000);
    text += `\n### ${name}\n\n<details><summary>Read complete command output</summary>\n\n\`\`\`text\n${clean.replace(/```/g, "'''")}\n\`\`\`\n</details>\n`;
  } catch {
    text += `\n${name}: output not available; inspect prior failed step.\n`;
  }
}
if (process.env.GITHUB_STEP_SUMMARY)
  await appendFile(process.env.GITHUB_STEP_SUMMARY, text);
