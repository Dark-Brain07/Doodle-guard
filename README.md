# NDA Sentinel

## 🔗 Deployed Contract

| Network    | Address                                    | Explorer                                     |
|------------|--------------------------------------------|----------------------------------------------|
| studionet  | `0x10562A17a26D02A1591F49F3013D66e1bBCc6F09`                  | [Open in Studio](https://studio.genlayer.com/?import-contract=0x10562A17a26D02A1591F49F3013D66e1bBCc6F09) |

**Live App**: [https://nda-sentinel.vercel.app](https://nda-sentinel.vercel.app)  
**Class Name**: `NDASentinel`  
**Latest Deployment**: 2026-07-17 (v0.2.17 — accounting, appeal, collateral, replay, and reward-path fixes)

## Overview
Traditional NDAs are unenforceable in practice due to high costs ($200k–$2M in fees), long durations (18–36 months), and difficulties in cross-jurisdictional discovery.

**NDA Sentinel** is a trustless NDA enforcement dApp built on GenLayer. It uses an AI Jury to detect leaks, with smart contracts that automatically slash violators—no lawsuits, no waiting.

## Architecture
```text
  [ Party A & Party B ]
           |
     (1) Commit Hashes
     (2) Stake GEN
           |
  +-------------------+        (4) Fetch suspect URL
  | NDA Sentinel      | ---------------------------> [ Public Web (X, Github, etc.) ]
  | Smart Contract    | <--------------------------- [ Fetched content ]
  | (GenLayer L2)     | 
  +-------------------+
           |
     (3) Report Leak
     (with Vault Keys)
           |
    [ AI Jury Consensus ] ---> Analyzes content & keywords ---> Slashes violator
```

## Core Protocol Upgrades (v0.2.17 Audit Fixes)
1. **Contract Versioning**: Explicitly pinned contract execution to GenVM `# v0.2.17` on line 1.
2. **Scalar Initialization**: Initialized all `u256` storage scalar variables in `__init__` to prevent uninitialized storage runtime exceptions.
3. **Escrow Reward Escrow**: Implemented a 7-day appeal period escrow pattern for the reporter reward to resolve the race condition where a reporter withdraws immediately before an appeal decision.
4. **Activation Cancel Timeout**: Allowed Party A to cancel and refund their stake if Party B fails to activate the NDA within 7 days.
5. **Consensus Upgrades**: Upgraded verification consensus from `run_nondet_unsafe` to `gl.eq_principle.prompt_comparative` for deterministic matching across validators.
6. **EOA Transfers**: Replaced `gl.message.send_value` with contract interface `emit_transfer` calling EVM addresses.
7. **Prompt Injection Canary Defense**: Implemented cryptographic deterministic canaries wrapping user-controlled prompt parameters.
8. **Payment Conservation**: Slash shares remain escrowed until the appeal window closes; overturn restores collateral exactly once.
9. **Appeal Safety**: Appeals are deadline-bound and replay-protected; reward claims settle reporter and compensation escrows atomically.

## Step-by-Step Deploy Guide
STEP 1: Open [https://studio.genlayer.com/contracts](https://studio.genlayer.com/contracts)  
STEP 2: New Contract -> paste `contracts/nda_sentinel.py`  
STEP 3: Click Deploy (no constructor args)  
STEP 4: Copy contract address (0x...)  
STEP 5: cd `frontend` && create `.env` file containing:
```bash
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYOUR_DEPLOYED_ADDRESS
```
STEP 6: `npm install && npm run dev`  
STEP 7: Open `http://localhost:3000`  

## Tests
To run tests, make sure you have the pytest-genlayer plugin and execute:
```bash
gltest
```
