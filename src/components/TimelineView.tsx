import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { WorldCard, CardConnection, TimelineBranch } from '../types';
import { generateId } from '../utils/helpers';
import { useLanguage } from '../i18n/LanguageContext';
import * as Icons from 'lucide-react';
import { TimelineDeleteModal } from './TimelineDeleteModal';
import type { TimelineDeleteTarget } from './TimelineDeleteModal';
import { ConfirmModal } from './ConfirmModal';
import type { ConfirmModalConfig } from './ConfirmModal';
import { isTauriAvailable, saveImageAsset } from '../utils/tauriStorage';

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
  images?: string[];
  imageUrl?: string;
}

interface TimelineViewProps {
  cards: WorldCard[];
  connections?: CardConnection[];
  onCardClick: (card: WorldCard) => void;
  activeWorldId?: string;
  timelineTracks?: TimelineTrack[];
  timelineNodes?: SimpleTimelineNode[];
  timelineBranches?: TimelineBranch[];
  onSaveTimeline?: (tracks: TimelineTrack[], nodes: SimpleTimelineNode[], branches: TimelineBranch[]) => void;
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
      gap = Math.max(gap, maxDownward + maxUpward + 40);
    } else if (maxDownward > 0) {
      gap = Math.max(gap, maxDownward + 100);
    } else if (maxUpward > 0) {
      gap = Math.max(gap, maxUpward + 100);
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
  timelineTracks,
  timelineNodes,
  timelineBranches,
  onSaveTimeline,
}) => {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const storageKey = `worlddeck_timeline_v4_${activeWorldId}`;

  // Timeline Tracks State
  const [tracks, setTracks] = useState<TimelineTrack[]>(() => {
    if (timelineTracks && timelineTracks.length > 0) return timelineTracks;
    try {
      const saved = localStorage.getItem(`${storageKey}_tracks`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      { id: 'track_main', name: t.timeline.mainTimeline, order: 0 },
    ];
  });

  // Timeline Nodes State
  const [nodes, setNodes] = useState<SimpleTimelineNode[]>(() => {
    if (timelineNodes) return timelineNodes;
    try {
      const saved = localStorage.getItem(`${storageKey}_nodes`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((n: any) => ({ ...n, trackId: n.trackId || 'track_main' }));
      }
    } catch (e) {}
    return [];
  });

  // Timeline Branches State
  const [branches, setBranches] = useState<TimelineBranch[]>(() => {
    if (timelineBranches) return timelineBranches;
    try {
      const saved = localStorage.getItem(`${storageKey}_branches`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  // Sync state when activeWorld or props change
  useEffect(() => {
    if (timelineTracks && timelineTracks.length > 0) {
      setTracks(timelineTracks);
    }
  }, [timelineTracks]);

  useEffect(() => {
    if (timelineNodes) {
      setNodes(timelineNodes);
    }
  }, [timelineNodes]);

  useEffect(() => {
    if (timelineBranches) {
      setBranches(timelineBranches);
    }
  }, [timelineBranches]);

  // Interactive Branch Drafting State
  const [draftBranch, setDraftBranch] = useState<{
    sourceTrackId: string;
    sourceX: number;
    sourceNodeId?: string;
  } | null>(null);

  const [mouseWorldPos, setMouseWorldPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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
    clickWorldX?: number;
    clickNodeId?: string;
    selectedNode?: SimpleTimelineNode;
    selectedBranch?: TimelineBranch;
    isAbove?: boolean;
    clickOrderPosition?: number;
    showMoveSubmenu?: boolean;
  } | null>(null);

  // Notice Modal State
  const [noticeModal, setNoticeModal] = useState<ConfirmModalConfig | null>(null);

  const showNotice = (title: string, description: string) => {
    setNoticeModal({
      isOpen: true,
      title,
      description,
      isAlertOnly: true,
      variant: 'warning',
      confirmLabel: t.common.understood,
      onConfirm: () => setNoticeModal(null),
    });
  };

  // Track Name Modal State
  const [showTrackModal, setShowTrackModal] = useState<boolean>(false);
  const [editingTrack, setEditingTrack] = useState<TimelineTrack | null>(null);
  const [newTrackOrderPosition, setNewTrackOrderPosition] = useState<number | null>(null);
  const [tempTrackName, setTempTrackName] = useState<string>('');

  // Branch Name Modal State
  const [showBranchModal, setShowBranchModal] = useState<boolean>(false);
  const [editingBranch, setEditingBranch] = useState<TimelineBranch | null>(null);
  const [tempBranchLabel, setTempBranchLabel] = useState<string>('');

  // Node Modal & Readers
  const [showNodeModal, setShowNodeModal] = useState<boolean>(false);
  const [targetTrackId, setTargetTrackId] = useState<string>('track_main');
  const [modalX, setModalX] = useState<number>(300);
  const [editingNode, setEditingNode] = useState<SimpleTimelineNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<SimpleTimelineNode | null>(null);
  const [readerNode, setReaderNode] = useState<SimpleTimelineNode | null>(null);
  const [previewEventImageIndex, setPreviewEventImageIndex] = useState<number | null>(null);

  const readerImages: string[] = useMemo(() => {
    if (!readerNode) return [];
    if (readerNode.images && readerNode.images.length > 0) {
      return readerNode.images;
    }
    return readerNode.imageUrl ? [readerNode.imageUrl] : [];
  }, [readerNode]);

  // Keyboard navigation for Event Image Lightbox Modal
  useEffect(() => {
    if (previewEventImageIndex === null || readerImages.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setPreviewEventImageIndex((prev) => (prev === null || prev <= 0 ? readerImages.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight') {
        setPreviewEventImageIndex((prev) => (prev === null || prev >= readerImages.length - 1 ? 0 : prev + 1));
      } else if (e.key === 'Escape') {
        setPreviewEventImageIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewEventImageIndex, readerImages]);

  // Custom Delete Modal Target State
  const [deleteTarget, setDeleteTarget] = useState<TimelineDeleteTarget | null>(null);

  // Measure Container Bounds for 100% Centered Initial Render
  const [containerBounds, setContainerBounds] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight - 48 : 700,
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const updateBounds = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.height > 0 && rect.width > 0) {
          setContainerBounds({ width: rect.width, height: rect.height });
        }
      }
    };

    updateBounds();

    const observer = new ResizeObserver(updateBounds);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  // Dragging Node State
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [initialNodeX, setInitialNodeX] = useState<number>(0);

  // Layout Calculations
  const sortedTracks = [...tracks].sort((a, b) => a.order - b.order);
  const { relativeYMap, totalSpan, stackCenter } = calculateTrackLayout(sortedTracks, nodes);

  // Persist State to LocalStorage and Parent World state
  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}_tracks`, JSON.stringify(tracks));
      localStorage.setItem(`${storageKey}_nodes`, JSON.stringify(nodes));
      localStorage.setItem(`${storageKey}_branches`, JSON.stringify(branches));
    } catch (e) {}
    onSaveTimeline?.(tracks, nodes, branches);
  }, [tracks, nodes, branches, storageKey]);

  // Cancel draft branch on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && draftBranch) {
        setDraftBranch(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draftBranch]);

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

  const getTrackName = (track: TimelineTrack) => {
    if (track.id === 'track_main' || track.name === 'GARIS WAKTU UTAMA' || track.name === 'MAIN TIMELINE') {
      return t.timeline.mainTimeline;
    }
    return track.name;
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

  // Clamp Horizontal Scroll so user cannot scroll endlessly past content boundaries
  const getClampedScrollX = (rawScrollX: number, vWidth: number) => {
    if (nodes.length === 0) {
      return Math.max(-100, Math.min(300, rawScrollX));
    }

    const minNodeX = Math.min(...nodes.map((n) => n.x));
    const maxNodeX = Math.max(...nodes.map((n) => n.x));

    const margin = 350; // Padding to comfortably view the first and last card

    const maxAllowedScrollX = margin - minNodeX;
    const minAllowedScrollX = vWidth - (maxNodeX + margin);

    if (maxAllowedScrollX < minAllowedScrollX) {
      // Content fits inside viewport: center the content on screen
      const contentCenter = (minNodeX + maxNodeX) / 2;
      return vWidth / 2 - contentCenter;
    }

    return Math.max(minAllowedScrollX, Math.min(maxAllowedScrollX, rawScrollX));
  };

  // Pointer Movement Handlers
  const handlePointerMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = rect.height;
    const viewportWidth = rect.width;

    const mouseY = e.clientY - rect.top;
    const worldX = Math.round(e.clientX - rect.left - scrollX);

    // Track mouse world position for interactive branch tethering
    setMouseWorldPos({ x: worldX, y: mouseY });

    if (isPanning) {
      const rawX = e.clientX - panStart.x;
      const clampedX = getClampedScrollX(rawX, viewportWidth);
      setScrollX(clampedX);

      const rawY = e.clientY - panStart.y;
      const clampedY = Math.max(
        -maxScrollOffset(viewportHeight),
        Math.min(maxScrollOffset(viewportHeight), rawY)
      );
      setScrollY(clampedY);
      return;
    }

    if (draggingNodeId) return;

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
    if (e.button === 0) {
      if (draftBranch) {
        e.preventDefault();
        e.stopPropagation();

        let trackId = hoverTrackId;
        let worldX = hoverWorldX;

        if (!trackId || worldX === null) {
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const viewportHeight = rect.height;
            const mouseY = e.clientY - rect.top;
            worldX = Math.round(e.clientX - rect.left - scrollX);

            for (const track of sortedTracks) {
              const trackY = getTrackCenterY(track.id, viewportHeight);
              if (Math.abs(mouseY - trackY) <= 45) {
                trackId = track.id;
                break;
              }
            }
          }
        }

        if (trackId && worldX !== null) {
          const nearNode = nodes.find((n) => n.trackId === trackId && Math.abs(n.x - worldX!) <= 24);
          handleCompleteBranch(trackId, worldX, nearNode?.id);
        } else {
          setDraftBranch(null);
        }
        return;
      }

      if (e.target === containerRef.current || (e.target as HTMLElement).id === 'timeline-center-bg') {
        setIsPanning(true);
        setPanStart({ x: e.clientX - scrollX, y: e.clientY - scrollY });
        setReaderNode(null);
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = rect.height;
    const viewportWidth = rect.width;

    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      setScrollX((prev) => getClampedScrollX(prev - delta * 0.9, viewportWidth));
    } else {
      setScrollY((prev) => {
        const rawY = prev - e.deltaY * 0.9;
        const maxLimit = maxScrollOffset(viewportHeight);
        return Math.max(-maxLimit, Math.min(maxLimit, rawY));
      });
    }
  };

  // Branch Handlers
  const handleCompleteBranch = (targetTrackId: string, targetX: number, targetNodeId?: string) => {
    if (!draftBranch) return;

    if (
      draftBranch.sourceTrackId === targetTrackId &&
      Math.abs(draftBranch.sourceX - targetX) < 10
    ) {
      setDraftBranch(null);
      return;
    }

    let label = t.timeline.timeBranch;
    if (draftBranch.sourceTrackId === targetTrackId) {
      if (targetX < draftBranch.sourceX) {
        label = t.timeline.timeLoopPast;
      } else {
        label = t.timeline.futureJump;
      }
    } else {
      label = t.timeline.altTimeline;
    }

    const newBranch: TimelineBranch = {
      id: generateId('branch'),
      sourceTrackId: draftBranch.sourceTrackId,
      sourceX: draftBranch.sourceX,
      sourceNodeId: draftBranch.sourceNodeId,
      targetTrackId,
      targetX,
      targetNodeId,
      label,
    };

    setBranches((prev) => [...prev, newBranch]);
    setDraftBranch(null);
  };

  const handleDeleteBranch = (branchId: string) => {
    const branchToDelete = branches.find((b) => b.id === branchId);
    if (branchToDelete) {
      setDeleteTarget({
        type: 'branch',
        id: branchToDelete.id,
        title: branchToDelete.label || t.timeline.timeBranch,
        subtitle: t.timeline.timeConnection,
      });
    }
  };

  const openContextMenu = (
    clientX: number,
    clientY: number,
    data: Omit<NonNullable<typeof contextMenu>, 'x' | 'y'>
  ) => {
    const menuWidth = 250;
    const menuHeight = 380;
    const padding = 16;

    let x = clientX;
    let y = clientY;

    if (x + menuWidth > window.innerWidth - padding) {
      x = Math.max(padding, window.innerWidth - menuWidth - padding);
    }
    if (y + menuHeight > window.innerHeight - padding) {
      y = Math.max(padding, window.innerHeight - menuHeight - padding);
    }

    setContextMenu({
      x,
      y,
      ...data,
    });
  };

  const handleRightClickNode = (node: SimpleTimelineNode, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const track = tracks.find((t) => t.id === node.trackId);
    openContextMenu(e.clientX, e.clientY, {
      selectedNode: node,
      targetTrack: track,
      clickWorldX: node.x,
      clickNodeId: node.id,
    });
  };

  const handleMoveNodeToTrack = (nodeId: string, targetTrackId: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, trackId: targetTrackId } : n))
    );
  };

  const handleAutoSpaceTrack = (trackId: string) => {
    setNodes((prev) => {
      const trackNodes = prev.filter((n) => n.trackId === trackId).sort((a, b) => a.x - b.x);
      if (trackNodes.length <= 1) return prev;

      const firstX = trackNodes[0].x;
      const spacing = MIN_EVENT_GAP;
      const updatedMap = new Map<string, number>();

      trackNodes.forEach((node, idx) => {
        updatedMap.set(node.id, firstX + idx * spacing);
      });

      return prev.map((n) => (updatedMap.has(n.id) ? { ...n, x: updatedMap.get(n.id)! } : n));
    });
  };

  const handleResetCamera = () => {
    setScrollX(100);
    setScrollY(0);
  };

  const handleRightClickBranch = (branch: TimelineBranch, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(e.clientX, e.clientY, {
      selectedBranch: branch,
    });
  };

  const handleSaveBranchModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;
    const cleanLabel = tempBranchLabel.trim() || t.timeline.timeBranch;
    setBranches((prev) =>
      prev.map((b) => (b.id === editingBranch.id ? { ...b, label: cleanLabel } : b))
    );
    setShowBranchModal(false);
    setEditingBranch(null);
  };

  // Right Click Context Menu Handler
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = rect.height;
    const mouseY = e.clientY - rect.top;
    const worldX = Math.round(e.clientX - rect.left - scrollX);

    let targetTrack: TimelineTrack | undefined;
    for (const track of sortedTracks) {
      const trackY = getTrackCenterY(track.id, viewportHeight);
      if (Math.abs(mouseY - trackY) <= 35) {
        targetTrack = track;
        break;
      }
    }

    if (targetTrack) {
      const nearNode = nodes.find((n) => n.trackId === targetTrack!.id && Math.abs(n.x - worldX) <= 24);

      if (nearNode) {
        openContextMenu(e.clientX, e.clientY, {
          selectedNode: nearNode,
          targetTrack,
          clickWorldX: nearNode.x,
          clickNodeId: nearNode.id,
        });
      } else {
        openContextMenu(e.clientX, e.clientY, {
          targetTrack,
          clickWorldX: worldX,
        });
      }
    } else {
      // Empty Canvas Context Menu: calculate order based on cursor Y relative to all tracks
      let clickOrderPosition = 0;

      if (sortedTracks.length === 0) {
        clickOrderPosition = 0;
      } else if (sortedTracks.length === 1) {
        const singleY = getTrackCenterY(sortedTracks[0].id, viewportHeight);
        clickOrderPosition = mouseY < singleY ? sortedTracks[0].order - 1 : sortedTracks[0].order + 1;
      } else {
        const topY = getTrackCenterY(sortedTracks[0].id, viewportHeight);
        const bottomY = getTrackCenterY(sortedTracks[sortedTracks.length - 1].id, viewportHeight);

        if (mouseY < topY) {
          clickOrderPosition = sortedTracks[0].order - 1;
        } else if (mouseY > bottomY) {
          clickOrderPosition = sortedTracks[sortedTracks.length - 1].order + 1;
        } else {
          for (let i = 0; i < sortedTracks.length - 1; i++) {
            const upperY = getTrackCenterY(sortedTracks[i].id, viewportHeight);
            const lowerY = getTrackCenterY(sortedTracks[i + 1].id, viewportHeight);

            if (mouseY >= upperY && mouseY <= lowerY) {
              clickOrderPosition = (sortedTracks[i].order + sortedTracks[i + 1].order) / 2;
              break;
            }
          }
        }
      }

      openContextMenu(e.clientX, e.clientY, {
        clickWorldX: worldX,
        clickOrderPosition,
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
  const handleSaveNode = (data: {
    title: string;
    dateLabel?: string;
    description?: string;
    cardId?: string;
    images?: string[];
    imageUrl?: string;
  }) => {
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
    const nodeToDelete = nodes.find((n) => n.id === id);
    if (nodeToDelete) {
      setDeleteTarget({
        type: 'node',
        id: nodeToDelete.id,
        title: nodeToDelete.title,
        subtitle: nodeToDelete.dateLabel || t.timeline.timeEvent,
      });
    }
  };

  // Helper to check if a track is the Main Timeline track (protected)
  const isMainTrack = (track: TimelineTrack) => {
    return track.id === 'track_main';
  };

  // Helpers to calculate exact order position relative to targeted track
  const getNewOrderAbove = (targetTrack: TimelineTrack) => {
    const sorted = [...tracks].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((t) => t.id === targetTrack.id);
    if (idx <= 0) {
      return targetTrack.order - 1;
    }
    return (sorted[idx - 1].order + targetTrack.order) / 2;
  };

  const getNewOrderBelow = (targetTrack: TimelineTrack) => {
    const sorted = [...tracks].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((t) => t.id === targetTrack.id);
    if (idx === -1 || idx === sorted.length - 1) {
      return targetTrack.order + 1;
    }
    return (targetTrack.order + sorted[idx + 1].order) / 2;
  };

  // Add Parallel Track
  const handleAddParallelTrack = (orderPos: number) => {
    setEditingTrack(null);
    setNewTrackOrderPosition(orderPos);
    setTempTrackName(`${t.timeline.parallelTimeline} ${tracks.length}`);
    setShowTrackModal(true);
  };

  // Delete Parallel Track (Protected Main Track)
  const handleDeleteTrack = (trackId: string) => {
    const trackToDelete = tracks.find((t) => t.id === trackId);
    if (!trackToDelete || isMainTrack(trackToDelete)) {
      showNotice(t.timeline.protectedTitle, t.timeline.protectedDesc);
      return;
    }
    if (tracks.length <= 1) {
      showNotice(t.timeline.lastTimelineTitle, t.timeline.lastTimelineDesc);
      return;
    }

    const count = nodes.filter((n) => n.trackId === trackId).length;
    setDeleteTarget({
      type: 'track',
      id: trackToDelete.id,
      title: getTrackName(trackToDelete),
      subtitle: t.timeline.parallelTimeline,
      itemCount: count,
    });
  };

  // Save Track Name or New Track
  const handleSaveTrackModal = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = tempTrackName.trim().toUpperCase() || t.timeline.parallelTimeline;

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
    setDeleteTarget({
      type: 'clear_all',
      title: t.timeline.allTimelineEvents,
      subtitle: t.timeline.totalClear,
      itemCount: nodes.length,
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'node' && deleteTarget.id) {
      setNodes((prev) => prev.filter((n) => n.id !== deleteTarget.id));
      setBranches((prev) =>
        prev.filter((b) => b.sourceNodeId !== deleteTarget.id && b.targetNodeId !== deleteTarget.id)
      );
      if (selectedNode?.id === deleteTarget.id) setSelectedNode(null);
      if (readerNode?.id === deleteTarget.id) setReaderNode(null);
    } else if (deleteTarget.type === 'branch' && deleteTarget.id) {
      setBranches((prev) => prev.filter((b) => b.id !== deleteTarget.id));
    } else if (deleteTarget.type === 'track' && deleteTarget.id) {
      setTracks((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setNodes((prev) => prev.filter((n) => n.trackId !== deleteTarget.id));
      setBranches((prev) =>
        prev.filter((b) => b.sourceTrackId !== deleteTarget.id && b.targetTrackId !== deleteTarget.id)
      );
    } else if (deleteTarget.type === 'clear_all') {
      setNodes([]);
      setBranches([]);
      setSelectedNode(null);
      setReaderNode(null);
    }
    setDeleteTarget(null);
  };

  // Listen for external clear timeline trigger from Navbar Project Menu
  useEffect(() => {
    const handleExternalClear = () => {
      handleClearAll();
    };
    window.addEventListener('worlddeck_clear_timeline', handleExternalClear);
    return () => window.removeEventListener('worlddeck_clear_timeline', handleExternalClear);
  }, [nodes]);

  const linkedCardForReader = readerNode?.cardId ? cards.find((c) => c.id === readerNode.cardId) : null;
  const viewportHeight = containerBounds.height;

  return (
    <div className="flex-1 app-bg-main app-text-main flex flex-col relative overflow-hidden select-none transition-colors duration-200">
      
      {/* Main Canvas Viewport */}
      <div className="flex-1 relative overflow-hidden flex">
        <div
          ref={containerRef}
          onMouseDown={handleMouseDownBg}
          onMouseMove={handlePointerMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={handleContextMenu}
          className={`flex-1 w-full h-full relative overflow-hidden transition-colors duration-200 app-bg-main ${
            draftBranch ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
          }`}
        >
          {/* Active Branch Helper Banner */}
          {draftBranch && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-cyan-900/90 border border-cyan-500/60 text-cyan-100 px-4 py-2 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3 text-xs font-semibold animate-in zoom-in-95 duration-200 pointer-events-auto">
              <Icons.GitBranch size={16} className="text-cyan-300 animate-pulse" />
              <span>{t.timeline.branchModeBanner}</span>
              <button
                type="button"
                onClick={() => setDraftBranch(null)}
                className="p-1 hover:bg-cyan-800/60 rounded-lg text-cyan-300 hover:text-white transition-colors cursor-pointer"
              >
                <Icons.X size={14} />
              </button>
            </div>
          )}

          {/* Transparent Click Target Area */}
          <div id="timeline-center-bg" className="absolute inset-0 w-full h-full bg-transparent" />

          {/* Render Multi-Track Horizontal Lines & Labels */}
          {sortedTracks.map((track) => {
            const trackCenterY = getTrackCenterY(track.id, viewportHeight);
            const isMain = isMainTrack(track);

            return (
              <React.Fragment key={track.id}>
                {/* Horizontal Timeline Axis Line (Minimalist Double-Rail for Main Track) */}
                {isMain ? (
                  <div
                    style={{ top: `${trackCenterY}px` }}
                    className="absolute left-0 right-0 -translate-y-1/2 pointer-events-none"
                  >
                    {/* Upper thin parallel accent line */}
                    <div className="absolute left-0 right-0 -top-1.5 h-0.5 bg-[var(--line-stroke)]/40" />
                    {/* Main center line: Theme Accent */}
                    <div className="h-2 app-accent-bg" />
                    {/* Lower thin parallel accent line */}
                    <div className="absolute left-0 right-0 -bottom-1.5 h-0.5 bg-[var(--line-stroke)]/40" />
                  </div>
                ) : (
                  <div
                    style={{ top: `${trackCenterY}px` }}
                    className="absolute left-0 right-0 -translate-y-1/2 h-1.5 pointer-events-none bg-[var(--line-stroke)] shadow-sm opacity-90 transition-colors"
                  />
                )}

                {/* Floating Track Name Badge on Left Margin */}
                <div
                  style={{ top: `${trackCenterY}px` }}
                  className="absolute left-6 -translate-y-1/2 z-20 pointer-events-none"
                >
                  {isMain ? (
                    <span className="px-2.5 py-1 rounded-lg app-bg-secondary border border-[var(--accent)] text-[10px] font-mono font-bold app-accent-text shadow-md backdrop-blur-xs uppercase tracking-wider">
                      {t.timeline.mainTag} {getTrackName(track)}
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg app-bg-secondary border app-border text-[10px] font-mono font-bold app-text-main shadow-sm backdrop-blur-xs uppercase tracking-wider">
                      {getTrackName(track)}
                    </span>
                  )}
                </div>
              </React.Fragment>
            );
          })}

          {/* SVG Layer for Directional Arrows, Track Labels, and Branch Connections */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            <defs>
              <marker
                id="branch-arrow"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
              </marker>
            </defs>

            {/* GPU Translated SVG World Content */}
            <g style={{ transform: `translateX(${scrollX}px)` }}>
              {/* Render Permanent Branches */}
              {branches.map((branch) => {
                const sourceTrackY = getTrackCenterY(branch.sourceTrackId, viewportHeight);
                const targetTrackY = getTrackCenterY(branch.targetTrackId, viewportHeight);

                const startX = branch.sourceX;
                const startY = sourceTrackY;
                const endX = branch.targetX;
                const endY = targetTrackY;

                const isSameTrack = branch.sourceTrackId === branch.targetTrackId;

                let pathD = '';
                if (isSameTrack) {
                  const isLoop = branch.targetX < branch.sourceX;
                  const loopOffset = isLoop ? -110 : 110;
                  const midX = (startX + endX) / 2;
                  const cpY = startY + loopOffset;
                  pathD = `M ${startX} ${startY} Q ${midX} ${cpY} ${endX} ${endY}`;
                } else {
                  const dx = (endX - startX) * 0.45;
                  pathD = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;
                }

                const midX = (startX + endX) / 2;
                const midY =
                  (startY + endY) / 2 + (isSameTrack ? (branch.targetX < branch.sourceX ? -60 : 60) : 0);

                return (
                  <g
                    key={branch.id}
                    className="group cursor-pointer pointer-events-auto"
                    onContextMenu={(e) => handleRightClickBranch(branch, e)}
                  >
                    {/* Thick Hover Click Target */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="var(--text-muted)"
                      strokeWidth={14}
                      strokeOpacity={0.01}
                      className="group-hover:stroke-opacity-20 transition-colors cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRightClickBranch(branch, e);
                      }}
                    />
                    {/* Visible Thicker Dashed Branch Line */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="var(--line-stroke-highlight)"
                      strokeWidth={3}
                      strokeDasharray="6 4"
                      strokeLinecap="round"
                      markerEnd="url(#branch-arrow)"
                      className="group-hover:stroke-[var(--accent)] transition-colors"
                    />
                    {/* Floating Branch Badge */}
                    <g style={{ transform: `translate(${midX}px, ${midY}px)` }}>
                      <rect
                        x="-70"
                        y="-11"
                        width="140"
                        height="22"
                        rx="6"
                        fill="var(--bg-secondary)"
                        stroke="var(--border)"
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="4"
                        fill="var(--text-primary)"
                        fontSize="9"
                        fontWeight="800"
                        textAnchor="middle"
                        className="select-none font-mono uppercase tracking-tight"
                      >
                        {branch.label}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Active Draft Branch Cable Following Cursor */}
              {draftBranch && (
                <g className="pointer-events-none">
                  <path
                    d={`M ${draftBranch.sourceX} ${getTrackCenterY(draftBranch.sourceTrackId, viewportHeight)} L ${mouseWorldPos.x} ${mouseWorldPos.y}`}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    className="animate-pulse"
                  />
                  <circle
                    cx={mouseWorldPos.x}
                    cy={mouseWorldPos.y}
                    r={6}
                    fill="var(--accent)"
                    className="animate-ping"
                  />
                </g>
              )}

              {sortedTracks.map((track) => {
                const trackY = getTrackCenterY(track.id, viewportHeight);
                const isMain = isMainTrack(track);

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
                          stroke={isMain ? 'var(--accent)' : 'var(--line-stroke)'}
                          strokeWidth={isMain ? 2.5 : 2}
                          strokeOpacity={isMain ? 0.75 : 0.65}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ transform: `translate(${arrowX}px, ${trackY}px)` }}
                        />
                      );
                    })}

                    {/* Repeating Track Name Labels along each Track */}
                    {Array.from({ length: 40 }).map((_, idx) => {
                      const labelX = -750 + idx * 400;
                      return (
                        <text
                          key={`label-${track.id}-${idx}`}
                          x={labelX}
                          y={trackY - 14}
                          fill={isMain ? 'var(--text-primary)' : 'var(--line-stroke)'}
                          fillOpacity={isMain ? 0.65 : 0.55}
                          fontSize={11}
                          fontWeight="700"
                          letterSpacing="0.25em"
                          textAnchor="middle"
                          className="uppercase select-none font-mono"
                        >
                          {getTrackName(track)}
                        </text>
                      );
                    })}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Floating Hover (+) Button on Target Track Axis Line */}
          {hoverTrackId !== null && hoverWorldX !== null && !isPanning && !draggingNodeId && !draftBranch && (
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
                className="w-8 h-8 rounded-full app-bg-secondary hover:app-accent-bg app-text-main hover:text-white border app-border flex items-center justify-center shadow-lg hover:scale-125 active:scale-95 transition-all ring-4 ring-[var(--accent)]/20 cursor-pointer"
                title={t.timeline.addEventTooltip}
              >
                <Icons.Plus size={18} />
              </button>
            </div>
          )}

          {/* Render Timeline Nodes grouped by Track */}
          <div
            className="absolute inset-0 pointer-events-none z-20"
            style={{ transform: `translateX(${scrollX}px)` }}
          >
            {nodes.map((node, index) => {
              const nodeTrack = tracks.find((t) => t.id === node.trackId) || sortedTracks[0];
              const trackY = getTrackCenterY(nodeTrack.id, viewportHeight);
              const isMain = isMainTrack(nodeTrack);

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
                  onContextMenu={(e) => handleRightClickNode(node, e)}
                >
                  {/* Stem Line connected to Track Horizontal Line */}
                  <div
                    className={`absolute left-1/2 -translate-x-1/2 w-0.5 transition-colors ${
                      isSelected
                        ? 'bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]'
                        : isMain
                        ? 'bg-[var(--accent)]'
                        : 'bg-[var(--border-light)]'
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
                      if (draftBranch) {
                        handleCompleteBranch(node.trackId, node.x, node.id);
                        return;
                      }
                      setSelectedNode(node);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode(node);
                      setReaderNode(node);
                    }}
                    className={`absolute -left-4 -top-4 w-8 h-8 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing z-30 transition-all ${
                      isSelected
                        ? 'app-accent-bg text-white ring-4 ring-[var(--accent)]/40 scale-125 shadow-lg'
                        : isMain
                        ? 'app-bg-main border-2 border-[var(--accent)] ring-2 ring-[var(--accent)]/30 hover:scale-125'
                        : 'app-bg-secondary border-2 border-[var(--border-light)] hover:border-[var(--accent)] hover:scale-125 hover:ring-4 hover:ring-[var(--accent)]/30'
                    }`}
                    title={t.timeline.nodeTooltip}
                  >
                    <div
                      className={`w-3 h-3 rounded-full pointer-events-none ${
                        isSelected ? 'bg-white' : isMain ? 'app-accent-bg font-bold' : 'app-bg-hover'
                      }`}
                    />
                  </div>

                  {/* Event Card (Alternating Top / Bottom) */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (draftBranch) {
                        handleCompleteBranch(node.trackId, node.x, node.id);
                        return;
                      }
                      setSelectedNode(node);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode(node);
                      setReaderNode(node);
                    }}
                    className={`absolute left-1/2 -translate-x-1/2 w-64 p-3.5 rounded-2xl app-bg-secondary border transition-all duration-200 cursor-pointer shadow-xl group ${
                      isUpper ? '-translate-y-full' : ''
                    } ${
                      isSelected
                        ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30 scale-102 shadow-2xl'
                        : 'app-border hover:border-[var(--accent)]'
                    }`}
                    style={{
                      top: isUpper ? `-${stemHeight + 10}px` : `${stemHeight + 10}px`,
                    }}
                    title={t.timeline.nodeCardTooltip}
                  >
                    {/* Compact Event Image Thumbnail Banner */}
                    {(node.imageUrl || (node.images && node.images.length > 0)) && (
                      <div className="relative h-16 w-full rounded-xl overflow-hidden mb-2 border app-border bg-black/40 group-hover:border-[var(--accent)]/50 transition-colors">
                        <img
                          src={node.imageUrl || node.images?.[0]}
                          alt={node.title}
                          className="w-full h-full object-cover select-none pointer-events-none"
                        />
                        {node.images && node.images.length > 1 && (
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-[9px] font-mono font-bold text-white flex items-center gap-1 shadow-sm">
                            <Icons.Image size={10} />
                            <span>+{node.images.length - 1}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Header Label */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded app-bg-main app-text-muted border app-border truncate">
                        {node.dateLabel || t.timeline.eventDefaultTag}
                      </span>
                    </div>

                    {/* Title */}
                    <h4 className="text-xs font-bold app-text-main line-clamp-2 leading-snug group-hover:app-accent-text transition-colors">
                      {node.title}
                    </h4>

                    {/* Description */}
                    {node.description && (
                      <p className="text-[11px] app-text-muted mt-1.5 line-clamp-2 leading-relaxed">
                        {node.description}
                      </p>
                    )}

                    {/* Actions Footer */}
                    <div className="mt-2.5 pt-2 border-t app-border flex items-center justify-end gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingNode(node);
                          setTargetTrackId(node.trackId);
                          setModalX(node.x);
                          setShowNodeModal(true);
                        }}
                        className="p-1 rounded-md app-text-muted hover:app-text-main hover:app-bg-hover transition-colors"
                        title={t.timeline.editEvent}
                      >
                        <Icons.Edit2 size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNode(node.id);
                        }}
                        className="p-1 rounded-md text-rose-500 hover:bg-rose-500/10 transition-colors"
                        title={t.timeline.deleteEvent}
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

        {/* Dynamic Context Menu (Event Nodes, Parallel Timelines, Branches & Canvas) */}
        {contextMenu && (
          <div
            style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
            className="fixed app-bg-secondary border app-border rounded-xl shadow-2xl py-1.5 w-60 z-[100] text-xs app-text-main animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-700/50 max-h-[80vh] overflow-y-auto custom-scrollbar"
          >
            {contextMenu.selectedNode ? (
              <>
                <div className="px-3 py-1.5 text-[10px] app-text-muted font-bold uppercase tracking-wider select-none truncate flex items-center justify-between">
                  <span className="truncate">📌 {contextMenu.selectedNode.title}</span>
                  <span className="text-[9px] font-mono opacity-60">Node</span>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNode(contextMenu.selectedNode!);
                      setTargetTrackId(contextMenu.selectedNode!.trackId);
                      setModalX(contextMenu.selectedNode!.x);
                      setShowNodeModal(true);
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold app-text-main cursor-pointer"
                  >
                    <Icons.Edit3 size={14} className="text-blue-400" />
                    <span>{t.timeline.editEvent}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedNode(contextMenu.selectedNode!);
                      setReaderNode(contextMenu.selectedNode!);
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold app-text-main cursor-pointer"
                  >
                    <Icons.Eye size={14} className="text-purple-400" />
                    <span>{t.timeline.viewEventDetails}</span>
                  </button>

                  {contextMenu.selectedNode.cardId && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetCard = cards.find((c) => c.id === contextMenu.selectedNode!.cardId);
                        if (targetCard) onCardClick(targetCard);
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold app-text-main cursor-pointer"
                    >
                      <Icons.BookOpen size={14} className="text-emerald-400" />
                      <span>{t.timeline.openCard}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setDraftBranch({
                        sourceTrackId: contextMenu.selectedNode!.trackId,
                        sourceX: contextMenu.selectedNode!.x,
                        sourceNodeId: contextMenu.selectedNode!.id,
                      });
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold app-text-main cursor-pointer"
                  >
                    <Icons.GitBranch size={14} className="text-amber-400" />
                    <span>{t.timeline.createTimeBranch}</span>
                  </button>
                </div>

                {/* Move to another track option */}
                {sortedTracks.length > 1 && (
                  <div className="py-1">
                    <div className="px-3 py-1 text-[10px] app-text-muted font-semibold uppercase">
                      {t.timeline.moveToTrack}
                    </div>
                    {sortedTracks.map((tr) => {
                      if (tr.id === contextMenu.selectedNode!.trackId) return null;
                      return (
                        <button
                          key={tr.id}
                          type="button"
                          onClick={() => {
                            handleMoveNodeToTrack(contextMenu.selectedNode!.id, tr.id);
                            setContextMenu(null);
                          }}
                          className="w-full px-4 py-1.5 text-left hover:app-bg-hover flex items-center gap-2 transition-colors text-xs font-medium app-text-main cursor-pointer"
                        >
                          <Icons.ArrowRight size={12} className="text-slate-400" />
                          <span className="truncate">{getTrackName(tr)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteNode(contextMenu.selectedNode!.id);
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors text-rose-500 font-medium cursor-pointer"
                  >
                    <Icons.Trash2 size={14} />
                    <span>{t.timeline.deleteEvent}</span>
                  </button>
                </div>
              </>
            ) : contextMenu.selectedBranch ? (
              <>
                <div className="px-3 py-1.5 text-[10px] app-text-muted font-bold uppercase tracking-wider select-none truncate">
                  🔀 {contextMenu.selectedBranch.label || t.timeline.timeBranch}
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBranch(contextMenu.selectedBranch!);
                      setTempBranchLabel(contextMenu.selectedBranch!.label || t.timeline.timeBranch);
                      setShowBranchModal(true);
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold app-text-main cursor-pointer"
                  >
                    <Icons.Edit3 size={14} />
                    <span>{t.timeline.renameBranch}</span>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteBranch(contextMenu.selectedBranch!.id);
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors text-rose-500 font-medium cursor-pointer"
                  >
                    <Icons.Trash2 size={14} />
                    <span>{t.timeline.deleteTimeBranch}</span>
                  </button>
                </div>
              </>
            ) : contextMenu.targetTrack ? (
              <>
                <div className="px-3 py-1.5 text-[10px] app-text-muted font-bold uppercase tracking-wider select-none truncate">
                  🕒 {getTrackName(contextMenu.targetTrack)}
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNode(null);
                      setTargetTrackId(contextMenu.targetTrack!.id);
                      setModalX(contextMenu.clickWorldX || 100);
                      setShowNodeModal(true);
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold text-emerald-400 cursor-pointer"
                  >
                    <Icons.Plus size={14} />
                    <span>{t.timeline.addEventHere}</span>
                  </button>
                </div>

                {/* Branching Actions */}
                {draftBranch ? (
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        handleCompleteBranch(
                          contextMenu.targetTrack!.id,
                          contextMenu.clickWorldX!,
                          contextMenu.clickNodeId
                        );
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold text-blue-400 cursor-pointer"
                    >
                      <Icons.GitCommit size={14} />
                      <span>{t.timeline.connectBranchHere}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDraftBranch(null);
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors app-text-muted font-medium cursor-pointer"
                    >
                      <Icons.X size={14} />
                      <span>{t.timeline.cancelBranching}</span>
                    </button>
                  </div>
                ) : (
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDraftBranch({
                          sourceTrackId: contextMenu.targetTrack!.id,
                          sourceX: contextMenu.clickWorldX!,
                          sourceNodeId: contextMenu.clickNodeId,
                        });
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold app-text-main cursor-pointer"
                    >
                      <Icons.GitBranch size={14} />
                      <span>{t.timeline.createTimeBranch}</span>
                    </button>
                  </div>
                )}

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      handleAutoSpaceTrack(contextMenu.targetTrack!.id);
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-medium app-text-main cursor-pointer"
                  >
                    <Icons.AlignJustify size={14} className="text-amber-400" />
                    <span>{t.timeline.autoSpaceEvents}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingTrack(contextMenu.targetTrack!);
                      setTempTrackName(contextMenu.targetTrack!.name);
                      setShowTrackModal(true);
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold app-text-main cursor-pointer"
                  >
                    <Icons.Edit3 size={14} />
                    <span>{t.timeline.rename} ({getTrackName(contextMenu.targetTrack)})</span>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      const newOrder = getNewOrderAbove(contextMenu.targetTrack!);
                      handleAddParallelTrack(newOrder);
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold text-emerald-400 cursor-pointer"
                  >
                    <Icons.Plus size={14} />
                    <span>{t.timeline.addParallelAbove}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const newOrder = getNewOrderBelow(contextMenu.targetTrack!);
                      handleAddParallelTrack(newOrder);
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold text-emerald-400 cursor-pointer"
                  >
                    <Icons.Plus size={14} />
                    <span>{t.timeline.addParallelBelow}</span>
                  </button>
                </div>

                {!isMainTrack(contextMenu.targetTrack!) && (
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteTrack(contextMenu.targetTrack!.id);
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors text-rose-500 font-medium cursor-pointer"
                    >
                      <Icons.Trash2 size={14} />
                      <span>{t.timeline.deleteTimeline} ({getTrackName(contextMenu.targetTrack)})</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (contextMenu.clickOrderPosition !== undefined) {
                        handleAddParallelTrack(contextMenu.clickOrderPosition);
                      }
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold text-emerald-400 cursor-pointer"
                  >
                    <Icons.PlusSquare size={14} />
                    <span>{t.timeline.addParallelHere}</span>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      handleResetCamera();
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-semibold app-text-main cursor-pointer"
                  >
                    <Icons.Compass size={14} className="text-blue-400" />
                    <span>{t.timeline.resetCamera}</span>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      handleClearAll();
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors text-rose-500 font-medium cursor-pointer"
                  >
                    <Icons.Trash2 size={14} />
                    <span>{t.timeline.totalClear}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Right Drawer Slide-over Panel for Reader Node */}
        {readerNode && (
          <div className="w-80 sm:w-96 app-bg-secondary border-l app-border flex flex-col z-30 shadow-2xl animate-in slide-in-from-right duration-200 app-text-main">
            <div className="p-4 border-b app-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icons.Clock size={16} className="app-accent-text" />
                <h3 className="text-xs font-bold uppercase tracking-wider app-text-main">{t.timeline.eventDetails}</h3>
              </div>
              <button
                type="button"
                onClick={() => setReaderNode(null)}
                className="p-1 rounded-lg app-text-muted hover:app-text-main hover:app-bg-hover"
              >
                <Icons.X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider app-text-muted app-bg-main px-2 py-0.5 rounded border app-border">
                  {readerNode.dateLabel || t.timeline.mainTrack}
                </span>
                <h2 className="text-base font-bold app-text-main mt-2 leading-tight">
                  {readerNode.title}
                </h2>
              </div>

              {readerNode.description && (
                <div className="p-3 rounded-xl app-bg-main border app-border text-xs app-text-muted leading-relaxed">
                  {readerNode.description}
                </div>
              )}

              {/* Event Image Gallery */}
              {readerImages.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold app-text-muted uppercase tracking-wider">
                    {t.cardReader.imageGallery} ({readerImages.length})
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {readerImages.map((img, idx) => (
                      <div
                        key={idx}
                        onClick={() => setPreviewEventImageIndex(idx)}
                        className="relative rounded-xl overflow-hidden border app-border aspect-video bg-black/40 cursor-pointer group hover:border-[var(--accent)] transition-all shadow-md"
                        title="Klik untuk memperbesar gambar"
                      >
                        <img
                          src={img}
                          alt={`Event image ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Icons.Maximize2 size={16} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked Card Information */}
              <div>
                <h4 className="text-[11px] font-bold app-text-muted uppercase tracking-wider mb-2">
                  {t.timeline.linkedCardHeader}
                </h4>
                {linkedCardForReader ? (
                  <div
                    onClick={() => onCardClick(linkedCardForReader)}
                    className="p-3 rounded-xl app-bg-main border app-border hover:border-[var(--accent)] cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-[10px] uppercase font-semibold app-text-muted">
                        {linkedCardForReader.category}
                      </div>
                      <div className="font-bold app-text-main group-hover:app-accent-text transition-colors">
                        {linkedCardForReader.title}
                      </div>
                    </div>
                    <Icons.ChevronRight size={16} className="app-text-muted group-hover:translate-x-1 transition-transform" />
                  </div>
                ) : (
                  <div className="p-3 rounded-xl app-bg-main border app-border text-center app-text-muted text-xs">
                    {t.timeline.noLinkedCard}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 border-t app-border flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingNode(readerNode);
                  setTargetTrackId(readerNode.trackId);
                  setModalX(readerNode.x);
                  setShowNodeModal(true);
                }}
                className="flex-1 py-2 rounded-xl app-bg-main border app-border hover:app-bg-hover text-xs font-semibold app-text-main flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Icons.Edit2 size={13} />
                <span>{t.timeline.editEvent}</span>
              </button>
              <button
                type="button"
                onClick={() => handleDeleteNode(readerNode.id)}
                className="px-3 py-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm app-bg-secondary border app-border rounded-2xl p-5 shadow-2xl app-text-main modal-animate-appear">
            <div className="flex items-center justify-between mb-4 border-b app-border pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2 app-text-main">
                <Icons.Edit3 size={16} className="app-text-muted" />
                <span>{editingTrack ? t.timeline.renameTimelineTitle : t.timeline.newParallelTimelineTitle}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowTrackModal(false);
                  setEditingTrack(null);
                  setNewTrackOrderPosition(null);
                }}
                className="p-1 rounded-lg app-text-muted hover:app-text-main hover:app-bg-hover"
              >
                <Icons.X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveTrackModal} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold app-text-muted uppercase mb-1">
                  {t.timeline.timelineNameLabel}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t.timeline.timelineNamePlaceholder}
                  value={tempTrackName}
                  onChange={(e) => setTempTrackName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl app-bg-main border app-border app-text-main focus:outline-none focus:border-[var(--accent)] font-mono text-xs uppercase"
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
                  className="px-4 py-2 rounded-xl app-bg-main app-text-main border app-border font-semibold hover:app-bg-hover transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl app-accent-bg text-white font-bold hover:opacity-90 cursor-pointer transition-all shadow-md"
                >
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Branch Name Modal */}
      {showBranchModal && editingBranch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm app-bg-secondary border app-border rounded-2xl p-5 shadow-2xl app-text-main modal-animate-appear">
            <div className="flex items-center justify-between mb-4 border-b app-border pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2 app-text-main">
                <Icons.GitBranch size={16} className="app-text-muted" />
                <span>{t.timeline.renameBranchTitle}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowBranchModal(false);
                  setEditingBranch(null);
                }}
                className="p-1 rounded-lg app-text-muted hover:app-text-main hover:app-bg-hover"
              >
                <Icons.X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveBranchModal} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold app-text-muted uppercase mb-1">
                  {t.timeline.branchLabel}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t.timeline.branchLabelPlaceholder}
                  value={tempBranchLabel}
                  onChange={(e) => setTempBranchLabel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl app-bg-main border app-border app-text-main focus:outline-none focus:border-[var(--accent)] font-mono text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowBranchModal(false);
                    setEditingBranch(null);
                  }}
                  className="px-4 py-2 rounded-xl app-bg-main app-text-main border app-border font-semibold hover:app-bg-hover transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl app-accent-bg text-white font-bold hover:opacity-90 cursor-pointer transition-all shadow-md"
                >
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      <TimelineDeleteModal
        isOpen={!!deleteTarget}
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Custom Reusable Notice Modal */}
      <ConfirmModal
        config={noticeModal}
        onClose={() => setNoticeModal(null)}
      />

      {/* Fullscreen Carousel Lightbox Preview Modal for Event Images */}
      {previewEventImageIndex !== null && readerImages.length > 0 && (
        <div
          className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200 select-none cursor-pointer"
          onClick={() => setPreviewEventImageIndex(null)}
        >
          {/* Top Bar: Counter & Close */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-20">
            <span className="text-xs font-mono font-bold bg-white/10 px-3.5 py-1.5 rounded-full backdrop-blur-md border border-white/10 shadow-lg">
              {previewEventImageIndex + 1} / {readerImages.length}
            </span>
            <button
              type="button"
              onClick={() => setPreviewEventImageIndex(null)}
              className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer backdrop-blur-md"
              title="Tutup Preview (Escape)"
            >
              <Icons.X size={20} />
            </button>
          </div>

          {/* Left Arrow (Looping) */}
          {readerImages.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewEventImageIndex((prev) => (prev === null || prev <= 0 ? readerImages.length - 1 : prev - 1));
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white bg-black/60 hover:bg-black/90 border border-white/20 rounded-full transition-all cursor-pointer z-30 hover:scale-110 shadow-2xl"
              title="Gambar Sebelumnya (Panah Kiri)"
            >
              <Icons.ChevronLeft size={24} />
            </button>
          )}

          {/* Main Image */}
          <div
            className="relative max-w-5xl max-h-[85vh] flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={readerImages[previewEventImageIndex]}
              alt={`Preview ${previewEventImageIndex + 1}`}
              className="max-w-full max-h-[82vh] object-contain rounded-2xl border border-white/10 shadow-2xl transition-all"
            />
          </div>

          {/* Right Arrow (Looping) */}
          {readerImages.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewEventImageIndex((prev) => (prev === null || prev >= readerImages.length - 1 ? 0 : prev + 1));
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white bg-black/60 hover:bg-black/90 border border-white/20 rounded-full transition-all cursor-pointer z-30 hover:scale-110 shadow-2xl"
              title="Gambar Selanjutnya (Panah Kanan)"
            >
              <Icons.ChevronRight size={24} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Simple Event Modal Component (Minimalist & Sleek)
const SimpleNodeModal: React.FC<{
  node: SimpleTimelineNode | null;
  cards: WorldCard[];
  onSave: (data: {
    title: string;
    dateLabel?: string;
    description?: string;
    cardId?: string;
    images?: string[];
    imageUrl?: string;
  }) => void;
  onClose: () => void;
}> = ({ node, cards, onSave, onClose }) => {
  const { language, t, getCategoryLabel } = useLanguage();
  const [title, setTitle] = useState(node?.title || '');
  const [dateLabel, setDateLabel] = useState(node?.dateLabel || '');
  const [description, setDescription] = useState(node?.description || '');
  const [cardId, setCardId] = useState<string>(node?.cardId || '');
  const [cardSearch, setCardSearch] = useState('');
  const [showCardDropdown, setShowCardDropdown] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const [images, setImages] = useState<string[]>(() => {
    const existing = node?.images ? [...node.images] : [];
    if (node?.imageUrl && !existing.includes(node.imageUrl)) {
      existing.unshift(node.imageUrl);
    }
    return existing;
  });
  const [imageUrl, setImageUrl] = useState<string>(node?.imageUrl || (node?.images?.[0] || ''));

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const res = ev.target?.result as string;
      if (res) {
        let finalUrl = res;
        if (isTauriAvailable()) {
          try {
            const hint = file.name || title || 'event-image';
            const savedUrl = await saveImageAsset(res, hint);
            if (savedUrl) finalUrl = savedUrl;
          } catch (err) {
            console.warn('saveImageAsset error, fallback to base64:', err);
          }
        }
        setImages((prev) => (prev.includes(finalUrl) ? prev : [...prev, finalUrl]));
        if (!imageUrl) setImageUrl(finalUrl);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const isDirty = () => {
    const initialTitle = node?.title || '';
    const initialDateLabel = node?.dateLabel || '';
    const initialDescription = node?.description || '';
    const initialCardId = node?.cardId || '';
    const initialImages = JSON.stringify(node?.images || (node?.imageUrl ? [node.imageUrl] : []));
    const currentImages = JSON.stringify(images);
    const initialCover = node?.imageUrl || (node?.images?.[0] || '');

    return (
      title.trim() !== initialTitle.trim() ||
      dateLabel.trim() !== initialDateLabel.trim() ||
      description.trim() !== initialDescription.trim() ||
      cardId !== initialCardId ||
      currentImages !== initialImages ||
      imageUrl !== initialCover
    );
  };

  const handleCloseRequest = () => {
    if (!isDirty()) {
      onClose();
    } else {
      setShowExitConfirm(true);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      dateLabel: dateLabel.trim() || t.timeline.defaultEra,
      description: description.trim(),
      cardId: cardId || undefined,
      images,
      imageUrl: imageUrl || (images[0] || undefined),
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150 cursor-pointer"
      onClick={handleCloseRequest}
    >
      <div
        className="w-full max-w-lg app-bg-secondary border app-border rounded-3xl p-6 shadow-2xl app-text-main modal-animate-appear divide-y divide-slate-800/40 cursor-default relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl app-accent-bg/10 border border-[var(--accent)]/30 flex items-center justify-center app-accent-text shadow-inner">
              <Icons.Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold app-text-main tracking-tight">
                {node ? t.timeline.editEventTitle : t.timeline.addEventTitle}
              </h3>
              <p className="text-[11px] app-text-muted">
                {node ? 'Perbarui informasi titik garis waktu' : 'Tambahkan titik peristiwa baru pada garis waktu'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseRequest}
            className="w-8 h-8 rounded-xl app-bg-main border app-border flex items-center justify-center text-slate-400 hover:text-white hover:app-bg-hover transition-colors cursor-pointer"
          >
            <Icons.X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="pt-4 space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold app-text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Icons.FileText size={12} className="text-blue-400" />
                <span>{t.timeline.eventTitleLabel}</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder={t.timeline.eventTitlePlaceholder}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl app-bg-main border app-border app-text-main focus:outline-none focus:border-[var(--accent)] font-medium text-xs shadow-inner transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold app-text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Icons.Tag size={12} className="text-amber-400" />
                <span>{t.timeline.timeMarkerLabel}</span>
              </label>
              <input
                type="text"
                placeholder={t.timeline.timeMarkerPlaceholder}
                value={dateLabel}
                onChange={(e) => setDateLabel(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl app-bg-main border app-border app-text-main focus:outline-none focus:border-[var(--accent)] text-xs shadow-inner font-mono transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold app-text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Icons.Link size={12} className="text-emerald-400" />
              <span>{t.timeline.linkCardLabel}</span>
            </label>

            {(() => {
              const selectedCard = cards.find((c) => c.id === cardId);
              const filteredCards = cards.filter((c) => {
                if (!cardSearch.trim()) return true;
                const query = cardSearch.toLowerCase();
                const cardTitle = (c.title || '').toLowerCase();
                const categoryLabel = (getCategoryLabel(c.category) || '').toLowerCase();
                return cardTitle.includes(query) || categoryLabel.includes(query);
              });

              if (selectedCard) {
                return (
                  <div className="flex items-center justify-between px-3.5 py-2 rounded-xl app-bg-main border border-[var(--accent)]/50 app-text-main text-xs shadow-inner">
                    <div className="flex items-center gap-2 truncate">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase app-accent-bg text-white shrink-0">
                        {getCategoryLabel(selectedCard.category)}
                      </span>
                      <span className="font-semibold truncate">{selectedCard.title || t.common.untitled}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCardId('');
                        setCardSearch('');
                      }}
                      className="p-1 rounded-lg app-text-muted hover:text-rose-400 hover:app-bg-hover transition-colors cursor-pointer"
                      title="Hapus Tautan Kartu"
                    >
                      <Icons.X size={14} />
                    </button>
                  </div>
                );
              }

              return (
                <div className="relative">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ketik untuk mencari kartu (karakter, lokasi, faksi...)"
                      value={cardSearch}
                      onFocus={() => setShowCardDropdown(true)}
                      onChange={(e) => {
                        setCardSearch(e.target.value);
                        setShowCardDropdown(true);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl app-bg-main border app-border app-text-main focus:outline-none focus:border-[var(--accent)] text-xs pr-8 shadow-inner transition-all"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none app-text-muted">
                      <Icons.Search size={14} />
                    </div>
                  </div>

                  {/* Dropdown Suggestions */}
                  {showCardDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowCardDropdown(false)}
                      />
                      <div className="absolute left-0 right-0 top-full mt-1.5 app-bg-secondary border app-border rounded-2xl shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar divide-y divide-slate-800/40 text-xs">
                        {filteredCards.length > 0 ? (
                          filteredCards.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setCardId(c.id);
                                setCardSearch('');
                                setShowCardDropdown(false);
                              }}
                              className="w-full px-3.5 py-2 text-left hover:app-bg-hover flex items-center justify-between gap-2 transition-colors cursor-pointer group"
                            >
                              <span className="font-medium app-text-main group-hover:app-accent-text truncate">
                                {c.title || t.common.untitled}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[9px] font-mono uppercase app-bg-main app-text-muted border app-border">
                                {getCategoryLabel(c.category)}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="px-3.5 py-3 text-center text-xs app-text-muted">
                            Tidak ada kartu yang cocok
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Gambar Peristiwa / Image Gallery Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold app-text-muted uppercase tracking-wider flex items-center gap-1">
                <Icons.Image size={12} className="text-cyan-400" />
                <span>Gambar Peristiwa ({images.length})</span>
              </label>
              <label className="px-2.5 py-1 rounded-lg app-accent-bg/20 app-accent-text border border-[var(--accent)]/30 text-[11px] font-bold hover:app-bg-hover transition-all cursor-pointer flex items-center gap-1">
                <Icons.Plus size={12} />
                <span>Upload Gambar</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                {images.map((imgSrc, idx) => {
                  const isCover = imageUrl === imgSrc;
                  return (
                    <div
                      key={idx}
                      className={`relative rounded-xl overflow-hidden border aspect-video group bg-black/40 ${
                        isCover ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40' : 'app-border'
                      }`}
                    >
                      <img src={imgSrc} alt={`Event ${idx + 1}`} className="w-full h-full object-cover" />
                      {isCover && (
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-[var(--accent)] text-white text-[8px] font-bold">
                          Cover
                        </span>
                      )}
                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-1">
                        {!isCover && (
                          <button
                            type="button"
                            onClick={() => setImageUrl(imgSrc)}
                            className="px-1.5 py-1 rounded bg-[var(--accent)] text-white text-[9px] font-bold hover:opacity-90 cursor-pointer"
                          >
                            Cover
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const next = images.filter((img) => img !== imgSrc);
                            setImages(next);
                            if (imageUrl === imgSrc) setImageUrl(next[0] || '');
                          }}
                          className="p-1 rounded bg-rose-600 text-white hover:bg-rose-500 cursor-pointer"
                        >
                          <Icons.Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold app-text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Icons.AlignLeft size={12} className="text-purple-400" />
              <span>{t.timeline.briefDescLabel}</span>
            </label>
            <textarea
              rows={3}
              placeholder={t.timeline.briefDescPlaceholder}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl app-bg-main border app-border app-text-main focus:outline-none focus:border-[var(--accent)] resize-none text-xs shadow-inner leading-relaxed transition-all"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleCloseRequest}
              className="px-4 py-2.5 rounded-xl app-bg-main app-text-muted hover:app-text-main border app-border text-xs font-semibold hover:app-bg-hover transition-all cursor-pointer"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl app-accent-bg text-white text-xs font-bold shadow-lg shadow-[var(--accent)]/20 hover:opacity-95 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
            >
              <Icons.Check size={14} />
              <span>{t.timeline.saveEvent}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Exit Confirmation Dialog */}
      {showExitConfirm && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[160] p-4 animate-in fade-in duration-150 cursor-default"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-sm app-bg-secondary border app-border rounded-3xl p-5 shadow-2xl app-text-main text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
              <Icons.AlertTriangle size={24} />
            </div>
            <div>
              <h4 className="text-sm font-bold app-text-main">
                {language === 'en' ? 'Unsaved Changes' : 'Ada Perubahan Belum Disimpan'}
              </h4>
              <p className="text-xs app-text-muted mt-1 leading-relaxed">
                {language === 'en'
                  ? 'You have unsaved changes in this event. Do you want to save or discard them?'
                  : 'Anda memiliki perubahan pada peristiwa ini yang belum disimpan. Apakah Anda ingin menyimpan atau membuangnya?'}
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  handleSubmit(e);
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl app-accent-bg text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Icons.Save size={14} />
                <span>{language === 'en' ? 'Save & Close' : 'Simpan & Tutup'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Icons.Trash2 size={14} />
                <span>{language === 'en' ? 'Discard Changes' : 'Buang Perubahan'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="w-full py-2 rounded-xl text-xs app-text-muted hover:app-text-main font-semibold transition-all cursor-pointer"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
