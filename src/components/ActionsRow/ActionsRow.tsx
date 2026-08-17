import { copyText } from '../../domain/format'
import { useLocale, useT } from '../../hooks/useT'
import { useConverterStore } from '../../store/converter'
import { useConversion } from '../ResultDisplay/ResultDisplay'
import { useToastStore } from '../Toast/Toast'
import styles from './ActionsRow.module.css'

async function writeClipboard(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}

export function ActionsRow() {
  const t = useT()
  const locale = useLocale()
  const show = useToastStore((s) => s.show)
  const from = useConverterStore((s) => s.from.zone)
  const to = useConverterStore((s) => s.to.zone)
  const { result, parsed } = useConversion()
  const disabled = !result || !parsed.ok
  const onCopy = async () => {
    if (!result || !parsed.ok) return
    const text = copyText({ from, to, time: parsed.time, result, locale })
    show((await writeClipboard(text)) ? t('copy.done') : text)
  }
  const onShare = async () => {
    const url = window.location.href
    show((await writeClipboard(url)) ? t('share.done') : url)
  }
  return (
    <div className={styles.row}>
      <button type="button" className={styles.btn} disabled={disabled} onClick={onCopy}>{t('copy')}</button>
      <button type="button" className={styles.btn} disabled={disabled} onClick={onShare}>{t('share')}</button>
    </div>
  )
}
