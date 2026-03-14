import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Warm up the backend as soon as the page loads so it's ready when the user uploads
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://case-intelligence-suite.onrender.com'
fetch(`${API_URL}/health`).catch(() => { /* ignore */ })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
