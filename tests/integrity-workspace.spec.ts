import { test, expect } from "@playwright/test";
import { fixtureProject, bootWorkspace } from "./helpers/workspace";
test("integrity: workspace reports field locations, backup recovery, missing assets and future formats", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async (project) => {
    const { readWorkspaceFromDirectory } =
      await import("/src/utils/localFileStorage.ts");
    const root = await navigator.storage.getDirectory(),
      dir = await root.getDirectoryHandle("report", { create: true });
    const write = async (name: string, value: unknown) => {
      const file = await dir.getFileHandle(name, { create: true }),
        writer = await file.createWritable();
      await writer.write(
        typeof value === "string" ? value : JSON.stringify(value),
      );
      await writer.close();
    };
    await write("project_valid.json", { ...project, id: "valid" });
    await write("project_recovered.json", "broken");
    await write("project_recovered.json.bak", { ...project, id: "recovered" });
    await write("project_invalid.json", {
      ...project,
      id: "invalid",
      cards: false,
    });
    await write("project_invalid.json.bak", "broken backup");
    await write("project_future.json", {
      ...project,
      id: "future",
      schemaVersion: 2,
    });
    await write("project_future.json.bak", { ...project, id: "future" });
    await write("project_missing.json", {
      ...project,
      id: "missing",
      worldMaps: [
        {
          id: "map",
          name: "Atlas",
          imageUrl: "assets/wd_absent.png",
          pins: [],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    const report = await readWorkspaceFromDirectory(dir);
    return {
      ...report,
      futureRaw: await (
        await (await dir.getFileHandle("project_future.json")).getFile()
      ).text(),
    };
  }, fixtureProject());
  expect(result.projects.map((p: any) => p.id).sort()).toEqual([
    "missing",
    "recovered",
    "valid",
  ]);
  expect(
    result.sources.find((s: any) => s.projectId === "recovered")?.source,
  ).toBe("backup");
  expect(result.issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "invalid_field",
        path: "$.cards",
        fileName: "project_invalid.json",
      }),
      expect.objectContaining({ code: "backup_recovered" }),
      expect.objectContaining({ code: "missing_asset" }),
      expect.objectContaining({ code: "unsupported_schema" }),
      expect.objectContaining({ code: "unreadable_project" }),
    ]),
  );
  expect(JSON.parse(result.futureRaw).schemaVersion).toBe(2);
});
test("integrity: legacy load does not rewrite; next edit backs up legacy file; delete retains unused assets", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async (project) => {
    const {
      readWorkspaceFromDirectory,
      writeProjectToDirectory,
      deleteProjectFromDirectory,
    } = await import("/src/utils/localFileStorage.ts");
    const root = await navigator.storage.getDirectory(),
      dir = await root.getDirectoryHandle("legacy", { create: true });
    const legacy = { ...project } as any;
    delete legacy.schemaVersion;
    delete legacy.documents;
    const original = JSON.stringify(legacy);
    const file = await dir.getFileHandle("project_world.json", {
      create: true,
    });
    const writer = await file.createWritable();
    await writer.write(original);
    await writer.close();
    const loaded = await readWorkspaceFromDirectory(dir),
      unchanged = (await (await file.getFile()).text()) === original;
    const assets = await dir.getDirectoryHandle("assets", { create: true });
    const unused = await assets.getFileHandle("unused.png", { create: true });
    const imageWriter = await unused.createWritable();
    await imageWriter.write("keep");
    await imageWriter.close();
    await writeProjectToDirectory(dir, {
      ...loaded.projects[0],
      name: "Edited",
    });
    const backup = await (
      await (await dir.getFileHandle("project_world.json.bak")).getFile()
    ).text();
    await deleteProjectFromDirectory(dir, "world");
    const remaining = [];
    for await (const entry of dir.values()) remaining.push(entry.name);
    return {
      unchanged,
      schema: loaded.projects[0].schemaVersion,
      documents: loaded.projects[0].documents,
      backup,
      remaining,
      asset: await (await unused.getFile()).text(),
    };
  }, fixtureProject());
  expect(result.unchanged).toBe(true);
  expect(result.schema).toBe(1);
  expect(result.documents).toEqual([]);
  expect(JSON.parse(result.backup).schemaVersion).toBeUndefined();
  expect(result.remaining).toEqual(["assets"]);
  expect(result.asset).toBe("keep");
});
test("integrity: broken Map pin remains visible with its original title and reference ID", async ({
  page,
}) => {
  const project = fixtureProject();
  project.worldMaps = [
    {
      id: "map",
      name: "Atlas",
      imageUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
      pins: [
        {
          id: "lost-pin",
          title: "Lost harbor",
          cardId: "missing",
          x: 50,
          y: 50,
        },
      ],
      createdAt: 1,
      updatedAt: 1,
    },
  ];
  await bootWorkspace(page, project, "map");
  const pin = page.locator('[data-pin-id="lost-pin"]');
  await expect(pin).toBeVisible();
  await expect(pin).toHaveAttribute("data-broken-reference", "true");
  await expect(pin).toHaveAttribute("title", /Broken reference: missing/);
  expect(await page.evaluate(() => (window as any).__saves.length)).toBe(0);
});
