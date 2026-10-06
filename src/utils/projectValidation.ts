import schemaData from "../data/projectSchema.json" with { type: "json" };
import { sanitizeDocumentHtml } from "./documentHtml";
import type { WorldProject } from "../types";
export interface ProjectIssue {
  code: string;
  path: string;
  severity: "warning" | "error";
  projectId?: string;
  fileName?: string;
}
export interface ProjectSource {
  projectId: string;
  fileName: string;
  source: "primary" | "backup";
}
export interface WorkspaceLoadReport {
  projects: WorldProject[];
  issues: ProjectIssue[];
  sources: ProjectSource[];
}
export interface ProjectValidation {
  project?: WorldProject;
  issues: ProjectIssue[];
}
const schema = schemaData as {
  objects: Record<string, Record<string, string>>;
  enums: Record<string, string[]>;
};
export function validateProject(value: unknown): ProjectValidation {
  const issues: ProjectIssue[] = [];
  const entityIds = new Map<string, Set<string>>();
  const issue = (path: string, code = "invalid_field") =>
    issues.push({ code, path, severity: "error" });
  const walk = (value: unknown, descriptor: string, path: string): void => {
    if (descriptor.endsWith("?")) {
      if (value === undefined || value === null) return;
      descriptor = descriptor.slice(0, -1);
    }
    if (descriptor.endsWith("[]")) {
      if (!Array.isArray(value)) {
        issue(path);
        return;
      }
      const entityType = descriptor.slice(0, -2);
      const ids = entityIds.get(entityType) || new Set<string>();
      entityIds.set(entityType, ids);
      value.forEach((item: unknown, index) => {
        walk(item, descriptor.slice(0, -2), `${path}[${index}]`);
        if (
          item &&
          typeof item === "object" &&
          "id" in item &&
          typeof item.id === "string"
        ) {
          if (ids.has(item.id)) issue(`${path}[${index}].id`, "duplicate_id");
          ids.add(item.id);
        }
      });
      return;
    }
    if (descriptor.endsWith("{}")) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        issue(path);
        return;
      }
      Object.entries(value).forEach(([key, item]) =>
        walk(item, descriptor.slice(0, -2), `${path}.${key}`),
      );
      return;
    }
    const fields = schema.objects[descriptor];
    if (fields) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        issue(path);
        return;
      }
      const record = value as Record<string, unknown>;
      Object.entries(fields).forEach(([key, field]) =>
        walk(record[key], field, `${path}.${key}`),
      );
      return;
    }
    const enumeration = schema.enums[descriptor];
    if (enumeration) {
      if (typeof value !== "string" || !enumeration.includes(value))
        issue(path);
      return;
    }
    if (descriptor === "schema") {
      if (value !== 1) issue(path, "unsupported_schema");
      return;
    }
    if (descriptor === "id") {
      if (typeof value !== "string" || !/^[a-zA-Z0-9_-]+$/.test(value))
        issue(path);
      return;
    }
    if (["number", "positive", "percent"].includes(descriptor)) {
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        (descriptor === "positive" && value <= 0) ||
        (descriptor === "percent" && (value < 0 || value > 100))
      )
        issue(path);
      return;
    }
    if (typeof value !== descriptor) issue(path);
  };
  walk(value, "WorldProject", "$");
  if (issues.length) return { issues };
  const normalize = (value: unknown, descriptor: string): void => {
    descriptor = descriptor.replace(/\?$/, "");
    if (descriptor.endsWith("[]")) {
      if (Array.isArray(value))
        value.forEach((item) => normalize(item, descriptor.slice(0, -2)));
      return;
    }
    if (descriptor.endsWith("{}")) {
      if (value && typeof value === "object")
        Object.values(value).forEach((item) =>
          normalize(item, descriptor.slice(0, -2)),
        );
      return;
    }
    const fields = schema.objects[descriptor];
    if (fields && value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      for (const [key, field] of Object.entries(fields)) {
        if (field.endsWith("?") && record[key] === null) delete record[key];
        if (field.endsWith("[]?") && record[key] === undefined)
          record[key] = [];
        normalize(record[key], field);
      }
    }
  };
  const project = structuredClone(value) as WorldProject;
  normalize(project, "WorldProject");
  project.schemaVersion = 1;
  project.description ??= "";
  project.version ??= "1.0.0";
  const collections = [
    "connections",
    "canvases",
    "decks",
    "documents",
    "timelineTracks",
    "timelineNodes",
    "timelineBranches",
    "worldMaps",
  ] as const;
  for (const key of collections) project[key] ??= [];
  for (const map of project.worldMaps || []) {
    map.layers ??= [];
    map.shapes ??= [];
    for (const pin of map.pins) pin.positions ??= [];
  }
  if (typeof document !== "undefined")
    for (const doc of project.documents || [])
      doc.content = sanitizeDocumentHtml(doc.content);
  return { project, issues: projectIntegrity(project) };
}
export function projectIntegrity(project: WorldProject): ProjectIssue[] {
  const issues: ProjectIssue[] = [];
  const ids = <T extends { id: string }>(items?: T[]) =>
    new Set((items || []).map((item) => item.id));
  const cards = ids(project.cards),
    decks = ids(project.decks),
    canvases = ids(project.canvases),
    tracks = ids(project.timelineTracks),
    events = ids(project.timelineNodes),
    maps = ids(project.worldMaps);
  canvases.add("default");
  const ref = (id: string | undefined, valid: Set<string>, path: string) => {
    if (id && !valid.has(id))
      issues.push({
        code: "broken_reference",
        path,
        severity: "warning",
        projectId: project.id,
      });
  };
  project.cards.forEach((card, i) => {
    ref(card.deckId, decks, `cards[${i}].deckId`);
    for (const id of card.canvasIds || (card.canvasId ? [card.canvasId] : []))
      ref(id, canvases, `cards[${i}].canvasIds`);
  });
  project.connections.forEach((c, i) => {
    ref(c.sourceId, cards, `connections[${i}].sourceId`);
    ref(c.targetId, cards, `connections[${i}].targetId`);
  });
  (project.decks || []).forEach((d, i) =>
    d.cardIds.forEach((id, j) => ref(id, cards, `decks[${i}].cardIds[${j}]`)),
  );
  (project.documents || []).forEach((d, i) => {
    (d.associatedCardIds || []).forEach((id, j) =>
      ref(id, cards, `documents[${i}].associatedCardIds[${j}]`),
    );
    for (const match of d.content.matchAll(/data-card-id=["']([^"']+)["']/g))
      ref(match[1], cards, `documents[${i}].content:${match[1]}`);
  });
  (project.timelineNodes || []).forEach((e, i) => {
    ref(e.cardId, cards, `timelineNodes[${i}].cardId`);
    ref(e.trackId, tracks, `timelineNodes[${i}].trackId`);
  });
  (project.timelineBranches || []).forEach((b, i) => {
    ref(b.sourceTrackId, tracks, `timelineBranches[${i}].sourceTrackId`);
    ref(b.targetTrackId, tracks, `timelineBranches[${i}].targetTrackId`);
    ref(b.sourceNodeId, events, `timelineBranches[${i}].sourceNodeId`);
    ref(b.targetNodeId, events, `timelineBranches[${i}].targetNodeId`);
  });
  (project.worldMaps || []).forEach((map, i) => {
    const layers = ids(map.layers);
    ref(map.parentMapId, maps, `worldMaps[${i}].parentMapId`);
    const visited = new Set([map.id]);
    let parent = map.parentMapId;
    while (parent && maps.has(parent)) {
      if (visited.has(parent)) {
        issues.push({
          code: "map_cycle",
          path: `worldMaps[${i}].parentMapId`,
          severity: "warning",
          projectId: project.id,
        });
        break;
      }
      visited.add(parent);
      parent = project.worldMaps?.find((m) => m.id === parent)?.parentMapId;
    }
    map.pins.forEach((p, j) => {
      const path = `worldMaps[${i}].pins[${j}]`;
      ref(p.cardId, cards, `${path}.cardId`);
      ref(p.targetMapId, maps, `${path}.targetMapId`);
      ref(p.layerId, layers, `${path}.layerId`);
      (p.positions || []).forEach((position, k) =>
        ref(position.eventId, events, `${path}.positions[${k}].eventId`),
      );
    });
    (map.shapes || []).forEach((s, j) => {
      const path = `worldMaps[${i}].shapes[${j}]`;
      ref(s.layerId, layers, `${path}.layerId`);
      ref(s.factionId, cards, `${path}.factionId`);
      ref(s.fromEventId, events, `${path}.fromEventId`);
      ref(s.untilEventId, events, `${path}.untilEventId`);
    });
  });
  return issues;
}
export function removeProjectCards(
  project: WorldProject,
  deletedIds: string[],
): WorldProject {
  const deleted = new Set(deletedIds);
  const detach = (id?: string) => (id && deleted.has(id) ? undefined : id);
  return {
    ...project,
    updatedAt: Date.now(),
    cards: project.cards.filter((c) => !deleted.has(c.id)),
    connections: project.connections.filter(
      (c) => !deleted.has(c.sourceId) && !deleted.has(c.targetId),
    ),
    decks: (project.decks || []).map((d) => ({
      ...d,
      cardIds: d.cardIds.filter((id) => !deleted.has(id)),
    })),
    timelineNodes: (project.timelineNodes || []).map((e) => ({
      ...e,
      cardId: detach(e.cardId),
    })),
    worldMaps: (project.worldMaps || []).map((m) => ({
      ...m,
      pins: m.pins.map((p) => ({ ...p, cardId: detach(p.cardId) })),
      shapes: (m.shapes || []).map((s) => ({
        ...s,
        factionId: detach(s.factionId),
      })),
    })),
    // Document mentions keep their text and identifier so undo can restore navigation.
    documents: (project.documents || []).map((d) => ({
      ...d,
      associatedCardIds: d.associatedCardIds?.filter((id) => !deleted.has(id)),
    })),
  };
}
