import { formatTime } from '../../domain/format'
import { nowIn } from '../../domain/tz'
import { useNow } from '../../hooks/useNow'
import { useLocale, useT } from '../../hooks/useT'
import { useConverterStore } from '../../store/converter'

export function NowLine({ which }: { which: 'from' | 'to' }) {
  const t = useT()
  const locale = useLocale()
  const now = useNow()
  const zone = useConverterStore((s) => (which === 'from' ? s.from.zone : s.to.zone))
  const home = useConverterStore((s) => s.home)
  const hourFormat = useConverterStore((s) => s.prefs.hourFormat)
  const time = formatTime(nowIn(zone, now).time, hourFormat, locale)
  return <p data-testid={`now-${which}`} style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{t(zone === home ? 'now.here' : 'now.there', { time })}</p>
}
