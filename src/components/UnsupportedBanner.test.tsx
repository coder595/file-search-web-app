import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { UnsupportedBanner } from './UnsupportedBanner'

describe('UnsupportedBanner', () => {
  it('renders a one-line message pointing to Chrome/Edge and naming read-only fallback mode', () => {
    render(<UnsupportedBanner />)
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent(/chrome or edge/i)
    expect(banner).toHaveTextContent(/read-only fallback mode/i)
  })
})
