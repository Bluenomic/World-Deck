import React, { useState } from 'react';
import type { CardConnection, WorldCard, ConnectionDirection } from '../types';
import * as Icons from 'lucide-react';

interface ConnectionModalProps {
  connection: CardConnection;
  sourceCard?: WorldCard;
  targetCard?: WorldCard;
  allCards?: WorldCard[];
  onSave: (updatedConnection: CardConnection) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  connection,
  sourceCard,
  targetCard,
  allCards = [],
  onSave,
  onDelete,
  onClose,
}) => {
  const [label, setLabel] = useState(connection.label || '');
  const [description, setDescription] = useState(connection.description || '');
  const [direction, setDirection] = useState<ConnectionDirection>(connection.direction || 'directed');
  const [sourceId, setSourceId] = useState(connection.sourceId);
  const [targetId, setTargetId] = useState(connection.targetId);

  const currentSourceCard = allCards.find((c) => c.id === sourceId) || sourceCard;
  const currentTargetCard = allCards.find((c) => c.id === targetId) || targetCard;

  const handleToggleDirectionArrow = () => {
    // Swap source & target card IDs
    const prevSource = sourceId;
    setSourceId(targetId);
    setTargetId(prevSource);
    if (direction !== 'directed') {
      setDirection('directed');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...connection,
      sourceId,
      targetId,
      direction,
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
            className="p-1 app-text-muted hover:app-text-main rounded-md hover:app-bg-hover cursor-pointer"
          >
            <Icons.X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {/* Card Endpoints Summary & Interactive Center Arrow Button */}
          <div className="p-3.5 rounded-xl app-bg-main border app-border flex items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5 flex-1 min-w-0">
              <span className="text-[10px] app-text-muted uppercase tracking-wider font-semibold">Asal</span>
              <p className="font-bold app-text-main truncate" title={currentSourceCard?.title}>
                {currentSourceCard ? currentSourceCard.title : 'Kartu Asal'}
              </p>
            </div>

            {/* Clickable Center Arrow Button */}
            <button
              type="button"
              onClick={handleToggleDirectionArrow}
              className="p-2 rounded-xl app-bg-secondary border app-border hover:border-blue-500/70 hover:app-bg-hover app-text-main shrink-0 transition-all hover:scale-110 active:scale-95 cursor-pointer shadow-xs"
              title="Klik untuk membalikkan arah panah (Asal ⇄ Tujuan)"
            >
              {direction === 'directed' && <Icons.ArrowRight size={18} className="app-accent-text" />}
              {direction === 'bidirectional' && <Icons.ArrowLeftRight size={18} className="app-accent-text" />}
              {direction === 'undirected' && <Icons.Minus size={18} className="app-text-muted" />}
            </button>

            <div className="space-y-0.5 flex-1 min-w-0 text-right">
              <span className="text-[10px] app-text-muted uppercase tracking-wider font-semibold">Tujuan</span>
              <p className="font-bold app-text-main truncate" title={currentTargetCard?.title}>
                {currentTargetCard ? currentTargetCard.title : 'Kartu Tujuan'}
              </p>
            </div>
          </div>

          {/* Connection Direction Selector */}
          <div>
            <label className="block text-xs font-semibold app-text-muted mb-1.5">
              Jenis Arah Relasi
            </label>
            <div className="grid grid-cols-3 gap-2">
              {/* Satu Arah */}
              <button
                type="button"
                onClick={() => setDirection('directed')}
                className={`py-2.5 px-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  direction === 'directed'
                    ? 'app-accent-bg text-white border-transparent shadow-sm font-semibold'
                    : 'app-bg-main app-border app-text-muted hover:app-text-main hover:app-bg-hover'
                }`}
                title="Pilih Satu Arah"
              >
                <Icons.ArrowRight size={14} />
                <span>Satu Arah</span>
              </button>

              {/* Dua Arah */}
              <button
                type="button"
                onClick={() => setDirection('bidirectional')}
                className={`py-2.5 px-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  direction === 'bidirectional'
                    ? 'app-accent-bg text-white border-transparent shadow-sm font-semibold'
                    : 'app-bg-main app-border app-text-muted hover:app-text-main hover:app-bg-hover'
                }`}
                title="Pilih Dua Arah"
              >
                <Icons.ArrowLeftRight size={14} />
                <span>Dua Arah</span>
              </button>

              {/* Tanpa Panah */}
              <button
                type="button"
                onClick={() => setDirection('undirected')}
                className={`py-2.5 px-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  direction === 'undirected'
                    ? 'app-accent-bg text-white border-transparent shadow-sm font-semibold'
                    : 'app-bg-main app-border app-text-muted hover:app-text-main hover:app-bg-hover'
                }`}
                title="Pilih Tanpa Panah"
              >
                <Icons.Minus size={14} />
                <span>Tanpa Panah</span>
              </button>
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
              className="w-full app-bg-main border app-border rounded-lg px-3 py-2 text-xs app-text-main focus:outline-none focus:border-blue-500"
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
              className="w-full app-bg-main border app-border rounded-lg p-2.5 text-xs app-text-main focus:outline-none focus:border-blue-500"
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
                className="px-4 py-1.5 rounded-lg app-accent-bg text-white text-xs font-semibold cursor-pointer"
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
