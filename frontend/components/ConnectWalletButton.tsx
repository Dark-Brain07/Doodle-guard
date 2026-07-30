"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Wallet, Copy, RefreshCw, ShieldCheck, AlertTriangle, ExternalLink } from "lucide-react"
import {
  connectMetaMask,
  explorerAddressUrl,
  getAccountAddress,
  isMetaMaskAvailable,
  resetLocalAccount,
  restoreWalletSession,
  switchToBurner,
  walletMode,
  WALLET_CHANGED_EVENT,
} from "@/lib/genlayer"

export function ConnectWalletButton() {
  const [address, setAddress] = useState<string | null>(null)
  const [mode, setMode] = useState<"metamask" | "burner">("burner")
  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [hasMetaMask, setHasMetaMask] = useState(false)

  const refresh = useCallback(() => {
    setAddress(getAccountAddress())
    setMode(walletMode)
  }, [])

  useEffect(() => {
    setHasMetaMask(isMetaMaskAvailable())
    restoreWalletSession()
      .catch(() => {})
      .finally(refresh)
    const handler = () => refresh()
    window.addEventListener(WALLET_CHANGED_EVENT, handler)
    return () => window.removeEventListener(WALLET_CHANGED_EVENT, handler)
  }, [refresh])

  const handleConnect = async () => {
    setConnectError(null)
    setConnecting(true)
    try {
      await connectMetaMask()
      setMenuOpen(false)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to connect"
      setConnectError(msg)
    } finally {
      setConnecting(false)
    }
  }

  const handleUseBurner = () => {
    switchToBurner()
    setMenuOpen(false)
  }

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
    if (confirm("Reset local burner account? You will lose access to any NDAs created with the current address.")) {
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

  const isMM = mode === "metamask"
  const short = `${address.substring(0, 6)}…${address.substring(38)}`

  return (
    <div className="relative inline-block">
      <Button
        variant={isMM ? "default" : "outline"}
        className="font-mono"
        onClick={() => setMenuOpen((v) => !v)}
      >
        {isMM ? (
          <ShieldCheck className="mr-2 h-4 w-4" />
        ) : (
          <Wallet className="mr-2 h-4 w-4" />
        )}
        {short}
      </Button>
      {menuOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-md border bg-white dark:bg-slate-900 shadow-lg z-50 p-3 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Mode:</span>
            <span className={`font-semibold ${isMM ? "text-emerald-600" : "text-amber-600"}`}>
              {isMM ? "MetaMask (studionet)" : "Local burner (demo)"}
            </span>
          </div>
          <div className="font-mono text-xs break-all border rounded p-2 bg-slate-50 dark:bg-slate-800">
            {address}
          </div>

          {!isMM && (
            <div className="rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2 text-xs text-amber-800 dark:text-amber-200 flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                Burner has <strong>zero GEN</strong> on studionet and cannot pay stakes.
                Connect MetaMask (funded from Studio → Accounts) to transact.
              </div>
            </div>
          )}

          {!isMM && hasMetaMask && (
            <Button className="w-full" onClick={handleConnect} disabled={connecting}>
              <ShieldCheck className="w-4 h-4 mr-2" />
              {connecting ? "Connecting…" : "Connect MetaMask (studionet)"}
            </Button>
          )}
          {!isMM && !hasMetaMask && (
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 rounded px-3 py-2 border text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ExternalLink className="w-3 h-3" />
              Install MetaMask
            </a>
          )}
          {connectError && (
            <div className="text-xs text-rose-600 dark:text-rose-400">{connectError}</div>
          )}

          <a
            href={explorerAddressUrl(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full text-left px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center gap-2 text-xs"
          >
            <ExternalLink className="w-3 h-3" />
            View on Explorer
          </a>

          <button
            className="w-full text-left px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center gap-2"
            onClick={handleCopy}
          >
            <Copy className="w-3 h-3" />
            {copied ? "Copied!" : "Copy address"}
          </button>

          {isMM && (
            <button
              className="w-full text-left px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center gap-2 text-xs text-slate-500"
              onClick={handleUseBurner}
            >
              <Wallet className="w-3 h-3" />
              Fall back to burner (demo only)
            </button>
          )}

          <button
            className="w-full text-left px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center gap-2 text-rose-600"
            onClick={handleReset}
          >
            <RefreshCw className="w-3 h-3" />
            Reset burner account
          </button>
        </div>
      )}
    </div>
  )
}
