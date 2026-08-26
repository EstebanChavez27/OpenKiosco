import { useEffect, useRef } from "react"

export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const buffer = useRef("")

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
      ) {
        return
      }
      if (e.key === "Enter") {
        const code = buffer.current.trim()
        buffer.current = ""
        if (code.length >= 4) onScan(code)
        return
      }
      if (e.key.length === 1 && /[0-9a-zA-Z-]/.test(e.key)) {
        buffer.current += e.key
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled, onScan])
}
