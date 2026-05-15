import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SteFin from './SteFin.jsx'
import { LanguageProvider } from './contexts/LanguageContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <SteFin />
    </LanguageProvider>
  </StrictMode>,
)
