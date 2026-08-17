import { useId, useMemo } from 'react'
import { parseTime } from '../../domain/timeParse'
import { useT } from '../../hooks/useT'
import { useConverterStore } from '../../store/converter'
import styles from './TimeInput.module.css'

export function TimeInput() {
  const t = useT()
  const id = useId()
  const time = useConverterStore((s) => s.from.time)
  const hourFormat = useConverterStore((s) => s.prefs.hourFormat)
  // Derived outside the store subscription: parseTime returns a fresh object, which zustand 5
  // would treat as a changed snapshot on every render.
  const parsed = useMemo(() => parseTime(time), [time])
  const setTime = useConverterStore((s) => s.setTime)
  const commitRecent = useConverterStore((s) => s.commitRecent)
  const invalid = !parsed.ok && parsed.reason === 'invalid'
  return (
    <div className={styles.wrap}>
      <label htmlFor={id} className={styles.label}>{t('time.label')}</label>
      <input
        id={id}
        className={`${styles.input} digits`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={t(hourFormat === '12h' ? 'time.placeholder.12h' : 'time.placeholder.24h')}
        value={time}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={(e) => setTime(e.target.value)}
        onBlur={commitRecent}
        onKeyDown={(e) => { if (e.key === 'Enter') commitRecent() }}
      />
      {invalid && <p id={`${id}-error`} role="alert" className={styles.error}>{t('time.invalid')}</p>}
    </div>
  )
}
