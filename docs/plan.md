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
