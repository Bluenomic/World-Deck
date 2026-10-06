import { test, expect } from "@playwright/test";
import {
  projectReducer,
  initialProjectState,
} from "../src/utils/projectReducer";
import { fixtureProject, bootWorkspace } from "./helpers/workspace";
test("history: no-op identity, grouped documents, branch truncation and 50 undo operations", () => {
  const project = fixtureProject();
  let state = projectReducer(initialProjectState, {
    type: "load",
    worlds: [project],
  });
  expect(
    projectReducer(state, {
      type: "replace",
      worlds: [{ ...project, updatedAt: 2 }],
    }),
  ).toBe(state);
  for (let index = 0; index < 3; index++)
    state = projectReducer(state, {
      type: "replace",
      transactionId: "editor",
      worlds: [{ ...state.worlds[0], name: `edit${index}` }],
    });
  expect(state.histories.world.stack).toHaveLength(2);
  state = projectReducer(state, { type: "restore", offset: -1, updatedAt: 10 });
  expect(state.worlds[0].name).toBe(project.name);
  state = projectReducer(state, {
    type: "replace",
    worlds: [{ ...state.worlds[0], name: "new branch" }],
  });
  expect(state.histories.world.stack).toHaveLength(2);
  for (let index = 0; index < 60; index++)
    state = projectReducer(state, {
      type: "replace",
      worlds: [{ ...state.worlds[0], name: `change${index}` }],
    });
  expect(state.histories.world.stack).toHaveLength(51);
  expect(state.histories.world.index).toBe(50);
});
test("timeline: opening preserves coordinates and drag publishes once with undo/redo", async ({
  page,
}) => {
  const project = fixtureProject();
  project.timelineNodes = [
    { id: "event", trackId: "track", x: 150, title: "Arrival" },
    { id: "nearby", trackId: "track", x: 160, title: "Nearby" },
  ];
  await bootWorkspace(page, project, "timeline");
  const node = page.locator('[data-timeline-node-id="event"]');
  await expect(node).toBeVisible();
  await page.waitForTimeout(850);
  expect(await page.evaluate(() => (window as any).__saves.length)).toBe(0);
  const box = await node.boundingBox();
  await page.mouse.move(box!.x + 3, box!.y + 16);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++)
    await page.mouse.move(box!.x + 3 + i * 10, box!.y + 16);
  expect(await page.evaluate(() => (window as any).__saves.length)).toBe(0);
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => (window as any).__saves.length))
    .toBe(1);
  expect(
    await page.evaluate(
      () =>
        (window as any).__files.world.timelineNodes.find(
          (n: any) => n.id === "nearby",
        ).x,
    ),
  ).toBe(160);
  await page.keyboard.press("Control+z");
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__files.world.timelineNodes[0].x),
    )
    .toBe(150);
  await page.keyboard.press("Control+y");
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__files.world.timelineNodes[0].x),
    )
    .toBe(230);
});
test("canvas: viewport culling retains off-screen data and card interaction", async ({
  page,
}) => {
  const project = fixtureProject();
  project.cards = Array.from({ length: 1000 }, (_, i) => ({
    ...project.cards[0],
    id: `card${i}`,
    title: `Card ${i}`,
    x: (i % 50) * 350,
    y: Math.floor(i / 50) * 260,
  }));
  await bootWorkspace(page, project, "canvas");
  const canvas = page.getByTestId("world-canvas");
  await expect(canvas).toBeVisible();
  await expect
    .poll(() => canvas.locator("[data-card-id]").count())
    .toBeLessThan(50);
  await canvas.locator('[data-card-id="card0"]').click();
  await expect(canvas.locator('[data-card-id="card0"]')).toBeVisible();
  expect(
    await page.evaluate(() => (window as any).__files.world.cards.length),
  ).toBe(1000);
});
test("editor: project undo groups multiple autosaves into one editing session", async ({
  page,
}) => {
  await bootWorkspace(page);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Document content" });
  await editor.fill("First change");
  await expect
    .poll(() => page.evaluate(() => (window as any).__saves.length))
    .toBe(1);
  await editor.fill("Second change");
  await expect
    .poll(() => page.evaluate(() => (window as any).__saves.length))
    .toBe(2);
  await page.getByRole("button", { name: "Canvas", exact: true }).click();
  await page.keyboard.press("Control+z");
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__files.world.documents[0].content),
    )
    .toBe("<p>Original text</p>");
});

test("canvas: resizing previews locally and commits one reversible change", async ({
  page,
}) => {
  const project = fixtureProject();
  project.cards[0].width = 288;
  project.cards[0].height = 180;
  await bootWorkspace(page, project, "canvas");
  const handle = page.locator('[data-card-resize="card"]');
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox();
  await page.mouse.move(box!.x + 12, box!.y + 12);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++)
    await page.mouse.move(box!.x + 12 + i * 10, box!.y + 12 + i * 6);
  expect(await page.evaluate(() => (window as any).__saves.length)).toBe(0);
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => (window as any).__saves.length))
    .toBe(1);
  expect(
    await page.evaluate(() => (window as any).__files.world.cards[0].width),
  ).toBe(338);
  await page.keyboard.press("Control+z");
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__files.world.cards[0].width),
    )
    .toBe(288);
});
