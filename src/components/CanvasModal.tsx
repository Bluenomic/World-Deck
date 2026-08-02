import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';

interface CanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  title: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel: string;
}

export const CanvasModal: React.FC<CanvasModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  placeholder = 'Nama Kanvas...',
  initialValue = '',
  submitLabel,
}) => {
  const [name, setName] = useState(initialValue);

  useEffect(() => {
    if (isOpen) {
      setName(initialValue);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[60] backdrop-animate-appear cursor-pointer"
      onClick={onClose}
    >
      <div 
        className="app-bg-secondary border app-border w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden app-text-main transition-colors modal-animate-appear cursor-default p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl app-accent-bg flex items-center justify-center text-white shadow-md">
            <Icons.Layout size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold app-text-main">{title}</h3>
            <p className="text-[10px] app-text-muted leading-tight mt-0.5">
              Masukkan nama kanvas unik untuk ruang kerja Anda.
            </p>
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3.5 py-2.5 text-xs app-bg-main border app-border rounded-xl app-text-main placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            autoFocus
            required
          />

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border app-border app-text-muted hover:app-text-main text-xs font-semibold cursor-pointer transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 rounded-xl app-accent-bg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-md flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            >
              <span>{submitLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
