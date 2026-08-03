"use client"

import { CONTRACT_ADDRESS } from "@/lib/genlayer"
import { Shield } from "lucide-react"

export function ContractInfoFooter() {
  const address = CONTRACT_ADDRESS;
  const explorerUrl = `https://studio.genlayer.com/?import-contract=${address}`;

  return (
    <footer className="w-full py-4 border-t bg-background mt-auto">
      <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 dark:text-slate-400 gap-2">
        <div className="flex items-center gap-1.5 font-medium">
          <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <span>DoodleGuard Protocol</span>
        </div>
        <div className="flex gap-4 items-center">
          {address ? (
            <div className="flex gap-1.5 items-center font-mono">
              <span className="text-slate-400">Contract:</span>
              <a 
                href={explorerUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="hover:underline text-purple-600 dark:text-purple-400 font-bold"
              >
                {address}
              </a>
            </div>
          ) : (
            <span className="text-rose-500">Contract not configured (.env missing)</span>
          )}
          <span>Network: <strong className="text-slate-700 dark:text-slate-300">studionet</strong></span>
        </div>
        <div>
          © 2026 DoodleGuard. Powered by GenLayer.
        </div>
      </div>
    </footer>
  )
}
