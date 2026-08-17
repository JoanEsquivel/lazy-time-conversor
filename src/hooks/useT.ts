import { useCallback } from 'react'
import type { Locale } from '../domain/types'
import { LOCALE_OF, translate, type MessageKey } from '../i18n'
import { useConverterStore } from '../store/converter'

export function useT() {
  const lang = useConverterStore((s) => s.prefs.lang)
  return useCallback((key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang])
}
export function useLocale(): Locale {
  return LOCALE_OF[useConverterStore((s) => s.prefs.lang)]
}
