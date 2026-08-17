import { useEffect } from 'react'
import type { Theme } from '../domain/types'
import { useConverterStore } from '../store/converter'

export function resolveTheme(pref: Theme, systemDark: boolean): 'light' | 'dark' {
  return pref === 'system' ? (systemDark ? 'dark' : 'light') : pref
}

export function useTheme(): void {
  const pref = useConverterStore((s) => s.prefs.theme)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => { document.documentElement.dataset.theme = resolveTheme(pref, mq.matches) }
    apply()
    if (pref !== 'system') return
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [pref])
}
