/** Status badges built from the theme's semantic variants only. */
import { CheckIcon, XIcon } from "lucide-react"
import type { Session } from "@intatto/config/session"
import { Badge } from "@/components/ui/badge"

const SESSION_VARIANT: Record<Session, "success-light" | "info-light" | "warning-light" | "destructive-light"> = {
  OPEN: "success-light",
  EXTENDED: "info-light",
  CLOSED: "warning-light",
  HALTED: "destructive-light",
  CORPORATE_ACTION: "destructive-light",
  UNKNOWN: "destructive-light",
}

export function SessionBadge({ session }: { session: Session }) {
  return (
    <Badge variant={SESSION_VARIANT[session]} data-session={session}>
      {session}
    </Badge>
  )
}

/** A guard or check result: "pass" in green, "fail" in red, "not checked" in grey. */
export function Check({ ok, label }: { ok: boolean | null; label?: string }) {
  if (ok === null) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        {label ?? "not checked"}
      </Badge>
    )
  }
  return (
    <Badge variant={ok ? "success-light" : "destructive-light"} data-check={ok ? "pass" : "fail"}>
      {ok ? <CheckIcon aria-hidden /> : <XIcon aria-hidden />}
      {label ?? (ok ? "pass" : "fail")}
    </Badge>
  )
}
