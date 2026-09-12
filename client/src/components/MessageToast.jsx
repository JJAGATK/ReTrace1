import React, { useEffect } from 'react';
import { useNotifications } from '../context/NotificationContext';

function SingleToast({ toast, onNavigate, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 8500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const handleOpen = () => {
    onDismiss(toast.id);
    if (onNavigate) {
      if (toast.targetTab === 'admin') {
        onNavigate('admin');
      } else if (toast.item_id) {
        onNavigate('handover', { itemId: toast.item_id });
      } else {
        onNavigate('handover');
      }
    }
  };

  return (
    <div className="pointer-events-auto w-full max-w-sm rounded-2xl glass-card p-4 shadow-2xl border border-indigo-300/80 bg-white/95 backdrop-blur-xl animate-in slide-in-from-bottom-5 fade-in duration-200 text-[#1a1b25] transition-all hover:scale-[1.01] group">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-indigo-100/80">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4648d4] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4648d4]"></span>
          </span>
          <span className="text-xs font-bold text-[#1a1b25] flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-[#4648d4]">chat</span>
            <span>New Handover Message</span>
          </span>
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Dismiss message toast"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>

      <div className="flex items-start gap-3">
        {toast.photo ? (
          <img
            src={toast.photo}
            alt=""
            className="w-10 h-10 rounded-xl object-cover ring-1 ring-indigo-200 shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-[#4648d4] flex items-center justify-center shrink-0 font-bold text-sm">
            <span className="material-symbols-outlined text-lg">account_circle</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-[#1a1b25] truncate">
              {toast.title}
            </span>
            <span className="text-[10px] text-slate-400 shrink-0">Just now</span>
          </div>

          {toast.item_title && (
            <p className="text-[11px] font-semibold text-[#4648d4] truncate">
              Item: {toast.item_title}
            </p>
          )}

          <p className="text-xs text-[#464554] mt-1 line-clamp-2 bg-indigo-50/50 p-2 rounded-xl border border-indigo-100/60 leading-relaxed">
            "{toast.desc}"
          </p>

          <div className="mt-2.5 flex items-center justify-end gap-2">
            <button
              onClick={() => onDismiss(toast.id)}
              className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Dismiss
            </button>
            <button
              onClick={handleOpen}
              className="px-3.5 py-1.5 rounded-full btn-gradient-indigo text-white text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>Reply & Open Chat</span>
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MessageToastContainer({ onNavigate }) {
  const { activeToasts, dismissToast } = useNotifications();

  if (!activeToasts || activeToasts.length === 0) return null;

  return (
    <div className="fixed bottom-16 md:bottom-5 right-4 md:right-6 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
      {activeToasts.map((toast) => (
        <SingleToast
          key={toast.id}
          toast={toast}
          onNavigate={onNavigate}
          onDismiss={dismissToast}
        />
      ))}
    </div>
  );
}
