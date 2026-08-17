import { useT } from '../../hooks/useT'
import { useConverterStore } from '../../store/converter'
import styles from './SwapButton.module.css'

export function SwapButton() {
  const t = useT()
  const swap = useConverterStore((s) => s.swap)
  const commitRecent = useConverterStore((s) => s.commitRecent)
  return <button type="button" className={styles.swap} aria-label={t('swap')} onClick={() => { swap(); commitRecent() }}>⇄</button>
}
