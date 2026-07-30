"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  client,
  CONTRACT_ADDRESS,
  ensureCorrectChainBeforeWrite,
  explorerTxUrl,
  getAccountAddress,
  toCalldataAddress,
  WALLET_CHANGED_EVENT,
} from "@/lib/genlayer"
import { ConnectWalletButton } from "@/components/ConnectWalletButton"
import { StatusBadge } from "@/components/StatusBadge"
import { VerdictPanel } from "@/components/VerdictPanel"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { NDADetail, Verdict } from "@/lib/types"
import { formatGenAmount } from "@/lib/amount"
import { parseContractError } from "@/lib/utils"
import { format } from "date-fns"
import Link from "next/link"

export default function NDADetailPage() {
  const { ndaId } = useParams()
  const [nda, setNda] = useState<NDADetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [address, setAddress] = useState<string | null>(null)
  const [isActivating, setIsActivating] = useState(false)
  const [isExpiring, setIsExpiring] = useState(false)
  const [isAppealing, setIsAppealing] = useState(false)
  const [isClaimingReward, setIsClaimingReward] = useState(false)
  const [counterEvidence, setCounterEvidence] = useState("")
  const [withdrawable, setWithdrawable] = useState<string>("0")
  const [currentTimeMs, setCurrentTimeMs] = useState<number | null>(null)
  const [lastTxHash, setLastTxHash] = useState<string | null>(null)

  const fetchNDA = useCallback(async (userAddress?: string) => {
    try {
      const result = await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_nda",
        args: [BigInt(ndaId as string)]
      }) as {
        id: bigint; party_a: string; party_b: string; scope: string;
        context_description: string; status: NDADetail["status"];
        stake_a: bigint; stake_b: bigint; expiry_timestamp: bigint;
        created_at: bigint; activated_at: bigint; keyword_hash_count: bigint;
        suspect_url: string; verdict_json: string; violator: string;
        slashed_amount: bigint; reporter: string; appeal_deadline: bigint;
      };
      
      if (result) {
        setNda({
          id: result.id.toString(),
          party_a: result.party_a,
          party_b: result.party_b,
          scope: result.scope,
          context_description: result.context_description,
          status: result.status,
          stake_a: result.stake_a.toString(),
          stake_b: result.stake_b.toString(),
          expiry_timestamp: result.expiry_timestamp.toString(),
          created_at: result.created_at.toString(),
          activated_at: result.activated_at.toString(),
          keyword_hash_count: result.keyword_hash_count.toString(),
          suspect_url: result.suspect_url,
          verdict_json: result.verdict_json,
          violator: result.violator,
          slashed_amount: result.slashed_amount.toString(),
          reporter: result.reporter,
          appeal_deadline: result.appeal_deadline.toString()
        });
      }

      if (userAddress) {
        const bal = await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_withdrawable",
          args: [toCalldataAddress(userAddress)]
        }) as bigint;
        setWithdrawable(bal.toString());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [ndaId])

  useEffect(() => {
    const init = async () => {
      const userAddr = typeof window !== "undefined" ? getAccountAddress() : undefined;
      if (userAddr) setAddress(userAddr);
      await fetchNDA(userAddr);
    }
    init();
    const onWalletChange = () => {
      const newAddr = getAccountAddress();
      setAddress(newAddr);
      fetchNDA(newAddr);
    };
    if (typeof window !== "undefined") {
      window.addEventListener(WALLET_CHANGED_EVENT, onWalletChange);
      return () =>
        window.removeEventListener(WALLET_CHANGED_EVENT, onWalletChange);
    }
  }, [fetchNDA])

  useEffect(() => {
    const refreshClock = () => setCurrentTimeMs(Date.now())
    const initialTimer = window.setTimeout(refreshClock, 0)
    const interval = window.setInterval(refreshClock, 30_000)
    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(interval)
    }
  }, [])

  type WriteHash = Awaited<ReturnType<typeof client.writeContract>>;
  const runWrite = async (
    fn: () => Promise<WriteHash>,
    opts?: { nondet?: boolean },
  ): Promise<WriteHash | null> => {
    await ensureCorrectChainBeforeWrite();
    const hash = await fn();
    setLastTxHash(hash);
    // ACCEPTED = leader executed + validators agreed. FINALIZED would wait
    // for the full appeal window to close (~5+ min on studionet) which is
    // not what a UI should block on. Nondet-heavy writes (appeal) still
    // need extra time for the LLM/web fetch inside consensus, so bump the
    // poller ceiling from the SDK default 150 s to 10 min.
    const wait = opts?.nondet
      ? { hash, status: "ACCEPTED" as never, retries: 200, interval: 3000 }
      : { hash, status: "ACCEPTED" as never };
    await client.waitForTransactionReceipt(wait);
    return hash;
  };

  const handleActivate = async () => {
    if (!nda || !address) return;
    setIsActivating(true);
    try {
      await runWrite(() =>
        client.writeContract({
          address: CONTRACT_ADDRESS,
          functionName: "activate_nda",
          args: [BigInt(nda.id)],
          value: BigInt(nda.stake_a),
        }),
      );
      await fetchNDA(address);
    } catch (err) {
      console.error(err);
      alert("Error activating NDA: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsActivating(false);
    }
  }

  const handleExpire = async () => {
    if (!nda || !address) return;
    setIsExpiring(true);
    try {
      await runWrite(() =>
        client.writeContract({
          address: CONTRACT_ADDRESS,
          functionName: "expire_and_withdraw",
          args: [BigInt(nda.id)],
          value: BigInt(0),
        }),
      );
      await fetchNDA(address);
    } catch (err) {
      console.error(err);
      alert("Error expiring NDA: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExpiring(false);
    }
  }

  const handleWithdraw = async () => {
    if (!address) return;
    try {
      await runWrite(() =>
        client.writeContract({
          address: CONTRACT_ADDRESS,
          functionName: "withdraw",
          args: [],
          value: BigInt(0),
        }),
      );
      await fetchNDA(address);
    } catch (err) {
      console.error(err);
      alert("Error withdrawing: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  const handleAppeal = async () => {
    if (!nda || !address || !counterEvidence.trim()) return;
    setIsAppealing(true);
    try {
      const appealFee = BigInt(nda.slashed_amount) / 10n;
      await runWrite(
        () =>
          client.writeContract({
            address: CONTRACT_ADDRESS,
            functionName: "appeal",
            args: [BigInt(nda.id), counterEvidence.trim()],
            value: appealFee,
          }),
        { nondet: true },
      );
      setCounterEvidence("");
      await fetchNDA(address);
    } catch (err) {
      console.error(err);
      alert(parseContractError(err));
    } finally {
      setIsAppealing(false);
    }
  }

  const handleClaimReward = async () => {
    if (!nda || !address) return;
    setIsClaimingReward(true);
    try {
      // finalize_verdict is the anyone-in-NDA anyone-after-rescue path added
      // in v0.2.18. claim_reporter_reward is kept as its alias for callers
      // built against the old ABI.
      await runWrite(() =>
        client.writeContract({
          address: CONTRACT_ADDRESS,
          functionName: "finalize_verdict",
          args: [BigInt(nda.id)],
          value: 0n,
        }),
      );
      await fetchNDA(address);
    } catch (err) {
      console.error(err);
      alert(parseContractError(err));
    } finally {
      setIsClaimingReward(false);
    }
  }

  if (loading) {
    return <div className="container mx-auto px-4 py-8">Loading NDA details...</div>
  }

  if (!nda) {
    return <div className="container mx-auto px-4 py-8">NDA not found</div>
  }

  const isPartyA = address?.toLowerCase() === nda.party_a.toLowerCase();
  const isPartyB = address?.toLowerCase() === nda.party_b.toLowerCase();
  const expiryDate = new Date(parseInt(nda.expiry_timestamp) * 1000);
  const isExpired = expiryDate < new Date();
  let parsedVerdict: Verdict | null = null;
  try {
    parsedVerdict = nda.verdict_json ? JSON.parse(nda.verdict_json) : null;
  } catch {
    parsedVerdict = null;
  }
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  const isViolator = !!address && nda.violator.toLowerCase() === address.toLowerCase();
  const isReporter = !!address && nda.reporter.toLowerCase() === address.toLowerCase();
  const appealDeadlineMs = Number(nda.appeal_deadline) * 1000;
  const appealOpen = currentTimeMs !== null && nda.status === "leaked" && nda.violator.toLowerCase() !== zeroAddress && currentTimeMs < appealDeadlineMs;
  // finalize_verdict is callable by reporter, either party of the NDA, or
  // anyone after the rescue window — the contract enforces the exact auth
  // rule; the UI just surfaces the button to anyone who could plausibly call.
  const rewardClaimable = currentTimeMs !== null && nda.status === "leaked" && (isReporter || isPartyA || isPartyB) && appealDeadlineMs > 0 && currentTimeMs >= appealDeadlineMs;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">NDA #{nda.id}</h1>
            <StatusBadge status={nda.status} />
          </div>
          <p className="text-slate-500 text-sm">
            Created on {format(new Date(parseInt(nda.created_at) * 1000), "PPP")}
          </p>
        </div>
        <ConnectWalletButton />
      </div>

      {lastTxHash && (
        <div className="rounded border bg-slate-50 dark:bg-slate-900/40 text-xs px-3 py-2 flex items-center justify-between">
          <span className="text-slate-500">Last transaction:</span>
          <a
            href={explorerTxUrl(lastTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-blue-600 dark:text-blue-400 hover:underline break-all ml-2"
          >
            {lastTxHash.substring(0, 10)}…{lastTxHash.substring(60)}
          </a>
        </div>
      )}

      {BigInt(withdrawable) > BigInt(0) && (
        <Card className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50">
          <CardContent className="flex justify-between items-center p-6">
            <div>
              <h3 className="font-bold text-emerald-800 dark:text-emerald-400">Available to Withdraw</h3>
              <p className="text-2xl font-mono">{formatGenAmount(withdrawable)} GEN</p>
            </div>
            <Button onClick={handleWithdraw} className="bg-emerald-600 hover:bg-emerald-700">
              Withdraw
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6 space-y-2">
            <p className="text-sm font-semibold text-slate-500 uppercase">Party A (Creator)</p>
            <p className="font-mono text-sm break-all">{nda.party_a}</p>
            <p className="text-sm">Stake: {formatGenAmount(nda.stake_a)} GEN</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-2">
            <p className="text-sm font-semibold text-slate-500 uppercase">Party B (Counterparty)</p>
            <p className="font-mono text-sm break-all">{nda.party_b}</p>
            <p className="text-sm">Stake: {formatGenAmount(nda.stake_b)} GEN</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase mb-1">Scope</p>
            <p className="capitalize font-medium">{nda.scope.replace("_", " ")}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase mb-1">Public Context</p>
            <p className="text-slate-700 dark:text-slate-300">{nda.context_description}</p>
          </div>
          <div className="flex gap-8">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase mb-1">Protected Keywords</p>
              <p className="font-medium">{nda.keyword_hash_count} Hashes</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase mb-1">Expiry</p>
              <p className="font-medium">{format(expiryDate, "PPP")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {nda.status === "leaked" && parsedVerdict && (
        <VerdictPanel verdict={parsedVerdict} />
      )}

      {appealOpen && isViolator && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-6 space-y-4">
            <div>
              <h3 className="font-bold text-amber-900 dark:text-amber-300">Appeal this verdict</h3>
              <p className="text-sm text-amber-800 dark:text-amber-400">
                Submit counter-evidence before {format(new Date(appealDeadlineMs), "PPp")} with a {formatGenAmount(BigInt(nda.slashed_amount) / 10n)} GEN appeal stake.
              </p>
            </div>
            <Textarea
              value={counterEvidence}
              onChange={(event) => setCounterEvidence(event.target.value)}
              maxLength={2000}
              placeholder="Provide prior-publication or attribution evidence..."
            />
            <Button onClick={handleAppeal} disabled={isAppealing || !counterEvidence.trim()}>
              {isAppealing ? "Submitting appeal..." : "Submit Appeal"}
            </Button>
          </CardContent>
        </Card>
      )}

      {rewardClaimable && (
        <Card className="border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="p-6 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-emerald-900 dark:text-emerald-300">Verdict ready to finalize</h3>
              <p className="text-sm text-emerald-800 dark:text-emerald-400">
                Appeal window closed. Anyone in the NDA can release the escrow — the
                reporter gets 80 %, the non-violator 17 %, treasury 3 %.
              </p>
            </div>
            <Button onClick={handleClaimReward} disabled={isClaimingReward} className="bg-emerald-600 hover:bg-emerald-700">
              {isClaimingReward
                ? "Finalizing..."
                : isReporter
                ? "Claim Reward"
                : "Finalize Verdict"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ACTION AREA */}
      <div className="pt-4 flex justify-center gap-4">
        {nda.status === "pending" && isPartyB && (
          <Button size="lg" onClick={handleActivate} disabled={isActivating}>
            {isActivating ? "Activating..." : `Activate & Stake ${formatGenAmount(nda.stake_a)} GEN`}
          </Button>
        )}
        
        {nda.status === "active" && (isPartyA || isPartyB) && !isExpired && (
          <Link href={`/ndas/${nda.id}/report`}>
            <Button size="lg" variant="destructive">
              Report Leak
            </Button>
          </Link>
        )}

        {nda.status === "active" && isExpired && (isPartyA || isPartyB) && (
          <Button size="lg" onClick={handleExpire} disabled={isExpiring}>
            {isExpiring ? "Processing..." : "Expire & Withdraw Stake"}
          </Button>
        )}
      </div>
    </div>
  )
}
