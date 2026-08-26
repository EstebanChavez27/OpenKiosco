import { create } from "zustand"

interface UiState {
  online: boolean
  lastSync: number
  setOnline: (v: boolean) => void
  touchSync: () => void
}

let lastTouch = 0

export const useUiStore = create<UiState>((set) => ({
  online: true,
  lastSync: Date.now(),
  setOnline: (online) => set({ online }),
  touchSync: () => {
    const now = Date.now()
    if (now - lastTouch > 5000) {
      lastTouch = now
      set({ lastSync: now })
    }
  },
}))
