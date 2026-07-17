import datetime
import hashlib
import json
import sys

import pytest


SCOPE = "source_code"
CONTEXT = "Codebase sharing for audit"
STAKE = 100 * 10**18
REPORT_FEE = 1 * 10**18
APPEAL_FEE = STAKE // 10
APPEAL_WINDOW_SECONDS = 7 * 24 * 60 * 60
SALT = "supersecretsalt123"
KEYWORDS = ["secret_algorithm", "private_key_123"]
START = datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc)


def iso_at(seconds: int) -> str:
    return (START + datetime.timedelta(seconds=seconds)).isoformat().replace("+00:00", "Z")


def warp(direct_vm, seconds: int) -> None:
    timestamp = iso_at(seconds)
    direct_vm.warp(timestamp)
    # genlayer-test 0.29.2 does not refresh message_raw.datetime on warp.
    # Keep the injected transaction context aligned with the VM clock.
    gl_module = sys.modules.get("genlayer.gl")
    if gl_module is not None:
        gl_module.message_raw["datetime"] = timestamp


def keyword_hashes() -> str:
    hashes = [hashlib.sha256((kw + SALT).encode()).hexdigest() for kw in KEYWORDS]
    return json.dumps(hashes)


def as_hex(address) -> str:
    if isinstance(address, bytes):
        return "0x" + address.hex()
    return address.as_hex if hasattr(address, "as_hex") else str(address)


def deploy_active_nda(direct_vm, direct_deploy, party_a, party_b):
    warp(direct_vm, 0)
    direct_vm.sender = party_a
    contract = direct_deploy("contracts/nda_sentinel.py")
    direct_vm.value = STAKE
    nda_id = contract.create_nda(
        as_hex(party_b), SCOPE, CONTEXT, int(START.timestamp()) + 30 * 24 * 60 * 60,
        keyword_hashes(),
    )
    assert int(nda_id) == 0

    direct_vm.sender = party_b
    direct_vm.value = STAKE
    contract.activate_nda(nda_id)
    direct_vm.value = 0
    return contract


def mock_verdict(direct_vm, verdict: str):
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*", {"status": 200, "body": "secret_algorithm was leaked"})
    direct_vm.mock_llm(
        r".*AI Jury for an NDA enforcement protocol.*",
        json.dumps({
            "verdict": "violation_confirmed",
            "confidence": 95,
            "responsible_party": "party_a",
            "match_score": 95,
            "specificity_score": 90,
            "prior_disclosure_found": False,
            "intent": "intentional",
            "reasoning": "The protected information was disclosed by party A.",
            "evidence_quote": "secret_algorithm was leaked",
            "matched_keywords_count": 1,
        }),
    )
    direct_vm.mock_llm(
        r".*AI Appellate Jury.*",
        json.dumps({"verdict": verdict, "reasoning": f"The prior decision is {verdict}."}),
    )


def report_party_a(direct_vm, contract, reporter):
    direct_vm.sender = reporter
    direct_vm.value = REPORT_FEE
    contract.report_leak(0, "https://example.com/leak", json.dumps([KEYWORDS[0]]), SALT)
    direct_vm.value = 0


def payment_state(contract):
    return json.loads(contract.get_payment_state(0))


def withdrawable(contract, account) -> int:
    nda = contract.get_nda(0)
    key = nda.party_a if as_hex(nda.party_a).lower() == as_hex(account).lower() else nda.party_b
    return int(contract.get_withdrawable(key))


def assert_conserved(total_received: int, *liabilities: int):
    assert sum(liabilities) == total_received


def test_create_activate_and_initial_state(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    nda = contract.get_nda(0)
    stats = json.loads(contract.get_stats())

    assert nda.status == "active"
    assert int(nda.stake_a) == STAKE
    assert int(nda.stake_b) == STAKE
    assert int(stats["total_ndas_created"]) == 1
    assert int(stats["treasury"]) == 0


def test_cancel_pending_requires_deadline(direct_vm, direct_deploy, direct_alice, direct_bob):
    warp(direct_vm, 0)
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/nda_sentinel.py")
    direct_vm.value = STAKE
    contract.create_nda(
        as_hex(direct_bob), SCOPE, CONTEXT,
        int(START.timestamp()) + 30 * 24 * 60 * 60, keyword_hashes(),
    )
    direct_vm.value = 0

    with direct_vm.expect_revert("Activation deadline not yet elapsed"):
        contract.cancel_pending_nda(0)

    warp(direct_vm, APPEAL_WINDOW_SECONDS)
    contract.cancel_pending_nda(0)
    nda = contract.get_nda(0)
    assert nda.status == "cancelled"
    assert int(nda.stake_a) == 0
    assert withdrawable(contract, direct_alice) == STAKE


def test_violation_keeps_full_slash_escrowed_and_conserves_payments(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "upheld")
    report_party_a(direct_vm, contract, direct_bob)

    nda = contract.get_nda(0)
    state = payment_state(contract)
    stats = json.loads(contract.get_stats())

    assert nda.status == "leaked"
    assert int(nda.stake_a) == 0
    assert int(state["reporter_reward_escrow"]) == 80 * 10**18
    assert int(state["compensation_escrow"]) == 17 * 10**18
    assert int(state["treasury_fee_escrow"]) == 3 * 10**18
    assert withdrawable(contract, direct_bob) == 0
    assert int(stats["treasury"]) == REPORT_FEE
    assert_conserved(
        2 * STAKE + REPORT_FEE,
        int(nda.stake_b),
        int(nda.slashed_amount),
        int(stats["treasury"]),
    )


def test_overturned_appeal_restores_collateral_without_minting(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "overturned")
    report_party_a(direct_vm, contract, direct_bob)

    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    contract.appeal(0, "This publication predates the NDA and proves prior disclosure.")
    direct_vm.value = 0

    nda = contract.get_nda(0)
    state = payment_state(contract)
    stats = json.loads(contract.get_stats())

    assert nda.status == "active"
    assert int(nda.stake_a) == STAKE
    assert int(nda.stake_b) == STAKE
    assert int(nda.slashed_amount) == 0
    assert withdrawable(contract, direct_alice) == APPEAL_FEE
    assert int(state["reporter_reward_escrow"]) == 0
    assert int(state["compensation_escrow"]) == 0
    assert int(state["treasury_fee_escrow"]) == 0
    assert int(stats["total_violations_confirmed"]) == 0
    assert int(stats["total_value_slashed"]) == 0
    assert_conserved(
        2 * STAKE + REPORT_FEE + APPEAL_FEE,
        int(nda.stake_a), int(nda.stake_b),
        withdrawable(contract, direct_alice),
        int(stats["treasury"]),
    )


def test_upheld_appeal_and_reward_path_conserve_every_payment(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "upheld")
    report_party_a(direct_vm, contract, direct_bob)

    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    contract.appeal(0, "The attribution should be reviewed again.")
    direct_vm.value = 0

    direct_vm.sender = direct_bob
    contract.claim_reporter_reward(0)

    nda = contract.get_nda(0)
    state = payment_state(contract)
    stats = json.loads(contract.get_stats())
    reporter_balance = withdrawable(contract, direct_bob)

    assert reporter_balance == 97 * 10**18
    assert int(state["reporter_reward_escrow"]) == 0
    assert int(state["compensation_escrow"]) == 0
    assert int(state["treasury_fee_escrow"]) == 0
    assert int(stats["treasury"]) == REPORT_FEE + APPEAL_FEE + 3 * 10**18
    assert_conserved(
        2 * STAKE + REPORT_FEE + APPEAL_FEE,
        int(nda.stake_b), reporter_balance, int(stats["treasury"]),
    )


def test_deadline_and_replay_protections(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "upheld")
    report_party_a(direct_vm, contract, direct_bob)

    with direct_vm.expect_revert("Appeal window not yet elapsed"):
        direct_vm.sender = direct_bob
        contract.claim_reporter_reward(0)

    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    contract.appeal(0, "Review the attribution evidence.")

    with direct_vm.expect_revert("Appeal already submitted for this verdict"):
        contract.appeal(0, "Replay the same appeal.")


def test_late_appeal_rejected_and_reward_claimable_at_boundary(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "upheld")
    report_party_a(direct_vm, contract, direct_bob)
    warp(direct_vm, APPEAL_WINDOW_SECONDS)

    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    with direct_vm.expect_revert("Appeal window has elapsed"):
        contract.appeal(0, "This appeal is too late.")

    direct_vm.sender = direct_bob
    direct_vm.value = 0
    contract.claim_reporter_reward(0)
    assert withdrawable(contract, direct_bob) == 97 * 10**18


def test_reward_cannot_be_claimed_twice(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "upheld")
    report_party_a(direct_vm, contract, direct_bob)
    warp(direct_vm, APPEAL_WINDOW_SECONDS)
    direct_vm.sender = direct_bob
    contract.claim_reporter_reward(0)

    with direct_vm.expect_revert("No escrowed reward"):
        contract.claim_reporter_reward(0)
