import { useEffect } from 'react'
import { create } from 'zustand'

interface ToastState { message: string | null; show(msg: string): void; clear(): void }
export const useToastStore = create<ToastState>((set) => ({ message: null, show: (message) => set({ message }), clear: () => set({ message: null }) }))

export function Toast() {
  const message = useToastStore((s) => s.message)
  const clear = useToastStore((s) => s.clear)
  useEffect(() => {
    if (!message) return
    const id = setTimeout(clear, 1500)
    return () => clearTimeout(id)
  }, [message, clear])
  return (
    <div role="status" aria-live="polite" style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', padding: message ? '8px 14px' : 0, background: 'var(--surface)', border: message ? '1px solid var(--accent-b)' : 0, borderRadius: 999, fontSize: 13 }}>
      {message}
    </div>
  )
}
