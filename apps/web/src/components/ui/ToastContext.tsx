'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  showToast: (title: string, options?: { type?: ToastType; message?: string }) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (title: string, options?: { type?: ToastType; message?: string }) => {
      const id = Math.random().toString(36).substring(2, 9);
      const type = options?.type || 'info';
      const toast: ToastItem = { id, type, title, message: options?.message };

      setToasts((prev) => [...prev.slice(-4), toast]); // Max 5 toasts

      setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}

      {/* Toast Render Overlay */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => {
          const typeStyles = {
            success: 'bg-[#111827] border-emerald-500/40 text-emerald-400',
            error: 'bg-[#111827] border-rose-500/40 text-rose-400',
            warning: 'bg-[#111827] border-amber-500/40 text-amber-400',
            info: 'bg-[#111827] border-indigo-500/40 text-indigo-400',
          }[t.type];

          const typeIcon = {
            success: '✓',
            error: '✕',
            warning: '⚠️',
            info: 'ℹ',
          }[t.type];

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md animate-slide-up ${typeStyles}`}
            >
              <span className="font-bold text-xs pt-0.5 shrink-0">{typeIcon}</span>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-slate-100">{t.title}</h4>
                {t.message && <p className="text-[11px] text-slate-400 mt-0.5">{t.message}</p>}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-slate-500 hover:text-slate-300 text-xs font-bold px-1"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      showToast: (title: string) => console.log(`[Toast Fallback] ${title}`),
      removeToast: () => {},
    };
  }
  return context;
}
