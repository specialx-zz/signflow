import { useEffect, useRef, useCallback } from 'react'
import { format, isWithinInterval, parseISO, isValid } from 'date-fns'
import { usePlayerStore } from '../store/playerStore'
import { fetchPlaylist } from '../utils/api'
import type { ScheduleEntry } from '../types'
import type { Layout } from '../components/ZoneLayoutPlayer'

const CHECK_INTERVAL = 60 * 1000 // Check every minute

/**
 * Parse HH:mm string into today's Date object.
 */
function parseTimeToday(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const now = new Date()
  now.setHours(hours, minutes, 0, 0)
  return now
}

/**
 * Determine if a schedule entry is active at the given Date.
 */
function isScheduleActive(entry: ScheduleEntry, now: Date): boolean {
  try {
    // Check date range
    const startDate = parseISO(entry.startDate)
    const endDate = parseISO(entry.endDate)
    if (!isValid(startDate) || !isValid(endDate)) return false

    const todayStr = format(now, 'yyyy-MM-dd')
    const startDateStr = format(startDate, 'yyyy-MM-dd')
    const endDateStr = format(endDate, 'yyyy-MM-dd')

    if (todayStr < startDateStr || todayStr > endDateStr) return false

    // Check repeat / day of week
    const dayOfWeek = now.getDay() // 0=Sun, 1=Mon, ...
    if (entry.repeat === 'NONE') {
      // Active on any day within the date range (already checked above)
      // For single-day schedules startDate === endDate, for multi-day we allow the range
    } else if (entry.repeat === 'WEEKLY') {
      if (entry.daysOfWeek && entry.daysOfWeek.length > 0) {
        if (!entry.daysOfWeek.includes(dayOfWeek)) return false
      }
    } else if (entry.repeat === 'MONTHLY') {
      // MONTHLY: only active on the same day-of-month as startDate
      const startDayOfMonth = startDate.getDate()
      if (now.getDate() !== startDayOfMonth) return false
    }
    // DAILY: no day restriction beyond date range

    // Check time window
    const startTime = parseTimeToday(entry.startTime)
    const endTime = parseTimeToday(entry.endTime)

    // Handle overnight schedules (endTime < startTime)
    if (endTime < startTime) {
      return now >= startTime || now <= endTime
    }

    return isWithinInterval(now, { start: startTime, end: endTime })
  } catch {
    return false
  }
}

export function useSchedule() {
  const {
    schedules,
    currentSchedule,
    setCurrentSchedule,
    setCurrentPlaylist,
    setCurrentLayout,
    currentPlaylist,
    currentLayout,
    config,
  } = usePlayerStore()

  const lastScheduleIdRef = useRef<string | null>(null)
  const loadingRef = useRef(false)

  const loadContentForSchedule = useCallback(
    async (entry: ScheduleEntry) => {
      if (loadingRef.current) return
      loadingRef.current = true

      try {
        // V5.2: 조건부 재생 — 태그 매칭으로 플레이리스트 선택
        let resolvedPlaylist = entry.playlist
        if (entry.conditions && entry.conditions.length > 0) {
          const { deviceTags } = usePlayerStore.getState()
          if (deviceTags) {
            // V5.3: priority 기준 정렬 후 매칭 (높은 priority 우선)
            const sortedConditions = [...entry.conditions].sort((a, b) => b.priority - a.priority)
            for (const condition of sortedConditions) {
              const deviceValue = deviceTags[condition.tagKey]
              if (deviceValue === condition.tagValue && condition.playlist) {
                console.log(
                  `[Schedule] Tag match: ${condition.tagKey}=${condition.tagValue}`,
                  `→ Playlist: ${condition.playlist.name}`
                )
                resolvedPlaylist = condition.playlist
                break
              }
            }
            if (resolvedPlaylist === entry.playlist) {
              console.log('[Schedule] No tag match, using fallback playlist')
            }
          }
        }

        // If schedule has a layout, use layout mode
        if (entry.layout) {
          setCurrentLayout(entry.layout as Layout)
          setCurrentPlaylist(null)
        } else if (resolvedPlaylist?.items && resolvedPlaylist.items.length > 0) {
          // If playlist is already embedded in the schedule, use it directly
          setCurrentPlaylist(resolvedPlaylist)
          setCurrentLayout(null)
        } else if (resolvedPlaylist?.id) {
          // Otherwise fetch from server
          const playlist = await fetchPlaylist(resolvedPlaylist.id)
          setCurrentPlaylist(playlist)
          setCurrentLayout(null)
        }
      } catch (error) {
        console.error('[Schedule] Failed to load content:', error)
        // Keep showing current content if available
      } finally {
        loadingRef.current = false
      }
    },
    [setCurrentPlaylist, setCurrentLayout]
  )

  const checkAndActivateSchedule = useCallback(() => {
    const now = new Date()

    // Debug: log all schedules and their active status
    if (schedules.length > 0) {
      schedules.forEach(entry => {
        const active = isScheduleActive(entry, now)
        console.log(
          `[Schedule] "${entry.id.slice(-6)}" active=${active}`,
          `| date: ${entry.startDate}~${entry.endDate}`,
          `| time: ${entry.startTime}~${entry.endTime}`,
          `| now: ${format(now, 'yyyy-MM-dd HH:mm')}`,
          `| layout: ${!!entry.layout} playlist: ${!!entry.playlist}`
        )
      })
    }

    // Find the first active schedule
    const active = schedules.find((entry) => isScheduleActive(entry, now)) ?? null

    const activeId = active?.id ?? null

    if (activeId !== lastScheduleIdRef.current) {
      console.log(
        '[Schedule] Switching schedule:',
        lastScheduleIdRef.current,
        '→',
        activeId
      )
      lastScheduleIdRef.current = activeId
      setCurrentSchedule(active)

      if (active) {
        loadContentForSchedule(active)
      } else {
        // V5.2: 기본 채널 fallback — 스케줄 없을 때 채널 콘텐츠 재생
        const { defaultChannel } = usePlayerStore.getState()
        if (defaultChannel && defaultChannel.items && defaultChannel.items.length > 0) {
          console.log(`[Schedule] No active schedule → Channel fallback: ${defaultChannel.name}`)
          setCurrentPlaylist({
            id: defaultChannel.id,
            name: defaultChannel.name,
            type: 'CHANNEL',
            items: defaultChannel.items,
          })
          setCurrentLayout(null)
        } else {
          // No active schedule, no default channel → show default screen
          setCurrentPlaylist(null)
          setCurrentLayout(null)
        }
      }
    }
  }, [schedules, setCurrentSchedule, setCurrentPlaylist, setCurrentLayout, loadContentForSchedule])

  // Check on mount and whenever schedules change
  useEffect(() => {
    checkAndActivateSchedule()
    const timer = setInterval(checkAndActivateSchedule, CHECK_INTERVAL)
    return () => clearInterval(timer)
  }, [checkAndActivateSchedule])

  return {
    currentSchedule,
    currentPlaylist,
    isDefaultScreen: currentPlaylist === null && currentLayout === null,
  }
}
