import React from 'react'
import ReactDOM from 'react-dom/client'
// 공통 스타일을 페이지 스타일보다 먼저 불러온다.
import './index.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
