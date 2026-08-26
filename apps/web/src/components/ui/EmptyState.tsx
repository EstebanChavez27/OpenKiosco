import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

interface Props {
  icon: LucideIcon
  title: string
  hint?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, hint, action }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="rounded-full bg-slate-800 p-4 text-slate-500">
        <Icon size={28} />
      </div>
      <div>
        <p className="font-medium text-slate-300">{title}</p>
        {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      </div>
      {action}
    </div>
  )
}
