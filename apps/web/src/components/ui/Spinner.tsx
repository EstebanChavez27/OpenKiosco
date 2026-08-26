import { Loader2 } from "lucide-react"
import { cn } from "@/lib/cn"

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-full items-center justify-center py-20", className)}>
      <Loader2 size={28} className="animate-spin text-emerald-400" />
    </div>
  )
}
