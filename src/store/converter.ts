import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { detectHomeZone, isZoneId, zoneForIana, type ZoneId } from '../domain/catalog'
import { parseTime } from '../domain/timeParse'
import { nowIn } from '../domain/tz'
import type { HHMM, HourFormat, ISODate, Lang, Theme } from '../domain/types'
import { decodeUrlState } from '../domain/url'
import { detectLang } from '../i18n'

export interface RecentEntry { from: ZoneId; to: ZoneId; time: HHMM; date: ISODate | null }
export interface Prefs { hourFormat: HourFormat; lang: Lang; theme: Theme }
export interface ConverterState {
  initialized: boolean
  home: ZoneId
  homeHint: boolean
  from: { zone: ZoneId; time: string; date: ISODate | null }
  to: { zone: ZoneId }
  prefs: Prefs
  recents: RecentEntry[]
  bootstrap(env: { browserIana?: string; navigatorLanguage?: string; search?: string }): void
  setFromZone(z: ZoneId): void
  setToZone(z: ZoneId): void
  setTime(raw: string): void
  setDate(d: ISODate | null): void
  useNow(now: Date): void
  swap(): void
  setHome(z: ZoneId): void
  dismissHomeHint(): void
  setPref<K extends keyof Prefs>(k: K, v: Prefs[K]): void
  commitRecent(): void
  loadRecent(e: RecentEntry): void
  clearRecents(): void
}

export const STORAGE_KEY = 'ltc:v1'
export const DEFAULT_HOME: ZoneId = 'America/Costa_Rica'
const DEFAULT_OTHER: ZoneId = 'America/Denver'
const MAX_RECENTS = 8
const MAX_PINNED = 6

export const initialConverterState = () => ({
  initialized: false,
  home: DEFAULT_HOME,
  homeHint: false,
  from: { zone: DEFAULT_HOME, time: '', date: null as ISODate | null },
  to: { zone: DEFAULT_OTHER },
  prefs: { hourFormat: '24h', lang: 'en', theme: 'system' } as Prefs,
  recents: [] as RecentEntry[],
})

const sameEntry = (a: RecentEntry, b: RecentEntry) => a.from === b.from && a.to === b.to && a.time === b.time && a.date === b.date

function pushRecent(recents: RecentEntry[], e: RecentEntry): RecentEntry[] {
  return [e, ...recents.filter((r) => !sameEntry(r, e))].slice(0, MAX_RECENTS)
}

/** Repair persisted zones after a catalog regeneration (INV-5). */
function safeZone(id: unknown, fallback: ZoneId): ZoneId {
  return typeof id === 'string' ? (zoneForIana(id)?.id ?? fallback) : fallback
}

export const useConverterStore = create<ConverterState>()(
  persist(
    (set, get) => ({
      ...initialConverterState(),

      bootstrap: ({ browserIana, navigatorLanguage, search }) => {
        if (!get().initialized) {
          const detected = detectHomeZone(browserIana)
          const home = detected ?? DEFAULT_HOME
          set({
            initialized: true,
            home,
            homeHint: !detected,
            from: { zone: home, time: '', date: null },
            to: { zone: home === DEFAULT_HOME ? DEFAULT_OTHER : DEFAULT_HOME },
            prefs: { ...get().prefs, lang: detectLang(navigatorLanguage) },
          })
        }
        if (search) {
          const u = decodeUrlState(search)
          set((s) => ({
            from: { zone: u.from ?? s.from.zone, time: u.time ?? s.from.time, date: u.date ?? s.from.date },
            to: { zone: u.to ?? s.to.zone },
          }))
        }
      },

      setFromZone: (zone) => set((s) => ({ from: { ...s.from, zone } })),
      setToZone: (zone) => set({ to: { zone } }),
      setTime: (time) => set((s) => ({ from: { ...s.from, time } })),
      setDate: (date) => set((s) => ({ from: { ...s.from, date } })),
      useNow: (now) => set((s) => {
        const n = nowIn(s.from.zone, now)
        return { from: { ...s.from, time: n.time, date: n.date } }
      }),
      swap: () => set((s) => ({ from: { ...s.from, zone: s.to.zone }, to: { zone: s.from.zone } })),
      setHome: (home) => set({ home, homeHint: false }),
      dismissHomeHint: () => set({ homeHint: false }),
      setPref: (k, v) => set((s) => ({ prefs: { ...s.prefs, [k]: v } })),

      commitRecent: () => {
        const s = get()
        const parsed = parseTime(s.from.time)
        if (!parsed.ok) return
        // A conversion from a zone to itself is never worth remembering — result equals input,
        // and stamping one on every zone-change keystroke would fill the list with noise.
        if (s.from.zone === s.to.zone) return
        set({ recents: pushRecent(s.recents, { from: s.from.zone, to: s.to.zone, time: parsed.time, date: s.from.date }) })
      },
      loadRecent: (e) => set((s) => ({
        from: { zone: e.from, time: e.time, date: e.date },
        to: { zone: e.to },
        recents: pushRecent(s.recents, e),
      })),
      clearRecents: () => set({ recents: [] }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        initialized: s.initialized, home: s.home, homeHint: s.homeHint,
        from: { zone: s.from.zone }, to: { zone: s.to.zone },
        prefs: s.prefs, recents: s.recents,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ReturnType<typeof initialConverterState>> & { from?: { zone?: string }; to?: { zone?: string } }
        const home = safeZone(p.home, DEFAULT_HOME)
        // Array.isArray / object guards, not `?? []`: zustand runs merge inside its hydration
        // promise chain, so a TypeError here rejects it and the `set` never happens — a single
        // malformed field would silently discard home, from, to and prefs as well.
        const recents = (Array.isArray(p.recents) ? p.recents : []).filter((r) => r && isZoneId(r.from) && isZoneId(r.to))
        const prefs = p.prefs && typeof p.prefs === 'object' && !Array.isArray(p.prefs) ? p.prefs : {}
        return {
          ...current,
          initialized: p.initialized ?? current.initialized,
          home,
          homeHint: p.homeHint ?? current.homeHint,
          from: { ...current.from, zone: safeZone(p.from?.zone, home) },
          to: { zone: safeZone(p.to?.zone, home) },
          prefs: { ...current.prefs, ...prefs },
          recents,
        }
      },
    },
  ),
)

export function resetConverterStore(): void {
  localStorage.removeItem(STORAGE_KEY)
  useConverterStore.setState(initialConverterState())
}

/**
 * Pure helper. Components must call this through useMemo over `home` + `recents` rather than
 * passing `selectPinned` to `useConverterStore`: zustand 5 feeds the selector to
 * useSyncExternalStore, which requires a cached snapshot, and this builds a fresh array per call.
 */
export function pinnedZones(home: ZoneId, recents: readonly RecentEntry[]): ZoneId[] {
  const out: ZoneId[] = [home]
  for (const r of recents) for (const z of [r.from, r.to]) if (!out.includes(z) && out.length < MAX_PINNED) out.push(z)
  return out
}

/** Test-facing convenience over `pinnedZones`; never pass this to `useConverterStore`. */
export function selectPinned(s: ConverterState): ZoneId[] {
  return pinnedZones(s.home, s.recents)
}

export function selectEffectiveDate(s: ConverterState, now: Date): ISODate {
  return s.from.date ?? nowIn(s.from.zone, now).date
}
