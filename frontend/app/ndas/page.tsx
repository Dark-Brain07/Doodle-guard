"use client"

import { useEffect, useState } from "react"
import { client, CONTRACT_ADDRESS, getAccountAddress, toCalldataAddress } from "@/lib/genlayer"
import { NDACard } from "@/components/NDACard"
import { ConnectWalletButton } from "@/components/ConnectWalletButton"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { NDA } from "@/lib/types"

export default function NDAsDashboard() {
  const [ndas, setNdas] = useState<NDA[]>([])
  const [loading, setLoading] = useState(true)
  const [address, setAddress] = useState<string | null>(null)

  useEffect(() => {
    const fetchNDAs = async () => {
      if (typeof window === "undefined") {
        setLoading(false)
        return
      }
      const userAddress = getAccountAddress()
      setAddress(userAddress)
      try {
        const result = await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_user_ndas",
          args: [toCalldataAddress(userAddress)],
        }) as string
        if (result) {
          setNdas(JSON.parse(result))
        }
      } catch (err) {
        console.error("Failed to fetch NDAs", err)
      } finally {
        setLoading(false)
      }
    }

    fetchNDAs()
  }, [])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My NDAs</h1>
        <div className="flex gap-4">
          <Link href="/ndas/new">
            <Button>Create NDA</Button>
          </Link>
          <ConnectWalletButton />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : address ? (
        ndas.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ndas.map(nda => (
              <NDACard 
                key={nda.id}
                id={nda.id}
                counterparty={nda.party_a.toLowerCase() === address.toLowerCase() ? nda.party_b : nda.party_a}
                scope={nda.scope}
                status={nda.status}
                stake={nda.party_a.toLowerCase() === address.toLowerCase() ? nda.stake_a : nda.stake_b}
                expiryTimestamp={nda.expiry_timestamp}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-slate-50 dark:bg-slate-900 rounded-xl">
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No NDAs found</h3>
            <p className="text-slate-500 mb-6">You don&apos;t have any active or pending NDAs yet.</p>
            <Link href="/ndas/new">
              <Button>Create your first NDA</Button>
            </Link>
          </div>
        )
      ) : (
        <div className="text-center py-20">
          <p className="text-slate-500 mb-4">Please connect your wallet to view your NDAs.</p>
          <ConnectWalletButton />
        </div>
      )}
    </div>
  )
}
