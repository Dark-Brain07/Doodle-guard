# NDA Sentinel

Trustless NDA enforcement dApp on GenLayer. An AI Jury reads the
suspect URL directly on-chain and reaches consensus on whether protected
information was disclosed; the smart contract atomically slashes and
distributes stakes based on the verdict, with a full appeal cycle.

- **Live App**: <https://nda-sentinel.vercel.app>
- **Class Name**: `NDASentinel`
- **Contract file**: [`contracts/nda_sentinel.py`](contracts/nda_sentinel.py)
- **Contract pragma**: `v0.2.18`
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
- **Security model**: [SECURITY.md](SECURITY.md)
- **Architecture deep-dive**: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## 🔗 Deployed Contract

| Network    | Address | Explorer |
|------------|---------|----------|
| studionet  | `0x10562A17a26D02A1591F49F3013D66e1bBCc6F09` (v0.2.17 build) | [Open in Studio](https://studio.genlayer.com/?import-contract=0x10562A17a26D02A1591F49F3013D66e1bBCc6F09) |

> ⚠️ **v0.2.18 needs a redeploy.** The v0.2.17 address above was compiled
> before the new `finalize_verdict` method, `get_nda_liabilities` view,
> new stats counters, and the appeal-replay reset landed. Redeploy the
> current `contracts/nda_sentinel.py` on
> [studio.genlayer.com/contracts](https://studio.genlayer.com/contracts)
> and set `NEXT_PUBLIC_CONTRACT_ADDRESS` in `frontend/.env` to the new
> address before pushing a v0.2.18 build to production.

## Why GenLayer

Traditional NDAs cost $200k – $2M and take 18–36 months to enforce.
NDA Sentinel replaces that with:

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
  | NDA Sentinel      | ------ fetch suspect_url via
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
4. New Contract → paste `contracts/nda_sentinel.py`.
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

Runs the 14 tests in `tests/test_nda_sentinel.py`, including four
payment-conservation lifecycle tests and a two-cycle appeal-replay test
covering the review feedback. Requires `genlayer-test` in the Python
environment.

## Video demo

[//]: # (Add a demo video / GIF link here once recorded post-redeploy.)
