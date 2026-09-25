import type { Metadata, Viewport } from "next"
import "./globals.css"
import { ChainReady } from "@/lib/chain/context"
import { Providers } from "./providers"
import { Nav } from "./nav"
import { SandboxBanner } from "./sandbox-banner"
import { ShellSkeleton } from "./shell-skeleton"

export const metadata: Metadata = {
  title: "Intatto",
  description:
    "Borrow USDG against tokenized stocks on X Layer, with limits that know when the stock market is closed.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <Providers>
          <Nav />
          <SandboxBanner />
          <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
            <ChainReady fallback={<ShellSkeleton />}>{children}</ChainReady>
          </main>
        </Providers>
      </body>
    </html>
  )
}
