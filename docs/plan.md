# Development plan
1. Preserve contracts; implement bounded validation, content hashing, atomic import and backup restoration.
2. Implement local reading library, summary/tree/FAQ, search, favorites and persistent reading location.
3. Add PWA precaching, explicit update prompt, privacy controls and responsive accessible layout.
4. Run unit, IndexedDB integration and browser E2E; resolve defects; document deployment and real-device acceptance.
5. Commit implementation and attempt remote branch/PR publication.

## Delivery status

Stages 1–4 implemented and verified: 10 data tests and 12 Chromium browser cases pass; typecheck/lint/build pass. Architecture choices are in decisions.md. Stage 5: commit/push/PR results accompany final delivery. Cloudflare deployment and real iPhone acceptance require user infrastructure/device and remain explicitly unverified.

## Round 2 plan and status
- Reproduce QA-001 with the independent test and preserve the QA branch: done; original test failed before correction.
- Align capacity, add paste import, fix tree navigation/reading-first layout and safe gestures: implemented; regression validation in progress.
- Add plaintext warning, limited safe Markdown and standalone validation / strict CSP: implemented.
- Investigate exact PR failure: old API logs blocked by Forbidden; public job page available but detailed log route is 404. Do not equate local success with a diagnosed CI failure.
- Run complete clean-install check chain, push same development branch, inspect PR CI, record outstanding evidence for B.

Round 2 complete local chain: 17 data tests pass; 31 browser pass / 1 original capability skip; audit0. Feature commit a8178a6 pushed to the original branch, PR and push CI both SUCCESS. Historical QA-004 root cause remains blocked on original logs, explicitly unclosed. New candidate is for B to reassess, not a release approval.

## Round 3 targeted work
1. Read pinned B report32319f4 and copy three tests byte-identically; retain all QA branches/history.
2. Implement commit-aware settings patches, refresh intent replay and saving/error UI; add real write-lock, failure and concurrency tests.
3. Restore selected tree DOM focus with keyboard continuation/fallback; preserve deep-tree and scroll tests.
4. Provide bounded legacy501 transfer-set export/restore using unchanged v1 volumes, manifest and one transaction; test complete UI roundtrip and interruption/corruption.
5. Keep QA-008 partial and register the already-scoped V1.1 work. Run clean-install full regression, publish synthetic-only readable evidence, push same branch and inspect final matching PR/push CI.
6. Return new candidate to B; no independent Go decision, main merge or production deployment.

## Round 4 targeted work
- Read pinned B6e53ec9 report/evidence, preserve history and copy its two tests verbatim.
- Recover accessible historical step/source/lock facts; document CONFIRMED/LIKELY/NOT CONFIRMED and submit explicit gate decision request. User chose formal owner/B evaluation; no gate changed.
- Add bounded working-set migration with separate staging, a non-reader entry, unchanged v1 parts and constant-size chain root; keep old migration APIs/tests.
- Validate count/byte matrices, combined native2001/>40MiB stress, interruption/quota/refresh rollback and readable evidence.
- Clean-install all checks, same-branch commit, verify matching final PR/push CI; no main merge or production deployment.

## Round 5 targeted work
1. Fetch pinned B3752a12 report/evidence and reproduce R4-001 before editing; preserve all QA history and copy B's two test files verbatim.
2. Bind restored fields to original root/volume proof texts. Validate complete values at use, write those exact private values, and verify native target commit; legacy staging re-selected rather than trusted.
3. Fault-inject business metadata, contents/relationships/order, files/root/receipts, late batches and the actual add boundary. Retain quantity/byte/stress/refresh/quota coverage.
4. Add explicit one-file-at-a-time download fallback without Directory API or workspace duplication; validate actual files, cancellation and allocation failures. Retain environmental risk rather than promising every browser/disk.
5. Clean-install complete regression and production audit; publish synthetic-only readable logs and source hashes; same branch/PR with final matching push and PR CI. Return candidate to B, never main or production.

## Fifth-round P2 follow-up — only R5-001
- Read B's b250a86 report, evidence and tests; record R4-001 closed and permitted-download migration PASS without changing the passed persistence/integrity implementation.
- Reproduce both original browser wording failures; replace file-existence promises with request/unknown status, observable error classification and explicit user-reported blocked/cancelled feedback.
- Add targeted browser coverage for normal/unknown, real denial, cancellation, exceptions and retry. Run related data safety/browser regressions plus static/build/audit checks; keep actual developer counts separate from B's prior execution.
- Same feature branch/PR, publish readable synthetic-only evidence, verify matching final CI, return candidate to B and stop. No release/gate changes.
