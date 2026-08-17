import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { pickerLabel, zoneById, type Continent, type ZoneId } from '../../domain/catalog'
import { currentOffsetLabel } from '../../domain/format'
import { buildSearchIndex, search, type SearchEntry } from '../../domain/search'
import { offsetAt } from '../../domain/tz'
import type { Locale } from '../../domain/types'
import type { MessageKey } from '../../i18n'
import styles from './ZonePicker.module.css'

export interface ZonePickerProps {
  id: string
  label: string
  value: ZoneId
  onChange: (z: ZoneId) => void
  locale: Locale
  pinned: ZoneId[]
  now: Date
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
  inputRef?: RefObject<HTMLInputElement | null>
  hideLabel?: boolean
}

interface IndexedEntry { entry: SearchEntry; index: number }
interface IndexedGroup { key: 'pinned' | Continent; label: string; entries: IndexedEntry[] }

export function ZonePicker({ id, label, value, onChange, locale, pinned, now, t, inputRef, hideLabel }: ZonePickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const localRef = useRef<HTMLInputElement | null>(null)
  const ref = inputRef ?? localRef
  const listId = `${id}-listbox`
  const labelId = useId()

  const index = useMemo(() => buildSearchIndex(locale), [locale])
  const result = useMemo(() => search(index, query, { pinned }), [index, query, pinned])

  // Flatten groups once: `options[i]` is the i-th option in DOM order, so keyboard navigation is a plain index.
  const { groups, options } = useMemo(() => {
    const options: SearchEntry[] = []
    const groups: IndexedGroup[] = result.groups.map((g) => ({
      key: g.key,
      label: g.key === 'pinned' ? t('picker.pinned') : t(`continent.${g.key}` as MessageKey),
      entries: g.entries.map((entry) => ({ entry, index: options.push(entry) - 1 })),
    }))
    return { groups, options }
  }, [result, t])

  const selectedLabel = pickerLabel(zoneById(value), locale)
  const offsetLabel = currentOffsetLabel(offsetAt(value, now.getTime()))
  const optId = (i: number) => `${id}-opt-${i}`

  useEffect(() => {
    if (!open) return
    // -1 (not 0) when the current value isn't among the filtered options: nothing is highlighted
    // yet, so the first ArrowDown lands on the top-ranked match (index 0) via (-1 + 1) % length,
    // instead of pre-highlighting it and having ArrowDown skip past it to the second match.
    const i = options.findIndex((o) => o.zoneId === value)
    setActive(i)
  }, [open, options, value])

  useEffect(() => {
    if (open && active >= 0) document.getElementById(optId(active))?.scrollIntoView({ block: 'nearest' })
  }, [active, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const openList = () => { if (!open) { setQuery(''); setOpen(true) } }
  const close = () => { setOpen(false); setQuery('') }
  const select = (e: SearchEntry) => { onChange(e.zoneId); close() }

  const onKeyDown = (ev: KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (ev.key === 'ArrowDown' || ev.key === 'Enter' || (ev.key.length === 1 && !ev.metaKey && !ev.ctrlKey)) openList()
      return
    }
    switch (ev.key) {
      case 'ArrowDown': ev.preventDefault(); setActive((a) => (options.length ? (a + 1) % options.length : 0)); break
      case 'ArrowUp': ev.preventDefault(); setActive((a) => (options.length ? (a - 1 + options.length) % options.length : 0)); break
      case 'Home': ev.preventDefault(); setActive(0); break
      case 'End': ev.preventDefault(); setActive(Math.max(0, options.length - 1)); break
      case 'Enter': ev.preventDefault(); if (options[active]) select(options[active]); break
      case 'Escape': ev.preventDefault(); close(); break
      case 'Tab': close(); break
    }
  }

  return (
    <div className={styles.root}>
      <label id={labelId} htmlFor={id} className={hideLabel ? 'sr-only' : styles.label}>{label}</label>
      <div className={styles.field}>
        <input
          id={id}
          ref={ref}
          className={styles.input}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? optId(active) : undefined}
          autoComplete="off"
          spellCheck={false}
          value={open ? query : selectedLabel}
          placeholder={open ? t('picker.placeholder') : undefined}
          onFocus={openList}
          onClick={openList}
          onChange={(e) => { setQuery(e.target.value); setActive(0) }}
          onKeyDown={onKeyDown}
          onBlur={close}
        />
        {/* aria-hidden: the offset must stay out of the field's and each option's accessible name,
            which every test and every screen-reader announcement matches on exactly. */}
        <span className={styles.offset} data-testid={`${id}-offset`} aria-hidden="true">{offsetLabel}</span>
      </div>
      {open && (
        <ul id={listId} role="listbox" aria-labelledby={labelId} className={styles.list}>
          {groups.length === 0 && <li className={styles.hint} aria-live="polite">{t('picker.noMatches', { query })}</li>}
          {groups.map((g) => (
            <li key={g.key} role="group" aria-label={g.label}>
              <div className={styles.groupLabel} aria-hidden="true">{g.label}</div>
              <ul className={styles.group}>
                {g.entries.map(({ entry, index }) => (
                  <li
                    key={`${g.key}-${entry.zoneId}`}
                    id={optId(index)}
                    role="option"
                    aria-selected={entry.zoneId === value}
                    className={`${styles.option} ${index === active ? styles.active : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => select(entry)}
                  >
                    <span>{entry.label}</span>
                    <span className={styles.optionOffset} aria-hidden="true">{currentOffsetLabel(offsetAt(entry.zoneId, now.getTime()))}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
          {result.truncated && <li className={styles.hint}>{t('picker.keepTyping')}</li>}
        </ul>
      )}
    </div>
  )
}
