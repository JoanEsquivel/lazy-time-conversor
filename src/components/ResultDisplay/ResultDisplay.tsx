import { useMemo } from 'react'
import { dayOffsetKey, formatDateLine, formatTime } from '../../domain/format'
import { parseTime, type ParseResult } from '../../domain/timeParse'
import { convert, type ConvertResult } from '../../domain/tz'
import type { ISODate } from '../../domain/types'
import { useNow } from '../../hooks/useNow'
import { useLocale, useT } from '../../hooks/useT'
import { selectEffectiveDate, useConverterStore } from '../../store/converter'
import styles from './ResultDisplay.module.css'

/** Derived, never stored (INV-3). */
export function useConversion(): { result: ConvertResult | null; parsed: ParseResult; effectiveDate: ISODate } {
  const now = useNow()
  const time = useConverterStore((s) => s.from.time)
  const parsed = useMemo(() => parseTime(time), [time])
  const effectiveDate = useConverterStore((s) => selectEffectiveDate(s, now))
  const from = useConverterStore((s) => s.from.zone)
  const to = useConverterStore((s) => s.to.zone)
  const result = parsed.ok ? convert({ date: effectiveDate, time: parsed.time, from, to }) : null
  return { result, parsed, effectiveDate }
}

export function ResultDisplay() {
  const t = useT()
  const locale = useLocale()
  const hourFormat = useConverterStore((s) => s.prefs.hourFormat)
  const { result } = useConversion()
  return (
    <div className={styles.wrap} aria-live="polite" aria-label={t('result.label')}>
      <div className={`${styles.time} digits`} data-testid="result-time">{result ? formatTime(result.time, hourFormat, locale) : '--:--'}</div>
      <div className={styles.line} data-testid="result-date">{result ? `${formatDateLine(result.date, locale)} · ${t(dayOffsetKey(result.dayOffset))}` : ' '}</div>
      <div className={styles.line} data-testid="result-offsets">{result ? `UTC${result.fromOffset} → UTC${result.toOffset}` : ' '}</div>
    </div>
  )
}
