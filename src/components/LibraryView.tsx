import React, { useState } from 'react';
import type { WorldCard, WorldDeck, CardCategory } from '../types';
import { CATEGORY_CONFIGS } from '../data/categoryConfig';
import * as Icons from 'lucide-react';

interface LibraryViewProps {
  cards: WorldCard[];
  decks: WorldDeck[];
  selectedCategory: CardCategory | 'all';
  searchQuery: string;
  onCardClick: (card: WorldCard) => void;
  onAddCard: (deckId?: string) => void;
  onCreateDeckRequest: () => void;
  onEditDeckRequest: (deck: WorldDeck) => void;
  onDeleteDeckRequest: (deckId: string) => void;
  onAssignCardToDeck: (cardId: string, deckId?: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  cards,
  decks,
  selectedCategory,
  searchQuery,
  onCardClick,
  onAddCard,
  onCreateDeckRequest,
  onEditDeckRequest,
  onDeleteDeckRequest,
  onAssignCardToDeck,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'decks' | 'cards'>('all');
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);

  // Get active deck if user navigated inside a deck
  const activeDeck = decks.find((d) => d.id === activeDeckId) || null;

  // Filter cards based on search, category, and active deck navigation
  const filteredCards = cards.filter((card) => {
    // If inside a specific deck view
    if (activeDeckId) {
      const isInDeck = card.deckId === activeDeckId || (activeDeck?.cardIds || []).includes(card.id);
      if (!isInDeck) return false;
    }

    const matchesCategory =
      selectedCategory === 'all' || card.category === selectedCategory;
    const matchesSearch =
      card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const filteredDecks = decks.filter((deck) =>
    deck.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (deck.description && deck.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex-1 app-bg-main p-6 overflow-y-auto app-text-main transition-colors">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b app-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold app-text-main flex items-center gap-2">
                <Icons.Library className="app-accent-text" size={22} />
                <span>Galeri</span>
              </h2>
            </div>
            <p className="text-xs app-text-muted mt-1">
              Arsip galeri terstruktur untuk mengelompokkan kartu entitas dan Deck folder dunia Anda.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onCreateDeckRequest}
              className="px-3.5 py-2 app-bg-secondary border app-border hover:border-purple-500 rounded-xl text-xs font-bold app-text-main transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            >
              <Icons.FolderPlus size={15} className="text-purple-400" />
              <span>+ Buat Deck Baru</span>
            </button>

            <button
              type="button"
              onClick={() => onAddCard(activeDeckId || undefined)}
              className="px-4 py-2 app-accent-bg text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer hover:brightness-110 active:scale-95"
            >
              <Icons.Plus size={15} strokeWidth={2.5} />
              <span>+ Buat Kartu Baru</span>
            </button>
          </div>
        </div>

        {/* Deck Navigation Breadcrumb (If inside a Deck) */}
        {activeDeck ? (
          <div className="flex items-center justify-between p-3.5 rounded-2xl app-bg-secondary border border-purple-500/30 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveDeckId(null)}
                className="px-3 py-1.5 rounded-xl app-bg-main border app-border hover:border-purple-400 text-xs font-bold app-text-main flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Icons.ArrowLeft size={14} />
                <span>Kembali ke Galeri</span>
              </button>
              <div className="h-4 w-[1px] bg-slate-700" />
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: activeDeck.color || '#8b5cf6' }}
                >
                  <Icons.Folder size={14} />
                </div>
                <div>
                  <h3 className="text-xs font-bold app-text-main flex items-center gap-2">
                    <span>Deck: {activeDeck.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold">
                      {filteredCards.length} Kartu
                    </span>
                  </h3>
                  {activeDeck.description && (
                    <p className="text-[11px] app-text-muted">{activeDeck.description}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onEditDeckRequest(activeDeck)}
                className="px-2.5 py-1.5 rounded-lg app-bg-main border app-border hover:border-slate-500 text-xs font-semibold app-text-muted hover:app-text-main transition-colors flex items-center gap-1"
              >
                <Icons.Edit3 size={13} />
                <span>Edit Deck</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteDeckRequest(activeDeck.id);
                  setActiveDeckId(null);
                }}
                className="px-2.5 py-1.5 rounded-lg app-bg-main border app-border hover:border-rose-500 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-1"
              >
                <Icons.Trash2 size={13} />
                <span>Hapus Deck</span>
              </button>
            </div>
          </div>
        ) : (
          /* Filter Tabs */
          <div className="flex items-center justify-between">
            <div className="flex bg-slate-900/60 p-1 rounded-xl border app-border text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'app-accent-bg text-white shadow-sm'
                    : 'app-text-muted hover:app-text-main'
                }`}
              >
                Semua ({decks.length + cards.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('decks')}
                className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'decks'
                    ? 'app-accent-bg text-white shadow-sm'
                    : 'app-text-muted hover:app-text-main'
                }`}
              >
                <Icons.Folder size={14} />
                <span>Deck / Folder ({decks.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('cards')}
                className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'cards'
                    ? 'app-accent-bg text-white shadow-sm'
                    : 'app-text-muted hover:app-text-main'
                }`}
              >
                <Icons.FileText size={14} />
                <span>Kartu ({cards.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* DECKS GRID SECTION (If not inside a specific deck & tab allows) */}
        {!activeDeckId && (activeTab === 'all' || activeTab === 'decks') && (
          <div className="space-y-3">
            {activeTab === 'all' && decks.length > 0 && (
              <div className="flex items-center justify-between pt-1">
                <h3 className="text-xs font-bold app-text-muted uppercase tracking-wider flex items-center gap-1.5">
                  <Icons.Folder size={14} className="text-purple-400" />
                  <span>Daftar Deck ({filteredDecks.length})</span>
                </h3>
              </div>
            )}

            {filteredDecks.length === 0 ? (
              activeTab === 'decks' && (
                <div className="text-center py-12 app-bg-secondary rounded-2xl border app-border app-text-muted space-y-3">
                  <Icons.FolderPlus size={36} className="mx-auto text-purple-400 opacity-50" />
                  <p className="text-xs">Belum ada Deck / Folder yang dibuat.</p>
                  <button
                    type="button"
                    onClick={onCreateDeckRequest}
                    className="px-3.5 py-2 app-accent-bg text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                  >
                    + Buat Deck Pertama
                  </button>
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredDecks.map((deck) => {
                  const deckCards = cards.filter(
                    (c) => c.deckId === deck.id || (deck.cardIds || []).includes(c.id)
                  );
                  const deckColor = deck.color || '#a855f7';

                  return (
                    <div
                      key={deck.id}
                      onClick={() => setActiveDeckId(deck.id)}
                      className="app-bg-secondary border app-border hover:border-purple-400 rounded-2xl p-4 shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3 relative overflow-hidden"
                    >
                      {/* Top Accent Line */}
                      <div
                        className="absolute top-0 left-0 right-0 h-1"
                        style={{ backgroundColor: deckColor }}
                      />

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform"
                              style={{ backgroundColor: deckColor }}
                            >
                              <Icons.Folder size={18} />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold app-text-main group-hover:text-purple-400 transition-colors line-clamp-1">
                                {deck.name}
                              </h4>
                              <span className="text-[10px] font-semibold app-text-muted">
                                {deckCards.length} Kartu
                              </span>
                            </div>
                          </div>
                        </div>

                        {deck.description && (
                          <p className="text-[11px] app-text-muted line-clamp-2 leading-relaxed">
                            {deck.description}
                          </p>
                        )}
                      </div>

                      {/* Card previews inside deck */}
                      {deckCards.length > 0 ? (
                        <div className="pt-2 border-t app-border flex items-center justify-between text-[10px] app-text-muted">
                          <div className="flex -space-x-1.5 overflow-hidden">
                            {deckCards.slice(0, 4).map((c, idx) => {
                              const cfg = CATEGORY_CONFIGS[c.category] || CATEGORY_CONFIGS.character;
                              return (
                                <div
                                  key={c.id || idx}
                                  className="w-5 h-5 rounded-full border border-slate-900 flex items-center justify-center text-[9px] font-bold text-white shadow-sm"
                                  style={{ backgroundColor: cfg.color }}
                                  title={c.title}
                                >
                                  {c.title ? c.title.charAt(0).toUpperCase() : '?'}
                                </div>
                              );
                            })}
                          </div>
                          <span className="group-hover:text-purple-400 font-semibold transition-colors flex items-center gap-0.5">
                            Buka Deck ➔
                          </span>
                        </div>
                      ) : (
                        <div className="pt-2 border-t app-border text-[10px] app-text-muted flex items-center justify-between">
                          <span>Deck Kosong</span>
                          <span className="group-hover:text-purple-400 font-semibold transition-colors">
                            + Tambah Kartu
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CARDS GRID SECTION */}
        {!activeDeckId && activeTab === 'all' && cards.length > 0 && (
          <div className="pt-3 border-t app-border">
            <h3 className="text-xs font-bold app-text-muted uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <Icons.FileText size={14} className="text-purple-400" />
              <span>Daftar Kartu ({filteredCards.length})</span>
            </h3>
          </div>
        )}

        {(activeDeckId || activeTab === 'all' || activeTab === 'cards') && (
          filteredCards.length === 0 ? (
            (activeTab === 'cards' || activeDeckId) && (
              <div className="text-center py-16 app-bg-secondary rounded-2xl border app-border app-text-muted space-y-3">
                <Icons.FileText size={36} className="mx-auto app-text-muted opacity-50" />
                <p className="text-xs">Tidak ada kartu ditemukan dalam tampilan ini.</p>
                <button
                  type="button"
                  onClick={() => onAddCard(activeDeckId || undefined)}
                  className="px-3.5 py-2 app-accent-bg text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                >
                  + Buat Kartu Baru
                </button>
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredCards.map((card) => {
                const cfg = CATEGORY_CONFIGS[card.category] || CATEGORY_CONFIGS.character;
                const IconComp = (Icons as any)[cfg.iconName] || Icons.HelpCircle || (() => null);
                const assignedDeck = decks.find((d) => d.id === card.deckId || (d.cardIds || []).includes(card.id));

                return (
                  <div
                    key={card.id}
                    onClick={() => onCardClick(card)}
                    className="app-bg-secondary border app-border hover:border-purple-400 rounded-2xl overflow-hidden shadow-md transition-all cursor-pointer group flex flex-col"
                  >
                    {/* Header Pill Bar */}
                    <div className="px-3 py-2 app-bg-main border-b app-border flex items-center justify-between gap-2">
                      <div
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${cfg.bgGradient} ${cfg.borderColor}`}
                        style={{ color: cfg.color }}
                      >
                        <IconComp size={11} />
                        <span>{cfg.label}</span>
                      </div>

                      {/* Deck Selector Dropdown Badge */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="relative group/deck"
                      >
                        <select
                          value={card.deckId || ''}
                          onChange={(e) => onAssignCardToDeck(card.id, e.target.value || undefined)}
                          className="bg-slate-900/80 border app-border text-[10px] font-semibold rounded px-1.5 py-0.5 app-text-muted hover:app-text-main focus:outline-none cursor-pointer max-w-[110px] truncate"
                          title="Pilih Deck / Folder untuk kartu ini"
                        >
                          <option value="">(Tanpa Deck)</option>
                          {decks.map((d) => (
                            <option key={d.id} value={d.id}>
                              📁 {d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Image */}
                    {card.imageUrl && (
                      <div className="h-32 w-full overflow-hidden relative">
                        <img
                          src={card.imageUrl}
                          alt={card.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                    {/* Content */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                      <div className="space-y-1">
                        <h3 className="text-xs font-bold app-text-main group-hover:text-purple-400 transition-colors">
                          {card.title || 'Kartu Tanpa Judul'}
                        </h3>
                        {card.subtitle && (
                          <p className="text-[11px] app-text-muted">
                            {card.subtitle}
                          </p>
                        )}
                        <p className="text-[11px] app-text-muted line-clamp-2 leading-relaxed pt-1">
                          {card.summary || 'Belum ada ringkasan...'}
                        </p>
                      </div>

                      {/* Footer Info */}
                      <div className="pt-2 border-t app-border flex items-center justify-between">
                        {assignedDeck ? (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded border flex items-center gap-1"
                            style={{
                              borderColor: assignedDeck.color || '#8b5cf6',
                              color: assignedDeck.color || '#a855f7',
                              backgroundColor: `${assignedDeck.color || '#8b5cf6'}15`,
                            }}
                          >
                            <Icons.Folder size={10} />
                            <span className="truncate max-w-[90px]">{assignedDeck.name}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] app-text-muted">Lokal</span>
                        )}

                        {card.tags && card.tags.length > 0 && (
                          <div className="flex items-center gap-1">
                            {card.tags.slice(0, 2).map((tag, i) => (
                              <span
                                key={i}
                                className="text-[9px] px-1.5 py-0.5 rounded app-bg-main app-text-muted border app-border"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
};
