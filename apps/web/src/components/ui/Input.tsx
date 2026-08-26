import { useId } from "react"
import type { InputHTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/cn"

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  mono?: boolean
  suffix?: ReactNode
  wrapperClassName?: string
}

export function Input({
  label,
  error,
  hint,
  mono,
  suffix,
  className,
  wrapperClassName,
  id,
  ...rest
}: Props) {
  const autoId = useId()
  const inputId = id ?? autoId

  return (
    <div className={cn("space-y-1", wrapperClassName)}>
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-slate-400">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          className={cn(
            "w-full rounded-lg border bg-slate-900 px-3 py-2 text-sm text-slate-100 transition",
            "placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30",
            error ? "border-red-500/60" : "border-slate-700 focus:border-emerald-500",
            mono && "font-mono",
            suffix != null && "pr-10",
            className,
          )}
          {...rest}
        />
        {suffix && (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
            {suffix}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
