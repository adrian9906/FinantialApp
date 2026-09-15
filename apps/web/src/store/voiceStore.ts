import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { VoiceMovementDraft } from '@/lib/voice-parser'

interface VoiceState {
  open: boolean
  compact: boolean
  enabled: boolean
  language: string
  position: { x: number; y: number } | null
  drafts: VoiceMovementDraft[]
  setOpen: (open: boolean) => void
  setCompact: (compact: boolean) => void
  setEnabled: (enabled: boolean) => void
  setLanguage: (language: string) => void
  setPosition: (position: { x: number; y: number }) => void
  setDrafts: (drafts: VoiceMovementDraft[]) => void
  clear: () => void
}
export const useVoiceStore = create<VoiceState>()(persist((set) => ({
  open: false, compact: false, enabled: true, language: 'es-ES', position: null, drafts: [],
  setOpen: (open) => set({ open }), setCompact: (compact) => set({ compact, open: compact }),
  setEnabled: (enabled) => set({ enabled }), setLanguage: (language) => set({ language }),
  setPosition: (position) => set({ position }), setDrafts: (drafts) => set({ drafts }),
  clear: () => set({ drafts: [], open: false, compact: false }),
}), { name: 'plata-voice-preferences', partialize: ({ enabled, language, position }) => ({ enabled, language, position }) }))
