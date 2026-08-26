import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/cn"

export function Card({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={cn("rounded-xl border border-slate-800 bg-slate-900/50 p-4", className)}
      {...rest}
    >
      {children}
    </div>
  )
}
