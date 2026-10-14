import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"
import type { ReactNode } from "react"

export function SandboxPageHeader({ title, description, children, back = true }: {
  title: string; description: ReactNode; children?: ReactNode; back?: boolean
}) {
  return (
    <header className="grid min-w-0 gap-3">
      {back ? <Link href="/sandbox" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon aria-hidden className="size-3.5" />Sandbox</Link> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <div className="text-sm leading-relaxed text-muted-foreground">{description}</div>
        </div>
        {children}
      </div>
    </header>
  )
}
