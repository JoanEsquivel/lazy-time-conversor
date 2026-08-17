import { useState } from 'react'
import { formatDateLine } from '../../domain/format'
import { useNow } from '../../hooks/useNow'
import { useLocale, useT } from '../../hooks/useT'
import { clock } from '../../store/clock'
import { selectEffectiveDate, useConverterStore } from '../../store/converter'
import styles from './DateRow.module.css'

export function DateRow() {
  const t = useT()
  const locale = useLocale()
  const now = useNow()
  const explicit = useConverterStore((s) => s.from.date)
  const effective = useConverterStore((s) => selectEffectiveDate(s, now))
  const setDate = useConverterStore((s) => s.setDate)
  const useNowAction = useConverterStore((s) => s.useNow)
  const commitRecent = useConverterStore((s) => s.commitRecent)
  const [editing, setEditing] = useState(false)
  return (
    <div className={styles.row}>
      <span data-testid="date-line">{formatDateLine(effective, locale)}</span>
      <button type="button" className={styles.btn} aria-label={t('date.pick')} aria-expanded={editing} onClick={() => setEditing((v) => !v)}>📅</button>
      {editing && (
        <input
          className={styles.date}
          type="date"
          aria-label={t('date.pick')}
          value={explicit ?? effective}
          onChange={(e) => setDate(e.target.value || null)}
        />
      )}
      {explicit && <button type="button" className={styles.btn} aria-label={t('date.today')} onClick={() => { setDate(null); setEditing(false) }}>×</button>}
      <button type="button" className={styles.btn} onClick={() => { useNowAction(clock.now()); commitRecent() }}>{t('now')}</button>
    </div>
  )
}
