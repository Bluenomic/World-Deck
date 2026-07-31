import React from 'react';
import type { WorldCard } from '../types';
import * as Icons from 'lucide-react';

interface DeleteCardModalProps {
  isOpen: boolean;
  cardsToDelete: WorldCard[];
  onClose: () => void;
  onRemoveFromCanvas?: () => void;
  onPermanentDelete: () => void;
}

export const DeleteCardModal: React.FC<DeleteCardModalProps> = ({
  isOpen,
  cardsToDelete,
  onClose,
  onRemoveFromCanvas,
  onPermanentDelete,
}) => {
  const count = cardsToDelete.length;
  const hasCanvasCards = cardsToDelete.some((c) => !!c.canvasId);

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
        if (hasCanvasCards && onRemoveFromCanvas) {
          onRemoveFromCanvas();
        } else {
          onPermanentDelete();
        }
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, cardsToDelete, hasCanvasCards, onRemoveFromCanvas, onPermanentDelete, onClose]);

  if (!isOpen || cardsToDelete.length === 0) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4 backdrop-animate-appear cursor-pointer"
      onClick={onClose}
    >
      <div
        className="app-bg-secondary border app-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 modal-animate-appear cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Icon */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center">
            <Icons.HelpCircle size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold app-text-main">
              Opsi Penghapusan Kartu ({count})
            </h3>
            <p className="text-xs app-text-muted">
              Pilih tingkat penghapusan yang ingin Anda terapkan.
            </p>
          </div>
        </div>

        {/* Message & List of Cards */}
        <div className="space-y-3">
          <div className="max-h-40 overflow-y-auto app-bg-main border app-border rounded-xl p-2.5 space-y-1.5">
            {cardsToDelete.map((card) => (
              <div
                key={card.id}
                className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg app-bg-secondary border app-border"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="font-semibold app-text-main truncate">
                    {card.title || 'Kartu Tanpa Judul'}
                  </span>
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
        </div>

        {/* Choice Options */}
        <div className="space-y-2 pt-1 border-t app-border">
          {hasCanvasCards && onRemoveFromCanvas && (
            <button
              type="button"
              onClick={() => {
                onRemoveFromCanvas();
                onClose();
              }}
              className="w-full p-3 rounded-xl app-bg-main border border-amber-500/30 hover:border-amber-500 text-left flex items-start gap-3 transition-all cursor-pointer group"
            >
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors mt-0.5 shrink-0">
                <Icons.MinusCircle size={18} />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold app-text-main group-hover:text-amber-400 transition-colors flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span>Lepas dari Kanvas Ini Saja</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                      Tekan Enter ↵
                    </span>
                  </span>
                  <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                    Disimpan di Galeri
                  </span>
                </h4>
                <p className="text-[11px] app-text-muted mt-0.5">
                  Kartu dilepas dari tampilan kanvas aktif ini, namun tetap utuh tersimpan di Galeri proyek.
                </p>
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onPermanentDelete();
              onClose();
            }}
            className="w-full p-3 rounded-xl app-bg-main border border-rose-500/30 hover:border-rose-500 text-left flex items-start gap-3 transition-all cursor-pointer group"
          >
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 group-hover:bg-rose-500 group-hover:text-white transition-colors mt-0.5 shrink-0">
              <Icons.Trash2 size={18} />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-bold app-text-main group-hover:text-rose-400 transition-colors flex items-center justify-between">
                <span>Hapus Permanen dari Proyek</span>
                <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                  Hapus Total
                </span>
              </h4>
              <p className="text-[11px] app-text-muted mt-0.5">
                Kartu dan seluruh relasi koneksi terkait akan dihapus permanen dari Galeri & seluruh proyek.
              </p>
            </div>
          </button>
        </div>

        {/* Footer Cancel Button */}
        <div className="flex items-center justify-end pt-2 border-t app-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold app-text-muted hover:app-text-main app-bg-main border app-border transition-colors cursor-pointer"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};
