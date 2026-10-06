import type { MapPin, MapShape, TimelineNode, WorldMap } from "../types";

export const clampPercent = (n: number) => Math.min(100, Math.max(0, n));
export function fitMap(
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  return Math.max(
    0.01,
    Math.min(5, (viewportWidth - 64) / width, (viewportHeight - 64) / height),
  );
}
export function pinAtEvent(
  pin: MapPin,
  eventId: string,
  events: TimelineNode[],
): MapPin {
  const event = events.find((e) => e.id === eventId);
  if (!event) return pin;
  const positions = (pin.positions || [])
    .map((p) => ({ ...p, event: events.find((e) => e.id === p.eventId) }))
    .filter(
      (p) =>
        p.event && p.event.trackId === event.trackId && p.event.x <= event.x,
    )
    .sort((a, b) => b.event!.x - a.event!.x);
  return positions.length
    ? { ...pin, x: positions[0].x, y: positions[0].y }
    : pin;
}
export function shapeAtEvent(
  shape: MapShape,
  eventId: string,
  events: TimelineNode[],
) {
  const event = events.find((e) => e.id === eventId);
  if (!event) return true;
  const from = events.find((e) => e.id === shape.fromEventId);
  const until = events.find((e) => e.id === shape.untilEventId);
  return (
    (!from || (from.trackId === event.trackId && from.x <= event.x)) &&
    (!until || (until.trackId === event.trackId && event.x < until.x))
  );
}
export function canParentMap(
  maps: WorldMap[],
  mapId: string,
  parentId: string,
) {
  const visited = new Set([mapId]);
  let id: string | undefined = parentId;
  while (id) {
    if (visited.has(id)) return false;
    visited.add(id);
    id = maps.find((m) => m.id === id)?.parentMapId;
  }
  return true;
}
