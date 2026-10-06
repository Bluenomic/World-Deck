import { test, expect, type Page } from "@playwright/test";
import { appendHistory } from "../src/utils/projectHistory";
import {
  canParentMap,
  fitMap,
  pinAtEvent,
  shapeAtEvent,
} from "../src/utils/mapGeometry";
import { enqueueSave } from "../src/utils/saveQueue";
import type { WorldProject } from "../src/types";

const project: WorldProject = {
  id: "test-world",
  name: "Atlas test",
  description: "",
  version: "1",
  createdAt: 1,
  updatedAt: 1,
  connections: [],
  cards: [
    {
      id: "port",
      title: "Harbor",
      category: "location",
      summary: "Trading harbor",
      content: "A coastal town.",
      tags: ["coast"],
      attributes: [],
      x: 0,
      y: 0,
      createdAt: 1,
      updatedAt: 1,
    },
  ],
  worldMaps: [
    {
      id: "map-a",
      name: "Continent",
      imageUrl: "",
      pins: [{ id: "pin-a", cardId: "port", title: "Harbor", x: 45, y: 45 }],
      createdAt: 1,
      updatedAt: 1,
    },
  ],
  timelineNodes: [
    { id: "event-a", trackId: "track-a", x: 0, title: "Departure" },
    { id: "event-b", trackId: "track-a", x: 400, title: "Arrival" },
  ],
};
async function boot(page: Page, empty = false) {
  await page.addInitScript(
    ({ project, empty }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = 900;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#bbd5cb";
      ctx.fillRect(0, 0, 1600, 900);
      ctx.fillStyle = "#7faa99";
      ctx.fillRect(300, 150, 800, 600);
      const world = structuredClone(project);
      world.worldMaps![0].imageUrl = canvas.toDataURL("image/png");
      if (empty) world.worldMaps = [];
      localStorage.setItem(
        "worlddeck_selected_workspace_path",
        "test-workspace",
      );
      localStorage.setItem("worlddeck_language_v1", "en");
      localStorage.setItem(
        "worlddeck_workspace_prefs_v1",
        JSON.stringify({ viewMode: "map" }),
      );
      (window as any).__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
      (window as any).__saves = [];
      (window as any).__failSave = false;
      (window as any).__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: async (cmd: string, args: any) => {
          if (cmd === "read_workspace") return { projects: [world], issues: [], sources: [] };
          if (cmd === "save_project_to_folder") {
            if ((window as any).__failSave) throw new Error("Disk unavailable");
            (window as any).__saves.push(structuredClone(args.project));
            return "test-workspace/project_test-world.json";
          }
          if (cmd === "window_is_maximized") return false;
          return null;
        },
      };
    },
    { project, empty },
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".map-workspace")).toBeVisible({ timeout: 15000 });
  if (!empty) await expect(page.locator(".map-message")).toHaveCount(0, { timeout: 15000 });
  return errors;
}
test("clean map, single selection, double click reader, one undo per drag", async ({
  page,
}, testInfo) => {
  const errors = await boot(page);
  const pin = page.locator('[data-pin-id="pin-a"]');
  await expect(pin).toBeVisible();
  await expect(page.locator(".map-message")).toHaveCount(0);
  await expect(
    page.locator(".map-explorer,.world-status-bar,.map-settings"),
  ).toHaveCount(0);
  await pin.click();
  await expect(pin).toHaveClass(/selected/);
  await expect(page.getByText("Trading harbor", { exact: true })).toHaveCount(
    0,
  );
  await pin.dblclick();
  await expect(
    page.getByText("Trading harbor", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  const before = await page.evaluate(() => (window as any).__saves.length);
  const box = (await pin.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 12);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 40, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => (window as any).__saves.length))
    .toBe(before + 1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(pin).toHaveCSS("left", "720px");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(pin).not.toHaveCSS("left", "720px");
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("map-clean.png") });
});
test("first upload fits and immediately supports wheel zoom", async ({
  page,
}) => {
  await boot(page, true);
  await page
    .getByRole("button", { name: "Upload World Map", exact: true })
    .first()
    .click();
  const dialog = page.locator(".map-modal");
  await dialog.locator("input[type=text],input[maxlength]").fill("Wide map");
  const base64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 3200;
    c.height = 900;
    return c.toDataURL("image/png").split(",")[1];
  });
  await dialog.locator("input[type=file]").setInputFiles({
    name: "wide.png",
    mimeType: "image/png",
    buffer: Buffer.from(base64, "base64"),
  });
  await dialog.getByRole("button", { name: "Save Map", exact: true }).click();
  await expect(page.locator(".map-message")).toHaveCount(0);
  const area = (await page.locator(".map-viewport").boundingBox())!,
    image = (await page.locator(".map-surface img").boundingBox())!;
  expect(image.width).toBeLessThan(area.width);
  expect(image.x).toBeGreaterThanOrEqual(area.x);
  const previous = await page.locator(".map-zoom>span").innerText();
  await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -200);
  await page.keyboard.up("Control");
  await expect(page.locator(".map-zoom>span")).not.toHaveText(previous);
});
test("context menu opens optional settings, layer and route persist, timeline positions undo", async ({
  page,
}) => {
  await boot(page);
  const pin = page.locator('[data-pin-id="pin-a"]');
  await pin.click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Pin settings", exact: true })
    .click();
  const settings = page.getByRole("dialog", {
    name: "Map settings",
    exact: true,
  });
  await expect(settings).toBeVisible();
  await settings.getByText("Layers & legend", { exact: true }).click();
  await settings
    .getByRole("textbox", { name: "New layer name" })
    .fill("Politics");
  await settings
    .getByRole("button", { name: "Add layer", exact: true })
    .click();
  await expect(
    settings.getByRole("checkbox", { name: "Politics" }),
  ).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(settings).toHaveCount(0);
  await page.getByRole("button", { name: "Draw route", exact: true }).click();
  const area = (await page.locator(".map-viewport").boundingBox())!;
  await page.mouse.click(area.x + 200, area.y + 200);
  await page.mouse.click(area.x + 350, area.y + 300);
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(page.locator(".map-shapes polyline")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page
    .getByRole("combobox", { name: "Base positions · all periods" })
    .selectOption("event-b");
  await pin.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__saves.at(-1).worldMaps[0].pins[0].positions?.[0]
            ?.eventId,
      ),
    )
    .toBe("event-b");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__saves.at(-1).worldMaps[0].pins[0].positions
            ?.length || 0,
      ),
    )
    .toBe(0);
});
test("failed saves are visible, successful saves have no permanent status bar", async ({
  page,
}) => {
  await boot(page);
  await page.evaluate(() => {
    (window as any).__failSave = true;
  });
  await page.locator('[data-pin-id="pin-a"]').focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("alert")).toContainText("Workspace operation failed");
  await page.evaluate(() => {
    (window as any).__failSave = false;
  });
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("project history includes map/document changes, caps history, truncates redo", () => {
  const updated = {
    ...project,
    worldMaps: project.worldMaps!.map((m) => ({ ...m, name: "Changed" })),
  };
  let history = appendHistory([project], 0, updated);
  expect(history.index).toBe(1);
  history = appendHistory(history.stack, 0, { ...project, documents: [] });
  expect(history.stack.length).toBe(2);
  expect(history.stack[1].worldMaps![0].name).toBe("Continent");
  for (let i = 0; i < 100; i++)
    history = appendHistory(history.stack, history.index, {
      ...project,
      name: String(i),
    });
  expect(history.stack.length).toBe(51);
  expect(history.index).toBe(50);
});
test("geometry: fit, cycle rejection and timeline boundary behavior", () => {
  expect(fitMap(4000, 1000, 1000, 600)).toBeLessThan(0.25);
  expect(
    canParentMap(
      [
        { ...project.worldMaps![0], parentMapId: "b" },
        { ...project.worldMaps![0], id: "b" },
      ],
      "b",
      "map-a",
    ),
  ).toBe(false);
  const events = project.timelineNodes!;
  const pin = {
    ...project.worldMaps![0].pins[0],
    positions: [{ eventId: "event-b", x: 75, y: 80 }],
  };
  expect(pinAtEvent(pin, "event-a", events).x).toBe(45);
  expect(pinAtEvent(pin, "event-b", events).x).toBe(75);
  expect(
    shapeAtEvent(
      {
        id: "shape",
        name: "",
        kind: "region",
        points: [],
        color: "",
        untilEventId: "event-b",
      },
      "event-b",
      events,
    ),
  ).toBe(false);
});
test("save queue serializes writes and recovers after failures", async () => {
  const order: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const first = enqueueSave("queue-test", async () => {
    order.push("first");
    await gate;
    throw new Error("disk");
  });
  const second = enqueueSave("queue-test", async () => {
    order.push("second");
    return "ok";
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(order).toEqual(["first"]);
  release();
  await expect(first).rejects.toThrow("disk");
  await expect(second).resolves.toBe("ok");
  expect(order).toEqual(["first", "second"]);
});

test("browser storage keeps images separate and recovers a damaged or missing primary", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const result = await page.evaluate(async (project) => {
    const path = "/src/utils/localFileStorage.ts";
    const { writeProjectToDirectory, readAllProjectsFromDirectory } =
      await import(path);
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle("test-assets", { create: true });
    const canvas = document.createElement("canvas");
    canvas.width = 10;
    canvas.height = 10;
    project.worldMaps![0].imageUrl = canvas.toDataURL("image/png");
    if (!(await writeProjectToDirectory(dir, project)))
      throw new Error("Initial save failed");
    const primary = await dir.getFileHandle("project_test-world.json");
    const raw = await (await primary.getFile()).text();
    await writeProjectToDirectory(dir, { ...project, name: "New name" });
    const writer = await primary.createWritable();
    await writer.write("damaged");
    await writer.close();
    const recovered = await readAllProjectsFromDirectory(dir);
    await dir.removeEntry("project_test-world.json");
    const missing = await readAllProjectsFromDirectory(dir);
    return {
      separate: raw.includes("assets/wd_") && !raw.includes("base64"),
      name: recovered[0].name,
      image: recovered[0].worldMaps[0].imageUrl,
      missing: missing.length,
    };
  }, structuredClone(project));
  expect(result.separate).toBe(true);
  expect(result.name).toBe("Atlas test");
  expect(result.image).toMatch(/^data:image\/png;base64,/);
  expect(result.missing).toBe(1);
});

test("map renders without external network assets in light theme at laptop size", async ({
  page,
}, testInfo) => {
  const external: string[] = [];
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:/.test(url) && !url.startsWith("http://127.0.0.1:5175")) {
      external.push(url);
      return route.abort();
    }
    return route.continue();
  });
  await page.addInitScript(() =>
    localStorage.setItem("worlddeck_theme_v1", "light"),
  );
  await page.setViewportSize({ width: 960, height: 640 });
  const start = Date.now();
  await boot(page);
  await expect(page.locator(".map-message")).toHaveCount(0);
  console.log(
    `Map ready in ${Date.now() - start} ms (development server, test fixture)`,
  );
  expect(external).toEqual([]);
  await page
    .getByRole("button", { name: "Fit to screen", exact: true })
    .click();
  const bounds = (await page.locator(".map-surface img").boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(960);
  await page.screenshot({ path: testInfo.outputPath("map-light.png") });
});
