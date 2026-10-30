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
