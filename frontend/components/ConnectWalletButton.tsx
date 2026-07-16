"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Wallet, Copy, RefreshCw } from "lucide-react"
import { getAccountAddress, resetLocalAccount } from "@/lib/genlayer"

export function ConnectWalletButton() {
  const [address, setAddress] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAddress(getAccountAddress())
    }
  }, [])

  const handleCopy = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  const handleReset = () => {
    if (confirm("Reset local account? You will lose access to any NDAs created with the current address.")) {
      resetLocalAccount()
    }
  }

  if (!address) {
    return (
      <Button variant="default" className="font-mono" disabled>
        <Wallet className="mr-2 h-4 w-4" />
        Loading…
      </Button>
    )
  }

  return (
    <div className="relative inline-block">
      <Button
        variant="outline"
        className="font-mono"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <Wallet className="mr-2 h-4 w-4" />
        {address.substring(0, 6)}…{address.substring(38)}
      </Button>
      {menuOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-md border bg-white dark:bg-slate-900 shadow-lg z-50 p-2 space-y-1 text-sm">
          <div className="px-2 py-1 text-xs text-slate-500">Local ephemeral account</div>
          <div className="px-2 py-1 font-mono text-xs break-all">{address}</div>
          <button
            className="w-full text-left px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center gap-2"
            onClick={handleCopy}
          >
            <Copy className="w-3 h-3" />
            {copied ? "Copied!" : "Copy address"}
          </button>
          <button
            className="w-full text-left px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center gap-2 text-rose-600"
            onClick={handleReset}
          >
            <RefreshCw className="w-3 h-3" />
            Reset local account
          </button>
        </div>
      )}
    </div>
  )
}
