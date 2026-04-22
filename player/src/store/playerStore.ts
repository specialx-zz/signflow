import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DeviceConfig, ScheduleEntry, Playlist, ChannelData, WallInfo, EmergencyMessage } from '../types'
import type { Layout } from '../components/ZoneLayoutPlayer'

interface PlayerStore {
  // Config
  config: DeviceConfig | null
  setConfig: (config: DeviceConfig) => void
  clearConfig: () => void

  // Connection
  isConnected: boolean
  isServerReachable: boolean
  setConnected: (v: boolean) => void
  setServerReachable: (v: boolean) => void

  // Schedule
  schedules: ScheduleEntry[]
  setSchedules: (s: ScheduleEntry[]) => void
  currentSchedule: ScheduleEntry | null
  setCurrentSchedule: (s: ScheduleEntry | null) => void

  // Playback
  currentPlaylist: Playlist | null
  currentLayout: Layout | null
  currentItemIndex: number
  isPlaying: boolean
  setCurrentPlaylist: (p: Playlist | null) => void
  setCurrentLayout: (layout: Layout | null) => void
  setCurrentItemIndex: (i: number) => void
  nextItem: () => void
  prevItem: () => void
  setIsPlaying: (v: boolean) => void

  // V5.2: Channel fallback
  defaultChannel: ChannelData | null
  setDefaultChannel: (ch: ChannelData | null) => void

  // V5.2: Device tags (conditional playback)
  deviceTags: Record<string, string> | null
  setDeviceTags: (tags: Record<string, string> | null) => void

  // V5.2: Screen wall
  wallInfo: WallInfo | null
  setWallInfo: (info: WallInfo | null) => void

  // V5.3: Emergency messages
  emergencyMessages: EmergencyMessage[]
  addEmergencyMessage: (msg: EmergencyMessage) => void
  dismissEmergencyMessage: (id: string) => void
  clearExpiredEmergencies: () => void

  // OSD
  showOSD: boolean
  toggleOSD: () => void
  setShowOSD: (v: boolean) => void

  // Display settings
  volume: number
  brightness: number
  setVolume: (v: number) => void
  setBrightness: (v: number) => void
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      // Config
      config: null,
      setConfig: (config) => set({ config }),
      clearConfig: () => set({ config: null }),

      // Connection
      isConnected: false,
      isServerReachable: false,
      setConnected: (isConnected) => set({ isConnected }),
      setServerReachable: (isServerReachable) => set({ isServerReachable }),

      // Schedule
      schedules: [],
      setSchedules: (schedules) => set({ schedules }),
      currentSchedule: null,
      setCurrentSchedule: (currentSchedule) => set({ currentSchedule }),

      // Playback
      currentPlaylist: null,
      currentLayout: null,
      currentItemIndex: 0,
      isPlaying: true,
      setCurrentPlaylist: (currentPlaylist) =>
        set({ currentPlaylist, currentItemIndex: 0 }),
      setCurrentLayout: (currentLayout) => set({ currentLayout, currentItemIndex: 0 }),
      setCurrentItemIndex: (currentItemIndex) => set({ currentItemIndex }),
      nextItem: () => {
        const { currentPlaylist, currentItemIndex } = get()
        if (!currentPlaylist || currentPlaylist.items.length === 0) return
        const nextIndex = (currentItemIndex + 1) % currentPlaylist.items.length
        set({ currentItemIndex: nextIndex })
      },
      prevItem: () => {
        const { currentPlaylist, currentItemIndex } = get()
        if (!currentPlaylist || currentPlaylist.items.length === 0) return
        const prevIndex =
          currentItemIndex === 0
            ? currentPlaylist.items.length - 1
            : currentItemIndex - 1
        set({ currentItemIndex: prevIndex })
      },
      setIsPlaying: (isPlaying) => set({ isPlaying }),

      // V5.2: Channel fallback
      defaultChannel: null,
      setDefaultChannel: (defaultChannel) => set({ defaultChannel }),

      // V5.2: Device tags
      deviceTags: null,
      setDeviceTags: (deviceTags) => set({ deviceTags }),

      // V5.2: Screen wall
      wallInfo: null,
      setWallInfo: (wallInfo) => set({ wallInfo }),

      // V5.3: Emergency messages
      emergencyMessages: [],
      addEmergencyMessage: (msg) => set((state) => {
        if (state.emergencyMessages.find(m => m.id === msg.id)) return state
        return {
          emergencyMessages: [...state.emergencyMessages, msg].sort((a, b) => b.priority - a.priority)
        }
      }),
      dismissEmergencyMessage: (id) => set((state) => ({
        emergencyMessages: state.emergencyMessages.filter(m => m.id !== id)
      })),
      clearExpiredEmergencies: () => set((state) => {
        const now = new Date()
        return {
          emergencyMessages: state.emergencyMessages.filter(
            m => !m.expiresAt || new Date(m.expiresAt) > now
          )
        }
      }),

      // OSD
      showOSD: false,
      toggleOSD: () => set((state) => ({ showOSD: !state.showOSD })),
      setShowOSD: (showOSD) => set({ showOSD }),

      // Display settings
      volume: 100,
      brightness: 100,
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(100, volume)) }),
      setBrightness: (brightness) =>
        set({ brightness: Math.max(10, Math.min(100, brightness)) }),
    }),
    {
      name: 'vuesign-player-store',
      // Only persist config and display settings, not runtime state
      partialize: (state) => ({
        config: state.config,
        volume: state.volume,
        brightness: state.brightness,
      }),
    }
  )
)
