import { useId, useMemo, type RefObject } from 'react'
import { useNow } from '../../hooks/useNow'
import { useLocale, useT } from '../../hooks/useT'
import { pinnedZones, useConverterStore } from '../../store/converter'
import { DateRow } from '../DateRow/DateRow'
import { NowLine } from '../NowLine/NowLine'
import { ResultDisplay } from '../ResultDisplay/ResultDisplay'
import { SwapButton } from '../SwapButton/SwapButton'
import { TimeInput } from '../TimeInput/TimeInput'
import { ZonePicker } from '../ZonePicker/ZonePicker'
import styles from './Converter.module.css'

function Panel({ which, fromInputRef }: { which: 'from' | 'to'; fromInputRef?: RefObject<HTMLInputElement | null> }) {
  const t = useT()
  const locale = useLocale()
  const now = useNow()
  const headingId = useId()
  const zone = useConverterStore((s) => (which === 'from' ? s.from.zone : s.to.zone))
  const home = useConverterStore((s) => s.home)
  const recents = useConverterStore((s) => s.recents)
  // pinnedZones builds a fresh array; memoize it instead of subscribing with it (zustand 5).
  const pinned = useMemo(() => pinnedZones(home, recents), [home, recents])
  const setZone = useConverterStore((s) => (which === 'from' ? s.setFromZone : s.setToZone))
  const commitRecent = useConverterStore((s) => s.commitRecent)
  const isHome = zone === home
  return (
    <section className={`${styles.panel} ${isHome ? styles.home : ''}`} aria-labelledby={headingId}>
      <div className={styles.head}>
        <span id={headingId}>{t(which)}</span>
        {isHome && <span className={styles.badge} data-testid={`home-badge-${which}`}>{t('home').toUpperCase()}</span>}
      </div>
      <ZonePicker id={`${which}-zone`} label={t(which)} hideLabel value={zone} onChange={(z) => { setZone(z); commitRecent() }} locale={locale} pinned={pinned} now={now} t={t} inputRef={fromInputRef} />
      {which === 'from' ? (<><TimeInput /><DateRow /></>) : <ResultDisplay />}
      <NowLine which={which} />
    </section>
  )
}

export function Converter({ fromInputRef }: { fromInputRef?: RefObject<HTMLInputElement | null> }) {
  return (
    <div className={styles.grid}>
      <Panel which="from" fromInputRef={fromInputRef} />
      <div className={styles.swapCell}><SwapButton /></div>
      <Panel which="to" />
    </div>
  )
}
