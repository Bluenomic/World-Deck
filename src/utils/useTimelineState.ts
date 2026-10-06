import { useStableEvent } from "./useStableEvent";
import { useEffect, useRef, useState } from "react";
import type { TimelineTrack, TimelineNode, TimelineBranch } from "../types";
interface TimelineData {
  tracks: TimelineTrack[];
  nodes: TimelineNode[];
  branches: TimelineBranch[];
}
type Change<T> = T | ((previous: T) => T);
/** Props remain authoritative; only explicit mutations publish a single event transaction. */
export function useTimelineState(
  data: TimelineData,
  publish?: (
    tracks: TimelineTrack[],
    nodes: TimelineNode[],
    branches: TimelineBranch[],
  ) => void,
) {
  const pending = useRef<TimelineData | null>(null),
    current = useRef(data),
    callback = useRef(publish),
    alive = useRef(true);
  current.current = data;
  callback.current = publish;
  const [preview, setPreview] = useState<TimelineNode[] | null>(null);
  const previewRef = useRef<TimelineNode[] | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  function change<K extends keyof TimelineData>(
    key: K,
    update: Change<TimelineData[K]>,
  ) {
    const previous = pending.current || current.current;
    const next = typeof update === "function" ? update(previous[key]) : update;
    if (next === previous[key]) return;
    const scheduled = !!pending.current;
    pending.current = { ...previous, [key]: next };
    if (!scheduled)
      queueMicrotask(() => {
        const result = pending.current;
        pending.current = null;
        if (result && alive.current)
          callback.current?.(result.tracks, result.nodes, result.branches);
      });
  }
  const showPreview = useStableEvent((nodes: TimelineNode[] | null) => {
    previewRef.current = nodes;
    setPreview(nodes);
  });
  return {
    tracks: data.tracks,
    nodes: preview || data.nodes,
    branches: data.branches,
    setTracks: (changeValue: Change<TimelineTrack[]>) =>
      change("tracks", changeValue),
    setNodes: (changeValue: Change<TimelineNode[]>) =>
      change("nodes", changeValue),
    setBranches: (changeValue: Change<TimelineBranch[]>) =>
      change("branches", changeValue),
    previewRef,
    showPreview,
  };
}
