import { useMemo } from 'react'
import { useNow } from '../../hooks/useNow'
import { useLocale, useT } from '../../hooks/useT'
import { pinnedZones, useConverterStore } from '../../store/converter'
import type { Theme } from '../../domain/types'
import { ZonePicker } from '../ZonePicker/ZonePicker'
import styles from './Header.module.css'

const NEXT_THEME: Record<Theme, Theme> = { system: 'dark', dark: 'light', light: 'system' }
const THEME_ICON: Record<Theme, string> = { light: '☀', dark: '☾', system: '◐' }

export function Header() {
  const t = useT()
  const locale = useLocale()
  const now = useNow()
  const home = useConverterStore((s) => s.home)
  const setHome = useConverterStore((s) => s.setHome)
  const recents = useConverterStore((s) => s.recents)
  const pinned = useMemo(() => pinnedZones(home, recents), [home, recents])
  const prefs = useConverterStore((s) => s.prefs)
  const setPref = useConverterStore((s) => s.setPref)
  return (
    <header className={styles.bar}>
      <h1 className={styles.brand}>{t('app.title')}</h1>
      <div className={styles.controls}>
        <div className={styles.homeWrap} title={t('home.badge')}>
          <ZonePicker id="home-zone" label={t('home.badge')} hideLabel value={home} onChange={setHome} locale={locale} pinned={pinned} now={now} t={t} />
        </div>
        <div className={styles.seg} role="group" aria-label="Hour format">
          <button type="button" aria-pressed={prefs.hourFormat === '24h'} onClick={() => setPref('hourFormat', '24h')}>{t('format.24h')}</button>
          <button type="button" aria-pressed={prefs.hourFormat === '12h'} onClick={() => setPref('hourFormat', '12h')}>{t('format.12h')}</button>
        </div>
        <div className={styles.seg} role="group" aria-label="Language">
          <button type="button" aria-pressed={prefs.lang === 'en'} onClick={() => setPref('lang', 'en')}>{t('lang.en')}</button>
          <button type="button" aria-pressed={prefs.lang === 'es'} onClick={() => setPref('lang', 'es')}>{t('lang.es')}</button>
        </div>
        <button type="button" className={styles.icon} aria-label={t(`theme.${prefs.theme}`)} onClick={() => setPref('theme', NEXT_THEME[prefs.theme])}>{THEME_ICON[prefs.theme]}</button>
      </div>
    </header>
  )
}
