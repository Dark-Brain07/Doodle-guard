"use client"

import { useEffect } from "react"
import { wrapProviderWithSnapsBypass } from "@/lib/snapsBypass"

/**
 * On MetaMask mobile's in-app dApp browser, `window.ethereum` can be a
 * non-writable / non-configurable property. Reassigning it throws in strict
 * mode and takes down the whole app with an opaque "This page couldn't load"
 * screen. Guard every access so a failure here can never crash the render.
 */
export function SnapsBypassInitializer() {
  useEffect(() => {
    try {
      const browserWindow = window as Window & {
        ethereum?: Parameters<typeof wrapProviderWithSnapsBypass>[0]
      }
      const provider = browserWindow.ethereum
      if (!provider) return
      const wrapped = wrapProviderWithSnapsBypass(provider)
      try {
        // Preferred: overwrite the property in place.
        browserWindow.ethereum = wrapped
      } catch {
        // MetaMask mobile marks ethereum non-writable; defineProperty gives
        // a second chance, and if even that fails we silently leave the raw
        // provider in place — the snap request will simply return whatever
        // MetaMask returns natively, which is still fine.
        try {
          Object.defineProperty(browserWindow, "ethereum", {
            value: wrapped,
            configurable: true,
            writable: true,
          })
        } catch {
          /* leave raw provider in place */
        }
      }
    } catch (err) {
      // NEVER let this take down the app.
      console.warn("SnapsBypassInitializer skipped:", err)
    }
  }, [])

  return null
}
