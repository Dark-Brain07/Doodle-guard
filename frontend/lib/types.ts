export interface NDA {
    id: string;
    party_a: string;
    party_b: string;
    scope: string;
    status: "pending" | "active" | "leaked" | "expired" | "cancelled" | "disputed" | "appeal_pending";
    stake_a: string;
    stake_b: string;
    expiry_timestamp: string;
}

export interface NDADetail extends NDA {
    context_description: string;
    created_at: string;
    activated_at: string;
    keyword_hash_count: string;
    suspect_url: string;
    verdict_json: string;
    violator: string;
    slashed_amount: string;
    reporter: string;
    appeal_deadline: string;
}

export interface Verdict {
    verdict: "violation_confirmed" | "no_violation" | "inconclusive";
    confidence: number;
    responsible_party: "party_a" | "party_b" | "unknown" | "both";
    match_score: number;
    specificity_score: number;
    prior_disclosure_found: boolean;
    intent: "intentional" | "accidental" | "coerced" | "unknown";
    reasoning: string;
    evidence_quote: string;
    matched_keywords_count: number;
}
