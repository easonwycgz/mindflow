# Mindflow V1 QA evidence

Executed 2026-10-30 (Asia/Shanghai), cloud Linux; Node 24.19.0, npm 11.9.0, Chromium 154.0.8037.57. These results apply to this delivery's implementation, not a published production site. Final SHA is supplied in the delivery report (a commit cannot embed its own hash).

## Reproduction and actual results

| Command | Actual outcome |
| --- | --- |
| `npm ci` | Passed from committed lockfile |
| `npm run typecheck` | Passed, no TypeScript errors |
| `npm run lint` | Passed, no ESLint errors |
| `npm test` | 1 file, 10 tests passed; 0 failed/skipped |
| `npm run build` | Passed; SW generated, 10 precache entries, approximately 599 KiB total |
| `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e` | Final run: 12 passed in 22.9s, 0 failed/skipped; 6 scenarios each in desktop and mobile Chromium |
| `npm audit --omit=dev --json` | 0 known production dependency vulnerabilities |
| `cmp` root schema/example against contracts copies | Both byte-identical; original acceptance contract unchanged |

The complete install/typecheck/lint/unit/build/browser chain passed. After strengthening the backup rejection assertion and adding scroll persistence, typecheck/lint and all 12 E2E cases passed again. Browser HTML and failure traces are generated under ignored `playwright-report/` and `test-results/` and can be recreated. CI configuration runs the same checks but GitHub-hosted CI has not been observed yet.

### Unit and IndexedDB integration coverage (10 tests)

1. Both contracts remain byte-identical to originals.
2. Valid example accepted; missing/extra fields, wrong type/version, invalid URI rejected.
3. Duplicate node IDs, malformed and over-deep trees rejected.
4. Invalid JSON and >2 MiB input rejected.
5. Canonical hashes independent of object key order.
6. Import and dedup preserve existing content/favorite on failure.
7. Changed content becomes separate version, leaving old card intact.
8. Backup/restore roundtrip preserves content, reading node/section/scroll/favorite and settings.
9. Wrong version, mismatched hashes/checksum, missing reading records and duplicate cards rejected without mutation.
10. Simulated storage failure during restore rolls back earlier writes.

### Browser scenarios (6 × 2 viewports)

- File import, recursive child node, FAQ, search, favorite and node persistence across reload; duplicate/invalid imports preserve old card.
- HTML/script displayed as inert text; no remote image request and no script execution.
- Download backup, change favorite, restore downloaded file and confirm favorite; invalid backup rejection confirmed before checking preserved state.
- Production service worker controls page, browser network disabled, page reloaded and imported IndexedDB content readable with offline indicator.
- Random recommendation excludes current card, favorites filter, large font setting survives reload, no horizontal document overflow.
- Scroll offset saved then restored after reload.

## Visual inspection versus real-device validation

- Reviewed Chromium-rendered full-page desktop (1360px) and iPhone-sized (390px) screenshots: Chinese wrapping, controls and reading layout visually coherent. These are screenshot inspections of automated browser sessions, not a human Safari walkthrough.
- No real iPhone, no VoiceOver/manual accessibility session, no Safari home-screen installation, no iOS offline cold start or system eviction test executed.
- Playwright browser download attempt failed with HTTP 403 `Domain forbidden` at cdn.playwright.dev. System Chromium was used successfully. WebKit was not installed/run; `TEST_WEBKIT=1` remains an optional documented test command, not a passing result.

## Known limits and nonblocking warnings

- Plain-text rendering preserves Markdown marks; rich Markdown is intentionally unsupported.
- Changed imports coexist as separate cards; no destructive in-place replacement or merge UI.
- Restore limits: 40 MiB / 500 cards plus 50,000 JSON values. Large libraries may need smaller backups. Hashes detect accidental corruption, not malicious tampering; backups are not encrypted.
- Scroll writes are debounced 150 ms; an immediate process kill can lose the most recent movement. IndexedDB availability/eviction depends on browser storage; export regularly.
- Service-worker update UI exists, but cross-version migration/update installation has not been exercised on iOS. No background sync is promised.
- Build emits a >500 KiB chunk warning (main JS ~591 KiB / 185 KiB gzip) and third-party annotation warnings. They did not block build or offline E2E. npm reports deprecated transitive glob and ESLint 9; production audit is clean.
- Cloudflare headers were generated into dist but not validated on a deployed Pages site. Ajv static-schema runtime compilation requires CSP unsafe-eval; external connections, inline scripts and remote images remain blocked by deployment headers.

## Remote delivery and deployment

No Cloudflare credentials were present in environment configuration or variable names. No deployment was attempted and no public application URL exists. Deployment steps are in README. GitHub API repository inspection returned `Forbidden`; Git HTTPS read works. Branch push and PR creation results are reported in the final delivery and any appended notes below.

## Required iPhone acceptance

1. Deploy dist via HTTPS; in Safari import demo, wait for offline-ready, add to home screen.
2. Read summary/tree/FAQ, favorite, change text size, close and reopen; verify node and scroll restoration.
3. Enable airplane mode, force-quit, launch from home screen; read, search and switch cards offline.
4. Export/download backup; change data, restore backup; verify content, favorite, reading location and settings. Invalid JSON must preserve existing cards.
5. Check notch/home-indicator safe areas, long Chinese text, large font and VoiceOver; verify file picker/download/share behavior.
6. Install an update and confirm all local data survives. Record phone model, iOS version and outcomes before stable release.
