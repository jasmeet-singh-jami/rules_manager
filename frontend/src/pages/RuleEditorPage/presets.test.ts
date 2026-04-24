import { describe, expect, it } from 'vitest'
import {
  getActionPresets,
  getFieldSuggestions,
  getPrefix,
  normalizeRuleTypeSlug,
} from './presets'

describe('rule editor presets', () => {
  it('supports the backend noise suppression slug', () => {
    expect(getActionPresets('noise_suppression')).toHaveLength(5)
    expect(getFieldSuggestions('noise_suppression')).toContain('alertName')
    expect(getPrefix('noise_suppression')).toBe('groupedAlert')
  })

  it('keeps legacy hyphenated slugs mapped to the same helpers', () => {
    expect(normalizeRuleTypeSlug('noise-suppression')).toBe('noise_suppression')
    expect(getActionPresets('noise-suppression')).toEqual(getActionPresets('noise_suppression'))
    expect(getFieldSuggestions('alert-classification')).toEqual(getFieldSuggestions('alert_classifier'))
  })
})
