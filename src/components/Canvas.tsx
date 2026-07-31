import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { WorldCard, CardConnection, CardCategory } from '../types';
import { WorldCardNode } from './WorldCardNode';
import { getBezierPath } from '../utils/helpers';
import * as Icons from 'lucide-react';

interface CanvasProps {
  cards: WorldCard[];
  connections: CardConnection[];
  selectedCardId: string | null;
  selectedCategory: CardCategory | 'all';
  onSelectCard: (card: WorldCard | null) => void;
  onDoubleClickCard: (card: WorldCard) => void;
  onUpdateCardPosition: (id: string, x: number, y: number) => void;
  onAddConnection: (sourceId: string, targetId: string) => void;
  onEditConnection: (connection: CardConnection) => void;
  onAddCardAtPosition: (x: number, y: number) => void;
  onDeleteCardsRequest: (cardIds: string[]) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  cards,
  connections,
  selectedCardId,
  selectedCategory,
  onSelectCard,
  onDoubleClickCard,
  onUpdateCardPosition,
  onAddConnection,
  onEditConnection,
  onAddCardAtPosition,
  onDeleteCardsRequest,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Pan and Zoom State
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Spacebar Navigation State
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);

  // Box Selection State
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [isBoxSelecting, setIsBoxSelecting] = useState<boolean>(false);
  const [boxStart, setBoxStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [boxCurrent, setBoxCurrent] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Layout Options Dropdown State
  const [showLayoutMenu, setShowLayoutMenu] = useState<boolean>(false);
  const layoutMenuRef = useRef<HTMLDivElement>(null);

  // Card Dragging State
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragCardPositions, setDragCardPositions] = useState<Record<string, { x: number; y: number }>>({});

  // Connection Dragging State (creating new link)
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [connectionMousePos, setConnectionMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Close layout menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target as Node)) {
        setShowLayoutMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Spacebar Key Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(tag)) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Delete/Backspace Key Listener for Selected Cards
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA'].includes(tag)) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const targetIds = selectedCardIds.length > 0
          ? selectedCardIds
          : (selectedCardId ? [selectedCardId] : []);

        if (targetIds.length > 0) {
          e.preventDefault();
          onDeleteCardsRequest(targetIds);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCardIds, selectedCardId, onDeleteCardsRequest]);

  // Mutable refs for zoom & pan to prevent stale closure lag during rapid wheel events
  const zoomRef = useRef<number>(zoom);
  const panRef = useRef<{ x: number; y: number }>(pan);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  // Precise Cursor-Centric Focal Zoom
  const zoomAtPoint = useCallback((targetZoom: number, clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    const currentZoom = zoomRef.current;
    const currentPan = panRef.current;

    const nextZoom = Math.max(0.15, Math.min(3.0, targetZoom));
    if (nextZoom === currentZoom) return;

    // Calculate world coordinate under mouse cursor
    const worldX = (mouseX - currentPan.x) / currentZoom;
    const worldY = (mouseY - currentPan.y) / currentZoom;

    // Calculate new pan to lock world point to exact mouse screen position
    const newPanX = mouseX - worldX * nextZoom;
    const newPanY = mouseY - worldY * nextZoom;

    zoomRef.current = nextZoom;
    panRef.current = { x: newPanX, y: newPanY };

    setZoom(nextZoom);
    setPan({ x: newPanX, y: newPanY });
  }, []);

  // Zoom handlers (focus on center if triggered by button)
  const handleZoom = (delta: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    zoomAtPoint(zoomRef.current + delta, centerX, centerY);
  };

  // Center Viewport onto target cards (selected cards first, or all cards if none selected)
  const handleCenterViewport = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    const targetCards = selectedCardIds.length > 0
      ? cards.filter((c) => selectedCardIds.includes(c.id))
      : (selectedCardId ? cards.filter((c) => c.id === selectedCardId) : cards);

    if (targetCards.length === 0) {
      panRef.current = { x: 40, y: 40 };
      setPan({ x: 40, y: 40 });
      return;
    }

    const minX = Math.min(...targetCards.map((c) => c.x));
    const maxX = Math.max(...targetCards.map((c) => c.x + 288));
    const minY = Math.min(...targetCards.map((c) => c.y));
    const maxY = Math.max(...targetCards.map((c) => c.y + 160));

    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;

    const currentZoom = zoomRef.current;
    const newPanX = Math.round(rect.width / 2 - contentCenterX * currentZoom);
    const newPanY = Math.round(rect.height / 2 - contentCenterY * currentZoom);

    panRef.current = { x: newPanX, y: newPanY };
    setPan({ x: newPanX, y: newPanY });
  };

  // Convert screen coordinates to canvas world coordinates
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: (screenX - rect.left - pan.x) / zoom,
        y: (screenY - rect.top - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  // Wheel zoom (Ctrl + MouseWheel) centered at mouse cursor position
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.85;
        zoomAtPoint(zoomRef.current * factor, e.clientX, e.clientY);
      } else {
        const nextPanX = panRef.current.x - e.deltaX * 0.8;
        const nextPanY = panRef.current.y - e.deltaY * 0.8;
        panRef.current = { x: nextPanX, y: nextPanY };
        setPan({ x: nextPanX, y: nextPanY });
      }
    };

    el.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onNativeWheel);
    };
  }, [zoomAtPoint]);

  // Start Canvas Pan or Box Selection
  const handleMouseDownBackground = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).id === 'canvas-svg-bg') {
      const worldPos = screenToWorld(e.clientX, e.clientY);

      if (isSpacePressed || e.button === 1) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      } else {
        setIsBoxSelecting(true);
        setBoxStart(worldPos);
        setBoxCurrent(worldPos);
        if (!e.shiftKey) {
          onSelectCard(null);
          setSelectedCardIds([]);
        }
      }
    }
  };

  // Touch Start Background
  const handleTouchStartBackground = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && (e.target === containerRef.current || (e.target as HTMLElement).id === 'canvas-svg-bg')) {
      setIsPanning(true);
      setPanStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
      onSelectCard(null);
      setSelectedCardIds([]);
    }
  };

  // Card Mouse Down / Select
  const handleCardSelect = (card: WorldCard, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    
    if (isSpacePressed) {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      setIsPanning(true);
      setPanStart({ x: clientX - pan.x, y: clientY - pan.y });
      return;
    }

    onSelectCard(card);

    const isShift = 'shiftKey' in e && (e as React.MouseEvent).shiftKey;
    let activeIds: string[] = [];

    if (isShift) {
      activeIds = selectedCardIds.includes(card.id)
        ? selectedCardIds
        : [...selectedCardIds, card.id];
      setSelectedCardIds(activeIds);
    } else {
      if (selectedCardIds.includes(card.id) && selectedCardIds.length > 1) {
        activeIds = selectedCardIds;
      } else {
        activeIds = [card.id];
        setSelectedCardIds([card.id]);
      }
    }

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const worldPos = screenToWorld(clientX, clientY);

    setDraggingCardId(card.id);
    setDragOffset({
      x: worldPos.x - card.x,
      y: worldPos.y - card.y,
    });

    const initialPositions: Record<string, { x: number; y: number }> = {};
    cards.forEach((c) => {
      if (activeIds.includes(c.id)) {
        initialPositions[c.id] = { x: c.x, y: c.y };
      }
    });
    setDragCardPositions(initialPositions);
  };

  // Start connection drag
  const handleStartConnection = (cardId: string, e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const worldPos = screenToWorld(clientX, clientY);

    setConnectingSourceId(cardId);
    setConnectionMousePos(worldPos);
  };

  // Global Pointer Move
  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    if (isPanning) {
      setPan({
        x: clientX - panStart.x,
        y: clientY - panStart.y,
      });
      return;
    }

    if (isBoxSelecting) {
      const worldPos = screenToWorld(clientX, clientY);
      setBoxCurrent(worldPos);

      const minX = Math.min(boxStart.x, worldPos.x);
      const maxX = Math.max(boxStart.x, worldPos.x);
      const minY = Math.min(boxStart.y, worldPos.y);
      const maxY = Math.max(boxStart.y, worldPos.y);

      const matched = cards
        .filter((c) => c.x + 288 >= minX && c.x <= maxX && c.y + 160 >= minY && c.y <= maxY)
        .map((c) => c.id);

      setSelectedCardIds(matched);
      return;
    }

    if (draggingCardId) {
      const worldPos = screenToWorld(clientX, clientY);
      const primaryInitial = dragCardPositions[draggingCardId];

      if (primaryInitial) {
        const newPrimaryX = Math.round(worldPos.x - dragOffset.x);
        const newPrimaryY = Math.round(worldPos.y - dragOffset.y);
        const deltaX = newPrimaryX - primaryInitial.x;
        const deltaY = newPrimaryY - primaryInitial.y;

        Object.keys(dragCardPositions).forEach((cId) => {
          const initPos = dragCardPositions[cId];
          onUpdateCardPosition(cId, initPos.x + deltaX, initPos.y + deltaY);
        });
      } else {
        onUpdateCardPosition(
          draggingCardId,
          Math.round(worldPos.x - dragOffset.x),
          Math.round(worldPos.y - dragOffset.y)
        );
      }
      return;
    }

    if (connectingSourceId) {
      const worldPos = screenToWorld(clientX, clientY);
      setConnectionMousePos(worldPos);
    }
  };

  // Global Pointer Up
  const handlePointerUp = (e: React.MouseEvent | React.TouchEvent) => {
    if (isPanning) setIsPanning(false);
    if (isBoxSelecting) setIsBoxSelecting(false);
    if (draggingCardId) {
      setDraggingCardId(null);
      setDragCardPositions({});
    }

    if (connectingSourceId) {
      const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as React.MouseEvent).clientY;

      const elem = document.elementFromPoint(clientX, clientY);
      const cardElem = elem?.closest('[data-card-id]');
      const targetCardId = cardElem?.getAttribute('data-card-id');

      if (targetCardId && targetCardId !== connectingSourceId) {
        onAddConnection(connectingSourceId, targetCardId);
      }

      setConnectingSourceId(null);
    }
  };

  // Double click canvas background to create new card
  const handleDoubleClickBackground = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).id === 'canvas-svg-bg') {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      onAddCardAtPosition(worldPos.x, worldPos.y);
    }
  };

  // Smart Auto Layout with Mode Selection & Target Box Filtering (Requires > 1 selected cards)
  const handleAutoLayout = (mode: 'grid' | 'horizontal' | 'vertical' | 'circle' = 'grid') => {
    if (selectedCardIds.length <= 1) return;

    const targetCards = cards.filter((c) => selectedCardIds.includes(c.id));
    if (targetCards.length <= 1) return;

    const originX = Math.min(...targetCards.map((c) => c.x));
    const originY = Math.min(...targetCards.map((c) => c.y));

    if (mode === 'grid') {
      const cols = Math.ceil(Math.sqrt(targetCards.length));
      const spacingX = 420;
      const spacingY = 300;

      targetCards.forEach((card, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        onUpdateCardPosition(card.id, originX + col * spacingX, originY + row * spacingY);
      });
    } else if (mode === 'horizontal') {
      const spacingX = 420;
      targetCards.forEach((card, index) => {
        onUpdateCardPosition(card.id, originX + index * spacingX, originY);
      });
    } else if (mode === 'vertical') {
      const spacingY = 300;
      targetCards.forEach((card, index) => {
        onUpdateCardPosition(card.id, originX, originY + index * spacingY);
      });
    } else if (mode === 'circle') {
      const count = targetCards.length;
      const radius = Math.max(360, count * 85);
      const centerX = originX + radius;
      const centerY = originY + radius;

      targetCards.forEach((card, index) => {
        const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
        const x = Math.round(centerX + radius * Math.cos(angle) - 144);
        const y = Math.round(centerY + radius * Math.sin(angle) - 80);
        onUpdateCardPosition(card.id, x, y);
      });
    }
  };

  // Render SVG Connections
  const renderConnections = () => {
    return connections.map((conn) => {
      const sourceCard = cards.find((c) => c.id === conn.sourceId);
      const targetCard = cards.find((c) => c.id === conn.targetId);

      if (!sourceCard || !targetCard) return null;

      const sourceCenterX = sourceCard.x + 144;
      const sourceCenterY = sourceCard.y + 80;
      const targetCenterX = targetCard.x + 144;
      const targetCenterY = targetCard.y + 80;

      const dx = targetCenterX - sourceCenterX;
      const dy = targetCenterY - sourceCenterY;

      let x1 = sourceCenterX;
      let y1 = sourceCenterY;
      let x2 = targetCenterX;
      let y2 = targetCenterY;
      let dir: 'horizontal' | 'vertical' = 'horizontal';

      if (Math.abs(dx) >= Math.abs(dy)) {
        dir = 'horizontal';
        if (dx >= 0) {
          x1 = sourceCard.x + 288;
          y1 = sourceCenterY;
          x2 = targetCard.x;
          y2 = targetCenterY;
        } else {
          x1 = sourceCard.x;
          y1 = sourceCenterY;
          x2 = targetCard.x + 288;
          y2 = targetCenterY;
        }
      } else {
        dir = 'vertical';
        if (dy >= 0) {
          x1 = sourceCenterX;
          y1 = sourceCard.y + 160;
          x2 = targetCenterX;
          y2 = targetCard.y;
        } else {
          x1 = sourceCenterX;
          y1 = sourceCard.y;
          x2 = targetCenterX;
          y2 = targetCard.y + 160;
        }
      }

      const { path, midX, midY } = getBezierPath(x1, y1, x2, y2, dir);
      const isHighlighted =
        selectedCardId === sourceCard.id ||
        selectedCardId === targetCard.id ||
        selectedCardIds.includes(sourceCard.id) ||
        selectedCardIds.includes(targetCard.id);
      const isDimmedConn =
        selectedCategory !== 'all' &&
        sourceCard.category !== selectedCategory &&
        targetCard.category !== selectedCategory;

      return (
        <g key={conn.id} className={`group cursor-pointer transition-opacity duration-200 ${isDimmedConn ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
          <path
            d={path}
            fill="none"
            stroke="transparent"
            strokeWidth={20}
            onClick={() => onEditConnection(conn)}
          />
          <path
            d={path}
            fill="none"
            stroke={isHighlighted ? 'var(--line-stroke-highlight)' : 'var(--line-stroke)'}
            strokeWidth={isHighlighted ? 3 : 2}
            strokeDasharray={conn.type === 'enemy' ? '5,4' : 'none'}
            className="transition-colors duration-150"
            markerEnd="url(#arrowhead)"
          />
          <foreignObject
            x={midX - 55}
            y={midY - 12}
            width={110}
            height={24}
            className="overflow-visible"
          >
            <div
              onClick={() => onEditConnection(conn)}
              className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold text-center truncate border transition-transform hover:scale-105 select-none ${
                isHighlighted
                  ? 'app-bg-main app-accent-text border-purple-500 shadow-md font-bold'
                  : 'app-bg-secondary app-text-main border app-border hover:border-purple-400'
              }`}
            >
              {conn.label || 'Terhubung'}
            </div>
          </foreignObject>
        </g>
      );
    });
  };

  // Render active drag connection line
  const renderActiveDragConnection = () => {
    if (!connectingSourceId) return null;

    const sourceCard = cards.find((c) => c.id === connectingSourceId);
    if (!sourceCard) return null;

    const x1 = sourceCard.x + 144;
    const y1 = sourceCard.y + 80;
    const x2 = connectionMousePos.x;
    const y2 = connectionMousePos.y;

    const { path } = getBezierPath(x1, y1, x2, y2);

    return (
      <path
        d={path}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={3}
        strokeDasharray="6,4"
        className="animate-pulse"
      />
    );
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full app-bg-main overflow-hidden select-none transition-colors ${
        isSpacePressed ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
      }`}
      onMouseDown={handleMouseDownBackground}
      onTouchStart={handleTouchStartBackground}
      onMouseMove={handlePointerMove}
      onTouchMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onTouchEnd={handlePointerUp}
      onDoubleClick={handleDoubleClickBackground}
    >
      {/* Background Dot Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `radial-gradient(var(--grid-dot) 1px, transparent 1px)`,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      {/* World Canvas Container */}
      <div
        className="absolute inset-0 origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* SVG Overlay for Connection Lines & Box Selection */}
        <svg
          id="canvas-svg-bg"
          className="absolute inset-0 w-full h-full pointer-events-auto overflow-visible"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="var(--line-stroke)" />
            </marker>
          </defs>
          {renderConnections()}
          {renderActiveDragConnection()}

          {/* Marquee Box Selection Overlay */}
          {isBoxSelecting && (
            <rect
              x={Math.min(boxStart.x, boxCurrent.x)}
              y={Math.min(boxStart.y, boxCurrent.y)}
              width={Math.abs(boxCurrent.x - boxStart.x)}
              height={Math.abs(boxCurrent.y - boxStart.y)}
              fill="var(--accent)"
              fillOpacity={0.15}
              stroke="var(--accent)"
              strokeWidth={1.5}
              strokeDasharray="4,4"
              rx={4}
            />
          )}
        </svg>

        {/* Card Nodes */}
        {cards.map((card) => {
          const connCount = connections.filter(
            (c) => c.sourceId === card.id || c.targetId === card.id
          ).length;

          const isDimmed = selectedCategory !== 'all' && card.category !== selectedCategory;
          const isCategoryHighlighted = selectedCategory !== 'all' && card.category === selectedCategory;
          const isCardSelected = selectedCardId === card.id || selectedCardIds.includes(card.id);

          return (
            <WorldCardNode
              key={card.id}
              card={card}
              isSelected={isCardSelected}
              isConnectingSource={connectingSourceId === card.id}
              isDimmed={isDimmed}
              isCategoryHighlighted={isCategoryHighlighted}
              onSelect={handleCardSelect}
              onDoubleClick={onDoubleClickCard}
              onStartConnection={handleStartConnection}
              connectionCount={connCount}
            />
          );
        })}
      </div>

      {/* Empty State Banner */}
      {cards.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none z-20">
          <div className="app-bg-secondary border app-border p-6 md:p-8 rounded-2xl max-w-md space-y-3 shadow-2xl pointer-events-auto app-text-main">
            <div className="w-12 h-12 rounded-xl app-accent-bg/20 border border-purple-500/40 text-purple-400 flex items-center justify-center mx-auto text-lg font-bold">
              📄
            </div>
            <h3 className="text-base font-bold app-text-main">Canvas Worldbuilding Masih Kosong</h3>
            <p className="text-xs app-text-muted leading-relaxed">
              Mulailah membuat halaman kartu untuk karakter, faksi, lokasi, lore, item, atau peristiwa timeline.
            </p>
            <button
              type="button"
              onClick={() => onAddCardAtPosition(400, 300)}
              className="px-4 py-2 app-accent-bg text-white rounded-lg text-xs font-semibold shadow-md flex items-center justify-center gap-1.5 mx-auto"
            >
              <Icons.Plus size={15} />
              <span>+ Buat Kartu Pertama</span>
            </button>
          </div>
        </div>
      )}

      {/* Canvas Floating Controls */}
      <div className="absolute bottom-5 right-5 flex items-center gap-1 app-bg-secondary p-1.5 rounded-xl border app-border shadow-2xl z-50 text-xs">
        <button
          type="button"
          onClick={() => handleZoom(0.15)}
          className="p-1.5 rounded-lg app-text-muted hover:app-text-main app-bg-hover transition-colors"
          title="Zoom In (+)"
        >
          <Icons.ZoomIn size={16} />
        </button>
        <button
          type="button"
          onClick={() => handleZoom(-0.15)}
          className="p-1.5 rounded-lg app-text-muted hover:app-text-main app-bg-hover transition-colors"
          title="Zoom Out (-)"
        >
          <Icons.ZoomOut size={16} />
        </button>
        <span className="text-[11px] font-mono app-accent-text px-1.5 min-w-[44px] text-center font-medium">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={handleCenterViewport}
          className="p-1.5 rounded-lg app-text-muted hover:app-text-main app-bg-hover transition-colors flex items-center gap-1 text-xs font-medium px-2"
          title={
            selectedCardIds.length > 0 || selectedCardId
              ? 'Tengahkan Viewport ke Kartu Terpilih'
              : 'Tengahkan Viewport ke Seluruh Kartu Workspace'
          }
        >
          <Icons.Focus size={15} className="app-accent-text" />
          <span className="hidden sm:inline">Tengahkan</span>
        </button>

        {/* Hand Pan Navigasi Button */}
        <button
          type="button"
          onClick={() => setIsSpacePressed(!isSpacePressed)}
          className={`p-1.5 rounded-lg transition-all flex items-center gap-1 text-xs font-medium px-2 ${
            isSpacePressed
              ? 'app-accent-bg text-white shadow-md scale-105 ring-2 ring-purple-400/40 font-semibold'
              : 'app-text-muted hover:app-text-main app-bg-hover'
          }`}
          title="Mode Navigasi Pan (Tahan Spasi + Drag Mouse)"
        >
          <Icons.Hand size={15} className={isSpacePressed ? 'animate-pulse' : ''} />
          <span className="hidden sm:inline">Navigasi</span>
        </button>

        <div className="w-[1px] h-4 bg-[#444] opacity-30 my-auto mx-1" />

        {/* Layout Options Dropdown Menu (Disabled if <= 1 card selected) */}
        <div className="relative" ref={layoutMenuRef}>
          <button
            type="button"
            disabled={selectedCardIds.length <= 1}
            onClick={() => selectedCardIds.length > 1 && setShowLayoutMenu(!showLayoutMenu)}
            className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium px-2 ${
              selectedCardIds.length > 1
                ? 'app-accent-text app-bg-hover cursor-pointer'
                : 'app-text-muted opacity-40 cursor-not-allowed'
            }`}
            title={
              selectedCardIds.length > 1
                ? `Rapikan ${selectedCardIds.length} Kartu Terpilih`
                : 'Pilih minimal 2 kartu (menggunakan Box Selection) untuk mengaktifkan fitur Rapikan'
            }
          >
            <Icons.LayoutGrid size={15} />
            <span className="hidden sm:inline">Rapikan</span>
            {selectedCardIds.length > 1 && (
              <span className="bg-purple-500/20 text-purple-400 text-[10px] font-mono px-1 rounded font-bold">
                {selectedCardIds.length}
              </span>
            )}
            <Icons.ChevronDown size={12} className={`transition-transform ${showLayoutMenu ? 'rotate-180' : ''}`} />
          </button>

          {showLayoutMenu && selectedCardIds.length > 1 && (
            <div className="absolute right-0 bottom-full mb-2 w-52 app-bg-secondary border app-border rounded-xl shadow-2xl p-1.5 z-50 text-xs app-text-main space-y-1 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2.5 py-1 text-[10px] app-text-muted font-medium border-b app-border flex items-center justify-between">
                <span>Target Rapikan:</span>
                <span className="app-accent-text font-bold">
                  {selectedCardIds.length} Kartu Terpilih
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  handleAutoLayout('grid');
                  setShowLayoutMenu(false);
                }}
                className="w-full px-2.5 py-1.5 text-left hover:app-bg-hover rounded-lg flex items-center gap-2 transition-colors font-medium"
              >
                <Icons.Grid size={14} className="app-accent-text" />
                <span>🔲 Matriks Grid (2D)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleAutoLayout('horizontal');
                  setShowLayoutMenu(false);
                }}
                className="w-full px-2.5 py-1.5 text-left hover:app-bg-hover rounded-lg flex items-center gap-2 transition-colors font-medium"
              >
                <Icons.ArrowRight size={14} className="app-accent-text" />
                <span>➡️ Baris Horisontal</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleAutoLayout('vertical');
                  setShowLayoutMenu(false);
                }}
                className="w-full px-2.5 py-1.5 text-left hover:app-bg-hover rounded-lg flex items-center gap-2 transition-colors font-medium"
              >
                <Icons.ArrowDown size={14} className="app-accent-text" />
                <span>⬇️ Kolom Vertikal</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleAutoLayout('circle');
                  setShowLayoutMenu(false);
                }}
                className="w-full px-2.5 py-1.5 text-left hover:app-bg-hover rounded-lg flex items-center gap-2 transition-colors font-medium"
              >
                <Icons.Circle size={14} className="app-accent-text" />
                <span>⭕ Lingkaran (Radial)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
