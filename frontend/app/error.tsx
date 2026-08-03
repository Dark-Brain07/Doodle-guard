"use client"

import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface the crash in the console so users copying logs can share
    // something actionable.
    console.error("Global error boundary caught:", error)
  }, [error])

  const hardReload = () => {
    if (typeof window === "undefined") {
      reset()
      return
    }
    try {
      // Kill any stale service worker + cached bundle chunks that a prior
      // deploy might have installed.
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .getRegistrations()
          .then((rs) => rs.forEach((r) => r.unregister()))
          .catch(() => {})
      }
      if (typeof caches !== "undefined") {
        caches
          .keys()
          .then((keys) => keys.forEach((k) => caches.delete(k)))
          .catch(() => {})
      }
    } catch {
      /* ignore */
    }
    window.location.reload()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background text-foreground">
      <div className="max-w-lg w-full space-y-4 text-center">
        <div className="mx-auto w-14 h-14 rounded-full border-2 border-rose-500/60 flex items-center justify-center">
          <span className="text-rose-500 text-2xl font-bold">!</span>
        </div>
        <h1 className="text-2xl font-semibold">Something crashed in the browser</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          The page hit an unexpected client-side error. This is usually a stale
          cached bundle from an older deploy. Hard-reloading below clears the
          service worker and cache first.
        </p>
        <div className="rounded border bg-slate-50 dark:bg-slate-900/60 p-3 text-left text-xs font-mono text-slate-600 dark:text-slate-400 break-words">
          {error.message}
          {error.digest ? <div className="opacity-60 mt-1">digest: {error.digest}</div> : null}
        </div>
        <div className="flex gap-2 justify-center">
          <button
            onClick={hardReload}
            className="rounded px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-medium"
          >
            Hard reload
          </button>
          <button
            onClick={() => reset()}
            className="rounded px-4 py-2 border font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}
