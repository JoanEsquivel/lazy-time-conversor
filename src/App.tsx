import { useRef } from 'react'
import { Converter } from './components/Converter/Converter'
import { Header } from './components/Header/Header'
import { HomeHint } from './components/HomeHint/HomeHint'
import { useTheme } from './hooks/useTheme'

export default function App() {
  useTheme()
  const fromInputRef = useRef<HTMLInputElement | null>(null)
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '16px 16px 48px' }}>
      <Header />
      <HomeHint />
      <Converter fromInputRef={fromInputRef} />
    </main>
  )
}
