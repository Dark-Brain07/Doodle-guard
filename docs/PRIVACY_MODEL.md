# Privacy & Threat Model

NDAs are fundamentally about PRIVATE information. DoodleGuard ensures that we DO NOT put confidential text on-chain.

## Commit-Reveal Scheme

1. **On-chain (public):** Only salted SHA-256 hashes of the protected keywords/phrases, along with a broad semantic category (e.g., "M&A pricing data") are stored on-chain. This provides the AI with scope context without revealing specific secrets.
2. **Off-chain (private):** The actual keywords, the salt, and the full NDA context are stored locally by the involved parties in an encrypted Secret Vault JSON file. This data is NEVER sent to the smart contract or any server during creation.
3. **Leak Verification:** When reporting a suspected leak, a party submits the subset of actual keywords they believe were leaked. The contract verifies that `sha256(keyword + salt)` matches the on-chain hashes. This proves that the reporter had authorized knowledge of the NDA terms.

## Privacy Assurances
- At the time of reporting, the revealed keywords are passed to the AI Jury in a non-deterministic execution block. They transit the validator network purely for consensus computation.
- Trust assumption: The GenLayer validator protocol guarantees that inputs are not persistently logged, meaning the secrets are ephemeral.
- Losing the Secret Vault means losing the ability to report violations. An accidental leak by one party will not allow them to self-report and claim the reward.
