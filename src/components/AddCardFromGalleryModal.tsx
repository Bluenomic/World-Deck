import React, { useState } from 'react';
import type { WorldCard, WorldDeck, CardCategory } from '../types';
import { CATEGORY_CONFIGS } from '../data/categoryConfig';
import * as Icons from 'lucide-react';

interface AddCardFromGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  allCards: WorldCard[];
  allDecks: WorldDeck[];
  activeCanvasId: string;
  targetPosition: { x: number; y: number };
  onAddCardsToCanvas: (cardIds: string[], position: { x: number; y: number }) => void;
}

export const AddCardFromGalleryModal: React.FC<AddCardFromGalleryModalProps> = ({
  isOpen,
  onClose,
  allCards,
  allDecks,
  activeCanvasId,
  targetPosition,
  onAddCardsToCanvas,
}) => {
  const [activeTab, setActiveTab] = useState<'cards' | 'decks'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CardCategory | 'all'>('all');

  if (!isOpen) return null;

  const filteredCards = allCards.filter((card) => {
    const matchesCategory = selectedCategory === 'all' || card.category === selectedCategory;
    const matchesSearch =
      card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const filteredDecks = allDecks.filter((deck) =>
    deck.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelectCard = (id: string) => {
    setSelectedCardIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectDeck = (deck: WorldDeck) => {
    // Collect all card IDs in this deck
    const deckCards = allCards.filter(
      (c) => deck.cardIds.includes(c.id) || c.deckId === deck.id
    );
    const deckCardIds = deckCards.map((c) => c.id);

    // Toggle all deck card IDs
    const allSelected = deckCardIds.every((id) => selectedCardIds.includes(id));
    if (allSelected) {
      setSelectedCardIds((prev) => prev.filter((id) => !deckCardIds.includes(id)));
    } else {
      setSelectedCardIds((prev) => Array.from(new Set([...prev, ...deckCardIds])));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCardIds.length === 0) return;
    onAddCardsToCanvas(selectedCardIds, targetPosition);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl app-bg-main border app-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b app-border flex items-center justify-between app-bg-secondary">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl app-accent-bg text-white shadow-sm">
              <Icons.FolderPlus size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold app-text-main">Tambah Kartu dari Galeri</h3>
              <p className="text-[11px] app-text-muted">
                Pilih kartu atau Deck dari database untuk ditambahkan ke Kanvas ini
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

        {/* Tab Header & Search */}
        <div className="p-4 border-b app-border space-y-3 app-bg-main">
          <div className="flex items-center justify-between gap-3">
            <div className="flex bg-slate-900/60 p-1 rounded-xl border app-border text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('cards')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'cards'
                    ? 'app-accent-bg text-white shadow-sm'
                    : 'app-text-muted hover:app-text-main'
                }`}
              >
                <Icons.FileText size={14} />
                <span>Kartu ({allCards.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('decks')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'decks'
                    ? 'app-accent-bg text-white shadow-sm'
                    : 'app-text-muted hover:app-text-main'
                }`}
              >
                <Icons.Folder size={14} />
                <span>Deck / Folder ({allDecks.length})</span>
              </button>
            </div>

            {selectedCardIds.length > 0 && (
              <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/30">
                {selectedCardIds.length} Kartu Terpilih
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Icons.Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 app-text-muted"
              />
              <input
                type="text"
                placeholder={
                  activeTab === 'cards'
                    ? 'Cari nama kartu, ringkasan, tag...'
                    : 'Cari nama deck...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl app-bg-secondary border app-border focus:outline-none focus:border-purple-500 app-text-main"
              />
            </div>

            {activeTab === 'cards' && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as CardCategory | 'all')}
                className="px-3 py-2 text-xs rounded-xl app-bg-secondary border app-border text-xs focus:outline-none focus:border-purple-500 app-text-main font-medium cursor-pointer"
              >
                <option value="all">Semua Kategori</option>
                {Object.entries(CATEGORY_CONFIGS).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'cards' ? (
            filteredCards.length === 0 ? (
              <div className="text-center py-12 app-text-muted text-xs space-y-2">
                <Icons.FileX size={32} className="mx-auto opacity-50" />
                <p>Tidak ada kartu yang ditemukan.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredCards.map((card) => {
                  const isSelected = selectedCardIds.includes(card.id);
                  const isOnCurrentCanvas = (card.canvasId || 'default') === activeCanvasId;
                  const cfg = CATEGORY_CONFIGS[card.category] || CATEGORY_CONFIGS.character;

                  return (
                    <div
                      key={card.id}
                      onClick={() => toggleSelectCard(card.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'border-purple-500 bg-purple-500/10 shadow-sm'
                          : 'app-bg-secondary app-border hover:border-slate-600'
                      }`}
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-semibold border"
                            style={{
                              color: cfg.color,
                              borderColor: 'currentColor',
                              backgroundColor: `${cfg.color}15`,
                            }}
                          >
                            {cfg.label}
                          </span>
                          {isOnCurrentCanvas && (
                            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                              Di Kanvas
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold app-text-main truncate">
                          {card.title || 'Kartu Tanpa Judul'}
                        </h4>
                        {card.summary && (
                          <p className="text-[11px] app-text-muted line-clamp-1">
                            {card.summary}
                          </p>
                        )}
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 mt-0.5 ${
                          isSelected
                            ? 'bg-purple-600 border-purple-500 text-white'
                            : 'border-slate-700 bg-slate-800'
                        }`}
                      >
                        {isSelected && <Icons.Check size={12} strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : filteredDecks.length === 0 ? (
            <div className="text-center py-12 app-text-muted text-xs space-y-2">
              <Icons.FolderX size={32} className="mx-auto opacity-50" />
              <p>Belum ada Deck / Folder di Galeri.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredDecks.map((deck) => {
                const deckCards = allCards.filter(
                  (c) => deck.cardIds.includes(c.id) || c.deckId === deck.id
                );
                const deckCardIds = deckCards.map((c) => c.id);
                const allSelected =
                  deckCardIds.length > 0 &&
                  deckCardIds.every((id) => selectedCardIds.includes(id));
                const someSelected =
                  !allSelected && deckCardIds.some((id) => selectedCardIds.includes(id));

                return (
                  <div
                    key={deck.id}
                    onClick={() => handleSelectDeck(deck)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      allSelected
                        ? 'border-purple-500 bg-purple-500/10 shadow-sm'
                        : someSelected
                        ? 'border-purple-500/50 bg-purple-500/5'
                        : 'app-bg-secondary app-border hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                        style={{
                          backgroundColor: `${deck.color || '#8b5cf6'}20`,
                          borderColor: deck.color || '#8b5cf6',
                          color: deck.color || '#a855f7',
                        }}
                      >
                        <Icons.Folder size={18} />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <h4 className="text-xs font-bold app-text-main truncate">
                          {deck.name}
                        </h4>
                        <p className="text-[11px] app-text-muted">
                          {deckCards.length} Kartu didalamnya
                        </p>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                        allSelected
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : someSelected
                          ? 'bg-purple-600/40 border-purple-500 text-white'
                          : 'border-slate-700 bg-slate-800'
                      }`}
                    >
                      {(allSelected || someSelected) && <Icons.Check size={12} strokeWidth={3} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t app-border flex items-center justify-between app-bg-secondary">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold app-text-muted hover:app-text-main transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedCardIds.length === 0}
            className={`px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 ${
              selectedCardIds.length > 0
                ? 'app-accent-bg text-white hover:brightness-110 cursor-pointer active:scale-95'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <Icons.Plus size={14} strokeWidth={2.5} />
            <span>Tambahkan ({selectedCardIds.length}) Kartu ke Kanvas</span>
          </button>
        </div>
      </div>
    </div>
  );
};
