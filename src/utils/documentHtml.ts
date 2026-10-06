import DOMPurify from "dompurify";
import type { WorldCard } from "../types";
const supportedStyles = new Set([
  "font-size",
  "font-family",
  "font-weight",
  "font-style",
  "color",
  "background-color",
  "text-decoration",
  "text-align",
  "line-height",
  "float",
  "display",
  "width",
  "height",
  "max-width",
  "max-height",
  "min-width",
  "margin",
  "margin-left",
  "margin-right",
  "margin-top",
  "margin-bottom",
  "padding",
  "padding-left",
  "padding-right",
  "padding-top",
  "padding-bottom",
  "border",
  "border-radius",
  "object-fit",
  "object-position",
  "overflow",
  "transform",
  "transform-origin",
  "clip-path",
  "clear",
  "vertical-align",
  "box-sizing",
  "position",
  "top",
  "left",
]);
if (typeof window !== "undefined")
  DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
    if (data.attrName === "style") {
      const probe = document.createElement("span");
      probe.style.cssText = data.attrValue;
      for (const property of [...probe.style]) {
        if (
          !supportedStyles.has(property) ||
          /url\s*\(|expression\s*\(|@import|behavior/i.test(
            probe.style.getPropertyValue(property),
          )
        )
          probe.style.removeProperty(property);
      }
      data.attrValue = probe.style.cssText;
    }
    if (
      data.attrName === "src" ||
      data.attrName === "href" ||
      data.attrName === "data-original-src"
    ) {
      const value = data.attrValue.trim();
      const safe =
        /^(https?:|#)/i.test(value) ||
        (data.attrName === "href" && /^mailto:/i.test(value)) ||
        (data.attrName !== "href" &&
          (/^(blob:|assets\/wd_)/.test(value) ||
            /^data:image\/(png|jpeg|webp|gif);base64,/i.test(value)));
      if (!safe) data.keepAttr = false;
    }
    if (
      data.attrName === "data-card-id" &&
      !/^[a-zA-Z0-9_-]+$/.test(data.attrValue)
    )
      data.keepAttr = false;
    if (data.attrName === "contenteditable") {
      if (node.hasAttribute("data-card-id")) data.attrValue = "false";
      else if (node.classList.contains("doc-img-wrapper"))
        data.attrValue = "false";
      else if (
        node.nodeName === "FIGCAPTION" &&
        node.classList.contains("doc-img-caption")
      )
        data.attrValue = "true";
      else data.keepAttr = false;
    }
  });
export function sanitizeDocumentHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: [
      "script",
      "style",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "button",
      "textarea",
      "select",
      "video",
      "audio",
    ],
    ADD_ATTR: [
      "data-card-id",
      "data-broken-reference",
      "contenteditable",
      "data-original-src",
      "data-crop-top",
      "data-crop-bottom",
      "data-crop-left",
      "data-crop-right",
    ],
    ALLOW_DATA_ATTR: false,
  });
}
export function documentHtmlForReading(
  html: string,
  cards: WorldCard[],
): string {
  const template = document.createElement("template");
  template.innerHTML = sanitizeDocumentHtml(html);
  const ids = new Set(cards.map((c) => c.id));
  for (const mention of template.content.querySelectorAll<HTMLElement>(
    "[data-card-id]",
  )) {
    const broken = !ids.has(mention.dataset.cardId || "");
    mention.toggleAttribute("data-broken-reference", broken);
    if (broken) mention.title = "Referensi terputus / Broken reference";
    else mention.removeAttribute("title");
  }
  for (const editable of template.content.querySelectorAll("[contenteditable]"))
    editable.removeAttribute("contenteditable");
  for (const link of template.content.querySelectorAll("a")) {
    link.rel = "noopener noreferrer";
  }
  return sanitizeDocumentHtml(template.innerHTML);
}
export function cardMentionHtml(card: WorldCard): string {
  const badge = document.createElement("span");
  badge.contentEditable = "false";
  badge.dataset.cardId = card.id;
  badge.className =
    "card-mention-badge inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-semibold select-none cursor-pointer";
  badge.textContent = `@${card.title}`;
  return sanitizeDocumentHtml(badge.outerHTML) + "&nbsp;";
}
