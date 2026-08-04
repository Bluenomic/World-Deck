import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
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
  const [activeTab, setActiveTab] = useState<'all' | 'decks' | 'cards'>('all');
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    targetCard: WorldCard | null;
    targetDeck: WorldDeck | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    targetCard: null,
    targetDeck: null,
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
    if (cardId) {
      onAssignCardToDeck(cardId, deckId);
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
    const deckColor = deck.color || '#3b82f6';
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
          boxShadow: `inset 0 3px 0 0 ${isHovered ? '#60a5fa' : deckColor}`,
        }}
        className={`deck-grid-item group relative flex flex-col space-y-2 p-3.5 pt-4 cursor-pointer transition-all duration-300 rounded-2xl select-none app-bg-secondary border border-slate-700/60 hover:border-blue-500/70 ${
          isSuccess
            ? 'scale-105 border-emerald-400 ring-4 ring-emerald-500/40'
            : isHovered
            ? '-translate-y-1 scale-105 border-blue-400 shadow-xl'
            : ''
        }`}
      >

        {/* Drop Zone Overlay Hint */}
        {isHovered && (
          <div className="absolute inset-0 bg-blue-950/85 backdrop-blur-xs z-30 rounded-2xl flex flex-col items-center justify-center p-3 text-center space-y-1.5 animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
            <Icons.Layers size={32} className="text-blue-300 animate-bounce" />
            <span className="text-xs font-bold text-white drop-shadow">
              Lepaskan Kartu di Sini
            </span>
          </div>
        )}

        {/* Success Overlay Hint */}
        {isSuccess && (
          <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-xs z-30 rounded-2xl flex flex-col items-center justify-center p-3 text-center space-y-1 animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
            <Icons.CheckCircle2 size={32} className="text-emerald-400 animate-bounce" />
            <span className="text-xs font-bold text-emerald-300 drop-shadow">
              Kartu Berhasil Dimasukkan!
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
                        {c.title || 'Kartu'}
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
                          {c.summary || 'Kartu deck...'}
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
                <span className="text-[10px] font-semibold app-text-muted">Deck Kosong</span>
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
            ? 'border-blue-400 ring-2 ring-blue-500/40 shadow-md bg-blue-500/5'
            : isCardHighlighted
            ? 'border-blue-400 ring-2 ring-blue-500/50 shadow-md scale-[1.01]'
            : 'app-border hover:border-slate-500/60 hover:-translate-y-0.5'
        }`}
      >
        {isBeingDragged ? (
          <div className="flex-1 min-h-[160px]" />
        ) : (
          <>
            {/* Category Header Bar */}
            <div className="px-3 py-2 app-bg-main border-b app-border flex items-center justify-between gap-2">
              <div
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${cfg.bgGradient} ${cfg.borderColor}`}
                style={{ color: cfg.color }}
              >
                <IconComp size={11} />
                <span>{cfg.label}</span>
              </div>

              <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity" title="Geser kartu">
                <Icons.GripHorizontal size={14} className="app-text-muted cursor-grab" />
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
                  <span className="text-[10px] app-text-muted italic">Mandiri</span>
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

  // Context Menu Handlers
  const handleContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    e.stopPropagation();

    // Check if right-clicked on a card
    const cardEl = target.closest('.card-grid-item');
    if (cardEl) {
      const cardId = cardEl.getAttribute('data-card-id');
      const card = cardId ? cards.find(c => c.id === cardId) : null;
      if (card) {
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, targetCard: card, targetDeck: null });
        return;
      }
    }

    // Check if right-clicked on a deck
    const deckEl = target.closest('.deck-grid-item');
    if (deckEl) {
      const deckId = deckEl.getAttribute('data-deck-id');
      const deck = deckId ? decks.find(d => d.id === deckId) : null;
      if (deck) {
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, targetCard: null, targetDeck: deck });
        return;
      }
    }

    // Background click
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, targetCard: null, targetDeck: null });
  };

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
        


        {/* Back button to gallery when inside a Deck (Icon only) */}
        {activeDeck ? (
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setActiveDeckId(null)}
              title="Kembali ke Galeri"
              className="p-2.5 rounded-xl app-bg-secondary border app-border hover:border-blue-400 app-text-main flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-sm"
            >
              <Icons.ArrowLeft size={18} />
            </button>
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
                <Icons.SquareStack size={14} />
                <span>Deck ({decks.length})</span>
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

        {/* UNIFIED GRID DISPLAY SECTION */}
        {totalItemsCount === 0 ? (
          <div className="text-center py-16 app-bg-secondary rounded-2xl border app-border app-text-muted space-y-3">
            <Icons.FileText size={36} className="mx-auto app-text-muted opacity-50" />
            <p className="text-xs">Tidak ada item atau kartu ditemukan dalam galeri ini.</p>
            <p className="text-[11px] app-text-muted">Klik kanan di area kosong untuk membuat kartu atau deck baru.</p>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
            onDragOver={(e) => {
              if (draggedCardId) {
                e.preventDefault();
              }
            }}
            onDrop={handleCardDrop}
          >
            {showDecksInGrid && filteredDecks.map(renderDeckItem)}
            {showCardsInGrid && displayCards.map((card) => renderCardItem(card))}
          </div>
        )}

        {/* ======================== */}
        {/* MINIMALIST FLOATING DRAG PREVIEW */}
        {/* ======================== */}
        {/* Right-Click Context Menu */}
        {/* Multi-Select Floating Toolbar */}
        {(selectedCardIds.size > 0 || isSelectionMode) && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] app-bg-secondary border app-border rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center gap-2 text-xs font-bold app-text-main">
              <Icons.CheckSquare size={16} className="text-blue-400" />
              <span>{selectedCardIds.size} kartu dipilih</span>
              {isSelectionMode && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold">
                  Mode Seleksi
                </span>
              )}
            </div>

            <div className="h-5 w-px bg-slate-600" />

            {activeDeck && selectedCardIds.size > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    selectedCardIds.forEach((id) => onAssignCardToDeck(id, undefined));
                    setSelectedCardIds(new Set());
                    setIsSelectionMode(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Icons.FolderOutput size={14} />
                  <span>Keluarkan dari Deck ({selectedCardIds.size})</span>
                </button>
                <div className="h-5 w-px bg-slate-600" />
              </>
            )}

            {selectedCardIds.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  onDeleteCardsRequest(Array.from(selectedCardIds));
                  setSelectedCardIds(new Set());
                  setIsSelectionMode(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Icons.Trash2 size={13} />
                <span>Hapus Semua</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setSelectedCardIds(new Set());
                setIsSelectionMode(false);
              }}
              className="px-3 py-1.5 rounded-lg app-bg-main app-text-muted hover:app-text-main text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border app-border"
            >
              <Icons.X size={13} />
              <span>Batal</span>
            </button>
          </div>
        )}

        {/* Right-Click Context Menu */}
        {contextMenu.visible && (
          <div
            ref={contextMenuRef}
            className="fixed app-bg-secondary border app-border rounded-xl shadow-2xl py-1.5 w-52 z-[100] text-xs app-text-main animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-700/50"
            style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.targetDeck ? (
              <>
                <div className="px-3 py-1.5 text-[10px] app-text-muted font-bold uppercase tracking-wider select-none truncate flex items-center gap-1.5">
                  <Icons.Layers size={12} className="text-blue-400 shrink-0" />
                  <span className="truncate">{contextMenu.targetDeck.name}</span>
                </div>

                <div className="py-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDeckId(contextMenu.targetDeck!.id);
                      setContextMenu(prev => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold text-blue-400 cursor-pointer"
                  >
                    <Icons.FolderOpen size={14} />
                    <span>Buka Deck</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onEditDeckRequest(contextMenu.targetDeck!);
                      setContextMenu(prev => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold app-text-main cursor-pointer"
                  >
                    <Icons.Edit3 size={14} />
                    <span>Ganti Nama Deck</span>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteDeckRequest(contextMenu.targetDeck!.id);
                      setContextMenu(prev => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors text-rose-500 font-medium cursor-pointer"
                  >
                    <Icons.Trash2 size={14} />
                    <span>Hapus Deck</span>
                  </button>
                </div>
              </>
            ) : contextMenu.targetCard ? (
              <>
                <div className="px-3 py-1.5 text-[10px] app-text-muted font-bold uppercase tracking-wider select-none truncate">
                  📄 {contextMenu.targetCard.title || 'Kartu'}
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenCardFullPage(contextMenu.targetCard!);
                      setContextMenu(prev => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold text-blue-400 cursor-pointer"
                  >
                    <Icons.Maximize2 size={14} />
                    <span>Buka Kartu</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onEditCardRequest(contextMenu.targetCard!);
                      setContextMenu(prev => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold app-text-main cursor-pointer"
                  >
                    <Icons.Edit3 size={14} />
                    <span>Edit Kartu</span>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteCardsRequest([contextMenu.targetCard!.id]);
                      setContextMenu(prev => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors text-rose-500 font-medium cursor-pointer"
                  >
                    <Icons.Trash2 size={14} />
                    <span>Hapus Kartu Permanen</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="px-3 py-1.5 text-[10px] app-text-muted font-semibold uppercase tracking-wider select-none">
                  Aksi Galeri
                </div>

                <div className="py-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onAddCard(activeDeckId || undefined);
                      setContextMenu(prev => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold text-emerald-400 cursor-pointer"
                  >
                    <Icons.Plus size={14} strokeWidth={2.5} />
                    <span>Buat Kartu Baru</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onCreateDeckRequest();
                      setContextMenu(prev => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold text-blue-400 cursor-pointer"
                  >
                    <Icons.SquareStack size={14} />
                    <span>Buat Deck Baru</span>
                  </button>
                </div>

                {selectedCardIds.size > 0 && (
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteCardsRequest(Array.from(selectedCardIds));
                        setSelectedCardIds(new Set());
                        setContextMenu(prev => ({ ...prev, visible: false }));
                      }}
                      className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors text-rose-500 font-medium cursor-pointer"
                    >
                      <Icons.Trash2 size={14} />
                      <span>Hapus {selectedCardIds.size} Kartu Terpilih</span>
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
                    <span>{cfg.label}</span>
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
                      {dragCard.title || 'Kartu Tanpa Judul'}
                    </h3>
                    {dragCard.subtitle && (
                      <p className="text-[11px] app-text-muted">{dragCard.subtitle}</p>
                    )}
                    <p className="text-[11px] app-text-muted line-clamp-2 leading-relaxed pt-1">
                      {dragCard.summary || 'Belum ada ringkasan...'}
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
                      <span className="text-[10px] app-text-muted italic">Mandiri</span>
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
