import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './theme.css'

const savedTheme = localStorage.getItem('polycloud.theme')
const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false
document.documentElement.dataset.theme = savedTheme ?? (prefersDark ? 'dark' : 'light')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
