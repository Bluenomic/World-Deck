import React, { useState } from 'react';
import type { WorldCard, CardCategory } from '../types';
import { CATEGORY_CONFIGS } from '../data/categoryConfig';
import * as Icons from 'lucide-react';

interface SidebarFilterProps {
  cards: WorldCard[];
  selectedCategory: CardCategory | 'all';
  onCategorySelect: (cat: CardCategory | 'all') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCardId: string | null;
  onCardClick: (card: WorldCard) => void;
}

export const SidebarFilter: React.FC<SidebarFilterProps> = ({
  cards,
  selectedCategory,
  onCategorySelect,
  searchQuery,
  onSearchChange,
  selectedCardId,
  onCardClick,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const filteredCards = cards.filter((card) => {
    const matchesCategory =
      selectedCategory === 'all' || card.category === selectedCategory;
    const matchesSearch =
      card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-16 left-3 z-40 p-2 rounded-lg app-bg-secondary border app-border app-text-main shadow-lg"
      >
        <Icons.Menu size={18} />
      </button>

      {/* Sidebar Panel */}
      <aside
        className={`fixed md:relative top-0 left-0 h-full w-72 app-bg-secondary border-r app-border flex flex-col z-30 transition-all duration-200 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Sidebar Header / Search */}
        <div className="p-3 border-b app-border space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold uppercase tracking-wider app-text-muted">
              Workspace Navigation
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded app-bg-main app-text-muted font-mono border app-border">
              {filteredCards.length}
            </span>
          </div>

          {/* Quick Search Bar */}
          <div className="relative">
            <Icons.Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 app-text-muted"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari kartu, #tag, lore..."
              className="w-full app-bg-main border app-border rounded-lg pl-8 pr-12 py-1.5 text-xs app-text-main placeholder-slate-500 focus:outline-none"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono app-text-muted px-1 app-bg-secondary rounded border app-border">
              Ctrl K
            </span>
          </div>
        </div>

        {/* Categories Section */}
        <div className="p-2 border-b app-border space-y-0.5 max-h-52 overflow-y-auto">
          <span className="text-[10px] uppercase font-bold app-text-muted px-2 block my-1">
            Kategori
          </span>

          <button
            type="button"
            onClick={() => onCategorySelect('all')}
            className={`w-full px-2.5 py-1.5 rounded-md text-xs text-left flex items-center justify-between transition-colors ${
              selectedCategory === 'all'
                ? 'app-bg-main app-text-main font-semibold border app-border'
                : 'app-text-muted hover:app-text-main app-bg-hover'
            }`}
          >
            <div className="flex items-center gap-2">
              <Icons.Layers size={13} className="app-text-muted" />
              <span>Semua Kategori</span>
            </div>
            <span className="text-[10px] font-mono app-text-muted">{cards.length}</span>
          </button>

          {(Object.keys(CATEGORY_CONFIGS) as CardCategory[]).map((cat) => {
            const cfg = CATEGORY_CONFIGS[cat];
            const count = cards.filter((c) => c.category === cat).length;
            const isSelected = selectedCategory === cat;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => onCategorySelect(cat)}
                className={`w-full px-2.5 py-1.5 rounded-md text-xs text-left flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'app-bg-main app-text-main font-semibold border app-border'
                    : 'app-text-muted hover:app-text-main app-bg-hover'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <span>{cfg.label}</span>
                </div>
                <span className="text-[10px] font-mono app-text-muted">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Card Quick List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <span className="text-[10px] uppercase font-bold app-text-muted px-2 block my-1">
            Halaman Kartu (Fokus)
          </span>

          {filteredCards.length === 0 ? (
            <div className="text-center py-6 app-text-muted text-xs">
              Belum ada kartu.
            </div>
          ) : (
            filteredCards.map((card) => {
              const isSelected = selectedCardId === card.id;
              const cfg = CATEGORY_CONFIGS[card.category];

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onCardClick(card)}
                  className={`w-full px-2.5 py-1.5 rounded-md text-left transition-colors flex items-center gap-2 text-xs ${
                    isSelected
                      ? 'app-bg-main app-text-main font-semibold border-l-2 border-purple-500'
                      : 'app-text-muted hover:app-text-main app-bg-hover'
                  }`}
                >
                  <Icons.FileText size={13} className="shrink-0 app-text-muted" />
                  <span className="truncate flex-1">{card.title}</span>
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: cfg.color }}
                  />
                </button>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
};
