# Architecture

DoodleGuard is a full-stack dApp built entirely on GenLayer, leveraging its native non-deterministic execution capabilities to enforce legal agreements without human intermediaries.

## Smart Contract Layer (Intelligent Contract)
- **Language:** Python (GenLayer SDK).
- **State:** Stores NDA metadata, encrypted state hashes, and dynamic arrays for appeals/violations.
- **Core Mechanism:** `report_leak` triggers a non-deterministic block (`run_nondet_unsafe`). The leader node fetches the suspect URL content, uses the LLM to run the AI Jury analysis, and returns a verdict. The validator nodes re-run the process and verify that key decision fields match strict equality, while allowing a small tolerance for subjective confidence scores.

## Frontend Layer
- **Framework:** Next.js (App Router), Tailwind CSS, shadcn/ui.
- **Wallet Connection:** `genlayer-js` SDK connecting via MetaMask to GenLayer Studio.
- **Client-Side Crypto:** AES encryption via `crypto-js` for the Secret Vault (downloaded locally). Cryptographic hashing via `js-sha256` ensures byte-identical compatibility with the Python `hashlib.sha256` used in the contract.

## Off-Chain Storage
To preserve privacy, actual NDA keywords are never stored on-chain. They are generated and hashed client-side, encrypted into a local JSON Vault file, and only provided back to the client at the moment a leak is reported. The intelligent contract only persists the SHA-256 hashes of the keywords.
