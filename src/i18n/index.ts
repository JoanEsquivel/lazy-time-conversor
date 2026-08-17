import type { Lang, Locale } from '../domain/types'
import { en } from './en'
import { es } from './es'

export type MessageKey = keyof typeof en
const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, es }
export const LOCALE_OF: Record<Lang, Locale> = { en: 'en-US', es: 'es-CR' }

export function detectLang(navigatorLanguage: string | undefined): Lang {
  return navigatorLanguage?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  const raw = MESSAGES[lang][key] ?? MESSAGES.en[key] ?? key
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : raw
}
