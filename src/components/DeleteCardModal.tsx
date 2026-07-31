import React from 'react';
import type { WorldCard } from '../types';
import * as Icons from 'lucide-react';

interface DeleteCardModalProps {
  isOpen: boolean;
  cardsToDelete: WorldCard[];
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteCardModal: React.FC<DeleteCardModalProps> = ({
  isOpen,
  cardsToDelete,
  onClose,
  onConfirm,
}) => {
  React.useEffect(() => {
    if (!isOpen || cardsToDelete.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onConfirm();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, cardsToDelete, onClose, onConfirm]);

  if (!isOpen || cardsToDelete.length === 0) return null;

  const count = cardsToDelete.length;

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4 backdrop-animate-appear cursor-pointer"
      onClick={onClose}
    >
      <div 
        className="app-bg-secondary border app-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 modal-animate-appear cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header Icon */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 text-red-500 flex items-center justify-center">
            <Icons.Trash2 size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold app-text-main">
              {count === 1
                ? 'Konfirmasi Hapus Kartu'
                : `Konfirmasi Hapus ${count} Kartu`}
            </h3>
            <p className="text-xs app-text-muted">
              Tindakan ini tidak dapat dibatalkan secara otomatis.
            </p>
          </div>
        </div>

        {/* Message & List of Cards */}
        <div className="space-y-2">
          <p className="text-xs app-text-main leading-relaxed">
            Apakah Anda yakin ingin menghapus {count === 1 ? 'kartu ini' : `${count} kartu yang dipilih`} dari canvas?
          </p>

          <div className="max-h-40 overflow-y-auto app-bg-main border app-border rounded-xl p-2.5 space-y-1.5">
            {cardsToDelete.map((card) => (
              <div
                key={card.id}
                className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg app-bg-secondary border app-border"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="font-semibold app-text-main truncate">{card.title}</span>
                  {card.subtitle && (
                    <span className="text-[10px] app-text-muted truncate">({card.subtitle})</span>
                  )}
                </div>
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-mono app-accent-bg text-white shrink-0">
                  {card.category}
                </span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-amber-500 font-medium flex items-center gap-1.5 pt-1">
            <Icons.AlertTriangle size={13} className="shrink-0" />
            <span>Seluruh relasi koneksi terkait kartu ini juga akan dihapus.</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t app-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold app-text-muted hover:app-text-main app-bg-hover border app-border transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-md transition-colors flex items-center gap-1.5"
          >
            <Icons.Trash2 size={14} />
            <span>{count === 1 ? 'Hapus Kartu' : `Hapus ${count} Kartu`}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
