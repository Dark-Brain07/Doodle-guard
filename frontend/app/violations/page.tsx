"use client"

import { useEffect, useState } from "react"
import { client, CONTRACT_ADDRESS } from "@/lib/genlayer"
import { ConnectWalletButton } from "@/components/ConnectWalletButton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatGenAmount } from "@/lib/amount"

interface ProtocolStats {
  total_ndas_created: string;
  total_violations_confirmed: string;
  total_value_slashed: string;
  treasury: string;
}

export default function ViolationsLogPage() {
  const [stats, setStats] = useState<ProtocolStats | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const result = await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_stats",
          args: []
        }) as string;
        if (result) {
          setStats(JSON.parse(result));
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchStats()
  }, [])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Public Violations Log</h1>
        <ConnectWalletButton />
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500 uppercase">NDAs Protected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.total_ndas_created || "0"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500 uppercase text-rose-500">Violations Confirmed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-rose-600">{stats?.total_violations_confirmed || "0"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500 uppercase text-emerald-500">Value Slashed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-600">
              {stats?.total_value_slashed ? formatGenAmount(stats.total_value_slashed) : "0"} GEN
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-8 text-center text-slate-500">
          <p>For privacy reasons, the full public ledger of confirmed violations is available strictly via on-chain inspection of the DoodleGuard smart contract.</p>
        </CardContent>
      </Card>
    </div>
  )
}
