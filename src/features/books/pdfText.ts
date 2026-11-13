import type { ContentNode } from "./book";

/**
 * ページ番号だけの行: "12"、"- 12 -"、"p. 12"、"12 / 240"。
 */
const pageNumber =
  /^[\s\-–—‐・]*(?:p\.?\s*)?\d{1,5}(?:\s*\/\s*\d{1,5})?[\s\-–—‐・]*$/i;
/** 文を終える行の終わり方。 */
const closes = /[。．.！？!?」』）)】…―—]$/;
/** 会話や引用の段落の始まり方。 */
const opens = /^[「『（(【]/;
/** 行頭の字下げ: 全角スペース、タブ、または 2 つ以上のスペース。 */
const indented = /^(?:\u3000|\t| {2,})/;
const latin = /[A-Za-z0-9,;:]$/;
const latinStart = /^[A-Za-z0-9]/;

function linesOf(page: string): string[] {
  return page
    .split(/\r\n|[\n\r\f\u2028\u2029]/)
    .map((line) => line.replace(/\s+$/, ""))
    .filter((line) => line.trim().length > 0);
}

/** 数字を取り除く。"書名 12" と "書名 13" が同じ柱になるようにするため。 */
function shape(line: string): string {
  return line.trim().replace(/\d+/g, "#");
}

/**
 * 柱（ヘッダー・フッター）を落とす: ページの最初（または最後）の行で、
 * ページ番号を除いて同じものが半分以上のページにあるとき。3 ページ以上
 * あるときだけ判定する。長い行は柱ではなく本文。
 */
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

/**
 * 行が組まれる幅を、半角の文字数で数えたもの: 漢字やかなは英字 2 つ分の
 * 場所を取る。行は文字数ではなくこれで比べる。英字の行や点線リーダーの行が、
 * 日本語で埋まった行の倍の長さだと見なされないようにするため。
 */
function widthOf(line: string): number {
  let width = 0;
  for (const character of line.trim()) {
    const code = character.codePointAt(0) ?? 0;
    // Latin-1 と半角カタカナは狭く、それ以外は広く組まれる。
    width += code <= 0xff || (code >= 0xff61 && code <= 0xff9f) ? 1 : 2;
  }
  return width;
}

/** 埋まった行の多くが持つ幅: 行が「短い」かどうかの基準。 */
function fullWidth(lines: string[]): number {
  const widths = lines.map(widthOf).sort((x, y) => x - y);
  return widths[Math.floor((widths.length - 1) * 0.9)] ?? 0;
}

/**
 * PDF の何ページか分の段落。プラットフォームが返す各ページの文字 — ページに
 * 組まれたとおりの行 — から作る。ページ番号と柱は取り除き、ページの幅で
 * 折り返された行は、ページの切れ目をまたぐものも含めてつなぎ直す。
 *
 * 手がかりは文字だけ（位置もフォントサイズもない）なので、ルビは
 * 本文に混ざったままになり、段組みや表はプラットフォームが読む順に出てくる。
 * ネイティブ側から位置をもらえば、どちらも直せる。
 */
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
    // 段落が終わるのは、短く切れた行か、文の終わりで次の行が段落らしく
    // 始まるところ。
    const begins =
      last === null ||
      indented.test(raw) ||
      widthOf(last) < width * 0.6 ||
      (closes.test(last) && (widthOf(last) < width * 0.85 || opens.test(line)));
    if (begins) {
      paragraphs.push(line);
    } else {
      // 日本語は空白なしで折り返す。英字の単語には空白が要る。
      const gap = latin.test(last ?? "") && latinStart.test(line) ? " " : "";
      paragraphs[paragraphs.length - 1] += gap + line;
    }
  }
  return paragraphs;
}

/** ページを章の内容にする: 段落ごとに `p` が 1 つ。 */
export function pdfContent(pages: string[]): ContentNode[] {
  return pdfParagraphs(pages).map((text) => ({
    type: "element",
    tag: "p",
    children: [{ type: "text", text }],
  }));
}
