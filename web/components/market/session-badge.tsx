import type { Session } from "@intatto/config/session"
import { Badge } from "@/components/ui/badge"
import { SESSION_LABEL, SESSION_TONE } from "./copy"

const VARIANT = {
  success: "success-light",
  info: "info-light",
  warning: "warning-light",
  destructive: "destructive-light",
} as const

/** The market session as a badge: its contract name plus a plain label. */
export function SessionBadge({ session, size = "sm" }: { session: Session; size?: "sm" | "lg" }) {
  return (
    <Badge variant={VARIANT[SESSION_TONE[session]]} size={size} data-session={session}>
      {session}
      <span className="sr-only"> ({SESSION_LABEL[session]})</span>
    </Badge>
  )
}
