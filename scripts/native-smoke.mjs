import { chromium, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
if (process.platform !== "win32")
  throw new Error("Native smoke requires Windows and WebView2.");
const run = promisify(execFile),
  output = path.resolve("test-results/native-smoke"),
  temp = path.resolve(`node_modules/.tmp/native-smoke-${Date.now()}`);
await mkdir(output, { recursive: true });
await mkdir(temp, { recursive: true });
const folder = path.join(temp, "workspace");
await mkdir(folder, { recursive: true });
const primary = path.join(folder, "project_native.json");
const project = {
  schemaVersion: 1,
  id: "native",
  name: "Native smoke",
  description: "",
  version: "1",
  cards: [],
  connections: [],
  documents: [
    {
      id: "doc",
      title: "Smoke document",
      content: "<p>Original native text</p>",
      category: "story",
      createdAt: 1,
      updatedAt: 1,
    },
  ],
  createdAt: 1,
  updatedAt: 1,
};
await writeFile(primary, JSON.stringify(project));
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
let appPid, browser;
const nativeLogs = [];
async function launch() {
  let occupied = false;
  try {
    await fetch("http://127.0.0.1:9227/json/version", {
      signal: AbortSignal.timeout(750),
    });
    occupied = true;
  } catch {}
  if (occupied)
    throw new Error("Native smoke CDP port 9227 is already in use.");
  const env = {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=9227",
    WEBVIEW2_USER_DATA_FOLDER: path.join(temp, "profile"),
  };
  const result = await run(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `$p = Start-Process -FilePath ${quote(path.resolve("src-tauri/target/debug/app.exe"))} -WindowStyle Hidden -PassThru; $p.Id`,
    ],
    { env, windowsHide: true, timeout: 20000 },
  );
  appPid = Number(result.stdout.trim());
  await writeFile(path.join(temp, "pid.txt"), String(appPid));
  for (let i = 0; i < 60; i++) {
    try {
      browser = await chromium.connectOverCDP("http://127.0.0.1:9227");
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  if (!browser) throw Error("WebView2 debug endpoint unavailable");
  const page = browser.contexts()[0].pages()[0];
  await page.waitForURL(/localhost:5173|127\.0\.0\.1:5173/, { timeout: 15000 });
  await page.waitForLoadState("domcontentloaded");
  await page.locator("header").waitFor();
  page.on("pageerror", (error) => nativeLogs.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()))
      nativeLogs.push(message.text());
  });
  return page;
}
async function close(page) {
  await page
    .getByRole("button", { name: "Close Application", exact: true })
    .click()
    .catch((error) => {
      if (!page.isClosed()) throw error;
    });
  await expect.poll(() => page.isClosed(), { timeout: 10000 }).toBe(true);
  browser = undefined;
  appPid = undefined;
  await new Promise((r) => setTimeout(r, 800));
}
try {
  let page = await launch();
  await page.evaluate(() => {
    localStorage.setItem("worlddeck_language_v1", "en");
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Close Application", exact: true }),
  ).toBeVisible();
  await writeFile(path.join(temp, "connected.txt"), page.url());
  console.log(
    JSON.stringify({
      step: "native-connected",
      pid: appPid,
      url: page.url(),
      folder,
    }),
  );
  // Exercise the real OS picker. A separate UI Automation helper selects this fixture folder.
  await page.evaluate(() => {
    window.__nativePicked = "pending";
    void window.__TAURI_INTERNALS__
      .invoke("select_workspace_folder_dialog")
      .then((value) => {
        window.__nativePicked = value;
      });
  });
  await run(
    "powershell.exe",
    [
      "-NoProfile",
      "-File",
      path.resolve("scripts/select-native-folder.ps1"),
      "-AppPid",
      String(appPid),
      "-Folder",
      folder,
    ],
    { windowsHide: true, timeout: 25000 },
  );
  await expect
    .poll(() => page.evaluate(() => window.__nativePicked), { timeout: 10000 })
    .toBe(folder);
  console.log(JSON.stringify({ step: "native-folder-selected" }));
  await page.evaluate((folder) => {
    localStorage.setItem("worlddeck_selected_workspace_path", folder);
    localStorage.setItem(
      "worlddeck_workspace_prefs_v1",
      JSON.stringify({ viewMode: "documents" }),
    );
  }, folder);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Native smoke", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Document content" })
    .fill("Saved while native close runs");
  await close(page);
  if (
    !JSON.parse(await readFile(primary, "utf8")).documents[0].content.includes(
      "Saved while native close runs",
    )
  )
    throw Error("Native close lost draft");
  console.log(JSON.stringify({ step: "native-close-flushed" }));
  await writeFile(primary, "broken primary");
  page = await launch();
  await expect(
    page.getByRole("button", { name: "Native smoke", exact: true }),
  ).toBeVisible();
  await page.locator('[role="status"] summary').click();
  await expect(
    page.locator('[data-project-issue="backup_recovered"]'),
  ).toBeVisible();
  await expect(page.locator("#doc-view-rendered-content")).toContainText(
    "Original native text",
  );
  if ((await readFile(primary, "utf8")) !== "broken primary")
    throw Error("Opening recovered project rewrote primary");
  await page.screenshot({ path: path.join(output, "backup-recovery.png") });
  await close(page);
  const report = {
    passed: [
      "native-folder-dialog",
      "native-close-flush-draft",
      "native-backup-recovery-without-rewrite",
    ],
    workspace: folder,
    profile: path.join(temp, "profile"),
  };
  await writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} catch (error) {
  console.error(error);
  console.error(JSON.stringify({ nativeLogs }));
  if (browser) {
    const page = browser.contexts()[0]?.pages()[0];
    if (page)
      await page
        .screenshot({ path: path.join(output, "failed.png") })
        .catch(() => {});
  }
  process.exitCode = 1;
} finally {
  if (appPid)
    await run(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Stop-Process -Id ${appPid} -ErrorAction SilentlyContinue`,
      ],
      { windowsHide: true },
    ).catch(() => {});
}
