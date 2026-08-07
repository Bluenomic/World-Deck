import React, { useState } from 'react';
import type { WorldCard, WorldDeck, CardCategory } from '../types';
import { CATEGORY_CONFIGS } from '../data/categoryConfig';
import { useLanguage } from '../i18n/LanguageContext';
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
  targetPosition,
  onAddCardsToCanvas,
}) => {
  const { language, t, getCategoryLabel } = useLanguage();
  const [activeTab, setActiveTab] = useState<'cards' | 'decks'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const selectedCategory: CardCategory | 'all' = 'all';

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
    const deckCards = allCards.filter(
      (c) => deck.cardIds.includes(c.id) || c.deckId === deck.id
    );
    const deckCardIds = deckCards.map((c) => c.id);

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
              <h3 className="text-sm font-bold app-text-main">{t.library.addCardToCanvas}</h3>
              <p className="text-[11px] app-text-muted">
                {language === 'en'
                  ? 'Select cards or decks from gallery to add to this canvas'
                  : 'Pilih kartu atau Deck dari galeri untuk ditambahkan ke Kanvas ini'}
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
                <span>{t.library.cards} ({allCards.length})</span>
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
                <span>{t.library.decks} ({allDecks.length})</span>
              </button>
            </div>

            {selectedCardIds.length > 0 && (
              <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/30">
                {selectedCardIds.length} {t.library.cardsSelected}
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
                    ? t.sidebar.searchPlaceholder
                    : (language === 'en' ? 'Search deck name...' : 'Cari nama deck...')
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1e1e1e] border app-border rounded-xl pl-9 pr-3 py-1.5 text-xs app-text-main focus:outline-none focus:border-[#0d99ff]"
              />
            </div>
          </div>
        </div>

        {/* Modal Body / Grid */}
        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar app-bg-main">
          {activeTab === 'cards' ? (
            filteredCards.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs italic">
                {t.library.noCardsFound}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredCards.map((card) => {
                  const isSelected = selectedCardIds.includes(card.id);
                  const cfg = CATEGORY_CONFIGS[card.category] || CATEGORY_CONFIGS.character;
                  const IconComp = (Icons as any)[cfg.iconName] || Icons.HelpCircle;

                  return (
                    <div
                      key={card.id}
                      onClick={() => toggleSelectCard(card.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-[#2c2c2c] border-[#0d99ff] ring-1 ring-[#0d99ff]/50 shadow-md'
                          : 'bg-[#2c2c2c]/50 border-[#383838] hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 bg-[#1e1e1e]"
                          style={{ borderColor: `${cfg.color}40`, color: cfg.color }}
                        >
                          <IconComp size={15} />
                        </div>
                        <div className="truncate">
                          <h4 className="text-xs font-bold text-white truncate">
                            {card.title || t.common.untitled}
                          </h4>
                          <p className="text-[10px] text-slate-400 truncate max-w-[180px]">
                            {getCategoryLabel(card.category)}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                          isSelected
                            ? 'bg-[#0d99ff] border-[#0d99ff] text-white'
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
            <div className="text-center py-12 text-slate-500 text-xs italic">
              {language === 'en' ? 'No decks found' : 'Tidak ada deck ditemukan'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredDecks.map((deck) => {
                const deckCards = allCards.filter(
                  (c) => deck.cardIds.includes(c.id) || c.deckId === deck.id
                );
                const deckCardIds = deckCards.map((c) => c.id);
                const allSelected = deckCardIds.length > 0 && deckCardIds.every((id) => selectedCardIds.includes(id));
                const someSelected = deckCardIds.some((id) => selectedCardIds.includes(id));

                return (
                  <div
                    key={deck.id}
                    onClick={() => handleSelectDeck(deck)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      allSelected
                        ? 'bg-[#2c2c2c] border-purple-500 ring-1 ring-purple-500/50 shadow-md'
                        : 'bg-[#2c2c2c]/50 border-[#383838] hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 bg-[#1e1e1e]"
                        style={{ borderColor: `${deck.color || '#3b82f6'}40`, color: deck.color || '#3b82f6' }}
                      >
                        <Icons.Folder size={15} />
                      </div>
                      <div className="truncate">
                        <h4 className="text-xs font-bold text-white truncate">
                          {deck.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 truncate">
                          {deckCards.length} {t.library.cards}
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
            className="px-3.5 py-1.5 text-xs font-semibold app-text-muted hover:app-text-main transition-colors cursor-pointer"
          >
            {t.common.cancel}
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
            <span>
              {language === 'en'
                ? `Add (${selectedCardIds.length}) Cards to Canvas`
                : `Tambahkan (${selectedCardIds.length}) Kartu ke Kanvas`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
