import { useRef } from 'react'
import { ActionsRow } from './components/ActionsRow/ActionsRow'
import { Converter } from './components/Converter/Converter'
import { Header } from './components/Header/Header'
import { HomeHint } from './components/HomeHint/HomeHint'
import { Toast } from './components/Toast/Toast'
import { useTheme } from './hooks/useTheme'
import { useUrlSync } from './hooks/useUrlSync'

export default function App() {
  useTheme()
  useUrlSync()
  const fromInputRef = useRef<HTMLInputElement | null>(null)
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '16px 16px 48px' }}>
      <Header />
      <HomeHint />
      <Converter fromInputRef={fromInputRef} />
      <ActionsRow />
      <Toast />
    </main>
  )
}
