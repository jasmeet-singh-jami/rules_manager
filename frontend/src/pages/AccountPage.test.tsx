import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AccountPage } from './AccountPage'
import { AuthProvider } from '../context/AuthContext'
import * as authApi from '../api/auth'

vi.mock('../api/auth')

function renderPage() {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('AccountPage', () => {
  it('renders change password form with current password field', () => {
    renderPage()
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument()
  })

  it('does not show first-login banner by default', () => {
    renderPage()
    expect(screen.queryByText(/you must set a new password/i)).not.toBeInTheDocument()
  })

  it('shows error when passwords do not match', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: 'oldpassword' } })
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'different1' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))
    await waitFor(() =>
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    )
    expect(authApi.changePassword).not.toHaveBeenCalled()
  })

  it('shows error when password is too short', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: 'oldpassword' } })
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
    renderPage()
    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: 'oldpassword' } })
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'newpassword1' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'newpassword1' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))
    await waitFor(() =>
      expect(screen.getByText(/password updated successfully/i)).toBeInTheDocument()
    )
    expect(authApi.changePassword).toHaveBeenCalledWith('oldpassword', 'newpassword1', 'newpassword1')
  })

  it('shows "current password is incorrect" error on 400', async () => {
    vi.mocked(authApi.changePassword).mockRejectedValue(new Error('400: Current password is incorrect'))
    renderPage()
    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: 'wrong' } })
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'newpassword1' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'newpassword1' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))
    await waitFor(() =>
      expect(screen.getByText(/current password is incorrect/i)).toBeInTheDocument()
    )
  })

  it('shows error message when API call fails with non-400', async () => {
    vi.mocked(authApi.changePassword).mockRejectedValue(new Error('500'))
    renderPage()
    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: 'oldpassword' } })
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'newpassword1' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'newpassword1' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))
    await waitFor(() =>
      expect(screen.getByText(/failed to change password/i)).toBeInTheDocument()
    )
  })
})
