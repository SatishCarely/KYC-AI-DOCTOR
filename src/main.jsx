import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// NOTE: React.StrictMode is intentionally removed here.
// StrictMode causes components to mount twice in development,
// which creates two LiveKit room connections and they interfere
// with each other causing immediate disconnects.
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)