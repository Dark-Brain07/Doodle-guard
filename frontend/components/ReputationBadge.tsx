"use client"

import { useEffect, useState } from "react"
import {
  client,
  CONTRACT_ADDRESS,
  toCalldataAddress,
} from "@/lib/genlayer"
import { ShieldCheck, ShieldAlert, Shield, Award } from "lucide-react"

type Reputation = {
  score: string
  tier: "verified" | "trusted" | "newcomer" | "flagged"
  baseline: string
  reports_submitted: string
  reports_confirmed: string
  false_reports: string
  violations_confirmed: string
  appeals_won: string
}

const TIER_STYLES: Record<Reputation["tier"], { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  verified: { label: "Verified", className: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800", icon: Award },
  trusted: { label: "Trusted", className: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800", icon: ShieldCheck },
  newcomer: { label: "Newcomer", className: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700", icon: Shield },
  flagged: { label: "Flagged", className: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-800", icon: ShieldAlert },
}

export function ReputationBadge({ address, size = "sm" }: { address: string; size?: "sm" | "md" }) {
  const [rep, setRep] = useState<Reputation | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetch = async () => {
      try {
        const result = (await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_reputation",
          args: [toCalldataAddress(address)],
        })) as string
        if (cancelled) return
        setRep(JSON.parse(result) as Reputation)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      }
    }
    fetch()
    return () => {
      cancelled = true
    }
  }, [address])

  if (error) return null
  if (!rep) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs bg-slate-50 dark:bg-slate-900 text-slate-400 animate-pulse">
        <Shield className="w-3 h-3" />
        rep …
      </span>
    )
  }
  const style = TIER_STYLES[rep.tier] ?? TIER_STYLES.newcomer
  const Icon = style.icon
  const padding = size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border ${padding} font-medium ${style.className}`}
      title={`Reports ${rep.reports_confirmed}/${rep.reports_submitted} · Violations ${rep.violations_confirmed} · Appeals won ${rep.appeals_won} · False reports ${rep.false_reports}`}
    >
      <Icon className="w-3 h-3" />
      {style.label} · {rep.score}
    </span>
  )
}
