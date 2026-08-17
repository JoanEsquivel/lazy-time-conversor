import './styles/tokens.css'
import './styles/global.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useConverterStore } from './store/converter'

// The only place the browser environment is read for bootstrap (INV-2 keeps it out of the domain).
useConverterStore.getState().bootstrap({
  browserIana: Intl.DateTimeFormat().resolvedOptions().timeZone,
  navigatorLanguage: navigator.language,
  search: window.location.search,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
