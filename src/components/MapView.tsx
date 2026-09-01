import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { WorldMap, MapPin, WorldCard, WorldDeck } from '../types';
import * as Icons from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { ConfirmModal } from './ConfirmModal';
import type { ConfirmModalConfig } from './ConfirmModal';
import { AddCardFromGalleryModal } from './AddCardFromGalleryModal';

interface MapViewProps {
  worldMaps: WorldMap[];
  cards: WorldCard[];
  decks?: WorldDeck[];
  onSaveMap: (map: WorldMap) => void;
  onDeleteMap: (mapId: string) => void;
  onOpenCard: (cardId: string) => void;
  onEditCard?: (card: WorldCard) => void;
  onCreatePinCard?: (mapId: string, x: number, y: number) => void;
}

const PIN_COLORS = [
  { label: 'Blue', value: '#0d99ff' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Cyan', value: '#06b6d4' },
];

export const MapView: React.FC<MapViewProps> = ({
  worldMaps,
  cards,
  decks = [],
  onSaveMap,
  onDeleteMap,
  onOpenCard,
  onEditCard,
  onCreatePinCard,
}) => {
  const { language, t } = useLanguage();
  
  const [confirmModalConfig, setConfirmModalConfig] = useState<ConfirmModalConfig | null>(null);

  const [selectedMapId, setSelectedMapId] = useState<string | null>(() => 
    worldMaps.length > 0 ? worldMaps[0].id : null
  );

  // Fallback to first map if selectedMapId is invalid
  useEffect(() => {
    if (worldMaps.length > 0) {
      if (!selectedMapId || !worldMaps.some((m) => m.id === selectedMapId)) {
        setSelectedMapId(worldMaps[0].id);
      }
    } else {
      setSelectedMapId(null);
    }
  }, [worldMaps, selectedMapId]);

  const currentMap = useMemo(
    () => worldMaps.find((m) => m.id === selectedMapId) || null,
    [worldMaps, selectedMapId]
  );

  // Map Controls State
  const [isAddPinMode, setIsAddPinMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);

  // Pan & Zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);
  
  // Dragging pin state
  const [draggingPinId, setDraggingPinId] = useState<string | null>(null);

  // Modal State for New/Edit Map
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapFormMode, setMapFormMode] = useState<'create' | 'edit'>('create');
  const [mapName, setMapName] = useState('');
  const [mapDesc, setMapDesc] = useState('');
  const [mapImageUrl, setMapImageUrl] = useState('');
  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    mapPercentX: number | null;
    mapPercentY: number | null;
    pinId: string | null;
    isNearRight: boolean;
    isNearBottom: boolean;
  }>({
    visible: false,
    x: 0,
    y: 0,
    mapPercentX: null,
    mapPercentY: null,
    pinId: null,
    isNearRight: false,
    isNearBottom: false,
  });

  // Target position for AddCardFromGalleryModal
  const [galleryTargetPos, setGalleryTargetPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Mutable refs for zoom & pan to prevent stale closure lag during rapid wheel events
  const zoomRef = useRef<number>(zoom);
  const panRef = useRef<{ x: number; y: number }>(pan);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  // Ref for active smooth zoom animation loop
  const animFrameRef = useRef<number | null>(null);
  const wheelRafRef = useRef<number | null>(null);

  // Reset zoom & pan when map changes
  useEffect(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (wheelRafRef.current) {
      cancelAnimationFrame(wheelRafRef.current);
      wheelRafRef.current = null;
    }
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedPinId(null);
    setIsAddPinMode(false);
    setHasDragged(false);
  }, [selectedMapId]);

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
    if (rect.width === 0 || rect.height === 0) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const currentZoom = zoomRef.current;
    const currentPan = panRef.current;

    const nextZoom = Math.max(0.2, Math.min(5.0, targetZoom));
    if (Math.abs(nextZoom - currentZoom) < 0.0001) return;

    // Calculate world coordinate (relative to container center) under mouse cursor
    const worldX = (clientX - centerX - currentPan.x) / currentZoom;
    const worldY = (clientY - centerY - currentPan.y) / currentZoom;

    // Calculate new pan to lock world point to exact mouse screen position
    const newPanX = (clientX - centerX) - worldX * nextZoom;
    const newPanY = (clientY - centerY) - worldY * nextZoom;

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

  // Smooth zoom handlers for buttons (focus on viewport center)
  const handleZoom = (delta: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    zoomAtPoint(zoomRef.current + delta, centerX, centerY, true);
  };

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
          // Interpolate toward target zoom (smooth damping factor 0.22 per frame)
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
        // Smooth Zoom mode (Ctrl + Wheel)
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

        // Proportional exponential zoom per wheel notch (smooth Google Maps feeling)
        const delta = Math.max(-100, Math.min(100, e.deltaY));
        const factor = Math.exp(-delta * 0.0016);
        targetZoomLevel = Math.max(0.2, Math.min(5.0, targetZoomLevel * factor));

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

  // Close context menu on global click or wheel/scroll
  useEffect(() => {
    if (!contextMenu.visible) return;

    const handleClose = () => {
      setContextMenu((prev) => ({ ...prev, visible: false }));
    };

    window.addEventListener('click', handleClose);
    window.addEventListener('wheel', handleClose, { passive: true });
    window.addEventListener('resize', handleClose);

    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('wheel', handleClose);
      window.removeEventListener('resize', handleClose);
    };
  }, [contextMenu.visible]);

  // Global mouseup listener to release pan/drag anywhere
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsPanning(false);
      setDraggingPinId(null);
      dragOffsetRef.current = { x: 0, y: 0 };
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Open create map modal
  const handleOpenCreateModal = () => {
    setMapFormMode('create');
    setMapName('');
    setMapDesc('');
    setMapImageUrl('');
    setShowMapModal(true);
  };

  // Open edit map modal
  const handleOpenEditModal = () => {
    if (!currentMap) return;
    setMapFormMode('edit');
    setMapName(currentMap.name);
    setMapDesc(currentMap.description || '');
    setMapImageUrl(currentMap.imageUrl);
    setShowMapModal(true);
  };

  // File upload handler
  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setMapImageUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Save map (Create or Edit)
  const handleSaveMapSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapImageUrl) return;

    const now = Date.now();
    if (mapFormMode === 'create') {
      const newMap: WorldMap = {
        id: `map_${now}_${Math.random().toString(36).substr(2, 6)}`,
        name: mapName.trim() || t.map.unnamedMap,
        description: mapDesc.trim(),
        imageUrl: mapImageUrl,
        pins: [],
        createdAt: now,
        updatedAt: now,
      };
      onSaveMap(newMap);
      setSelectedMapId(newMap.id);
    } else if (currentMap) {
      const updatedMap: WorldMap = {
        ...currentMap,
        name: mapName.trim() || t.map.unnamedMap,
        description: mapDesc.trim(),
        imageUrl: mapImageUrl,
        updatedAt: now,
      };
      onSaveMap(updatedMap);
    }
    setShowMapModal(false);
  };

  // Delete Map
  const handleDeleteCurrentMap = () => {
    if (!currentMap) return;
    setConfirmModalConfig({
      isOpen: true,
      title: t.map.deleteMap,
      description: `${t.map.deleteMapConfirm} ("${currentMap.name}")`,
      confirmLabel: t.common.delete || (language === 'en' ? 'Delete' : 'Hapus'),
      cancelLabel: t.common.cancel || (language === 'en' ? 'Cancel' : 'Batal'),
      variant: 'danger',
      onConfirm: () => {
        onDeleteMap(currentMap.id);
        setConfirmModalConfig(null);
      },
      onCancel: () => setConfirmModalConfig(null),
    });
  };

  // Handle click on Map Image to add pin (triggers card creation modal)
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (hasDragged) {
      setHasDragged(false);
      return;
    }

    if (!currentMap || !imageRef.current) return;
    
    // Ignore click if clicking directly on a pin or controls
    const target = e.target as HTMLElement;
    if (target.closest('.map-pin-element') || target.closest('button')) return;

    if (!isAddPinMode) return;

    const rect = imageRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const percentX = Math.min(100, Math.max(0, (clickX / rect.width) * 100));
    const percentY = Math.min(100, Math.max(0, (clickY / rect.height) * 100));
    const posX = Math.round(percentX * 10) / 10;
    const posY = Math.round(percentY * 10) / 10;

    setIsAddPinMode(false);

    if (onCreatePinCard) {
      onCreatePinCard(currentMap.id, posX, posY);
    }
  };

  // Container Mouse Down for Google Maps style pan-and-drag
  const handleContainerMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, .map-pin-element')) return;

    if (isAddPinMode) return;

    if (e.button === 0 || e.button === 1) {
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
      setHasDragged(false);
    }
  };

  // Delete Pin
  const handleDeletePin = (pinId: string) => {
    if (!currentMap) return;
    const targetPin = currentMap.pins.find((p) => p.id === pinId);
    const pinName = targetPin?.title || (language === 'en' ? 'this pin' : 'pin ini');

    setConfirmModalConfig({
      isOpen: true,
      title: t.map.deletePin,
      description: `${t.map.deletePinConfirm} ("${pinName}")`,
      confirmLabel: t.common.delete || (language === 'en' ? 'Delete' : 'Hapus'),
      cancelLabel: t.common.cancel || (language === 'en' ? 'Cancel' : 'Batal'),
      variant: 'danger',
      onConfirm: () => {
        const newPins = currentMap.pins.filter((p) => p.id !== pinId);
        onSaveMap({
          ...currentMap,
          pins: newPins,
          updatedAt: Date.now(),
        });
        if (selectedPinId === pinId) setSelectedPinId(null);
        setConfirmModalConfig(null);
      },
      onCancel: () => setConfirmModalConfig(null),
    });
  };

  // Drag pin handlers (Direct click-and-drag to move, double-click to open card)
  const handlePinMouseDown = (e: React.MouseEvent, pinId: string) => {
    // Only handle primary (left) button
    if (e.button !== 0) return;
    e.stopPropagation();
    if (isAddPinMode) return;

    setSelectedPinId(pinId);

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (wheelRafRef.current) {
      cancelAnimationFrame(wheelRafRef.current);
      wheelRafRef.current = null;
    }

    if (imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      const cursorPercentX = ((e.clientX - rect.left) / rect.width) * 100;
      const cursorPercentY = ((e.clientY - rect.top) / rect.height) * 100;
      const targetPin = currentMap?.pins.find((p) => p.id === pinId);
      if (targetPin) {
        dragOffsetRef.current = {
          x: cursorPercentX - targetPin.x,
          y: cursorPercentY - targetPin.y,
        };
      }
    }
    setDraggingPinId(pinId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const newPanX = e.clientX - panStart.x;
      const newPanY = e.clientY - panStart.y;
      if (Math.abs(newPanX - pan.x) > 3 || Math.abs(newPanY - pan.y) > 3) {
        setHasDragged(true);
      }
      panRef.current = { x: newPanX, y: newPanY };
      setPan({ x: newPanX, y: newPanY });
      return;
    }

    if (draggingPinId && currentMap && imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Compensate for cursor offset relative to pin coordinate so the pin does not jump abruptly
      const rawPercentX = ((clickX / rect.width) * 100) - dragOffsetRef.current.x;
      const rawPercentY = ((clickY / rect.height) * 100) - dragOffsetRef.current.y;

      const percentX = Math.min(100, Math.max(0, rawPercentX));
      const percentY = Math.min(100, Math.max(0, rawPercentY));

      const updatedPins = currentMap.pins.map((p) => {
        if (p.id === draggingPinId) {
          return {
            ...p,
            x: Math.round(percentX * 10) / 10,
            y: Math.round(percentY * 10) / 10,
          };
        }
        return p;
      });

      onSaveMap({
        ...currentMap,
        pins: updatedPins,
        updatedAt: Date.now(),
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingPinId(null);
    dragOffsetRef.current = { x: 0, y: 0 };
  };

  // Context Menu Handler
  const handleContextMenu = (e: React.MouseEvent) => {
    // If clicking on an input/textarea or button, do not intercept
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, button, select')) return;

    e.preventDefault();
    e.stopPropagation();

    // Check if right-clicking on a pin
    const pinElem = target.closest('.map-pin-element');
    const pinId = pinElem?.getAttribute('data-pin-id') || null;

    let mapPercentX: number | null = null;
    let mapPercentY: number | null = null;

    if (imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      // Clamp between 0 and 100
      const rawX = (clickX / rect.width) * 100;
      const rawY = (clickY / rect.height) * 100;
      if (rawX >= -5 && rawX <= 105 && rawY >= -5 && rawY <= 105) {
        mapPercentX = Math.round(Math.min(100, Math.max(0, rawX)) * 10) / 10;
        mapPercentY = Math.round(Math.min(100, Math.max(0, rawY)) * 10) / 10;
      }
    }

    if (pinId) {
      setSelectedPinId(pinId);
    }

    const isNearRight = e.clientX > window.innerWidth - 240;
    const isNearBottom = e.clientY > window.innerHeight - 240;

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      mapPercentX,
      mapPercentY,
      pinId,
      isNearRight,
      isNearBottom,
    });
  };

  // Center viewport on context menu coordinate
  const handleCenterOnPos = (screenX: number, screenY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Shift pan so (screenX, screenY) moves to (centerX, centerY)
    const deltaX = centerX - screenX;
    const deltaY = centerY - screenY;

    const newPanX = panRef.current.x + deltaX;
    const newPanY = panRef.current.y + deltaY;

    animateTo(zoomRef.current, { x: newPanX, y: newPanY }, 250);
  };

  // Focus and center on a pin smoothly
  const handleFocusOnPin = (pin: MapPin) => {
    if (!imageRef.current) return;

    // We want pin position to align with center
    // Pin coordinate on unscaled map image
    const naturalWidth = imageRef.current.offsetWidth;
    const naturalHeight = imageRef.current.offsetHeight;
    const pinImageX = (pin.x / 100) * naturalWidth;
    const pinImageY = (pin.y / 100) * naturalHeight;

    // When centered, image center is at (0, 0) relative to pan
    const targetZoom = Math.max(zoomRef.current, 1.4);
    const newPanX = (naturalWidth / 2 - pinImageX) * targetZoom;
    const newPanY = (naturalHeight / 2 - pinImageY) * targetZoom;

    setSelectedPinId(pin.id);
    animateTo(targetZoom, { x: newPanX, y: newPanY }, 300);
  };

  // Quick change pin color
  const handleQuickChangePinColor = (pinId: string, color: string) => {
    if (!currentMap) return;
    const newPins = currentMap.pins.map((p) => (p.id === pinId ? { ...p, color } : p));
    onSaveMap({
      ...currentMap,
      pins: newPins,
      updatedAt: Date.now(),
    });
  };

  // Filter out any orphan pins where the linked card has been deleted
  const validPins = useMemo(() => {
    if (!currentMap) return [];
    return currentMap.pins.filter((pin) => {
      if (pin.cardId) {
        return cards.some((c) => c.id === pin.cardId);
      }
      return true;
    });
  }, [currentMap, cards]);

  // Auto-sync & persist pin cleanup if any linked card was deleted
  useEffect(() => {
    if (!currentMap) return;
    const hasOrphans = currentMap.pins.some((pin) => pin.cardId && !cards.some((c) => c.id === pin.cardId));
    if (hasOrphans) {
      const cleanedPins = currentMap.pins.filter((pin) => !pin.cardId || cards.some((c) => c.id === pin.cardId));
      onSaveMap({
        ...currentMap,
        pins: cleanedPins,
        updatedAt: Date.now(),
      });
    }
  }, [currentMap, cards, onSaveMap]);

  // Filtered pins based on search query
  const filteredPins = useMemo(() => {
    if (!validPins.length) return [];
    if (!searchQuery.trim()) return validPins;

    const q = searchQuery.toLowerCase();
    return validPins.filter((pin) => {
      const titleMatch = pin.title.toLowerCase().includes(q);
      const descMatch = (pin.description || '').toLowerCase().includes(q);
      const linkedCard = cards.find((c) => c.id === pin.cardId);
      const cardMatch = linkedCard
        ? linkedCard.title.toLowerCase().includes(q) ||
          linkedCard.tags.some((t) => t.toLowerCase().includes(q))
        : false;
      return titleMatch || descMatch || cardMatch;
    });
  }, [validPins, searchQuery, cards]);

  // Dynamic pin scaling: pins counter-scale with zoom so they remain readable without becoming excessively tiny or overwhelmingly huge
  const pinScale = useMemo(() => {
    // Keep pins at an optimal screen size (~1.0x - 1.35x):
    // When zooming in, visual scale gently expands to ~1.3x so pins & text labels are bold, crisp, and easily readable.
    // Screen size = pinScale * zoom.
    // targetVisualScale = clamp(1.0, 1.45, 0.95 + 0.15 * zoom)
    const targetVisualScale = Math.max(1.0, Math.min(1.45, 0.95 + 0.15 * zoom));
    return targetVisualScale / zoom;
  }, [zoom]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#181818] overflow-hidden select-none">
      {/* TOOLBAR TOP HEADER */}
      <div className="h-12 bg-[#222222] border-b border-[#383838] px-4 flex items-center justify-between gap-3 shrink-0 z-20 shadow-md">
        {/* Left: Map Switcher & Map Management */}
        <div className="flex items-center gap-2">
          <Icons.Map size={18} className="text-[#0d99ff]" />
          <span className="font-bold text-sm text-white">{t.map.title}</span>

          {worldMaps.length > 0 && (
            <div className="relative flex items-center ml-2">
              <select
                value={selectedMapId || ''}
                onChange={(e) => setSelectedMapId(e.target.value)}
                className="bg-[#1e1e1e] hover:bg-[#2c2c2c] border border-[#383838] hover:border-[#0d99ff] text-xs font-semibold text-white px-3 py-1.5 pr-8 rounded-lg outline-none cursor-pointer transition-all appearance-none"
              >
                {worldMaps.map((map) => {
                  const count = map.pins.filter((p) => !p.cardId || cards.some((c) => c.id === p.cardId)).length;
                  return (
                    <option key={map.id} value={map.id}>
                      {map.name} ({count} {t.map.pinsCount})
                    </option>
                  );
                })}
              </select>
              <Icons.ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
            </div>
          )}

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-3 py-1.5 rounded-lg bg-[#0d99ff] hover:bg-[#0088eb] text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <Icons.Plus size={14} />
            <span>{t.map.uploadMap}</span>
          </button>

          {currentMap && (
            <div className="flex items-center gap-1 border-l border-[#383838] pl-2 ml-1">
              <button
                type="button"
                onClick={handleOpenEditModal}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#383838] transition-all cursor-pointer"
                title={t.map.editMap}
              >
                <Icons.Edit3 size={14} />
              </button>
              <button
                type="button"
                onClick={handleDeleteCurrentMap}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-[#383838] transition-all cursor-pointer"
                title={t.map.deleteMap}
              >
                <Icons.Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Center: Add Pin Mode Toggle & Search */}
        {currentMap && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddPinMode((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                isAddPinMode
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md animate-pulse'
                  : 'bg-[#1e1e1e] hover:bg-[#2c2c2c] text-white border-[#383838] hover:border-[#0d99ff]'
              }`}
            >
              <Icons.MapPin size={14} className={isAddPinMode ? 'text-slate-950' : 'text-[#0d99ff]'} />
              <span>{isAddPinMode ? t.map.addPinModeActive : t.map.addPin}</span>
            </button>

            <div className="relative w-48 sm:w-64">
              <Icons.Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.map.searchPinsPlaceholder}
                className="w-full bg-[#1e1e1e] border border-[#383838] focus:border-[#0d99ff] rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-400 outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <Icons.X size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Right: Zoom Controls */}
        {currentMap && (
          <div className="flex items-center gap-1 bg-[#1e1e1e] p-1 rounded-lg border border-[#383838]">
            <button
              type="button"
              onClick={() => handleZoom(-0.25)}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-[#383838] transition-colors"
              title={t.map.zoomOut}
            >
              <Icons.ZoomOut size={14} />
            </button>
            <span className="text-[11px] font-mono text-slate-300 w-10 text-center font-bold">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => handleZoom(0.25)}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-[#383838] transition-colors"
              title={t.map.zoomIn}
            >
              <Icons.ZoomIn size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                animateTo(1, { x: 0, y: 0 }, 250);
              }}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-[#383838] transition-colors"
              title={t.map.resetZoom}
            >
              <Icons.Maximize2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* MAIN VIEW AREA */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* EMPTY STATE IF NO MAPS */}
        {!currentMap ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#181818]">
            <div className="w-20 h-20 rounded-3xl bg-[#222222] border border-[#383838] flex items-center justify-center mb-4 text-[#0d99ff] shadow-xl">
              <Icons.Map size={40} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{t.map.noMaps}</h2>
            <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
              {t.map.noMapsDesc}
            </p>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-5 py-2.5 rounded-xl bg-[#0d99ff] hover:bg-[#0088eb] text-white text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#0d99ff]/20"
            >
              <Icons.Plus size={18} />
              <span>{t.map.uploadMap}</span>
            </button>
          </div>
        ) : (
          /* INTERACTIVE MAP CANVAS */
          <div
            ref={containerRef}
            onMouseDown={handleContainerMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onContextMenu={handleContextMenu}
            className={`flex-1 relative overflow-hidden bg-[#121212] flex items-center justify-center ${
              isAddPinMode ? 'cursor-crosshair' : isPanning ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            {/* Banner hint when Add Pin Mode is active */}
            {isAddPinMode && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-amber-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-2xl flex items-center gap-2 animate-bounce">
                <Icons.MapPin size={16} />
                <span>{t.map.addPinModeActive}</span>
                <button
                  type="button"
                  onClick={() => setIsAddPinMode(false)}
                  className="ml-2 text-slate-900 hover:text-black font-extrabold text-sm"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Map Container with Zoom & Pan */}
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
              className="relative max-w-full max-h-full inline-block select-none"
            >
              <div className="relative inline-block" onClick={handleMapClick}>
                <img
                  ref={imageRef}
                  src={currentMap.imageUrl}
                  alt={currentMap.name}
                  className="max-w-none max-h-[85vh] object-contain rounded-xl shadow-2xl border border-[#383838] pointer-events-auto"
                  draggable={false}
                />

                {/* RENDER PINS ON MAP */}
                {filteredPins.map((pin) => {
                  const isSelected = selectedPinId === pin.id;
                  const pinColor = pin.color || '#0d99ff';
                  const baseScale = pinScale * (isSelected ? 1.25 : 1);
                  const isDragging = draggingPinId === pin.id;
                  const linkedCard = pin.cardId ? cards.find((c) => c.id === pin.cardId) : undefined;
                  const displayTitle = linkedCard ? linkedCard.title : pin.title;

                  return (
                    <div
                      key={pin.id}
                      data-pin-id={pin.id}
                      style={{
                        left: `${pin.x}%`,
                        top: `${pin.y}%`,
                        transform: `translate(-50%, -100%) scale(${baseScale})`,
                        transformOrigin: 'bottom center',
                      }}
                      onMouseDown={(e) => handlePinMouseDown(e, pin.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPinId(pin.id);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (pin.cardId) {
                          onOpenCard(pin.cardId);
                        }
                      }}
                      title={t.map.dragPinHint}
                      className={`map-pin-element absolute z-10 will-change-transform group select-none ${
                        isDragging ? 'cursor-grabbing z-40' : 'cursor-pointer'
                      } ${isSelected ? 'z-30' : 'hover:brightness-110'}`}
                    >
                      {/* Pin Marker (Seamless Teardrop Pin) */}
                      <div className="relative flex flex-col items-center">
                        <div className="relative filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.45)] group-hover:scale-105 transition-transform">
                          <svg
                            width="28"
                            height="36"
                            viewBox="0 0 32 40"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="block"
                          >
                            {/* Seamless Pin Body */}
                            <path
                              d="M16 39C16 39 30 25.4 30 16C30 8.268 23.732 2 16 2C8.268 2 2 8.268 2 16C2 25.4 16 39 16 39Z"
                              fill={pinColor}
                              stroke="white"
                              strokeWidth="2.5"
                              strokeLinejoin="round"
                            />
                            {/* Clean Center Dot Accent */}
                            <circle cx="16" cy="16" r="5" fill="white" />
                          </svg>
                        </div>

                        {/* Title Label below pin */}
                        <div className="mt-1 bg-slate-950/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-xs border border-white/20 whitespace-nowrap max-w-[130px] truncate shadow-md">
                          {displayTitle}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CONTEXT MENU */}
      {contextMenu.visible && (
        <div
          style={{
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
          }}
          className={`fixed z-50 min-w-[210px] bg-[#1e1e1e]/95 backdrop-blur-md border border-[#383838] rounded-xl shadow-2xl py-1 text-xs text-slate-200 select-none animate-in fade-in zoom-in-95 duration-100 ${
            contextMenu.isNearRight ? '-translate-x-full' : ''
          } ${contextMenu.isNearBottom ? '-translate-y-full' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Skenario 1: Klik Kanan pada Pin */}
          {contextMenu.pinId ? (() => {
            const pin = currentMap?.pins.find((p) => p.id === contextMenu.pinId);
            if (!pin) return null;
            const linkedCard = cards.find((c) => c.id === pin.cardId);

            return (
              <div className="space-y-0.5">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-[#383838] flex items-center gap-1.5">
                  <div
                    style={{ backgroundColor: pin.color || '#0d99ff' }}
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                  />
                  <span className="truncate">{linkedCard ? linkedCard.title : pin.title}</span>
                </div>

                {/* Buka Kartu Terkait */}
                {linkedCard && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenCard(linkedCard.id);
                        setContextMenu((prev) => ({ ...prev, visible: false }));
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-[#2e2e2e] flex items-center gap-2.5 transition-colors text-white font-semibold cursor-pointer"
                    >
                      <Icons.BookOpen size={14} className="text-[#0d99ff]" />
                      <span className="truncate">{t.map.viewCard}: {linkedCard.title}</span>
                    </button>

                    {onEditCard && (
                      <button
                        type="button"
                        onClick={() => {
                          onEditCard(linkedCard);
                          setContextMenu((prev) => ({ ...prev, visible: false }));
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-[#2e2e2e] flex items-center gap-2.5 transition-colors text-slate-200 cursor-pointer"
                      >
                        <Icons.Edit3 size={14} className="text-amber-400" />
                        <span>Edit Kartu</span>
                      </button>
                    )}
                  </>
                )}

                {/* Quick Color Palette */}
                <div className="px-3 py-1.5 flex items-center gap-1.5">
                  {PIN_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => {
                        handleQuickChangePinColor(pin.id, c.value);
                        setContextMenu((prev) => ({ ...prev, visible: false }));
                      }}
                      style={{ backgroundColor: c.value }}
                      className={`w-4 h-4 rounded-full transition-transform hover:scale-125 cursor-pointer border ${
                        (pin.color || '#0d99ff') === c.value
                          ? 'border-white scale-110'
                          : 'border-transparent opacity-80'
                      }`}
                      title={c.label}
                    />
                  ))}
                </div>

                {/* Fokus ke Pin Ini */}
                <button
                  type="button"
                  onClick={() => {
                    handleFocusOnPin(pin);
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[#2e2e2e] flex items-center gap-2.5 transition-colors text-slate-200 cursor-pointer"
                >
                  <Icons.Crosshair size={14} className="text-[#0d99ff]" />
                  <span>Fokus ke Pin Ini</span>
                </button>

                <div className="my-1 border-t border-[#383838]" />

                {/* Hapus Pin */}
                <button
                  type="button"
                  onClick={() => {
                    handleDeletePin(pin.id);
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[#2e2e2e] flex items-center gap-2.5 transition-colors text-rose-400 cursor-pointer"
                >
                  <Icons.Trash2 size={14} />
                  <span>{t.map.deletePin}</span>
                </button>
              </div>
            );
          })() : (
            /* Skenario 2: Klik Kanan pada Area Peta Kosong */
            <div className="space-y-0.5">
              {contextMenu.mapPercentX !== null && contextMenu.mapPercentY !== null && (
                <>
                  {/* Tambah Pin di Sini */}
                  <button
                    type="button"
                    onClick={() => {
                      if (currentMap && onCreatePinCard) {
                        onCreatePinCard(currentMap.id, contextMenu.mapPercentX!, contextMenu.mapPercentY!);
                      }
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[#2e2e2e] flex items-center gap-2.5 transition-colors text-emerald-400 font-semibold cursor-pointer"
                  >
                    <Icons.PlusCircle size={14} />
                    <span>{t.map.addPinHere}</span>
                  </button>

                  {/* Tambah Kartu dari Galeri */}
                  <button
                    type="button"
                    onClick={() => {
                      setGalleryTargetPos({
                        x: contextMenu.mapPercentX!,
                        y: contextMenu.mapPercentY!,
                      });
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[#2e2e2e] flex items-center gap-2.5 transition-colors text-[#0d99ff] font-semibold cursor-pointer"
                  >
                    <Icons.LayoutGrid size={14} />
                    <span>{t.map.addFromGalleryHere}</span>
                  </button>

                  <div className="my-1 border-t border-[#383838]" />
                </>
              )}

              {/* Pusatkan Peta ke Sini */}
              <button
                type="button"
                onClick={() => {
                  handleCenterOnPos(contextMenu.x, contextMenu.y);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full px-3 py-2 text-left hover:bg-[#2e2e2e] flex items-center gap-2.5 transition-colors text-slate-200 cursor-pointer"
              >
                <Icons.Target size={14} className="text-[#0d99ff]" />
                <span>{t.map.centerMapHere}</span>
              </button>

              {/* Reset Zoom (100%) */}
              <button
                type="button"
                onClick={() => {
                  zoomRef.current = 1;
                  panRef.current = { x: 0, y: 0 };
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full px-3 py-2 text-left hover:bg-[#2e2e2e] flex items-center gap-2.5 transition-colors text-slate-200 cursor-pointer"
              >
                <Icons.RotateCcw size={14} className="text-amber-400" />
                <span>{t.map.resetZoom} (100%)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ADD CARD FROM GALLERY MODAL */}
      <AddCardFromGalleryModal
        isOpen={!!galleryTargetPos}
        onClose={() => setGalleryTargetPos(null)}
        allCards={cards}
        allDecks={decks}
        targetPosition={galleryTargetPos || { x: 0, y: 0 }}
        title={t.map.addCardToMapModal}
        description={t.map.addCardToMapDesc}
        submitLabel={
          language === 'en'
            ? 'Add ($COUNT) Pins to Map'
            : 'Tambahkan ($COUNT) Pin ke Peta'
        }
        onAddCardsToCanvas={(cardIds, pos) => {
          if (!currentMap) return;
          const selectedCards = cards.filter((c) => cardIds.includes(c.id));
          const newPins: MapPin[] = selectedCards.map((card, index) => ({
            id: `pin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`,
            mapId: currentMap.id,
            cardId: card.id,
            title: card.title,
            description: card.summary || '',
            x: Math.min(100, Math.max(0, pos.x + (index * 2))),
            y: Math.min(100, Math.max(0, pos.y + (index * 2))),
            color: '#0d99ff',
            createdAt: Date.now(),
          }));

          onSaveMap({
            ...currentMap,
            pins: [...currentMap.pins, ...newPins],
            updatedAt: Date.now(),
          });
          setGalleryTargetPos(null);
        }}
      />

      {showMapModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 select-none">
          <form
            onSubmit={handleSaveMapSubmit}
            className="bg-[#222222] border border-[#383838] rounded-2xl max-w-lg w-full p-5 text-white shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#383838] pb-3">
              <h3 className="font-bold text-base flex items-center gap-2 text-white">
                <Icons.Map size={18} className="text-[#0d99ff]" />
                <span>
                  {mapFormMode === 'create' ? t.map.createMapTitle : t.map.editMapTitle}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <Icons.X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {t.map.mapName} *
                </label>
                <input
                  type="text"
                  required
                  value={mapName}
                  onChange={(e) => setMapName(e.target.value)}
                  placeholder={t.map.mapNamePlaceholder}
                  className="w-full bg-[#181818] border border-[#383838] focus:border-[#0d99ff] rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {t.map.mapDescription}
                </label>
                <textarea
                  value={mapDesc}
                  onChange={(e) => setMapDesc(e.target.value)}
                  placeholder={t.map.mapDescriptionPlaceholder}
                  rows={2}
                  className="w-full bg-[#181818] border border-[#383838] focus:border-[#0d99ff] rounded-xl px-3 py-2 text-white outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {t.map.selectImageFile} *
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl bg-[#181818] hover:bg-[#383838] border border-[#383838] text-slate-200 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Icons.Upload size={14} className="text-[#0d99ff]" />
                    <span>{t.map.selectImageFile}</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileSelect}
                    className="hidden"
                  />
                  <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
                    {mapImageUrl ? 'Gambar dipilih' : 'Belum ada gambar'}
                  </span>
                </div>
              </div>

              {mapImageUrl && (
                <div className="border border-[#383838] rounded-xl overflow-hidden max-h-40 bg-[#121212] flex items-center justify-center p-2">
                  <img
                    src={mapImageUrl}
                    alt="Map Preview"
                    className="max-h-36 object-contain rounded-lg"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#383838]">
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                className="px-4 py-2 rounded-xl bg-[#181818] hover:bg-[#383838] text-slate-300 text-xs font-semibold cursor-pointer"
              >
                {t.map.cancel}
              </button>
              <button
                type="submit"
                disabled={!mapImageUrl}
                className="px-4 py-2 rounded-xl bg-[#0d99ff] hover:bg-[#0088eb] disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                {t.map.saveMap}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CUSTOM CONFIRMATION & ALERT MODAL */}
      <ConfirmModal
        config={confirmModalConfig}
        onClose={() => setConfirmModalConfig(null)}
      />
    </div>
  );
};
