import { describe, it, expect } from 'vitest'
import { tokenize, type Token } from './highlight'

describe('tokenize', () => {
  it('highlights keywords', () => {
    const tokens: Token[] = tokenize('rule "X" when then end')
    const kinds = tokens.map(t => t.kind)
    expect(kinds).toContain('kw')
  })
  it('highlights strings', () => {
    const tokens = tokenize('rule "hello world"')
    expect(tokens.find(t => t.kind === 'str' && t.text === '"hello world"')).toBeDefined()
  })
  it('highlights line comments', () => {
    const tokens = tokenize('// a comment\nrule "x"')
    expect(tokens.find(t => t.kind === 'cmt' && t.text === '// a comment')).toBeDefined()
  })
  it('highlights block comments', () => {
    const tokens = tokenize('/* block */ rule')
    expect(tokens.find(t => t.kind === 'cmt' && t.text === '/* block */')).toBeDefined()
  })
  it('highlights numbers', () => {
    const tokens = tokenize('salience 99')
    expect(tokens.find(t => t.kind === 'num' && t.text === '99')).toBeDefined()
  })
  it('marks PascalCase identifiers as packages/types', () => {
    const tokens = tokenize('NoiseSuppressionRequest()')
    expect(tokens.find(t => t.kind === 'pkg' && t.text === 'NoiseSuppressionRequest')).toBeDefined()
  })
  it('marks getX / setX / isX as functions', () => {
    const tokens = tokenize('request.getGroupedAlert().setState("x")')
    const fnNames = tokens.filter(t => t.kind === 'fn').map(t => t.text)
    expect(fnNames).toEqual(expect.arrayContaining(['getGroupedAlert', 'setState']))
  })
})
