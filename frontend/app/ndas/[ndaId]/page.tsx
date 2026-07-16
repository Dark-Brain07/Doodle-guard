"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { client, CONTRACT_ADDRESS, getAccountAddress, toCalldataAddress } from "@/lib/genlayer"
import { ConnectWalletButton } from "@/components/ConnectWalletButton"
import { StatusBadge } from "@/components/StatusBadge"
import { VerdictPanel } from "@/components/VerdictPanel"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { NDADetail, Verdict } from "@/lib/types"
import { format } from "date-fns"
import Link from "next/link"

export default function NDADetailPage() {
  const { ndaId } = useParams()
  const router = useRouter()
  const [nda, setNda] = useState<NDADetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [address, setAddress] = useState<string | null>(null)
  const [isActivating, setIsActivating] = useState(false)
  const [isExpiring, setIsExpiring] = useState(false)
  const [withdrawable, setWithdrawable] = useState<string>("0")

  const fetchNDA = async (userAddress?: string) => {
    try {
      const result = await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_nda",
        args: [BigInt(ndaId as string)]
      }) as any;
      
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
          reporter: result.reporter
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
  }

  useEffect(() => {
    const init = async () => {
      const userAddr = typeof window !== "undefined" ? getAccountAddress() : undefined;
      if (userAddr) setAddress(userAddr);
      await fetchNDA(userAddr);
    }
    init();
  }, [ndaId])

  const handleActivate = async () => {
    if (!nda || !address) return;
    setIsActivating(true);
    try {
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "activate_nda",
        args: [BigInt(nda.id)],
        value: BigInt(nda.stake_a),
      });
      await client.waitForTransactionReceipt({ hash, status: "FINALIZED" as never });
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
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "expire_and_withdraw",
        args: [BigInt(nda.id)],
        value: BigInt(0),
      });
      await client.waitForTransactionReceipt({ hash, status: "FINALIZED" as never });
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
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "withdraw",
        args: [],
        value: BigInt(0),
      });
      await client.waitForTransactionReceipt({ hash, status: "FINALIZED" as never });
      alert("Withdrawn successfully!");
      await fetchNDA(address);
    } catch (err) {
      console.error(err);
      alert("Error withdrawing: " + (err instanceof Error ? err.message : String(err)));
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
  const parsedVerdict: Verdict | null = nda.verdict_json ? JSON.parse(nda.verdict_json) : null;

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

      {BigInt(withdrawable) > BigInt(0) && (
        <Card className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50">
          <CardContent className="flex justify-between items-center p-6">
            <div>
              <h3 className="font-bold text-emerald-800 dark:text-emerald-400">Available to Withdraw</h3>
              <p className="text-2xl font-mono">{parseFloat(withdrawable) / 1e18} GEN</p>
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
            <p className="text-sm">Stake: {parseFloat(nda.stake_a) / 1e18} GEN</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-2">
            <p className="text-sm font-semibold text-slate-500 uppercase">Party B (Counterparty)</p>
            <p className="font-mono text-sm break-all">{nda.party_b}</p>
            <p className="text-sm">Stake: {parseFloat(nda.stake_b) / 1e18} GEN</p>
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

      {/* ACTION AREA */}
      <div className="pt-4 flex justify-center gap-4">
        {nda.status === "pending" && isPartyB && (
          <Button size="lg" onClick={handleActivate} disabled={isActivating}>
            {isActivating ? "Activating..." : `Activate & Stake ${parseFloat(nda.stake_a) / 1e18} GEN`}
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
