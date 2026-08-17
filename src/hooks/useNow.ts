import { useEffect, useState } from 'react'
import { clock } from '../store/clock'

// INV-1: reads ambient time (via clock.now) on a timer so UI can tick.
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => clock.now())
  useEffect(() => {
    const id = setInterval(() => setNow(clock.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
