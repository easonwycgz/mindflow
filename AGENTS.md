# Mindflow engineering constraints
- Keep the v1 JSON protocol unchanged. contracts/ copies must remain byte-identical to the original root schema and example.
- Local-only data: IndexedDB; no accounts, AI API, analytics, cloud database, remote images or private-card uploads.
- Never commit private cards, backups, .env or build/test artifacts. Deploy only dist/.
- Validate imports before transactional writes; preserve existing data on every failure. Content and reading state are separate.
- Run typecheck, lint, unit/integration tests, production build and Playwright. Record actual outcomes in docs/qa-evidence.md; never claim iPhone testing without a real device.
- Use the existing isolated checkout; do not create worktrees unless requested.

## Round 2 regression constraints
- Preserve independent QA branch/commit as evidence. Copied independent tests must remain byte-identical; do not loosen their assertions.
- Apply one library capacity policy to import/export/restore, preserving per-card safety limits and atomicity.
- Ajv runtime compilation is forbidden; regenerate the standalone validator from contracts. Do not reintroduce unsafe-eval.
- Test the actual CSP in production E2E. Preserve desktop/mobile coverage, offline checks and native vertical touch behavior.
- Distinguish old CI log access blockers, current candidate CI outcomes and independent acceptance. Never claim B approved this candidate.

## Round 3 evidence and compatibility
- Preserve B's round-2 test copies byte-for-byte and every previous QA report; do not merge/write QA branches.
- Settings may acknowledge Saved only after the IndexedDB transaction commits. A tiny localStorage font-intent journal may be used solely to resume an interrupted setting write; cards remain in IndexedDB.
- Single backups retain the v1 envelope and 500-card limit. Transfer sets use unchanged v1 volumes plus a separate packaging manifest; validate the whole bounded set before one restore transaction.
- Explicit user-authorized exception: sanitized, synthetic-only plain-text validation logs and source hashes may be committed under docs/evidence/round3 for public read access. Never commit real user content, browser backups, credentials, environment dumps or raw private traces.

## Round 4 targeted constraints
- Keep current font/focus/Markdown fixes and schemas unchanged; retain pinned B tests verbatim.
- Large migration must not load the whole library or all file texts into JavaScript. Use the dedicated migration.html entry for large data.
- Source snapshots are readonly; incomplete export has no completion manifest. Stage all restore parts before one atomic destination transaction; never auto-promote on startup.
- Separate migration workspace may be discarded without touching source/destination library. Origin-quota failure must retain originals and offer direct local-directory export where supported.
- User-authorized synthetic-only text/metrics/source hashes are also permitted under docs/evidence/round4; historical evidence files remain unchanged.
- Historical QA-004 unique RCA remains NOT CONFIRMED unless recovered evidence proves it; gate changes require an explicit owner/B decision.

## Round 5 integrity and evidence
- Restore readiness is never an integrity proof. Preserve exact original manifest/volume texts, bind complete cards/reading/settings to the manifest chain, and write the same private values verified at use; never re-query mutable rows for the destination write.
- Pre-fix restore staging without original-file proofs must be rejected and re-staged from user files, without clearing the library. Keep all earlier tests and pinned B round-4 tests byte-identical.
- No-workspace export may use explicit per-file local downloads with the same readonly snapshot/parts/root. A download request or user acknowledgement is not proof of disk persistence. Never delete source data to free quota; preserve and label incomplete files.
- Synthetic-only text logs/source hashes are permitted under docs/evidence/round5 by the user's explicit evidence request. No real backups, secrets, environment dumps or private traces.
- R4-001 is a developer repair candidate pending B's independent verdict; conditional storage/platform risk and QA-004 OPEN are not closed by developer tests.

## Fifth-round P2 follow-up
- B's pinned fifth-round QA commit b250a868757cecd9945b436a0011fef98f189ad6 supersedes the earlier pending verdict: R4-001 PASS/CLOSED; private snapshots and permitted-download/no-workspace migration PASS in the independently tested scope. Do not reopen or refactor that mechanism for wording.
- R5-001 is the only code-fix scope: download request != browser acceptance != completed download != saved file. With no browser receipt, always state uncertainty. Distinguish observable exceptions from user-reported blocked/cancelled downloads; no fabricated automatic detection.
- Conditional P1 OPEN; historical RCA NOT CONFIRMED; QA-004 OPEN; QA-003 PASS; QA-008 PARTIAL; release NO-GO. No main merge or production deployment. Stop development after handing the new candidate to B.
- Keep B's fifth-round test copies byte-identical and all old reports/evidence unchanged. Synthetic-only text logs and source fingerprints are permitted under docs/evidence/round5-p2 for this user-requested follow-up.
