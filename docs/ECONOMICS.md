# Protocol Economics

DoodleGuard uses crypto-economic stakes to ensure honesty and disincentivize leaks or false reporting.

## Staking
- Both parties must lock an agreed amount of GEN (the "stake") when the NDA is created and activated.
- The stake serves as collateral for the duration of the NDA.

## Violation Slashing
If the AI Jury confirms a violation, the guilty party's stake is slashed and distributed as follows:
- **80%** to the reporter (as an incentive/reward for discovering the leak).
- **17%** to the non-violating party (as compensation).
- **3%** to the protocol treasury (as a fee).

## Reporting Fee
- Reporters must pay a small anti-spam fee (e.g., 1 GEN) to trigger the AI Jury.
- If the AI confirms a violation, the fee is essentially covered by the reward.
- If the AI finds no violation, the fee is forfeited to the other party to penalize malicious/frivolous reporting.
- If the AI result is "inconclusive", the fee is refunded.

## Appeals
- Slashed parties can appeal by staking an additional **10%** of the slashed amount as an appeal fee.
- If the appeal is upheld, the appeal fee is forfeited to the treasury.
- If the appeal is overturned, the slashed funds and appeal fee are returned, and the reporter's reward is clawed back.
