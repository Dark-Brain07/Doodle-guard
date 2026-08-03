"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Wallet, Copy, RefreshCw, ShieldCheck, AlertTriangle, ExternalLink, Key } from "lucide-react"
import {
  connectInjectedWallet,
  disconnectWallet,
  explorerAddressUrl,
  getAccountAddress,
  resetLocalAccount,
  restoreWalletSession,
  walletMode,
  WALLET_CHANGED_EVENT,
  discoveredProviders,
  EIP6963ProviderDetail,
} from "@/lib/genlayer"

export function ConnectWalletButton() {
  const [address, setAddress] = useState<string | null>(null)
  const [mode, setMode] = useState<"metamask" | "burner">("burner")
  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [providers, setProviders] = useState<EIP6963ProviderDetail[]>([])
  const [burnerBalance, setBurnerBalance] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setAddress(getAccountAddress())
    setMode(walletMode)
  }, [])

  useEffect(() => {
    const updateProviders = () => setProviders([...discoveredProviders])
    updateProviders()
    window.addEventListener("eip6963:providers-updated", updateProviders)
    
    restoreWalletSession()
      .catch(() => {})
      .finally(refresh)
    const handler = () => refresh()
    window.addEventListener(WALLET_CHANGED_EVENT, handler)
    return () => {
      window.removeEventListener(WALLET_CHANGED_EVENT, handler)
      window.removeEventListener("eip6963:providers-updated", updateProviders)
    }
  }, [refresh])

  useEffect(() => {
    if (mode === "burner" && address && menuOpen) {
      fetch("https://studio.genlayer.com/api", {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getBalance",
          params: [address, "latest"],
          id: 1
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data && data.result) {
          const gen = parseInt(data.result, 16) / 1e18;
          setBurnerBalance(gen.toFixed(4));
        }
      })
      .catch(() => {});
    }
  }, [mode, address, menuOpen]);

  const handleConnect = async (detail?: EIP6963ProviderDetail) => {
    setConnectError(null)
    setConnecting(true)
    try {
      await connectInjectedWallet(detail)
      setMenuOpen(false)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to connect"
      setConnectError(msg)
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = () => {
    disconnectWallet()
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
              {isMM ? "MetaMask (studionet)" : "Local burner"}
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

          {!isMM && providers.length > 0 && (
            <div className="space-y-2 py-2">
              <div className="text-xs font-semibold text-slate-500 uppercase">Available Wallets</div>
              {providers.map((p) => (
                <Button key={p.info.uuid} className="w-full flex justify-start items-center gap-2" onClick={() => handleConnect(p)} disabled={connecting}>
                  <img src={p.info.icon} alt={p.info.name} className="w-5 h-5 rounded-sm" />
                  {connecting ? "Connecting…" : `Connect ${p.info.name}`}
                </Button>
              ))}
            </div>
          )}

          {!isMM && providers.length === 0 && (
            <div className="space-y-2 py-2">
              <Button className="w-full flex justify-start items-center gap-2" onClick={() => handleConnect()} disabled={connecting}>
                <ShieldCheck className="w-4 h-4 mr-1" />
                {connecting ? "Connecting…" : "Connect Browser Wallet"}
              </Button>
              <div className="text-xs text-slate-500">
                No wallets detected. Make sure your browser extension is active.
              </div>
            </div>
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
              className="w-full text-left px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center gap-2 text-rose-600"
              onClick={handleDisconnect}
            >
              <ExternalLink className="w-3 h-3" />
              Disconnect Wallet
            </button>
          )}

          <button
            className="w-full text-left px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center gap-2 text-rose-600"
            onClick={handleReset}
          >
            <RefreshCw className="w-3 h-3" />
            Reset burner account
          </button>
          <button
            className="w-full text-left px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center gap-2 text-blue-600"
            onClick={() => {
              const pk = localStorage.getItem("doodle-guard-account-pk");
              if (pk) {
                navigator.clipboard.writeText(pk);
                alert(`Burner Private Key:\n\n${pk}\n\n✅ Copied to clipboard!`);
              } else {
                alert("No burner key found.");
              }
            }}
          >
            <Key className="w-3 h-3" />
            Copy Burner Private Key
          </button>
          {mode === "burner" && (
            <div className="w-full text-left px-2 py-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800 mt-1">
              <span>Burner Balance:</span>
              <span className="font-mono text-foreground font-bold">{burnerBalance !== null ? `${burnerBalance} GEN` : "..."}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
