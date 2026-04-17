import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScheduleSidebar from '@/components/schedules/ScheduleSidebar'
import type { Schedule, ScheduleDevice } from '@/types'

// ── Factory ──────────────────────────────────────────────────────────────────

/** Build a minimal Schedule; callers override only the fields they care about. */
const mk = (over: Partial<Schedule>): Schedule =>
  ({
    id: 'x',
    name: 'Test Schedule',
    type: 'CONTENT',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    repeatType: 'NONE',
    status: 'DRAFT',
    isActive: true,
    createdBy: 'u1',
    devices: [] as ScheduleDevice[],
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Schedule

const defaultProps = (
  schedules: Schedule[],
  overrides: Partial<Parameters<typeof ScheduleSidebar>[0]> = {}
) => ({
  schedules,
  canManage: true,
  onSelect: vi.fn(),
  onEdit: vi.fn(),
  onDeploy: vi.fn(),
  onDelete: vi.fn(),
  onDuplicate: vi.fn(),
  ...overrides,
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ScheduleSidebar', () => {
  beforeEach(() => { vi.clearAllMocks() })

  // 1. Renders all schedules with no filter/search active
  it('renders all schedules when no filter or search is active', () => {
    const schedules = [
      mk({ id: '1', name: 'Alpha' }),
      mk({ id: '2', name: 'Beta' }),
    ]
    render(<ScheduleSidebar {...defaultProps(schedules)} />)

    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  // 2. Search filters by name (case-insensitive)
  it('filters schedules by search input (case-insensitive)', async () => {
    const schedules = [
      mk({ id: '1', name: 'Promotion Banner' }),
      mk({ id: '2', name: 'Summer Sale' }),
    ]
    render(<ScheduleSidebar {...defaultProps(schedules)} />)

    const input = screen.getByPlaceholderText('Search...')
    await userEvent.type(input, 'promo')

    expect(screen.getByText('Promotion Banner')).toBeInTheDocument()
    expect(screen.queryByText('Summer Sale')).not.toBeInTheDocument()
  })

  // 3. Filter chip shows only ACTIVE schedules
  // Use far-future endDate so classifyStatus returns 'active' regardless of current date
  it('filter chip shows only ACTIVE schedules in date range', async () => {
    const schedules = [
      mk({ id: '1', name: 'Future Active', status: 'ACTIVE', startDate: '2025-01-01', endDate: '2099-12-31' }),
      mk({ id: '2', name: 'Always Draft', status: 'DRAFT', startDate: '2025-01-01', endDate: '2099-12-31' }),
    ]
    render(<ScheduleSidebar {...defaultProps(schedules)} />)

    // Use getAllByRole since multiple chips exist; click the first "활성" chip
    const chips = screen.getAllByRole('button', { name: '활성' })
    await userEvent.click(chips[0])

    expect(screen.getByText('Future Active')).toBeInTheDocument()
    expect(screen.queryByText('Always Draft')).not.toBeInTheDocument()
  })

  // 4. Filter chip shows only expired schedules
  it('filter chip shows only expired schedules', async () => {
    const schedules = [
      mk({ id: '1', name: 'Old Schedule', status: 'ACTIVE', startDate: '2020-01-01', endDate: '2020-12-31' }),
      mk({ id: '2', name: 'Current Active', status: 'ACTIVE', startDate: '2025-01-01', endDate: '2099-12-31' }),
    ]
    render(<ScheduleSidebar {...defaultProps(schedules)} />)

    const chips = screen.getAllByRole('button', { name: '만료' })
    await userEvent.click(chips[0])

    expect(screen.getByText('Old Schedule')).toBeInTheDocument()
    expect(screen.queryByText('Current Active')).not.toBeInTheDocument()
  })

  // 5. Filter chip shows only upcoming schedules
  it('filter chip shows only upcoming schedules', async () => {
    const schedules = [
      mk({ id: '1', name: 'Draft Item', status: 'DRAFT', startDate: '2099-01-01', endDate: '2099-12-31' }),
      mk({ id: '2', name: 'Active Item', status: 'ACTIVE', startDate: '2025-01-01', endDate: '2099-12-31' }),
    ]
    render(<ScheduleSidebar {...defaultProps(schedules)} />)

    const chips = screen.getAllByRole('button', { name: '예정' })
    await userEvent.click(chips[0])

    expect(screen.getByText('Draft Item')).toBeInTheDocument()
    expect(screen.queryByText('Active Item')).not.toBeInTheDocument()
  })

  // 6. Count badge shows "N / M" when filter is active
  it('shows count badge N / M when filter reduces the list', async () => {
    const schedules = [
      mk({ id: '1', name: 'Active One', status: 'ACTIVE', startDate: '2025-01-01', endDate: '2099-12-31' }),
      mk({ id: '2', name: 'Draft One', status: 'DRAFT', startDate: '2099-01-01', endDate: '2099-12-31' }),
    ]
    render(<ScheduleSidebar {...defaultProps(schedules)} />)

    const chips = screen.getAllByRole('button', { name: '활성' })
    await userEvent.click(chips[0])

    // Count badge: "1 / 2"
    expect(screen.getByText(/1\s*\/\s*2/)).toBeInTheDocument()
  })

  // 7. Empty search result message
  it('shows empty search message when search yields no results', async () => {
    const schedules = [mk({ id: '1', name: 'Morning Show' })]
    render(<ScheduleSidebar {...defaultProps(schedules)} />)

    const input = screen.getByPlaceholderText('Search...')
    await userEvent.type(input, 'zzznomatch')

    expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument()
  })

  // 8. Empty schedule list message
  it('shows empty list message when schedules array is empty', () => {
    render(<ScheduleSidebar {...defaultProps([])} />)

    expect(screen.getByText('스케줄이 없습니다')).toBeInTheDocument()
  })

  // 9. Status dot has correct bg-class for active schedule
  it('renders green status dot for an ACTIVE schedule in range', () => {
    const schedules = [
      mk({ id: '1', name: 'Active Now', status: 'ACTIVE', startDate: '2025-01-01', endDate: '2099-12-31' }),
    ]
    render(<ScheduleSidebar {...defaultProps(schedules)} />)

    const dot = screen.getByLabelText('활성')
    expect(dot.className).toContain('bg-green-500')
  })

  // 10. Device count renders correctly
  it('renders device count for a schedule', () => {
    const fakeDevices = [
      { id: 'd1', deviceId: 'dev1' },
      { id: 'd2', deviceId: 'dev2' },
      { id: 'd3', deviceId: 'dev3' },
    ] as unknown as ScheduleDevice[]

    const schedules = [mk({ id: '1', name: 'With Devices', devices: fakeDevices })]
    render(<ScheduleSidebar {...defaultProps(schedules)} />)

    expect(screen.getByText('장치 3개')).toBeInTheDocument()
  })

  // 11. Clicking a card calls onSelect
  it('calls onSelect when a schedule card is clicked', async () => {
    const onSelect = vi.fn()
    const s = mk({ id: '1', name: 'Clickable' })
    render(<ScheduleSidebar {...defaultProps([s], { onSelect })} />)

    await userEvent.click(screen.getByText('Clickable'))
    expect(onSelect).toHaveBeenCalledWith(s)
  })

  // 12. Clicking edit button calls onEdit and does not trigger onSelect
  it('calls onEdit when edit button is clicked and does not trigger onSelect', async () => {
    const onSelect = vi.fn()
    const onEdit = vi.fn()
    const s = mk({ id: '1', name: 'Editable' })
    render(<ScheduleSidebar {...defaultProps([s], { onSelect, onEdit })} />)

    // Find the edit button by its text content
    const editBtn = screen.getByRole('button', { name: /수정/ })
    await userEvent.click(editBtn)

    expect(onEdit).toHaveBeenCalledWith(s)
    // stopPropagation prevents the card click handler from firing
    expect(onSelect).not.toHaveBeenCalled()
  })

  // 13. Clicking duplicate button calls onDuplicate
  it('calls onDuplicate when copy button is clicked', async () => {
    const onDuplicate = vi.fn()
    const s = mk({ id: 'dup-id', name: 'Duplicatable' })
    render(<ScheduleSidebar {...defaultProps([s], { onDuplicate })} />)

    const copyBtn = screen.getByTitle('복제')
    await userEvent.click(copyBtn)

    expect(onDuplicate).toHaveBeenCalledWith('dup-id')
  })
})
