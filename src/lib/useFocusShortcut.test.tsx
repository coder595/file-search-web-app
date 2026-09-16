import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { describe, expect, it } from 'vitest'
import { useFocusShortcut } from './useFocusShortcut'

function Harness({ otherInput = false }: { otherInput?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  useFocusShortcut('/', ref)
  return (
    <div>
      {otherInput && <input aria-label="other" />}
      <input aria-label="target" ref={ref} />
    </div>
  )
}

describe('useFocusShortcut', () => {
  it('pressing / focuses the target element', async () => {
    const { getByLabelText } = render(<Harness />)
    await userEvent.keyboard('/')
    expect(getByLabelText('target')).toHaveFocus()
  })

  it('does not hijack / while another input already has focus', async () => {
    const { getByLabelText } = render(<Harness otherInput />)
    const other = getByLabelText('other')
    other.focus()

    await userEvent.keyboard('/')

    expect(other).toHaveFocus()
    expect(getByLabelText('target')).not.toHaveFocus()
  })

  it('typing / inside the target itself is a harmless no-op re-focus', async () => {
    const { getByLabelText } = render(<Harness />)
    const target = getByLabelText('target') as HTMLInputElement
    target.focus()

    await userEvent.keyboard('/')

    expect(target).toHaveFocus()
  })
})
