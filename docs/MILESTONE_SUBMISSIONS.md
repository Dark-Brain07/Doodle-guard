# Portal Milestone Submissions — v0.2.19 bundle

Three paste-ready submission drafts for
`https://portal.genlayer.foundation/#/builders/contributions`.

Submit them **one per week over three weeks**, not all at once — the
Builder Program rubric rewards consistent progress, and each of the
three items below is a distinct scoped feature per Portal's Milestone
categories. Fill in each Portal form's "Evidence" section with the
links listed below the draft.

---

## Milestone 1/3 — Reputation System (Loại 3c)

**Title**

```
Major Feature — Trust-Weighted Reputation System for NDA parties
```

**Type**: Major feature

**Summary**

> NDA Sentinel now maintains an on-chain reputation score for every
> address that touches the protocol. Confirmed reports earn +50,
> confirmed violations cost -100, appeal wins earn +100, and a false
> report (a report the appellate jury overturns) costs -75 while
> refunding both parties to their pre-report position. Scores drive
> four visible tiers (verified / trusted / newcomer / flagged) and
> per-address stats (reports submitted / confirmed / false, violations
> confirmed, appeals won). This gives future counterparties an
> objective signal before they stake against an unknown address, and
> makes spam-reporting economically self-limiting.

**Why this matters — GenLayer fit**

Solidity contracts have no way to detect a "false report" without an
external oracle, because false-report detection needs the AI appellate
verdict from `gl.eq_principle.prompt_comparative`. That verdict is what
triggers the reputation rollback on overturn — the whole loop only
closes because the adjudication AND the reputation update both live in
the same intelligent contract.

**Evidence**

- Contract diff: `contracts/nda_sentinel.py` — `REP_*` constants + storage
  block + `_rep_get` / `_rep_apply` / `_tier` / `_addr_key` + rep-update
  hooks inside `report_leak` and `appeal`, and new views
  `get_reputation` / `get_reputation_thresholds`.
- Tests: `tests/test_nda_sentinel.py` — five new tests including
  underflow-clamp and appeal-cycle rollback.
- Live contract: `0xa39218800F583BB35B553a34ff479197Dc6Ca7DE` on
  studionet (redeploy at the v0.2.19 build).
- Live app: `https://nda-sentinel.vercel.app` (reputation badge on NDA
  detail page + dashboard).
- Repo commit: (fill in after push)
- CHANGELOG entry: `CHANGELOG.md` § [0.2.19] → "Milestone A".

---

## Milestone 2/3 — Multi-source cross-reference verdict (Loại 1b)

**Title**

```
AI Enhancement — Multi-source cross-reference (primary URL + Wayback + Google) inside consensus
```

**Type**: AI enhancement / New contract functionality

**Summary**

> Previously the AI Jury saw only the reporter's suspect URL. It now
> derives two corroborating sources content-aware from that same URL
> and from the revealed keyword — a Wayback Machine snapshot to check
> historical presence, and a Google search for the first revealed
> keyword to check whether the "leaked" info was already indexed on
> the open web. The verdict now returns `sources_evaluated`,
> `sources_confirming`, and `cross_reference_notes`; the validator
> principle agrees on those numbers within ±1, so a bogus
> cross-reference claim cannot pass consensus. If the primary source
> is unreachable the verdict falls back to `inconclusive` — a
> corroborating source can only lower confidence, never fabricate a
> confirmation.

**Why this matters — GenLayer fit**

The whole upgrade lives inside a `leader_fn` executed under
`gl.eq_principle.prompt_comparative`. Every validator independently
fetches all three sources via `gl.nondet.web.render` and re-derives the
verdict — the consensus principle enforces they end up on the same
`verdict`, `prior_disclosure_found`, and `sources_confirming` bucket
before the tx finalises. This is exactly the class of multi-source AI
adjudication that Solidity + an oracle can only approximate at 10× the
latency and no privacy guarantee.

**Evidence**

- Contract diff: `contracts/nda_sentinel.py` — new `_safe_fetch` helper
  inside `leader_fn`; `wayback_url` + `google_url` derivation;
  extended prompt with three `EVIDENCE SOURCES` sections; updated
  validator principle rules (7)-(9).
- Live tx showing multi-source verdict metadata on the Explorer: (fill
  in from a real report after redeploy).
- Repo commit: (fill in after push).
- CHANGELOG entry: `CHANGELOG.md` § [0.2.19] → "Milestone B".

---

## Milestone 3/3 — On-chain event log + activity feed (Loại 4)

**Title**

```
New Feature — Append-only on-chain event log with per-NDA activity feed
```

**Type**: New contract functionality / UX

**Summary**

> Every state transition of the protocol — `nda_created`,
> `nda_activated`, `nda_cancelled`, `leak_reported`,
> `violation_confirmed`, `appeal_filed`, `appeal_overturned`,
> `appeal_upheld`, `verdict_finalized`, `nda_expired`, `withdraw` —
> now emits a stored `Event` record with `seq`, `kind`, `nda_id`,
> `actor`, `timestamp`, and a free-form JSON `meta`. Three paginated
> views (`get_events_count`, `get_events(from, limit)`,
> `get_events_for_nda(nda_id)`) let the frontend build a live activity
> feed with no off-chain infra. `meta_json` is deliberately schemaless
> so future event kinds can extend it without a migration.

**Why this matters — GenLayer fit**

The events are emitted **from inside** the same consensus that decided
the verdict, so a leak-report event and its violation-confirmed event
either both persist or neither does — no bespoke event bus, no dropped
telemetry, no observer race. On the frontend this is the difference
between "did that tx go through?" (poll `waitForTransactionReceipt`) and
a real live-feed narrative for every reviewer landing on the app.

**Evidence**

- Contract diff: `contracts/nda_sentinel.py` — `Event` dataclass;
  `events` DynArray + `events_by_nda_json` index; `_emit()` helper;
  emit calls in every state-transition path; three new views.
- Tests: `tests/test_nda_sentinel.py` — full-lifecycle event ordering,
  per-NDA filter, pagination bounds.
- Live app "Activity" tab on the NDA detail page.
- Repo commit: (fill in after push).
- CHANGELOG entry: `CHANGELOG.md` § [0.2.19] → "Milestone C".

---

## Global evidence bundle

The three milestones share this evidence header. Paste it once per
submission:

- Repository: <https://github.com/phu1271997/nda-sentinel-genlayer>
- Live app: <https://nda-sentinel.vercel.app>
- Contract (studionet, v0.2.19): `0xa39218800F583BB35B553a34ff479197Dc6Ca7DE`
- Full changelog: `CHANGELOG.md`
- Threat model + invariant proof: `SECURITY.md`
- Full test suite (22 tests, all green): `tests/test_nda_sentinel.py`
- Prior review response covered in `CHANGELOG.md § [0.2.18]`
