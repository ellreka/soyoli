import { DomUtils, parseDocument } from "htmlparser2";

import { contentTags, type ContentNode } from "@/features/books/book";

export type HtmlDocument = ReturnType<typeof parseDocument>;
export type HtmlElement = NonNullable<ReturnType<typeof DomUtils.findOne>>;
type HtmlNode = ReturnType<typeof DomUtils.getChildren>[number];
type HtmlRoot = HtmlDocument | HtmlElement;

const maxHtmlLength = 5 * 1024 * 1024;

const droppedTags = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "iframe",
  "object",
  "embed",
  "form",
  "button",
  "input",
  "select",
  "textarea",
  "svg",
]);

// WORKAROUND: DomUtils.isTag は型ガードではない（domelementtype から来ている）。
function isElement(node: HtmlNode): node is HtmlElement {
  return "attribs" in node;
}

export function parseHtml(html: string): HtmlDocument {
  if (html.length > maxHtmlLength) {
    throw new Error("ページが大きすぎて読み込めません。");
  }
  return parseDocument(html);
}

export function hasClass(element: HtmlElement, name: string): boolean {
  return (element.attribs.class ?? "").split(/\s+/).includes(name);
}

export function findByClass(root: HtmlRoot, name: string): HtmlElement | null {
  return DomUtils.findOne((element) => hasClass(element, name), root.children);
}

export function findAllByClass(root: HtmlRoot, name: string): HtmlElement[] {
  return DomUtils.findAll((element) => hasClass(element, name), root.children);
}

export function findChild(root: HtmlRoot, name: string): HtmlElement | null {
  return DomUtils.findOne(
    (element) => element.name === name,
    root.children,
    false,
  );
}

export function findTag(root: HtmlRoot, name: string): HtmlElement | null {
  return DomUtils.findOne((element) => element.name === name, root.children);
}

export function findById(root: HtmlRoot, id: string): HtmlElement | null {
  return DomUtils.findOne(
    (element) => element.attribs.id === id,
    root.children,
  );
}

export function textOf(node: HtmlNode | null | undefined): string {
  return node
    ? DomUtils.textContent(node)
        .replace(/[\t\n\r ]+/g, " ")
        .trim()
    : "";
}

export function absoluteUrl(
  href: string | undefined,
  pageUrl: string,
): string | undefined {
  const target = href?.trim().split("#")[0];
  if (!target) {
    return undefined;
  }
  if (/^https?:\/\//i.test(target)) {
    return target;
  }
  if (target.startsWith("//")) {
    return `https:${target}`;
  }
  const origin = /^https?:\/\/[^/?#]+/i.exec(pageUrl)?.[0];
  return origin && target.startsWith("/") ? origin + target : undefined;
}

export function toContent(
  nodes: readonly HtmlNode[],
  pageUrl: string,
): ContentNode[] {
  return nodes.flatMap((node): ContentNode[] => {
    if (node.type === "text") {
      return node.data ? [{ type: "text", text: node.data }] : [];
    }
    if (!isElement(node) || droppedTags.has(node.name)) {
      return [];
    }
    if (node.name === "img") {
      const uri = absoluteUrl(node.attribs.src, pageUrl);
      return uri ? [{ type: "image", uri, alt: node.attribs.alt ?? "" }] : [];
    }
    const children = toContent(node.children, pageUrl);
    const tag = contentTags.find((value) => value === node.name);
    return tag ? [{ type: "element", tag, children }] : children;
  });
}
