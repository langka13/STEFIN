import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SteFin from './SteFin.jsx'
import { LanguageProvider } from './contexts/LanguageContext.jsx'
import { registerSW } from 'virtual:pwa-register'

// Register PWA service worker for offline support and auto updates
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <SteFin />
    </LanguageProvider>
  </StrictMode>,
)
