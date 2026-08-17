// INV-1: the only place (besides hooks/useNow.ts) allowed to read ambient time.
export const clock = {
  now: (): Date => new Date(),
}
