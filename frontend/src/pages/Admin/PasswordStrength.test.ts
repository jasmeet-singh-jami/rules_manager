import { describe, it, expect } from 'vitest'
import { scorePassword } from './PasswordStrength'

describe('scorePassword', () => {
  it('scores an empty password 0', () => expect(scorePassword('').score).toBe(0))
  it('scores a short password 1', () => expect(scorePassword('abc').score).toBe(1))
  it('scores a mixed-case password 2+', () => expect(scorePassword('abcDEFgh').score).toBeGreaterThanOrEqual(2))
  it('scores a strong password 4', () => expect(scorePassword('Abcd1234!').score).toBe(4))
  it('returns a human label', () => expect(scorePassword('Abcd1234!').label).toBe('Strong'))
})
