import React, { useEffect } from 'react';
import * as Icons from 'lucide-react';

export interface ConfirmModalConfig {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  isAlertOnly?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface ConfirmModalProps {
  config: ConfirmModalConfig | null;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ config, onClose }) => {
  useEffect(() => {
    if (!config || !config.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (config.onCancel) config.onCancel();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        config.onConfirm();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config, onClose]);

  if (!config || !config.isOpen) return null;

  const variant = config.variant || 'danger';
  const isAlert = config.isAlertOnly || false;

  const iconConfig = {
    danger: {
      bg: 'bg-rose-500/15 border-rose-500/30 text-rose-500',
      btn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30',
      Icon: Icons.AlertTriangle,
    },
    warning: {
      bg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
      btn: 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-900/30 font-bold',
      Icon: Icons.AlertCircle,
    },
    info: {
      bg: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
      btn: 'app-accent-bg hover:brightness-110 text-white shadow-blue-900/30',
      Icon: Icons.Info,
    },
    success: {
      bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
      btn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30',
      Icon: Icons.CheckCircle2,
    },
  }[variant];

  const IconComp = iconConfig.Icon;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4 backdrop-animate-appear cursor-pointer"
      onClick={() => {
        if (config.onCancel) config.onCancel();
        onClose();
      }}
    >
      <div
        className="app-bg-secondary border app-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 modal-animate-appear cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 shadow-md ${iconConfig.bg}`}>
            <IconComp size={22} />
          </div>

          <div className="space-y-1.5 flex-1 pr-2">
            <h3 className="text-sm font-bold app-text-main leading-snug">{config.title}</h3>
            <p className="text-xs app-text-muted leading-relaxed">{config.description}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t app-border">
          {!isAlert && (
            <button
              type="button"
              onClick={() => {
                if (config.onCancel) config.onCancel();
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold app-text-muted hover:app-text-main app-bg-main border app-border transition-colors cursor-pointer"
            >
              {config.cancelLabel || 'Batal'}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              config.onConfirm();
              onClose();
            }}
            className={`px-5 py-2 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 ${iconConfig.btn}`}
          >
            <span>{config.confirmLabel || (isAlert ? 'Mengerti' : 'Konfirmasi')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
