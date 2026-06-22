import { useState, useCallback } from 'react'

export function useToast() {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  return { toasts, showToast }
}

export function ToastContainer({ toasts }) {
  const icons = {
    success: 'ph-check-circle',
    error: 'ph-x-circle',
    info: 'ph-info',
    warning: 'ph-warning',
  }
  return (
    <div className="toast-container" id="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <i className={`ph ${icons[t.type] || icons.info}`}></i>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
