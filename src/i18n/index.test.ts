import { describe, expect, it } from 'vitest'
import { en } from './en'
import { es } from './es'
import { detectLang, LOCALE_OF, translate } from './index'

describe('i18n', () => {
  it('es has exactly the same keys as en', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort())
  })
  it('detects language from navigator.language', () => {
    expect(detectLang('es-CR')).toBe('es')
    expect(detectLang('es')).toBe('es')
    expect(detectLang('en-US')).toBe('en')
    expect(detectLang('fr-FR')).toBe('en')
    expect(detectLang(undefined)).toBe('en')
  })
  it('translates with variables', () => {
    expect(translate('en', 'from')).toBe('From')
    expect(translate('es', 'from')).toBe('Desde')
    expect(translate('en', 'picker.noMatches', { query: 'xyz' })).toBe('No matches for “xyz”')
    expect(LOCALE_OF.es).toBe('es-CR')
  })
})
