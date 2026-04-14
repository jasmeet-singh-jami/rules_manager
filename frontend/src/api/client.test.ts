import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getClients, createClient, getRules, getRuleTypes } from './client'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockOk(body: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(''),
  } as Response)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getClients', () => {
  it('calls GET /api/clients', async () => {
    mockOk([{ id: '1', code: 'X', name: 'X Corp', description: null, created_at: '' }])
    const result = await getClients()
    expect(mockFetch).toHaveBeenCalledWith('/api/clients', expect.any(Object))
    expect(result).toHaveLength(1)
  })
})

describe('createClient', () => {
  it('calls POST /api/clients with JSON body', async () => {
    mockOk({ id: '2', code: 'Y', name: 'Y Corp', description: null, created_at: '' }, 201)
    await createClient({ code: 'Y', name: 'Y Corp' })
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/clients',
      expect.objectContaining({ method: 'POST' })
    )
  })
})

describe('getRuleTypes', () => {
  it('calls GET /api/rule-types', async () => {
    mockOk([])
    await getRuleTypes()
    expect(mockFetch).toHaveBeenCalledWith('/api/rule-types', expect.any(Object))
  })
})

describe('getRules', () => {
  it('calls GET /api/rules with no query string when no filters', async () => {
    mockOk([])
    await getRules()
    expect(mockFetch).toHaveBeenCalledWith('/api/rules', expect.any(Object))
  })

  it('appends client_id query param when provided', async () => {
    mockOk([])
    await getRules({ client_id: 'abc-123' })
    expect(mockFetch).toHaveBeenCalledWith('/api/rules?client_id=abc-123', expect.any(Object))
  })

  it('appends multiple filters', async () => {
    mockOk([])
    await getRules({ client_id: 'abc', tool: 'Tivoli' })
    const url = (mockFetch.mock.calls[0][0] as string)
    expect(url).toContain('client_id=abc')
    expect(url).toContain('tool=Tivoli')
  })
})
