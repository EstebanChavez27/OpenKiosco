import { useEffect } from "react"
import type { ReactNode } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/cn"

interface Props {
  open: boolean
  onClose: () => void
  title: string
  icon?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: "sm" | "md" | "lg" | "xl"
}

const sizeMap = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
}

export function Modal({ open, onClose, title, icon, children, footer, size = "md" }: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener("keydown", handler, true)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", handler, true)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      data-modal-open
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={cn(
          "flex max-h-[90vh] w-full animate-pop flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl",
          sizeMap[size],
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-4">
          {icon}
          <h2 className="font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-800 bg-slate-900/60 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
