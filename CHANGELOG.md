# Changelog

All notable changes to NDA Sentinel are tracked here. The format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/) for the contract pragma line.

Every entry lists the concrete files touched and cross-references the
resubmission-review feedback item(s) it addresses.

---

## [0.2.19] — 2026-07-31 — Reputation + multi-source cross-reference + event log

Bundles three new capabilities. Each maps to one Portal milestone
submission per the Builder Points rubric (Loại 3c, 1b, 4).

### Milestone A — Reputation system (Loại 3c)

- `reputation_score: TreeMap[str, u256]` keyed by lowercase address hex
  (R19 policy). Baseline 1000, clamped at 0.
- `reputation_initialized[key]` lets `_rep_get()` return baseline lazily
  without a write so views stay cheap.
- Deltas: +50 on confirmed report, -100 on confirmed violation, +100 on
  overturn win, -75 on false report. Overturn also rolls back the two
  deltas the original report applied, so a proven-innocent appellant
  and their reporter net out to the correct final position.
- Per-address counters: `reporter_reports_count`, `reporter_confirmed_count`,
  `violator_confirmed_count`, `overturn_wins_count`, `false_report_count`.
- Views: `get_reputation(user)` returns `{score, tier, baseline, ...}` as
  JSON; `get_reputation_thresholds()` exposes the tuning constants.
- Tiers: `verified` (≥ 1200), `trusted` (≥ 1050), `newcomer` (default),
  `flagged` (< 800).
- 5 new tests: baseline, confirmed-report reward, overturn rollback,
  threshold constants, underflow-clamp under 11 consecutive slashes.

### Milestone B — Multi-source cross-reference verdict (Loại 1b)

- `report_leak` now fetches THREE sources per report inside `leader_fn`
  (drop-in — no ABI change):
  - `PRIMARY` = user-supplied suspect_url (up to 6 000 chars).
  - `WAYBACK` = `https://web.archive.org/web/*/{suspect_url}` snapshot,
    used to detect prior public disclosure.
  - `GOOGLE` = search for the first revealed keyword, used as a second
    prior-disclosure signal.
- Failed corroborating fetches degrade to `null` — the primary source
  failing still forces the verdict to `inconclusive`, but a corroborating
  source failing only lowers confidence (rule (7)+(8) in the validator
  principle).
- New response fields: `sources_evaluated`, `sources_confirming`,
  `cross_reference_notes`. Validator principle now agrees on
  `sources_confirming ± 1` too, so a bogus cross-reference claim can't
  ride through consensus.

### Milestone C — Event log + notifications (Loại 4)

- `events: DynArray[Event]` append-only log; every state transition emits
  one event via `_emit(kind, nda_id, actor, meta)`.
- 11 event kinds: `nda_created`, `nda_activated`, `nda_cancelled`,
  `leak_reported`, `violation_confirmed`, `appeal_filed`,
  `appeal_overturned`, `appeal_upheld`, `verdict_finalized`,
  `nda_expired`, `withdraw`.
- Views: `get_events_count()`, `get_events(from_seq, limit)` (paginated,
  100/page cap), `get_events_for_nda(nda_id)`.
- `meta_json` is a free-form JSON string so downstream consumers can
  extend without a schema migration.
- 3 new tests covering lifecycle ordering, per-NDA filter, and pagination
  bounds. Full suite: 19 → 22 tests, all green.

### Tests
- Full contract test suite grew from 14 → 22 (all green).

### Redeploy required
`v0.2.18` (`0x10562A17…6F09`) does not have the new views or the event
log. Redeploy `contracts/nda_sentinel.py` on studionet and update
`NEXT_PUBLIC_CONTRACT_ADDRESS` before shipping the frontend build.

---

## [0.2.18] — 2026-07-30 — Resubmission-review fixes + wallet UX overhaul

### Contract — `contracts/nda_sentinel.py`

#### Deadline protection completeness
- **Reject leak reports on expired NDAs.** `report_leak` now hard-rejects
  reports where `_now() >= expiry_timestamp`. Previously a leak reported one
  second past expiry was accepted because status was still `"active"`, which
  let a reporter slash a stake that should have been withdrawable via
  `expire_and_withdraw`.
- Reason: "deadline and replay protections" — review item.

#### Replay protection completeness
- **Reset `appeal_submitted[nda_id]` on overturned verdict.** The per-verdict
  replay guard used to persist across the overturn transition, permanently
  locking any legitimate future violator on the same NDA out of appeal. The
  overturn path now clears the flag together with `suspect_url` and
  `verdict_json`, giving the NDA a clean slate.
- New regression test: `test_replay_across_two_verdict_cycles`.
- Reason: "deadline and replay protections" — review item.

#### Collateral restoration correctness
- **Wipe stale accusation artifacts alongside stake restoration.**
  `suspect_url` and `verdict_json` are cleared when a verdict is overturned,
  matching the reset of `violator`, `reporter`, and `appeal_deadline`.
- **Underflow-safe stat rollbacks.** `total_violations_confirmed` and
  `total_value_slashed` are decremented with an explicit guard so that a
  future refactor cannot cause a wrap-around.
- Reason: "collateral restoration" — review item.

#### Complete the appeal and reward call paths
- **New `finalize_verdict(nda_id)`** with relaxed authorisation: callable by
  reporter, either party of the NDA, or any address after a second
  `APPEAL_WINDOW_SECONDS` rescue window. This closes the previously
  incomplete path where the non-violator's 17 % compensation share was
  stranded if the reporter never returned.
- **`claim_reporter_reward` becomes an alias** for the same internal logic
  so external callers built against the pre-0.2.18 ABI still work.
- Reason: "complete the appeal and reward call paths" — review item.

#### Payment-conservation invariants
- **New view `get_nda_liabilities(nda_id)`** exposes `active_stakes +
  escrows + party_withdrawables + treasury` as a single number so the
  conservation invariant is queryable from tests and from the UI.
- **New counters** on `get_stats`: `total_appeals_overturned`,
  `total_appeals_upheld`, `total_report_fees_collected`.
- Reason: "add payment-conservation tests" — review item.

### Tests — `tests/test_nda_sentinel.py`

- Added `test_report_rejected_after_nda_expiry`.
- Added `test_non_reporter_party_can_finalize_after_window`.
- Added `test_replay_across_two_verdict_cycles`.
- Added `test_liabilities_invariant_across_lifecycle` (upheld path).
- Added `test_liabilities_invariant_on_overturned_lifecycle` (overturn path).
- Added `test_new_stats_counters_track_appeal_outcomes`.
- Test suite grew from 7 → 14 tests. All green.

### Frontend — wallet layer (R21–R24 compliance)

- **MetaMask is now the primary signer.** `frontend/lib/genlayer.ts` was
  rewritten to expose live-binding `client` / `activeAddress` / `walletMode`
  that flip at runtime when the user connects MetaMask, with the local
  burner kept as a demo-only fallback (labelled as such in the UI).
- **`ensureStudionetChain()`** calls `wallet_switchEthereumChain` and
  auto-registers the network via `wallet_addEthereumChain` on `4902` /
  `-32603` (R23).
- **Chain id read from `studionet.id`** — no hard-coded literal (R23).
- **`ensureCorrectChainBeforeWrite()`** guards every write path.
- **Session restoration** on page load — MetaMask re-attaches silently
  without a new prompt.
- **Reactive UI** — `WALLET_CHANGED_EVENT` dispatched on connect / account
  change so the address chip and per-page dashboards refresh in place.

### Frontend — UX polish

- Every write handler exposes the returned transaction hash with a link to
  `https://genlayer-explorer.vercel.app/tx/…` so reviewers can verify tx
  finality on-chain.
- Wizard shows a copy explaining consensus latency (30 s – 3 min) so a
  hanging spinner is not misread as a bug.
- "Claim Reward" surface renamed to "Finalize Verdict" for non-reporter
  parties, reflecting the relaxed contract auth.

### Docs

- Added `CHANGELOG.md` (this file).
- Added `SECURITY.md` — threat model, escrow invariant, and audit checklist.
- README updated to `v0.2.18` and points to `CHANGELOG.md` for detail.

---

## [0.2.17] — 2026-07-17 — Resubmission — new contract + accounting fixes

- Full-slash-escrow pattern; overturn restores collateral without
  double-counting; reward + compensation atomic.
- Deployed at `0x10562A17a26D02A1591F49F3013D66e1bBCc6F09`.

## [0.2.16] — Earlier — Initial resubmission

- Pinned pragma to `v0.2.16`; initialised all `u256` scalars in `__init__`.

## [0.1.0] — Initial submission

- First cut of NDA Sentinel dApp: contract + wizard + Vercel deploy.
