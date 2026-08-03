import React, { useState, useEffect, useRef } from 'react';
import type { WorldCard, CardConnection } from '../types';
import { generateId } from '../utils/helpers';
import * as Icons from 'lucide-react';

interface TimelineTrack {
  id: string;
  name: string;
  order: number; // Vertical order index (-2, -1, 0, 1, 2...)
}

interface SimpleTimelineNode {
  id: string;
  trackId: string;
  x: number;
  title: string;
  dateLabel?: string;
  description?: string;
  cardId?: string;
}

interface TimelineViewProps {
  cards: WorldCard[];
  connections?: CardConnection[];
  onCardClick: (card: WorldCard) => void;
  activeWorldId?: string;
}

// Minimum gap between adjacent events on the same track
const MIN_EVENT_GAP = 240;

// Dynamic Inter-Track Spacing Engine
const calculateTrackLayout = (sortedTracks: TimelineTrack[], allNodes: SimpleTimelineNode[]) => {
  const relativeYMap: { [trackId: string]: number } = {};
  if (sortedTracks.length === 0) return { relativeYMap, totalSpan: 0, stackCenter: 0 };

  let currentY = 0;
  relativeYMap[sortedTracks[0].id] = 0;

  for (let i = 0; i < sortedTracks.length - 1; i++) {
    const trackUpper = sortedTracks[i];
    const trackLower = sortedTracks[i + 1];

    const upperNodes = allNodes.filter((n) => n.trackId === trackUpper.id);
    const lowerNodes = allNodes.filter((n) => n.trackId === trackLower.id);

    // Find max downward extension from upper track
    let maxDownward = 0;
    upperNodes.forEach((node, idx) => {
      const isUpperStem = idx % 2 === 0;
      if (!isUpperStem) {
        // Lower stem extending DOWNWARD towards trackLower
        const cardHeight = node.description ? 150 : 120;
        maxDownward = Math.max(maxDownward, 70 + cardHeight);
      }
    });

    // Find max upward extension from lower track
    let maxUpward = 0;
    lowerNodes.forEach((node, idx) => {
      const isUpperStem = idx % 2 === 0;
      if (isUpperStem) {
        // Upper stem extending UPWARD towards trackUpper
        const cardHeight = node.description ? 150 : 120;
        maxUpward = Math.max(maxUpward, 70 + cardHeight);
      }
    });

    // Calculate required gap between trackUpper and trackLower
    let gap = 240; // Base gap when empty or no opposing cards

    if (maxDownward > 0 && maxUpward > 0) {
      // Both tracks have cards extending towards each other! Expand gap dynamically!
      gap = maxDownward + maxUpward + 50; // e.g. 210 + 210 + 50 = 470px clearance!
    } else if (maxDownward > 0) {
      gap = Math.max(240, maxDownward + 80);
    } else if (maxUpward > 0) {
      gap = Math.max(240, maxUpward + 80);
    }

    currentY += gap;
    relativeYMap[trackLower.id] = currentY;
  }

  const totalSpan = currentY;
  const stackCenter = totalSpan / 2;

  return { relativeYMap, totalSpan, stackCenter };
};

export const TimelineView: React.FC<TimelineViewProps> = ({
  cards,
  onCardClick,
  activeWorldId = 'default',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const storageKey = `worlddeck_timeline_v4_${activeWorldId}`;

  // Timeline Tracks State
  const [tracks, setTracks] = useState<TimelineTrack[]>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_tracks`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      { id: 'track_main', name: 'GARIS WAKTU UTAMA', order: 0 },
    ];
  });

  // Timeline Nodes State
  const [nodes, setNodes] = useState<SimpleTimelineNode[]>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_nodes`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((n: any) => ({ ...n, trackId: n.trackId || 'track_main' }));
      }
    } catch (e) {}
    return [];
  });

  // 2D Pan Offset (Horizontal & Bounded Vertical)
  const [scrollX, setScrollX] = useState<number>(100);
  const [scrollY, setScrollY] = useState<number>(0);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Hover state on track axis line
  const [hoverTrackId, setHoverTrackId] = useState<string | null>(null);
  const [hoverWorldX, setHoverWorldX] = useState<number | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetTrack?: TimelineTrack;
    isAbove?: boolean;
    clickOrderPosition?: number;
  } | null>(null);

  // Track Name Modal State
  const [showTrackModal, setShowTrackModal] = useState<boolean>(false);
  const [editingTrack, setEditingTrack] = useState<TimelineTrack | null>(null);
  const [newTrackOrderPosition, setNewTrackOrderPosition] = useState<number | null>(null);
  const [tempTrackName, setTempTrackName] = useState<string>('');

  // Node Modal & Readers
  const [showNodeModal, setShowNodeModal] = useState<boolean>(false);
  const [targetTrackId, setTargetTrackId] = useState<string>('track_main');
  const [modalX, setModalX] = useState<number>(300);
  const [editingNode, setEditingNode] = useState<SimpleTimelineNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<SimpleTimelineNode | null>(null);
  const [readerNode, setReaderNode] = useState<SimpleTimelineNode | null>(null);

  // Dragging Node State
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [initialNodeX, setInitialNodeX] = useState<number>(0);

  // Layout Calculations
  const sortedTracks = [...tracks].sort((a, b) => a.order - b.order);
  const { relativeYMap, totalSpan, stackCenter } = calculateTrackLayout(sortedTracks, nodes);

  // Persist State
  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}_tracks`, JSON.stringify(tracks));
      localStorage.setItem(`${storageKey}_nodes`, JSON.stringify(nodes));
    } catch (e) {}
  }, [tracks, nodes, storageKey]);

  // Close context menu on outside click
  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  const maxScrollOffset = (vHeight: number) => {
    return Math.max(0, (totalSpan + 350 - vHeight) / 2 + 100);
  };

  // Helper to calculate Y center on screen for a given track
  const getTrackCenterY = (trackId: string, viewportHeight: number) => {
    const trackRelY = relativeYMap[trackId] ?? 0;
    return viewportHeight / 2 + scrollY + (trackRelY - stackCenter);
  };

  // Global Window Mouse Move & Mouse Up Listener for Dragging Nodes Smoothly
  useEffect(() => {
    if (!draggingNodeId) return;

    const draggingNode = nodes.find((n) => n.id === draggingNodeId);
    if (!draggingNode) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartX;
      const rawNextX = initialNodeX + deltaX;

      const sameTrackNodes = nodes.filter(
        (n) => n.trackId === draggingNode.trackId && n.id !== draggingNodeId
      );
      const sortedSameTrack = [...sameTrackNodes].sort((a, b) => a.x - b.x);

      const leftNeighbor = [...sortedSameTrack].reverse().find((n) => n.x <= initialNodeX);
      const rightNeighbor = sortedSameTrack.find((n) => n.x >= initialNodeX);

      const minAllowedX = leftNeighbor ? leftNeighbor.x + MIN_EVENT_GAP : 20;
      const maxAllowedX = rightNeighbor ? rightNeighbor.x - MIN_EVENT_GAP : Infinity;

      const clampedX = Math.max(minAllowedX, Math.min(maxAllowedX, Math.round(rawNextX)));

      setNodes((prev) => prev.map((n) => (n.id === draggingNodeId ? { ...n, x: clampedX } : n)));
    };

    const handleWindowMouseUp = () => {
      setDraggingNodeId(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [draggingNodeId, dragStartX, initialNodeX, nodes]);

  // Auto-Spacing Helper Function
  const applyAutoSpacing = (eventList: SimpleTimelineNode[], trackId: string): SimpleTimelineNode[] => {
    const trackEvents = eventList.filter((n) => n.trackId === trackId);
    const otherEvents = eventList.filter((n) => n.trackId !== trackId);

    if (trackEvents.length <= 1) return eventList;

    const sorted = [...trackEvents].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i++) {
      const prevX = sorted[i - 1].x;
      if (sorted[i].x < prevX + MIN_EVENT_GAP) {
        sorted[i] = { ...sorted[i], x: prevX + MIN_EVENT_GAP };
      }
    }

    return [...otherEvents, ...sorted];
  };

  // Pointer Movement Handlers
  const handlePointerMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = rect.height;

    if (isPanning) {
      setScrollX(e.clientX - panStart.x);
      const rawY = e.clientY - panStart.y;
      const clampedY = Math.max(
        -maxScrollOffset(viewportHeight),
        Math.min(maxScrollOffset(viewportHeight), rawY)
      );
      setScrollY(clampedY);
      return;
    }

    if (draggingNodeId) return;

    const mouseY = e.clientY - rect.top;
    const worldX = Math.round(e.clientX - rect.left - scrollX);

    // Check hover proximity to any track line
    let foundTrackId: string | null = null;

    for (const track of sortedTracks) {
      const trackY = getTrackCenterY(track.id, viewportHeight);
      if (Math.abs(mouseY - trackY) <= 35) {
        const trackNodes = nodes.filter((n) => n.trackId === track.id);
        const isNearNode = trackNodes.some((n) => Math.abs(n.x - worldX) < 80);

        if (!isNearNode) {
          foundTrackId = track.id;
        }
        break;
      }
    }

    if (foundTrackId) {
      setHoverTrackId(foundTrackId);
      setHoverWorldX(worldX);
    } else {
      setHoverTrackId(null);
      setHoverWorldX(null);
    }
  };

  const handleMouseDownBg = (e: React.MouseEvent) => {
    if (e.button === 0 && (e.target === containerRef.current || (e.target as HTMLElement).id === 'timeline-center-bg')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - scrollX, y: e.clientY - scrollY });
      setReaderNode(null);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!containerRef.current) return;
    const viewportHeight = containerRef.current.getBoundingClientRect().height;

    if (e.shiftKey) {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      setScrollX((prev) => prev - delta * 0.9);
    } else {
      setScrollY((prev) => {
        const rawY = prev - e.deltaY * 0.9;
        const maxLimit = maxScrollOffset(viewportHeight);
        return Math.max(-maxLimit, Math.min(maxLimit, rawY));
      });
    }
  };

  // Right Click Context Menu Handler (Parallel Timelines)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = rect.height;
    const mouseY = e.clientY - rect.top;

    // Check if right clicked directly on an existing track line
    let targetTrack: TimelineTrack | undefined;
    for (const track of sortedTracks) {
      const trackY = getTrackCenterY(track.id, viewportHeight);
      if (Math.abs(mouseY - trackY) <= 35) {
        targetTrack = track;
        break;
      }
    }

    if (targetTrack) {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        targetTrack,
      });
    } else {
      // Right-clicked on EMPTY SPACE: Calculate relative order position
      const firstTrackY = getTrackCenterY(sortedTracks[0].id, viewportHeight);
      const lastTrackY = getTrackCenterY(sortedTracks[sortedTracks.length - 1].id, viewportHeight);

      let isAbove = false;
      let newOrder = 0;

      if (mouseY < firstTrackY) {
        isAbove = true;
        newOrder = sortedTracks[0].order - 1;
      } else if (mouseY > lastTrackY) {
        isAbove = false;
        newOrder = sortedTracks[sortedTracks.length - 1].order + 1;
      } else {
        // Inserted between tracks
        for (let i = 0; i < sortedTracks.length - 1; i++) {
          const y1 = getTrackCenterY(sortedTracks[i].id, viewportHeight);
          const y2 = getTrackCenterY(sortedTracks[i + 1].id, viewportHeight);
          if (mouseY >= y1 && mouseY <= y2) {
            newOrder = (sortedTracks[i].order + sortedTracks[i + 1].order) / 2;
            isAbove = mouseY < (y1 + y2) / 2;
            break;
          }
        }
      }

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        isAbove,
        clickOrderPosition: newOrder,
      });
    }
  };

  // Node Dragging Start
  const handleStartDragNode = (node: SimpleTimelineNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingNodeId(node.id);
    setDragStartX(e.clientX);
    setInitialNodeX(node.x);
  };

  // Save Event Node
  const handleSaveNode = (data: { title: string; dateLabel?: string; description?: string; cardId?: string }) => {
    if (editingNode) {
      setNodes((prev) => {
        const updated = prev.map((n) => (n.id === editingNode.id ? { ...n, ...data } : n));
        return applyAutoSpacing(updated, editingNode.trackId);
      });
    } else {
      const newNode: SimpleTimelineNode = {
        id: generateId('tnode'),
        trackId: targetTrackId,
        x: modalX,
        ...data,
      };
      setNodes((prev) => {
        const updated = [...prev, newNode];
        return applyAutoSpacing(updated, targetTrackId);
      });
      setSelectedNode(newNode);
    }
    setShowNodeModal(false);
    setEditingNode(null);
  };

  const handleDeleteNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    if (selectedNode?.id === id) setSelectedNode(null);
    if (readerNode?.id === id) setReaderNode(null);
  };

  // Add Parallel Track
  const handleAddParallelTrack = (orderPos: number) => {
    setEditingTrack(null);
    setNewTrackOrderPosition(orderPos);
    setTempTrackName(`GARIS WAKTU PARALEL ${tracks.length + 1}`);
    setShowTrackModal(true);
  };

  // Delete Parallel Track
  const handleDeleteTrack = (trackId: string) => {
    if (tracks.length <= 1) {
      alert('Tidak dapat menghapus garis waktu terakhir.');
      return;
    }
    if (window.confirm('Hapus garis waktu paralel ini beserta semua kejadiannya?')) {
      setTracks((prev) => prev.filter((t) => t.id !== trackId));
      setNodes((prev) => prev.filter((n) => n.trackId !== trackId));
    }
  };

  // Save Track Name or New Track
  const handleSaveTrackModal = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = tempTrackName.trim().toUpperCase() || 'GARIS WAKTU PARALEL';

    if (editingTrack) {
      setTracks((prev) => prev.map((t) => (t.id === editingTrack.id ? { ...t, name: cleanName } : t)));
    } else if (newTrackOrderPosition !== null) {
      const newTrack: TimelineTrack = {
        id: generateId('track'),
        name: cleanName,
        order: newTrackOrderPosition,
      };
      setTracks((prev) => [...prev, newTrack].sort((a, b) => a.order - b.order));
    }
    setShowTrackModal(false);
    setEditingTrack(null);
    setNewTrackOrderPosition(null);
  };

  const handleClearAll = () => {
    if (window.confirm('Bersihkan semua kejadian di seluruh garis waktu?')) {
      setNodes([]);
      setSelectedNode(null);
      setReaderNode(null);
    }
  };

  const linkedCardForReader = readerNode?.cardId ? cards.find((c) => c.id === readerNode.cardId) : null;
  const viewportHeight = containerRef.current ? containerRef.current.getBoundingClientRect().height : 600;

  return (
    <div className="flex-1 bg-black text-white flex flex-col relative overflow-hidden select-none">
      
      {/* Sleek Top Header Toolbar */}
      <div className="px-5 py-3 bg-black border-b border-zinc-800 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 flex items-center justify-center font-bold">
            <Icons.Clock size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white leading-none">Timeline Multi-Track</h2>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                {tracks.length} Garis Waktu Paralel
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Jarak vertikal menyesuaikan otomatis agar kartu kejadian tidak pernah bertabrakan. Scroll dibatasi pada area timeline.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const lastOrder = Math.max(...tracks.map((t) => t.order)) + 1;
              handleAddParallelTrack(lastOrder);
            }}
            className="px-3 py-1.5 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white hover:bg-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Icons.Plus size={14} />
            <span>+ Garis Waktu Baru</span>
          </button>

          {nodes.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-rose-400 hover:border-rose-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Icons.Trash2 size={13} />
              <span>Bersihkan</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Viewport (Solid Black Background) */}
      <div className="flex-1 relative overflow-hidden flex">
        <div
          ref={containerRef}
          onMouseDown={handleMouseDownBg}
          onMouseMove={handlePointerMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={handleContextMenu}
          className="flex-1 w-full h-full relative overflow-hidden bg-black cursor-grab active:cursor-grabbing"
        >
          {/* Transparent Click Target Area */}
          <div id="timeline-center-bg" className="absolute inset-0 w-full h-full bg-black" />

          {/* Render Multi-Track Horizontal Lines & Labels */}
          {sortedTracks.map((track) => {
            const trackCenterY = getTrackCenterY(track.id, viewportHeight);

            return (
              <React.Fragment key={track.id}>
                {/* Thick Grey Horizontal Timeline Axis Line */}
                <div
                  style={{ top: `${trackCenterY}px` }}
                  className="absolute left-0 right-0 -translate-y-1/2 h-1.5 bg-zinc-600 pointer-events-none shadow-[0_0_10px_rgba(161,161,170,0.25)]"
                />

                {/* Floating Track Name Badge on Left Margin */}
                <div
                  style={{ top: `${trackCenterY}px` }}
                  className="absolute left-6 -translate-y-1/2 z-20 pointer-events-none"
                >
                  <span className="px-2.5 py-1 rounded-lg bg-zinc-900/90 border border-zinc-700/80 text-[10px] font-mono font-bold text-zinc-300 shadow-lg backdrop-blur-xs uppercase tracking-wider">
                    {track.name}
                  </span>
                </div>
              </React.Fragment>
            );
          })}

          {/* SVG Layer for Directional Arrows & Google Maps Style Repeating Track Names */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <g transform={`translate(${scrollX}, 0)`}>
              {sortedTracks.map((track) => {
                const trackY = getTrackCenterY(track.id, viewportHeight);

                return (
                  <g key={`svg-track-${track.id}`}>
                    {/* Directional Arrow Markers along each Track */}
                    {Array.from({ length: 50 }).map((_, idx) => {
                      const arrowX = -1000 + idx * 180;
                      return (
                        <path
                          key={`arrow-${track.id}-${idx}`}
                          d="M 0 -5 L 8 0 L 0 5"
                          fill="none"
                          stroke="#a1a1aa"
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ transform: `translate(${arrowX}px, ${trackY}px)` }}
                        />
                      );
                    })}

                    {/* Google Maps Style Repeating Track Name Labels along each Track */}
                    {Array.from({ length: 40 }).map((_, idx) => {
                      const labelX = -750 + idx * 400;
                      return (
                        <text
                          key={`label-${track.id}-${idx}`}
                          x={labelX}
                          y={trackY - 12}
                          fill="#a1a1aa"
                          fillOpacity={0.35}
                          fontSize={11}
                          fontWeight="700"
                          letterSpacing="0.25em"
                          textAnchor="middle"
                          className="uppercase select-none font-mono"
                        >
                          {track.name}
                        </text>
                      );
                    })}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Floating Hover (+) Button on Target Track Axis Line */}
          {hoverTrackId !== null && hoverWorldX !== null && !isPanning && !draggingNodeId && (
            <div
              onClick={() => {
                setEditingNode(null);
                setTargetTrackId(hoverTrackId);
                setModalX(hoverWorldX);
                setShowNodeModal(true);
              }}
              style={{
                left: `${hoverWorldX + scrollX}px`,
                top: `${getTrackCenterY(hoverTrackId, viewportHeight)}px`,
              }}
              className="absolute -translate-y-1/2 -translate-x-1/2 z-40 cursor-pointer animate-in zoom-in-75 duration-150"
            >
              <button
                type="button"
                className="w-8 h-8 rounded-full bg-zinc-700 hover:bg-zinc-500 text-white flex items-center justify-center shadow-lg hover:scale-125 active:scale-95 transition-all ring-4 ring-zinc-500/30 cursor-pointer"
                title="Klik untuk menambah kejadian di posisi ini"
              >
                <Icons.Plus size={18} />
              </button>
            </div>
          )}

          {/* Render Timeline Nodes grouped by Track */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ transform: `translateX(${scrollX}px)` }}
          >
            {nodes.map((node, index) => {
              const nodeTrack = tracks.find((t) => t.id === node.trackId) || sortedTracks[0];
              const trackY = getTrackCenterY(nodeTrack.id, viewportHeight);

              // Calculate index within same track for upper/lower alternating stems
              const sameTrackNodes = nodes.filter((n) => n.trackId === nodeTrack.id).sort((a, b) => a.x - b.x);
              const nodeTrackIndex = sameTrackNodes.findIndex((n) => n.id === node.id);
              const isUpper = (nodeTrackIndex >= 0 ? nodeTrackIndex : index) % 2 === 0;

              const stemHeight = 70;
              const isSelected = selectedNode?.id === node.id;

              return (
                <div
                  key={node.id}
                  className="absolute pointer-events-auto"
                  style={{ left: `${node.x}px`, top: `${trackY}px` }}
                >
                  {/* Stem Line connected to Track Horizontal Line */}
                  <div
                    className={`absolute left-1/2 -translate-x-1/2 w-0.5 transition-colors ${
                      isSelected ? 'bg-zinc-300 shadow-[0_0_8px_rgba(255,255,255,0.6)]' : 'bg-zinc-700'
                    }`}
                    style={{
                      top: isUpper ? `-${stemHeight}px` : '0px',
                      height: `${stemHeight}px`,
                    }}
                  />

                  {/* Node Point Dot Circle */}
                  <div
                    onMouseDown={(e) => handleStartDragNode(node, e)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode(node);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode(node);
                      setReaderNode(node);
                    }}
                    className={`absolute -left-4 -top-4 w-8 h-8 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing z-30 transition-all ${
                      isSelected
                        ? 'bg-zinc-200 text-black ring-4 ring-zinc-400/60 scale-125'
                        : 'bg-zinc-900 border-2 border-zinc-400 hover:border-white hover:scale-125 hover:ring-4 hover:ring-zinc-500/40'
                    }`}
                    title="Klik untuk memilih, double-click untuk membuka detail, drag untuk menggeser"
                  >
                    <div className="w-3 h-3 rounded-full bg-zinc-100 pointer-events-none" />
                  </div>

                  {/* Event Card (Alternating Top / Bottom) */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode(node);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode(node);
                      setReaderNode(node);
                    }}
                    className={`absolute left-1/2 -translate-x-1/2 w-64 p-3.5 rounded-2xl bg-zinc-900 border transition-all duration-200 cursor-pointer shadow-xl group ${
                      isUpper ? '-translate-y-full' : ''
                    } ${
                      isSelected
                        ? 'border-zinc-300 ring-2 ring-zinc-400/30 scale-102'
                        : 'border-zinc-800 hover:border-zinc-500'
                    }`}
                    style={{
                      top: isUpper ? `-${stemHeight + 10}px` : `${stemHeight + 10}px`,
                    }}
                    title="Double-click untuk membuka detail kejadian"
                  >
                    {/* Header Label */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 truncate">
                        {node.dateLabel || 'Kejadian'}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {node.x}px
                      </span>
                    </div>

                    {/* Title */}
                    <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug group-hover:text-zinc-300 transition-colors">
                      {node.title}
                    </h4>

                    {/* Description */}
                    {node.description && (
                      <p className="text-[11px] text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed">
                        {node.description}
                      </p>
                    )}

                    {/* Actions Footer */}
                    <div className="mt-2.5 pt-2 border-t border-zinc-800 flex items-center justify-end gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingNode(node);
                          setTargetTrackId(node.trackId);
                          setModalX(node.x);
                          setShowNodeModal(true);
                        }}
                        className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                        title="Edit Kejadian"
                      >
                        <Icons.Edit2 size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNode(node.id);
                        }}
                        className="p-1 rounded-md text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Hapus Kejadian"
                      >
                        <Icons.Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dynamic Context Menu (Parallel Timelines) */}
        {contextMenu && (
          <div
            style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
            className="fixed z-50 bg-zinc-900 border border-zinc-800 rounded-xl p-1.5 shadow-2xl animate-in zoom-in-95 duration-100 text-xs min-w-[220px]"
          >
            {contextMenu.targetTrack ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTrack(contextMenu.targetTrack!);
                    setTempTrackName(contextMenu.targetTrack!.name);
                    setShowTrackModal(true);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-2 text-left text-zinc-200 hover:bg-zinc-800 rounded-lg flex items-center gap-2 font-medium cursor-pointer transition-colors"
                >
                  <Icons.Edit3 size={14} className="text-zinc-400" />
                  <span>Ubah Nama ({contextMenu.targetTrack.name})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleAddParallelTrack(contextMenu.targetTrack!.order - 1);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-2 text-left text-zinc-200 hover:bg-zinc-800 rounded-lg flex items-center gap-2 font-medium cursor-pointer transition-colors"
                >
                  <Icons.Plus size={14} className="text-zinc-400" />
                  <span>+ Garis Waktu Paralel di Atas</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleAddParallelTrack(contextMenu.targetTrack!.order + 1);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-2 text-left text-zinc-200 hover:bg-zinc-800 rounded-lg flex items-center gap-2 font-medium cursor-pointer transition-colors"
                >
                  <Icons.Plus size={14} className="text-zinc-400" />
                  <span>+ Garis Waktu Paralel di Bawah</span>
                </button>

                {tracks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteTrack(contextMenu.targetTrack!.id);
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left text-rose-400 hover:bg-rose-500/10 rounded-lg flex items-center gap-2 font-medium cursor-pointer transition-colors border-t border-zinc-800/80 mt-1 pt-2"
                  >
                    <Icons.Trash2 size={14} />
                    <span>Hapus Garis Waktu Ini</span>
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (contextMenu.clickOrderPosition !== undefined) {
                    handleAddParallelTrack(contextMenu.clickOrderPosition);
                  }
                  setContextMenu(null);
                }}
                className="w-full px-3 py-2 text-left text-zinc-200 hover:bg-zinc-800 rounded-lg flex items-center gap-2 font-medium cursor-pointer transition-colors"
              >
                <Icons.Plus size={14} className="text-zinc-400" />
                <span>
                  + Buat Garis Waktu Paralel ({contextMenu.isAbove ? 'di Atas' : 'di Bawah'})
                </span>
              </button>
            )}
          </div>
        )}

        {/* Right Drawer Slide-over Panel for Reader Node */}
        {readerNode && (
          <div className="w-80 sm:w-96 bg-zinc-950 border-l border-zinc-800 flex flex-col z-30 shadow-2xl animate-in slide-in-from-right duration-200 text-white">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icons.Clock size={16} className="text-zinc-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Detail Kejadian</h3>
              </div>
              <button
                type="button"
                onClick={() => setReaderNode(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <Icons.X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                  {readerNode.dateLabel || 'Garis Waktu'}
                </span>
                <h2 className="text-base font-bold text-white mt-2 leading-tight">
                  {readerNode.title}
                </h2>
              </div>

              {readerNode.description && (
                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
                  {readerNode.description}
                </div>
              )}

              {/* Linked Card Information */}
              <div>
                <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  Kartu Database Terhubung
                </h4>
                {linkedCardForReader ? (
                  <div
                    onClick={() => onCardClick(linkedCardForReader)}
                    className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-500 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-zinc-400">
                        {linkedCardForReader.category}
                      </div>
                      <div className="font-bold text-white group-hover:text-zinc-300 transition-colors">
                        {linkedCardForReader.title}
                      </div>
                    </div>
                    <Icons.ChevronRight size={16} className="text-zinc-500 group-hover:translate-x-1 transition-transform" />
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-center text-zinc-500 text-xs">
                    Belum ada kartu terhubung.
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 border-t border-zinc-800 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingNode(readerNode);
                  setTargetTrackId(readerNode.trackId);
                  setModalX(readerNode.x);
                  setShowNodeModal(true);
                }}
                className="flex-1 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Icons.Edit2 size={13} />
                <span>Edit Kejadian</span>
              </button>
              <button
                type="button"
                onClick={() => handleDeleteNode(readerNode.id)}
                className="px-3 py-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Icons.Trash2 size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Event Node Modal */}
      {showNodeModal && (
        <SimpleNodeModal
          node={editingNode}
          cards={cards}
          onSave={handleSaveNode}
          onClose={() => {
            setShowNodeModal(false);
            setEditingNode(null);
          }}
        />
      )}

      {/* Track Name / New Track Modal */}
      {showTrackModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl text-white modal-animate-appear">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Icons.Edit3 size={16} className="text-zinc-400" />
                <span>{editingTrack ? 'Ubah Nama Garis Waktu' : 'Garis Waktu Paralel Baru'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowTrackModal(false);
                  setEditingTrack(null);
                  setNewTrackOrderPosition(null);
                }}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <Icons.X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveTrackModal} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">
                  Nama Garis Waktu
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: KERAJAAN UTARA, KISAH HERO..."
                  value={tempTrackName}
                  onChange={(e) => setTempTrackName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-zinc-500 font-mono text-xs uppercase"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowTrackModal(false);
                    setEditingTrack(null);
                    setNewTrackOrderPosition(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-semibold hover:bg-zinc-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-zinc-700 text-white font-bold hover:bg-zinc-600 cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple Event Modal Component
const SimpleNodeModal: React.FC<{
  node: SimpleTimelineNode | null;
  cards: WorldCard[];
  onSave: (data: { title: string; dateLabel?: string; description?: string; cardId?: string }) => void;
  onClose: () => void;
}> = ({ node, cards, onSave, onClose }) => {
  const [title, setTitle] = useState(node?.title || '');
  const [dateLabel, setDateLabel] = useState(node?.dateLabel || '');
  const [description, setDescription] = useState(node?.description || '');
  const [cardId, setCardId] = useState<string>(node?.cardId || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      dateLabel: dateLabel.trim() || 'Masa Bebas',
      description: description.trim(),
      cardId: cardId || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl text-white modal-animate-appear">
        <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Icons.Clock size={16} className="text-zinc-400" />
            <span>{node ? 'Ubah Kejadian Waktu' : 'Tambah Kejadian Baru'}</span>
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:text-white">
            <Icons.X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Judul Peristiwa / Kejadian</label>
            <input
              type="text"
              required
              placeholder="Contoh: Perang Saudara / Penemuan Sihir..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-zinc-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Penanda Waktu / Era (Bebas / Relatif)</label>
            <input
              type="text"
              placeholder="Contoh: Era Kegelapan, 50 Thn Pasca Perang..."
              value={dateLabel}
              onChange={(e) => setDateLabel(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Hubungkan ke Kartu (Opsional)</label>
            <select
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-zinc-500"
            >
              <option value="">-- Tidak Ada Kartu --</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.category}] {c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Deskripsi Ringkas</label>
            <textarea
              rows={3}
              placeholder="Penjelasan ringkas mengenai peristiwa ini..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-zinc-500 resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-semibold hover:bg-zinc-700"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-2 rounded-xl bg-zinc-700 text-white font-bold hover:bg-zinc-600 cursor-pointer"
            >
              Simpan Kejadian
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
