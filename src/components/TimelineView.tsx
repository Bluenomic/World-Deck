import React, { useState, useEffect, useRef } from 'react';
import type { WorldCard, CardConnection } from '../types';
import { generateId } from '../utils/helpers';
import * as Icons from 'lucide-react';

interface SimpleTimelineNode {
  id: string;
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

// Minimum gap between adjacent events to prevent overlapping
const MIN_EVENT_GAP = 240;

export const TimelineView: React.FC<TimelineViewProps> = ({
  cards,
  onCardClick,
  activeWorldId = 'default',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const storageKey = `worlddeck_timeline_v3_${activeWorldId}`;

  // Timeline Track Name (Google Maps style repeating label)
  const [trackName, setTrackName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_trackname`);
      if (saved) return saved;
    } catch (e) {}
    return 'GARIS WAKTU UTAMA';
  });

  // Timeline Nodes
  const [nodes, setNodes] = useState<SimpleTimelineNode[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  // Horizontal Pan Offset (No Zooming)
  const [scrollX, setScrollX] = useState<number>(100);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStartX, setPanStartX] = useState<number>(0);

  // Mouse Hover position on center axis line
  const [hoverWorldX, setHoverWorldX] = useState<number | null>(null);

  // Context Menu & Modals
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showTrackNameModal, setShowTrackNameModal] = useState<boolean>(false);
  const [tempTrackName, setTempTrackName] = useState<string>('');

  const [showNodeModal, setShowNodeModal] = useState<boolean>(false);
  const [modalX, setModalX] = useState<number>(300);
  const [editingNode, setEditingNode] = useState<SimpleTimelineNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<SimpleTimelineNode | null>(null);
  const [readerNode, setReaderNode] = useState<SimpleTimelineNode | null>(null);

  // Dragging Node State
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [initialNodeX, setInitialNodeX] = useState<number>(0);

  // Persist State
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(nodes));
      localStorage.setItem(`${storageKey}_trackname`, trackName);
    } catch (e) {}
  }, [nodes, trackName, storageKey]);

  // Close context menu on outside click
  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  // Global Window Mouse Move & Mouse Up Listener for Dragging Nodes Smoothly
  useEffect(() => {
    if (!draggingNodeId) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartX;
      const rawNextX = initialNodeX + deltaX;

      const otherNodes = nodes.filter((n) => n.id !== draggingNodeId);
      const sortedOthers = [...otherNodes].sort((a, b) => a.x - b.x);

      // Find nearest left neighbor and nearest right neighbor
      const leftNeighbor = [...sortedOthers].reverse().find((n) => n.x <= initialNodeX);
      const rightNeighbor = sortedOthers.find((n) => n.x >= initialNodeX);

      const minAllowedX = leftNeighbor ? leftNeighbor.x + MIN_EVENT_GAP : 20;
      const maxAllowedX = rightNeighbor ? rightNeighbor.x - MIN_EVENT_GAP : Infinity;

      // Hard Stop / Clamp
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

  // Auto-Spacing Helper Function for initial creation or fallback
  const applyAutoSpacing = (eventList: SimpleTimelineNode[]): SimpleTimelineNode[] => {
    if (eventList.length <= 1) return eventList;
    const sorted = [...eventList].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i++) {
      const prevX = sorted[i - 1].x;
      if (sorted[i].x < prevX + MIN_EVENT_GAP) {
        sorted[i] = { ...sorted[i], x: prevX + MIN_EVENT_GAP };
      }
    }
    return sorted;
  };

  // Pointer Movement Handlers
  const handlePointerMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setScrollX(e.clientX - panStartX);
      return;
    }

    if (draggingNodeId) return;

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerY = rect.height / 2;
    const mouseY = e.clientY - rect.top;

    // Check if mouse is hovering near vertical center axis line (35px tolerance)
    if (Math.abs(mouseY - centerY) <= 35) {
      const worldX = Math.round(e.clientX - rect.left - scrollX);
      
      // Suppress (+) add icon when hovering near an existing node dot (80px radius tolerance)
      const isNearExistingNode = nodes.some((n) => Math.abs(n.x - worldX) < 80);

      if (isNearExistingNode) {
        setHoverWorldX(null);
      } else {
        setHoverWorldX(worldX);
      }
    } else {
      setHoverWorldX(null);
    }
  };

  const handleMouseDownBg = (e: React.MouseEvent) => {
    if (e.button === 0 && (e.target === containerRef.current || (e.target as HTMLElement).id === 'timeline-center-bg')) {
      setIsPanning(true);
      setPanStartX(e.clientX - scrollX);
      setReaderNode(null);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    setScrollX((prev) => prev - delta * 0.9);
  };

  // Right Click Context Menu Handler (Only near center timeline line)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerY = rect.height / 2;
    const mouseY = e.clientY - rect.top;

    // Trigger context menu ONLY when right-clicking near center line (35px tolerance)
    if (Math.abs(mouseY - centerY) <= 35) {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
      });
    } else {
      setContextMenu(null);
    }
  };

  // Node Dragging Start
  const handleStartDragNode = (node: SimpleTimelineNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingNodeId(node.id);
    setDragStartX(e.clientX);
    setInitialNodeX(node.x);
  };

  // Save Node & Apply Auto Spacing
  const handleSaveNode = (data: { title: string; dateLabel?: string; description?: string; cardId?: string }) => {
    if (editingNode) {
      setNodes((prev) => {
        const updated = prev.map((n) => (n.id === editingNode.id ? { ...n, ...data } : n));
        return applyAutoSpacing(updated);
      });
    } else {
      const newNode: SimpleTimelineNode = {
        id: generateId('tnode'),
        x: modalX,
        ...data,
      };
      setNodes((prev) => {
        const updated = [...prev, newNode];
        return applyAutoSpacing(updated);
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

  const handleClearAll = () => {
    if (window.confirm('Bersihkan semua kejadian di timeline?')) {
      setNodes([]);
      setSelectedNode(null);
      setReaderNode(null);
    }
  };

  // Save Track Name
  const handleSaveTrackName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempTrackName.trim()) {
      setTrackName(tempTrackName.trim().toUpperCase());
    }
    setShowTrackNameModal(false);
  };

  const linkedCardForReader = readerNode?.cardId ? cards.find((c) => c.id === readerNode.cardId) : null;

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
              <h2 className="text-sm font-bold text-white leading-none">Timeline</h2>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                {trackName}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Klik kanan pada garis waktu untuk mengganti nama timeline. Arahkan kursor ke garis untuk ikon `(+)`.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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

          {/* Center Horizontal Line (Thick Grey Line in Middle of Screen) */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 bg-zinc-600 pointer-events-none shadow-[0_0_10px_rgba(161,161,170,0.25)]" />

          {/* SVG Layer for Arrows & Google Maps Style Repeating Track Name Labels */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <g transform={`translate(${scrollX}, 0)`}>
              {/* Directional Arrow Markers */}
              {Array.from({ length: 60 }).map((_, idx) => {
                const arrowX = -1000 + idx * 160;
                return (
                  <path
                    key={`arrow-${idx}`}
                    d="M 0 -5 L 8 0 L 0 5"
                    fill="none"
                    stroke="#a1a1aa"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    transform={`translate(${arrowX}, 0)`}
                    style={{ transform: `translate(${arrowX}px, 50%)` }}
                  />
                );
              })}

              {/* Google Maps Style Repeating Track Name Labels Along Center Line */}
              {Array.from({ length: 50 }).map((_, idx) => {
                const labelX = -800 + idx * 360;
                return (
                  <text
                    key={`label-${idx}`}
                    x={labelX}
                    y="50%"
                    dy="-12"
                    fill="#a1a1aa"
                    fillOpacity={0.35}
                    fontSize={11}
                    fontWeight="700"
                    letterSpacing="0.25em"
                    textAnchor="middle"
                    className="uppercase select-none font-mono"
                  >
                    {trackName}
                  </text>
                );
              })}
            </g>
          </svg>

          {/* Floating Hover (+) Icon Button on Center Line (No Text Label) */}
          {hoverWorldX !== null && !isPanning && !draggingNodeId && (
            <div
              onClick={() => {
                setEditingNode(null);
                setModalX(hoverWorldX);
                setShowNodeModal(true);
              }}
              style={{
                left: `${hoverWorldX + scrollX}px`,
              }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-40 cursor-pointer animate-in zoom-in-75 duration-150"
            >
              <button
                type="button"
                className="w-8 h-8 rounded-full bg-zinc-700 hover:bg-zinc-500 text-white flex items-center justify-center shadow-lg hover:scale-125 active:scale-95 transition-all ring-4 ring-zinc-500/30 cursor-pointer"
                title={`Tambah Kejadian (${hoverWorldX}px)`}
              >
                <Icons.Plus size={18} />
              </button>
            </div>
          )}

          {/* Render Timeline Event Nodes (Alternating Upper/Lower Stem Nodes) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ transform: `translateX(${scrollX}px)` }}
          >
            {nodes.map((node, index) => {
              const isUpper = index % 2 === 0;
              const stemHeight = 70;
              const isSelected = selectedNode?.id === node.id;

              return (
                <div
                  key={node.id}
                  className="absolute pointer-events-auto top-1/2"
                  style={{ left: `${node.x}px` }}
                >
                  {/* Stem Line connected to Center Horizontal Line */}
                  <div
                    className={`absolute left-1/2 -translate-x-1/2 w-0.5 transition-colors ${
                      isSelected ? 'bg-zinc-300 shadow-[0_0_8px_rgba(255,255,255,0.6)]' : 'bg-zinc-700'
                    }`}
                    style={{
                      top: isUpper ? `-${stemHeight}px` : '0px',
                      height: `${stemHeight}px`,
                    }}
                  />

                  {/* Center Line Node Point Dot */}
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

        {/* Right Click Context Menu */}
        {contextMenu && (
          <div
            style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
            className="fixed z-50 bg-zinc-900 border border-zinc-800 rounded-xl p-1.5 shadow-2xl animate-in zoom-in-95 duration-100 text-xs min-w-[180px]"
          >
            <button
              type="button"
              onClick={() => {
                setTempTrackName(trackName);
                setShowTrackNameModal(true);
                setContextMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-zinc-200 hover:bg-zinc-800 rounded-lg flex items-center gap-2 font-medium cursor-pointer transition-colors"
            >
              <Icons.Edit3 size={14} className="text-zinc-400" />
              <span>Ubah Nama Garis Waktu</span>
            </button>
          </div>
        )}

        {/* Right Drawer Slide-over Panel for Reader Node (Opens on Double-Click) */}
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

      {/* Add / Edit Node Modal */}
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

      {/* Rename Track Modal */}
      {showTrackNameModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl text-white modal-animate-appear">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Icons.Edit3 size={16} className="text-zinc-400" />
                <span>Ubah Nama Garis Waktu</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowTrackNameModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <Icons.X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveTrackName} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">
                  Nama Garis Waktu
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: GARIS WAKTU UTAMA, KERAJAAN A..."
                  value={tempTrackName}
                  onChange={(e) => setTempTrackName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-zinc-500 font-mono text-xs uppercase"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTrackNameModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-semibold hover:bg-zinc-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-zinc-700 text-white font-bold hover:bg-zinc-600 cursor-pointer"
                >
                  Simpan Nama
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
