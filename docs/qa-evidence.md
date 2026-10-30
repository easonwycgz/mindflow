# Mindflow V1 QA evidence

## Independent round-five targeted acceptance — f22d68c

B independently tested exact candidate `f22d68c3bed8e6ab23da2fb09373ac50c1c43124`; see [round-five independent report](independent-qa-report-round-5.md) and [synthetic raw outputs](evidence/round5/independent-validation.txt). Prior B tests were retained verbatim; production logic was not changed by B.

The fourth-round favorite corruption case now rejects and preserves the target. Full-field/proof faults, private-snapshot boundary races, cancellation and rollback passed the selected independent execution: 30 existing targeted data tests plus 4 new B boundary tests. The 30-case native browser selection, four paste/CSP checks and two new normal-download cases passed; two added download-policy wording assertions failed (P2 R5-001: failed downloads still described as residing on device). This is 36 browser passes / 2 failures across separate runs, not a full rerun of the developer's 75/1 suite.

R4-001 integrity P1 is PASS in the tested scope. No-Directory/zero-workspace-add-quota export actually downloaded 2001 cards, 54,301,665 data bytes, seven parts plus root, and restored the real files exactly in both Chromium projects. The 50.3MB/88.5MB and 2001/10001-card regressions passed. Conditional download/storage risk remains OPEN, QA-004 remains OPEN and historical RCA NOT CONFIRMED; no owner gate revision was supplied. QA-003 remains PASS and QA-008 PARTIAL. Overall No-Go for production; no merge/deployment, await owner decision.

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

## Second-round candidate (supersedes first-round limitations where fixed)

See [round2-handoff.md](round2-handoff.md) for exact QA mappings, changes, actual validation and remaining blockers. Clean-install chain completed: typecheck/lint/build PASS; unit/integration 17 PASS; browser 31 PASS / 1 pre-existing capability SKIP / 0 FAIL; production audit0. Strict CSP is now applied during production E2E and unsafe-eval removed. Original independent report/tests copied unchanged. No independent acceptance or real iPhone claim is made.

## Third-round candidate

[Round3 handoff](round3-handoff.md) records the pinned B report, actual persistence/focus/migration changes and scope. Clean-install local chain: 27 data PASS; Chromium desktop/mobile53 PASS /1 unchanged capability SKIP; types/lint/build PASS; production audit0. B's font contention and tree-focus tests remain byte-identical and now pass. Public synthetic-only logs and source hashes are in docs/evidence/round3, explicitly requested by the user to avoid artifact API access problems. Historical CI unique cause remains unconfirmed; no independent approval or production deployment is claimed.

## Round 4 targeted candidate

See round4-handoff.md, historical RCA and migration design. Whole local chain: data35 PASS; browser61 PASS /1 original capability SKIP /0 FAIL; types/lint/build PASS; audit0. New paging crosses count2001 and49,424,718 data bytes simultaneously, with refresh-resume/native interruption/quota rollback. Original settings/db/model/Markdown/CSP implementations unchanged. Public synthetic logs/metrics/hashes are in docs/evidence/round4. QA-004 historical unique cause NOT CONFIRMED; user requests formal owner/B gate evaluation, stillOPEN. Physical/platform residual migration risks remain explicit, not universal compatibility claims.

## Round 5 targeted developer validation — 2026-10-30 Asia/Shanghai

Pinned B3752a12 identified R4-001; reproduced before changes (fulfilled/targetChanged=true), then copied its two files byte-identically. Exact original file proofs now bind all staged metadata/content/reading/settings at use; destination writes the verified private values and acknowledges native complete. Existing font/focus/schema/CSP logic is unchanged.

Final clean-install chain passed: npm ci; typecheck; lint; 9 data files/65 tests PASS (original35+B6+new24, no skip/failure); production build; browser75 PASS/1 unchanged desktop capability SKIP/0 FAIL (original61+B6+new8); npm audit --omit=dev reports0 known production vulnerabilities. Full browser6.0min, data85.76s. New faults cover valid-metadata/content/ordering/relationships/proofs/root, coordinated corruption, late rollback, refresh retry and real add-boundary change. Native Chromium old combined2001/49,424,718-byte and B10001/21-parts,50,337,817/88,493,973-byte samples retain exact roundtrips.

No Directory API + blocked workspace adds: actual Chromium downloads2001cards/54,301,665 bytes/7parts then root, reselects real files and restores exact data; cancel and later Blob allocation failure preserve source and identify incomplete files. This is synthetic fault injection, not a filled physical disk/Safari/iPhone guarantee. Conditional environmental P1 remains; QA-004 remainsOPEN and historicalRCA NOT CONFIRMED. Developer repair does not approve R4-001 independently.

First native prototype exposed TransactionInactiveError despite fake-indexeddb passing; fixed the product lifetime, retained all old assertions. New test transport hit Playwright50MB/filename constraints; switched to actual named file paths, retained sizes and full-data comparisons. Diagnostics and final logs are public under docs/evidence/round5;50 source/config/test hashes bind final code. See round5-handoff.md and round5-staging-integrity-design.md. Final application SHA/PR head and matching push/PR CI links accompany the final handoff, not the prior QA commit. No main merge or production deployment.
