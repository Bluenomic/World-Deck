import React, { useEffect } from 'react';
import * as Icons from 'lucide-react';

export type DeleteTargetType = 'node' | 'track' | 'clear_all';

export interface TimelineDeleteTarget {
  type: DeleteTargetType;
  id?: string;
  title: string;
  subtitle?: string;
  itemCount?: number;
}

interface TimelineDeleteModalProps {
  isOpen: boolean;
  target: TimelineDeleteTarget | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const TimelineDeleteModal: React.FC<TimelineDeleteModalProps> = ({
  isOpen,
  target,
  onClose,
  onConfirm,
}) => {
  useEffect(() => {
    if (!isOpen || !target) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, target, onClose, onConfirm]);

  if (!isOpen || !target) return null;

  const getHeaderInfo = () => {
    switch (target.type) {
      case 'node':
        return {
          icon: <Icons.Trash2 size={20} className="text-rose-400" />,
          badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          title: 'Hapus Kejadian Waktu',
          desc: 'Apakah Anda yakin ingin menghapus kejadian ini dari garis waktu?',
          confirmText: 'Hapus Kejadian',
        };
      case 'track':
        return {
          icon: <Icons.AlertTriangle size={20} className="text-amber-400" />,
          badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          title: 'Hapus Garis Waktu Paralel',
          desc: 'Tindakan ini akan menghapus garis waktu beserta seluruh kejadian di dalamnya.',
          confirmText: 'Hapus Garis Waktu',
        };
      case 'clear_all':
        return {
          icon: <Icons.AlertOctagon size={20} className="text-rose-500" />,
          badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
          title: 'Bersihkan Seluruh Garis Waktu',
          desc: 'Semua kejadian di seluruh garis waktu akan dihapus secara permanen.',
          confirmText: 'Bersihkan Semua',
        };
    }
  };

  const info = getHeaderInfo();

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[100] flex items-center justify-center p-4 cursor-pointer"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl text-white modal-animate-appear cursor-default space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${info.badgeClass}`}>
              {info.icon}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-snug">{info.title}</h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">{info.desc}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <Icons.X size={16} />
          </button>
        </div>

        {/* Item Content Preview */}
        <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
            {target.subtitle || 'Target Penghapusan'}
          </div>
          <div className="text-sm font-bold text-white truncate">
            {target.title}
          </div>
          {target.itemCount !== undefined && (
            <div className="text-[11px] text-zinc-400">
              Total kejadian terdampak: <span className="font-bold text-zinc-200">{target.itemCount}</span>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="pt-2 flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-semibold hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all shadow-lg hover:shadow-rose-600/30 cursor-pointer flex items-center gap-1.5"
          >
            <Icons.Trash2 size={14} />
            <span>{info.confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
