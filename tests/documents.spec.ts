import { test, expect } from "@playwright/test";
import {
  DocumentDraftSession,
  draftKey,
  readDocumentBackup,
} from "../src/utils/documentDrafts";
import type { WorldDocument } from "../src/types";
import {
  bootWorkspace,
  fixtureProject,
  savedDocument,
} from "./helpers/workspace";
function storage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] || null,
    getItem: (key) => map.get(key) || null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    clear: () => map.clear(),
  };
}
const doc: WorldDocument = {
  id: "first",
  title: "First",
  category: "story",
  content: "old",
  createdAt: 1,
  updatedAt: 1,
};
const identity = {
  workspaceId: "folder",
  projectId: "world",
  documentId: "first",
};
test("draft: failed acknowledgement retains backup; successful retry clears only its revision", async () => {
  let current = { ...doc, content: "new" };
  let fail = true;
  const disk = storage();
  const session = new DocumentDraftSession(
    identity,
    doc,
    () => current,
    async () => {
      if (fail) throw new Error("disk");
    },
    disk,
  );
  expect(await session.commit()).toBe(false);
  expect(readDocumentBackup(identity, doc, disk)?.content).toBe("new");
  fail = false;
  expect(await session.commit()).toBe(true);
  expect(disk.getItem(draftKey(identity))).toBeNull();
  current = { ...current, content: "next" };
  session.backup();
  expect(
    readDocumentBackup({ ...identity, workspaceId: "other" }, doc, disk),
  ).toBeUndefined();
  session.dispose();
});
test("draft: typing is debounced and uses one transaction per editing session", async () => {
  let current = { ...doc, content: "one" };
  const calls: string[] = [];
  const session = new DocumentDraftSession(
    identity,
    doc,
    () => current,
    async (_doc, id) => {
      calls.push(id);
    },
    storage(),
  );
  session.changed();
  current = { ...current, content: "two" };
  session.changed();
  await new Promise((resolve) => setTimeout(resolve, 850));
  expect(calls).toHaveLength(1);
  current = { ...current, content: "three" };
  await session.commit();
  expect(calls[0]).toBe(calls[1]);
  session.dispose();
});
test("editor: autosave preserves DOM, caret, and local undo; switching document flushes", async ({
  page,
}) => {
  await bootWorkspace(page);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Document content" });
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" Added");
  await expect.poll(() => savedDocument(page)).toContain("Added");
  await expect(editor).toBeFocused();
  expect(
    await editor.evaluate((el) =>
      el.contains(window.getSelection()?.anchorNode || null),
    ),
  ).toBe(true);
  await page.keyboard.press("Control+z");
  await expect(editor).not.toContainText("Added");
  await page.keyboard.type(" Final");
  await page.getByRole("button", { name: /Second document/ }).click();
  await expect.poll(() => savedDocument(page)).toContain("Final");
  await expect(page.locator("#doc-view-rendered-content")).toContainText(
    "Second text",
  );
});
test("editor: failed save keeps draft and blocks navigation until retry", async ({
  page,
}) => {
  await bootWorkspace(page);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.evaluate(() => {
    (window as any).__failSave = true;
  });
  await page
    .getByRole("textbox", { name: "Document content" })
    .fill("Unsaved text");
  await expect(page.getByRole("alert")).toContainText(
    "Workspace operation failed",
  );
  await page.getByRole("button", { name: "Canvas", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Document content" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((key) =>
        key.startsWith("worlddeck_draft_v2:"),
      ),
    ),
  ).toBe(true);
  await page.evaluate(() => {
    (window as any).__failSave = false;
  });
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByRole("button", { name: "Canvas", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Document content" }),
  ).toHaveCount(0);
  await expect.poll(() => savedDocument(page)).toContain("Unsaved text");
});
test("editor: sanitized paste and imported content keep formatting, images and mentions", async ({
  page,
}) => {
  const project = fixtureProject();
  project.documents![0].content =
    '<h2>Heading</h2><p><b>Bold</b><span data-card-id="missing">Lost mention</span><img src="data:image/png;base64,aGVsbG8=" onerror="window.hacked=true"><a href="javascript:window.hacked=true">Link</a></p><script>window.hacked=true</script>';
  await bootWorkspace(page, project);
  const rendered = page.locator("#doc-view-rendered-content");
  await expect(rendered.locator("h2")).toHaveText("Heading");
  await expect(rendered.locator("[data-broken-reference]")).toHaveText(
    "Lost mention",
  );
  expect(await rendered.innerHTML()).not.toMatch(
    /onerror|javascript:|<script/i,
  );
  expect(await page.evaluate(() => (window as any).hacked)).toBeUndefined();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Document content" });
  await editor.click();
  await editor.evaluate((el) => {
    const data = new DataTransfer();
    data.setData(
      "text/html",
      '<p><b>Pasted</b><img src="x" onerror="window.hacked=true"></p>',
    );
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(editor).toContainText("Pasted");
  expect(await editor.innerHTML()).not.toContain("onerror");
  const badge = await page.evaluate(async () => {
    const { cardMentionHtml } = await import("/src/utils/documentHtml.ts");
    return cardMentionHtml({
      id: "safe",
      title: "<img src=x onerror=alert(1)>",
    } as any);
  });
  expect(badge).toContain("&lt;img");
  expect(badge).not.toContain("<img");
});

test("editor: empty document and DOM image layout changes are autosaved without replacing the editor", async ({
  page,
}) => {
  await bootWorkspace(page);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Document content" });
  await editor.evaluate(el => el.replaceChildren());
  await expect.poll(() => savedDocument(page)).toBe("");
  await editor.evaluate((el) => {
    const img = document.createElement("img");
    img.src = "data:image/png;base64,aGVsbG8=";
    img.dataset.originalSrc = img.src;
    img.dataset.cropLeft = "10";
    img.style.float = "left";
    img.style.width = "120px";
    el.appendChild(img);
  });
  await expect.poll(() => savedDocument(page)).toContain('data-crop-left="10"');
  expect(await savedDocument(page)).toContain("float: left");
  await expect(editor).toBeVisible();
});
test("editor: local recovery is scoped to workspace/project/document and acknowledged before clearing", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "worlddeck_draft_v2:" +
        JSON.stringify(["native:fixture-workspace", "world", "first"]),
      JSON.stringify({
        id: "first",
        title: "Recovered document",
        content: "<p>Recovered text</p>",
        updatedAt: Date.now(),
      }),
    );
    localStorage.setItem(
      "worlddeck_draft_v2:" +
        JSON.stringify(["native:other-folder", "world", "first"]),
      JSON.stringify({
        id: "first",
        title: "Other",
        content: "<p>Wrong workspace</p>",
        updatedAt: Date.now(),
      }),
    );
  });
  await bootWorkspace(page);
  await expect(page.locator("#doc-view-rendered-content")).toContainText(
    "Recovered text",
  );
  await expect(page.getByRole("status")).toContainText(
    "Document draft recovered",
  );
  await expect.poll(() => savedDocument(page)).toContain("Recovered text");
  expect(
    await page.evaluate(() =>
      localStorage.getItem(
        "worlddeck_draft_v2:" +
          JSON.stringify(["native:fixture-workspace", "world", "first"]),
      ),
    ),
  ).toBeNull();
  expect(
    await page.evaluate(() =>
      localStorage.getItem(
        "worlddeck_draft_v2:" +
          JSON.stringify(["native:other-folder", "world", "first"]),
      ),
    ),
  ).not.toBeNull();
});
