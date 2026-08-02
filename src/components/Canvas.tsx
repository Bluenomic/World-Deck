import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { WorldCard, WorldDeck, CardConnection, CardCategory } from '../types';
import { WorldCardNode } from './WorldCardNode';
import { AddCardFromGalleryModal } from './AddCardFromGalleryModal';
import { getBezierPath } from '../utils/helpers';
import { loadCanvasViewport, saveCanvasViewport } from '../utils/storage';
import * as Icons from 'lucide-react';

interface CanvasProps {
  cards: WorldCard[];
  allWorldCards?: WorldCard[];
  allWorldDecks?: WorldDeck[];
  connections: CardConnection[];
  selectedCardId: string | null;
  selectedCategory: CardCategory | 'all';
  activeCanvasId?: string;
  onSelectCard: (card: WorldCard | null) => void;
  onDoubleClickCard: (card: WorldCard) => void;
  onUpdateCardPosition: (id: string, x: number, y: number) => void;
  onAddConnection: (sourceId: string, targetId: string) => void;
  onEditConnection: (connection: CardConnection) => void;
  onAddCardAtPosition: (x: number, y: number) => void;
  onAddCardsToCanvasAtPosition?: (cardIds: string[], position: { x: number; y: number }) => void;
  onRemoveCardsFromCanvas?: (cardIds: string[]) => void;
  onDeleteCardsRequest: (cardIds: string[]) => void;
  onDeleteConnection?: (id: string) => void;
  onDeleteConnections?: (ids: string[]) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  cards,
  allWorldCards = [],
  allWorldDecks = [],
  connections,
  selectedCardId,
  selectedCategory,
  activeCanvasId,
  onSelectCard,
  onDoubleClickCard,
  onUpdateCardPosition,
  onAddConnection,
  onEditConnection,
  onAddCardAtPosition,
  onAddCardsToCanvasAtPosition,
  onRemoveCardsFromCanvas,
  onDeleteCardsRequest,
  onDeleteConnection,
  onDeleteConnections,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetCanvasId = activeCanvasId || 'default';
  
  // Pan and Zoom State (initialized from saved preferences)
  const [zoom, setZoom] = useState<number>(() => loadCanvasViewport(targetCanvasId).zoom);
  const [pan, setPan] = useState<{ x: number; y: number }>(() => loadCanvasViewport(targetCanvasId).pan);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Restore saved viewport when activeCanvasId changes
  useEffect(() => {
    const saved = loadCanvasViewport(targetCanvasId);
    setZoom(saved.zoom);
    setPan(saved.pan);
    zoomRef.current = saved.zoom;
    panRef.current = saved.pan;
  }, [targetCanvasId]);

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

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    canvasX: number;
    canvasY: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
    canvasX: 0,
    canvasY: 0,
  });

  // Add Card From Gallery Modal State
  const [showAddFromGalleryModal, setShowAddFromGalleryModal] = useState<boolean>(false);
  const [galleryTargetPos, setGalleryTargetPos] = useState<{ x: number; y: number }>({ x: 300, y: 300 });

  // Card Dragging State
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragCardPositions, setDragCardPositions] = useState<Record<string, { x: number; y: number }>>({});

  // Selected Connection IDs for Multi-Selection & Deletion
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([]);

  // Connection Dragging State (creating new link)
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [connectionMousePos, setConnectionMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Close layout menu and context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target as Node)) {
        setShowLayoutMenu(false);
      }
    };
    
    const handleCloseContextMenu = () => {
      if (contextMenu.visible) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('click', handleCloseContextMenu);
    document.addEventListener('contextmenu', handleCloseContextMenu);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('click', handleCloseContextMenu);
      document.removeEventListener('contextmenu', handleCloseContextMenu);
    };
  }, [contextMenu.visible]);

  const handleContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.world-card-node') || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const screenX = e.clientX;
    const screenY = e.clientY;
    const canvasX = (screenX - rect.left - pan.x) / zoom;
    const canvasY = (screenY - rect.top - pan.y) / zoom;
    
    setContextMenu({
      visible: true,
      x: screenX,
      y: screenY,
      canvasX,
      canvasY,
    });
  };

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

  // Delete/Backspace Key Listener for Selected Cards & Selected Connections
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA'].includes(tag)) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedConnectionIds.length > 0) {
          e.preventDefault();
          if (onDeleteConnections) {
            onDeleteConnections(selectedConnectionIds);
          } else if (onDeleteConnection) {
            selectedConnectionIds.forEach((id) => onDeleteConnection(id));
          }
          setSelectedConnectionIds([]);
          return;
        }

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
  }, [selectedCardIds, selectedCardId, selectedConnectionIds, onDeleteCardsRequest, onDeleteConnection, onDeleteConnections]);

  // Mutable refs for zoom & pan to prevent stale closure lag during rapid wheel events
  const zoomRef = useRef<number>(zoom);
  const panRef = useRef<{ x: number; y: number }>(pan);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  // Auto-save viewport preferences when zoom or pan changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveCanvasViewport(targetCanvasId, { zoom, pan });
    }, 250);

    return () => clearTimeout(timer);
  }, [zoom, pan, targetCanvasId]);

  // Ensure latest viewport is saved before tab unload or component unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveCanvasViewport(targetCanvasId, { zoom: zoomRef.current, pan: panRef.current });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      saveCanvasViewport(targetCanvasId, { zoom: zoomRef.current, pan: panRef.current });
    };
  }, [targetCanvasId]);

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

  // Track measured DOM heights for precise connection line anchoring
  const cardHeightsRef = useRef<Map<string, number>>(new Map());

  // Render SVG Connections
  const renderConnections = () => {
    return connections.map((conn) => {
      const sourceCard = cards.find((c) => c.id === conn.sourceId);
      const targetCard = cards.find((c) => c.id === conn.targetId);

      if (!sourceCard || !targetCard) return null;

      const cardW = 288;
      const sourceH = cardHeightsRef.current.get(sourceCard.id) || 180;
      const targetH = cardHeightsRef.current.get(targetCard.id) || 180;

      const sourceCenterX = sourceCard.x + cardW / 2;
      const sourceCenterY = sourceCard.y + sourceH / 2;
      const targetCenterX = targetCard.x + cardW / 2;
      const targetCenterY = targetCard.y + targetH / 2;

      const dx = targetCenterX - sourceCenterX;
      const dy = targetCenterY - sourceCenterY;

      const arrowLen = 9; // distance of arrowhead
      const dirMode = conn.direction || 'directed';
      const isSelectedConn = selectedConnectionIds.includes(conn.id);

      let x1 = sourceCenterX;
      let y1 = sourceCenterY;
      let x2 = targetCenterX;
      let y2 = targetCenterY;
      let dir: 'horizontal' | 'vertical' = 'horizontal';

      if (Math.abs(dx) >= Math.abs(dy)) {
        dir = 'horizontal';
        if (dx >= 0) {
          // Source -> Target (Left to Right)
          const sourceEdgeX = sourceCard.x + cardW + 2;
          const sourceEdgeY = Math.min(Math.max(targetCenterY, sourceCard.y + 24), sourceCard.y + sourceH - 24);

          const targetEdgeX = targetCard.x - 2;
          const targetEdgeY = Math.min(Math.max(sourceCenterY, targetCard.y + 24), targetCard.y + targetH - 24);

          x1 = dirMode === 'bidirectional' ? sourceEdgeX + arrowLen : sourceEdgeX;
          y1 = sourceEdgeY;
          x2 = targetEdgeX - arrowLen;
          y2 = targetEdgeY;
        } else {
          // Source -> Target (Right to Left)
          const sourceEdgeX = sourceCard.x - 2;
          const sourceEdgeY = Math.min(Math.max(targetCenterY, sourceCard.y + 24), sourceCard.y + sourceH - 24);

          const targetEdgeX = targetCard.x + cardW + 2;
          const targetEdgeY = Math.min(Math.max(sourceCenterY, targetCard.y + 24), targetCard.y + targetH - 24);

          x1 = dirMode === 'bidirectional' ? sourceEdgeX - arrowLen : sourceEdgeX;
          y1 = sourceEdgeY;
          x2 = targetEdgeX + arrowLen;
          y2 = targetEdgeY;
        }
      } else {
        dir = 'vertical';
        if (dy >= 0) {
          // Source -> Target (Top to Bottom)
          const sourceEdgeX = Math.min(Math.max(targetCenterX, sourceCard.x + 24), sourceCard.x + cardW - 24);
          const sourceEdgeY = sourceCard.y + sourceH + 2;

          const targetEdgeX = Math.min(Math.max(sourceCenterX, targetCard.x + 24), targetCard.x + cardW - 24);
          const targetEdgeY = targetCard.y - 2;

          x1 = sourceEdgeX;
          y1 = dirMode === 'bidirectional' ? sourceEdgeY + arrowLen : sourceEdgeY;
          x2 = targetEdgeX;
          y2 = targetEdgeY - arrowLen;
        } else {
          // Source -> Target (Bottom to Top)
          const sourceEdgeX = Math.min(Math.max(targetCenterX, sourceCard.x + 24), sourceCard.x + cardW - 24);
          const sourceEdgeY = sourceCard.y - 2;

          const targetEdgeX = Math.min(Math.max(sourceCenterX, targetCard.x + 24), targetCard.x + cardW - 24);
          const targetEdgeY = targetCard.y + targetH + 2;

          x1 = sourceEdgeX;
          y1 = dirMode === 'bidirectional' ? sourceEdgeY - arrowLen : sourceEdgeY;
          x2 = targetEdgeX;
          y2 = targetEdgeY + arrowLen;
        }
      }

      const { path, midX, midY } = getBezierPath(x1, y1, x2, y2, dir);
      const isDimmedConn =
        selectedCategory !== 'all' &&
        sourceCard.category !== selectedCategory &&
        targetCard.category !== selectedCategory;

      let markerEnd: string | undefined = undefined;
      let markerStart: string | undefined = undefined;

      if (dirMode === 'directed') {
        markerEnd = isSelectedConn ? 'url(#arrowhead-end-selected)' : 'url(#arrowhead-end)';
      } else if (dirMode === 'bidirectional') {
        markerEnd = isSelectedConn ? 'url(#arrowhead-end-selected)' : 'url(#arrowhead-end)';
        markerStart = isSelectedConn ? 'url(#arrowhead-start-selected)' : 'url(#arrowhead-start)';
      } else if (dirMode === 'undirected') {
        markerEnd = undefined;
        markerStart = undefined;
      }

      const handleConnClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          setSelectedConnectionIds((prev) =>
            prev.includes(conn.id)
              ? prev.filter((id) => id !== conn.id)
              : [...prev, conn.id]
          );
        } else {
          setSelectedConnectionIds([conn.id]);
          onSelectCard(null);
        }
      };

      const handleConnDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onEditConnection(conn);
      };

      return (
        <g key={conn.id} className={`group cursor-pointer transition-opacity duration-200 ${isDimmedConn ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
          <path
            d={path}
            fill="none"
            stroke="transparent"
            strokeWidth={20}
            onClick={handleConnClick}
            onDoubleClick={handleConnDoubleClick}
          />
          <path
            d={path}
            fill="none"
            stroke={isSelectedConn ? 'var(--line-stroke-highlight)' : 'var(--line-stroke)'}
            strokeWidth={isSelectedConn ? 3 : 2}
            strokeDasharray={conn.type === 'enemy' ? '5,4' : 'none'}
            className="transition-colors duration-150"
            markerEnd={markerEnd}
            markerStart={markerStart}
          />
          <foreignObject
            x={midX - 55}
            y={midY - 12}
            width={110}
            height={24}
            className="overflow-visible"
          >
            <div
              onClick={handleConnClick}
              onDoubleClick={handleConnDoubleClick}
              className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold text-center truncate border transition-all hover:scale-105 select-none cursor-pointer ${
                isSelectedConn
                  ? 'app-bg-main app-accent-text border-blue-500 shadow-md font-bold ring-2 ring-blue-500/40 scale-105'
                  : 'app-bg-secondary app-text-main border app-border hover:border-blue-400'
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

    const sourceH = cardHeightsRef.current.get(sourceCard.id) || 180;
    const x1 = sourceCard.x + 144;
    const y1 = sourceCard.y + sourceH / 2;
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
      onContextMenu={handleContextMenu}
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
              id="arrowhead-end"
              markerWidth="9"
              markerHeight="9"
              refX="0"
              refY="4.5"
              orient="auto"
            >
              <path d="M 0 1 L 8.5 4.5 L 0 8 z" fill="var(--line-stroke)" />
            </marker>
            <marker
              id="arrowhead-end-selected"
              markerWidth="9"
              markerHeight="9"
              refX="0"
              refY="4.5"
              orient="auto"
            >
              <path d="M 0 1 L 8.5 4.5 L 0 8 z" fill="var(--line-stroke-highlight)" />
            </marker>
            <marker
              id="arrowhead-start"
              markerWidth="9"
              markerHeight="9"
              refX="0"
              refY="4.5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8.5 4.5 L 0 8 z" fill="var(--line-stroke)" />
            </marker>
            <marker
              id="arrowhead-start-selected"
              markerWidth="9"
              markerHeight="9"
              refX="0"
              refY="4.5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8.5 4.5 L 0 8 z" fill="var(--line-stroke-highlight)" />
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
              onMeasureHeight={(id, h) => cardHeightsRef.current.set(id, h)}
            />
          );
        })}
      </div>

      {/* Empty State Banner */}
      {cards.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none z-20">
          <div className="app-bg-secondary border app-border p-6 md:p-8 rounded-2xl max-w-md space-y-3 shadow-2xl pointer-events-auto app-text-main">
            <div className="w-12 h-12 rounded-xl app-accent-bg/20 border border-blue-500/40 text-blue-400 flex items-center justify-center mx-auto text-lg font-bold">
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
              ? 'app-accent-bg text-white shadow-md scale-105 ring-2 ring-blue-400/40 font-semibold'
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
              <span className="bg-blue-500/20 text-blue-400 text-[10px] font-mono px-1 rounded font-bold">
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

      {contextMenu.visible && (
        <div
          className="fixed app-bg-secondary border app-border rounded-xl shadow-2xl py-1.5 w-48 z-[100] text-xs app-text-main animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-800"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[10px] app-text-muted font-semibold uppercase tracking-wider select-none">
            Aksi Canvas
          </div>
          
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                onAddCardAtPosition(contextMenu.canvasX, contextMenu.canvasY);
                setContextMenu((prev) => ({ ...prev, visible: false }));
              }}
              className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold text-emerald-400 cursor-pointer"
            >
              <Icons.Plus size={14} strokeWidth={2.5} />
              <span>Tambah Kartu Baru</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setGalleryTargetPos({ x: contextMenu.canvasX, y: contextMenu.canvasY });
                setShowAddFromGalleryModal(true);
                setContextMenu((prev) => ({ ...prev, visible: false }));
              }}
              className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold text-blue-400 cursor-pointer"
            >
              <Icons.FolderPlus size={14} strokeWidth={2.5} />
              <span>Tambah Kartu dari Galeri</span>
            </button>
          </div>

          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                handleCenterViewport();
                setContextMenu((prev) => ({ ...prev, visible: false }));
              }}
              className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Icons.Focus size={14} className="app-text-muted" />
              <span>Tengahkan Layar</span>
            </button>
            
            <button
              type="button"
              onClick={() => {
                setIsSpacePressed(!isSpacePressed);
                setContextMenu((prev) => ({ ...prev, visible: false }));
              }}
              className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Icons.Hand size={14} className="app-text-muted" />
              <span>{isSpacePressed ? 'Matikan Mode Pan' : 'Aktifkan Mode Pan'}</span>
            </button>
          </div>

          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                const targetIds = selectedCardIds.length > 0 ? selectedCardIds : selectedCardId ? [selectedCardId] : [];
                if (targetIds.length > 0 && onRemoveCardsFromCanvas) {
                  onRemoveCardsFromCanvas(targetIds);
                  setSelectedCardIds([]);
                }
                setContextMenu((prev) => ({ ...prev, visible: false }));
              }}
              className={`w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors ${
                selectedCardIds.length > 0 || selectedCardId
                  ? 'text-amber-400 font-medium cursor-pointer'
                  : 'app-text-muted cursor-not-allowed opacity-50'
              }`}
              disabled={selectedCardIds.length === 0 && !selectedCardId}
            >
              <Icons.MinusCircle size={14} />
              <span>Lepas dari Kanvas</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (selectedCardIds.length > 0) {
                  onDeleteCardsRequest(selectedCardIds);
                  setSelectedCardIds([]);
                } else if (selectedCardId) {
                  onDeleteCardsRequest([selectedCardId]);
                }
                setContextMenu((prev) => ({ ...prev, visible: false }));
              }}
              className={`w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors ${
                selectedCardIds.length > 0 || selectedCardId
                  ? 'text-rose-500 font-medium cursor-pointer'
                  : 'app-text-muted cursor-not-allowed opacity-50'
              }`}
              disabled={selectedCardIds.length === 0 && !selectedCardId}
            >
              <Icons.Trash2 size={14} />
              <span>Hapus Kartu Permanen</span>
            </button>
          </div>
        </div>
      )}

      <AddCardFromGalleryModal
        isOpen={showAddFromGalleryModal}
        onClose={() => setShowAddFromGalleryModal(false)}
        allCards={allWorldCards}
        allDecks={allWorldDecks}
        activeCanvasId={targetCanvasId}
        targetPosition={galleryTargetPos}
        onAddCardsToCanvas={(cardIds, pos) => {
          if (onAddCardsToCanvasAtPosition) {
            onAddCardsToCanvasAtPosition(cardIds, pos);
          }
        }}
      />
    </div>
  );
};
