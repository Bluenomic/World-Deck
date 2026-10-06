import type { WorldProject } from "../types";
import { appendHistory, reuseProject } from "./projectHistory";
import type { SaveAcknowledgement } from "./workspacePersistence";
export interface ProjectHistory {
  stack: WorldProject[];
  index: number;
  transactionId?: string;
}
export interface ProjectState {
  worlds: WorldProject[];
  activeWorldId: string;
  histories: Record<string, ProjectHistory>;
  revisions: Record<string, number>;
  acknowledged: Record<string, number>;
}
export type ProjectAction =
  | { type: "load"; worlds: WorldProject[] }
  | { type: "select"; id: string }
  | { type: "replace"; worlds: WorldProject[]; transactionId?: string }
  | { type: "restore"; offset: -1 | 1; updatedAt: number }
  | { type: "ack"; acknowledgement: SaveAcknowledgement };
export const initialProjectState: ProjectState = {
  worlds: [],
  activeWorldId: "",
  histories: {},
  revisions: {},
  acknowledged: {},
};
export function projectReducer(
  state: ProjectState,
  action: ProjectAction,
): ProjectState {
  if (action.type === "load")
    return {
      ...initialProjectState,
      worlds: action.worlds,
      activeWorldId: action.worlds.some((p) => p.id === state.activeWorldId)
        ? state.activeWorldId
        : action.worlds[0]?.id || "",
      histories: Object.fromEntries(
        action.worlds.map((p) => [p.id, { stack: [p], index: 0 }]),
      ),
    };
  if (action.type === "select")
    return action.id === state.activeWorldId ||
      (action.id && !state.worlds.some((p) => p.id === action.id))
      ? state
      : { ...state, activeWorldId: action.id };
  if (action.type === "ack") {
    const { projectId, revision } = action.acknowledgement;
    if ((state.acknowledged[projectId] || 0) >= revision) return state;
    return {
      ...state,
      acknowledged: { ...state.acknowledged, [projectId]: revision },
    };
  }
  if (action.type === "restore") {
    const id = state.activeWorldId,
      history = state.histories[id];
    if (!history) return state;
    const index = history.index + action.offset;
    if (index < 0 || index >= history.stack.length) return state;
    const snapshot = { ...history.stack[index], updatedAt: action.updatedAt };
    return {
      ...state,
      worlds: state.worlds.map((p) => (p.id === id ? snapshot : p)),
      histories: {
        ...state.histories,
        [id]: { ...history, index, transactionId: undefined },
      },
      revisions: { ...state.revisions, [id]: (state.revisions[id] || 0) + 1 },
    };
  }
  const byId = new Map(state.worlds.map((p) => [p.id, p]));
  const histories = { ...state.histories },
    revisions = { ...state.revisions };
  let changed = state.worlds.length !== action.worlds.length;
  const worlds = action.worlds.map((candidate, index) => {
    const previous = byId.get(candidate.id);
    const project = previous
      ? reuseProject(previous, candidate)
      : { ...candidate, schemaVersion: 1 as const };
    if (project !== state.worlds[index]) changed = true;
    if (previous === project) return project;
    const history = histories[project.id];
    if (!history)
      histories[project.id] = {
        stack: previous ? [previous, project] : [project],
        index: previous ? 1 : 0,
        transactionId: action.transactionId,
      };
    else if (
      action.transactionId &&
      history.transactionId === action.transactionId &&
      history.index === history.stack.length - 1 &&
      history.stack.length > 1
    )
      histories[project.id] = {
        ...history,
        stack: [...history.stack.slice(0, -1), project],
      };
    else
      histories[project.id] = {
        ...appendHistory(history.stack, history.index, project),
        transactionId: action.transactionId,
      };
    revisions[project.id] = (revisions[project.id] || 0) + 1;
    return project;
  });
  if (!changed) return state;
  for (const id of Object.keys(histories))
    if (!worlds.some((p) => p.id === id)) delete histories[id];
  return { ...state, worlds, histories, revisions };
}
