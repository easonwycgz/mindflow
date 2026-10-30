# QA-004 Historical CI RCA — NOT CONFIRMED

2026-10-30（Asia/Shanghai）。历史证据调查，不重写第三轮已独立PASS的字号逻辑，也不修改旧QA结论。QA-004整体仍OPEN，既定历史唯一因果门槛没有被开发者降低。

## Case identification and recovered evidence

- Run: [41014649370](https://github.com/easonwycgz/mindflow/actions/runs/41014649370), pull_request, [job123928110503](https://github.com/easonwycgz/mindflow/actions/runs/41014649370/job/123928110503), step7 `npm run test:e2e`.
- Product SHA: `740b98bb0d6f0bf9214e12345bdb51b3e4d605fa`. Historical merge snapshot: `993122a706d40e978c1f5bed3f1ee130d4051854`; this round fetched it and `git diff --exit-code` confirmed src/, e2e/ and package-lock.json identical to the product SHA. This does not prove an unavailable runner filesystem or execution trace.
- Public job HTML recovered: setup, checkout, Node setup, npm ci, types/lint/data/build and browser install SUCCESS; E2E FAILURE. The page says “Sign in to view logs”.
- Historical test, per B's second/third-round report and user-provided log account: desktop `random recommendation excludes current card, favorites filter and large text fit`; after choosing large and reloading, expected large, received normal. This is **attributed historical evidence**, not a raw job log recovered by A this round. B reports11 original tests passed/1 failed and mobile counterpart passed.
- Recovery retry: `gh run view ... --log-failed` returned API Forbidden, output log0 bytes. Exact job-page step route `/easonwycgz/mindflow/commit/740b98bb0d6f0bf9214e12345bdb51b3e4d605fa/checks/123928110503/logs/7` returned HTTP404. These show inaccessible evidence, **not proof that logs expired or were deleted**.
- Original workflow did not upload HTML/trace artifacts. No original transaction/unload trace has been recovered. We did not fabricate an artifact, extract a token, bypass the proxy or disable TLS.

## Environment: known versus unknown

| Item | Evidence and confidence |
| --- | --- |
| Runner selector | CONFIRMED workflow uses ubuntu-latest; exact runner image/build at failure NOT CONFIRMED |
| Node | CONFIRMED configured24; exact runtime patch/flags NOT CONFIRMED |
| Dependency declarations | CONFIRMED original lock pins Playwright/test/core1.64.1, Dexie4.4.7, Vite7.3.7, React19.3.1; actual installed binary/runtime file hashes NOT CONFIRMED |
| Browser | CONFIRMED workflow installed Chromium through pinned Playwright; actual launched executable revision/hash/flags NOT CONFIRMED without logs/trace |
| Parallelism | CONFIRMED original Playwright workers1, fullyParallel false. This weakens a simultaneous-test-writer theory but does not exclude native DB scheduling, background work or another lifecycle issue |
| Cleanup | Fresh contexts per tests declared in runner; exact failing context database contents and prior cleanup timing NOT CONFIRMED |

## Timeline: no invented timestamps

| Order | Supported observation | Missing historical timing |
| --- | --- | --- |
| 1 | Test generated/imported two cards, selected first via random, favorited, filtered and selected large | Actual source DB snapshots and event timestamps |
| 2 | Historical font handler called asynchronous settings.put; old React state changed after its awaited promise | Request queued/success, transaction complete/abort times |
| 3 | Original test awaited selectOption then immediately reload; it did not await transaction completion | Whether unload preceded or followed commit, pending unrelated settings writes |
| 4 | Reopened UI assertion observed normal (B/user-provided historical account) | Whether normal came from pre-commit persisted state, a subsequent overwrite, read/load timing or another failing-context cause |

There is no supported clock interval between2 and3. A table of exact milliseconds would be fabricated.

## Causal classification

**CONFIRMED:** the old test did not synchronize with the asynchronous DB commit; second-round controlled native write locks reproduced the same symptom in old and then-current code, while waiting for completion persisted settings. Third-round independent tests prove the current commit-aware implementation survives locks, immediate refresh, request-success followed by transaction-abort, retry and concurrent patches. Current defect repair is PASS and remains unchanged this round.

**LIKELY:** an unload-before-commit window is a plausible explanation for the historical symptom. It reproduces the output and the old test permits the ordering. This is a supported mechanism, not identification of the actual failed run's ordering.

**NOT CONFIRMED:** that window was the sole cause of run41014649370. An unrelated captured-settings overwrite, read/load race, context state, scheduling/lifecycle difference or binary/environment difference cannot be excluded from the available historical record. Two normal30-repeat runs passing do not eliminate these possibilities; fixing a mechanism now does not prove it caused the old run.

We can exclude neither every competing cause nor their combination. Installation/build failure was excluded by step states; current CSP/Markdown/migration changes happened later and cannot explain an earlier failure. Workers1 excludes configured parallel test workers, but does not establish absence of asynchronous application/native concurrency. No unique-root-cause confidence percentage is defensible; classification remains NOT CONFIRMED.

## Relationship to the current repair

Third-round transactions, field patches, font-only intent replay and commit-status UI eliminate the independently confirmed pending-write mechanism and captured-snapshot overwrite risk in the tested implementation. Fourth-round migration changes do not modify src/settings.ts or the existing font handler/state lifecycle. Existing independent commit/abort and lock tests remain regression gates. This is present-day prevention evidence, not retrospective proof.

## Explicit acceptance-gate decision request (owner and B)

The original raw log/trace and precise commit/unload timing are not recoverable through the current access paths. Availability in another authorized account remains unknown. QA-004 stays OPEN under the unchanged second-round rule.

Please record one explicit project-owner/B decision:

1. **Retain the unique historical-cause requirement:** provide the original raw job/step logs and trace/runner metadata from an authorized account, or keep the gate OPEN while retrieval is attempted. Logs without transaction timing may still be insufficient for uniqueness.
2. **Formally revise the legacy RCA gate:** owner/B may explicitly accept the confirmed symptom + mechanistic repair + independent non-regression evidence as a new closure rule. The developer does not make this decision or relabel NOT CONFIRMED as CONFIRMED.

Until that decision, no independent acceptance, main merge or production deployment is authorized. This report requests a gate decision; it does not infer consent from silence.

## 本轮负责人请求的处理状态

2026-10-30，用户明确选择：**提交负责人/B正式评议新的关闭规则，评议前仍OPEN**。该选择是提交评议请求，不是已经批准新规则，也不是允许开发者宣布关闭。请B/负责人在独立验收记录中明确采纳/拒绝及新门槛；在此之前本RCA继续NOT CONFIRMED、QA-004整体OPEN。
