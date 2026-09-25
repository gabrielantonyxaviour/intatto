"use client"

import { useId, type ReactNode } from "react"
import { InfoIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type DefinitionPopoverProps = {
  term: string
  children: ReactNode
  /** Optional units and/or source, rendered after the explanation. */
  source?: ReactNode
  side?: "top" | "right" | "bottom" | "left"
  contentTestId?: string
}

export function DefinitionPopover({ term, children, source, side = "top", contentTestId }: DefinitionPopoverProps) {
  const titleId = useId()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`About ${term}`}>
          <InfoIcon aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side={side} aria-labelledby={titleId} data-testid={contentTestId}>
        <h2 id={titleId} className="font-medium">{term}</h2>
        <div>{children}</div>
        {source != null && <div className="text-xs text-muted-foreground">{source}</div>}
      </PopoverContent>
    </Popover>
  )
}
