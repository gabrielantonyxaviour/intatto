"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MenuIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ConnectControl } from "./connect-control"

export const NAV_LINKS = [
  { href: "/", label: "Market" },
  { href: "/borrow", label: "Borrow" },
  { href: "/lend", label: "Lend" },
  { href: "/risk", label: "Risk" },
  { href: "/agents", label: "Agents" },
  { href: "/sandbox", label: "Sandbox" },
  { href: "/sandbox/proof", label: "Fork proof" },
] as const

/** The most specific link that contains the current path, so /sandbox/proof does not also light up Sandbox. */
function activeHref(pathname: string): string | null {
  let best: string | null = null
  for (const { href } of NAV_LINKS) {
    const match = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
    if (match && (best === null || href.length > best.length)) best = href
  }
  return best
}

function NavLinks({ vertical, onNavigate }: { vertical?: boolean; onNavigate?: boolean }) {
  const pathname = usePathname() ?? "/"
  const active = activeHref(pathname)
  return (
    <>
      {NAV_LINKS.map(({ href, label }) => {
        const link = (
          <Link
            key={href}
            href={href}
            aria-current={active === href ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-muted hover:text-foreground",
              active === href ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
              vertical && "px-3 py-2.5 text-base",
            )}
          >
            {label}
          </Link>
        )
        return onNavigate ? (
          <SheetClose asChild key={href}>
            {link}
          </SheetClose>
        ) : (
          link
        )
      })}
    </>
  )
}

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="shrink-0 font-semibold">
          Intatto
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-0.5 lg:flex">
          <NavLinks />
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <ConnectControl />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon-lg" className="lg:hidden" aria-label="Open menu">
                <MenuIcon aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Intatto</SheetTitle>
              </SheetHeader>
              <nav aria-label="Main" className="grid gap-1 px-2">
                <NavLinks vertical onNavigate />
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
