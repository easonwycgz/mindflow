# Round 3 compatibility and persistence design

## Settings lifecycle

`patchSettings` reads and updates the latest row within a readwrite transaction, and its promise resolves after the transaction commits. Card selection writes only lastCardId, font writes only fontSize. FontWriter serializes writes; revision tokens prevent stale queued intents from overwriting the latest request, including when a database lock delays request completion. React applies the committed font only after this completion. The select shows the requested value, while an adjacent live region explicitly says Saving / Saved / Failed. Failed writes do not claim success and can be retried. The selector remains usable during font saving to support rapid changes; restore/import operations cannot race a pending setting write.

A synchronous localStorage entry `mindflow-font-intent-v1` holds only `{token,fontSize}` before async writing begins. It is an intent, not a claim that IndexedDB committed, and contains no card data. Refresh before commit replays this idempotent preference into IndexedDB on startup. The journal is removed only after commit and only if its token is still latest. Transaction failure retains the intent and shows a failure. Journal failure is explicit and no async write is falsely acknowledged. An explicit successful backup restore supersedes any failed old font intent. If the OS evicts all browser storage or a user clears website data, neither journal nor database is guaranteed to survive; that is not claimed tested.

No arbitrary delay or sleep implements correctness. Lock tests keep a real transaction alive until an explicit test release (or page unload for the refresh case), observe Saving, then observe the actual committed status. Existing independent immediate-refresh tests remain unchanged.

## Legacy 501-card dependency analysis

Original v1 import had no library card-count cap, so 501 cards in the existing version-1 database are legitimate. The second-round 500 limit bounded normal backup/import but did not provide an upgrade path. The database schema/version is unchanged; opening it never truncates old cards.

The formal card schema has no cross-card identity field and forbids unknown properties. Branch IDs are local to their own complete card. `source.chat_url` is an inert provenance URI, not an application-resolved card foreign key. Actual application dependencies are:

- reading.cardId → the owning stored-card UUID;
- reading.nodeId → a branch of that same card;
- settings.lastCardId → one globally selected stored-card UUID;
- content hashes and metadata → the complete immutable card content.

This analysis is based on the unchanged schema and all current application references, not an assumption that all knowledge is unrelated. Each volume carries whole stored-card records and their complete reading records. A card/tree is never split. The global settings record is preserved in the manifest; each ordinary volume repeats fontSize and has lastCardId only if that card is in that volume. Global relationships are rechecked after assembly.

## Packaging without changing the v1 backup schema

The existing single-file `backup` / `restore` behavior and envelope `{version:1,checksum,payload:{cards,reading,settings}}` remain unchanged. All previous single-backup tests still run, including the historical diagnostic that single backup rejects501 cards. A **separate transfer-set manifest**, not a new field in a card or backup, records set UUID, ordered filenames, each complete file's hash/count, total count and original settings. Each part is itself an ordinary valid v1 backup. The UI generates explicit download buttons for the manifest and all parts; no multiple-download permission or server upload is required.

Restore uses a dedicated multi-file picker for the manifest and every part. File-picker order is irrelevant; the manifest's contiguous part sequence is authoritative. Missing, duplicate, swapped, mixed-set, corrupt, unexpected or wrong-setting parts fail validation. Hashes detect accidental modification, not a malicious party who can rewrite the complete manifest; they provide no encryption or authentication. Plaintext warnings apply to every file.

All files, per-card bounds, checksums, local references, cross-volume UUID/hash uniqueness, total count and global settings references are checked before writes. A single three-store readwrite transaction replaces the complete library; any late storage error rolls back cards, reading and settings together. Single-volume recovery of a transfer part is possible through the existing restore but intentionally restores only that part; UI instructions require **恢复全部分卷** to migrate the whole library.

## Resource limits and remaining boundaries

- Normal new import and single-file backup: existing500-card /40MiB budget, with conservative reading metadata headroom.
- Transfer set: at most2000 cards, at most16 parts, at most8MiB each, **at most40MiB aggregate including manifest**; aggregate memory budget is not multiplied by the part count. Single-card 2MiB, depth16 and50,000-value limits remain unchanged. The increased migration count handles501 without removing bounds. Existing settings/reading headroom remains reserved.
- Parsing/validation runs over bounded input; full assembly and validation use memory before one atomic transaction. Memory has several representations (file strings, parsed records and canonical hash strings), as in existing40MiB restore. Real iPhone low-memory behavior is not verified; smaller libraries are recommended until device testing. Limits fail explicitly with original data untouched, never truncate.
- Existing libraries beyond these migration bounds are not silently accepted; a streaming/staged migration would require a separately reviewed design and crash recovery tests. This candidate claims a verified501-card path, not unlimited migration.
- No formal protocol/schema changes, backend, AI API, upload, unsafe-eval or weakened CSP.
