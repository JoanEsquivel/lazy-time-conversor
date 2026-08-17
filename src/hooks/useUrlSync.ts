import { useEffect } from 'react'
import { encodeUrlState } from '../domain/url'
import { useConverterStore } from '../store/converter'

/** Keeps the address bar in sync so the current conversion is always shareable. Never pushes history. */
export function useUrlSync(): void {
  const time = useConverterStore((s) => s.from.time)
  const date = useConverterStore((s) => s.from.date)
  const from = useConverterStore((s) => s.from.zone)
  const to = useConverterStore((s) => s.to.zone)
  useEffect(() => {
    const q = encodeUrlState({ time, date, from, to })
    window.history.replaceState(null, '', `${window.location.pathname}?${q}${window.location.hash}`)
  }, [time, date, from, to])
}
