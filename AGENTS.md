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
