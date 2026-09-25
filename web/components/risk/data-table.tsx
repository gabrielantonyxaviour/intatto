"use client"

/**
 * A table on wide screens and a stack of cards below `breakpoint`, from one column list, so every view's
 * rows stay readable on a phone without sideways scrolling. Row attributes go on both forms.
 */
import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export type Column<T> = {
  id: string
  header: ReactNode
  cell: (row: T) => ReactNode
  align?: "right"
  /** Hide the label on cards (e.g. a title cell). */
  cardTitle?: boolean
  className?: string
}

const SPLIT = {
  md: { table: "hidden md:block", cards: "md:hidden" },
  lg: { table: "hidden lg:block", cards: "lg:hidden" },
  xl: { table: "hidden xl:block", cards: "xl:hidden" },
  /** Cards at every width. The keeper sheet is narrower than the page, so a table overflows it. */
  sheet: { table: "hidden", cards: "" },
} as const

type RowAttrs = HTMLAttributes<HTMLElement> & Record<`data-${string}`, string | number | undefined>

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  rowAttrs,
  rowClassName,
  breakpoint = "md",
  label,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  rowAttrs?: (row: T) => RowAttrs
  rowClassName?: (row: T) => string | undefined
  breakpoint?: keyof typeof SPLIT
  label: string
}) {
  const split = SPLIT[breakpoint]
  return (
    <>
      <div className={split.table} data-form="table">
        <Table aria-label={label}>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.id} className={cn("text-xs text-muted-foreground", c.align === "right" && "text-right")}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={rowKey(row)} {...rowAttrs?.(row)} className={rowClassName?.(row)}>
                {columns.map((c) => (
                  <TableCell
                    key={c.id}
                    data-col={c.id}
                    className={cn("align-top tabular-nums", c.align === "right" && "text-right", c.className)}
                  >
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className={cn("grid gap-3", split.cards)} data-form="cards" aria-label={label}>
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            {...rowAttrs?.(row)}
            className={cn("rounded-lg border bg-card p-3 text-sm", rowClassName?.(row))}
          >
            <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5">
              {columns.map((c) =>
                c.cardTitle ? (
                  <div key={c.id} data-col={c.id} className="col-span-2 min-w-0 font-medium">
                    {c.cell(row)}
                  </div>
                ) : (
                  <div key={c.id} className="contents">
                    <dt className="text-xs text-muted-foreground">{c.header}</dt>
                    <dd data-col={c.id} className="min-w-0 text-right tabular-nums break-words">
                      {c.cell(row)}
                    </dd>
                  </div>
                ),
              )}
            </dl>
          </li>
        ))}
      </ul>
    </>
  )
}
