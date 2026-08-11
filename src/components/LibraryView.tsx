import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import type { WorldCard, WorldDeck, CardCategory } from '../types';
import { CATEGORY_CONFIGS } from '../data/categoryConfig';
import { useLanguage } from '../i18n/LanguageContext';
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
  onReorderCards?: (orderedCardIds: string[]) => void;
  onEditCardRequest: (card: WorldCard) => void;
  onOpenCardFullPage: (card: WorldCard) => void;
  onDeleteCardsRequest: (cardIds: string[]) => void;
  onAdjustImageFocalPointRequest?: (card: WorldCard) => void;
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
  onEditCardRequest,
  onOpenCardFullPage,
  onDeleteCardsRequest,
  onAdjustImageFocalPointRequest,
}) => {
  const { t, getCategoryLabel } = useLanguage();
  const [activeTab, setActiveTab] = useState<'all' | 'decks' | 'cards'>('all');
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);

  // View Layout Mode: 'grid' (Card Grid) vs 'list' (Compact Table/List)
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');

  // Sorting Mode: 'updated' | 'created' | 'title'
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title'>('updated');

  // Tag Filter State
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);

  // Pin / Favorite States for Cards and Decks
  const [pinnedCardIds, setPinnedCardIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('worlddeck_pinned_cards');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [pinnedDeckIds, setPinnedDeckIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('worlddeck_pinned_decks');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Sync Pinned state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('worlddeck_pinned_cards', JSON.stringify(Array.from(pinnedCardIds)));
    } catch {}
  }, [pinnedCardIds]);

  useEffect(() => {
    try {
      localStorage.setItem('worlddeck_pinned_decks', JSON.stringify(Array.from(pinnedDeckIds)));
    } catch {}
  }, [pinnedDeckIds]);

  // FLIP animation refs for ultra-smooth layout & sorting transitions
  const cardDomRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());

  // Helper to record bounding rects before layout or sorting changes
  const recordCardRects = () => {
    cardDomRefs.current.forEach((el, id) => {
      if (el) prevRectsRef.current.set(id, el.getBoundingClientRect());
    });
  };

  // Toggle Pin Handlers
  const togglePinCard = (cardId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    recordCardRects();
    setPinnedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const togglePinDeck = (deckId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    recordCardRects();
    setPinnedDeckIds((prev) => {
      const next = new Set(prev);
      if (next.has(deckId)) next.delete(deckId);
      else next.add(deckId);
      return next;
    });
  };

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    targetCard: WorldCard | null;
    targetDeck: WorldDeck | null;
    isNearRight?: boolean;
    isNearBottom?: boolean;
  }>({
    visible: false,
    x: 0,
    y: 0,
    targetCard: null,
    targetDeck: null,
    isNearRight: false,
    isNearBottom: false,
  });
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Multi-Select State
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef<boolean>(false);

  // Close Context Menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    if (contextMenu.visible) {
      window.addEventListener('pointerdown', handleClickOutside);
    }
    return () => window.removeEventListener('pointerdown', handleClickOutside);
  }, [contextMenu.visible]);

  // Get active deck if user navigated inside a deck
  const activeDeck = decks.find((d) => d.id === activeDeckId) || null;

  // Filter cards based on search, category, and active deck navigation
  const cardsToDisplay = cards.filter((card) => {
    if (activeDeckId) {
      return card.deckId === activeDeckId || (activeDeck?.cardIds || []).includes(card.id);
    }
    if (activeTab === 'all') return !card.deckId;
    return true;
  });

  const filteredDecks = decks;
  const showDecksInGrid = !activeDeckId && (activeTab === 'all' || activeTab === 'decks');
  const showCardsInGrid = activeDeckId || activeTab === 'all' || activeTab === 'cards';

  // Extract all unique tags across all cards for the Tag Filter Bar
  const allUniqueTags = React.useMemo(() => {
    const set = new Set<string>();
    cards.forEach((c) => {
      if (c.tags) {
        c.tags.forEach((t) => set.add(t));
      }
    });
    return Array.from(set).sort();
  }, [cards]);

  // Filtered & Sorted Decks
  const sortedDecks = React.useMemo(() => {
    const list = [...filteredDecks];
    list.sort((a, b) => {
      const isAPinned = pinnedDeckIds.has(a.id);
      const isBPinned = pinnedDeckIds.has(b.id);
      if (isAPinned !== isBPinned) return isAPinned ? -1 : 1;

      if (sortBy === 'title') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'created') {
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    return list;
  }, [filteredDecks, pinnedDeckIds, sortBy]);

  // Filtered & Sorted Cards
  const sortedCards = React.useMemo(() => {
    let list = [...cardsToDisplay];

    if (selectedTagFilter) {
      list = list.filter((c) => c.tags && c.tags.includes(selectedTagFilter));
    }

    list.sort((a, b) => {
      const isAPinned = pinnedCardIds.has(a.id);
      const isBPinned = pinnedCardIds.has(b.id);
      if (isAPinned !== isBPinned) return isAPinned ? -1 : 1;

      if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      }
      if (sortBy === 'created') {
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

    return list;
  }, [cardsToDisplay, selectedTagFilter, pinnedCardIds, sortBy]);

  // Execute FLIP layout animation whenever sortedCards, viewLayout, or filters change
  useLayoutEffect(() => {
    const prevRects = prevRectsRef.current;
    if (prevRects.size === 0) return;

    cardDomRefs.current.forEach((el, id) => {
      if (!el) return;
      const oldRect = prevRects.get(id);
      const newRect = el.getBoundingClientRect();

      if (oldRect && (oldRect.left !== newRect.left || oldRect.top !== newRect.top)) {
        const dx = oldRect.left - newRect.left;
        const dy = oldRect.top - newRect.top;

        // Invert: snap instantly to previous position before browser paint
        el.style.transition = 'none';
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;

        // Force layout reflow
        void el.offsetHeight;

        // Play: animate smoothly to new grid location with fluid bezier curve
        requestAnimationFrame(() => {
          el.style.transition = 'transform 380ms cubic-bezier(0.16, 1, 0.3, 1)';
          el.style.transform = 'translate3d(0, 0, 0)';
        });
      }
    });

    prevRects.clear();
  }, [sortedCards, sortedDecks, viewLayout, sortBy, selectedTagFilter, selectedCategory, searchQuery]);

  // Handle Sort Change with FLIP transition
  const handleSortChange = (newSort: 'updated' | 'created' | 'title') => {
    recordCardRects();
    setSortBy(newSort);
  };

  // Handle Tag Filter Change with FLIP transition
  const handleTagFilterChange = (tag: string | null) => {
    recordCardRects();
    setSelectedTagFilter(tag);
  };

  // Handle View Layout Change with FLIP transition
  const handleViewLayoutChange = (mode: 'grid' | 'list') => {
    recordCardRects();
    setViewLayout(mode);
  };

  // Context Menu Open Handler
  const handleOpenContextMenu = (
    e: React.MouseEvent,
    targetCard: WorldCard | null,
    targetDeck: WorldDeck | null
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    setContextMenu({
      visible: true,
      x: mouseX,
      y: mouseY,
      targetCard,
      targetDeck,
      isNearRight: mouseX > windowWidth - 220,
      isNearBottom: mouseY > windowHeight - 280,
    });
  };

  // Long-press handler to activate selection mode
  const handleTouchMouseDown = (cardId: string) => {
    isLongPressRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setIsSelectionMode(true);
      setSelectedCardIds((prev) => {
        const next = new Set(prev);
        next.add(cardId);
        return next;
      });
    }, 400);
  };

  const handleTouchMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const totalItemsCount =
    (showDecksInGrid ? filteredDecks.length : 0) + (showCardsInGrid ? sortedCards.length : 0);

  // Render Card Grid Item
  const renderCardItem = (card: WorldCard) => {
    const cfg = CATEGORY_CONFIGS[card.category] || CATEGORY_CONFIGS.character;
    const IconComp = (Icons as any)[cfg.iconName] || Icons.HelpCircle || (() => null);
    const assignedDeck = decks.find((d) => d.id === card.deckId || (d.cardIds || []).includes(card.id));
    const isPinned = pinnedCardIds.has(card.id);

    const q = searchQuery.trim().toLowerCase();
    const matchesCategory = selectedCategory === 'all' || card.category === selectedCategory;
    const matchesSearch =
      !q ||
      card.title.toLowerCase().includes(q) ||
      (card.summary && card.summary.toLowerCase().includes(q)) ||
      (card.content && card.content.toLowerCase().includes(q)) ||
      (card.tags && card.tags.some((t) => t.toLowerCase().includes(q)));

    const isCardDimmed = !matchesCategory || !matchesSearch;
    const isCardHighlighted = (selectedCategory !== 'all' || !!q) && matchesCategory && matchesSearch;

    return (
      <div
        key={`card-${card.id}`}
        data-card-id={card.id}
        ref={(el) => {
          if (el) cardDomRefs.current.set(card.id, el);
          else cardDomRefs.current.delete(card.id);
        }}
        onMouseDown={() => handleTouchMouseDown(card.id)}
        onMouseUp={handleTouchMouseUp}
        onMouseLeave={handleTouchMouseUp}
        onTouchStart={() => handleTouchMouseDown(card.id)}
        onTouchEnd={handleTouchMouseUp}
        onContextMenu={(e) => handleOpenContextMenu(e, card, null)}
        onClick={(e) => {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }

          if (isLongPressRef.current) {
            isLongPressRef.current = false;
            return;
          }

          if (!isCardDimmed) {
            if (isSelectionMode || e.ctrlKey || e.metaKey) {
              setSelectedCardIds((prev) => {
                const next = new Set(prev);
                if (next.has(card.id)) next.delete(card.id);
                else next.add(card.id);
                return next;
              });
            } else {
              setSelectedCardIds(new Set());
              onCardClick(card);
            }
          }
        }}
        className={`card-grid-item app-bg-secondary border rounded-2xl overflow-hidden shadow-xs cursor-pointer group flex flex-col relative transition-all duration-200 animate-in fade-in zoom-in-95 ${
          isCardDimmed
            ? 'opacity-25 grayscale-[30%] pointer-events-none border-dashed app-border'
            : selectedCardIds.has(card.id)
            ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40 shadow-md bg-[var(--accent)]/10'
            : isCardHighlighted
            ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/50 shadow-md scale-[1.01]'
            : 'app-border hover:border-[var(--accent)]/60 hover:-translate-y-1 hover:shadow-lg'
        }`}
      >
        {/* Category Header Bar */}
        <div className="px-3 py-2 bg-[#1e1e1e] border-b border-[#383838] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePinCard(card.id, e);
              }}
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                isPinned ? 'text-amber-400 hover:text-amber-300' : 'text-slate-500 hover:text-slate-300'
              }`}
              title={isPinned ? t.library.unpinCard : t.library.pinCard}
            >
              <Icons.Pin size={13} className={isPinned ? 'fill-amber-400/30 rotate-45' : ''} />
            </button>
            <div className="p-1 rounded-md bg-[#2c2c2c] text-[#0d99ff] shrink-0">
              <IconComp size={13} />
            </div>
            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-300 truncate">
              {getCategoryLabel(card.category)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {assignedDeck && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 truncate max-w-[80px]">
                {assignedDeck.name}
              </span>
            )}

            <button
              type="button"
              onClick={(e) => handleOpenContextMenu(e, card, null)}
              className="p-1 rounded-md hover:bg-[#383838] text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <Icons.MoreVertical size={13} />
            </button>
          </div>
        </div>

        {/* Card Cover Image (if present) */}
        {(card.imageUrl || (card.images && card.images.length > 0)) && (
          <div className="relative h-28 w-full overflow-hidden bg-black/40 border-b border-[#383838]">
            <img
              src={card.imageUrl || card.images?.[0]}
              alt={card.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              style={{ objectPosition: `${card.imageFocalX ?? 50}% ${card.imageFocalY ?? 20}%` }}
            />
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
          <div className="space-y-1.5">
            <h3 className="font-extrabold text-sm app-text-main group-hover:text-[var(--accent)] transition-colors line-clamp-2 leading-snug">
              {card.title}
            </h3>

            {card.summary && (
              <p className="text-xs app-text-muted line-clamp-3 leading-relaxed">
                {card.summary}
              </p>
            )}
          </div>

          {/* Card Footer: Tags & Attribute Count */}
          <div className="pt-2 border-t border-slate-700/40 flex items-center justify-between text-[10px] app-text-muted">
            <div className="flex items-center gap-1 max-w-[70%] overflow-hidden">
              {card.tags && card.tags.length > 0 ? (
                card.tags.slice(0, 2).map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[9px] truncate"
                  >
                    #{tag}
                  </span>
                ))
              ) : (
                <span className="text-slate-600 italic">{t.library.noTags}</span>
              )}
              {card.tags && card.tags.length > 2 && (
                <span className="text-slate-500 font-bold">+{card.tags.length - 2}</span>
              )}
            </div>

            <div className="flex items-center gap-2 text-slate-500 shrink-0 font-mono text-[9.5px]">
              {card.attributes && card.attributes.length > 0 && (
                <span title={`${card.attributes.length} Atribut`}>
                  📋 {card.attributes.length}
                </span>
              )}
              {card.images && card.images.length > 0 && (
                <span title={`${card.images.length} Gambar`}>
                  🖼️ {card.images.length}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render Compact List View Item
  const renderCardListItem = (card: WorldCard) => {
    const cfg = CATEGORY_CONFIGS[card.category] || CATEGORY_CONFIGS.character;
    const IconComp = (Icons as any)[cfg.iconName] || Icons.HelpCircle || (() => null);
    const assignedDeck = decks.find((d) => d.id === card.deckId || (d.cardIds || []).includes(card.id));
    const isPinned = pinnedCardIds.has(card.id);
    const isSelected = selectedCardIds.has(card.id);

    return (
      <div
        key={`list-card-${card.id}`}
        data-card-id={card.id}
        ref={(el) => {
          if (el) cardDomRefs.current.set(card.id, el);
          else cardDomRefs.current.delete(card.id);
        }}
        onContextMenu={(e) => handleOpenContextMenu(e, card, null)}
        onClick={(e) => {
          if (isSelectionMode || e.ctrlKey || e.metaKey) {
            setSelectedCardIds((prev) => {
              const next = new Set(prev);
              if (next.has(card.id)) next.delete(card.id);
              else next.add(card.id);
              return next;
            });
          } else {
            setSelectedCardIds(new Set());
            onCardClick(card);
          }
        }}
        className={`px-3 py-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all duration-150 group animate-in fade-in ${
          isSelected
            ? 'border-[var(--accent)] bg-[var(--accent)]/15 shadow-sm'
            : 'app-bg-secondary border-slate-800 hover:border-[var(--accent)]/50 hover:bg-[#252525]'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={(e) => togglePinCard(card.id, e)}
            className={`p-1 rounded-md transition-colors ${
              isPinned ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            <Icons.Pin size={14} className={isPinned ? 'fill-amber-400/30 rotate-45' : ''} />
          </button>

          <div className="p-1.5 rounded-lg bg-[#2c2c2c] text-[#0d99ff] shrink-0">
            <IconComp size={14} />
          </div>

          <div className="min-w-0">
            <h4 className="font-extrabold text-xs app-text-main group-hover:text-[var(--accent)] transition-colors truncate">
              {card.title}
            </h4>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
              <span className="uppercase text-[9px] font-bold text-slate-300">
                {getCategoryLabel(card.category)}
              </span>
              {assignedDeck && (
                <>
                  <span>•</span>
                  <span className="text-purple-300 font-semibold">{assignedDeck.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-xs text-slate-400">
          {card.tags && card.tags.length > 0 && (
            <div className="hidden md:flex items-center gap-1">
              {card.tags.slice(0, 2).map((tag, idx) => (
                <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[9px] font-mono">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={(e) => handleOpenContextMenu(e, card, null)}
            className="p-1 rounded-md hover:bg-[#383838] text-slate-400 hover:text-white transition-colors"
          >
            <Icons.MoreVertical size={14} />
          </button>
        </div>
      </div>
    );
  };

  // Render Deck Stack Card Item
  const renderDeckItem = (deck: WorldDeck) => {
    const deckCards = cards.filter(
      (c) => c.deckId === deck.id || (deck.cardIds || []).includes(c.id)
    );
    const deckColor = (!deck.color || deck.color === '#3b82f6') ? 'var(--accent)' : deck.color;
    const isPinned = pinnedDeckIds.has(deck.id);

    return (
      <div
        key={`deck-${deck.id}`}
        onContextMenu={(e) => handleOpenContextMenu(e, null, deck)}
        onClick={() => {
          setActiveDeckId(deck.id);
          setActiveTab('cards');
        }}
        className="card-grid-item app-bg-secondary border app-border hover:border-[var(--accent)]/80 rounded-2xl p-4 cursor-pointer group flex flex-col justify-between relative transition-all duration-200 hover:-translate-y-1 hover:shadow-xl animate-in fade-in zoom-in-95"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={(e) => togglePinDeck(deck.id, e)}
              className={`p-1 rounded-md transition-colors ${
                isPinned ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              <Icons.Pin size={14} className={isPinned ? 'fill-amber-400/30 rotate-45' : ''} />
            </button>
            <div
              className="p-2 rounded-xl text-white font-bold shadow-xs shrink-0"
              style={{ backgroundColor: deckColor }}
            >
              <Icons.Folder size={18} />
            </div>
            <h3 className="font-extrabold text-sm app-text-main group-hover:text-[var(--accent)] transition-colors truncate">
              {deck.name}
            </h3>
          </div>

          <button
            type="button"
            onClick={(e) => handleOpenContextMenu(e, null, deck)}
            className="p-1 rounded-md hover:bg-[#383838] text-slate-400 hover:text-white transition-colors"
          >
            <Icons.MoreVertical size={14} />
          </button>
        </div>

        <p className="text-xs app-text-muted line-clamp-2 leading-relaxed mb-4">
          {deck.description || t.library.emptyDeck}
        </p>

        {/* Deck Card Stack Preview */}
        {deckCards.length > 0 ? (
          <div className="pt-2 border-t border-slate-700/40 flex items-center justify-between text-xs app-text-muted">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Icons.Layers size={14} className="text-purple-400" />
              <span>{deckCards.length} {t.library.cards}</span>
            </span>

            <span className="text-[10px] text-slate-500 font-mono">
              {t.library.openDeck} →
            </span>
          </div>
        ) : (
          <div className="pt-2 border-t border-slate-700/40 text-[10px] text-slate-500 italic">
            {t.library.emptyDeck}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden app-bg-main app-text-main relative select-none">
      {/* Top Header Bar */}
      <div className="p-4 border-b border-[#383838] bg-[#1a1a1a] flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        {/* Navigation Breadcrumbs / Tabs */}
        <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
          {activeDeckId ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveDeckId(null);
                  setActiveTab('all');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-[#252525] hover:bg-[#333333] border border-[#383838] text-xs font-semibold app-text-main flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Icons.ArrowLeft size={14} />
                <span>{t.library.backToLibrary}</span>
              </button>

              <span className="text-slate-600 font-bold">/</span>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-extrabold">
                <Icons.Folder size={14} />
                <span>{activeDeck?.name}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-[#121212] border border-[#2a2a2a]">
              <button
                type="button"
                onClick={() => {
                  recordCardRects();
                  setActiveTab('all');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-[#0d99ff] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.library.allTab}
              </button>

              <button
                type="button"
                onClick={() => {
                  recordCardRects();
                  setActiveTab('decks');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'decks'
                    ? 'bg-[#0d99ff] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icons.Folder size={13} />
                <span>{t.library.decksTab} ({filteredDecks.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  recordCardRects();
                  setActiveTab('cards');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'cards'
                    ? 'bg-[#0d99ff] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icons.CreditCard size={13} />
                <span>{t.library.cardsTab} ({cardsToDisplay.length})</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Toolbar Controls */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          {/* View Mode Toggle: Grid vs List */}
          <div className="flex items-center p-1 rounded-xl bg-[#121212] border border-[#2a2a2a]">
            <button
              type="button"
              onClick={() => handleViewLayoutChange('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewLayout === 'grid'
                  ? 'bg-[#2c2c2c] text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title={t.library.cardGrid}
            >
              <Icons.LayoutGrid size={15} />
            </button>

            <button
              type="button"
              onClick={() => handleViewLayoutChange('list')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewLayout === 'list'
                  ? 'bg-[#2c2c2c] text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title={t.library.compactTable}
            >
              <Icons.List size={15} />
            </button>
          </div>

          {/* Sort By Select */}
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-xl bg-[#1e1e1e] border border-[#383838] text-slate-200 text-xs font-semibold cursor-pointer outline-none hover:border-[var(--accent)] transition-colors"
          >
            <option value="updated">{t.library.lastUpdated}</option>
            <option value="created">{t.library.dateCreated}</option>
            <option value="title">{t.library.titleAZ}</option>
          </select>

          {/* Quick Create Action Buttons */}
          <button
            type="button"
            onClick={onCreateDeckRequest}
            className="px-3 py-1.5 rounded-xl bg-[#1e1e1e] hover:bg-[#383838] border border-[#383838] text-purple-400 hover:text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Icons.FolderPlus size={14} />
            <span className="hidden sm:inline">{t.library.newDeck}</span>
          </button>

          <button
            type="button"
            onClick={() => onAddCard(activeDeckId || undefined)}
            className="px-3.5 py-1.5 rounded-xl bg-[#0d99ff] hover:bg-[#0b85de] text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <Icons.Plus size={15} />
            <span>{t.library.newCard}</span>
          </button>
        </div>
      </div>

      {/* Tag Filters Bar (if tags exist) */}
      {allUniqueTags.length > 0 && (
        <div className="px-4 py-2 border-b border-[#2d2d2d] bg-[#151515] flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Icons.Tag size={12} />
            <span>Tags:</span>
          </span>

          <button
            type="button"
            onClick={() => handleTagFilterChange(null)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              selectedTagFilter === null
                ? 'bg-[#0d99ff] text-white'
                : 'bg-[#222222] text-slate-400 hover:text-white border border-[#333333]'
            }`}
          >
            {t.library.allTab}
          </button>

          {allUniqueTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleTagFilterChange(selectedTagFilter === tag ? null : tag)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                selectedTagFilter === tag
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-[#222222] text-slate-300 hover:text-white border border-[#333333]'
              }`}
            >
              <span>#{tag}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Grid / List Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {totalItemsCount === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#1e1e1e] border border-[#383838] flex items-center justify-center text-slate-500 shadow-inner">
              <Icons.SearchX size={32} />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-base font-extrabold text-slate-200">{t.library.noCardsFound}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {t.library.noCardsMatchFilter}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onAddCard(activeDeckId || undefined)}
              className="px-4 py-2 rounded-xl bg-[#0d99ff] hover:bg-[#0b85de] text-white text-xs font-bold transition-all shadow-md active:scale-95"
            >
              + {t.library.newCard}
            </button>
          </div>
        ) : viewLayout === 'list' ? (
          <div className="space-y-2 max-w-5xl mx-auto">
            {showDecksInGrid && sortedDecks.map((deck) => (
              <div
                key={`deck-list-${deck.id}`}
                onClick={() => {
                  setActiveDeckId(deck.id);
                  setActiveTab('cards');
                }}
                className="px-3.5 py-2.5 rounded-xl bg-[#1e1e1e] border border-purple-500/30 hover:border-purple-500/70 flex items-center justify-between gap-3 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                    <Icons.Folder size={16} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-purple-300">{deck.name}</h4>
                    <p className="text-[10px] text-slate-400">{deck.description || t.library.emptyDeck}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-500 font-mono">Deck →</span>
              </div>
            ))}

            {showCardsInGrid && sortedCards.map(renderCardListItem)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {showDecksInGrid && sortedDecks.map(renderDeckItem)}
            {showCardsInGrid && sortedCards.map((card) => renderCardItem(card))}
          </div>
        )}
      </div>

      {/* Context Menu Modal */}
      {contextMenu.visible && (
        <div
          ref={contextMenuRef}
          style={{
            top: contextMenu.isNearBottom ? `${contextMenu.y - 220}px` : `${contextMenu.y}px`,
            left: contextMenu.isNearRight ? `${contextMenu.x - 200}px` : `${contextMenu.x}px`,
          }}
          className="fixed z-50 w-52 bg-[#252525] border border-[#3d3d3d] rounded-2xl shadow-2xl py-1.5 text-xs text-slate-200 divide-y divide-[#383838] animate-in fade-in zoom-in-95 duration-100"
        >
          {contextMenu.targetCard && (
            <>
              <div className="px-3 py-1.5 font-extrabold text-[10px] text-slate-400 uppercase tracking-wider truncate">
                📌 {contextMenu.targetCard.title}
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    onEditCardRequest(contextMenu.targetCard!);
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[#383838] flex items-center gap-2 transition-colors font-semibold text-slate-200 cursor-pointer"
                >
                  <Icons.Edit3 size={14} className="text-[#0d99ff]" />
                  <span>{t.library.editCard}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onOpenCardFullPage(contextMenu.targetCard!);
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[#383838] flex items-center gap-2 transition-colors font-semibold text-slate-200 cursor-pointer"
                >
                  <Icons.Maximize2 size={14} className="text-purple-400" />
                  <span>{t.library.openFullPage}</span>
                </button>

                {(contextMenu.targetCard.imageUrl || (contextMenu.targetCard.images && contextMenu.targetCard.images.length > 0)) && (
                  <button
                    type="button"
                    onClick={() => {
                      onAdjustImageFocalPointRequest?.(contextMenu.targetCard!);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[#383838] flex items-center gap-2 transition-colors font-semibold text-[#0d99ff] cursor-pointer"
                  >
                    <Icons.Focus size={14} />
                    <span>{t.library.adjustImageFocus}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    togglePinCard(contextMenu.targetCard!.id);
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[#383838] flex items-center gap-2 transition-colors font-medium text-slate-200 cursor-pointer"
                >
                  <Icons.Pin size={14} className="text-amber-400" />
                  <span>
                    {pinnedCardIds.has(contextMenu.targetCard.id)
                      ? t.library.unpinCard
                      : t.library.pinCard}
                  </span>
                </button>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    onDeleteCardsRequest([contextMenu.targetCard!.id]);
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[#383838] flex items-center gap-2 transition-colors text-rose-400 font-semibold cursor-pointer"
                >
                  <Icons.Trash2 size={14} />
                  <span>{t.library.deleteCard}</span>
                </button>
              </div>
            </>
          )}

          {contextMenu.targetDeck && (
            <>
              <div className="px-3 py-1.5 font-extrabold text-[10px] text-purple-400 uppercase tracking-wider truncate">
                📁 {contextMenu.targetDeck.name}
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    onEditDeckRequest(contextMenu.targetDeck!);
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[#383838] flex items-center gap-2 transition-colors font-semibold text-slate-200 cursor-pointer"
                >
                  <Icons.Edit3 size={14} className="text-purple-400" />
                  <span>{t.library.editDeck}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    togglePinDeck(contextMenu.targetDeck!.id);
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[#383838] flex items-center gap-2 transition-colors font-medium text-slate-200 cursor-pointer"
                >
                  <Icons.Pin size={14} className="text-amber-400" />
                  <span>
                    {pinnedDeckIds.has(contextMenu.targetDeck.id)
                      ? t.library.unpinCard
                      : t.library.pinCard}
                  </span>
                </button>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    onDeleteDeckRequest(contextMenu.targetDeck!.id);
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[#383838] flex items-center gap-2 transition-colors text-rose-400 font-semibold cursor-pointer"
                >
                  <Icons.Trash2 size={14} />
                  <span>{t.library.deleteDeck}</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
