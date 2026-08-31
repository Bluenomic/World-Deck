import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { WorldCard, WorldDeck, CardConnection, CardCategory } from '../types';
import { WorldCardNode } from './WorldCardNode';
import { AddCardFromGalleryModal } from './AddCardFromGalleryModal';
import { getBezierPath } from '../utils/helpers';
import { loadCanvasViewport, saveCanvasViewport } from '../utils/storage';
import { useLanguage } from '../i18n/LanguageContext';
import * as Icons from 'lucide-react';

interface CanvasProps {
  cards: WorldCard[];
  allWorldCards?: WorldCard[];
  allWorldDecks?: WorldDeck[];
  connections: CardConnection[];
  selectedCardId: string | null;
  selectedCategory: CardCategory | 'all';
  searchQuery?: string;
  activeCanvasId?: string;
  onSelectCard: (card: WorldCard | null) => void;
  onDoubleClickCard: (card: WorldCard) => void;
  onEditCardRequest?: (card: WorldCard) => void;
  onOpenCardFullPageRequest?: (card: WorldCard) => void;
  onUpdateCardPosition: (id: string, x: number, y: number) => void;
  onUpdateCardPositionsBatch?: (updates: { id: string; x: number; y: number }[]) => void;
  onAddConnection: (sourceId: string, targetId: string) => void;
  onEditConnection: (connection: CardConnection) => void;
  onAddCardAtPosition: (x: number, y: number, initialData?: Partial<WorldCard>) => void;
  onAddCardsToCanvasAtPosition?: (cardIds: string[], position: { x: number; y: number }) => void;
  onRemoveCardsFromCanvas?: (cardIds: string[]) => void;
  onDeleteCardsRequest: (cardIds: string[]) => void;
  onDeleteConnection?: (id: string) => void;
  onDeleteConnections?: (ids: string[]) => void;
  onUpdateCardDimensions?: (id: string, width: number, height: number) => void;
  onUpdateCardImageHeight?: (id: string, imageHeight: number) => void;
  onAdjustImageFocalPointRequest?: (card: WorldCard) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  cards,
  allWorldCards = [],
  allWorldDecks = [],
  connections,
  selectedCardId,
  selectedCategory,
  searchQuery = '',
  activeCanvasId,
  onSelectCard,
  onDoubleClickCard,
  onEditCardRequest,
  onOpenCardFullPageRequest,
  onUpdateCardPosition,
  onUpdateCardPositionsBatch,
  onAddConnection,
  onEditConnection,
  onAddCardAtPosition,
  onAddCardsToCanvasAtPosition,
  onRemoveCardsFromCanvas,
  onDeleteCardsRequest,
  onDeleteConnection,
  onDeleteConnections,
  onUpdateCardDimensions,
  onUpdateCardImageHeight,
  onAdjustImageFocalPointRequest,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  const { language, t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const targetCanvasId = activeCanvasId || 'default';
  
  // Pan and Zoom State (initialized from saved preferences)
  const [zoom, setZoom] = useState<number>(() => loadCanvasViewport(targetCanvasId).zoom);
  const [pan, setPan] = useState<{ x: number; y: number }>(() => loadCanvasViewport(targetCanvasId).pan);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Mutable refs for zoom & pan to prevent stale closure lag during rapid wheel events
  const zoomRef = useRef<number>(zoom);
  const panRef = useRef<{ x: number; y: number }>(pan);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  // Animation frame refs for smooth Google Maps style zoom & inertia scroll
  const animFrameRef = useRef<number | null>(null);
  const wheelRafRef = useRef<number | null>(null);

  // Restore saved viewport when activeCanvasId changes
  useEffect(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (wheelRafRef.current) {
      cancelAnimationFrame(wheelRafRef.current);
      wheelRafRef.current = null;
    }
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

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    canvasX: number;
    canvasY: number;
    targetCardId?: string | null;
    isNearRight?: boolean;
    isNearBottom?: boolean;
  }>({
    visible: false,
    x: 0,
    y: 0,
    canvasX: 0,
    canvasY: 0,
    targetCardId: null,
    isNearRight: false,
    isNearBottom: false,
  });

  // Add Card From Gallery Modal State
  const [showAddFromGalleryModal, setShowAddFromGalleryModal] = useState<boolean>(false);
  const [galleryTargetPos, setGalleryTargetPos] = useState<{ x: number; y: number }>({ x: 300, y: 300 });

  // Dragging State
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragCardPositions, setDragCardPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [localDragPositions, setLocalDragPositions] = useState<Record<string, { x: number; y: number }>>({});

  // Selected Connection IDs for Multi-Selection & Deletion
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([]);

  // Connection Dragging State (creating new link)
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [connectionMousePos, setConnectionMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Close context menu when clicking outside
  useEffect(() => {
    const handleCloseContextMenu = () => {
      if (contextMenu.visible) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };

    document.addEventListener('click', handleCloseContextMenu);
    document.addEventListener('contextmenu', handleCloseContextMenu);
    
    return () => {
      document.removeEventListener('click', handleCloseContextMenu);
      document.removeEventListener('contextmenu', handleCloseContextMenu);
    };
  }, [contextMenu.visible]);

  const handleContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
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
    
    const cardElem = target.closest('[data-card-id]');
    const targetCardId = cardElem?.getAttribute('data-card-id') || null;

    if (targetCardId) {
      const card = cards.find((c) => c.id === targetCardId);
      if (card) {
        if (!selectedCardIds.includes(card.id)) {
          onSelectCard(card);
          setSelectedCardIds([]);
        }
      }
    }

    const isNearRight = e.clientX > window.innerWidth - 240;
    const isNearBottom = e.clientY > window.innerHeight - 220;

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      canvasX,
      canvasY,
      targetCardId,
      isNearRight,
      isNearBottom,
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

  // Close context menu on window scroll or canvas zoom/pan wheel
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

  // Smooth animate to target zoom and target pan (ease-out cubic / exponential smoothing like Google Maps)
  const animateTo = useCallback((targetZoom: number, targetPan: { x: number; y: number }, durationMs: number = 220) => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (wheelRafRef.current) {
      cancelAnimationFrame(wheelRafRef.current);
      wheelRafRef.current = null;
    }

    const startZoom = zoomRef.current;
    const startPanX = panRef.current.x;
    const startPanY = panRef.current.y;
    const startTime = performance.now();

    // Ease-out cubic function: fast onset, buttery-soft deceleration landing
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, Math.max(0, elapsed / durationMs));
      const ease = easeOutCubic(progress);

      const currentZ = startZoom + (targetZoom - startZoom) * ease;
      const currentPx = startPanX + (targetPan.x - startPanX) * ease;
      const currentPy = startPanY + (targetPan.y - startPanY) * ease;

      zoomRef.current = currentZ;
      panRef.current = { x: currentPx, y: currentPy };
      setZoom(currentZ);
      setPan({ x: currentPx, y: currentPy });

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
  }, []);

  // Precise Cursor-Centric Focal Zoom
  const zoomAtPoint = useCallback((targetZoom: number, clientX: number, clientY: number, smooth: boolean = false) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    const currentZoom = zoomRef.current;
    const currentPan = panRef.current;

    const nextZoom = Math.max(0.15, Math.min(3.0, targetZoom));
    if (Math.abs(nextZoom - currentZoom) < 0.0001) return;

    // Calculate world coordinate under mouse cursor
    const worldX = (mouseX - currentPan.x) / currentZoom;
    const worldY = (mouseY - currentPan.y) / currentZoom;

    // Calculate new pan to lock world point to exact mouse screen position
    const newPanX = mouseX - worldX * nextZoom;
    const newPanY = mouseY - worldY * nextZoom;

    if (smooth) {
      animateTo(nextZoom, { x: newPanX, y: newPanY }, 240);
    } else {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      zoomRef.current = nextZoom;
      panRef.current = { x: newPanX, y: newPanY };
      setZoom(nextZoom);
      setPan({ x: newPanX, y: newPanY });
    }
  }, [animateTo]);

  // Zoom handlers (focus on center if triggered by button)
  const handleZoom = (delta: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    zoomAtPoint(zoomRef.current + delta, centerX, centerY, true);
  };

  // Center Viewport onto target cards (selected cards first, or all cards if none selected)
  const handleCenterViewport = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    const targetCards = selectedCardIds.length > 0
      ? cards.filter((c) => selectedCardIds.includes(c.id))
      : (selectedCardId ? cards.filter((c) => c.id === selectedCardId) : cards);

    if (targetCards.length === 0) {
      animateTo(zoomRef.current, { x: 40, y: 40 }, 260);
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

    animateTo(currentZoom, { x: newPanX, y: newPanY }, 260);
  };

  // Fit View onto all cards on canvas
  const handleFitAllCardsView = () => {
    if (cards.length === 0 || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    const minX = Math.min(...cards.map((c) => c.x));
    const maxX = Math.max(...cards.map((c) => c.x + 280));
    const minY = Math.min(...cards.map((c) => c.y));
    const maxY = Math.max(...cards.map((c) => c.y + 180));

    const contentWidth = maxX - minX + 120;
    const contentHeight = maxY - minY + 120;

    const targetZoom = Math.max(0.3, Math.min(1.2, Math.min(rect.width / contentWidth, rect.height / contentHeight)));
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;

    const newPanX = Math.round(rect.width / 2 - contentCenterX * targetZoom);
    const newPanY = Math.round(rect.height / 2 - contentCenterY * targetZoom);

    animateTo(targetZoom, { x: newPanX, y: newPanY }, 280);
  };

  // Reset Zoom scale to 100%
  const handleResetZoom100 = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    zoomAtPoint(1.0, centerX, centerY, true);
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

  // Wheel zoom (Ctrl + Wheel) & Smooth 2D Scroll navigation (Horizontal & Vertical with inertia damping)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let targetZoomLevel = zoomRef.current;
    let targetPanX = panRef.current.x;
    let targetPanY = panRef.current.y;
    let lastClientX = 0;
    let lastClientY = 0;
    let isZoomingMode = false;

    const updateSmoothWheel = () => {
      if (isZoomingMode) {
        const current = zoomRef.current;
        const diff = targetZoomLevel - current;

        if (Math.abs(diff) > 0.001) {
          const nextStepZoom = current + diff * 0.22;
          zoomAtPoint(nextStepZoom, lastClientX, lastClientY, false);
          wheelRafRef.current = requestAnimationFrame(updateSmoothWheel);
        } else {
          zoomAtPoint(targetZoomLevel, lastClientX, lastClientY, false);
          wheelRafRef.current = null;
        }
      } else {
        // Smooth scroll damping (vertical & horizontal pan)
        const currentPanX = panRef.current.x;
        const currentPanY = panRef.current.y;
        const diffX = targetPanX - currentPanX;
        const diffY = targetPanY - currentPanY;

        if (Math.abs(diffX) > 0.4 || Math.abs(diffY) > 0.4) {
          const nextPx = currentPanX + diffX * 0.22;
          const nextPy = currentPanY + diffY * 0.22;
          panRef.current = { x: nextPx, y: nextPy };
          setPan({ x: nextPx, y: nextPy });
          wheelRafRef.current = requestAnimationFrame(updateSmoothWheel);
        } else {
          panRef.current = { x: targetPanX, y: targetPanY };
          setPan({ x: targetPanX, y: targetPanY });
          wheelRafRef.current = null;
        }
      }
    };

    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      if (e.ctrlKey || e.metaKey) {
        // Smooth Zoom mode
        if (!isZoomingMode && wheelRafRef.current) {
          cancelAnimationFrame(wheelRafRef.current);
          wheelRafRef.current = null;
        }
        isZoomingMode = true;
        lastClientX = e.clientX;
        lastClientY = e.clientY;

        if (wheelRafRef.current === null) {
          targetZoomLevel = zoomRef.current;
        }

        const delta = Math.max(-100, Math.min(100, e.deltaY));
        const factor = Math.exp(-delta * 0.0016);
        targetZoomLevel = Math.max(0.15, Math.min(3.0, targetZoomLevel * factor));

        if (!wheelRafRef.current) {
          wheelRafRef.current = requestAnimationFrame(updateSmoothWheel);
        }
      } else if (e.shiftKey) {
        // Shift + Wheel = Smooth horizontal pan
        if (isZoomingMode && wheelRafRef.current) {
          cancelAnimationFrame(wheelRafRef.current);
          wheelRafRef.current = null;
        }
        isZoomingMode = false;

        if (wheelRafRef.current === null) {
          targetPanX = panRef.current.x;
          targetPanY = panRef.current.y;
        }

        const scrollDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        const clampedDelta = Math.max(-200, Math.min(200, scrollDelta));
        targetPanX -= clampedDelta * 0.9;

        if (!wheelRafRef.current) {
          wheelRafRef.current = requestAnimationFrame(updateSmoothWheel);
        }
      } else {
        // Standard Wheel = Smooth 2D pan (vertical deltaY & horizontal deltaX)
        if (isZoomingMode && wheelRafRef.current) {
          cancelAnimationFrame(wheelRafRef.current);
          wheelRafRef.current = null;
        }
        isZoomingMode = false;

        if (wheelRafRef.current === null) {
          targetPanX = panRef.current.x;
          targetPanY = panRef.current.y;
        }

        const clampedDeltaX = Math.max(-200, Math.min(200, e.deltaX));
        const clampedDeltaY = Math.max(-200, Math.min(200, e.deltaY));

        targetPanX -= clampedDeltaX * 0.9;
        targetPanY -= clampedDeltaY * 0.9;

        if (!wheelRafRef.current) {
          wheelRafRef.current = requestAnimationFrame(updateSmoothWheel);
        }
      }
    };

    el.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onNativeWheel);
      if (wheelRafRef.current) {
        cancelAnimationFrame(wheelRafRef.current);
        wheelRafRef.current = null;
      }
    };
  }, [zoomAtPoint]);

  // Start Canvas Pan or Box Selection
  const handleMouseDownBackground = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).id === 'canvas-svg-bg') {
      const worldPos = screenToWorld(e.clientX, e.clientY);

      if (isSpacePressed || e.button === 1) {
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        if (wheelRafRef.current) {
          cancelAnimationFrame(wheelRafRef.current);
          wheelRafRef.current = null;
        }
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      } else {
        setIsBoxSelecting(true);
        setBoxStart(worldPos);
        setBoxCurrent(worldPos);
        if (!e.shiftKey) {
          onSelectCard(null);
          setSelectedCardIds([]);
          setSelectedConnectionIds([]);
        }
      }
    }
  };

  // Touch Start Background
  const handleTouchStartBackground = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && (e.target === containerRef.current || (e.target as HTMLElement).id === 'canvas-svg-bg')) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (wheelRafRef.current) {
        cancelAnimationFrame(wheelRafRef.current);
        wheelRafRef.current = null;
      }
      setIsPanning(true);
      setPanStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
      onSelectCard(null);
      setSelectedCardIds([]);
      setSelectedConnectionIds([]);
    }
  };

  // Card Mouse Down / Select
  const handleCardSelect = (card: WorldCard, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    
    if (isSpacePressed) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (wheelRafRef.current) {
        cancelAnimationFrame(wheelRafRef.current);
        wheelRafRef.current = null;
      }
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      setIsPanning(true);
      setPanStart({ x: clientX - pan.x, y: clientY - pan.y });
      return;
    }

    onSelectCard(card);

    const isShift = 'shiftKey' in e && (e as React.MouseEvent).shiftKey;
    if (!isShift) {
      setSelectedConnectionIds([]);
    }
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
    setLocalDragPositions(initialPositions);
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
      const nextPanX = clientX - panStart.x;
      const nextPanY = clientY - panStart.y;
      panRef.current = { x: nextPanX, y: nextPanY };
      setPan({
        x: nextPanX,
        y: nextPanY,
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

        const updated: Record<string, { x: number; y: number }> = {};
        Object.keys(dragCardPositions).forEach((cId) => {
          const initPos = dragCardPositions[cId];
          updated[cId] = { x: initPos.x + deltaX, y: initPos.y + deltaY };
        });
        setLocalDragPositions(updated);
      } else {
        setLocalDragPositions({
          [draggingCardId]: {
            x: Math.round(worldPos.x - dragOffset.x),
            y: Math.round(worldPos.y - dragOffset.y),
          },
        });
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
      const updates: { id: string; x: number; y: number }[] = [];
      Object.keys(localDragPositions).forEach((cId) => {
        const startPos = dragCardPositions[cId];
        const endPos = localDragPositions[cId];
        if (endPos && startPos && (endPos.x !== startPos.x || endPos.y !== startPos.y)) {
          updates.push({ id: cId, x: endPos.x, y: endPos.y });
        }
      });

      if (updates.length > 0) {
        if (onUpdateCardPositionsBatch) {
          onUpdateCardPositionsBatch(updates);
        } else {
          updates.forEach((u) => onUpdateCardPosition(u.id, u.x, u.y));
        }
      }

      setDraggingCardId(null);
      setDragCardPositions({});
      setLocalDragPositions({});
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

  // Double click canvas background disabled
  const handleDoubleClickBackground = (_e: React.MouseEvent) => {
    // Empty as requested
  };

  // Track measured DOM heights for precise connection line anchoring
  const cardHeightsRef = useRef<Map<string, number>>(new Map());

  // Render SVG Connections
  const renderConnections = () => {
    return connections.map((conn) => {
      const sourceCard = cards.find((c) => c.id === conn.sourceId);
      const targetCard = cards.find((c) => c.id === conn.targetId);

      if (!sourceCard || !targetCard) return null;

      const sourcePos = localDragPositions[sourceCard.id] || { x: sourceCard.x, y: sourceCard.y };
      const targetPos = localDragPositions[targetCard.id] || { x: targetCard.x, y: targetCard.y };

      const sourceW = sourceCard.width || 288;
      const targetW = targetCard.width || 288;
      const sourceH = cardHeightsRef.current.get(sourceCard.id) || sourceCard.height || 180;
      const targetH = cardHeightsRef.current.get(targetCard.id) || targetCard.height || 180;

      const sourceCenterX = sourcePos.x + sourceW / 2;
      const sourceCenterY = sourcePos.y + sourceH / 2;
      const targetCenterX = targetPos.x + targetW / 2;
      const targetCenterY = targetPos.y + targetH / 2;

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
          const sourceEdgeX = sourcePos.x + sourceW + 2;
          const sourceEdgeY = Math.min(Math.max(targetCenterY, sourcePos.y + 24), sourcePos.y + sourceH - 24);

          const targetEdgeX = targetPos.x - 2;
          const targetEdgeY = Math.min(Math.max(sourceCenterY, targetPos.y + 24), targetPos.y + targetH - 24);

          x1 = dirMode === 'bidirectional' ? sourceEdgeX + arrowLen : sourceEdgeX;
          y1 = sourceEdgeY;
          x2 = targetEdgeX - arrowLen;
          y2 = targetEdgeY;
        } else {
          // Source -> Target (Right to Left)
          const sourceEdgeX = sourcePos.x - 2;
          const sourceEdgeY = Math.min(Math.max(targetCenterY, sourcePos.y + 24), sourcePos.y + sourceH - 24);

          const targetEdgeX = targetPos.x + targetW + 2;
          const targetEdgeY = Math.min(Math.max(sourceCenterY, targetPos.y + 24), targetPos.y + targetH - 24);

          x1 = dirMode === 'bidirectional' ? sourceEdgeX - arrowLen : sourceEdgeX;
          y1 = sourceEdgeY;
          x2 = targetEdgeX + arrowLen;
          y2 = targetEdgeY;
        }
      } else {
        dir = 'vertical';
        if (dy >= 0) {
          // Source -> Target (Top to Bottom)
          const sourceEdgeX = Math.min(Math.max(targetCenterX, sourcePos.x + 24), sourcePos.x + sourceW - 24);
          const sourceEdgeY = sourcePos.y + sourceH + 2;

          const targetEdgeX = Math.min(Math.max(sourceCenterX, targetPos.x + 24), targetPos.x + targetW - 24);
          const targetEdgeY = targetPos.y - 2;

          x1 = sourceEdgeX;
          y1 = dirMode === 'bidirectional' ? sourceEdgeY + arrowLen : sourceEdgeY;
          x2 = targetEdgeX;
          y2 = targetEdgeY - arrowLen;
        } else {
          // Source -> Target (Bottom to Top)
          const sourceEdgeX = Math.min(Math.max(targetCenterX, sourcePos.x + 24), sourcePos.x + sourceW - 24);
          const sourceEdgeY = sourcePos.y - 2;

          const targetEdgeX = Math.min(Math.max(sourceCenterX, targetPos.x + 24), targetPos.x + targetW - 24);
          const targetEdgeY = targetPos.y + targetH + 2;

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
          {/* Edge Label Pill */}
          <foreignObject
            x={midX - 60}
            y={midY - 14}
            width={120}
            height={28}
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

    const sourcePos = localDragPositions[sourceCard.id] || { x: sourceCard.x, y: sourceCard.y };
    const sourceH = cardHeightsRef.current.get(sourceCard.id) || 180;
    const x1 = sourcePos.x + 144;
    const y1 = sourcePos.y + sourceH / 2;
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
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          backgroundImage: `radial-gradient(var(--grid-dot) ${1.25 * zoom}px, transparent ${1.25 * zoom}px)`,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          opacity: Math.min(0.85, Math.max(0.15, zoom * 0.7)),
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

          const q = searchQuery.trim().toLowerCase();
          const matchesCategory = selectedCategory === 'all' || card.category === selectedCategory;
          const matchesSearch =
            !q ||
            card.title.toLowerCase().includes(q) ||
            (card.summary && card.summary.toLowerCase().includes(q)) ||
            (card.content && card.content.toLowerCase().includes(q)) ||
            (card.tags && card.tags.some((t) => t.toLowerCase().includes(q)));

          const isDimmed = !matchesCategory || !matchesSearch;
          const isCategoryHighlighted = (selectedCategory !== 'all' || !!q) && matchesCategory && matchesSearch;
          const isCardSelected = selectedCardId === card.id || selectedCardIds.includes(card.id);

          const displayPos = localDragPositions[card.id];
          const cardToRender = displayPos ? { ...card, x: displayPos.x, y: displayPos.y } : card;

          return (
            <WorldCardNode
              key={card.id}
              card={cardToRender}
              isSelected={isCardSelected}
              isConnectingSource={connectingSourceId === card.id}
              isDimmed={isDimmed}
              isCategoryHighlighted={isCategoryHighlighted}
              zoom={zoom}
              onSelect={handleCardSelect}
              onDoubleClick={onDoubleClickCard}
              onStartConnection={handleStartConnection}
              connectionCount={connCount}
              onMeasureHeight={(id, h) => cardHeightsRef.current.set(id, h)}
              onUpdateDimensions={onUpdateCardDimensions}
              onUpdateImageHeight={onUpdateCardImageHeight}
              onAdjustImageFocalPointRequest={onAdjustImageFocalPointRequest}
            />
          );
        })}
      </div>

      {/* Empty State Banner */}
      {cards.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none z-20">
          <div className="app-bg-secondary border app-border p-6 md:p-8 rounded-2xl max-w-md space-y-3 shadow-2xl pointer-events-auto app-text-main">
            <img
              src="/wd-logo-circle.png"
              alt="World Deck Logo"
              className="w-14 h-14 object-contain rounded-2xl shadow-md mx-auto"
            />
            <h3 className="text-base font-bold app-text-main">{t.canvas.emptyCanvasTitle}</h3>
            <p className="text-xs app-text-muted leading-relaxed">
              {t.canvas.emptyCanvasDesc}
            </p>
            <button
              type="button"
              onClick={() => onAddCardAtPosition(400, 300)}
              className="px-4 py-2 app-accent-bg text-white rounded-lg text-xs font-semibold shadow-md flex items-center justify-center gap-1.5 mx-auto"
            >
              <Icons.Plus size={15} />
              <span>{t.canvas.addCard}</span>
            </button>
          </div>
        </div>
      )}

      {/* Consolidated Figma-Style Floating Tool Capsule Bar (Bottom-Center) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#2c2c2c] p-1.5 rounded-2xl border border-[#383838] shadow-2xl z-50 text-xs text-white backdrop-blur-md select-none">
        {/* Undo & Redo */}
        {onUndo && onRedo && (
          <>
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-2 rounded-xl transition-all ${
                canUndo
                  ? 'text-slate-300 hover:text-white hover:bg-[#383838] cursor-pointer active:scale-95'
                  : 'text-slate-600 opacity-40 cursor-not-allowed'
              }`}
              title="Undo (Ctrl + Z)"
            >
              <Icons.Undo2 size={15} />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className={`p-2 rounded-xl transition-all ${
                canRedo
                  ? 'text-slate-300 hover:text-white hover:bg-[#383838] cursor-pointer active:scale-95'
                  : 'text-slate-600 opacity-40 cursor-not-allowed'
              }`}
              title="Redo (Ctrl + Y)"
            >
              <Icons.Redo2 size={15} />
            </button>

            <div className="w-[1px] h-4 bg-[#383838] mx-0.5" />
          </>
        )}

        {/* Pointer Select Tool */}
        <button
          type="button"
          onClick={() => setIsSpacePressed(false)}
          className={`p-2 rounded-xl transition-all cursor-pointer ${
            !isSpacePressed && !connectingSourceId
              ? 'bg-[#0d99ff] text-white shadow-sm font-bold'
              : 'text-slate-400 hover:text-white hover:bg-[#383838]'
          }`}
          title="Pointer Select (V)"
        >
          <Icons.MousePointer size={15} />
        </button>

        {/* Hand Pan Tool */}
        <button
          type="button"
          onClick={() => setIsSpacePressed(!isSpacePressed)}
          className={`p-2 rounded-xl transition-all cursor-pointer ${
            isSpacePressed
              ? 'bg-[#0d99ff] text-white shadow-sm font-bold'
              : 'text-slate-400 hover:text-white hover:bg-[#383838]'
          }`}
          title="Pan Hand Tool (Space + Drag)"
        >
          <Icons.Hand size={15} />
        </button>

        <div className="w-[1px] h-4 bg-[#383838] mx-0.5" />

        {/* Add Card Button */}
        <button
          type="button"
          onClick={() => onAddCardAtPosition(400, 300)}
          className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-[#383838] transition-all cursor-pointer flex items-center gap-1.5"
          title={t.canvas.addCard}
        >
          <Icons.Plus size={15} className="text-[#0d99ff]" />
          <span className="hidden sm:inline text-xs font-semibold">{t.library.cards}</span>
        </button>

        <div className="w-[1px] h-4 bg-[#383838] mx-0.5" />

        {/* Center Viewport Focus */}
        <button
          type="button"
          onClick={handleCenterViewport}
          className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-[#383838] transition-all cursor-pointer flex items-center gap-1.5"
          title={t.sidebar.focusOnCanvas}
        >
          <Icons.Focus size={15} className="text-purple-400" />
          <span className="hidden sm:inline text-xs font-semibold">Focus</span>
        </button>

        <div className="w-[1px] h-4 bg-[#383838] mx-0.5" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => handleZoom(-0.15)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#383838] transition-colors cursor-pointer"
            title={t.canvas.zoomOut}
          >
            <Icons.ZoomOut size={14} />
          </button>
          <span className="text-[11px] font-mono text-[#0d99ff] px-1 min-w-[40px] text-center font-bold">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => handleZoom(0.15)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#383838] transition-colors cursor-pointer"
            title={t.canvas.zoomIn}
          >
            <Icons.ZoomIn size={14} />
          </button>
        </div>
      </div>

      {contextMenu.visible && (() => {
        const isMultiSelectActive = selectedCardIds.length > 1;
        const clickedCard = contextMenu.targetCardId ? cards.find((c) => c.id === contextMenu.targetCardId) : null;

        return (
          <div
            className="fixed app-bg-secondary border app-border rounded-xl shadow-2xl py-1.5 w-60 z-[100] text-xs app-text-main animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-800 max-h-[85vh] overflow-y-auto custom-scrollbar"
            style={{
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
              transform: `translate(${contextMenu.isNearRight ? '-100%' : '0'}, ${contextMenu.isNearBottom ? '-100%' : '0'})`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* CASE 1: MULTI-SELECT CONTEXT MENU */}
            {isMultiSelectActive ? (
              <>
                <div className="px-3 py-1.5 text-[10px] text-[#0d99ff] font-extrabold uppercase tracking-wider select-none flex items-center justify-between bg-[#0d99ff]/10">
                  <span>{selectedCardIds.length} {t.library.cardsSelected}</span>
                </div>

                <div className="py-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      handleCenterViewport();
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-bold text-[#0d99ff] cursor-pointer"
                  >
                    <Icons.Maximize size={14} />
                    <span>{t.sidebar.focusOnCanvas}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onRemoveCardsFromCanvas) {
                        onRemoveCardsFromCanvas(selectedCardIds);
                        setSelectedCardIds([]);
                      }
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold text-amber-400 cursor-pointer"
                  >
                    <Icons.MinusCircle size={14} />
                    <span>{t.sidebar.removeFromCanvas}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onDeleteCardsRequest(selectedCardIds);
                      setSelectedCardIds([]);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold text-rose-400 cursor-pointer"
                  >
                    <Icons.Trash2 size={14} />
                    <span>{t.sidebar.deletePermanently}</span>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCardIds([]);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors text-slate-400 font-medium cursor-pointer"
                  >
                    <Icons.XCircle size={14} />
                    <span>{t.library.clearSelection}</span>
                  </button>
                </div>
              </>
            ) : clickedCard ? (
              /* CASE 2: SINGLE CARD CONTEXT MENU */
              <>
                <div className="px-3 py-1.5 text-[10px] app-text-muted font-bold uppercase tracking-wider select-none truncate">
                  📄 {clickedCard.title || t.common.untitled}
                </div>

                <div className="py-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenCardFullPageRequest) {
                        onOpenCardFullPageRequest(clickedCard);
                      } else {
                        onDoubleClickCard(clickedCard);
                      }
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-bold text-[#0d99ff] cursor-pointer"
                  >
                    <Icons.Maximize2 size={14} />
                    <span>{t.library.openFullscreen}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onEditCardRequest) {
                        onEditCardRequest(clickedCard);
                      } else {
                        onDoubleClickCard(clickedCard);
                      }
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold text-slate-200 cursor-pointer"
                  >
                    <Icons.Edit3 size={14} />
                    <span>{t.sidebar.editCard}</span>
                  </button>

                  {(clickedCard.imageUrl || (clickedCard.images && clickedCard.images.length > 0)) && (
                    <button
                      type="button"
                      onClick={() => {
                        onAdjustImageFocalPointRequest?.(clickedCard);
                        setContextMenu((prev) => ({ ...prev, visible: false }));
                      }}
                      className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold text-[#0d99ff] cursor-pointer"
                    >
                      <Icons.Focus size={14} />
                      <span>{t.library.adjustImageFocus}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onAddCardAtPosition(clickedCard.x + 40, clickedCard.y + 40, {
                        title: `${clickedCard.title || t.library.cards} (${language === 'en' ? 'Copy' : 'Salinan'})`,
                        subtitle: clickedCard.subtitle,
                        category: clickedCard.category,
                        summary: clickedCard.summary,
                        content: clickedCard.content,
                        tags: clickedCard.tags,
                        attributes: clickedCard.attributes,
                        imageUrl: clickedCard.imageUrl,
                      });
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold text-emerald-400 cursor-pointer"
                  >
                    <Icons.Copy size={14} />
                    <span>{t.sidebar.duplicateCanvas.replace('Canvas', 'Card')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setConnectingSourceId(clickedCard.id);
                      setConnectionMousePos({ x: clickedCard.x + 140, y: clickedCard.y + 80 });
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold text-purple-400 cursor-pointer"
                  >
                    <Icons.GitCommit size={14} />
                    <span>{t.canvas.connectMode}</span>
                  </button>
                </div>

                <div className="py-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (onRemoveCardsFromCanvas) {
                        onRemoveCardsFromCanvas([clickedCard.id]);
                      }
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors text-amber-400 font-medium cursor-pointer"
                  >
                    <Icons.MinusCircle size={14} />
                    <span>{t.sidebar.removeFromCanvas}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onDeleteCardsRequest([clickedCard.id]);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors text-rose-500 font-medium cursor-pointer"
                  >
                    <Icons.Trash2 size={14} />
                    <span>{t.sidebar.deletePermanently}</span>
                  </button>
                </div>
              </>
            ) : (
              /* CASE 3: EMPTY CANVAS CONTEXT MENU */
              <>
                <div className="py-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onAddCardAtPosition(contextMenu.canvasX, contextMenu.canvasY);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold text-emerald-400 cursor-pointer"
                  >
                    <Icons.Plus size={14} strokeWidth={2.5} />
                    <span>{t.sidebar.createNewCard}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setGalleryTargetPos({ x: contextMenu.canvasX, y: contextMenu.canvasY });
                      setShowAddFromGalleryModal(true);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold text-[#0d99ff] cursor-pointer"
                  >
                    <Icons.FolderPlus size={14} strokeWidth={2.5} />
                    <span>{t.library.addCardToCanvas}</span>
                  </button>
                </div>

                <div className="py-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      handleFitAllCardsView();
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors text-slate-200 cursor-pointer font-medium"
                  >
                    <Icons.Maximize size={14} className="text-[#0d99ff]" />
                    <span>{t.sidebar.focusOnCanvas}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleResetZoom100();
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors text-slate-200 cursor-pointer font-medium"
                  >
                    <Icons.RotateCcw size={14} className="text-amber-400" />
                    <span>{t.canvas.resetZoom} (100%)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleCenterViewport();
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors text-slate-200 cursor-pointer font-medium"
                  >
                    <Icons.Focus size={14} className="app-text-muted" />
                    <span>{t.sidebar.focusOnCanvas}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsSpacePressed(!isSpacePressed);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors text-slate-200 cursor-pointer font-medium"
                  >
                    <Icons.Hand size={14} className="app-text-muted" />
                    <span>{isSpacePressed ? t.appPrompts.panModeDisable : t.appPrompts.panModeEnable}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })()}

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
