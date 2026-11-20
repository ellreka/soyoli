import type { ContentNode } from "./book";

const pageNumber =
  /^[\s\-–—‐・]*(?:p\.?\s*)?\d{1,5}(?:\s*\/\s*\d{1,5})?[\s\-–—‐・]*$/i;
const closes = /[。．.！？!?」』）)】…―—]$/;
const opens = /^[「『（(【]/;
const indented = /^(?:\u3000|\t| {2,})/;
const latin = /[A-Za-z0-9,;:]$/;
const latinStart = /^[A-Za-z0-9]/;

function linesOf(page: string): string[] {
  return page
    .split(/\r\n|[\n\r\f\u2028\u2029]/)
    .map((line) => line.replace(/\s+$/, ""))
    .filter((line) => line.trim().length > 0);
}

function shape(line: string): string {
  return line.trim().replace(/\d+/g, "#");
}

function dropRepeated(pages: string[][], edge: "first" | "last"): string[][] {
  if (pages.length < 3) {
    return pages;
  }
  const pick = (lines: string[]) =>
    edge === "first" ? lines[0] : lines[lines.length - 1];
  const counts = new Map<string, number>();
  for (const lines of pages) {
    const line = pick(lines);
    if (line !== undefined && line.trim().length <= 40) {
      counts.set(shape(line), (counts.get(shape(line)) ?? 0) + 1);
    }
  }
  return pages.map((lines) => {
    const line = pick(lines);
    if (
      line === undefined ||
      (counts.get(shape(line)) ?? 0) < Math.ceil(pages.length / 2)
    ) {
      return lines;
    }
    return edge === "first" ? lines.slice(1) : lines.slice(0, -1);
  });
}

function dropPageNumbers(lines: string[]): string[] {
  const start = lines.length > 0 && pageNumber.test(lines[0]) ? 1 : 0;
  const end =
    lines.length > start && pageNumber.test(lines[lines.length - 1])
      ? lines.length - 1
      : lines.length;
  return lines.slice(start, end);
}

function widthOf(line: string): number {
  let width = 0;
  for (const character of line.trim()) {
    const code = character.codePointAt(0) ?? 0;
    width += code <= 0xff || (code >= 0xff61 && code <= 0xff9f) ? 1 : 2;
  }
  return width;
}

function fullWidth(lines: string[]): number {
  const widths = lines.map(widthOf).sort((x, y) => x - y);
  return widths[Math.floor((widths.length - 1) * 0.9)] ?? 0;
}

export function pdfParagraphs(pages: string[]): string[] {
  const cleaned = dropRepeated(
    dropRepeated(pages.map(linesOf).map(dropPageNumbers), "first"),
    "last",
  ).map(dropPageNumbers);
  const lines = cleaned.flat();
  const width = fullWidth(lines);
  const paragraphs: string[] = [];
  let previous: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    const last: string | null = previous;
    previous = line;
    const begins =
      last === null ||
      indented.test(raw) ||
      widthOf(last) < width * 0.6 ||
      (closes.test(last) && (widthOf(last) < width * 0.85 || opens.test(line)));
    if (begins) {
      paragraphs.push(line);
    } else {
      const gap = latin.test(last ?? "") && latinStart.test(line) ? " " : "";
      paragraphs[paragraphs.length - 1] += gap + line;
    }
  }
  return paragraphs;
}

export function pdfContent(pages: string[]): ContentNode[] {
  return pdfParagraphs(pages).map((text) => ({
    type: "element",
    tag: "p",
    children: [{ type: "text", text }],
  }));
}
