import React, { useState, useEffect, useRef } from 'react';
import type { WorldCard, CardConnection, TimelineTrack, TimelineNode, TimelineLink } from '../types';
import { generateId } from '../utils/helpers';
import * as Icons from 'lucide-react';

interface TimelineViewProps {
  cards: WorldCard[];
  connections: CardConnection[];
  onCardClick: (card: WorldCard) => void;
  activeWorldId?: string;
}

const DEFAULT_TRACKS: TimelineTrack[] = [
  {
    id: 'track-main',
    name: 'Timeline Utama (Primary Track)',
    y: 220,
    direction: 'right',
    color: '#3b82f6',
    isMain: true,
  },
  {
    id: 'track-branch-a',
    name: 'Timeline Paralel A (Alternate Dimension)',
    y: 380,
    direction: 'right',
    color: '#10b981',
  },
  {
    id: 'track-reverse',
    name: 'Garis Waktu Terbalik (Retroactive / Past)',
    y: 540,
    direction: 'left',
    color: '#f43f5e',
  },
];

export const TimelineView: React.FC<TimelineViewProps> = ({
  cards,
  connections: _connections,
  onCardClick,
  activeWorldId = 'default',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Storage Key per World
  const storageKey = `worlddeck_timeline_v1_${activeWorldId}`;

  // Timeline State
  const [tracks, setTracks] = useState<TimelineTrack[]>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_tracks`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load timeline tracks', e);
    }
    return DEFAULT_TRACKS;
  });

  const [nodes, setNodes] = useState<TimelineNode[]>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_nodes`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load timeline nodes', e);
    }

    // Default sample nodes if initial
    const firstCard = cards.find((c) => c.category === 'timeline' || c.category === 'lore') || cards[0];
    const secondCard = cards.length > 1 ? cards[1] : undefined;

    return [
      {
        id: 'node-1',
        trackId: 'track-main',
        x: 220,
        title: 'Penemuan Artefak Sihir Kuno',
        dateLabel: 'Tahun 1200 ME',
        description: 'Awal dimulainya penggunaan sihir di kerajaan pusat.',
        cardId: firstCard?.id,
        nodeType: 'event',
      },
      {
        id: 'node-2',
        trackId: 'track-main',
        x: 480,
        title: 'Titik Divergensi / Percabangan Waktu',
        dateLabel: 'Tahun 1450 ME',
        description: 'Peristiwa retaknya realitas memicu timeline paralel.',
        nodeType: 'branch',
      },
      {
        id: 'node-3',
        trackId: 'track-branch-a',
        x: 580,
        title: 'Kemenangan Faksi Berontak',
        dateLabel: 'Tahun 1452 ME (Timeline B)',
        description: 'Di dunia paralel, faksi berontak berhasil menguasai ibu kota.',
        cardId: secondCard?.id,
        nodeType: 'event',
      },
      {
        id: 'node-4',
        trackId: 'track-branch-a',
        x: 820,
        title: 'Loop Perulangan Waktu Terjadi',
        dateLabel: 'Tahun 1500 ME',
        description: 'Penyihir mengaktifkan mantra penjelajah waktu kembali ke masa lalu.',
        nodeType: 'loop',
      },
      {
        id: 'node-5',
        trackId: 'track-reverse',
        x: 720,
        title: 'Pengaruh Memori Terbalik',
        dateLabel: 'Waktu Terbalik (-50 Thn)',
        description: 'Alur waktu berjalan mundur menuju kehancuran masa lalu.',
        nodeType: 'event',
      },
    ];
  });

  const [links, setLinks] = useState<TimelineLink[]>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_links`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load timeline links', e);
    }

    return [
      {
        id: 'link-1',
        type: 'branch',
        sourceNodeId: 'node-2',
        targetNodeId: 'node-3',
        label: 'Percabangan Realitas',
      },
      {
        id: 'link-2',
        type: 'loop',
        sourceNodeId: 'node-4',
        targetNodeId: 'node-1',
        label: 'Time Loop (Perulangan Waktu)',
      },
      {
        id: 'link-3',
        type: 'reverse',
        sourceNodeId: 'node-3',
        targetNodeId: 'node-5',
        label: 'Alur Waktu Terbalik',
      },
    ];
  });

  // Pan and Zoom State
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 60, y: 40 });
  const [zoom, setZoom] = useState<number>(1);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Node Dragging State
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [nodeInitialX, setNodeInitialX] = useState<number>(0);

  // Modals & Editors
  const [showTrackModal, setShowTrackModal] = useState<boolean>(false);
  const [editingTrack, setEditingTrack] = useState<TimelineTrack | null>(null);

  const [showNodeModal, setShowNodeModal] = useState<boolean>(false);
  const [editingNode, setEditingNode] = useState<TimelineNode | null>(null);

  const [showLinkModal, setShowLinkModal] = useState<boolean>(false);

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}_tracks`, JSON.stringify(tracks));
      localStorage.setItem(`${storageKey}_nodes`, JSON.stringify(nodes));
      localStorage.setItem(`${storageKey}_links`, JSON.stringify(links));
    } catch (e) {
      console.warn('Failed to save timeline state', e);
    }
  }, [tracks, nodes, links, storageKey]);

  // Pan Handlers
  const handleMouseDownBg = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).id === 'timeline-svg-canvas') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (draggingNodeId) {
      const deltaX = (e.clientX - dragStartX) / zoom;
      const newX = Math.max(80, Math.round(nodeInitialX + deltaX));
      setNodes((prev) =>
        prev.map((n) => (n.id === draggingNodeId ? { ...n, x: newX } : n))
      );
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.max(0.4, Math.min(2.2, prev * zoomFactor)));
  };

  // Node Drag Handler
  const handleStartDragNode = (node: TimelineNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingNodeId(node.id);
    setDragStartX(e.clientX);
    setNodeInitialX(node.x);
  };

  // Helper to add or save track
  const handleSaveTrack = (trackData: Partial<TimelineTrack>) => {
    if (editingTrack) {
      setTracks((prev) =>
        prev.map((t) => (t.id === editingTrack.id ? { ...t, ...trackData } : t))
      );
    } else {
      const newTrack: TimelineTrack = {
        id: generateId('track'),
        name: trackData.name || 'Garis Timeline Paralel',
        y: trackData.y || 300 + tracks.length * 120,
        direction: trackData.direction || 'right',
        color: trackData.color || '#60a5fa',
      };
      setTracks((prev) => [...prev, newTrack]);
    }
    setShowTrackModal(false);
    setEditingTrack(null);
  };

  const handleDeleteTrack = (trackId: string) => {
    if (tracks.length <= 1) {
      alert('Minimal harus ada 1 Garis Timeline Utama.');
      return;
    }
    if (window.confirm('Hapus Garis Timeline ini beserta event di dalamnya?')) {
      setTracks((prev) => prev.filter((t) => t.id !== trackId));
      setNodes((prev) => prev.filter((n) => n.trackId !== trackId));
    }
  };

  // Helper to add or save node
  const handleSaveNode = (nodeData: Partial<TimelineNode>) => {
    if (editingNode) {
      setNodes((prev) =>
        prev.map((n) => (n.id === editingNode.id ? { ...n, ...nodeData } : n))
      );
    } else {
      const newNode: TimelineNode = {
        id: generateId('node'),
        trackId: nodeData.trackId || tracks[0].id,
        x: nodeData.x || 300,
        title: nodeData.title || 'Kejadian / Peristiwa Baru',
        dateLabel: nodeData.dateLabel || 'Tahun Baru',
        description: nodeData.description || '',
        cardId: nodeData.cardId,
        nodeType: nodeData.nodeType || 'event',
        color: nodeData.color,
      };
      setNodes((prev) => [...prev, newNode]);
    }
    setShowNodeModal(false);
    setEditingNode(null);
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setLinks((prev) => prev.filter((l) => l.sourceNodeId !== nodeId && l.targetNodeId !== nodeId));
  };

  // Helper to add link
  const handleAddLink = (type: TimelineLink['type'], sourceId: string, targetId: string, label: string) => {
    const newLink: TimelineLink = {
      id: generateId('link'),
      type,
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      label,
    };
    setLinks((prev) => [...prev, newLink]);
    setShowLinkModal(false);
  };

  const handleDeleteLink = (linkId: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
  };

  return (
    <div className="flex-1 app-bg-main flex flex-col relative overflow-hidden select-none">
      
      {/* Top Controls Toolbar */}
      <div className="px-5 py-3 app-bg-secondary border-b app-border flex flex-wrap items-center justify-between gap-3 z-30 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center font-bold">
            <Icons.Clock size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold app-text-main leading-none">Timeline & Kronologi Waktu</h2>
            <p className="text-[11px] app-text-muted mt-0.5">
              Garis waktu interaktif dengan dukungan percabangan, loop, dan panah terbalik.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setEditingTrack(null);
              setShowTrackModal(true);
            }}
            className="px-3 py-1.5 rounded-xl app-bg-main border app-border hover:border-blue-400 text-xs font-semibold app-text-main flex items-center gap-1.5 cursor-pointer shadow-2xs hover:scale-105 active:scale-95 transition-all"
          >
            <Icons.GitBranch size={14} className="text-blue-400" />
            <span>+ Garis Timeline</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingNode(null);
              setShowNodeModal(true);
            }}
            className="px-3 py-1.5 rounded-xl app-accent-bg text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm hover:brightness-110 active:scale-95 transition-all"
          >
            <Icons.PlusCircle size={14} />
            <span>+ Kejadian / Event</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLinkModal(true)}
            className="px-3 py-1.5 rounded-xl app-bg-main border app-border hover:border-emerald-400 text-xs font-semibold app-text-main flex items-center gap-1.5 cursor-pointer shadow-2xs hover:scale-105 active:scale-95 transition-all"
          >
            <Icons.Milestone size={14} className="text-emerald-400" />
            <span>+ Konstruksi Waktu (Branch/Loop/Panah)</span>
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center app-bg-main border app-border rounded-xl p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
              className="p-1 rounded-lg app-text-muted hover:app-text-main hover:app-bg-hover cursor-pointer"
              title="Zoom Out"
            >
              <Icons.ZoomOut size={15} />
            </button>
            <span className="px-2 font-mono text-[11px] app-text-main font-semibold">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.2, z + 0.15))}
              className="p-1 rounded-lg app-text-muted hover:app-text-main hover:app-bg-hover cursor-pointer"
              title="Zoom In"
            >
              <Icons.ZoomIn size={15} />
            </button>
            <button
              type="button"
              onClick={() => {
                setPan({ x: 60, y: 40 });
                setZoom(1);
              }}
              className="p-1 rounded-lg app-text-muted hover:app-text-main hover:app-bg-hover border-l app-border ml-0.5 cursor-pointer"
              title="Reset Tampilan"
            >
              <Icons.RotateCcw size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Infinite Canvas Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDownBg}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className="flex-1 w-full h-full relative overflow-hidden cursor-grab active:cursor-grabbing bg-slate-950/40"
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
          className="absolute inset-0 pointer-events-none w-[3000px] h-[2000px]"
        >
          {/* SVG Canvas for Lines, Arrows, Loops, Branches & Joints */}
          <svg
            id="timeline-svg-canvas"
            className="absolute inset-0 w-full h-full overflow-visible pointer-events-auto"
            style={{ overflow: 'visible' }}
          >
            <defs>
              {/* Arrowheads for tracks and links */}
              <marker id="arrow-right-blue" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                <path d="M 0 1 L 9 5 L 0 9 z" fill="#3b82f6" />
              </marker>
              <marker id="arrow-right-green" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                <path d="M 0 1 L 9 5 L 0 9 z" fill="#10b981" />
              </marker>
              <marker id="arrow-left-red" markerWidth="10" markerHeight="10" refX="2" refY="5" orient="auto">
                <path d="M 9 1 L 0 5 L 9 9 z" fill="#f43f5e" />
              </marker>
              <marker id="arrow-link" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
                <path d="M 0 1 L 8 4.5 L 0 8 z" fill="#60a5fa" />
              </marker>
            </defs>

            {/* Render Timeline Tracks (Horizontal Axis Lines) */}
            {tracks.map((track) => {
              const startX = 60;
              const endX = 2200;
              const isRight = track.direction === 'right';

              return (
                <g key={track.id} className="group/track">
                  {/* Outer Glow Axis Line */}
                  <line
                    x1={startX}
                    y1={track.y}
                    x2={endX}
                    y2={track.y}
                    stroke={track.color}
                    strokeWidth={track.isMain ? 4 : 3}
                    strokeOpacity={0.7}
                    markerEnd={isRight ? 'url(#arrow-right-blue)' : undefined}
                    markerStart={!isRight ? 'url(#arrow-left-red)' : undefined}
                  />

                  {/* Time Ticks along track */}
                  {Array.from({ length: 15 }).map((_, idx) => {
                    const tickX = startX + 150 + idx * 130;
                    return (
                      <g key={idx}>
                        <line
                          x1={tickX}
                          y1={track.y - 6}
                          x2={tickX}
                          y2={track.y + 6}
                          stroke={track.color}
                          strokeWidth={1.5}
                          strokeOpacity={0.4}
                        />
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {/* Render Construct Links (Branch, Joint, Loop, Reverse) */}
            {links.map((link) => {
              const srcNode = nodes.find((n) => n.id === link.sourceNodeId);
              const tgtNode = nodes.find((n) => n.id === link.targetNodeId);
              if (!srcNode || !tgtNode) return null;

              const srcTrack = tracks.find((t) => t.id === srcNode.trackId);
              const tgtTrack = tracks.find((t) => t.id === tgtNode.trackId);

              const x1 = srcNode.x;
              const y1 = srcTrack ? srcTrack.y : 200;
              const x2 = tgtNode.x;
              const y2 = tgtTrack ? tgtTrack.y : 200;

              let pathD = '';
              let strokeColor = '#60a5fa';
              let dashArray = 'none';

              if (link.type === 'loop') {
                // Time LoopArc Path
                const arcHeight = Math.abs(x1 - x2) * 0.45 + 70;
                const topY = Math.min(y1, y2) - arcHeight;
                pathD = `M ${x1} ${y1} C ${x1 + 60} ${topY}, ${x2 - 60} ${topY}, ${x2} ${y2}`;
                strokeColor = '#a855f7'; // Purple for time loop
                dashArray = '6,4';
              } else if (link.type === 'reverse') {
                // Reverse Time Travel Link
                pathD = `M ${x1} ${y1} C ${x1 - 60} ${y1}, ${x2 + 60} ${y2}, ${x2} ${y2}`;
                strokeColor = '#f43f5e'; // Red for reverse
                dashArray = '5,4';
              } else if (link.type === 'branch') {
                // Branching Curve
                pathD = `M ${x1} ${y1} C ${x1 + 80} ${y1}, ${x2 - 80} ${y2}, ${x2} ${y2}`;
                strokeColor = '#10b981'; // Green for branch
              } else {
                // Joint / Merge Curve
                pathD = `M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}`;
                strokeColor = '#3b82f6';
              }

              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2 - (link.type === 'loop' ? 40 : 0);

              return (
                <g key={link.id} className="group/link cursor-pointer">
                  {/* Link Path */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={2.5}
                    strokeDasharray={dashArray}
                    markerEnd="url(#arrow-link)"
                    className="transition-all hover:stroke-width-4"
                  />

                  {/* Link Label Tag */}
                  {link.label && (
                    <foreignObject
                      x={midX - 70}
                      y={midY - 12}
                      width={140}
                      height={26}
                      className="overflow-visible"
                    >
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Hapus garis konstruksi "${link.label}"?`)) {
                            handleDeleteLink(link.id);
                          }
                        }}
                        className="px-2 py-0.5 rounded-md app-bg-secondary border app-border text-[10px] font-bold app-text-main shadow-xs flex items-center justify-center gap-1 hover:border-rose-400 cursor-pointer"
                        title="Klik untuk menghapus konstruksi relasi"
                      >
                        {link.type === 'loop' && <Icons.RotateCcw size={10} className="text-purple-400" />}
                        {link.type === 'reverse' && <Icons.ArrowLeft size={10} className="text-rose-400" />}
                        {link.type === 'branch' && <Icons.GitBranch size={10} className="text-emerald-400" />}
                        <span className="truncate">{link.label}</span>
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Render Timeline Track Header Badges (Left edge of tracks) */}
          {tracks.map((track) => (
            <div
              key={`header-${track.id}`}
              style={{
                top: `${track.y - 18}px`,
                left: '20px',
              }}
              className="absolute z-20 pointer-events-auto flex items-center gap-1.5"
            >
              <div
                className="px-3 py-1.5 rounded-xl app-bg-secondary border shadow-lg flex items-center gap-2 font-bold text-xs"
                style={{ borderColor: track.color }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: track.color }}
                />
                <span className="app-text-main font-bold">{track.name}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded app-bg-main border app-border app-text-muted">
                  {track.direction === 'right' ? 'Maju ➔' : '⏮️ Terbalik'}
                </span>
                
                <button
                  type="button"
                  onClick={() => {
                    setEditingTrack(track);
                    setShowTrackModal(true);
                  }}
                  className="p-1 rounded hover:app-bg-hover app-text-muted hover:app-text-main transition-colors cursor-pointer"
                  title="Edit Garis Timeline"
                >
                  <Icons.Edit3 size={13} />
                </button>
              </div>
            </div>
          ))}

          {/* Render Timeline Event Nodes (Points of Interest / Milestones) */}
          {nodes.map((node) => {
            const track = tracks.find((t) => t.id === node.trackId) || tracks[0];
            const posY = track.y;
            const attachedCard = cards.find((c) => c.id === node.cardId);

            return (
              <div
                key={node.id}
                style={{
                  transform: `translate3d(${node.x}px, ${posY}px, 0)`,
                }}
                className="absolute z-20 pointer-events-auto -translate-x-1/2 -translate-y-1/2 group/node"
              >
                {/* Node Interactive Dot Anchor */}
                <div
                  onMouseDown={(e) => handleStartDragNode(node, e)}
                  className="w-7 h-7 rounded-full app-bg-main border-2 flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg transition-transform hover:scale-125 group-hover/node:ring-4 group-hover/node:ring-blue-500/30"
                  style={{ borderColor: node.color || track.color }}
                  title="Tarik horizontal untuk menggeser posisi waktu"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full animate-pulse"
                    style={{ backgroundColor: node.color || track.color }}
                  />
                </div>

                {/* Event Card Badge / Milestone Info Box */}
                <div
                  onClick={() => {
                    if (attachedCard) {
                      onCardClick(attachedCard);
                    } else {
                      setEditingNode(node);
                      setShowNodeModal(true);
                    }
                  }}
                  className="absolute left-1/2 -translate-x-1/2 top-7 w-52 p-3 rounded-xl app-bg-secondary border app-border hover:border-blue-400 shadow-xl space-y-1.5 cursor-pointer transition-all hover:-translate-y-1"
                >
                  {/* Date / Era Badge */}
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded app-bg-main app-accent-text border app-border">
                      {node.dateLabel || 'Waktu Peristiwa'}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingNode(node);
                        setShowNodeModal(true);
                      }}
                      className="p-1 rounded app-text-muted hover:app-text-main hover:app-bg-hover transition-colors"
                      title="Edit Event"
                    >
                      <Icons.Edit3 size={11} />
                    </button>
                  </div>

                  {/* Title */}
                  <h4 className="text-xs font-bold app-text-main line-clamp-1 group-hover/node:text-blue-400 transition-colors">
                    {node.title}
                  </h4>

                  {/* Description or Attached Card */}
                  {attachedCard ? (
                    <div className="text-[10px] px-2 py-1 rounded-lg app-bg-main border app-border text-emerald-400 font-semibold flex items-center gap-1">
                      <Icons.FileText size={10} />
                      <span className="truncate">Kartu: {attachedCard.title}</span>
                    </div>
                  ) : node.description ? (
                    <p className="text-[10px] app-text-muted line-clamp-2 leading-relaxed">
                      {node.description}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL 1: Create / Edit Track */}
      {showTrackModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[160] flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setShowTrackModal(false)}
        >
          <div
            className="w-full max-w-md app-bg-main border app-border rounded-2xl p-5 space-y-4 shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b app-border pb-3">
              <h3 className="text-sm font-bold app-text-main flex items-center gap-2">
                <Icons.GitBranch className="text-blue-400" size={16} />
                <span>{editingTrack ? 'Edit Garis Timeline' : 'Buat Garis Timeline Baru'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowTrackModal(false)}
                className="p-1 rounded app-text-muted hover:app-text-main cursor-pointer"
              >
                <Icons.X size={16} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const name = (form.elements.namedItem('trackName') as HTMLInputElement).value;
                const direction = (form.elements.namedItem('trackDirection') as HTMLSelectElement).value as 'right' | 'left';
                const color = (form.elements.namedItem('trackColor') as HTMLInputElement).value;
                const y = parseInt((form.elements.namedItem('trackY') as HTMLInputElement).value, 10);

                handleSaveTrack({ name, direction, color, y });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block app-text-muted font-semibold mb-1">Nama Garis Timeline *</label>
                <input
                  name="trackName"
                  type="text"
                  required
                  defaultValue={editingTrack?.name || 'Timeline Paralel Baru'}
                  placeholder="Contoh: Timeline Alternatif B"
                  className="w-full app-bg-secondary border app-border rounded-lg px-3 py-2 app-text-main focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block app-text-muted font-semibold mb-1">Arah Alur Waktu</label>
                  <select
                    name="trackDirection"
                    defaultValue={editingTrack?.direction || 'right'}
                    className="w-full app-bg-secondary border app-border rounded-lg px-3 py-2 app-text-main cursor-pointer"
                  >
                    <option value="right">Maju ke Kanan (Normal ➔)</option>
                    <option value="left">Mundur / Panah Kiri (Terbalik ⬅)</option>
                  </select>
                </div>

                <div>
                  <label className="block app-text-muted font-semibold mb-1">Warna Garis</label>
                  <input
                    name="trackColor"
                    type="color"
                    defaultValue={editingTrack?.color || '#3b82f6'}
                    className="w-full h-9 p-1 rounded-lg app-bg-secondary border app-border cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block app-text-muted font-semibold mb-1">Posisi Vertikal (Y Offset)</label>
                <input
                  name="trackY"
                  type="number"
                  defaultValue={editingTrack?.y || 200 + tracks.length * 120}
                  className="w-full app-bg-secondary border app-border rounded-lg px-3 py-2 app-text-main"
                />
              </div>

              <div className="pt-3 flex items-center justify-between">
                {editingTrack && !editingTrack.isMain ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteTrack(editingTrack.id)}
                    className="text-rose-400 hover:underline cursor-pointer"
                  >
                    Hapus Garis
                  </button>
                ) : <div />}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTrackModal(false)}
                    className="px-3 py-1.5 rounded-lg border app-border app-text-muted hover:app-text-main cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 app-accent-bg text-white rounded-lg font-semibold shadow-sm cursor-pointer"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create / Edit Event Node */}
      {showNodeModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[160] flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setShowNodeModal(false)}
        >
          <div
            className="w-full max-w-md app-bg-main border app-border rounded-2xl p-5 space-y-4 shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b app-border pb-3">
              <h3 className="text-sm font-bold app-text-main flex items-center gap-2">
                <Icons.PlusCircle className="text-rose-400" size={16} />
                <span>{editingNode ? 'Edit Kejadian Timeline' : 'Tambah Kejadian Timeline Baru'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNodeModal(false)}
                className="p-1 rounded app-text-muted hover:app-text-main cursor-pointer"
              >
                <Icons.X size={16} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const title = (form.elements.namedItem('nodeTitle') as HTMLInputElement).value;
                const dateLabel = (form.elements.namedItem('nodeDate') as HTMLInputElement).value;
                const description = (form.elements.namedItem('nodeDesc') as HTMLTextAreaElement).value;
                const trackId = (form.elements.namedItem('nodeTrack') as HTMLSelectElement).value;
                const cardId = (form.elements.namedItem('nodeCard') as HTMLSelectElement).value || undefined;

                handleSaveNode({ title, dateLabel, description, trackId, cardId });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block app-text-muted font-semibold mb-1">Judul Peristiwa / Kejadian *</label>
                <input
                  name="nodeTitle"
                  type="text"
                  required
                  defaultValue={editingNode?.title || ''}
                  placeholder="Contoh: Perang Aliansi Tiga Kerajaan"
                  className="w-full app-bg-secondary border app-border rounded-lg px-3 py-2 app-text-main focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block app-text-muted font-semibold mb-1">Label Waktu / Era *</label>
                  <input
                    name="nodeDate"
                    type="text"
                    required
                    defaultValue={editingNode?.dateLabel || 'Tahun 1450 ME'}
                    placeholder="Contoh: Tahun 1450 ME"
                    className="w-full app-bg-secondary border app-border rounded-lg px-3 py-2 app-text-main focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block app-text-muted font-semibold mb-1">Pilih Garis Timeline</label>
                  <select
                    name="nodeTrack"
                    defaultValue={editingNode?.trackId || tracks[0].id}
                    className="w-full app-bg-secondary border app-border rounded-lg px-3 py-2 app-text-main cursor-pointer"
                  >
                    {tracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block app-text-muted font-semibold mb-1">Hubungkan dengan Kartu (Opsional)</label>
                <select
                  name="nodeCard"
                  defaultValue={editingNode?.cardId || ''}
                  className="w-full app-bg-secondary border app-border rounded-lg px-3 py-2 app-text-main cursor-pointer"
                >
                  <option value="">-- Tanpa Kartu --</option>
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title || 'Kartu Tanpa Judul'} ({c.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block app-text-muted font-semibold mb-1">Catatan / Detail Ringkas</label>
                <textarea
                  name="nodeDesc"
                  rows={3}
                  defaultValue={editingNode?.description || ''}
                  placeholder="Penjelasan singkat peristiwa..."
                  className="w-full app-bg-secondary border app-border rounded-lg p-2.5 app-text-main focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-between">
                {editingNode ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteNode(editingNode.id)}
                    className="text-rose-400 hover:underline cursor-pointer"
                  >
                    Hapus Event
                  </button>
                ) : <div />}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNodeModal(false)}
                    className="px-3 py-1.5 rounded-lg border app-border app-text-muted hover:app-text-main cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 app-accent-bg text-white rounded-lg font-semibold shadow-sm cursor-pointer"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Create Construct Link (Branch, Joint, Loop, Reverse) */}
      {showLinkModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[160] flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setShowLinkModal(false)}
        >
          <div
            className="w-full max-w-md app-bg-main border app-border rounded-2xl p-5 space-y-4 shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b app-border pb-3">
              <h3 className="text-sm font-bold app-text-main flex items-center gap-2">
                <Icons.Milestone className="text-emerald-400" size={16} />
                <span>Buat Konstruksi Waktu (Branch, Joint, Loop, Reverse)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="p-1 rounded app-text-muted hover:app-text-main cursor-pointer"
              >
                <Icons.X size={16} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const type = (form.elements.namedItem('linkType') as HTMLSelectElement).value as TimelineLink['type'];
                const sourceId = (form.elements.namedItem('sourceNode') as HTMLSelectElement).value;
                const targetId = (form.elements.namedItem('targetNode') as HTMLSelectElement).value;
                const label = (form.elements.namedItem('linkLabel') as HTMLInputElement).value;

                if (sourceId === targetId) {
                  alert('Titik asal dan tujuan tidak boleh sama.');
                  return;
                }

                handleAddLink(type, sourceId, targetId, label);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block app-text-muted font-semibold mb-1">Jenis Konstruksi Waktu *</label>
                <select
                  name="linkType"
                  defaultValue="branch"
                  className="w-full app-bg-secondary border app-border rounded-lg px-3 py-2 app-text-main cursor-pointer"
                >
                  <option value="branch">🌿 Percabangan (Branch - Dibergen ke Garis Baru)</option>
                  <option value="joint">🔀 Penyatuan (Joint - 2 Garis Menyatu Kembali)</option>
                  <option value="loop">🔄 Time Loop (Perulangan Waktu Kembali ke Masa Lalu)</option>
                  <option value="reverse">⏮️ Panah Kiri (Waktu Terbalik / Retroactive)</option>
                </select>
              </div>

              <div>
                <label className="block app-text-muted font-semibold mb-1">Titik Kejadian Asal *</label>
                <select
                  name="sourceNode"
                  defaultValue={nodes[0]?.id}
                  className="w-full app-bg-secondary border app-border rounded-lg px-3 py-2 app-text-main cursor-pointer"
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title} ({n.dateLabel})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block app-text-muted font-semibold mb-1">Titik Kejadian Tujuan *</label>
                <select
                  name="targetNode"
                  defaultValue={nodes[1]?.id}
                  className="w-full app-bg-secondary border app-border rounded-lg px-3 py-2 app-text-main cursor-pointer"
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title} ({n.dateLabel})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block app-text-muted font-semibold mb-1">Nama / Label Konstruksi</label>
                <input
                  name="linkLabel"
                  type="text"
                  defaultValue="Percabangan Waktu"
                  placeholder="Contoh: Time Loop Perang, Percabangan Realitas..."
                  className="w-full app-bg-secondary border app-border rounded-lg px-3 py-2 app-text-main focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="px-3 py-1.5 rounded-lg border app-border app-text-muted hover:app-text-main cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 app-accent-bg text-white rounded-lg font-semibold shadow-sm cursor-pointer"
                >
                  Hubungkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
