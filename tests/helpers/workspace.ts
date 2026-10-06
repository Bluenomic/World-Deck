import { expect, type Page } from "@playwright/test";
import type { WorldProject, ViewMode } from "../../src/types";
export function fixtureProject(): WorldProject {
  return {
    schemaVersion: 1,
    id: "world",
    name: "Test world",
    description: "",
    version: "1",
    cards: [
      {
        id: "card",
        title: "Harbor",
        category: "location",
        summary: "Port",
        content: "",
        tags: [],
        attributes: [],
        x: 0,
        y: 0,
        canvasIds: ["default"],
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    connections: [],
    canvases: [{ id: "default", name: "Main", createdAt: 1 }],
    timelineTracks: [{ id: "track", name: "Main", order: 0 }],
    timelineNodes: [],
    documents: [
      {
        id: "first",
        title: "First document",
        category: "story",
        content: "<p>Original text</p>",
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "second",
        title: "Second document",
        category: "story",
        content: "<p>Second text</p>",
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    createdAt: 1,
    updatedAt: 1,
  };
}
export async function bootWorkspace(
  page: Page,
  project = fixtureProject(),
  viewMode: ViewMode = "documents",
  extraProjects: WorldProject[] = [],
) {
  await page.addInitScript(
    ({ project, viewMode, extraProjects }) => {
      localStorage.setItem(
        "worlddeck_selected_workspace_path",
        "fixture-workspace",
      );
      localStorage.setItem("worlddeck_language_v1", "en");
      localStorage.setItem(
        "worlddeck_workspace_prefs_v1",
        JSON.stringify({ viewMode }),
      );
      const state = window as any;
      state.__saves = [];
      state.__commands = [];
      state.__failSave = false;
      state.__failDelete = false;
      state.__saveDelay = 0;
      state.__selectedFolder = null;
      const files: Record<string, typeof project> =
        JSON.parse(sessionStorage.getItem("fixture-files") || "null") ||
        Object.fromEntries([project, ...extraProjects].map((p) => [p.id, p]));
      state.__files = files;
      state.__folders = { "fixture-workspace": files };
      state.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
      const callbacks = new Map<number, Function>();
      let nextCallback = 1;
      const listeners = new Map<number, { event: string; handler: number }>();
      let nextListener = 1;
      state.__emitTauri = async (event: string) => {
        for (const [id, listener] of listeners)
          if (listener.event === event)
            await callbacks.get(listener.handler)?.({
              event,
              id,
              payload: null,
            });
      };
      state.__TAURI_INTERNALS__ = {
        metadata: {
          currentWindow: { label: "main" },
          currentWebview: { label: "main" },
        },
        transformCallback: (callback: Function) => {
          const id = nextCallback++;
          callbacks.set(id, callback);
          return id;
        },
        unregisterCallback: (id: number) => {
          callbacks.delete(id);
        },
        invoke: async (command: string, args: any) => {
          state.__commands.push(command);
          if (command === "select_workspace_folder_dialog")
            return state.__selectedFolder;
          if (command === "read_workspace")
            return {
              projects: Object.values(state.__folders[args.folderPath] || {}),
              issues: [],
              sources: [],
            };
          if (command === "save_project_to_folder") {
            if (state.__saveDelay)
              await new Promise((resolve) =>
                setTimeout(resolve, state.__saveDelay),
              );
            if (state.__failSave) throw new Error("Disk unavailable");
            const target = (state.__folders[args.folderPath] ||= {});
            target[args.project.id] = structuredClone(args.project);
            state.__saves.push(structuredClone(args.project));
            sessionStorage.setItem("fixture-files", JSON.stringify(files));
            return "fixture-path";
          }
          if (command === "delete_project_from_folder") {
            if (state.__failDelete) throw new Error("Delete unavailable");
            delete files[args.id];
            sessionStorage.setItem("fixture-files", JSON.stringify(files));
            return null;
          }
          if (command === "plugin:event|listen") {
            const id = nextListener++;
            listeners.set(id, { event: args.event, handler: args.handler });
            return id;
          }
          if (command === "plugin:event|unlisten") {
            listeners.delete(args.eventId);
            return null;
          }
          if (command === "window_is_maximized") return false;
          return null;
        },
      };
    },
    { project, viewMode, extraProjects },
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: project.name, exact: true }),
  ).toBeVisible();
}
export async function savedDocument(page: Page, id = "first") {
  return page.evaluate(
    (id) =>
      (window as any).__files.world.documents.find((d: any) => d.id === id)
        .content,
    id,
  );
}
