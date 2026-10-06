import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Map as MapIcon,
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Layers,
  X,
  MapPin as PinIcon,
  Route,
  Pentagon,
  Undo2,
  Redo2,
} from "lucide-react";
import type {
  MapPin,
  MapShape,
  TimelineNode,
  WorldCard,
  WorldDeck,
  WorldMap,
} from "../types";
import { useLanguage } from "../i18n/useLanguage";
import { generateId } from "../utils/helpers";
import {
  canParentMap,
  clampPercent,
  fitMap,
  pinAtEvent,
  shapeAtEvent,
} from "../utils/mapGeometry";
import { AddCardFromGalleryModal } from "./AddCardFromGalleryModal";
import { ConfirmModal, type ConfirmModalConfig } from "./ConfirmModal";
import "./MapView.css";
import { useDialogFocus } from "../utils/useDialogFocus";

interface MapViewProps {
  worldMaps: WorldMap[];
  cards: WorldCard[];
  decks?: WorldDeck[];
  timelineNodes?: TimelineNode[];
  projectId?: string;
  focus?: { mapId: string; pinId?: string; token: number };
  onSaveMap: (map: WorldMap) => void;
  onDeleteMap: (id: string) => void;
  onOpenCard: (id: string) => void;
  onEditCard?: (card: WorldCard) => void;
  onCreatePinCard?: (mapId: string, x: number, y: number) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}
type Point = { x: number; y: number };
type Camera = Point & { zoom: number };
type Mode = "pan" | "new" | "existing" | "route" | "region";
const COLORS = [
  "#0d99ff",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#a855f7",
  "#06b6d4",
];
const ICONS = ["●", "◆", "★", "⚑", "⌂"];
function savedCamera(key: string): Camera | null {
  try {
    const c = JSON.parse(localStorage.getItem(key) || "null");
    return c &&
      [c.x, c.y, c.zoom].every(Number.isFinite) &&
      c.zoom > 0 &&
      c.zoom <= 5
      ? c
      : null;
  } catch {
    return null;
  }
}

export function MapView({
  worldMaps,
  cards,
  decks = [],
  timelineNodes = [],
  projectId = "world",
  focus,
  onSaveMap,
  onDeleteMap,
  onOpenCard,
  onEditCard,
  onCreatePinCard,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: MapViewProps) {
  const { language, t, getCategoryLabel } = useLanguage();
  const text = (id: string, en: string) => (language === "en" ? en : id);
  const [mapId, setMapId] = useState(() => {
    try {
      return (
        localStorage.getItem(`wd-map-selected:${projectId}`) ||
        worldMaps[0]?.id ||
        ""
      );
    } catch {
      return worldMaps[0]?.id || "";
    }
  });
  const map = worldMaps.find((m) => m.id === mapId) || worldMaps[0];
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const cameraRef = useRef(camera);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [imageState, setImageState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [mode, setMode] = useState<Mode>("pan");
  const [selectedPin, setSelectedPin] = useState("");
  const [selectedShape, setSelectedShape] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [deckId, setDeckId] = useState("");
  const [tag, setTag] = useState("");
  const [labels, setLabels] = useState<"all" | "selected" | "hover">(
    "selected",
  );
  const [panel, setPanel] = useState(false);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    pinId?: string;
    point: Point | null;
  } | null>(null);
  const [hiddenLayers, setHiddenLayers] = useState<string[]>([]);
  const [activeLayer, setActiveLayer] = useState("");
  const [eventId, setEventId] = useState("");
  const [draftPoints, setDraftPoints] = useState<Point[]>([]);
  const [draftPin, setDraftPin] = useState<(Point & { id: string }) | null>(
    null,
  );
  const draftRef = useRef<typeof draftPin>(null);
  const [galleryPosition, setGalleryPosition] = useState<Point | null>(null);
  const [form, setForm] = useState<{
    id?: string;
    name: string;
    description: string;
    imageUrl: string;
    parentMapId: string;
  } | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<ConfirmModalConfig | null>(null);
  const [layerName, setLayerName] = useState("");
  const viewport = useRef<HTMLDivElement>(null);
  const fileVersion = useRef(0);
  const drag = useRef<{
    pointerId: number;
    start: Point;
    camera: Camera;
    pin?: MapPin;
    moved: boolean;
  } | null>(null);
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const events = useMemo(
    () => [...timelineNodes].sort((a, b) => a.x - b.x),
    [timelineNodes],
  );
  const effectiveMapId = map?.id;
  const consumedFocus = useRef<number | null>(null);
  useDialogFocus(panel, ".map-settings");
  useDialogFocus(!!form, ".map-modal");
  const cameraKey = `wd-map-camera:${projectId}:${map?.id}`;
  const changeCamera = useCallback((value: Camera) => {
    cameraRef.current = value;
    setCamera(value);
  }, []);
  const fit = useCallback(() => {
    if (viewport.current)
      changeCamera({
        x: 0,
        y: 0,
        zoom: fitMap(
          imageSize.width,
          imageSize.height,
          viewport.current.clientWidth,
          viewport.current.clientHeight,
        ),
      });
  }, [imageSize, changeCamera]);
  const save = (changes: Partial<WorldMap>) => {
    if (map) onSaveMap({ ...map, ...changes, updatedAt: Date.now() });
  };
  const patchPin = (id: string, changes: Partial<MapPin>) =>
    save({
      pins: map.pins.map((p) => (p.id === id ? { ...p, ...changes } : p)),
    });
  const patchShape = (id: string, changes: Partial<MapShape>) =>
    save({
      shapes: (map.shapes || []).map((s) =>
        s.id === id ? { ...s, ...changes } : s,
      ),
    });
  const commitPosition = (id: string, point: Point) => {
    const pin = map?.pins.find((p) => p.id === id);
    if (!pin) return;
    if (eventId)
      patchPin(id, {
        positions: [
          ...(pin.positions || []).filter((p) => p.eventId !== eventId),
          { eventId, ...point },
        ],
      });
    else patchPin(id, point);
  };
  useLayoutEffect(() => {
    setMode("pan");
    setSelectedPin("");
    setSelectedShape("");
    setQuery("");
    setHiddenLayers([]);
    setActiveLayer("");
    setDraftPoints([]);
    setDraftPin(null);
    draftRef.current = null;
    drag.current = null;
    setImageState("loading");
    setGalleryPosition(null);
    setError("");
    setMenu(null);
    setPanel(false);
    try {
      if (effectiveMapId)
        localStorage.setItem(`wd-map-selected:${projectId}`, effectiveMapId);
    } catch {
      /* Optional preferences. */
    }
  }, [effectiveMapId, map?.imageUrl, projectId]);
  useEffect(() => {
    if (imageState !== "ready") return;
    const timeout = window.setTimeout(() => {
      try {
        localStorage.setItem(cameraKey, JSON.stringify(camera));
      } catch {
        /* Optional cache. */
      }
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [camera, cameraKey, imageState]);
  useEffect(() => {
    if (!focus) return;
    setMapId(focus.mapId);
    setSelectedPin(focus.pinId || "");
    setQuery("");
    setCategory("");
    setTag("");
    setDeckId("");
    setHiddenLayers([]);
  }, [focus]);
  const centerPin = useCallback(
    (pin: MapPin) => {
      const zoom = Math.max(
        cameraRef.current.zoom,
        Math.min(1, 700 / imageSize.width),
      );
      changeCamera({
        zoom,
        x: ((50 - pin.x) / 100) * imageSize.width * zoom,
        y: ((50 - pin.y) / 100) * imageSize.height * zoom,
      });
    },
    [imageSize, changeCamera],
  );
  useEffect(() => {
    if (
      imageState === "ready" &&
      focus?.mapId === map?.id &&
      focus.pinId &&
      consumedFocus.current !== focus.token
    ) {
      const pin = map.pins.find((p) => p.id === focus.pinId);
      if (pin) {
        consumedFocus.current = focus.token;
        setSelectedPin(pin.id);
        centerPin(pinAtEvent(pin, eventId, events));
      }
    }
  }, [focus, imageState, map, eventId, events, centerPin]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMode("pan");
        setDraftPoints([]);
        setGalleryPosition(null);
        setForm(null);
        fileVersion.current++;
        setImageBusy(false);
        setMenu(null);
        setPanel(false);
        setDraftPin(null);
        draftRef.current = null;
        drag.current = null;
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  // Follow the actual viewport, including the first uploaded map.
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest("button,input,select")) return;
      e.preventDefault();
      if (drag.current) return;
      const c = cameraRef.current;
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const point = {
          x: e.clientX - rect.left - rect.width / 2,
          y: e.clientY - rect.top - rect.height / 2,
        };
        const zoom = Math.max(
          0.01,
          Math.min(5, c.zoom * Math.exp(-e.deltaY * 0.002)),
        );
        changeCamera({
          zoom,
          x: point.x - ((point.x - c.x) * zoom) / c.zoom,
          y: point.y - ((point.y - c.y) * zoom) / c.zoom,
        });
      } else
        changeCamera({
          ...c,
          x: c.x - (e.shiftKey ? e.deltaY : e.deltaX),
          y: c.y - (e.shiftKey ? 0 : e.deltaY),
        });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [map?.id, changeCamera]);
  function pointAt(clientX: number, clientY: number): Point | null {
    const rect = viewport.current?.getBoundingClientRect();
    if (!rect || imageState !== "ready") return null;
    const c = cameraRef.current;
    return {
      x:
        ((clientX - rect.left - rect.width / 2 - c.x) /
          c.zoom /
          imageSize.width +
          0.5) *
        100,
      y:
        ((clientY - rect.top - rect.height / 2 - c.y) /
          c.zoom /
          imageSize.height +
          0.5) *
        100,
    };
  }
  const pins = useMemo(
    () =>
      (map?.pins || [])
        .filter((p) => !hiddenLayers.includes(p.layerId || ""))
        .map((p) => pinAtEvent(p, eventId, events))
        .filter((p) => {
          const card = cardById.get(p.cardId || "");
          const deck = decks.find((d) => d.id === deckId);
          return (
            (!category || card?.category === category) &&
            (!tag || card?.tags.includes(tag)) &&
            (!deckId ||
              card?.deckId === deckId ||
              !!deck?.cardIds.includes(p.cardId || "")) &&
            [
              card?.title || p.title,
              card?.summary || p.description,
              ...(card?.tags || []),
            ]
              .join(" ")
              .toLowerCase()
              .includes(query.trim().toLowerCase())
          );
        }),
    [
      map,
      cardById,
      hiddenLayers,
      eventId,
      events,
      decks,
      deckId,
      category,
      tag,
      query,
    ],
  );
  const pin = pins.find((p) => p.id === selectedPin);
  const linkedCard = cardById.get(pin?.cardId || "");
  const shape = map?.shapes?.find((s) => s.id === selectedShape);
  const visibleShapes = (map?.shapes || []).filter(
    (s) =>
      !hiddenLayers.includes(s.layerId || "") &&
      shapeAtEvent(s, eventId, events),
  );
  const askDelete = (name: string, action: () => void) =>
    setConfirm({
      isOpen: true,
      title: text("Hapus", "Delete"),
      description: text(
        `Hapus “${name}”? Kamu bisa membatalkannya dengan Undo.`,
        `Delete “${name}”? You can undo this change.`,
      ),
      variant: "danger",
      onConfirm: () => {
        action();
        setConfirm(null);
      },
    });
  const changeMode = (next: Mode) => {
    setMode(next);
    setDraftPoints([]);
    setSelectedShape("");
  };
  const finishShape = () => {
    if (!map || draftPoints.length < (mode === "region" ? 3 : 2)) return;
    const next: MapShape = {
      id: generateId("shape"),
      name:
        mode === "region"
          ? text("Wilayah baru", "New region")
          : text("Rute baru", "New route"),
      kind: mode === "region" ? "region" : "route",
      points: draftPoints,
      color: COLORS[0],
      layerId: activeLayer || undefined,
      fromEventId: eventId || undefined,
    };
    save({ shapes: [...(map.shapes || []), next] });
    setSelectedPin("");
    setPanel(true);
    changeMode("pan");
    setSelectedShape(next.id);
  };
  const layerSelect = (
    value: string | undefined,
    change: (id: string) => void,
  ) => (
    <select
      aria-label={text("Layer", "Layer")}
      value={value || ""}
      onChange={(e) => change(e.target.value)}
    >
      <option value="">{text("Dasar", "Base")}</option>
      {map?.layers?.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </select>
  );
  const eventSelect = (
    value: string | undefined,
    change: (id: string) => void,
    empty: string,
  ) => (
    <select
      aria-label={empty}
      value={value || ""}
      onChange={(e) => change(e.target.value)}
    >
      <option value="">{empty}</option>
      {events.map((e) => (
        <option key={e.id} value={e.id}>
          {e.dateLabel ? `${e.dateLabel} · ` : ""}
          {e.title}
        </option>
      ))}
    </select>
  );
  const closeForm = () => {
    setForm(null);
    fileVersion.current++;
    setImageBusy(false);
  };
  return (
    <section className="map-workspace" aria-label={t.map.title}>
      <header className="map-toolbar">
        <div className="map-toolbar-group">
          <MapIcon size={20} />
          <strong>{t.map.title}</strong>
          {map && (
            <select
              aria-label={text("Pilih peta", "Choose map")}
              value={map.id}
              onChange={(e) => setMapId(e.target.value)}
            >
              {worldMaps.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => {
              setError("");
              setForm({
                name: "",
                description: "",
                imageUrl: "",
                parentMapId: "",
              });
            }}
          >
            <Plus size={16} />
            {t.map.uploadMap}
          </button>
        </div>
        {map && (
          <div className="map-toolbar-group">
            <button
              className={mode === "new" ? "active" : ""}
              onClick={() => changeMode(mode === "new" ? "pan" : "new")}
            >
              <PinIcon size={16} />
              {text("Kartu baru", "New card")}
            </button>
            <button
              className={mode === "existing" ? "active" : ""}
              onClick={() =>
                changeMode(mode === "existing" ? "pan" : "existing")
              }
            >
              {text("Kartu yang ada", "Existing card")}
            </button>
            <button
              title={text("Gambar rute", "Draw route")}
              aria-label={text("Gambar rute", "Draw route")}
              className={mode === "route" ? "active" : ""}
              onClick={() => changeMode(mode === "route" ? "pan" : "route")}
            >
              <Route size={17} />
            </button>
            <button
              title={text("Gambar wilayah", "Draw region")}
              aria-label={text("Gambar wilayah", "Draw region")}
              className={mode === "region" ? "active" : ""}
              onClick={() => changeMode(mode === "region" ? "pan" : "region")}
            >
              <Pentagon size={17} />
            </button>
            <button disabled={!canUndo} onClick={onUndo} aria-label="Undo">
              <Undo2 size={17} />
            </button>
            <button disabled={!canRedo} onClick={onRedo} aria-label="Redo">
              <Redo2 size={17} />
            </button>
            <button aria-expanded={panel} onClick={() => setPanel(!panel)}>
              <Layers size={17} />
              {text("Pengaturan peta", "Map settings")}
            </button>
          </div>
        )}
      </header>
      {!map ? (
        <div className="map-empty">
          <MapIcon size={48} />
          <h2>{t.map.noMaps}</h2>
          <p>{t.map.noMapsDesc}</p>
          <button
            className="primary"
            onClick={() =>
              setForm({
                name: "",
                description: "",
                imageUrl: "",
                parentMapId: "",
              })
            }
          >
            {t.map.uploadMap}
          </button>
        </div>
      ) : (
        <>
          <div className="map-breadcrumb">
            <button
              disabled={!map.parentMapId}
              onClick={() => setMapId(map.parentMapId!)}
            >
              ↑ {text("Peta induk", "Parent map")}
            </button>
            <span>{map.name}</span>
            {worldMaps
              .filter((m) => m.parentMapId === map.id)
              .map((m) => (
                <button key={m.id} onClick={() => setMapId(m.id)}>
                  ↳ {m.name}
                </button>
              ))}
            <span className="map-spacer" />
            {eventSelect(
              eventId,
              setEventId,
              text(
                "Posisi dasar · semua periode",
                "Base positions · all periods",
              ),
            )}
          </div>
          <div className="map-body">
            <div
              onContextMenu={(e) => {
                e.preventDefault();
                const target = (e.target as HTMLElement).closest(
                  "[data-pin-id]",
                );
                const id = target?.getAttribute("data-pin-id") || undefined;
                if (id) setSelectedPin(id);
                setMenu({
                  x: Math.min(e.clientX, window.innerWidth - 240),
                  y: Math.min(e.clientY, window.innerHeight - 300),
                  pinId: id,
                  point: pointAt(e.clientX, e.clientY),
                });
              }}
              ref={viewport}
              className={`map-viewport mode-${mode}`}
              tabIndex={0}
              aria-label={text(
                "Area peta. Ctrl dan scroll untuk zoom.",
                "Map viewport. Ctrl and scroll to zoom.",
              )}
              onPointerDown={(e) => {
                if (
                  e.button !== 0 ||
                  (e.target as HTMLElement).closest(
                    "button,input,select,.map-overlay-controls",
                  )
                )
                  return;
                viewport.current?.setPointerCapture(e.pointerId);
                drag.current = {
                  pointerId: e.pointerId,
                  start: { x: e.clientX, y: e.clientY },
                  camera: cameraRef.current,
                  moved: false,
                };
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d || d.pointerId !== e.pointerId) return;
                const dx = e.clientX - d.start.x,
                  dy = e.clientY - d.start.y;
                if (Math.hypot(dx, dy) < 4 && !d.moved) return;
                d.moved = true;
                if (d.pin) {
                  const value = {
                    id: d.pin.id,
                    x: clampPercent(
                      d.pin.x + (dx / d.camera.zoom / imageSize.width) * 100,
                    ),
                    y: clampPercent(
                      d.pin.y + (dy / d.camera.zoom / imageSize.height) * 100,
                    ),
                  };
                  draftRef.current = value;
                  setDraftPin(value);
                } else if (mode === "pan")
                  changeCamera({
                    ...d.camera,
                    x: d.camera.x + dx,
                    y: d.camera.y + dy,
                  });
              }}
              onPointerUp={(e) => {
                const d = drag.current;
                drag.current = null;
                if (viewport.current?.hasPointerCapture(e.pointerId))
                  viewport.current.releasePointerCapture(e.pointerId);
                if (d?.pin) {
                  const value = draftRef.current;
                  if (d.moved && value)
                    commitPosition(value.id, { x: value.x, y: value.y });
                  draftRef.current = null;
                  setDraftPin(null);
                  return;
                }
                if (!d || d.moved) return;
                const point = pointAt(e.clientX, e.clientY);
                if (
                  !point ||
                  point.x < 0 ||
                  point.x > 100 ||
                  point.y < 0 ||
                  point.y > 100
                )
                  return;
                if (mode === "new") {
                  onCreatePinCard?.(map.id, point.x, point.y);
                  setMode("pan");
                } else if (mode === "existing") {
                  setGalleryPosition(point);
                  setMode("pan");
                } else if (mode === "route" || mode === "region")
                  setDraftPoints((p) => [...p, point]);
                else {
                  setSelectedPin("");
                  setSelectedShape("");
                }
              }}
              onPointerCancel={() => {
                drag.current = null;
                draftRef.current = null;
                setDraftPin(null);
              }}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                const delta: Record<string, Point> = {
                  ArrowLeft: { x: 40, y: 0 },
                  ArrowRight: { x: -40, y: 0 },
                  ArrowUp: { x: 0, y: 40 },
                  ArrowDown: { x: 0, y: -40 },
                };
                if (delta[e.key]) {
                  e.preventDefault();
                  const c = cameraRef.current;
                  changeCamera({
                    ...c,
                    x: c.x + delta[e.key].x,
                    y: c.y + delta[e.key].y,
                  });
                }
                if (e.key.toLowerCase() === "f") fit();
              }}
            >
              <div
                className="map-surface"
                style={{
                  width: imageSize.width,
                  height: imageSize.height,
                  transform: `translate(-50%, -50%) translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
                }}
              >
                <img
                  key={map.id + map.imageUrl}
                  src={map.imageUrl}
                  alt={map.name}
                  draggable={false}
                  onError={() => setImageState("error")}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    const size = {
                      width: img.naturalWidth,
                      height: img.naturalHeight,
                    };
                    setImageSize(size);
                    setImageState("ready");
                    const rect = viewport.current?.getBoundingClientRect();
                    changeCamera(
                      savedCamera(cameraKey) || {
                        x: 0,
                        y: 0,
                        zoom: fitMap(
                          size.width,
                          size.height,
                          rect?.width || 800,
                          rect?.height || 600,
                        ),
                      },
                    );
                  }}
                />
                <svg
                  className="map-shapes"
                  viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
                  aria-label={text("Wilayah dan rute", "Regions and routes")}
                >
                  {visibleShapes.map((s) => {
                    const points = s.points
                      .map(
                        (p) =>
                          `${(p.x / 100) * imageSize.width},${(p.y / 100) * imageSize.height}`,
                      )
                      .join(" ");
                    const props = {
                      points,
                      stroke: s.color,
                      strokeWidth: selectedShape === s.id ? 4 : 2,
                      vectorEffect: "non-scaling-stroke" as const,
                      onPointerDown: (e: React.PointerEvent) => {
                        if (mode === "pan") {
                          e.stopPropagation();
                          setSelectedShape(s.id);
                          setSelectedPin("");
                        }
                      },
                      style: {
                        pointerEvents:
                          mode === "pan"
                            ? ("auto" as const)
                            : ("none" as const),
                        cursor: "pointer",
                      },
                    };
                    return s.kind === "region" ? (
                      <polygon
                        key={s.id}
                        {...props}
                        fill={s.color}
                        fillOpacity={0.2}
                      >
                        <title>{s.name}</title>
                      </polygon>
                    ) : (
                      <polyline key={s.id} {...props} fill="none">
                        <title>{s.name}</title>
                      </polyline>
                    );
                  })}
                  {draftPoints.length > 0 && (
                    <polyline
                      points={draftPoints
                        .map(
                          (p) =>
                            `${(p.x / 100) * imageSize.width},${(p.y / 100) * imageSize.height}`,
                        )
                        .join(" ")}
                      stroke="#f59e0b"
                      strokeWidth={3}
                      vectorEffect="non-scaling-stroke"
                      fill={mode === "region" ? "#f59e0b33" : "none"}
                    />
                  )}
                </svg>
                {pins.map((p) => {
                  const pos = draftPin?.id === p.id ? draftPin : p;
                  const title = cardById.get(p.cardId || "")?.title || p.title;
                  return (
                    <button
                      key={p.id}
                      data-pin-id={p.id}
                      data-broken-reference={((p.cardId && !cardById.has(p.cardId)) || (p.targetMapId && !worldMaps.some(m => m.id === p.targetMapId)) || (p.layerId && !(map?.layers || []).some(l => l.id === p.layerId))) || undefined}
                      aria-label={title}
                      title={p.cardId && !cardById.has(p.cardId) ? `${title} — ${text("Referensi terputus", "Broken reference")}: ${p.cardId}` : title}
                      className={`atlas-pin ${selectedPin === p.id ? "selected" : ""} labels-${labels}`}
                      style={{
                        left: `${pos.x}%`,
                        top: `${pos.y}%`,
                        transform: `translate(-50%, -100%) scale(${1 / camera.zoom})`,
                        color: p.color || COLORS[0],
                      }}
                      onPointerDown={(e) => {
                        if (e.button !== 0 || mode !== "pan") return;
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        setSelectedPin(p.id);
                        setSelectedShape("");
                        drag.current = {
                          pointerId: e.pointerId,
                          start: { x: e.clientX, y: e.clientY },
                          camera: cameraRef.current,
                          pin: p,
                          moved: false,
                        };
                      }}
                      onClick={() => {
                        setSelectedPin(p.id);
                        setSelectedShape("");
                      }}
                      onDoubleClick={() => {
                        if (p.cardId) onOpenCard(p.cardId);
                      }}
                      onKeyDown={(e) => {
                        const step = e.shiftKey ? 1 : 0.1;
                        const delta: Record<string, Point> = {
                          ArrowLeft: { x: -step, y: 0 },
                          ArrowRight: { x: step, y: 0 },
                          ArrowUp: { x: 0, y: -step },
                          ArrowDown: { x: 0, y: step },
                        };
                        if (delta[e.key]) {
                          e.preventDefault();
                          e.stopPropagation();
                          commitPosition(p.id, {
                            x: clampPercent(p.x + delta[e.key].x),
                            y: clampPercent(p.y + delta[e.key].y),
                          });
                        }
                      }}
                    >
                      <span className="atlas-marker">
                        <span>{p.icon || "●"}</span>
                      </span>
                      <span className="atlas-label">{title}</span>
                    </button>
                  );
                })}
              </div>
              {imageState !== "ready" && (
                <div className="map-message" role="status">
                  {imageState === "error"
                    ? text(
                        "Gambar tidak dapat dibuka. Pilih Edit peta untuk menggantinya.",
                        "Image could not be opened. Edit the map to replace it.",
                      )
                    : text("Memuat gambar…", "Loading image…")}
                </div>
              )}
              {mode !== "pan" && (
                <div className="map-mode-hint map-overlay-controls">
                  <span>
                    {mode === "route" || mode === "region"
                      ? text(
                          "Klik titik-titik peta, lalu Selesai.",
                          "Click map points, then Finish.",
                        )
                      : text(
                          "Klik peta untuk menempatkan pin.",
                          "Click the map to place a pin.",
                        )}
                  </span>
                  {(mode === "route" || mode === "region") && (
                    <>
                      <button
                        disabled={!draftPoints.length}
                        onClick={() => setDraftPoints((p) => p.slice(0, -1))}
                      >
                        {text("Hapus titik", "Remove point")}
                      </button>
                      <button
                        disabled={
                          draftPoints.length < (mode === "region" ? 3 : 2)
                        }
                        onClick={finishShape}
                      >
                        {text("Selesai", "Finish")}
                      </button>
                    </>
                  )}
                  <button onClick={() => changeMode("pan")}>
                    {text("Batal", "Cancel")} · Esc
                  </button>
                </div>
              )}
              <div className="map-zoom map-overlay-controls">
                <button
                  aria-label={t.map.zoomOut}
                  onClick={() => {
                    const z = Math.max(0.01, camera.zoom / 1.25);
                    changeCamera({
                      zoom: z,
                      x: (camera.x * z) / camera.zoom,
                      y: (camera.y * z) / camera.zoom,
                    });
                  }}
                >
                  <ZoomOut size={18} />
                </button>
                <span>{Math.round(camera.zoom * 100)}%</span>
                <button
                  aria-label={t.map.zoomIn}
                  onClick={() => {
                    const z = Math.min(5, camera.zoom * 1.25);
                    changeCamera({
                      zoom: z,
                      x: (camera.x * z) / camera.zoom,
                      y: (camera.y * z) / camera.zoom,
                    });
                  }}
                >
                  <ZoomIn size={18} />
                </button>
                <button
                  aria-label={text("Muat seluruh peta", "Fit to screen")}
                  title={text("Muat seluruh peta (F)", "Fit to screen (F)")}
                  onClick={fit}
                >
                  <Maximize2 size={18} />
                </button>
              </div>
              <div className="map-navigation-hint">
                {text(
                  "Geser untuk navigasi · Ctrl + scroll untuk zoom · F untuk muat peta",
                  "Drag to pan · Ctrl + scroll to zoom · F to fit",
                )}
              </div>
            </div>
            {panel && (
              <div
                className="map-modal-backdrop"
                onClick={() => setPanel(false)}
              >
                <aside
                  role="dialog"
                  aria-modal="true"
                  className="map-settings"
                  aria-label={text("Pengaturan peta", "Map settings")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="map-panel-heading">
                    <strong>{text("Pengaturan peta", "Map settings")}</strong>
                    <button
                      aria-label={t.common.close}
                      onClick={() => setPanel(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="map-filter-grid">
                    <select
                      aria-label={text("Kategori", "Category")}
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="">
                        {text("Semua kategori", "All categories")}
                      </option>
                      {(
                        [
                          "character",
                          "faction",
                          "location",
                          "lore",
                          "timeline",
                          "item",
                          "realm",
                        ] as const
                      ).map((c) => (
                        <option key={c} value={c}>
                          {getCategoryLabel(c)}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Deck"
                      value={deckId}
                      onChange={(e) => setDeckId(e.target.value)}
                    >
                      <option value="">
                        {text("Semua deck", "All decks")}
                      </option>
                      {decks.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Tag"
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                    >
                      <option value="">{text("Semua tag", "All tags")}</option>
                      {[...new Set(cards.flatMap((c) => c.tags))]
                        .sort()
                        .map((tag) => (
                          <option key={tag}>{tag}</option>
                        ))}
                    </select>
                    <select
                      aria-label={text("Label pin", "Pin labels")}
                      value={labels}
                      onChange={(e) =>
                        setLabels(e.target.value as typeof labels)
                      }
                    >
                      <option value="selected">
                        {text("Label terpilih", "Selected labels")}
                      </option>
                      <option value="hover">
                        {text("Label saat hover", "Labels on hover")}
                      </option>
                      <option value="all">
                        {text("Semua label", "All labels")}
                      </option>
                    </select>
                  </div>
                  <details open>
                    <summary>
                      {pins.length} {text("pin ditemukan", "pins found")}
                    </summary>
                    <div className="map-results">
                      {!pins.length && (
                        <p>
                          {text(
                            "Tidak ada pin yang cocok. Ubah filter atau tambahkan pin.",
                            "No matching pins. Change filters or add a pin.",
                          )}
                        </p>
                      )}
                      {pins.map((p) => (
                        <button
                          className={selectedPin === p.id ? "active" : ""}
                          key={p.id}
                          onClick={() => {
                            setSelectedPin(p.id);
                            setSelectedShape("");
                            centerPin(p);
                          }}
                        >
                          <span style={{ color: p.color }}>
                            {p.icon || "●"}
                          </span>
                          <span>
                            {cardById.get(p.cardId || "")?.title || p.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  </details>
                  {pin && (
                    <section className="map-inspector">
                      <h3>{linkedCard?.title || pin.title}</h3>
                      {pin.cardId && !linkedCard && <p data-broken-reference>{text("Referensi terputus", "Broken reference")}: {pin.cardId}</p>}
                      <p>
                        {linkedCard?.summary ||
                          pin.description ||
                          text("Belum ada ringkasan.", "No summary yet.")}
                      </p>
                      <div className="map-actions">
                        {pin.cardId && linkedCard && (
                          <button
                            className="primary"
                            onClick={() => onOpenCard(pin.cardId!)}
                          >
                            {text("Buka kartu", "Open card")}
                          </button>
                        )}
                        {linkedCard && onEditCard && (
                          <button onClick={() => onEditCard(linkedCard)}>
                            {text("Edit kartu", "Edit card")}
                          </button>
                        )}
                        <button onClick={() => centerPin(pin)}>
                          {text("Fokus", "Focus")}
                        </button>
                      </div>
                      <label>
                        {text("Layer pin", "Pin layer")}
                        {layerSelect(pin.layerId, (layerId) =>
                          patchPin(pin.id, { layerId: layerId || undefined }),
                        )}
                      </label>
                      <div className="map-actions">
                        <label>
                          {text("Ikon", "Icon")}
                          <select
                            value={pin.icon || "●"}
                            onChange={(e) =>
                              patchPin(pin.id, { icon: e.target.value })
                            }
                          >
                            {ICONS.map((i) => (
                              <option key={i}>{i}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          {text("Warna", "Color")}
                          <input
                            type="color"
                            value={pin.color || COLORS[0]}
                            onChange={(e) =>
                              patchPin(pin.id, { color: e.target.value })
                            }
                          />
                        </label>
                      </div>
                      <div className="map-filter-grid">
                        {(["x", "y"] as const).map((axis) => (
                          <label
                            key={`${pin.id}:${eventId}:${axis}:${pin[axis]}`}
                          >
                            {axis.toUpperCase()} %
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              defaultValue={Number(pin[axis].toFixed(2))}
                              onBlur={(e) => {
                                if (
                                  e.target.value !== "" &&
                                  Number.isFinite(e.target.valueAsNumber)
                                )
                                  commitPosition(pin.id, {
                                    x: pin.x,
                                    y: pin.y,
                                    [axis]: clampPercent(
                                      e.target.valueAsNumber,
                                    ),
                                  });
                              }}
                            />
                          </label>
                        ))}
                      </div>
                      <small>
                        {eventId
                          ? text(
                              "Posisi berlaku mulai event ini pada track yang sama.",
                              "Position applies from this event on the same track.",
                            )
                          : text(
                              "Pilih event untuk merekam perpindahan.",
                              "Choose an event to record movement.",
                            )}
                      </small>
                      {eventId &&
                        pin.positions?.some((p) => p.eventId === eventId) && (
                          <button
                            onClick={() =>
                              patchPin(pin.id, {
                                positions: pin.positions?.filter(
                                  (p) => p.eventId !== eventId,
                                ),
                              })
                            }
                          >
                            {text(
                              "Hapus posisi event ini",
                              "Remove this event position",
                            )}
                          </button>
                        )}
                      <label>
                        {text("Tautan ke peta", "Link to map")}
                        <select
                          value={pin.targetMapId || ""}
                          onChange={(e) =>
                            patchPin(pin.id, {
                              targetMapId: e.target.value || undefined,
                            })
                          }
                        >
                          <option value="">—</option>
                          {worldMaps
                            .filter((m) => m.id !== map.id)
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      {pin.targetMapId && (
                        <button onClick={() => setMapId(pin.targetMapId!)}>
                          {text("Masuk ke peta", "Enter map")} →
                        </button>
                      )}
                      <button
                        className="danger"
                        onClick={() =>
                          askDelete(pin.title, () =>
                            save({
                              pins: map.pins.filter((p) => p.id !== pin.id),
                            }),
                          )
                        }
                      >
                        {t.map.deletePin}
                      </button>
                    </section>
                  )}
                  <details>
                    <summary>
                      {text("Layer & legenda", "Layers & legend")}
                    </summary>
                    {[
                      { id: "", name: text("Dasar", "Base"), color: COLORS[0] },
                      ...(map.layers || []),
                    ].map((l) => (
                      <div className="map-layer" key={l.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={!hiddenLayers.includes(l.id)}
                            onChange={() =>
                              setHiddenLayers((v) =>
                                v.includes(l.id)
                                  ? v.filter((id) => id !== l.id)
                                  : [...v, l.id],
                              )
                            }
                          />
                          <span style={{ color: l.color }}>●</span>
                          {l.name}
                        </label>
                        {l.id && (
                          <button
                            aria-label={`${text("Hapus layer", "Delete layer")} ${l.name}`}
                            onClick={() =>
                              askDelete(l.name, () => {
                                save({
                                  layers: map.layers?.filter(
                                    (x) => x.id !== l.id,
                                  ),
                                  pins: map.pins.map((p) =>
                                    p.layerId === l.id
                                      ? { ...p, layerId: undefined }
                                      : p,
                                  ),
                                  shapes: map.shapes?.map((s) =>
                                    s.layerId === l.id
                                      ? { ...s, layerId: undefined }
                                      : s,
                                  ),
                                });
                                setActiveLayer("");
                              })
                            }
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                    <form
                      className="map-actions"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!layerName.trim()) return;
                        const id = generateId("layer");
                        save({
                          layers: [
                            ...(map.layers || []),
                            {
                              id,
                              name: layerName.trim(),
                              color:
                                COLORS[
                                  (map.layers?.length || 0) % COLORS.length
                                ],
                            },
                          ],
                        });
                        setLayerName("");
                        setActiveLayer(id);
                      }}
                    >
                      <input
                        aria-label={text("Nama layer baru", "New layer name")}
                        placeholder={text("Nama layer baru", "New layer name")}
                        value={layerName}
                        onChange={(e) => setLayerName(e.target.value)}
                      />
                      <button
                        type="submit"
                        aria-label={text("Tambah layer", "Add layer")}
                      >
                        <Plus size={16} />
                      </button>
                    </form>
                    <label>
                      {text("Layer untuk objek baru", "Layer for new objects")}
                      {layerSelect(activeLayer, setActiveLayer)}
                    </label>
                  </details>
                  <details open={!!shape}>
                    <summary>
                      {text("Wilayah & rute", "Regions & routes")} (
                      {map.shapes?.length || 0})
                    </summary>
                    <div className="map-results">
                      {(map.shapes || []).map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            setSelectedShape(s.id);
                            setSelectedPin("");
                          }}
                        >
                          {s.kind === "region" ? "◇" : "↝"} {s.name}
                        </button>
                      ))}
                    </div>
                    {shape && (
                      <div className="map-inspector">
                        <label>
                          {text("Nama", "Name")}
                          <input
                            key={shape.id + shape.name}
                            defaultValue={shape.name}
                            onBlur={(e) => {
                              if (
                                e.target.value.trim() &&
                                e.target.value !== shape.name
                              )
                                patchShape(shape.id, {
                                  name: e.target.value.trim(),
                                });
                            }}
                          />
                        </label>
                        <label>
                          {text("Warna", "Color")}
                          <input
                            type="color"
                            value={shape.color}
                            onChange={(e) =>
                              patchShape(shape.id, { color: e.target.value })
                            }
                          />
                        </label>
                        {layerSelect(shape.layerId, (layerId) =>
                          patchShape(shape.id, {
                            layerId: layerId || undefined,
                          }),
                        )}
                        <label>
                          {text("Faksi penguasa", "Controlling faction")}
                          <select
                            value={shape.factionId || ""}
                            onChange={(e) =>
                              patchShape(shape.id, {
                                factionId: e.target.value || undefined,
                              })
                            }
                          >
                            <option value="">—</option>
                            {cards
                              .filter((c) => c.category === "faction")
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.title}
                                </option>
                              ))}
                          </select>
                        </label>
                        {shape.factionId && !cardById.has(shape.factionId) && <p data-broken-reference>{text("Referensi terputus", "Broken reference")}: {shape.factionId}</p>}
                        {shape.factionId && cardById.has(shape.factionId) && (
                          <button onClick={() => onOpenCard(shape.factionId!)}>
                            {text("Buka faksi", "Open faction")}
                          </button>
                        )}
                        {eventSelect(
                          shape.fromEventId,
                          (fromEventId) =>
                            patchShape(shape.id, {
                              fromEventId: fromEventId || undefined,
                            }),
                          text(
                            "Mulai event (inklusif)",
                            "From event (inclusive)",
                          ),
                        )}
                        {eventSelect(
                          shape.untilEventId,
                          (untilEventId) =>
                            patchShape(shape.id, {
                              untilEventId: untilEventId || undefined,
                            }),
                          text(
                            "Sampai event (eksklusif)",
                            "Until event (exclusive)",
                          ),
                        )}
                        <button
                          className="danger"
                          onClick={() =>
                            askDelete(shape.name, () =>
                              save({
                                shapes: map.shapes?.filter(
                                  (s) => s.id !== shape.id,
                                ),
                              }),
                            )
                          }
                        >
                          {text("Hapus objek", "Delete object")}
                        </button>
                      </div>
                    )}
                  </details>
                  <div className="map-actions">
                    <button
                      onClick={() => {
                        setError("");
                        setForm({
                          id: map.id,
                          name: map.name,
                          description: map.description || "",
                          imageUrl: map.imageUrl,
                          parentMapId: map.parentMapId || "",
                        });
                      }}
                    >
                      {t.map.editMap}
                    </button>
                    <button
                      className="danger"
                      onClick={() =>
                        askDelete(map.name, () => onDeleteMap(map.id))
                      }
                    >
                      {t.map.deleteMap}
                    </button>
                  </div>
                  {map.description && (
                    <p className="map-description">{map.description}</p>
                  )}
                </aside>
              </div>
            )}
          </div>
        </>
      )}
      {menu && (
        <>
          <div
            className="map-menu-dismiss"
            onPointerDown={() => setMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu(null);
            }}
          />
          <div
            role="menu"
            className="map-context-menu"
            style={{ left: menu.x, top: menu.y }}
          >
            {menu.pinId && (
              <>
                <div className="map-actions">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      aria-label={color}
                      title={color}
                      style={{ background: color, width: 30 }}
                      onClick={() => {
                        patchPin(menu.pinId!, { color });
                        setMenu(null);
                      }}
                    />
                  ))}
                </div>
                <button
                  role="menuitem"
                  onClick={() => {
                    const p = map.pins.find((p) => p.id === menu.pinId);
                    if (p?.cardId) onOpenCard(p.cardId);
                    setMenu(null);
                  }}
                >
                  {text("Buka kartu", "Open card")}
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    const p = map.pins.find((p) => p.id === menu.pinId);
                    const c = cards.find((c) => c.id === p?.cardId);
                    if (c) onEditCard?.(c);
                    setMenu(null);
                  }}
                >
                  {text("Edit kartu", "Edit card")}
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    const p = pins.find((p) => p.id === menu.pinId);
                    if (p) centerPin(p);
                    setMenu(null);
                  }}
                >
                  {text("Fokus ke pin", "Focus pin")}
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setSelectedPin(menu.pinId!);
                    setPanel(true);
                    setMenu(null);
                  }}
                >
                  {text("Pengaturan pin", "Pin settings")}
                </button>
                <button
                  role="menuitem"
                  className="danger"
                  onClick={() => {
                    const p = map.pins.find((p) => p.id === menu.pinId);
                    if (p)
                      askDelete(p.title, () =>
                        save({
                          pins: map.pins.filter((pin) => pin.id !== p.id),
                        }),
                      );
                    setMenu(null);
                  }}
                >
                  {t.map.deletePin}
                </button>
              </>
            )}
            {!menu.pinId && (
              <>
                <button
                  role="menuitem"
                  onClick={() => {
                    if (
                      menu.point &&
                      menu.point.x >= 0 &&
                      menu.point.x <= 100 &&
                      menu.point.y >= 0 &&
                      menu.point.y <= 100
                    )
                      onCreatePinCard?.(map.id, menu.point.x, menu.point.y);
                    else changeMode("new");
                    setMenu(null);
                  }}
                >
                  {text("Tambah kartu baru", "Add new card")}
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    if (
                      menu.point &&
                      menu.point.x >= 0 &&
                      menu.point.x <= 100 &&
                      menu.point.y >= 0 &&
                      menu.point.y <= 100
                    )
                      setGalleryPosition(menu.point);
                    else changeMode("existing");
                    setMenu(null);
                  }}
                >
                  {text("Pilih kartu yang ada", "Choose existing card")}
                </button>
              </>
            )}
            <button
              role="menuitem"
              onClick={() => {
                fit();
                setMenu(null);
              }}
            >
              {text("Muat seluruh peta", "Fit to screen")}
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setPanel(true);
                setMenu(null);
              }}
            >
              {text("Pengaturan peta", "Map settings")}
            </button>
          </div>
        </>
      )}
      {galleryPosition && (
        <AddCardFromGalleryModal
          isOpen
          onClose={() => setGalleryPosition(null)}
          allCards={cards}
          allDecks={decks}
          targetPosition={galleryPosition}
          title={t.map.addCardToMapModal}
          description={t.map.addCardToMapDesc}
          submitLabel={text("Tambahkan ($COUNT) pin", "Add ($COUNT) pins")}
          onAddCardsToCanvas={(ids, pos) => {
            save({
              pins: [
                ...map.pins,
                ...ids.flatMap((id, index) => {
                  const card = cardById.get(id);
                  return card
                    ? [
                        {
                          id: generateId("pin"),
                          cardId: id,
                          title: card.title,
                          description: card.summary,
                          x: clampPercent(pos.x + (index % 5) * 2),
                          y: clampPercent(pos.y + Math.floor(index / 5) * 2),
                          color:
                            map.layers?.find((l) => l.id === activeLayer)
                              ?.color || COLORS[0],
                          layerId: activeLayer || undefined,
                        },
                      ]
                    : [];
                }),
              ],
            });
            setGalleryPosition(null);
          }}
        />
      )}
      {form && (
        <div className="map-modal-backdrop">
          <form
            role="dialog"
            aria-modal="true"
            aria-label={form.id ? t.map.editMapTitle : t.map.createMapTitle}
            className="map-modal"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name.trim() || !form.imageUrl || imageBusy) return;
              const previous = worldMaps.find((m) => m.id === form.id);
              const id = previous?.id || generateId("map");
              if (!canParentMap(worldMaps, id, form.parentMapId)) {
                setError(
                  text(
                    "Hierarki peta tidak boleh melingkar.",
                    "Map hierarchy cannot contain a cycle.",
                  ),
                );
                return;
              }
              onSaveMap({
                ...previous,
                id,
                name: form.name.trim(),
                description: form.description.trim(),
                imageUrl: form.imageUrl,
                parentMapId: form.parentMapId || undefined,
                pins: previous?.pins || [],
                createdAt: previous?.createdAt || Date.now(),
                updatedAt: Date.now(),
              });
              setMapId(id);
              closeForm();
            }}
          >
            <div className="map-panel-heading">
              <h2>{form.id ? t.map.editMapTitle : t.map.createMapTitle}</h2>
              <button
                type="button"
                aria-label={t.common.close}
                onClick={closeForm}
              >
                <X size={18} />
              </button>
            </div>
            <label>
              {t.map.mapName}
              <input
                autoFocus
                required
                maxLength={160}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              {t.map.mapDescription}
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            <label>
              {text("Peta induk", "Parent map")}
              <select
                value={form.parentMapId}
                onChange={(e) =>
                  setForm({ ...form, parentMapId: e.target.value })
                }
              >
                <option value="">{text("Tanpa induk", "No parent")}</option>
                {worldMaps
                  .filter(
                    (m) => !form.id || canParentMap(worldMaps, form.id, m.id),
                  )
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              {t.map.selectImageFile}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const version = ++fileVersion.current;
                  setError("");
                  if (
                    ![
                      "image/png",
                      "image/jpeg",
                      "image/webp",
                      "image/gif",
                    ].includes(file.type) ||
                    file.size > 30 * 1024 * 1024
                  ) {
                    setError(
                      text(
                        "Gunakan PNG, JPEG, WebP, atau GIF maksimal 30 MB.",
                        "Use PNG, JPEG, WebP, or GIF up to 30 MB.",
                      ),
                    );
                    return;
                  }
                  setImageBusy(true);
                  try {
                    const url = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve(String(reader.result));
                      reader.onerror = reject;
                      reader.readAsDataURL(file);
                    });
                    await new Promise<void>((resolve, reject) => {
                      const img = new Image();
                      img.onload = () =>
                        img.naturalWidth * img.naturalHeight > 100_000_000
                          ? reject(new Error("size"))
                          : resolve();
                      img.onerror = reject;
                      img.src = url;
                    });
                    if (version === fileVersion.current)
                      setForm((prev) =>
                        prev ? { ...prev, imageUrl: url } : null,
                      );
                  } catch {
                    if (version === fileVersion.current)
                      setError(
                        text(
                          "Gambar rusak atau melebihi 100 megapiksel.",
                          "Image is damaged or exceeds 100 megapixels.",
                        ),
                      );
                  } finally {
                    if (version === fileVersion.current) setImageBusy(false);
                  }
                }}
              />
            </label>
            {form.imageUrl && (
              <img
                className="map-preview"
                src={form.imageUrl}
                alt={text("Pratinjau peta", "Map preview")}
              />
            )}
            {form.id && (
              <small>
                {text(
                  "Mengganti gambar mempertahankan koordinat persentase pin. Periksa kembali posisinya.",
                  "Replacing the image preserves pin percentage coordinates. Check their positions afterwards.",
                )}
              </small>
            )}
            {error && (
              <p role="alert" className="danger">
                {error}
              </p>
            )}
            <div className="map-actions">
              <button type="button" onClick={closeForm}>
                {t.common.cancel}
              </button>
              <button
                className="primary"
                type="submit"
                disabled={!form.imageUrl || !form.name.trim() || imageBusy}
              >
                {imageBusy ? text("Memuat…", "Loading…") : t.map.saveMap}
              </button>
            </div>
          </form>
        </div>
      )}
      <ConfirmModal config={confirm} onClose={() => setConfirm(null)} />
    </section>
  );
}
