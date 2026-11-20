import { strFromU8, unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";

import {
  contentTags,
  type Book,
  type BookSeries,
  type ContentNode,
} from "./book";

type XmlNode = {
  [name: string]: XmlNode[] | string | Record<string, string>;
};

const xmlParser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
  maxNestedTags: 100,
});

function children(node: XmlNode): XmlNode[] {
  const value = Object.entries(node).find(([key]) => key !== ":@")?.[1];
  return Array.isArray(value) ? value : [];
}

function attrs(node: XmlNode): Record<string, string> {
  return (node[":@"] ?? {}) as Record<string, string>;
}

function elements(nodes: XmlNode[], tag: string): XmlNode[] {
  return nodes.flatMap((node) => [
    ...(Object.hasOwn(node, tag) ? [node] : []),
    ...elements(children(node), tag),
  ]);
}

function text(nodes: XmlNode[]): string {
  return nodes
    .map((node) =>
      typeof node["#text"] === "string" ? node["#text"] : text(children(node)),
    )
    .join("");
}

function resolvePath(base: string, href: string): string {
  const path = decodeURIComponent(href.split(/[?#]/)[0]);
  if (
    !path ||
    /^(?:[a-z][a-z\d+.-]*:|\/|\\)/i.test(path) ||
    path.includes("\\")
  ) {
    throw new Error("ファイル内の参照先が不正です。");
  }
  const parts = base.split("/").slice(0, -1);
  for (const part of path.split("/")) {
    if (part === "..") {
      if (!parts.length) {
        throw new Error("ファイルの外を参照することはできません。");
      }
      parts.pop();
    } else if (part && part !== ".") {
      parts.push(part);
    }
  }
  return parts.join("/");
}

function position(value: string | undefined): number | undefined {
  const digits = value?.trim() ?? "";
  const number = digits === "" ? Number.NaN : Number(digits);
  return Number.isFinite(number) ? number : undefined;
}

function seriesOf(metadata: XmlNode): BookSeries | undefined {
  const metas = elements(children(metadata), "meta");
  const refining = (id: string | undefined, property: string) =>
    id === undefined
      ? undefined
      : metas.find(
          (meta) =>
            attrs(meta).refines === `#${id}` &&
            attrs(meta).property === property,
        );
  for (const meta of metas) {
    if (attrs(meta).property !== "belongs-to-collection") {
      continue;
    }
    const name = text(children(meta)).trim();
    const { id } = attrs(meta);
    const type = refining(id, "collection-type");
    if (!name || (type && text(children(type)).trim() !== "series")) {
      continue;
    }
    const at = refining(id, "group-position");
    const number = position(at && text(children(at)));
    return number === undefined ? { name } : { name, position: number };
  }
  const named = (key: string) =>
    metas.map(attrs).find((meta) => meta.name === key)?.content;
  const name = named("calibre:series")?.trim();
  if (!name) {
    return undefined;
  }
  const number = position(named("calibre:series_index"));
  return number === undefined ? { name } : { name, position: number };
}

export function parseEpub(bytes: Uint8Array, id: string): Book {
  if (bytes.length > 32 * 1024 * 1024) {
    throw new Error("ファイルは32 MB以下にしてください。");
  }
  let totalSize = 0;
  let entryCount = 0;
  const files = unzipSync(bytes, {
    filter(entry) {
      totalSize += entry.originalSize;
      entryCount += 1;
      if (
        entry.originalSize > 16 * 1024 * 1024 ||
        totalSize > 64 * 1024 * 1024 ||
        entryCount > 512
      ) {
        throw new Error("展開サイズまたは中のファイル数が上限を超えています。");
      }
      if (
        /^(?:\/|\\|[a-z]:)/i.test(entry.name) ||
        entry.name.includes("\\") ||
        entry.name.split("/").includes("..")
      ) {
        throw new Error("ファイル内の名前が不正です。");
      }
      return !entry.name.endsWith("/");
    },
  });

  function read(path: string): Uint8Array {
    if (!Object.hasOwn(files, path)) {
      throw new Error(`ファイル内に必要なデータがありません: ${path}`);
    }
    return files[path];
  }

  function xml(path: string): XmlNode[] {
    const source = strFromU8(read(path));
    if (/<!ENTITY\b/i.test(source)) {
      throw new Error("独自のXMLエンティティには対応していません。");
    }
    return xmlParser.parse(source, true) as XmlNode[];
  }

  if (strFromU8(read("mimetype")).trim() !== "application/epub+zip") {
    throw new Error("対応している形式のファイルではありません。");
  }
  if (Object.hasOwn(files, "META-INF/encryption.xml")) {
    throw new Error("暗号化されたファイルには対応していません。");
  }
  const container = xml("META-INF/container.xml");
  const rootfile = elements(container, "rootfile")[0];
  if (!rootfile || !attrs(rootfile)["full-path"]) {
    throw new Error("ファイルの構成情報が見つかりません。");
  }
  const packagePath = resolvePath("", attrs(rootfile)["full-path"]);
  const packageXml = xml(packagePath);
  const metadata = elements(packageXml, "metadata")[0];
  const manifest = elements(packageXml, "manifest")[0];
  const spine = elements(packageXml, "spine")[0];
  if (!metadata || !manifest || !spine) {
    throw new Error("ファイルの構造が不正です。");
  }
  const title = text(elements(children(metadata), "title")).trim();
  if (!title) {
    throw new Error("ファイルに書名がありません。");
  }

  const items = new Map<
    string,
    { path: string; mime: string; properties: string[] }
  >();
  for (const item of elements(children(manifest), "item")) {
    const attributes = attrs(item);
    if (!attributes.id || !attributes.href || items.has(attributes.id)) {
      throw new Error("ファイルの目録が不正です。");
    }
    items.set(attributes.id, {
      path: resolvePath(packagePath, attributes.href),
      mime: attributes["media-type"] ?? "",
      properties: (attributes.properties ?? "").split(/\s+/),
    });
  }
  const resources = new Map(
    [...items.values()].map((item) => [item.path, item]),
  );
  const images = new Map<string, string>();
  function image(path: string): string | undefined {
    const item = resources.get(path);
    if (!item || !/^image\/(?:jpeg|png|gif|webp)$/.test(item.mime)) {
      return undefined;
    }
    if (!images.has(path)) {
      images.set(
        path,
        `data:${item.mime};base64,${btoa(strFromU8(read(path), true))}`,
      );
    }
    return images.get(path);
  }

  const chapterTitles = new Map<string, string>();
  const nav = [...items.values()].find((item) =>
    item.properties.includes("nav"),
  );
  if (nav) {
    const navigation = xml(nav.path);
    const toc = elements(navigation, "nav").find((node) =>
      attrs(node).type?.split(/\s+/).includes("toc"),
    );
    for (const anchor of elements(toc ? children(toc) : navigation, "a")) {
      if (!attrs(anchor).href) {
        continue;
      }
      const path = resolvePath(nav.path, attrs(anchor).href);
      const label = text(children(anchor)).trim();
      if (label && !chapterTitles.has(path)) {
        chapterTitles.set(path, label);
      }
    }
  }

  function content(nodes: XmlNode[], chapterPath: string): ContentNode[] {
    return nodes.flatMap((node): ContentNode[] => {
      if (typeof node["#text"] === "string") {
        return [{ type: "text", text: node["#text"] }];
      }
      const tag = Object.keys(node).find((key) => key !== ":@");
      if (
        !tag ||
        [
          "script",
          "style",
          "iframe",
          "object",
          "embed",
          "form",
          "svg",
        ].includes(tag)
      ) {
        return [];
      }
      if (tag === "img") {
        const attributes = attrs(node);
        if (
          !attributes.src ||
          /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(attributes.src)
        ) {
          return [];
        }
        const uri = image(resolvePath(chapterPath, attributes.src));
        return uri ? [{ type: "image", uri, alt: attributes.alt ?? "" }] : [];
      }
      const nested = content(children(node), chapterPath);
      const allowedTag = contentTags.find((value) => value === tag);
      return allowedTag
        ? [{ type: "element", tag: allowedTag, children: nested }]
        : nested;
    });
  }

  const chapters: Book["chapters"] = [];
  for (const reference of elements(children(spine), "itemref")) {
    if (attrs(reference).linear === "no") {
      continue;
    }
    const item = items.get(attrs(reference).idref);
    if (item?.mime !== "application/xhtml+xml") {
      throw new Error("話を読み込めません。");
    }
    const document = xml(item.path);
    const body = elements(document, "body")[0];
    if (!body) {
      throw new Error("話に本文がありません。");
    }
    chapters.push({
      id: item.path,
      title:
        chapterTitles.get(item.path) ??
        (text(elements(children(body), "h1")).trim() ||
          text(elements(document, "title")).trim() ||
          `第${chapters.length + 1}話`),
      content: content(children(body), item.path),
    });
  }
  if (!chapters.length) {
    throw new Error("読める話がありません。");
  }
  const cover = [...items.values()].find((item) =>
    item.properties.includes("cover-image"),
  );
  const series = seriesOf(metadata);
  return {
    id,
    source: "file",
    title,
    ...(series && { series }),
    author: elements(children(metadata), "creator")
      .map((node) => text(children(node)).trim())
      .join("、"),
    cover: cover ? image(cover.path) : undefined,
    chapters,
  };
}
