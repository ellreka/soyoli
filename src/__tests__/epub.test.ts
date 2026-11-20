import { strToU8, zipSync } from "fflate";

import { parseEpub } from "@/features/books/epub";
import type { Chapter } from "@/features/books/book";
import { parseChapter } from "@/features/books/paragraphs";

function rendered(chapter: Chapter) {
  const { paragraphs, blocks } = parseChapter(chapter.content);
  return {
    text: paragraphs.map((paragraph) => paragraph.text).join(""),
    speech: paragraphs.map((paragraph) => paragraph.speech).join(""),
    images: blocks.flatMap((block) => (block.kind === "image" ? [block] : [])),
  };
}

function fixture(overrides: Record<string, string> = {}) {
  const entries: Record<string, string> = {
    mimetype: "application/epub+zip",
    "META-INF/container.xml":
      '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>',
    "OPS/book.opf": `<package xmlns:dc="urn:dc"><metadata><dc:title>テスト本</dc:title><dc:creator>著者</dc:creator></metadata>
      <manifest><item id="second" href="second.xhtml" media-type="application/xhtml+xml"/>
      <item id="first" href="text/first.xhtml" media-type="application/xhtml+xml"/>
      <item id="image" href="images/picture.png" media-type="image/png"/></manifest>
      <spine><itemref idref="first"/><itemref idref="second"/></spine></package>`,
    "OPS/text/first.xhtml": `<html><head><title>最初の章</title></head><body><p>前の文。<ruby>漢字<rt>かんじ</rt></ruby>次の文。</p>
      <img src="../images/picture.png" alt="挿絵"/></body></html>`,
    "OPS/second.xhtml":
      "<html><body><h1>次の章</h1><p>おしまい。</p></body></html>",
    "OPS/images/picture.png": "test-image",
    ...overrides,
  };
  return zipSync(
    Object.fromEntries(
      Object.entries(entries).map(([path, value]) => [path, strToU8(value)]),
    ),
  );
}

it("keeps mixed text, ruby and relative images while following spine rather than manifest order", () => {
  const book = parseEpub(fixture(), "fixture");
  expect(book.chapters.map((chapter) => chapter.title)).toEqual([
    "最初の章",
    "次の章",
  ]);
  const chapter = rendered(book.chapters[0]);
  expect(chapter.text).toBe("前の文。漢字次の文。");
  expect(chapter.speech).toBe("前の文。かんじ次の文。");
  expect(chapter.images).toEqual([
    {
      kind: "image",
      uri: expect.stringMatching(/^data:image\/png;base64,/),
      alt: "挿絵",
    },
  ]);
});

it("reads the series a file names itself, and guesses none from its title", () => {
  const opf = (metadata: string) => ({
    "OPS/book.opf": `<package xmlns:dc="urn:dc"><metadata><dc:title>テスト本 2</dc:title>${metadata}</metadata>
      <manifest><item id="first" href="text/first.xhtml" media-type="application/xhtml+xml"/></manifest>
      <spine><itemref idref="first"/></spine></package>`,
  });
  const series = (metadata: string) =>
    parseEpub(fixture(opf(metadata)), "fixture").series;
  expect(series("")).toBeUndefined();
  expect(
    series(
      '<meta property="belongs-to-collection" id="c1">銀河の旅</meta><meta refines="#c1" property="collection-type">series</meta><meta refines="#c1" property="group-position">2</meta>',
    ),
  ).toEqual({ name: "銀河の旅", position: 2 });
  expect(
    series('<meta property="belongs-to-collection">銀河の旅</meta>'),
  ).toEqual({ name: "銀河の旅" });
  expect(
    series(
      '<meta property="belongs-to-collection" id="c1">全集</meta><meta refines="#c1" property="collection-type">set</meta>',
    ),
  ).toBeUndefined();
  expect(
    series(
      '<meta name="calibre:series" content="銀河の旅"/><meta name="calibre:series_index" content="3.0"/>',
    ),
  ).toEqual({ name: "銀河の旅", position: 3 });
});

it("drops executable content, publisher styles, external images and navigation", () => {
  const book = parseEpub(
    fixture({
      "OPS/text/first.xhtml": `<html><body><script>alert(1)</script><iframe src="https://example.com"/>
      <p style="background:url(https://example.com)" onclick="alert(1)">&lt;script&gt; &amp; 本文</p>
      <img src="https://example.com/tracker.png"/><a href="javascript:alert(1)">リンク文字</a></body></html>`,
    }),
    "fixture",
  );
  const chapter = rendered(book.chapters[0]);
  expect(chapter.text).toBe("<script> & 本文リンク文字");
  expect(chapter.text).not.toMatch(/alert\(1\)|example\.com/);
  expect(chapter.images).toEqual([]);
});

it.each<Record<string, string>>([
  { "../outside": "bad" },
  {
    "META-INF/container.xml":
      '<container><rootfile full-path="../outside.opf"/></container>',
  },
  {
    "OPS/text/first.xhtml":
      '<!DOCTYPE html [<!ENTITY x "bad">]><html><body>&x;</body></html>',
  },
  { mimetype: "not-an-epub" },
  { "META-INF/encryption.xml": "encrypted" },
  { "OPS/text/first.xhtml": "<html><body><p>broken</body></html>" },
])("rejects invalid or unsupported EPUB input %#", (overrides) => {
  expect(() => parseEpub(fixture(overrides), "bad")).toThrow();
});

it("rejects oversized archives and excessive entry counts", () => {
  expect(() =>
    parseEpub(new Uint8Array(32 * 1024 * 1024 + 1), "large"),
  ).toThrow("32 MB");
  const entries = Object.fromEntries(
    Array.from({ length: 513 }, (_, index) => [
      `file${index}`,
      new Uint8Array(),
    ]),
  );
  expect(() => parseEpub(zipSync(entries), "many")).toThrow("上限");
  expect(() => parseEpub(new Uint8Array([1, 2, 3]), "corrupt")).toThrow();
});
