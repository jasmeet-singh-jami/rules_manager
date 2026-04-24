import { describe, it, expect } from 'vitest'
import { parseCondition, stringifyCondition } from './conditionParser'

describe('parseCondition', () => {
  it('returns an empty row for empty input', () => {
    expect(parseCondition('')).toEqual([{ field: '', op: '==', value: '' }])
  })
  it('parses a single equality', () => {
    expect(parseCondition('sourceId == "LogicMonitor"'))
      .toEqual([{ field: 'sourceId', op: '==', value: 'LogicMonitor' }])
  })
  it('parses multiple clauses joined by &&', () => {
    expect(parseCondition('sourceId == "LM" && severity > 3'))
      .toEqual([
        { field: 'sourceId', op: '==', value: 'LM' },
        { field: 'severity', op: '>', value: '3' },
      ])
  })
  it('strips the prefix on round-trip', () => {
    expect(parseCondition('groupedAlert.sourceId == "X"', 'groupedAlert'))
      .toEqual([{ field: 'sourceId', op: '==', value: 'X' }])
  })
  it('supports contains / matches', () => {
    expect(parseCondition('name matches "^[A-Z]"'))
      .toEqual([{ field: 'name', op: 'matches', value: '^[A-Z]' }])
  })
})

describe('stringifyCondition', () => {
  it('builds a valid DRL condition with prefix', () => {
    const s = stringifyCondition(
      [{ field: 'sourceId', op: '==', value: 'LM' }, { field: 'severity', op: '>', value: '3' }],
      'groupedAlert',
    )
    expect(s).toBe('groupedAlert.sourceId == "LM" && groupedAlert.severity > 3')
  })
  it('quotes string values but not numbers or booleans', () => {
    expect(stringifyCondition([{ field: 'enabled', op: '==', value: 'true' }], ''))
      .toBe('enabled == true')
  })
  it('skips rows with empty field', () => {
    expect(stringifyCondition([{ field: '', op: '==', value: '' }], ''))
      .toBe('')
  })
  it('round-trips a parsed expression', () => {
    const input = 'sourceId == "LM" && severity > 3'
    expect(stringifyCondition(parseCondition(input), '')).toBe(input)
  })
})
