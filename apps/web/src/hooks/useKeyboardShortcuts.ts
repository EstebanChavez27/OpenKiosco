import { useEffect } from "react"

type Handler = (e: KeyboardEvent) => void

export function useKeyboardShortcuts(map: Record<string, Handler>, deps: unknown[] = []) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector("[data-modal-open]")) return
      const t = e.target as HTMLElement | null
      const typing =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      if (typing && !e.key.startsWith("F")) return
      const handler = map[e.key]
      if (handler) {
        e.preventDefault()
        handler(e)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, deps)
}
