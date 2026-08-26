import type { ButtonHTMLAttributes, ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/cn"

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "amber"
type Size = "sm" | "md" | "lg" | "xl" | "icon"

const variants: Record<Variant, string> = {
  primary:
    "bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 font-semibold",
  secondary:
    "bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700",
  ghost: "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
  danger: "bg-red-500/90 text-white hover:bg-red-500",
  outline:
    "border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10",
  amber: "bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-lg shadow-amber-500/20 font-semibold",
}

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-sm",
  xl: "h-14 px-6 text-base",
  icon: "h-9 w-9 p-0",
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children?: ReactNode
}

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60",
        "disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : null}
      {children}
    </button>
  )
}
