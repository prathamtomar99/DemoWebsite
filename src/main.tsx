import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { siteConfig } from './config/site'
import './styles/globals.css'

document.title = siteConfig.brandName

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
