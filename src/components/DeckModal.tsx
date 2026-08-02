import React, { useState, useEffect } from 'react';
import type { WorldDeck } from '../types';
import * as Icons from 'lucide-react';

interface DeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  deck?: WorldDeck | null;
  onSaveDeck: (name: string, description: string, color: string) => void;
}

const COLOR_PRESETS = [
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Sky', hex: '#0284c7' },
];

export const DeckModal: React.FC<DeckModalProps> = ({
  isOpen,
  onClose,
  deck,
  onSaveDeck,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');

  useEffect(() => {
    if (deck) {
      setName(deck.name || '');
      setDescription(deck.description || '');
      setColor(deck.color || '#3b82f6');
    } else {
      setName('');
      setDescription('');
      setColor('#3b82f6');
    }
  }, [deck, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSaveDeck(name.trim(), description.trim(), color);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md app-bg-main border app-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b app-border flex items-center justify-between app-bg-secondary">
          <div className="flex items-center gap-2.5">
            <div
              className="p-2 rounded-xl text-white shadow-sm flex items-center justify-center"
              style={{ backgroundColor: color }}
            >
              <Icons.FolderPlus size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold app-text-main">
                {deck ? 'Edit Deck / Folder' : 'Buat Deck Baru'}
              </h3>
              <p className="text-[11px] app-text-muted">
                Wadah untuk mengelompokkan kartu-kartu di galeri
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg app-text-muted hover:app-bg-hover hover:app-text-main transition-colors"
          >
            <Icons.X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold app-text-main flex items-center gap-1.5">
              <span>Nama Deck / Folder</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: faksi-faksi-kegelapan, Karakter Utama, dll."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl app-bg-secondary border app-border focus:outline-none focus:border-blue-500 app-text-main font-medium"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold app-text-main">Deskripsi (Opsional)</label>
            <textarea
              rows={3}
              placeholder="Catatan singkat tentang isi deck ini..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl app-bg-secondary border app-border focus:outline-none focus:border-blue-500 app-text-main font-medium resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold app-text-main">Warna Identitas Deck</label>
            <div className="flex items-center gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => setColor(preset.hex)}
                  className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    color === preset.hex
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110'
                      : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: preset.hex }}
                >
                  {color === preset.hex && <Icons.Check size={14} className="text-white drop-shadow" />}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t app-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold app-text-muted hover:app-text-main transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className={`px-5 py-2 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 ${
                name.trim()
                  ? 'app-accent-bg text-white hover:brightness-110 cursor-pointer active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <Icons.Save size={14} />
              <span>{deck ? 'Simpan Perubahan' : 'Buat Deck'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
