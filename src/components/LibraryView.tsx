import React from 'react';
import type { WorldCard, CardCategory } from '../types';
import { CATEGORY_CONFIGS } from '../data/categoryConfig';
import * as Icons from 'lucide-react';

interface LibraryViewProps {
  cards: WorldCard[];
  selectedCategory: CardCategory | 'all';
  searchQuery: string;
  onCardClick: (card: WorldCard) => void;
  onAddCard: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  cards,
  selectedCategory,
  searchQuery,
  onCardClick,
  onAddCard,
}) => {
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
    <div className="flex-1 app-bg-main p-6 overflow-y-auto app-text-main transition-colors">
      <div className="max-w-7xl mx-auto space-y-5">
        
        {/* Header Banner */}
        <div className="flex items-center justify-between border-b app-border pb-3">
          <div>
            <h2 className="text-lg font-bold app-text-main flex items-center gap-2">
              <Icons.Library className="app-accent-text" size={20} />
              <span>Notion Board / Galeri Kartu</span>
            </h2>
            <p className="text-xs app-text-muted">
              Tampilan galeri database Notion untuk semua entitas dunia Anda.
            </p>
          </div>

          <button
            type="button"
            onClick={onAddCard}
            className="px-3.5 py-1.5 app-accent-bg text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5"
          >
            <Icons.Plus size={14} />
            <span>+ Halaman Kartu</span>
          </button>
        </div>

        {/* Grid Cards */}
        {filteredCards.length === 0 ? (
          <div className="text-center py-16 app-bg-secondary rounded-xl border app-border app-text-muted space-y-3">
            <Icons.FileText size={36} className="mx-auto app-text-muted opacity-50" />
            <p className="text-xs">Tidak ada kartu ditemukan.</p>
            <button
              type="button"
              onClick={onAddCard}
              className="px-3 py-1.5 app-bg-main border app-border app-accent-text rounded-lg text-xs font-semibold"
            >
              + Buat Kartu Pertama
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {filteredCards.map((card) => {
              const cfg = CATEGORY_CONFIGS[card.category] || CATEGORY_CONFIGS.character;
              const IconComp = (Icons as any)[cfg.iconName] || Icons.HelpCircle || (() => null);

              return (
                <div
                  key={card.id}
                  onClick={() => onCardClick(card)}
                  className="app-bg-secondary border app-border hover:border-purple-400 rounded-xl overflow-hidden shadow-md transition-all cursor-pointer group flex flex-col"
                >
                  {/* Category Pill Bar */}
                  <div className="px-3 py-2 app-bg-main border-b app-border flex items-center justify-between">
                    <div
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${cfg.bgGradient} ${cfg.borderColor}`}
                      style={{ color: cfg.color }}
                    >
                      <IconComp size={11} />
                      <span>{cfg.label}</span>
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
                        {card.title}
                      </h3>
                      {card.subtitle && (
                        <p className="text-[11px] app-text-muted">
                          {card.subtitle}
                        </p>
                      )}
                      <p className="text-[11px] app-text-muted line-clamp-2 leading-relaxed pt-1">
                        {card.summary}
                      </p>
                    </div>

                    {/* Footer Tags */}
                    {card.tags && card.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {card.tags.slice(0, 3).map((tag, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-1.5 py-0.5 rounded app-bg-main app-text-muted border app-border"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
