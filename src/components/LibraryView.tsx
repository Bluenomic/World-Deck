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
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'decks' | 'cards'>('all');
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);

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

  // Track global cursor position during HTML5 drag — direct DOM for zero-lag
  useEffect(() => {
    if (!draggedCardId) return;

    const updatePreviewPos = () => {
      const el = floatingPreviewRef.current;
      if (el) {
        const x = dragPosRef.current.x - dragOffsetRef.current.x;
        const y = dragPosRef.current.y - dragOffsetRef.current.y;
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
      rafIdRef.current = null;
    };

    const handleGlobalDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.clientX !== 0 || e.clientY !== 0) {
        dragPosRef.current.x = e.clientX;
        dragPosRef.current.y = e.clientY;
        if (rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(updatePreviewPos);
        }
      }
    };

    // Safety cleanup if drag ends outside or dragend event is missed
    const handleGlobalDragEnd = () => {
      if (liveOrderRef.current && draggedCardIdRef.current) {
        onReorderCards(liveOrderRef.current);
      }
      setDraggedCardId(null);
      setDraggedCardData(null);
      setLiveOrder(null);
      liveOrderRef.current = null;
      setHoveredDeckId(null);
      setIsHoveredRemoveZone(false);
      setIsNearTop(false);
      draggedCardIdRef.current = null;
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
  const filteredCards = cards.filter((card) => {
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

  const showDecksInGrid = !activeDeckId && (activeTab === 'all' || activeTab === 'decks');
  const showCardsInGrid = activeDeckId || activeTab === 'all' || activeTab === 'cards';

  // Cards to display in grid (In 'Semua' tab, only show standalone cards not inside any deck)
  const cardsToDisplay = filteredCards.filter((card) => {
    if (activeDeckId) return true;
    if (activeTab === 'all') return !card.deckId;
    return true;
  });

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

  // Container drag over to detect cursor approaching top area inside a deck
  const handleContainerDragOver = (e: React.DragEvent) => {
    if (activeDeck && (draggedCardId || draggedCardIdRef.current)) {
      const containerTop = e.currentTarget.getBoundingClientRect().top;
      const relativeY = e.clientY - containerTop;
      if (relativeY < 280) {
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
    }
    setHoveredDeckId(null);
    setDraggedCardId(null);
    setIsNearTop(false);
    draggedCardIdRef.current = null;
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
    if (cardId) {
      onAssignCardToDeck(cardId, undefined);
      setIsSuccessRemove(true);

      setTimeout(() => setIsSuccessRemove(false), 1200);
    }
    setIsHoveredRemoveZone(false);
    setIsNearTop(false);
    setDraggedCardId(null);
    draggedCardIdRef.current = null;
  };

  const renderDeckItem = (deck: WorldDeck) => {
    const deckCards = cards.filter(
      (c) => c.deckId === deck.id || (deck.cardIds || []).includes(c.id)
    );
    const deckColor = deck.color || '#a855f7';
    const isHovered = hoveredDeckId === deck.id;
    const isSuccess = successDeckId === deck.id;
    const isDraggingAnyCard = !!draggedCardId;

    return (
      <div
        key={`deck-${deck.id}`}
        onClick={() => setActiveDeckId(deck.id)}
        onDragOver={(e) => handleDragOver(e, deck.id)}
        onDragLeave={(e) => handleDragLeave(e, deck.id)}
        onDrop={(e) => handleDrop(e, deck.id)}
        className={`app-bg-secondary border rounded-2xl p-4 shadow-md transition-all duration-300 cursor-pointer group flex flex-col justify-between space-y-3 relative overflow-hidden ${
          isSuccess
            ? 'border-emerald-400 ring-4 ring-emerald-500/40 bg-emerald-950/20 scale-105 shadow-2xl'
            : isHovered
            ? 'border-blue-400 ring-4 ring-blue-500/50 bg-blue-950/40 -translate-y-1.5 scale-105 shadow-2xl shadow-blue-500/30'
            : isDraggingAnyCard
            ? 'border-blue-500/40 hover:border-blue-400 shadow-blue-900/20 animate-pulse'
            : 'app-border hover:border-blue-400'
        }`}
      >
        {/* Top Accent Line */}
        <div
          className={`absolute top-0 left-0 right-0 h-1 transition-all ${
            isHovered ? 'h-1.5 bg-blue-400' : ''
          }`}
          style={{ backgroundColor: isHovered ? '#60a5fa' : deckColor }}
        />

        {/* Drop Zone Overlay Hint (pointer-events-none prevents flicker) */}
        {isHovered && (
          <div className="absolute inset-0 bg-blue-950/85 backdrop-blur-xs z-20 flex flex-col items-center justify-center p-3 text-center space-y-1.5 animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
            <Icons.FolderInput size={28} className="text-blue-300 animate-bounce" />
            <span className="text-xs font-bold text-white drop-shadow">
              Lepaskan Kartu di Sini
            </span>
            <span className="text-[10px] text-blue-200">
              Masukan ke Deck "{deck.name}"
            </span>
          </div>
        )}

        {/* Success Overlay Hint */}
        {isSuccess && (
          <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-xs z-20 flex flex-col items-center justify-center p-3 text-center space-y-1 animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
            <Icons.CheckCircle2 size={32} className="text-emerald-400 animate-bounce" />
            <span className="text-xs font-bold text-emerald-300 drop-shadow">
              Kartu Berhasil Dimasukkan!
            </span>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm transition-transform duration-300 ${
                  isHovered ? 'scale-125 rotate-6' : 'group-hover:scale-110'
                }`}
                style={{ backgroundColor: deckColor }}
              >
                <Icons.Folder size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold app-text-main group-hover:text-blue-400 transition-colors line-clamp-1">
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
            <span className="group-hover:text-blue-400 font-semibold transition-colors flex items-center gap-0.5">
              Buka Deck ➔
            </span>
          </div>
        ) : (
          <div className="pt-2 border-t app-border text-[10px] app-text-muted flex items-center justify-between">
            <span>Deck Kosong</span>
            <span className="group-hover:text-blue-400 font-semibold transition-colors">
              + Tambah Kartu
            </span>
          </div>
        )}
      </div>
    );
  };

  const handleCardDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (liveOrder && draggedCardId) {
      onReorderCards(liveOrder);
    }
    const droppedId = draggedCardId;
    if (droppedId) {
      setJustDroppedCardId(droppedId);
      setTimeout(() => setJustDroppedCardId(null), 300);
    }
    setDraggedCardId(null);
    setDraggedCardData(null);
    setLiveOrder(null);
    setHoveredDeckId(null);
    setIsHoveredRemoveZone(false);
    setIsNearTop(false);
    draggedCardIdRef.current = null;
  };

  const renderCardItem = (card: WorldCard) => {
    const cfg = CATEGORY_CONFIGS[card.category] || CATEGORY_CONFIGS.character;
    const IconComp = (Icons as any)[cfg.iconName] || Icons.HelpCircle || (() => null);
    const assignedDeck = decks.find((d) => d.id === card.deckId || (d.cardIds || []).includes(card.id));
    const isBeingDragged = draggedCardId === card.id;

    return (
      <div
        key={`card-${card.id}`}
        ref={(el) => {
          if (el) cardDomRefs.current.set(card.id, el);
          else cardDomRefs.current.delete(card.id);
        }}
        draggable={true}
        onDragStart={(e) => {
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
        }}
        onDragOver={(e) => {
          e.preventDefault(); // allow drop
          if (!draggedCardId || draggedCardId === card.id || !liveOrder) return;

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
        onClick={() => {
          if (!draggedCardIdRef.current) {
            onCardClick(card);
          }
        }}
        className={`card-grid-item app-bg-secondary border app-border rounded-2xl overflow-hidden shadow-xs cursor-grab active:cursor-grabbing group flex flex-col relative ${
          isBeingDragged
            ? 'opacity-20 border-dashed border-slate-700/40 min-h-[160px]'
            : justDroppedCardId === card.id
            ? 'card-drop-settle'
            : 'hover:border-slate-500/60 hover:-translate-y-0.5'
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
                    <Icons.Folder size={10} />
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

  return (
    <div
      onDragOver={handleContainerDragOver}
      className="flex-1 app-bg-main p-6 overflow-y-auto app-text-main transition-colors"
    >
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
              Arsip galeri terstruktur. Anda dapat menggeser <span className="text-blue-400 font-semibold">(drag & drop)</span> kartu langsung ke dalam Deck folder.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onCreateDeckRequest}
              className="px-3.5 py-2 app-bg-secondary border app-border hover:border-blue-500 rounded-xl text-xs font-bold app-text-main transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            >
              <Icons.FolderPlus size={15} className="text-blue-400" />
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
          <div className="flex items-center justify-between p-3.5 rounded-2xl app-bg-secondary border border-blue-500/30 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveDeckId(null)}
                className="px-3 py-1.5 rounded-xl app-bg-main border app-border hover:border-blue-400 text-xs font-bold app-text-main flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Icons.ArrowLeft size={14} />
                <span>Kembali ke Galeri</span>
              </button>
              <div className="h-4 w-[1px] bg-slate-700" />
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: activeDeck.color || '#3b82f6' }}
                >
                  <Icons.Folder size={14} />
                </div>
                <div>
                  <h3 className="text-xs font-bold app-text-main flex items-center gap-2">
                    <span>Deck: {activeDeck.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold">
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
                className="px-2.5 py-1.5 rounded-lg app-bg-main border app-border hover:border-slate-500 text-xs font-semibold app-text-muted hover:app-text-main transition-colors flex items-center gap-1 cursor-pointer"
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
                className="px-2.5 py-1.5 rounded-lg app-bg-main border app-border hover:border-rose-500 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-1 cursor-pointer"
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

        {/* Remove Card From Deck Drop Zone Bar (Only visible when dragging a card & cursor approaches top inside a Deck) */}
        {shouldShowRemoveZone && (
          <div
            onDragOver={handleRemoveFromDeckDragOver}
            onDragLeave={handleRemoveFromDeckDragLeave}
            onDrop={handleRemoveFromDeckDrop}
            className={`w-full py-3 px-4 rounded-2xl border-2 border-dashed transition-all duration-300 flex items-center justify-center gap-2.5 select-none cursor-pointer animate-in fade-in slide-in-from-top-3 ${
              isSuccessRemove
                ? 'border-emerald-400 bg-emerald-950/40 text-emerald-300 scale-[1.01] ring-4 ring-emerald-500/40 shadow-xl'
                : isHoveredRemoveZone
                ? 'border-amber-400 bg-amber-950/50 text-amber-300 scale-[1.01] ring-4 ring-amber-500/40 shadow-xl'
                : 'border-amber-500/60 bg-amber-950/30 text-amber-300 animate-pulse'
            }`}
          >
            {isSuccessRemove ? (
              <div className="flex items-center gap-2 pointer-events-none">
                <Icons.CheckCircle2 size={18} className="text-emerald-400 animate-bounce shrink-0" />
                <span className="text-xs font-bold text-emerald-300">
                  Kartu Dikeluarkan dari Deck
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 pointer-events-none">
                <Icons.FolderOutput
                  size={18}
                  className={`shrink-0 transition-transform ${
                    isHoveredRemoveZone ? 'animate-bounce text-amber-300' : 'text-amber-400'
                  }`}
                />
                <span className="text-xs font-bold">
                  {isHoveredRemoveZone
                    ? '✨ Lepaskan untuk Mengeluarkan Kartu'
                    : '📤 Keluarkan Kartu dari Deck'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* UNIFIED GRID DISPLAY SECTION */}
        {totalItemsCount === 0 ? (
          <div className="text-center py-16 app-bg-secondary rounded-2xl border app-border app-text-muted space-y-3">
            <Icons.FileText size={36} className="mx-auto app-text-muted opacity-50" />
            <p className="text-xs">Tidak ada item atau kartu ditemukan dalam galeri ini.</p>
            <button
              type="button"
              onClick={() => onAddCard(activeDeckId || undefined)}
              className="px-3.5 py-2 app-accent-bg text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              + Buat Kartu Baru
            </button>
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
                          borderColor: assignedDeck.color || '#8b5cf6',
                          color: assignedDeck.color || '#a855f7',
                          backgroundColor: `${assignedDeck.color || '#8b5cf6'}15`,
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
