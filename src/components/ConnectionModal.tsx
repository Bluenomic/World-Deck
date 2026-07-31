import React, { useState } from 'react';
import type { CardConnection, WorldCard } from '../types';
import * as Icons from 'lucide-react';

interface ConnectionModalProps {
  connection: CardConnection;
  sourceCard?: WorldCard;
  targetCard?: WorldCard;
  onSave: (updatedConnection: CardConnection) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  connection,
  sourceCard,
  targetCard,
  onSave,
  onDelete,
  onClose,
}) => {
  const [label, setLabel] = useState(connection.label || '');
  const [description, setDescription] = useState(connection.description || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...connection,
      label: label.trim() || 'Terhubung',
      description: description.trim(),
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 backdrop-animate-appear cursor-pointer"
      onClick={onClose}
    >
      <div 
        className="app-bg-secondary border app-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden app-text-main transition-colors modal-animate-appear cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="px-5 py-3.5 app-bg-main border-b app-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icons.GitCommit size={16} className="app-accent-text" />
            <h3 className="text-sm font-bold app-text-main">Edit Relasi Hubungan</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 app-text-muted hover:app-text-main rounded-md hover:app-bg-hover"
          >
            <Icons.X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {/* Card Endpoints Summary */}
          <div className="p-3 rounded-xl app-bg-main border app-border flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] app-text-muted uppercase">Asal</span>
              <p className="font-bold app-text-main truncate max-w-[120px]">
                {sourceCard ? sourceCard.title : 'Kartu Asal'}
              </p>
            </div>

            <Icons.ArrowRight size={14} className="app-accent-text shrink-0" />

            <div className="space-y-0.5 text-right">
              <span className="text-[10px] app-text-muted uppercase">Tujuan</span>
              <p className="font-bold app-text-main truncate max-w-[120px]">
                {targetCard ? targetCard.title : 'Kartu Tujuan'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold app-text-muted mb-1">
              Label Hubungan (mis. Pemimpin, Musuh, Terletak Di) *
            </label>
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Masukkan label..."
              className="w-full app-bg-main border app-border rounded-lg px-3 py-2 text-xs app-text-main focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold app-text-muted mb-1">
              Deskripsi Hubungan (Opsional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Penjelasan detail sejarah hubungan..."
              className="w-full app-bg-main border app-border rounded-lg p-2.5 text-xs app-text-main focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="pt-2 border-t app-border flex items-center justify-between">
            <button
              type="button"
              onClick={() => onDelete(connection.id)}
              className="px-3 py-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 text-xs font-medium"
            >
              Hapus Hubungan
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg border app-border app-text-muted text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg app-accent-bg text-white text-xs font-semibold"
              >
                Simpan
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
