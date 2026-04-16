import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AccountPage } from './AccountPage'
import * as authApi from '../api/auth'

vi.mock('../api/auth')

describe('AccountPage', () => {
  it('renders change password form', () => {
    render(<MemoryRouter><AccountPage /></MemoryRouter>)
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument()
  })

  it('shows error when passwords do not match', async () => {
    render(<MemoryRouter><AccountPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'different1' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))
    await waitFor(() =>
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    )
    expect(authApi.changePassword).not.toHaveBeenCalled()
  })

  it('shows error when password is too short', async () => {
    render(<MemoryRouter><AccountPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))
    await waitFor(() =>
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    )
    expect(authApi.changePassword).not.toHaveBeenCalled()
  })

  it('shows success message after successful change', async () => {
    vi.mocked(authApi.changePassword).mockResolvedValue(undefined)
    render(<MemoryRouter><AccountPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'newpassword1' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'newpassword1' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))
    await waitFor(() =>
      expect(screen.getByText(/password updated successfully/i)).toBeInTheDocument()
    )
  })

  it('shows error message when API call fails', async () => {
    vi.mocked(authApi.changePassword).mockRejectedValue(new Error('500'))
    render(<MemoryRouter><AccountPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'newpassword1' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'newpassword1' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))
    await waitFor(() =>
      expect(screen.getByText(/failed to change password/i)).toBeInTheDocument()
    )
  })
})
