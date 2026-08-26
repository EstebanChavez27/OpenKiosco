import type { ReactNode } from "react"
import { cn } from "@/lib/cn"

type Variant = "emerald" | "amber" | "red" | "sky" | "indigo" | "slate"

const variants: Record<Variant, string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
  amber: "border-amber-500/30 bg-amber-500/15 text-amber-400",
  red: "border-red-500/30 bg-red-500/15 text-red-400",
  sky: "border-sky-500/30 bg-sky-500/15 text-sky-400",
  indigo: "border-indigo-500/30 bg-indigo-500/15 text-indigo-300",
  slate: "border-slate-600/40 bg-slate-700/30 text-slate-300",
}

interface Props {
  variant?: Variant
  className?: string
  children: ReactNode
}

export function Badge({ variant = "slate", className, children }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
