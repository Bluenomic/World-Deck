import { test, expect } from "@playwright/test";
import {
  WorkspacePersistence,
  type WorkspaceAdapter,
} from "../src/utils/workspacePersistence";
import type { WorldProject } from "../src/types";
const project = (id = "one"): WorldProject => ({
  schemaVersion: 1,
  id,
  name: id,
  description: "",
  version: "1",
  cards: [],
  connections: [],
  createdAt: 1,
  updatedAt: 1,
});
function workspace(id = "folder") {
  const files = new Map<string, WorldProject>();
  const adapter: WorkspaceAdapter = {
    id,
    load: async () => ({
      projects: [...files.values()],
      issues: [],
      sources: [],
    }),
    save: async (p) => {
      files.set(p.id, p);
    },
    delete: async (id) => {
      files.delete(id);
    },
  };
  return { files, adapter };
}
test("persistence: saves nonactive projects and drains all workspace targets", async () => {
  const coordinator = new WorkspacePersistence(),
    a = workspace("a"),
    b = workspace("b");
  await Promise.all([
    coordinator.save(a.adapter, project()),
    coordinator.save(a.adapter, project("duplicate")),
    coordinator.save(b.adapter, project()),
  ]);
  expect(await coordinator.flush()).toBe(true);
  expect((await a.adapter.load()).projects.map((p) => p.id)).toEqual([
    "one",
    "duplicate",
  ]);
  expect(b.files.has("one")).toBe(true);
});
test("persistence: delete follows delayed save and blocks later writes", async () => {
  const coordinator = new WorkspacePersistence(),
    { files, adapter } = workspace();
  let release!: () => void;
  adapter.save = async (p) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    files.set(p.id, p);
  };
  const saving = coordinator.save(adapter, project());
  await new Promise((resolve) => setTimeout(resolve, 0));
  const deleting = coordinator.delete(adapter, "one");
  await expect(coordinator.save(adapter, project())).rejects.toThrow("deleted");
  release();
  await saving;
  await deleting;
  expect(files.size).toBe(0);
  await expect(coordinator.save(adapter, project())).rejects.toThrow("deleted");
});
test("persistence: unrelated success cannot hide failure; retry uses captured target", async () => {
  const coordinator = new WorkspacePersistence(),
    a = workspace("a"),
    b = workspace("b");
  const save = a.adapter.save;
  a.adapter.save = async () => {
    throw new Error("disk");
  };
  await expect(coordinator.save(a.adapter, project())).rejects.toThrow("disk");
  await coordinator.save(b.adapter, project());
  expect(coordinator.failures).toHaveLength(1);
  expect(await coordinator.flush()).toBe(false);
  a.adapter.save = save;
  expect(await coordinator.retry()).toBe(true);
  expect(a.files.has("one")).toBe(true);
});
test("persistence: failed delete keeps data and retries removal callback once", async () => {
  const coordinator = new WorkspacePersistence(),
    { files, adapter } = workspace();
  await coordinator.save(adapter, project());
  const remove = adapter.delete;
  adapter.delete = async () => {
    throw new Error("permission");
  };
  let removed = 0;
  await expect(
    coordinator.delete(adapter, "one", () => {
      removed++;
    }),
  ).rejects.toThrow("permission");
  expect(files.has("one")).toBe(true);
  expect(removed).toBe(0);
  await expect(coordinator.save(adapter, project())).rejects.toThrow("deleted");
  adapter.delete = remove;
  expect(await coordinator.retry()).toBe(true);
  expect(files.size).toBe(0);
  expect(removed).toBe(1);
});
