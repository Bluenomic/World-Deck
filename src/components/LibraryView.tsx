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
  onReorderCards: (orderedCardIds: string[]) => void;
  onEditCardRequest: (card: WorldCard) => void;
  onOpenCardFullPage: (card: WorldCard) => void;
  onDeleteCardsRequest: (cardIds: string[]) => void;
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
  onReorderCards,
  onEditCardRequest,
  onOpenCardFullPage,
  onDeleteCardsRequest,
}) => {
  const { language, t, getCategoryLabel } = useLanguage();
  const [activeTab, setActiveTab] = useState<'all' | 'decks' | 'cards'>('all');
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);

  // View Layout Mode: 'grid' (Card Grid) vs 'list' (Compact Table/List)
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');

  // Sorting Mode: 'custom' (Manual Drag Order) | 'updated' | 'created' | 'title'
  const [sortBy, setSortBy] = useState<'custom' | 'updated' | 'created' | 'title'>('custom');

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

  // Toggle Pin Handlers
  const togglePinCard = (cardId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPinnedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const togglePinDeck = (deckId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
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

  // Drag and Drop States for Decks
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [hoveredDeckId, setHoveredDeckId] = useState<string | null>(null);
  const [successDeckId, setSuccessDeckId] = useState<string | null>(null);
  
  // Drag and Drop States for Removing card from Deck
  const [isNearTop, setIsNearTop] = useState<boolean>(false);
  const [isHoveredRemoveZone, setIsHoveredRemoveZone] = useState<boolean>(false);
  const [isSuccessRemove, setIsSuccessRemove] = useState<boolean>(false);

  // Dynamic Floating Drag Position & Release Animation States
  const [justDroppedCardId, setJustDroppedCardId] = useState<string | null>(null);
  const [draggedCardData, setDraggedCardData] = useState<WorldCard | null>(null);
  const [droppingCardId, setDroppingCardId] = useState<string | null>(null);
  const isDroppingRef = useRef<boolean>(false);

  // Live Shifting Order for Drag Reordering
  const [liveOrder, setLiveOrder] = useState<string[] | null>(null);
  const liveOrderRef = useRef<string[] | null>(null);

  const draggedCardIdRef = useRef<string | null>(null);
  const transparentImgRef = useRef<HTMLCanvasElement | null>(null);
  const floatingPreviewRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rafIdRef = useRef<number | null>(null);

  // FLIP animation refs for ultra-smooth grid shifting
  const cardDomRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const lastSwapTimeRef = useRef<number>(0);

  // Execute FLIP layout animation whenever liveOrder shifts
  useLayoutEffect(() => {
    if (!liveOrder) {
      prevRectsRef.current.clear();
      cardDomRefs.current.forEach((el) => {
        if (el) {
          el.style.transition = '';
          el.style.transform = '';
        }
      });
      return;
    }

    const prevRects = prevRectsRef.current;

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

        // Play: animate smoothly to new grid location with luxury cubic-bezier curve
        requestAnimationFrame(() => {
          el.style.transition = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
          el.style.transform = 'translate3d(0, 0, 0)';
        });
      }

      prevRects.set(id, newRect);
    });
  }, [liveOrder]);

  const updateLiveOrderWithFLIP = (nextOrder: string[]) => {
    cardDomRefs.current.forEach((el, id) => {
      if (el) {
        prevRectsRef.current.set(id, el.getBoundingClientRect());
      }
    });
    liveOrderRef.current = nextOrder;
    setLiveOrder(nextOrder);
  };

  // Create a transparent 1x1 image for hiding native drag preview
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    canvas.style.position = 'absolute';
    canvas.style.top = '-9999px';
    canvas.style.left = '-9999px';
    document.body.appendChild(canvas);
    transparentImgRef.current = canvas;
    return () => {
      if (document.body.contains(canvas)) {
        document.body.removeChild(canvas);
      }
    };
  }, []);

  const cleanupDragState = () => {
    setDraggedCardId(null);
    setDraggedCardData(null);
    setDroppingCardId(null);
    setLiveOrder(null);
    liveOrderRef.current = null;
    setHoveredDeckId(null);
    setIsHoveredRemoveZone(false);
    setIsNearTop(false);
    draggedCardIdRef.current = null;
    isDroppingRef.current = false;
  };

  const finishCardDrop = (targetOptions?: {
    targetRect?: DOMRect | null;
    shrinkToPoint?: { x: number; y: number };
  }) => {
    if (isDroppingRef.current) return;

    const currentCardId = draggedCardIdRef.current || draggedCardId;
    const currentLiveOrder = liveOrderRef.current;

    if (!currentCardId) {
      cleanupDragState();
      return;
    }

    isDroppingRef.current = true;
    setDroppingCardId(currentCardId);

    const previewEl = floatingPreviewRef.current;
    if (!previewEl) {
      if (currentLiveOrder) onReorderCards(currentLiveOrder);
      cleanupDragState();
      return;
    }

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    const innerEl = previewEl.querySelector('.card-floating-inner') as HTMLElement | null;

    // 1. Instantly lock previewEl to current mouse release position & force layout reflow
    const currentX = dragPosRef.current.x - dragOffsetRef.current.x;
    const currentY = dragPosRef.current.y - dragOffsetRef.current.y;
    previewEl.style.transition = 'none';
    previewEl.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    void previewEl.offsetHeight; // Force instant DOM reflow (eliminates 100ms pause)

    const dropDuration = 250; // ms — fast, responsive, zero-delay!

    if (targetOptions?.shrinkToPoint) {
      const { x, y } = targetOptions.shrinkToPoint;
      previewEl.style.transition = `transform ${dropDuration}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${dropDuration}ms ease`;
      previewEl.style.transform = `translate3d(${x}px, ${y}px, 0) scale(0.15)`;
      previewEl.style.opacity = '0';
    } else {
      let targetRect = targetOptions?.targetRect;
      if (!targetRect && currentCardId) {
        const gridEl = cardDomRefs.current.get(currentCardId);
        if (gridEl) {
          targetRect = gridEl.getBoundingClientRect();
        }
      }

      if (targetRect) {
        const targetX = targetRect.left;
        const targetY = targetRect.top;
        const targetWidth = targetRect.width;

        // 2. Start smooth drop glide instantly without delay
        previewEl.style.transition = `transform ${dropDuration}ms cubic-bezier(0.16, 1, 0.3, 1), width ${dropDuration}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${dropDuration}ms ease`;
        previewEl.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
        previewEl.style.width = `${targetWidth}px`;

        if (innerEl) {
          innerEl.style.transition = `transform ${dropDuration}ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow ${dropDuration}ms ease`;
          innerEl.style.transform = 'scale(1) rotate(0deg)';
          innerEl.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
        }
      } else {
        previewEl.style.transition = 'opacity 0.2s ease';
        previewEl.style.opacity = '0';
      }
    }

    setTimeout(() => {
      if (currentLiveOrder) {
        setSortBy('custom');
        onReorderCards(currentLiveOrder);
      }
      setJustDroppedCardId(currentCardId);
      setTimeout(() => setJustDroppedCardId(null), 300);

      cleanupDragState();
    }, dropDuration);
  };

  // Track global cursor position during HTML5 drag — direct DOM for zero-lag
  useEffect(() => {
    if (!draggedCardId) return;

    const updatePreviewPos = () => {
      if (isDroppingRef.current) return;
      const el = floatingPreviewRef.current;
      if (el) {
        const x = dragPosRef.current.x - dragOffsetRef.current.x;
        const y = dragPosRef.current.y - dragOffsetRef.current.y;
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
      rafIdRef.current = null;
    };

    const handleGlobalDragOver = (e: DragEvent) => {
      if (isDroppingRef.current) return;
      e.preventDefault();
      if (e.clientX !== 0 || e.clientY !== 0) {
        dragPosRef.current.x = e.clientX;
        dragPosRef.current.y = e.clientY;
        if (rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(updatePreviewPos);
        }
      }
    };

    const handleGlobalDragEnd = () => {
      if (!isDroppingRef.current && (draggedCardIdRef.current || draggedCardId)) {
        finishCardDrop();
      }
    };

    window.addEventListener('dragover', handleGlobalDragOver);
    window.addEventListener('dragend', handleGlobalDragEnd);
    window.addEventListener('mouseup', handleGlobalDragEnd);
    window.addEventListener('pointerup', handleGlobalDragEnd);
    return () => {
      window.removeEventListener('dragover', handleGlobalDragOver);
      window.removeEventListener('dragend', handleGlobalDragEnd);
      window.removeEventListener('mouseup', handleGlobalDragEnd);
      window.removeEventListener('pointerup', handleGlobalDragEnd);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [draggedCardId, onReorderCards]);

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

  // Derived display cards order when live dragging is active
  const displayCards = (() => {
    if (!liveOrder) return cardsToDisplay;
    const cardMap = new Map(cardsToDisplay.map((c) => [c.id, c]));
    const result: WorldCard[] = [];
    for (const id of liveOrder) {
      const card = cardMap.get(id);
      if (card) {
        result.push(card);
        cardMap.delete(id);
      }
    }
    cardMap.forEach((card) => result.push(card));
    return result;
  })();

  const totalItemsCount =
    (showDecksInGrid ? filteredDecks.length : 0) + (showCardsInGrid ? displayCards.length : 0);

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
    // When dragging live to reorder OR when in manual drag order, preserve displayCards order!
    if (liveOrder || sortBy === 'custom') {
      let list = [...displayCards];
      if (selectedTagFilter) {
        list = list.filter((c) => c.tags && c.tags.includes(selectedTagFilter));
      }
      return list;
    }

    let list = [...displayCards];

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
  }, [displayCards, liveOrder, selectedTagFilter, pinnedCardIds, sortBy]);

  // Determine if remove zone should be visible (only inside deck + dragging + near top/hovered/success)
  const shouldShowRemoveZone =
    activeDeck && (isSuccessRemove || (draggedCardId && (isNearTop || isHoveredRemoveZone)));

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

  // Container drag over to detect cursor approaching top area inside a deck
  const handleContainerDragOver = (e: React.DragEvent) => {
    if (activeDeck && (draggedCardId || draggedCardIdRef.current)) {
      const containerTop = e.currentTarget.getBoundingClientRect().top;
      const relativeY = e.clientY - containerTop;
      if (relativeY < 360) {
        if (!isNearTop) setIsNearTop(true);
      } else {
        if (isNearTop) setIsNearTop(false);
      }
    }
  };

  // Handle Drag & Drop handlers into Deck
  const handleDragOver = (e: React.DragEvent, deckId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (hoveredDeckId !== deckId) {
      setHoveredDeckId(deckId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, deckId: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX <= rect.left ||
      e.clientX >= rect.right ||
      e.clientY <= rect.top ||
      e.clientY >= rect.bottom
    ) {
      if (hoveredDeckId === deckId) {
        setHoveredDeckId(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent, deckId: string) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('text/plain') || draggedCardIdRef.current || draggedCardId;

    const cardsToAssign =
      selectedCardIds.size > 0
        ? Array.from(new Set(cardId ? [...Array.from(selectedCardIds), cardId] : Array.from(selectedCardIds)))
        : cardId
        ? [cardId]
        : [];

    if (cardsToAssign.length > 0) {
      cardsToAssign.forEach((id) => onAssignCardToDeck(id, deckId));
      setSelectedCardIds(new Set());
      setIsSelectionMode(false);
      setSuccessDeckId(deckId);

      setTimeout(() => setSuccessDeckId(null), 1200);

      const deckEl = e.currentTarget as HTMLElement;
      const rect = deckEl.getBoundingClientRect();
      finishCardDrop({
        shrinkToPoint: {
          x: rect.left + rect.width / 2 - 130,
          y: rect.top + rect.height / 2 - 80,
        },
      });
    } else {
      finishCardDrop();
    }
  };

  // Handle Drag & Drop handlers to REMOVE card from Deck back to Galeri
  const handleRemoveFromDeckDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isHoveredRemoveZone) {
      setIsHoveredRemoveZone(true);
    }
  };

  const handleRemoveFromDeckDragLeave = (e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX <= rect.left ||
      e.clientX >= rect.right ||
      e.clientY <= rect.top ||
      e.clientY >= rect.bottom
    ) {
      setIsHoveredRemoveZone(false);
    }
  };

  const handleRemoveFromDeckDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('text/plain') || draggedCardIdRef.current || draggedCardId;

    // Collect cards to remove: if multi-selected, remove all selected cards. Otherwise remove dragged card.
    const cardsToRemove =
      selectedCardIds.size > 0 && cardId && selectedCardIds.has(cardId)
        ? Array.from(selectedCardIds)
        : selectedCardIds.size > 0
        ? Array.from(selectedCardIds)
        : cardId
        ? [cardId]
        : [];

    if (cardsToRemove.length > 0) {
      cardsToRemove.forEach((id) => onAssignCardToDeck(id, undefined));
      setSelectedCardIds(new Set());
      setIsSelectionMode(false);
      setIsSuccessRemove(true);

      setTimeout(() => setIsSuccessRemove(false), 1200);

      const removeEl = e.currentTarget as HTMLElement;
      const rect = removeEl.getBoundingClientRect();
      finishCardDrop({
        shrinkToPoint: {
          x: rect.left + rect.width / 2 - 130,
          y: rect.top + 10,
        },
      });
    } else {
      finishCardDrop();
    }
  };

  const renderDeckItem = (deck: WorldDeck) => {
    const deckCards = cards.filter(
      (c) => c.deckId === deck.id || (deck.cardIds || []).includes(c.id)
    );
    const deckColor = (!deck.color || deck.color === '#3b82f6') ? 'var(--accent)' : deck.color;
    const isHovered = hoveredDeckId === deck.id;
    const isSuccess = successDeckId === deck.id;

    return (
      <div
        key={`deck-${deck.id}`}
        data-deck-id={deck.id}
        onClick={() => setActiveDeckId(deck.id)}
        onDragOver={(e) => handleDragOver(e, deck.id)}
        onDragLeave={(e) => handleDragLeave(e, deck.id)}
        onDrop={(e) => handleDrop(e, deck.id)}
        style={{
          boxShadow: `inset 0 3px 0 0 ${isHovered ? 'var(--accent)' : deckColor}`,
        }}
        className={`deck-grid-item group relative flex flex-col space-y-2 p-3.5 pt-4 cursor-pointer transition-all duration-300 rounded-2xl select-none bg-[#2c2c2c] border border-[#383838] hover:border-[#0d99ff] ${
          isSuccess
            ? 'scale-105 border-emerald-400 ring-4 ring-emerald-500/40'
            : isHovered
            ? '-translate-y-1 scale-105 border-[var(--accent)] shadow-xl'
            : ''
        }`}
      >
        {/* Pin Badge Button */}
        <button
          type="button"
          onClick={(e) => togglePinDeck(deck.id, e)}
          className={`absolute top-3 right-3 z-20 p-1.5 rounded-lg transition-all cursor-pointer ${
            pinnedDeckIds.has(deck.id)
              ? 'text-amber-400 bg-amber-400/10 opacity-100'
              : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:text-amber-400'
          }`}
          title={pinnedDeckIds.has(deck.id) ? t.library.unpin : t.library.pin}
        >
          <Icons.Pin size={13} className={pinnedDeckIds.has(deck.id) ? 'fill-amber-400' : ''} />
        </button>

        {/* Drop Zone Overlay Hint */}
        {isHovered && (
          <div className="absolute inset-0 bg-blue-950/85 backdrop-blur-xs z-30 rounded-2xl flex flex-col items-center justify-center p-3 text-center space-y-1.5 animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
            <Icons.Layers size={32} className="text-blue-300 animate-bounce" />
            <span className="text-xs font-bold text-white drop-shadow">
              {t.library.dropCardHere}
            </span>
          </div>
        )}

        {/* Success Overlay Hint */}
        {isSuccess && (
          <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-xs z-30 rounded-2xl flex flex-col items-center justify-center p-3 text-center space-y-1 animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
            <Icons.CheckCircle2 size={32} className="text-emerald-400 animate-bounce" />
            <span className="text-xs font-bold text-emerald-300 drop-shadow">
              {t.library.cardAddedSuccess}
            </span>
          </div>
        )}

        {/* Deck Title Header right below top bent bracket line */}
        <div className="pt-1 px-0.5">
          <h4 className="text-xs font-bold app-text-main group-hover:text-blue-400 transition-colors truncate text-center">
            {deck.name}
          </h4>
        </div>

        {/* Poker Hand / Fan Spread Cards Thumbnail or Empty Deck Card Stack Silhouette */}
        {deckCards.length > 0 ? (
          <div className="h-44 w-full my-1 relative flex items-center justify-center overflow-hidden py-1">
            <div className="flex items-center justify-center relative h-full w-full">
              {deckCards.slice(0, 4).map((c, idx) => {
                const total = Math.min(deckCards.length, 4);
                // Calculate rotation tilt angle for fanning out cards like a poker hand
                const angle = total === 1 ? 0 : -12 + (idx / (total - 1)) * 24;
                // Calculate horizontal offset
                const xOffset = total === 1 ? 0 : (idx - (total - 1) / 2) * 28;
                const yOffset = Math.abs(angle) * 0.4;
                const zIdx = idx + 1;
                const cfg = CATEGORY_CONFIGS[c.category] || CATEGORY_CONFIGS.character;

                return (
                  <div
                    key={c.id || idx}
                    style={{
                      transform: `translate3d(${xOffset}px, ${yOffset}px, 0) rotate(${angle}deg)`,
                      zIndex: zIdx,
                    }}
                    className="absolute w-28 h-36 rounded-xl app-bg-main border border-slate-700/80 shadow-lg flex flex-col justify-between overflow-hidden transition-transform duration-200 group-hover:scale-105"
                  >
                    {/* Card Top Category Pill Bar */}
                    <div className="px-2 py-1 app-bg-secondary border-b app-border flex items-center gap-1.5">
                      {(() => {
                        const IconComp = (Icons as any)[cfg.iconName] || Icons.HelpCircle;
                        return <IconComp size={10} style={{ color: cfg.color || '#3b82f6' }} />;
                      })()}
                      <span className="text-[9px] font-bold app-text-main truncate">
                        {c.title || t.common.untitled}
                      </span>
                    </div>

                    {/* Card Cover Image or Mini Text Summary */}
                    {c.imageUrl ? (
                      <div className="flex-1 w-full overflow-hidden relative">
                        <img
                          src={c.imageUrl}
                          alt={c.title}
                          className="w-full h-full object-cover opacity-90 pointer-events-none select-none"
                          draggable={false}
                        />
                      </div>
                    ) : (
                      <div className="p-1.5 flex-1 flex flex-col justify-between app-bg-main">
                        <p className="text-[8.5px] app-text-muted line-clamp-4 leading-tight">
                          {c.summary || t.cardReader.noSummary}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Empty Deck Card Stack Silhouette */
          <div className="h-44 w-full my-1 relative flex items-center justify-center overflow-hidden py-1">
            <div className="flex items-center justify-center relative h-full w-full">
              {/* Card Silhouette 1 (Back Layer) */}
              <div className="absolute w-28 h-36 rounded-xl border border-dashed border-slate-700/30 app-bg-main/20 transform -rotate-12 -translate-x-4 translate-y-1.5" />
              
              {/* Card Silhouette 2 (Middle Layer) */}
              <div className="absolute w-28 h-36 rounded-xl border border-dashed border-slate-700/40 app-bg-main/30 transform rotate-6 translate-x-4 -translate-y-1" />
              
              {/* Card Silhouette 3 (Front Layer) */}
              <div className="absolute w-28 h-36 rounded-xl border-2 border-dashed border-slate-600/50 app-bg-main/60 flex flex-col items-center justify-center p-3 text-center text-slate-500 shadow-xs z-10 transition-transform group-hover:scale-105">
                <Icons.Layers size={22} className="opacity-40 mb-1.5 app-accent-text" />
                <span className="text-[10px] font-semibold app-text-muted">{t.library.emptyDeck}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleCardDrop = (e: React.DragEvent) => {
    e.preventDefault();
    finishCardDrop();
  };

  const renderCardItem = (card: WorldCard) => {
    const cfg = CATEGORY_CONFIGS[card.category] || CATEGORY_CONFIGS.character;
    const IconComp = (Icons as any)[cfg.iconName] || Icons.HelpCircle || (() => null);
    const assignedDeck = decks.find((d) => d.id === card.deckId || (d.cardIds || []).includes(card.id));
    const isBeingDragged = draggedCardId === card.id;
    const isDroppingThisCard = droppingCardId === card.id;

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
        ref={(el) => {
          if (el) cardDomRefs.current.set(card.id, el);
          else cardDomRefs.current.delete(card.id);
        }}
        draggable={true}
        onMouseDown={() => handleTouchMouseDown(card.id)}
        onMouseUp={handleTouchMouseUp}
        onMouseLeave={handleTouchMouseUp}
        onTouchStart={() => handleTouchMouseDown(card.id)}
        onTouchEnd={handleTouchMouseUp}
        onDragStart={(e) => {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
          isLongPressRef.current = false;
          if (isDroppingRef.current) return;
          e.dataTransfer.setData('text/plain', card.id);
          e.dataTransfer.effectAllowed = 'move';
          draggedCardIdRef.current = card.id;

          // Store card data for floating preview
          setDraggedCardData(card);

          // Store offset in ref for instant access
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          dragOffsetRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          };
          dragPosRef.current = { x: e.clientX, y: e.clientY };

          // Hide native drag ghost
          if (transparentImgRef.current && e.dataTransfer.setDragImage) {
            e.dataTransfer.setDragImage(transparentImgRef.current, 0, 0);
          }

          // Capture initial rects before setting live order
          cardDomRefs.current.forEach((el, id) => {
            if (el) prevRectsRef.current.set(id, el.getBoundingClientRect());
          });

          // Initialize live shifting order
          const initOrder = cardsToDisplay.map((c) => c.id);
          liveOrderRef.current = initOrder;
          setLiveOrder(initOrder);
          setDraggedCardId(card.id);
          setDroppingCardId(null);
        }}
        onDragOver={(e) => {
          e.preventDefault(); // allow drop
          if (isDroppingRef.current || !draggedCardId || draggedCardId === card.id || !liveOrder) return;

          const now = Date.now();
          if (now - lastSwapTimeRef.current < 160) return;

          const fromIdx = liveOrder.indexOf(draggedCardId);
          const toIdx = liveOrder.indexOf(card.id);

          if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
            const rect = e.currentTarget.getBoundingClientRect();
            const cursorX = e.clientX;
            const cursorY = e.clientY;
            const midX = rect.left + rect.width / 2;
            const midY = rect.top + rect.height / 2;

            const isForward = fromIdx < toIdx;
            const crossedMidpoint = isForward
              ? cursorX > midX || cursorY > midY + 15
              : cursorX < midX || cursorY < midY - 15;

            if (crossedMidpoint) {
              lastSwapTimeRef.current = now;
              const nextOrder = [...liveOrder];
              nextOrder.splice(fromIdx, 1);
              nextOrder.splice(toIdx, 0, draggedCardId);
              updateLiveOrderWithFLIP(nextOrder);
            }
          }
        }}
        onDragEnd={handleCardDrop}
        onDrop={handleCardDrop}
        data-card-id={card.id}
        onClick={(e) => {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }

          if (isLongPressRef.current) {
            isLongPressRef.current = false;
            return;
          }

          if (!draggedCardIdRef.current && !isDroppingRef.current && !isCardDimmed) {
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
        className={`card-grid-item app-bg-secondary border rounded-2xl overflow-hidden shadow-xs cursor-grab active:cursor-grabbing group flex flex-col relative transition-all ${
          isBeingDragged && !isDroppingThisCard
            ? 'opacity-20 border-dashed border-slate-700/40 min-h-[160px]'
            : isDroppingThisCard
            ? 'opacity-0 min-h-[160px]'
            : justDroppedCardId === card.id
            ? 'card-drop-settle'
            : isCardDimmed
            ? 'opacity-25 grayscale-[30%] pointer-events-none border-dashed app-border'
            : selectedCardIds.has(card.id)
            ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40 shadow-md bg-[var(--accent)]/10'
            : isCardHighlighted
            ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/50 shadow-md scale-[1.01]'
            : 'app-border hover:border-[var(--accent)]/60 hover:-translate-y-0.5'
        }`}
      >
        {isBeingDragged ? (
          <div className="flex-1 min-h-[160px]" />
        ) : (
          <>
            {/* Category Header Bar */}
            <div className="px-3 py-2 bg-[#1e1e1e] border-b border-[#383838] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => togglePinCard(card.id, e)}
                  className={`p-1 rounded-md transition-all cursor-pointer ${
                    pinnedCardIds.has(card.id)
                      ? 'text-amber-400 bg-amber-400/10 opacity-100'
                      : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:text-amber-400'
                  }`}
                  title={pinnedCardIds.has(card.id) ? t.library.unpin : t.library.pin}
                >
                  <Icons.Pin size={12} className={pinnedCardIds.has(card.id) ? 'fill-amber-400' : ''} />
                </button>
                <div
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${cfg.bgGradient} ${cfg.borderColor}`}
                  style={{ color: cfg.color }}
                >
                  <IconComp size={11} />
                  <span>{getCategoryLabel(card.category)}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                <Icons.GripHorizontal size={14} className="text-slate-400 cursor-grab" />
              </div>
            </div>

            {/* Image */}
            {card.imageUrl && (
              <div className="h-32 w-full overflow-hidden relative">
                <img
                  src={card.imageUrl}
                  alt={card.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 pointer-events-none select-none"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
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
                <h3 className="text-xs font-bold app-text-main group-hover:text-blue-400 transition-colors">
                  {card.title || t.common.untitled}
                </h3>
                {card.subtitle && (
                  <p className="text-[11px] app-text-muted">
                    {card.subtitle}
                  </p>
                )}
                <p className="text-[11px] app-text-muted line-clamp-2 leading-relaxed pt-1">
                  {card.summary || t.cardReader.noSummary}
                </p>
              </div>

              {/* Footer Info & Assigned Deck Badge */}
              <div className="pt-2 border-t app-border flex items-center justify-between">
                {assignedDeck ? (
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded border flex items-center gap-1 shadow-xs"
                    style={{
                      borderColor: assignedDeck.color || '#3b82f6',
                      color: assignedDeck.color || '#3b82f6',
                      backgroundColor: `${assignedDeck.color || '#3b82f6'}15`,
                    }}
                  >
                    <Icons.Layers size={10} />
                    <span className="truncate max-w-[90px]">{assignedDeck.name}</span>
                  </span>
                ) : (
                  <span className="text-[10px] app-text-muted italic">{t.library.standalone}</span>
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
          </>
        )}
      </div>
    );
  };

  // Render Compact List View Row for Card
  const renderCardListItem = (card: WorldCard) => {
    const cfg = CATEGORY_CONFIGS[card.category] || CATEGORY_CONFIGS.character;
    const IconComp = (Icons as any)[cfg.iconName] || Icons.HelpCircle || (() => null);
    const assignedDeck = decks.find((d) => d.id === card.deckId || (d.cardIds || []).includes(card.id));
    const isPinned = pinnedCardIds.has(card.id);
    const isSelected = selectedCardIds.has(card.id);
    const isBeingDragged = draggedCardId === card.id;

    return (
      <div
        key={`list-card-${card.id}`}
        ref={(el) => {
          if (el) cardDomRefs.current.set(card.id, el);
          else cardDomRefs.current.delete(card.id);
        }}
        draggable={true}
        onMouseDown={() => handleTouchMouseDown(card.id)}
        onMouseUp={handleTouchMouseUp}
        onMouseLeave={handleTouchMouseUp}
        onTouchStart={() => handleTouchMouseDown(card.id)}
        onTouchEnd={handleTouchMouseUp}
        onDragStart={(e) => {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
          isLongPressRef.current = false;
          if (isDroppingRef.current) return;
          e.dataTransfer.setData('text/plain', card.id);
          e.dataTransfer.effectAllowed = 'move';
          draggedCardIdRef.current = card.id;

          setDraggedCardData(card);

          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          dragOffsetRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          };
          dragPosRef.current = { x: e.clientX, y: e.clientY };

          if (transparentImgRef.current && e.dataTransfer.setDragImage) {
            e.dataTransfer.setDragImage(transparentImgRef.current, 0, 0);
          }

          cardDomRefs.current.forEach((el, id) => {
            if (el) prevRectsRef.current.set(id, el.getBoundingClientRect());
          });

          const initOrder = cardsToDisplay.map((c) => c.id);
          liveOrderRef.current = initOrder;
          setLiveOrder(initOrder);
          setDraggedCardId(card.id);
          setDroppingCardId(null);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (isDroppingRef.current || !draggedCardId || draggedCardId === card.id || !liveOrder) return;

          const now = Date.now();
          if (now - lastSwapTimeRef.current < 120) return;

          const fromIdx = liveOrder.indexOf(draggedCardId);
          const toIdx = liveOrder.indexOf(card.id);

          if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
            const rect = e.currentTarget.getBoundingClientRect();
            const cursorY = e.clientY;
            const midY = rect.top + rect.height / 2;

            const isForward = fromIdx < toIdx;
            const crossedMidpoint = isForward ? cursorY > midY + 4 : cursorY < midY - 4;

            if (crossedMidpoint) {
              lastSwapTimeRef.current = now;
              const nextOrder = [...liveOrder];
              nextOrder.splice(fromIdx, 1);
              nextOrder.splice(toIdx, 0, draggedCardId);
              updateLiveOrderWithFLIP(nextOrder);
            }
          }
        }}
        onDragEnd={handleCardDrop}
        onDrop={handleCardDrop}
        data-card-id={card.id}
        onClick={(e) => {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }

          if (isLongPressRef.current) {
            isLongPressRef.current = false;
            return;
          }

          if (!draggedCardIdRef.current && !isDroppingRef.current) {
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
        className={`px-4 py-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-grab active:cursor-grabbing select-none group bg-[#2c2c2c] border-[#383838] hover:border-[#0d99ff] ${
          isBeingDragged
            ? 'opacity-30 border-dashed border-[#0d99ff]'
            : isSelected
            ? 'bg-[#0d99ff]/10 border-[#0d99ff] ring-1 ring-[#0d99ff]'
            : ''
        }`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {/* Pin Button */}
          <button
            type="button"
            onClick={(e) => togglePinCard(card.id, e)}
            className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
              isPinned ? 'text-amber-400 bg-amber-400/10' : 'text-slate-500 opacity-30 group-hover:opacity-100 hover:text-amber-400'
            }`}
            title={isPinned ? t.library.unpin : t.library.pin}
          >
            <Icons.Pin size={13} className={isPinned ? 'fill-amber-400' : ''} />
          </button>

          {/* Square Image Thumbnail Avatar (36x36px) or Category Icon */}
          {card.imageUrl ? (
            <div className="w-9 h-9 rounded-lg overflow-hidden border border-[#383838] bg-[#1e1e1e] shrink-0">
              <img
                src={card.imageUrl}
                alt={card.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          ) : (
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 bg-[#1e1e1e]"
              style={{ borderColor: `${cfg.color}40`, color: cfg.color }}
            >
              <IconComp size={16} />
            </div>
          )}

          {/* Category Badge */}
          <div
            className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${cfg.bgGradient} ${cfg.borderColor}`}
            style={{ color: cfg.color }}
          >
            <IconComp size={11} />
            <span>{getCategoryLabel(card.category)}</span>
          </div>

          {/* Title & Summary */}
          <div className="truncate">
            <h4 className="text-xs font-bold text-white group-hover:text-[#0d99ff] transition-colors truncate">
              {card.title || t.common.untitled}
            </h4>
            <p className="text-[10px] text-slate-400 truncate max-w-[300px] md:max-w-[450px]">
              {card.summary || card.subtitle || t.cardReader.noSummary}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-xs">
          {/* Assigned Deck Badge */}
          {assignedDeck ? (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded border flex items-center gap-1 shrink-0"
              style={{
                borderColor: assignedDeck.color || '#0d99ff',
                color: assignedDeck.color || '#0d99ff',
                backgroundColor: `${assignedDeck.color || '#0d99ff'}15`,
              }}
            >
              <Icons.Layers size={10} />
              <span className="truncate max-w-[90px]">{assignedDeck.name}</span>
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 italic shrink-0 hidden sm:inline">{t.library.standalone}</span>
          )}

          {/* Tags */}
          {card.tags && card.tags.length > 0 && (
            <div className="hidden lg:flex items-center gap-1 shrink-0">
              {card.tags.slice(0, 2).map((t, idx) => (
                <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-[#1e1e1e] text-slate-400 border border-[#383838]">
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Date */}
          <span className="text-[10px] font-mono text-slate-400 hidden md:inline shrink-0">
            {new Date(card.updatedAt || Date.now()).toLocaleDateString(language === 'en' ? 'en-US' : 'id-ID', {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        </div>
      </div>
    );
  };

  // Context Menu Handlers with Smart Viewport Flipping
  const handleContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    e.stopPropagation();

    const isNearRight = e.clientX > window.innerWidth - 240;
    const isNearBottom = e.clientY > window.innerHeight - 250;

    // Check if right-clicked on a card
    const cardEl = target.closest('.card-grid-item');
    if (cardEl) {
      const cardId = cardEl.getAttribute('data-card-id');
      const card = cardId ? cards.find(c => c.id === cardId) : null;
      if (card) {
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, targetCard: card, targetDeck: null, isNearRight, isNearBottom });
        return;
      }
    }

    // Check if right-clicked on a deck
    const deckEl = target.closest('.deck-grid-item');
    if (deckEl) {
      const deckId = deckEl.getAttribute('data-deck-id');
      const deck = deckId ? decks.find(d => d.id === deckId) : null;
      if (deck) {
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, targetCard: null, targetDeck: deck, isNearRight, isNearBottom });
        return;
      }
    }

    // Right-clicked on empty space
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, targetCard: null, targetDeck: null, isNearRight, isNearBottom });
  };

  // Close context menu on window scroll or wheel
  useEffect(() => {
    if (!contextMenu.visible) return;

    const handleScrollOrWheel = () => {
      setContextMenu((prev) => ({ ...prev, visible: false }));
    };

    window.addEventListener('scroll', handleScrollOrWheel, true);
    window.addEventListener('wheel', handleScrollOrWheel, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScrollOrWheel, true);
      window.removeEventListener('wheel', handleScrollOrWheel);
    };
  }, [contextMenu.visible]);

  useEffect(() => {
    if (!contextMenu.visible) return;
    const handleClose = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener('mousedown', handleClose);
    document.addEventListener('contextmenu', handleClose);
    return () => {
      document.removeEventListener('mousedown', handleClose);
      document.removeEventListener('contextmenu', handleClose);
    };
  }, [contextMenu.visible]);

  return (
    <div
      onDragOver={handleContainerDragOver}
      onContextMenu={handleContextMenu}
      className="flex-1 app-bg-main p-6 overflow-y-auto app-text-main transition-colors"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        


        {/* Header Action & Filter Strip */}
        {activeDeck ? (
          <div className="flex items-center justify-between bg-[#2c2c2c] p-2.5 rounded-2xl border border-[#383838] shadow-md text-xs text-white">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveDeckId(null)}
                title={t.library.mainLibrary}
                className="p-2 rounded-xl bg-[#1e1e1e] hover:bg-[#383838] border border-[#383838] text-slate-200 hover:text-white flex items-center gap-1.5 font-semibold transition-all cursor-pointer"
              >
                <Icons.ArrowLeft size={16} className="text-[#0d99ff]" />
                <span>{t.library.mainLibrary}</span>
              </button>

              <div className="h-5 w-px bg-[#383838]" />

              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: activeDeck.color || '#0d99ff' }}
                />
                <h2 className="text-sm font-bold text-white tracking-tight truncate max-w-[200px] sm:max-w-[300px]">
                  {activeDeck.name}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1e1e1e] border border-[#383838] text-[#0d99ff] font-bold shrink-0">
                  {cards.filter((c) => c.deckId === activeDeck.id || (activeDeck.cardIds || []).includes(c.id)).length} {t.library.cards}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onEditDeckRequest(activeDeck)}
                className="px-3 py-1.5 rounded-xl bg-[#1e1e1e] hover:bg-[#383838] border border-[#383838] text-slate-200 hover:text-white font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Icons.Edit3 size={14} className="text-amber-400" />
                <span className="hidden sm:inline">{t.library.editDeck}</span>
              </button>

              <button
                type="button"
                onClick={() => onAddCard(activeDeck.id)}
                className="px-3.5 py-1.5 rounded-xl bg-[#0d99ff] hover:bg-[#0b85de] text-white font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Icons.Plus size={15} />
                <span>{t.library.addCardToDeck}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Main Gallery View Filter Tabs & Action Buttons */
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#2c2c2c] p-2 rounded-2xl border border-[#383838] shadow-md">
              {/* View Mode Segmented Tabs */}
              <div className="flex items-center gap-1 bg-[#1e1e1e] p-1 rounded-xl border border-[#383838] text-xs font-semibold select-none">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'all'
                      ? 'bg-[#2c2c2c] text-white font-bold shadow-xs border border-[#383838]'
                      : 'text-slate-300 hover:text-white hover:bg-[#2c2c2c]/50'
                  }`}
                >
                  {t.library.all} ({decks.length + cards.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('decks')}
                  className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'decks'
                      ? 'bg-[#2c2c2c] text-white font-bold shadow-xs border border-[#383838]'
                      : 'text-slate-300 hover:text-white hover:bg-[#2c2c2c]/50'
                  }`}
                >
                  <Icons.SquareStack size={14} className={activeTab === 'decks' ? 'text-purple-400' : 'text-slate-400'} />
                  <span>{t.library.decks} ({decks.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('cards')}
                  className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'cards'
                      ? 'bg-[#2c2c2c] text-white font-bold shadow-xs border border-[#383838]'
                      : 'text-slate-300 hover:text-white hover:bg-[#2c2c2c]/50'
                  }`}
                >
                  <Icons.FileText size={14} className={activeTab === 'cards' ? 'text-[#0d99ff]' : 'text-slate-400'} />
                  <span>{t.library.cards} ({cards.length})</span>
                </button>
              </div>

              {/* Layout Grid/List Switcher & Sort By Controls */}
              <div className="flex items-center gap-2">
                {/* Grid / List Switcher */}
                <div className="flex bg-[#1e1e1e] p-1 rounded-xl border border-[#383838] text-xs">
                  <button
                    type="button"
                    onClick={() => setViewLayout('grid')}
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
                    onClick={() => setViewLayout('list')}
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
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-xl bg-[#1e1e1e] border border-[#383838] text-slate-200 text-xs font-semibold cursor-pointer outline-none"
                >
                  <option value="custom">{t.library.manualOrder}</option>
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
                  onClick={() => onAddCard()}
                  className="px-3.5 py-1.5 rounded-xl bg-[#0d99ff] hover:bg-[#0b85de] text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Icons.Plus size={15} />
                  <span>{t.library.newCard}</span>
                </button>
              </div>
            </div>

            {/* Tag Filter Pills Bar */}
            {allUniqueTags.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 custom-scrollbar text-xs">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider shrink-0">
                  Tag:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTagFilter(null)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${
                    selectedTagFilter === null
                      ? 'bg-[#0d99ff] text-white shadow-xs'
                      : 'bg-[#2c2c2c] border border-[#383838] text-slate-300 hover:text-white'
                  }`}
                >
                  {t.library.allTags}
                </button>
                {allUniqueTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTagFilter(selectedTagFilter === tag ? null : tag)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${
                      selectedTagFilter === tag
                        ? 'bg-[#0d99ff] text-white shadow-xs'
                        : 'bg-[#2c2c2c] border border-[#383838] text-slate-300 hover:text-white'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Remove Card From Deck Drop Zone Bar (White icon only, no container box or text, enlarged drop area) */}
        {shouldShowRemoveZone && (
          <div
            onDragOver={handleRemoveFromDeckDragOver}
            onDragLeave={handleRemoveFromDeckDragLeave}
            onDrop={handleRemoveFromDeckDrop}
            className="w-full py-10 flex items-center justify-center select-none cursor-pointer transition-all duration-300 min-h-[140px] animate-in fade-in zoom-in-95"
          >
            {isSuccessRemove ? (
              <Icons.CheckCircle2
                size={44}
                className="text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)] animate-bounce"
              />
            ) : (
              <Icons.FolderOutput
                size={46}
                className={`text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)] transition-all duration-200 ${
                  isHoveredRemoveZone ? 'scale-125 animate-bounce' : 'scale-100 opacity-90'
                }`}
              />
            )}
          </div>
        )}

        {/* UNIFIED GRID / LIST DISPLAY SECTION */}
        {totalItemsCount === 0 ? (
          <div className="text-center py-20 text-slate-400 space-y-3 select-none">
            {activeDeckId ? (
              <>
                <Icons.SquareStack size={56} className="mx-auto text-slate-500/50 stroke-[1.5]" />
                <p className="text-sm font-medium text-slate-400">{t.library.noCardsInDeck}</p>
              </>
            ) : (
              <>
                <Icons.FileText size={56} className="mx-auto text-slate-500/50 stroke-[1.5]" />
                <p className="text-sm font-medium text-slate-400">{t.library.noItemsFound}</p>
                <p className="text-xs text-slate-500">{t.library.rightClickHint}</p>
              </>
            )}
          </div>
        ) : viewLayout === 'list' ? (
          /* COMPACT LIST / TABLE VIEW */
          <div className="space-y-2">
            {showDecksInGrid && sortedDecks.map((deck) => (
              <div
                key={`list-deck-${deck.id}`}
                onClick={() => setActiveDeckId(deck.id)}
                className="px-4 py-3 rounded-xl bg-[#2c2c2c] border border-[#383838] hover:border-purple-400 flex items-center justify-between gap-3 cursor-pointer group transition-all"
              >
                <div className="flex items-center gap-3">
                  <Icons.SquareStack size={18} className="text-purple-400 shrink-0" />
                  <h4 className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
                    {deck.name}
                  </h4>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1e1e1e] border border-[#383838] text-purple-300 font-bold">
                  {cards.filter((c) => c.deckId === deck.id || (deck.cardIds || []).includes(c.id)).length} {t.library.cards}
                </span>
              </div>
            ))}
            {showCardsInGrid && sortedCards.map(renderCardListItem)}
          </div>
        ) : (
          /* CARD GRID VIEW */
          <div
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
            onDragOver={(e) => {
              if (draggedCardId) {
                e.preventDefault();
              }
            }}
            onDrop={handleCardDrop}
          >
            {showDecksInGrid && sortedDecks.map(renderDeckItem)}
            {showCardsInGrid && sortedCards.map((card) => renderCardItem(card))}
          </div>
        )}

        {/* ======================== */}
        {/* MINIMALIST FLOATING DRAG PREVIEW */}
        {/* ======================== */}
        {/* Right-Click Context Menu */}
        {/* Multi-Select Floating Toolbar with Batch Operations */}
        {(selectedCardIds.size > 0 || isSelectionMode) && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] bg-[#2c2c2c] border border-[#383838] rounded-2xl shadow-2xl px-5 py-2.5 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200 select-none text-xs text-white backdrop-blur-md">
            <div className="flex items-center gap-2 font-bold text-white">
              <Icons.CheckSquare size={16} className="text-[#0d99ff]" />
              <span>{selectedCardIds.size} {t.library.cardsSelected}</span>
            </div>

            <div className="h-4 w-px bg-[#383838]" />

            {/* Select All / Clear */}
            <button
              type="button"
              onClick={() => {
                if (selectedCardIds.size === displayCards.length) {
                  setSelectedCardIds(new Set());
                } else {
                  setSelectedCardIds(new Set(displayCards.map((c) => c.id)));
                }
              }}
              className="px-2.5 py-1 rounded-lg hover:bg-[#383838] text-slate-300 hover:text-white font-semibold transition-colors cursor-pointer"
            >
              {selectedCardIds.size === displayCards.length ? t.library.clearSelection : t.library.selectAll}
            </button>

            {/* Batch Pin */}
            <button
              type="button"
              onClick={() => {
                setPinnedCardIds((prev) => {
                  const next = new Set(prev);
                  selectedCardIds.forEach((id) => next.add(id));
                  return next;
                });
              }}
              className="px-2.5 py-1 rounded-lg hover:bg-[#383838] text-amber-400 hover:text-amber-300 font-semibold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Icons.Pin size={13} />
              <span>{t.library.pin}</span>
            </button>

            {/* Batch Delete */}
            <button
              type="button"
              onClick={() => {
                onDeleteCardsRequest(Array.from(selectedCardIds));
                setSelectedCardIds(new Set());
                setIsSelectionMode(false);
              }}
              className="px-2.5 py-1 rounded-lg hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 font-semibold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Icons.Trash2 size={13} />
              <span>{t.common.delete}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedCardIds(new Set());
                setIsSelectionMode(false);
              }}
              className="p-1 rounded-lg hover:bg-[#383838] text-slate-400 hover:text-white transition-colors cursor-pointer"
              title={t.library.clearSelection}
            >
              <Icons.X size={15} />
            </button>
          </div>
        )}
        {/* Right-Click Context Menu */}
        {contextMenu.visible && (
          <div
            ref={contextMenuRef}
            className="fixed bg-[#2c2c2c] border border-[#383838] rounded-xl shadow-2xl py-1.5 w-60 max-h-[85vh] overflow-y-auto custom-scrollbar z-[100] text-xs text-white animate-in fade-in zoom-in-95 duration-100 divide-y divide-[#383838]"
            style={{
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
              transform: `translate(${contextMenu.isNearRight ? '-100%' : '0'}, ${contextMenu.isNearBottom ? '-100%' : '0'})`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.targetDeck ? (
              <>
                <div className="px-3 py-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider select-none truncate flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: contextMenu.targetDeck.color || '#0d99ff' }}
                  />
                  <span className="truncate">{contextMenu.targetDeck.name}</span>
                </div>

                <div className="py-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDeckId(contextMenu.targetDeck!.id);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[#383838] flex items-center gap-2 transition-colors font-bold text-[#0d99ff] cursor-pointer"
                  >
                    <Icons.FolderOpen size={14} />
                    <span>{t.library.openDeck}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onEditDeckRequest(contextMenu.targetDeck!);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[#383838] flex items-center gap-2 transition-colors font-medium text-slate-200 cursor-pointer"
                  >
                    <Icons.Edit3 size={14} />
                    <span>{t.library.editDeck}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      togglePinDeck(contextMenu.targetDeck!.id, e);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[#383838] flex items-center gap-2 transition-colors font-medium text-amber-400 cursor-pointer"
                  >
                    <Icons.Pin size={14} className={pinnedDeckIds.has(contextMenu.targetDeck!.id) ? 'fill-amber-400' : ''} />
                    <span>{pinnedDeckIds.has(contextMenu.targetDeck!.id) ? t.library.unpin : t.library.pin}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onAddCard(contextMenu.targetDeck!.id);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[#383838] flex items-center gap-2 transition-colors font-medium text-purple-400 cursor-pointer"
                  >
                    <Icons.Plus size={14} />
                    <span>{t.library.addCardToDeck}</span>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteDeckRequest(contextMenu.targetDeck!.id);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-rose-500/20 flex items-center gap-2 transition-colors text-rose-400 font-medium cursor-pointer"
                  >
                    <Icons.Trash2 size={14} />
                    <span>{t.library.deleteDeck}</span>
                  </button>
                </div>
              </>
            ) : contextMenu.targetCard ? (
              <>
                <div className="px-3 py-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider select-none truncate">
                  📄 {contextMenu.targetCard.title || t.common.untitled}
                </div>

                <div className="py-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenCardFullPage(contextMenu.targetCard!);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[#383838] flex items-center gap-2 transition-colors font-bold text-[#0d99ff] cursor-pointer"
                  >
                    <Icons.Maximize2 size={14} />
                    <span>{t.library.openFullscreen}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onEditCardRequest(contextMenu.targetCard!);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[#383838] flex items-center gap-2 transition-colors font-medium text-slate-200 cursor-pointer"
                  >
                    <Icons.Edit3 size={14} />
                    <span>{t.sidebar.editCard}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      togglePinCard(contextMenu.targetCard!.id, e);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[#383838] flex items-center gap-2 transition-colors font-medium text-amber-400 cursor-pointer"
                  >
                    <Icons.Pin size={14} className={pinnedCardIds.has(contextMenu.targetCard!.id) ? 'fill-amber-400' : ''} />
                    <span>{pinnedCardIds.has(contextMenu.targetCard!.id) ? t.library.unpin : t.library.pin}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${contextMenu.targetCard!.title}\n${contextMenu.targetCard!.summary || ''}`);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[#383838] flex items-center gap-2 transition-colors font-medium text-slate-300 cursor-pointer"
                  >
                    <Icons.Copy size={14} />
                    <span>{t.library.copyTitleSummary}</span>
                  </button>
                </div>

                {/* Assign to Deck Option */}
                {decks.length > 0 && (
                  <div className="py-1">
                    <div className="px-3 py-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {t.library.moveToDeck}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onAssignCardToDeck(contextMenu.targetCard!.id, undefined);
                        setContextMenu((prev) => ({ ...prev, visible: false }));
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-[#383838] text-slate-300 flex items-center gap-2 transition-colors text-[11px]"
                    >
                      <Icons.FileText size={12} />
                      <span>{t.library.standalone}</span>
                    </button>
                    {decks.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          onAssignCardToDeck(contextMenu.targetCard!.id, d.id);
                          setContextMenu((prev) => ({ ...prev, visible: false }));
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-[#383838] text-slate-200 flex items-center justify-between transition-colors text-[11px]"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Icons.Layers size={12} style={{ color: d.color || '#0d99ff' }} />
                          <span className="truncate">{d.name}</span>
                        </div>
                        {contextMenu.targetCard!.deckId === d.id && (
                          <Icons.Check size={12} className="text-[#0d99ff]" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteCardsRequest([contextMenu.targetCard!.id]);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-rose-500/20 flex items-center gap-2 transition-colors text-rose-400 font-medium cursor-pointer"
                  >
                    <Icons.Trash2 size={14} />
                    <span>{t.common.delete}</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="py-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onAddCard(activeDeckId || undefined);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[#383838] flex items-center gap-2 transition-colors font-bold text-[#0d99ff] cursor-pointer"
                  >
                    <Icons.Plus size={14} strokeWidth={2.5} />
                    <span>{t.sidebar.createNewCard}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onCreateDeckRequest();
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[#383838] flex items-center gap-2 transition-colors font-bold text-purple-400 cursor-pointer"
                  >
                    <Icons.FolderPlus size={14} />
                    <span>{t.library.newDeck}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCardIds(new Set(displayCards.map((c) => c.id)));
                      setIsSelectionMode(true);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[#383838] flex items-center gap-2 transition-colors font-medium text-slate-200 cursor-pointer"
                  >
                    <Icons.CheckSquare size={14} />
                    <span>{t.library.selectAll}</span>
                  </button>
                </div>

                {/* Quick Sort Submenu */}
                <div className="py-1">
                  <div className="px-3 py-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {t.library.sortMode}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('updated');
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-[#383838] text-slate-200 flex items-center justify-between text-[11px]"
                  >
                    <span>{t.library.lastUpdated}</span>
                    {sortBy === 'updated' && <Icons.Check size={12} className="text-[#0d99ff]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('created');
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-[#383838] text-slate-200 flex items-center justify-between text-[11px]"
                  >
                    <span>{t.library.dateCreated}</span>
                    {sortBy === 'created' && <Icons.Check size={12} className="text-[#0d99ff]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('title');
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-[#383838] text-slate-200 flex items-center justify-between text-[11px]"
                  >
                    <span>{t.library.titleAZ}</span>
                    {sortBy === 'title' && <Icons.Check size={12} className="text-[#0d99ff]" />}
                  </button>
                </div>

                {/* Layout Mode Submenu */}
                <div className="py-1">
                  <div className="px-3 py-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {t.library.viewMode}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setViewLayout('grid');
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-[#383838] text-slate-200 flex items-center justify-between text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <Icons.LayoutGrid size={12} />
                      <span>{t.library.cardGrid}</span>
                    </div>
                    {viewLayout === 'grid' && <Icons.Check size={12} className="text-[#0d99ff]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewLayout('list');
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-[#383838] text-slate-200 flex items-center justify-between text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <Icons.List size={12} />
                      <span>{t.library.compactTable}</span>
                    </div>
                    {viewLayout === 'list' && <Icons.Check size={12} className="text-[#0d99ff]" />}
                  </button>
                </div>

                {selectedTagFilter && (
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTagFilter(null);
                        setContextMenu((prev) => ({ ...prev, visible: false }));
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-[#383838] text-amber-400 flex items-center gap-2 text-[11px]"
                    >
                      <Icons.RotateCcw size={12} />
                      <span>Reset Filter Tag (#{selectedTagFilter})</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {draggedCardId && draggedCardData && (() => {
          const dragCard = draggedCardData;
          const cfg = CATEGORY_CONFIGS[dragCard.category] || CATEGORY_CONFIGS.character;
          const IconComp = (Icons as any)[cfg.iconName] || Icons.HelpCircle || (() => null);
          const assignedDeck = decks.find((d) => d.id === dragCard.deckId || (d.cardIds || []).includes(dragCard.id));

          // Initial position from refs
          const initX = dragPosRef.current.x - dragOffsetRef.current.x;
          const initY = dragPosRef.current.y - dragOffsetRef.current.y;

          if (viewLayout === 'list') {
            return (
              <div
                ref={floatingPreviewRef}
                className="card-floating-preview"
                style={{
                  position: 'fixed',
                  left: 0,
                  top: 0,
                  transform: `translate3d(${initX}px, ${initY}px, 0)`,
                  width: '400px',
                  maxWidth: '90vw',
                  zIndex: 99999,
                  pointerEvents: 'none',
                }}
              >
                <div className="px-4 py-2.5 rounded-xl border flex items-center justify-between gap-3 shadow-2xl bg-[#2c2c2c] border-[#0d99ff] ring-2 ring-[#0d99ff]/50 text-white">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {/* Square Image Thumbnail Avatar (36x36px) or Category Icon */}
                    {dragCard.imageUrl ? (
                      <div className="w-9 h-9 rounded-lg overflow-hidden border border-[#383838] bg-[#1e1e1e] shrink-0">
                        <img
                          src={dragCard.imageUrl}
                          alt={dragCard.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 bg-[#1e1e1e]"
                        style={{ borderColor: `${cfg.color}40`, color: cfg.color }}
                      >
                        <IconComp size={16} />
                      </div>
                    )}

                    {/* Category Badge */}
                    <div
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${cfg.bgGradient} ${cfg.borderColor}`}
                      style={{ color: cfg.color }}
                    >
                      <IconComp size={11} />
                      <span>{getCategoryLabel(dragCard.category)}</span>
                    </div>

                    {/* Title */}
                    <div className="truncate">
                      <h4 className="text-xs font-bold text-white truncate">
                        {dragCard.title || t.common.untitled}
                      </h4>
                      <p className="text-[10px] text-slate-400 truncate max-w-[180px]">
                        {dragCard.summary || t.cardReader.noSummary}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              ref={floatingPreviewRef}
              className="card-floating-preview"
              style={{
                position: 'fixed',
                left: 0,
                top: 0,
                transform: `translate3d(${initX}px, ${initY}px, 0)`,
                width: '260px',
                zIndex: 99999,
                pointerEvents: 'none',
              }}
            >
              <div className="card-floating-inner app-bg-secondary border app-border rounded-2xl overflow-hidden flex flex-col">
                {/* Category Header Bar */}
                <div className="px-3 py-2 app-bg-main border-b app-border flex items-center justify-between gap-2">
                  <div
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${cfg.bgGradient} ${cfg.borderColor}`}
                    style={{ color: cfg.color }}
                  >
                    <IconComp size={11} />
                    <span>{getCategoryLabel(dragCard.category)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Icons.GripHorizontal size={14} className="app-text-muted" />
                  </div>
                </div>

                {/* Image */}
                {dragCard.imageUrl && (
                  <div className="h-32 w-full overflow-hidden relative">
                    <img
                      src={dragCard.imageUrl}
                      alt={dragCard.title}
                      className="w-full h-full object-cover opacity-90 pointer-events-none select-none"
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold app-text-main">
                      {dragCard.title || t.common.untitled}
                    </h3>
                    {dragCard.subtitle && (
                      <p className="text-[11px] app-text-muted">{dragCard.subtitle}</p>
                    )}
                    <p className="text-[11px] app-text-muted line-clamp-2 leading-relaxed pt-1">
                      {dragCard.summary || t.cardReader.noSummary}
                    </p>
                  </div>

                  <div className="pt-2 border-t app-border flex items-center justify-between">
                    {assignedDeck ? (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded border flex items-center gap-1 shadow-xs"
                        style={{
                          borderColor: assignedDeck.color || '#3b82f6',
                          color: assignedDeck.color || '#60a5fa',
                          backgroundColor: `${assignedDeck.color || '#3b82f6'}15`,
                        }}
                      >
                        <Icons.Folder size={10} />
                        <span className="truncate max-w-[90px]">{assignedDeck.name}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] app-text-muted italic">{t.library.standalone}</span>
                    )}

                    {dragCard.tags && dragCard.tags.length > 0 && (
                      <div className="flex items-center gap-1">
                        {dragCard.tags.slice(0, 2).map((tag, i) => (
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
            </div>
          );
        })()}
      </div>
    </div>
  );
};
