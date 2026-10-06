import { test, expect } from "@playwright/test";
import { bootWorkspace, fixtureProject } from "./helpers/workspace";
test("storage: inactive duplication survives reload and failed deletion stays visible until retry", async ({
  page,
}) => {
  const other = { ...fixtureProject(), id: "other", name: "Other project" };
  await bootWorkspace(page, fixtureProject(), "canvas", [other]);
  await page.getByRole("button", { name: "Test world", exact: true }).click();
  await page
    .locator('[data-world-id="other"]')
    .getByRole("button", { name: "Duplicate Workspace", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => Object.keys((window as any).__files).length),
    )
    .toBe(3);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Test world", exact: true }).click();
  const original = page.locator('[data-world-id="other"]');
  await expect(original).toBeVisible();
  await page.evaluate(() => {
    (window as any).__failDelete = true;
  });
  await original
    .getByRole("button", { name: "Delete Workspace", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Workspace operation failed",
  );
  await expect(original).toBeVisible();
  await page.evaluate(() => {
    (window as any).__failDelete = false;
  });
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(original).toHaveCount(0);
  expect(
    await page.evaluate(() => Object.keys((window as any).__files).length),
  ).toBe(2);
});
test("storage: workspace switch flushes draft to its captured folder and never mixes document IDs", async ({
  page,
}) => {
  await bootWorkspace(page);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Document content" })
    .fill("Captured first workspace");
  const second = { ...fixtureProject(), name: "Second workspace" };
  second.documents![0].content = "<p>Other content</p>";
  await page.evaluate((second) => {
    const w = window as any;
    w.__saveDelay = 400;
    w.__selectedFolder = "second-folder";
    w.__folders["second-folder"] = { world: second };
  }, second);
  await page
    .getByRole("button", { name: "fixture-workspace", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Second workspace", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as any).__folders["fixture-workspace"].world.documents[0]
          .content,
    ),
  ).toContain("Captured first workspace");
  expect(
    await page.evaluate(
      () =>
        (window as any).__folders["second-folder"].world.documents[0].content,
    ),
  ).toBe("<p>Other content</p>");
});
test("desktop smoke mock: window controls and close request wait for save acknowledgement", async ({
  page,
}) => {
  await bootWorkspace(page);
  await page.getByRole("button", { name: "Minimize Window" }).click();
  await page.getByRole("button", { name: "Maximize Window" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__commands))
    .toEqual(
      expect.arrayContaining(["window_minimize", "window_toggle_maximize"]),
    );
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Document content" })
    .fill("Close safely");
  await page.evaluate(() => {
    (window as any).__saveDelay = 500;
    void (window as any).__emitTauri("tauri://close-requested");
  });
  expect(
    await page.evaluate(() =>
      (window as any).__commands.filter(
        (c: string) =>
          c === "plugin:window|close" || c === "plugin:window|destroy",
      ),
    ),
  ).toHaveLength(0);
  await expect
    .poll(() => page.evaluate(() => (window as any).__commands))
    .toContain("plugin:window|close");
  expect(
    await page.evaluate(
      () => (window as any).__files.world.documents[0].content,
    ),
  ).toContain("Close safely");
});
test("desktop smoke mock: failed close keeps data and retry allows application close", async ({
  page,
}) => {
  await bootWorkspace(page);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.evaluate(() => {
    (window as any).__failSave = true;
  });
  await page
    .getByRole("textbox", { name: "Document content" })
    .fill("Keep on failure");
  await page.getByRole("button", { name: "Close Application" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(
    await page.evaluate(() =>
      (window as any).__commands.includes("window_close"),
    ),
  ).toBe(false);
  await page.evaluate(() => {
    (window as any).__failSave = false;
  });
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByRole("button", { name: "Close Application" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__commands.includes("window_close")),
    )
    .toBe(true);
});
test("accessibility: modal traps Tab, closes on Escape, and restores opening button focus", async ({
  page,
}) => {
  await bootWorkspace(page, fixtureProject(), "canvas");
  const opener = page.getByRole("button", { name: "Test world", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  for (let i = 0; i < 15; i++) await page.keyboard.press("Tab");
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});
