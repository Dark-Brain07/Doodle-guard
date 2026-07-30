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


def liabilities(contract, nda_id: int = 0):
    return json.loads(contract.get_nda_liabilities(nda_id))


def assert_liabilities_match(contract, total_received: int, nda_id: int = 0):
    """Sum of active stakes + escrows + party withdrawables + treasury
    must equal every wei ever paid into this NDA's lifecycle."""
    liab = liabilities(contract, nda_id)
    assert int(liab["total_liabilities"]) == total_received, (
        f"conservation broken: expected {total_received}, got {liab}"
    )


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


# ---------------------------------------------------------------------------
# Additional coverage — deadline, replay, non-reporter finalize, invariant.
# Added to close the gaps raised in the resubmission review.
# ---------------------------------------------------------------------------


def test_report_rejected_after_nda_expiry(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "upheld")
    # Jump past the 30-day expiry set by deploy_active_nda().
    warp(direct_vm, 31 * 24 * 60 * 60)

    direct_vm.sender = direct_bob
    direct_vm.value = REPORT_FEE
    with direct_vm.expect_revert("NDA has expired"):
        contract.report_leak(
            0, "https://example.com/leak", json.dumps([KEYWORDS[0]]), SALT,
        )


def test_non_reporter_party_can_finalize_after_window(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    """Reporter absent → non-violator party (party_b in this case is reporter,
    so the finalizer here is the reporter's counterpart, party_a's other side).
    Here we prove any authorised party can settle: appellant already lost, so
    finalize is called by direct_alice (the violator) after the appeal window,
    unblocking the compensation share for the reporter's counterpart."""
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "upheld")
    report_party_a(direct_vm, contract, direct_bob)
    warp(direct_vm, APPEAL_WINDOW_SECONDS)

    # direct_alice is the violator — she still counts as authorised.
    direct_vm.sender = direct_alice
    contract.finalize_verdict(0)

    reporter_balance = withdrawable(contract, direct_bob)
    assert reporter_balance == 97 * 10**18

    state = payment_state(contract)
    assert int(state["reporter_reward_escrow"]) == 0
    assert int(state["compensation_escrow"]) == 0
    assert int(state["treasury_fee_escrow"]) == 0


def test_replay_across_two_verdict_cycles(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Overturned verdict must not permanently lock out future appeals on the
    same NDA. Cycle 1: report → overturned. Cycle 2: report again → violator
    must still be able to appeal (appeal_submitted was reset)."""
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)

    # Cycle 1: overturned.
    mock_verdict(direct_vm, "overturned")
    report_party_a(direct_vm, contract, direct_bob)
    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    contract.appeal(0, "Prior disclosure proves this was public earlier.")
    direct_vm.value = 0

    nda_after_cycle1 = contract.get_nda(0)
    assert nda_after_cycle1.status == "active"
    assert nda_after_cycle1.suspect_url == ""
    assert nda_after_cycle1.verdict_json == ""

    # Cycle 2: report again on the now-active NDA and appeal it a second time.
    mock_verdict(direct_vm, "upheld")
    report_party_a(direct_vm, contract, direct_bob)

    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    # The replay guard from cycle 1 must have been cleared — this call must
    # NOT revert with "Appeal already submitted for this verdict".
    contract.appeal(0, "Try appealing the fresh accusation.")
    direct_vm.value = 0

    stats = json.loads(contract.get_stats())
    assert int(stats["total_appeals_overturned"]) == 1
    assert int(stats["total_appeals_upheld"]) == 1


def test_liabilities_invariant_across_lifecycle(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Every wei paid into the NDA must equal active stakes + escrows +
    party withdrawables + treasury, at every step."""
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)

    # After activation only stakes have been received.
    assert_liabilities_match(contract, 2 * STAKE)

    mock_verdict(direct_vm, "upheld")
    report_party_a(direct_vm, contract, direct_bob)
    # Report fee added to intake; slash redistributed but total preserved.
    assert_liabilities_match(contract, 2 * STAKE + REPORT_FEE)

    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    contract.appeal(0, "Please review the attribution once more.")
    direct_vm.value = 0
    assert_liabilities_match(contract, 2 * STAKE + REPORT_FEE + APPEAL_FEE)

    direct_vm.sender = direct_bob
    contract.finalize_verdict(0)
    assert_liabilities_match(contract, 2 * STAKE + REPORT_FEE + APPEAL_FEE)


def test_liabilities_invariant_on_overturned_lifecycle(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    assert_liabilities_match(contract, 2 * STAKE)

    mock_verdict(direct_vm, "overturned")
    report_party_a(direct_vm, contract, direct_bob)
    assert_liabilities_match(contract, 2 * STAKE + REPORT_FEE)

    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    contract.appeal(0, "Counter-evidence attached.")
    direct_vm.value = 0
    # On overturn: appeal fee refunded to appellant as withdrawable; report
    # fee stayed in treasury; stakes restored.
    assert_liabilities_match(contract, 2 * STAKE + REPORT_FEE + APPEAL_FEE)


def test_new_stats_counters_track_appeal_outcomes(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "overturned")
    report_party_a(direct_vm, contract, direct_bob)
    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    contract.appeal(0, "Overturn me.")
    direct_vm.value = 0

    stats = json.loads(contract.get_stats())
    assert int(stats["total_appeals_overturned"]) == 1
    assert int(stats["total_appeals_upheld"]) == 0
    assert int(stats["total_report_fees_collected"]) == REPORT_FEE
    # Overturn must roll back the confirmed-violation counter to zero.
    assert int(stats["total_violations_confirmed"]) == 0
    assert int(stats["total_value_slashed"]) == 0
