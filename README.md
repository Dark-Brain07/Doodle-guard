# DoodleGuard

Trustless NDA enforcement dApp on GenLayer. An AI Jury reads the
suspect URL directly on-chain and reaches consensus on whether protected
information was disclosed; the smart contract atomically slashes and
distributes stakes based on the verdict, with a full appeal cycle.

- **Live App**: <https://doodle-guard.vercel.app>
- **Class Name**: `DoodleGuard`
- **Contract file**: [`contracts/doodle_guard.py`](contracts/doodle_guard.py)
- **Contract pragma**: `v0.2.19`
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
- **Security model**: [SECURITY.md](SECURITY.md)
- **Architecture deep-dive**: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## 🔗 Deployed Contract

| Network    | Address | Explorer |
|------------|---------|----------|
| studionet  | `0x045A8206d69569aceB74F53D5d8c9Eb3A398AD4b` (v0.2.19) | [Open in Studio](https://studio.genlayer.com/?import-contract=0x045A8206d69569aceB74F53D5d8c9Eb3A398AD4b) |

Prior addresses (superseded): `0x817422E7...41dd`, `0xa39218…a7DE` (v0.2.18, 2026-07-30),
`0x10562A17…6F09` (v0.2.17, 2026-07-17), `0x42969f64…F2e0` (2026-06-18,
wiped by studionet reset). See
[`deployment/deployed_addresses.json`](deployment/deployed_addresses.json)
for provenance.

## Why GenLayer

Traditional NDAs cost $200k – $2M and take 18–36 months to enforce.
DoodleGuard replaces that with:

- **On-chain suspect-URL fetching** (`gl.nondet.web.render`) — no oracle
  required.
- **On-chain LLM adjudication** (`gl.nondet.exec_prompt` inside
  `gl.eq_principle.prompt_comparative`) — validators agree on the verdict
  and slashing-critical scores, not on the specific wording of reasoning.

Neither part of that loop exists on Solidity or any other L1. Remove
either, and the protocol collapses back into a court-of-law dependency —
this is the "GenLayer fit" test in the Builders rubric.

## Architecture (high-level)

```text
  [ Party A & Party B ]
           |
     (1) Commit sha256(keyword + salt) hashes on-chain
     (2) Stake GEN into escrow
           |
  +-------------------+        (4) Validators independently
  | DoodleGuard       | ------ fetch suspect_url via
  | (studionet)       |        gl.nondet.web.render
  |                   | <----- get their own copy of the page
  +-------------------+
           |
     (3) A party reports leak + salt
           |
    [ AI Jury via prompt_comparative ]
       -> agrees on verdict + responsible_party + prior_disclosure
       -> escrow split 80 / 17 / 3 to reporter / non-violator / treasury
       -> violator can appeal within 7 days, stake at risk
```

## Repository layout

```
contracts/          # Intelligent Contract Python
frontend/           # Next.js 16 App Router dApp
tests/              # gltest suite (14 tests, all green)
docs/               # ARCHITECTURE, DETECTION_RUBRIC, ECONOMICS, PRIVACY
deployment/         # deployed_addresses.json
CHANGELOG.md        # semver-tagged history of contract + frontend changes
SECURITY.md         # threat model, invariants, audit checklist
```

## Core Protocol Upgrades

Complete history is in [CHANGELOG.md](CHANGELOG.md). Highlights for the
current version (**v0.2.18** — 2026-07-30):

1. **Deadline gap closed**: `report_leak` now rejects reports on NDAs past
   `expiry_timestamp`.
2. **Replay guard reset on overturn**: a new legitimate accusation on a
   previously-overturned NDA can still be appealed by its new violator.
3. **Complete finalize path**: `finalize_verdict(nda_id)` callable by
   reporter, either party, or anyone after a rescue window — the
   non-violator's 17 % compensation share is no longer stranded when the
   reporter walks away.
4. **Conservation invariant**: `get_nda_liabilities` exposes
   `active_stakes + escrows + party_withdrawables + treasury`, exercised
   by two new lifecycle tests.
5. **Frontend wallet compliance (R21–R24)**: MetaMask is the primary
   signer; `wallet_switchEthereumChain` fires on connect; chain id is read
   from `studionet.id`; the local burner is kept as a demo-only fallback
   with a big amber warning.

## Step-by-Step Deploy Guide (studionet)

1. Open <https://studio.genlayer.com/contracts>.
2. **Settings → Reset Storage → Confirm** (per the deploy cheatsheet).
3. Hard refresh (Cmd + Shift + R).
4. New Contract → paste `contracts/doodle_guard.py`.
5. Click Deploy (no constructor args).
6. **Click the finalized transaction and verify `Result: SUCCESS`** — a
   `Status: FINALIZED` on its own is not enough.
7. Copy the contract address (`0x…`).
8. `cd frontend` and create `.env`:
   ```bash
   NEXT_PUBLIC_CONTRACT_ADDRESS=0xYOUR_DEPLOYED_ADDRESS
   ```
9. `npm install && npm run dev`.
10. Open <http://localhost:3000>. Connect MetaMask (studionet); fund the
    address from Studio → Accounts before your first write.

## Wallet setup for reviewers

- **MetaMask (preferred)**: click **Connect MetaMask** in the header. The
  app calls `wallet_switchEthereumChain` (or `wallet_addEthereumChain` on
  cold MetaMask installs) automatically. The chain id `61999` /
  `0xF1EF` is read from `studionet.id`, not hard-coded.
- **Burner (demo only)**: available as a fallback but has zero GEN and
  cannot pay stakes — good for read-only page previews, useless for
  reproducing the full flow.

## Tests

```bash
gltest
```

Runs the 14 tests in `tests/test_doodle_guard.py`, including four
payment-conservation lifecycle tests and a two-cycle appeal-replay test
covering the review feedback. Requires `genlayer-test` in the Python
environment.

## Where to find the leak-report flow (for reviewers)

Three entry points, all reachable without prior context:

1. **Home page** → red *Report a Leak* button next to *Create NDA*.
2. **Top nav** → *Report Leak* link on every page.
3. **My NDAs dashboard** → *Report Leak* button in the header, and a
   secondary button on every card whose status is `active`.

All three land on **`/report`**, which either:

- lets you look up any NDA by its numeric ID (from someone who shared it
  with you), or
- lists your own active NDAs with a one-click *Report Leak* button per
  card.

To submit a report you must be Party A or Party B of an *active* NDA and
hold the vault password + salt file generated during creation. The
report costs 1 GEN and triggers on-chain `web.render` + AI Jury
consensus — the tx typically finalises in 30 s – 3 min on studionet.

## Video demo

[//]: # (Add a demo video / GIF link here once recorded post-redeploy.)
