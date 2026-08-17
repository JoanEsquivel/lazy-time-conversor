import { recentLabel } from '../../domain/format'
import { useLocale, useT } from '../../hooks/useT'
import { useConverterStore } from '../../store/converter'
import styles from './RecentList.module.css'

export function RecentList() {
  const t = useT()
  const locale = useLocale()
  const recents = useConverterStore((s) => s.recents)
  const hourFormat = useConverterStore((s) => s.prefs.hourFormat)
  const loadRecent = useConverterStore((s) => s.loadRecent)
  const clearRecents = useConverterStore((s) => s.clearRecents)
  if (recents.length === 0) return null
  return (
    <section className={styles.wrap} aria-label={t('recent')}>
      <h2 className={styles.title}>{t('recent')}</h2>
      {recents.map((r) => (
        <button key={`${r.from}|${r.to}|${r.time}|${r.date ?? ''}`} type="button" className={styles.chip} onClick={() => loadRecent(r)}>
          {recentLabel(r, hourFormat, locale)}
        </button>
      ))}
      <button type="button" className={styles.clear} onClick={clearRecents}>{t('recent.clear')}</button>
    </section>
  )
}
