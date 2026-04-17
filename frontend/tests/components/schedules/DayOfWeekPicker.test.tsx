import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DayOfWeekPicker from '@/components/schedules/DayOfWeekPicker'

/** Day labels rendered by the component in display order. */
const ALL_LABELS = ['월', '화', '수', '목', '금', '토', '일']

/** Day value strings matching the component's internal DAYS array. */
const MON = '1'
const WED = '3'

describe('DayOfWeekPicker', () => {
  let onChange: ((days: string[]) => void) & ReturnType<typeof vi.fn>

  beforeEach(() => {
    onChange = vi.fn() as typeof onChange
  })

  // ── Rendering ─────────────────────────────────────────────────────────
  it('renders 7 day buttons', () => {
    render(<DayOfWeekPicker value={[]} onChange={onChange} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(7)
  })

  it('renders buttons with the correct weekday labels', () => {
    render(<DayOfWeekPicker value={[]} onChange={onChange} />)

    for (const label of ALL_LABELS) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  // ── Selected state (visual class) ─────────────────────────────────────
  it('applies bg-indigo-600 class to selected days', () => {
    render(<DayOfWeekPicker value={[MON]} onChange={onChange} />)

    const monButton = screen.getByRole('button', { name: '월' })
    expect(monButton.className).toContain('bg-indigo-600')
  })

  it('does not apply bg-indigo-600 class to unselected days', () => {
    render(<DayOfWeekPicker value={[MON]} onChange={onChange} />)

    // 화 (value '2') is not selected
    const tueButton = screen.getByRole('button', { name: '화' })
    expect(tueButton.className).not.toContain('bg-indigo-600')
  })

  it('applies bg-indigo-600 to all selected days when multiple are selected', () => {
    render(<DayOfWeekPicker value={[MON, WED]} onChange={onChange} />)

    expect(screen.getByRole('button', { name: '월' }).className).toContain('bg-indigo-600')
    expect(screen.getByRole('button', { name: '수' }).className).toContain('bg-indigo-600')
  })

  // ── Toggle: add a day ─────────────────────────────────────────────────
  it('calls onChange with the day added when clicking an unselected button', async () => {
    const user = userEvent.setup()
    render(<DayOfWeekPicker value={[]} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '월' }))

    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith([MON])
  })

  it('preserves existing selected days when adding a new one', async () => {
    const user = userEvent.setup()
    render(<DayOfWeekPicker value={[WED]} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '월' }))

    expect(onChange).toHaveBeenCalledOnce()
    const result: string[] = onChange.mock.calls[0][0]
    expect(result).toContain(MON)
    expect(result).toContain(WED)
  })

  // ── Toggle: remove a day ──────────────────────────────────────────────
  it('calls onChange with the day removed when clicking a selected button', async () => {
    const user = userEvent.setup()
    render(<DayOfWeekPicker value={[MON, WED]} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '월' }))

    expect(onChange).toHaveBeenCalledOnce()
    const result: string[] = onChange.mock.calls[0][0]
    expect(result).not.toContain(MON)
    expect(result).toContain(WED)
  })

  it('calls onChange with an empty array when the only selected day is deselected', async () => {
    const user = userEvent.setup()
    render(<DayOfWeekPicker value={[MON]} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '월' }))

    expect(onChange).toHaveBeenCalledWith([])
  })

  // ── Error message ─────────────────────────────────────────────────────
  it('displays the error message when error prop is provided', () => {
    render(<DayOfWeekPicker value={[]} onChange={onChange} error="반복할 요일을 선택해주세요" />)

    expect(screen.getByText('반복할 요일을 선택해주세요')).toBeInTheDocument()
  })

  it('does not render an error element when error prop is undefined', () => {
    render(<DayOfWeekPicker value={[]} onChange={onChange} />)

    expect(screen.queryByText('반복할 요일을 선택해주세요')).not.toBeInTheDocument()
  })

  it('does not render an error element when error prop is an empty string', () => {
    const { container } = render(<DayOfWeekPicker value={[]} onChange={onChange} error="" />)

    // The <p> error element should not be present
    expect(container.querySelector('p')).toBeNull()
  })
})
