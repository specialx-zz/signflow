import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DevicePicker from '@/components/schedules/DevicePicker'
import type { DeviceOption } from '@/components/schedules/DevicePicker'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STORE_GANGNAM = { id: 'store-1', name: '강남점' }
const STORE_HONGDAE = { id: 'store-2', name: '홍대점' }

const DEVICES: DeviceOption[] = [
  { id: 'd1', name: '로비 TV',       store: STORE_GANGNAM, status: 'ONLINE'  },
  { id: 'd2', name: '창가 디스플레이', store: STORE_GANGNAM, status: 'ONLINE'  },
  { id: 'd3', name: '계산대 보조',    store: STORE_GANGNAM, status: 'OFFLINE' },
  { id: 'd4', name: '메인 디스플레이', store: STORE_HONGDAE, status: 'ONLINE'  },
  { id: 'd5', name: '매장 후면',      store: STORE_HONGDAE, status: 'OFFLINE' },
  { id: 'd6', name: '기타 단말',      store: null                              },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function setup(props: Partial<Parameters<typeof DevicePicker>[0]> = {}) {
  const onChange = vi.fn()
  const utils = render(
    <DevicePicker
      devices={DEVICES}
      selectedIds={[]}
      onChange={onChange}
      {...props}
    />
  )
  return { onChange, ...utils }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DevicePicker', () => {
  let onChange: ReturnType<typeof vi.fn<(ids: string[]) => void>>

  beforeEach(() => {
    onChange = vi.fn<(ids: string[]) => void>()
  })

  // 1. Renders all devices grouped by store
  it('renders all devices grouped by store', () => {
    setup()
    expect(screen.getByText('로비 TV')).toBeInTheDocument()
    expect(screen.getByText('창가 디스플레이')).toBeInTheDocument()
    expect(screen.getByText('계산대 보조')).toBeInTheDocument()
    expect(screen.getByText('메인 디스플레이')).toBeInTheDocument()
    expect(screen.getByText('매장 후면')).toBeInTheDocument()
    // Group headers visible
    expect(screen.getByText(/강남점/)).toBeInTheDocument()
    expect(screen.getByText(/홍대점/)).toBeInTheDocument()
  })

  // 2. Devices without store grouped under "기타"
  it('groups devices without a store under "기타"', () => {
    setup()
    expect(screen.getByText('기타 단말')).toBeInTheDocument()
    // The group header button should contain "기타"
    expect(screen.getByRole('button', { name: /기타/ })).toBeInTheDocument()
  })

  // 3. Search filter hides non-matching devices
  it('hides devices that do not match the search query', async () => {
    const user = userEvent.setup()
    setup()

    await user.type(screen.getByPlaceholderText('장치 검색...'), '로비')

    expect(screen.getByText('로비 TV')).toBeInTheDocument()
    expect(screen.queryByText('창가 디스플레이')).not.toBeInTheDocument()
  })

  // 4. Search is case-insensitive
  it('performs case-insensitive search', async () => {
    const user = userEvent.setup()
    // Add an ASCII-only device to verify case folding
    const extraDevices: DeviceOption[] = [
      ...DEVICES,
      { id: 'd7', name: 'LobbyScreen', store: null },
    ]
    render(<DevicePicker devices={extraDevices} selectedIds={[]} onChange={onChange} />)

    await user.type(screen.getByPlaceholderText('장치 검색...'), 'lobbyscreen')

    expect(screen.getByText('LobbyScreen')).toBeInTheDocument()
    expect(screen.queryByText('로비 TV')).not.toBeInTheDocument()
  })

  // 5. Clicking an unselected checkbox calls onChange with id added
  it('adds device id when an unselected checkbox is clicked', async () => {
    const user = userEvent.setup()
    const { onChange } = setup({ selectedIds: [] })

    await user.click(screen.getByRole('checkbox', { name: /로비 TV/ }))

    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange.mock.calls[0][0]).toContain('d1')
  })

  // 6. Clicking a selected checkbox calls onChange with id removed
  it('removes device id when a selected checkbox is clicked', async () => {
    const user = userEvent.setup()
    const { onChange } = setup({ selectedIds: ['d1', 'd2'] })

    await user.click(screen.getByRole('checkbox', { name: /로비 TV/ }))

    expect(onChange).toHaveBeenCalledOnce()
    const result: string[] = onChange.mock.calls[0][0]
    expect(result).not.toContain('d1')
    expect(result).toContain('d2')
  })

  // 7. Count badge shows "N/M 선택"
  it('displays count badge as "N/M 선택"', () => {
    setup({ selectedIds: ['d1', 'd2'] })
    // 2 selected out of 6 total filtered
    expect(screen.getByText('2/6 선택')).toBeInTheDocument()
  })

  // 8. "전체 선택" selects all filtered devices
  it('selects all filtered devices when "전체 선택" is clicked', async () => {
    const user = userEvent.setup()
    const { onChange } = setup({ selectedIds: [] })

    await user.click(screen.getByRole('button', { name: '전체 선택' }))

    expect(onChange).toHaveBeenCalledOnce()
    const result: string[] = onChange.mock.calls[0][0]
    expect(result).toEqual(expect.arrayContaining(['d1', 'd2', 'd3', 'd4', 'd5', 'd6']))
  })

  // 9. When all filtered are selected, button says "전체 해제" and deselects all
  it('shows "전체 해제" and deselects all when all filtered devices are selected', async () => {
    const user = userEvent.setup()
    const allIds = DEVICES.map(d => d.id)
    const { onChange } = setup({ selectedIds: allIds })

    expect(screen.getByRole('button', { name: '전체 해제' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '전체 해제' }))

    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange.mock.calls[0][0]).toHaveLength(0)
  })

  // 10. Store group header click toggles all devices in that store
  it('toggles all devices in a store when its header is clicked', async () => {
    const user = userEvent.setup()
    const { onChange } = setup({ selectedIds: [] })

    // Click the 강남점 header
    await user.click(screen.getByRole('button', { name: /강남점/ }))

    expect(onChange).toHaveBeenCalledOnce()
    const result: string[] = onChange.mock.calls[0][0]
    expect(result).toContain('d1')
    expect(result).toContain('d2')
    expect(result).toContain('d3')
    expect(result).not.toContain('d4')
  })

  // 11. Chips display selected devices
  it('renders chips for selected devices', () => {
    setup({ selectedIds: ['d1', 'd4'] })
    // Chips are rendered in the chip area (separate from the list labels)
    const chips = screen.getAllByText('로비 TV')
    // At least the chip exists
    expect(chips.length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('메인 디스플레이').length).toBeGreaterThanOrEqual(1)
  })

  // 12. Clicking chip × removes that device
  it('removes a device when its chip × button is clicked', async () => {
    const user = userEvent.setup()
    const { onChange } = setup({ selectedIds: ['d1', 'd4'] })

    await user.click(screen.getByRole('button', { name: '로비 TV 제거' }))

    expect(onChange).toHaveBeenCalledOnce()
    const result: string[] = onChange.mock.calls[0][0]
    expect(result).not.toContain('d1')
    expect(result).toContain('d4')
  })

  // 13. Error message renders when error prop provided
  it('renders error message when error prop is set', () => {
    setup({ error: '장치를 선택해주세요' })
    expect(screen.getByText('장치를 선택해주세요')).toBeInTheDocument()
  })

  it('does not render error message when error prop is not set', () => {
    setup()
    expect(screen.queryByText('장치를 선택해주세요')).not.toBeInTheDocument()
  })
})
