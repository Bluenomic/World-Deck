import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { WorldMap, MapPin, WorldCard } from '../types';
import * as Icons from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface MapViewProps {
  worldMaps: WorldMap[];
  cards: WorldCard[];
  onSaveMap: (map: WorldMap) => void;
  onDeleteMap: (mapId: string) => void;
  onOpenCard: (cardId: string) => void;
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
  onSaveMap,
  onDeleteMap,
  onOpenCard,
}) => {
  const { t, getCategoryLabel } = useLanguage();
  
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
  const [editingPin, setEditingPin] = useState<MapPin | null>(null);

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Mutable refs for zoom & pan to prevent stale closure lag during rapid wheel events
  const zoomRef = useRef<number>(zoom);
  const panRef = useRef<{ x: number; y: number }>(pan);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  // Reset zoom & pan when map changes
  useEffect(() => {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedPinId(null);
    setEditingPin(null);
    setIsAddPinMode(false);
    setHasDragged(false);
  }, [selectedMapId]);

  // Precise Cursor-Centric Focal Zoom
  const zoomAtPoint = useCallback((targetZoom: number, clientX: number, clientY: number) => {
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

  // Wheel zoom centered at mouse cursor position (supports Ctrl+Wheel like Canvas, and direct wheel zoom/pan)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Ctrl + Wheel / Pinch gesture
        const factor = e.deltaY < 0 ? 1.15 : 0.85;
        zoomAtPoint(zoomRef.current * factor, e.clientX, e.clientY);
      } else if (e.shiftKey) {
        // Shift + Wheel = Horizontal pan
        const scrollDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        const nextPanX = panRef.current.x - scrollDelta * 0.8;
        panRef.current = { ...panRef.current, x: nextPanX };
        setPan((prev) => ({ ...prev, x: nextPanX }));
      } else {
        // Standard mouse wheel: perform focal zoom centered at cursor position
        const factor = e.deltaY < 0 ? 1.15 : 0.85;
        zoomAtPoint(zoomRef.current * factor, e.clientX, e.clientY);
      }
    };

    el.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onNativeWheel);
    };
  }, [zoomAtPoint]);

  // Global mouseup listener to release pan/drag anywhere
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsPanning(false);
      setDraggingPinId(null);
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
    if (window.confirm(t.map.deleteMapConfirm)) {
      onDeleteMap(currentMap.id);
    }
  };

  // Handle click on Map Image to add pin
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

    const newPin: MapPin = {
      id: `pin_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      title: t.map.pinTitlePlaceholder,
      description: '',
      x: Math.round(percentX * 10) / 10,
      y: Math.round(percentY * 10) / 10,
      color: '#0d99ff',
    };

    const updatedPins = [...currentMap.pins, newPin];
    onSaveMap({
      ...currentMap,
      pins: updatedPins,
      updatedAt: Date.now(),
    });

    setSelectedPinId(newPin.id);
    setEditingPin(newPin);
    setIsAddPinMode(false);
  };

  // Container Mouse Down for Google Maps style pan-and-drag
  const handleContainerMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, .map-pin-element')) return;

    if (isAddPinMode) return;

    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setHasDragged(false);
    }
  };

  // Update Pin
  const handleSavePin = (updatedPin: MapPin) => {
    if (!currentMap) return;
    const newPins = currentMap.pins.map((p) => (p.id === updatedPin.id ? updatedPin : p));
    onSaveMap({
      ...currentMap,
      pins: newPins,
      updatedAt: Date.now(),
    });
    setEditingPin(null);
  };

  // Delete Pin
  const handleDeletePin = (pinId: string) => {
    if (!currentMap) return;
    if (window.confirm(t.map.deletePinConfirm)) {
      const newPins = currentMap.pins.filter((p) => p.id !== pinId);
      onSaveMap({
        ...currentMap,
        pins: newPins,
        updatedAt: Date.now(),
      });
      if (selectedPinId === pinId) setSelectedPinId(null);
      if (editingPin?.id === pinId) setEditingPin(null);
    }
  };

  // Drag pin handlers
  const handlePinMouseDown = (e: React.MouseEvent, pinId: string) => {
    e.stopPropagation();
    if (isAddPinMode) return;
    setDraggingPinId(pinId);
    setSelectedPinId(pinId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const newPanX = e.clientX - panStart.x;
      const newPanY = e.clientY - panStart.y;
      if (Math.abs(newPanX - pan.x) > 3 || Math.abs(newPanY - pan.y) > 3) {
        setHasDragged(true);
      }
      setPan({ x: newPanX, y: newPanY });
      return;
    }

    if (draggingPinId && currentMap && imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const percentX = Math.min(100, Math.max(0, (clickX / rect.width) * 100));
      const percentY = Math.min(100, Math.max(0, (clickY / rect.height) * 100));

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
  };

  // Filtered pins based on search query
  const filteredPins = useMemo(() => {
    if (!currentMap) return [];
    if (!searchQuery.trim()) return currentMap.pins;

    const q = searchQuery.toLowerCase();
    return currentMap.pins.filter((pin) => {
      const titleMatch = pin.title.toLowerCase().includes(q);
      const descMatch = (pin.description || '').toLowerCase().includes(q);
      const linkedCard = cards.find((c) => c.id === pin.cardId);
      const cardMatch = linkedCard
        ? linkedCard.title.toLowerCase().includes(q) ||
          linkedCard.tags.some((t) => t.toLowerCase().includes(q))
        : false;
      return titleMatch || descMatch || cardMatch;
    });
  }, [currentMap, searchQuery, cards]);

  const selectedPin = useMemo(
    () => currentMap?.pins.find((p) => p.id === selectedPinId) || null,
    [currentMap, selectedPinId]
  );

  const selectedPinCard = useMemo(
    () => (selectedPin?.cardId ? cards.find((c) => c.id === selectedPin.cardId) || null : null),
    [selectedPin, cards]
  );

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
                {worldMaps.map((map) => (
                  <option key={map.id} value={map.id}>
                    {map.name} ({map.pins.length} {t.map.pinsCount})
                  </option>
                ))}
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
                zoomRef.current = 1;
                panRef.current = { x: 0, y: 0 };
                setZoom(1);
                setPan({ x: 0, y: 0 });
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
                  const linkedCard = cards.find((c) => c.id === pin.cardId);
                  const pinColor = pin.color || '#0d99ff';

                  return (
                    <div
                      key={pin.id}
                      style={{
                        left: `${pin.x}%`,
                        top: `${pin.y}%`,
                      }}
                      onMouseDown={(e) => handlePinMouseDown(e, pin.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPinId(pin.id);
                      }}
                      className={`map-pin-element absolute -translate-x-1/2 -translate-y-full cursor-pointer z-10 transition-transform group ${
                        isSelected ? 'scale-125 z-30' : 'hover:scale-110'
                      }`}
                    >
                      {/* Pin Icon / Marker Badge */}
                      <div className="relative flex flex-col items-center">
                        <div
                          style={{ backgroundColor: pinColor }}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-xl border-2 border-white/80 group-hover:border-white transition-colors"
                        >
                          {linkedCard ? (
                            <Icons.MapPin size={16} />
                          ) : (
                            <Icons.Pin size={14} />
                          )}
                        </div>
                        {/* Pin Pointer Arrow */}
                        <div
                          style={{ borderTopColor: pinColor }}
                          className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] -mt-0.5"
                        />

                        {/* Title Label below pin */}
                        <div className="mt-1 bg-slate-950/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-xs border border-white/20 whitespace-nowrap max-w-[120px] truncate shadow-md">
                          {pin.title}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PIN DRAWER / SIDEBAR DETAILS */}
            {selectedPin && (
              <div className="absolute right-4 top-4 bottom-4 w-80 bg-[#222222]/95 backdrop-blur-md border border-[#383838] rounded-2xl shadow-2xl flex flex-col z-30 overflow-hidden text-white animate-in slide-in-from-right-5 duration-200">
                {/* Drawer Header */}
                <div className="p-4 border-b border-[#383838] flex items-center justify-between bg-[#1e1e1e]">
                  <div className="flex items-center gap-2">
                    <div
                      style={{ backgroundColor: selectedPin.color || '#0d99ff' }}
                      className="w-4 h-4 rounded-full"
                    />
                    <h3 className="font-bold text-sm truncate max-w-[180px]">
                      {selectedPin.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingPin(selectedPin)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#383838] transition-colors"
                      title={t.map.savePin}
                    >
                      <Icons.Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePin(selectedPin.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-[#383838] transition-colors"
                      title={t.map.deletePin}
                    >
                      <Icons.Trash2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPinId(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#383838] transition-colors"
                    >
                      <Icons.X size={16} />
                    </button>
                  </div>
                </div>

                {/* Drawer Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Pin Description */}
                  {selectedPin.description ? (
                    <div className="text-xs text-slate-300 bg-[#1a1a1a] p-3 rounded-xl border border-[#323232] leading-relaxed whitespace-pre-wrap">
                      {selectedPin.description}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic">
                      Tidak ada deskripsi pin.
                    </div>
                  )}

                  {/* Linked Card Preview */}
                  <div className="border-t border-[#383838] pt-3">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>{t.map.linkedCard}</span>
                    </div>

                    {selectedPinCard ? (
                      <div className="bg-[#1a1a1a] border border-[#383838] rounded-xl p-3 space-y-2">
                        {selectedPinCard.imageUrl && (
                          <img
                            src={selectedPinCard.imageUrl}
                            alt={selectedPinCard.title}
                            className="w-full h-28 object-cover rounded-lg border border-[#323232]"
                          />
                        )}
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-sm text-white truncate">
                              {selectedPinCard.title}
                            </h4>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#0d99ff]/20 text-[#0d99ff] border border-[#0d99ff]/30 shrink-0">
                              {getCategoryLabel(selectedPinCard.category)}
                            </span>
                          </div>
                          {selectedPinCard.summary && (
                            <p className="text-xs text-slate-300 mt-1 line-clamp-3 leading-snug">
                              {selectedPinCard.summary}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => onOpenCard(selectedPinCard.id)}
                          className="w-full mt-2 py-1.5 px-3 rounded-lg bg-[#0d99ff] hover:bg-[#0088eb] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Icons.ExternalLink size={13} />
                          <span>{t.map.viewCard}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 bg-[#1a1a1a] p-3 rounded-xl border border-[#323232] text-center space-y-2">
                        <p>{t.map.noLinkedCard}</p>
                        <button
                          type="button"
                          onClick={() => setEditingPin(selectedPin)}
                          className="text-xs text-[#0d99ff] underline hover:text-white font-medium cursor-pointer"
                        >
                          Hubungkan Kartu
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Drawer Footer */}
                <div className="p-3 border-t border-[#383838] bg-[#1e1e1e] text-[11px] text-slate-400 flex items-center justify-between">
                  <span>{t.map.dragPinHint}</span>
                  <span className="font-mono text-slate-500">
                    X: {selectedPin.x}% Y: {selectedPin.y}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* EDIT PIN MODAL */}
      {editingPin && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 select-none">
          <div className="bg-[#222222] border border-[#383838] rounded-2xl max-w-md w-full p-5 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#383838] pb-3">
              <h3 className="font-bold text-base flex items-center gap-2 text-white">
                <Icons.MapPin size={18} className="text-[#0d99ff]" />
                <span>Edit Pin</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingPin(null)}
                className="text-slate-400 hover:text-white"
              >
                <Icons.X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {t.map.pinTitle}
                </label>
                <input
                  type="text"
                  value={editingPin.title}
                  onChange={(e) => setEditingPin({ ...editingPin, title: e.target.value })}
                  placeholder={t.map.pinTitlePlaceholder}
                  className="w-full bg-[#181818] border border-[#383838] focus:border-[#0d99ff] rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {t.map.pinDescription}
                </label>
                <textarea
                  value={editingPin.description || ''}
                  onChange={(e) => setEditingPin({ ...editingPin, description: e.target.value })}
                  placeholder={t.map.pinDescriptionPlaceholder}
                  rows={3}
                  className="w-full bg-[#181818] border border-[#383838] focus:border-[#0d99ff] rounded-xl px-3 py-2 text-white outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {t.map.linkedCard}
                </label>
                <select
                  value={editingPin.cardId || ''}
                  onChange={(e) =>
                    setEditingPin({ ...editingPin, cardId: e.target.value || undefined })
                  }
                  className="w-full bg-[#181818] border border-[#383838] focus:border-[#0d99ff] rounded-xl px-3 py-2 text-white outline-none cursor-pointer"
                >
                  <option value="">-- {t.map.noLinkedCard} --</option>
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      [{getCategoryLabel(card.category)}] {card.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Color Accent</label>
                <div className="flex items-center gap-2">
                  {PIN_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setEditingPin({ ...editingPin, color: c.value })}
                      style={{ backgroundColor: c.value }}
                      className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                        (editingPin.color || '#0d99ff') === c.value
                          ? 'border-white scale-110 shadow-md'
                          : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#383838]">
              <button
                type="button"
                onClick={() => setEditingPin(null)}
                className="px-4 py-2 rounded-xl bg-[#181818] hover:bg-[#383838] text-slate-300 text-xs font-semibold"
              >
                {t.map.cancel}
              </button>
              <button
                type="button"
                onClick={() => handleSavePin(editingPin)}
                className="px-4 py-2 rounded-xl bg-[#0d99ff] hover:bg-[#0088eb] text-white text-xs font-bold"
              >
                {t.map.savePin}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MAP MODAL */}
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
    </div>
  );
};
