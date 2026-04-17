/**
 * Encapsulates all schedule-page-level React Query fetches.
 * Keeps SchedulesPage lean by offloading query declarations.
 */
import { useQuery } from '@tanstack/react-query'
import { scheduleApi } from '@/api/schedules'
import { playlistApi } from '@/api/playlists'
import { deviceApi } from '@/api/devices'
import { layoutApi } from '@/api/layouts'
import type { Schedule } from '@/types'

interface SelectOption { id: string; name: string }
interface LayoutSelectOption extends SelectOption { baseWidth: number; baseHeight: number }
interface DeviceSelectOption extends SelectOption {
  store?: { id: string; name: string } | null
  status?: 'ONLINE' | 'OFFLINE' | 'WARNING'
}

/**
 * Fetch schedules, playlists, devices, and layouts for the schedule page.
 * Playlists, devices, and layouts are lazily loaded only when a modal is open.
 */
export function useScheduleQueries(opts: {
  modalOpen: boolean
  detailOpen: boolean
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => scheduleApi.getAll({ limit: 100 }),
  })

  const { data: playlistData } = useQuery({
    queryKey: ['playlists-select'],
    queryFn: () => playlistApi.getAll({ limit: 100 }),
    enabled: opts.modalOpen || opts.detailOpen,
  })

  const { data: deviceData } = useQuery({
    queryKey: ['devices-select'],
    queryFn: () => deviceApi.getAll({ limit: 100 }),
    enabled: opts.modalOpen,
  })

  const { data: layoutData } = useQuery({
    queryKey: ['layouts-select'],
    queryFn: () => layoutApi.getAll({ limit: 100 }),
    enabled: opts.modalOpen,
  })

  const schedules: Schedule[] = data?.items || []

  const playlistItems: SelectOption[] =
    playlistData?.items?.map((p: any) => ({ id: p.id, name: p.name })) || []

  const layoutItems: LayoutSelectOption[] =
    layoutData?.items?.map((l: any) => ({
      id: l.id, name: l.name, baseWidth: l.baseWidth, baseHeight: l.baseHeight,
    })) || []

  const deviceItems: DeviceSelectOption[] =
    deviceData?.items?.map((d: any) => ({
      id: d.id,
      name: d.name,
      store: d.store ?? null,
      status: d.status,
    })) || []

  return { schedules, playlistItems, layoutItems, deviceItems, isLoading }
}
