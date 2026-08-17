import { useMemo } from 'react'
import { useNow } from '../../hooks/useNow'
import { useLocale, useT } from '../../hooks/useT'
import { pinnedZones, useConverterStore } from '../../store/converter'
import { ZonePicker } from '../ZonePicker/ZonePicker'

export function HomeHint() {
  const t = useT()
  const locale = useLocale()
  const now = useNow()
  const show = useConverterStore((s) => s.homeHint)
  const home = useConverterStore((s) => s.home)
  const setHome = useConverterStore((s) => s.setHome)
  const dismiss = useConverterStore((s) => s.dismissHomeHint)
  const recents = useConverterStore((s) => s.recents)
  const pinned = useMemo(() => pinnedZones(home, recents), [home, recents])
  if (!show) return null
  return (
    <div role="status" aria-label={t('home')} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', marginBottom: 12, background: 'var(--surface)', border: '1px solid var(--border-home)', borderRadius: 'var(--radius-card)' }}>
      <span>{t('home.hint')}</span>
      <div style={{ minWidth: 240 }}>
        <ZonePicker id="home-zone-hint" label={t('home.badge')} hideLabel value={home} onChange={setHome} locale={locale} pinned={pinned} now={now} t={t} />
      </div>
      <button type="button" onClick={dismiss} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-control)', padding: '4px 10px' }}>{t('home.hint.dismiss')}</button>
    </div>
  )
}
