import type { Ref } from "react"
import { ScanLine, X } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Kbd } from "@/components/ui/Kbd"

interface Props {
  inputRef: Ref<HTMLInputElement>
  value: string
  onChange: (v: string) => void
  onSubmit: (v: string) => void
  qtyPrefix: number | null
  onClearQty: () => void
}

export function SearchBar({ inputRef, value, onChange, onSubmit, qtyPrefix, onClearQty }: Props) {
  return (
    <div className="relative">
      <ScanLine size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit(value)}
        placeholder="Escaneá código de barras o buscá un producto..."
        className="h-12 w-full rounded-xl border border-slate-700 bg-slate-900 pl-11 pr-28 text-base text-slate-100 placeholder:text-slate-600 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      />
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
        {qtyPrefix !== null && (
          <button onClick={onClearQty} title="Cancelar cantidad">
            <Badge variant="emerald" className="cursor-pointer">
              {qtyPrefix}× <X size={10} />
            </Badge>
          </button>
        )}
        <Kbd>F2</Kbd>
      </div>
    </div>
  )
}
