import { useEffect } from "react"
import { useUiStore } from "@/stores/ui"

export function useOnline() {
  useEffect(() => {
    const goOnline = () => useUiStore.getState().setOnline(true)
    const goOffline = () => useUiStore.getState().setOnline(false)
    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    return () => {
      window.removeEventListener("online", goOnline)
      window.removeEventListener("offline", goOffline)
    }
  }, [])
}
