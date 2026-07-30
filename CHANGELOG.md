# Changelog

All notable changes to NDA Sentinel are tracked here. The format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/) for the contract pragma line.

Every entry lists the concrete files touched and cross-references the
resubmission-review feedback item(s) it addresses.

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
