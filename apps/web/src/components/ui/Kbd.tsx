import type { ReactNode } from "react"
import { cn } from "@/lib/cn"

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 items-center justify-center rounded border border-slate-600 bg-slate-800 px-1 font-mono text-[10px] font-medium text-slate-300 shadow-sm",
        className,
      )}
    >
      {children}
    </kbd>
  )
}

export function KbdDark({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 items-center justify-center rounded border border-emerald-900/50 bg-emerald-600/40 px-1 font-mono text-[10px] font-bold text-slate-950",
        className,
      )}
    >
      {children}
    </kbd>
  )
}
