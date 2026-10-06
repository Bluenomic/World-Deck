import os from "node:os";
import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const url = process.env.BENCHMARK_URL || "http://127.0.0.1:5180";
const output =
  process.env.BENCHMARK_OUTPUT || "node_modules/.tmp/canvas-benchmark.json";
const project = {
  schemaVersion: 1,
  id: "benchmark",
  name: "Benchmark",
  description: "",
  version: "1",
  createdAt: 1,
  updatedAt: 1,
  canvases: [{ id: "default", name: "Main", createdAt: 1 }],
  cards: Array.from({ length: 1000 }, (_, i) => ({
    id: `card-${i}`,
    title: `Card ${i}`,
    category: "location",
    summary: "A worldbuilding card for the production benchmark.",
    content: "Background lore.",
    tags: ["benchmark"],
    attributes: [],
    x: (i % 50) * 350,
    y: Math.floor(i / 50) * 260,
    width: 288,
    height: 180,
    canvasIds: ["default"],
    createdAt: 1,
    updatedAt: 1,
  })),
  connections: Array.from({ length: 2000 }, (_, i) => ({
    id: `edge-${i}`,
    sourceId: `card-${i % 1000}`,
    targetId: `card-${(i + (i < 1000 ? 1 : 37)) % 1000}`,
    label: "Relation",
  })),
  documents: Array.from({ length: 100 }, (_, i) => ({
    id: `doc-${i}`,
    title: `Document ${i}`,
    category: "story",
    content: `<h2>Chapter ${i}</h2><p>${"Worldbuilding manuscript. ".repeat(100)}</p>`,
    createdAt: 1,
    updatedAt: 1,
  })),
};
const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const browser = await chromium.launch({
  channel: process.env.CI ? undefined : "msedge",
  headless: true,
});
try {
  const samples = [];
  for (let run = 0; run < 5; run++) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    await page.addInitScript((project) => {
      localStorage.setItem("worlddeck_selected_workspace_path", "benchmark");
      localStorage.setItem("worlddeck_language_v1", "en");
      localStorage.setItem(
        "worlddeck_workspace_prefs_v1",
        JSON.stringify({
          viewMode: "canvas",
          isSidebarOpen: false,
          canvasViewports: { default: { zoom: 1, pan: { x: 0, y: 0 } } },
        }),
      );
      window.__benchmarkStart = performance.now();
      window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
        unregisterListener: () => {},
      };
      window.__TAURI_INTERNALS__ = {
        metadata: {
          currentWindow: { label: "main" },
          currentWebview: { label: "main" },
        },
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: async (command) =>
          command === "read_workspace"
            ? { projects: [project], issues: [], sources: [] }
            : command === "window_is_maximized"
              ? false
              : 1,
      };
    }, project);
    await page.goto(url);
    await page.locator("#canvas-svg-bg").waitFor({ timeout: 60000 });
    await page.locator('[data-card-id="card-0"]').waitFor({ timeout: 60000 });
    const readyMs = await page.evaluate(async () => {
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
      return performance.now() - window.__benchmarkStart;
    });
    const pan = await page.evaluate(async () => {
      const background = document.getElementById("canvas-svg-bg");
      const frame = () =>
        new Promise((resolve) => requestAnimationFrame(resolve));
      const event = (type, x) =>
        background.dispatchEvent(
          new MouseEvent(type, {
            bubbles: true,
            button: 1,
            buttons: 4,
            clientX: x,
            clientY: 700,
          }),
        );
      event("mousedown", 700);
      await frame();
      const times = [];
      for (let i = 0; i < 20; i++) {
        const start = performance.now();
        event("mousemove", 700 + i * 4);
        await frame();
        times.push(performance.now() - start);
      }
      event("mouseup", 780);
      await frame();
      return times.slice(3);
    });
    samples.push({
      run: run + 1,
      readyMs,
      panMedianMs: median(pan),
      renderedCards: await page.locator("main [data-card-id]").count(),
    });
    await page.close();
  }
  const result = {
    environment: {
      platform: os.platform(),
      release: os.release(),
      cpu: os.cpus()[0]?.model.trim(),
      memoryGiB: Math.round(os.totalmem() / 1073741824),
      node: process.version,
      browser: browser.version(),
      capturedAt: new Date().toISOString(),
    },
    fixture: {
      cards: 1000,
      connections: 2000,
      documents: 100,
      viewport: "1280x800",
    },
    url,
    samples,
    medianReadyMs: median(samples.map((s) => s.readyMs)),
    medianPanMs: median(samples.map((s) => s.panMedianMs)),
  };
  await writeFile(output, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
