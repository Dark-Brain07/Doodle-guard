"use client"

import { useEffect } from "react"
import { wrapProviderWithSnapsBypass } from "@/lib/snapsBypass"

export function SnapsBypassInitializer() {
  useEffect(() => {
    const browserWindow = window as Window & { ethereum?: Parameters<typeof wrapProviderWithSnapsBypass>[0] };
    if (browserWindow.ethereum) {
      browserWindow.ethereum = wrapProviderWithSnapsBypass(browserWindow.ethereum);
    }
  }, [])

  return null
}
