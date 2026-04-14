import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ImportDrl } from './ImportDrl'
import * as api from '../api/client'

vi.mock('../api/client')

const mockRuleTypes = [
  { id: 'rt1', slug: 'alert_classifier', name: 'Alert Classifier', pipeline_stage: 1,
    drl_package: '', drl_imports: '', drl_functions: null },
]
const mockClients = [
  { id: 'c1', code: 'INFY', name: 'Infosys', description: null, created_at: '' },
]
const mockPreview = {
  filename: 'test.drl',
  package: 'com.example',
  rule_count: 2,
  rules: [
    { name: 'Rule_1', condition_raw: 'cond1', action_raw: 'act1' },
    { name: 'Rule_2', condition_raw: 'cond2', action_raw: 'act2' },
  ],
}

beforeEach(() => {
  vi.mocked(api.getRuleTypes).mockResolvedValue(mockRuleTypes)
  vi.mocked(api.getClients).mockResolvedValue(mockClients)
  vi.mocked(api.parseDrlFile).mockResolvedValue(mockPreview)
  vi.mocked(api.confirmImport).mockResolvedValue({ imported: 2, rule_ids: ['r1', 'r2'] })
})

describe('ImportDrl page', () => {
  it('renders page heading', () => {
    render(<MemoryRouter><ImportDrl /></MemoryRouter>)
    expect(screen.getByText('Import DRL')).toBeInTheDocument()
  })

  it('shows file upload area', () => {
    render(<MemoryRouter><ImportDrl /></MemoryRouter>)
    expect(screen.getByText(/drop a .drl file/i)).toBeInTheDocument()
  })

  it('shows preview table after file upload', async () => {
    render(<MemoryRouter><ImportDrl /></MemoryRouter>)
    await waitFor(() => screen.getByText('Infosys'))

    const file = new File(['package com.test;'], 'test.drl', { type: 'text/plain' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => screen.getByText('Rule_1'))
    expect(screen.getByText('Rule_2')).toBeInTheDocument()
  })
})
