import type { ContentNode } from "@/features/books/book";

/** 同じ段落の `text` のある範囲に付いたルビの読み。 */
export type RubyAnnotation = {
  start: number;
  length: number;
  reading: string;
};
/**
 * 読み上げられ、ハイライトされ、位置として数えられる単位（仕様: 段落）:
 * 2 つの改行またはブロックの切れ目に挟まれた文章。とても長いものは
 * いくつかに切り、それぞれを 1 つの単位にする。
 */
export type Paragraph = {
  text: string;
  speech: string;
  ruby?: RubyAnnotation[];
};
export type Step = "paragraph" | "chapter";
export type Position = { chapterIndex: number; paragraphIndex: number };
/** 章の表示単位: 段落（インデックスで指す）か、インライン画像。 */
export type Block =
  | {
      kind: "paragraph";
      index: number;
      /** 改行またはブロックの切れ目の直後: 自分のブロックを新しく始める。 */
      startsBlock: boolean;
      /** 見出し（h1–h6）の段落に付く。 */
      heading?: true;
    }
  | { kind: "image"; uri: string; alt: string };
type TextUnit = {
  text: string;
  speech: string;
  /** この単位の `text` の中に位置づけた読み。 */
  ruby?: RubyAnnotation[];
  /** ブロックの境界で: ここで見出しが始まる、または終わる。 */
  heading?: "start" | "end";
};
type Unit = TextUnit | { image: { uri: string; alt: string } };

/**
 * 傍点の記号だけでできたルビ: Web 小説は傍点をルビとして書く（強《・》）。
 * これは読みを与えるのではなく、文字に印を付けるもの。
 */
export function isEmphasisReading(reading: string): boolean {
  return /^[・･﹅﹆•●○◦、]+$/u.test(reading);
}

function plainText(nodes: ContentNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") {
        return node.text;
      }
      return node.type === "element" && node.tag !== "rt" && node.tag !== "rp"
        ? plainText(node.children)
        : "";
    })
    .join("");
}

function* units(nodes: ContentNode[]): Generator<Unit> {
  for (const node of nodes) {
    if (node.type === "image") {
      yield { image: { uri: node.uri, alt: node.alt } };
    } else if (node.type === "text") {
      for (const character of node.text) {
        yield { text: character, speech: character };
      }
    } else if (node.type === "element") {
      if (node.tag === "rt" || node.tag === "rp") {
        continue;
      }
      if (node.tag === "ruby") {
        let text = "";
        let speech = "";
        let pending = "";
        let start = -1;
        const ruby: RubyAnnotation[] = [];
        for (const child of node.children) {
          if (child.type === "element" && child.tag === "rp") {
            continue;
          }
          if (child.type === "element" && child.tag === "rt") {
            if (pending) {
              const reading = plainText(child.children) || pending;
              speech += isEmphasisReading(reading) ? pending : reading;
              ruby.push({ start, length: pending.length, reading });
            }
            pending = "";
            start = -1;
          } else {
            const value = plainText([child]);
            if (value && start < 0) {
              start = text.length;
            }
            text += value;
            pending += value;
          }
        }
        yield { text, speech: speech + pending, ruby };
      } else {
        const block = /^(?:p|div|h[1-6]|blockquote|li|br|hr)$/.test(node.tag);
        const heading = /^h[1-6]$/.test(node.tag);
        if (block) {
          yield {
            text: "\n",
            speech: "\n",
            ...(heading && { heading: "start" as const }),
          };
        }
        yield* units(node.children);
        if (block) {
          yield {
            text: "\n",
            speech: "\n",
            ...(heading && { heading: "end" as const }),
          };
        }
      }
    }
  }
}

interface ParsedChapter {
  paragraphs: Paragraph[];
  blocks: Block[];
}

// 章の内容は一度だけ解析する: プレーヤーは本を開いたときに丸ごと解析し、
// ビューアーは開くたびに表示中の章をもう一度求める。キーは内容の配列で、
// これは置き換えられることはあっても、書き換えられることはない。
const parsed = new WeakMap<ContentNode[], ParsedChapter>();

/** 章の段落とレイアウト用のブロック。結果を書き換えないこと。 */
export function parseChapter(nodes: ContentNode[]): ParsedChapter {
  const known = parsed.get(nodes);
  if (known) {
    return known;
  }
  const result = parseNodes(nodes);
  parsed.set(nodes, result);
  return result;
}

function parseNodes(nodes: ContentNode[]): ParsedChapter {
  const paragraphs: Paragraph[] = [];
  const blocks: Block[] = [];
  let current: Paragraph = { text: "", speech: "" };
  let currentRuby: RubyAnnotation[] = [];
  let boundary = false;
  let heading = false;
  function flush() {
    const trimmed = current.text.replace(/^[^\S　]+/u, "");
    const lead = current.text.length - trimmed.length;
    const paragraph = {
      // 段落の字下げ（U+3000）は表示のために残す。読み上げでは完全に取り除く。
      text: trimmed.trimEnd(),
      speech: current.speech.trim(),
    };
    if (paragraph.text.trim() && paragraph.speech) {
      blocks.push({
        kind: "paragraph",
        index: paragraphs.length,
        startsBlock: boundary && blocks.length > 0,
        ...(heading && { heading: true as const }),
      });
      // オフセットは、切り詰める前にためた文字列の上で取ったもの。ずらす。
      const ruby = currentRuby.flatMap((annotation) =>
        annotation.start >= lead
          ? [{ ...annotation, start: annotation.start - lead }]
          : [],
      );
      paragraphs.push(ruby.length ? { ...paragraph, ruby } : paragraph);
      boundary = false;
    }
    current = { text: "", speech: "" };
    currentRuby = [];
  }
  // 読み上げられ、ハイライトされる単位は段落: 文章は改行とブロックの
  // 切れ目でだけ切り、行の途中では切らない。
  // 読み上げる文字が 1000 を超える段落は、その長さで切っている
  // （音声エンジンが入力に上限を設けている）。必要なら文末で切ること。
  for (const unit of units(nodes)) {
    if ("image" in unit) {
      flush();
      blocks.push({ kind: "image", ...unit.image });
      boundary = true;
      continue;
    }
    if (unit.text === "\n" || unit.text === "\r") {
      flush();
      boundary = true;
      if (unit.heading) {
        heading = unit.heading === "start";
      }
      continue;
    }
    for (const annotation of unit.ruby ?? []) {
      currentRuby.push({
        ...annotation,
        start: current.text.length + annotation.start,
      });
    }
    current.text += unit.text;
    current.speech += unit.speech;
    if (current.speech.length >= 1000) {
      flush();
    }
  }
  flush();
  return { paragraphs, blocks };
}

export function toParagraphs(nodes: ContentNode[]): Paragraph[] {
  return parseChapter(nodes).paragraphs;
}

function length(paragraphs: Paragraph[], end = paragraphs.length): number {
  let total = 0;
  for (let index = 0; index < end; index += 1) {
    total += paragraphs[index].text.length;
  }
  return total;
}

/** 今の段落より前に読んだ文字数。本全体で数える。 */
export function bookProgress(
  chapters: Paragraph[][],
  position: Position,
): { read: number; total: number } {
  let read = 0;
  let total = 0;
  chapters.forEach((paragraphs, chapterIndex) => {
    const size = length(paragraphs);
    total += size;
    if (chapterIndex < position.chapterIndex) {
      read += size;
    } else if (chapterIndex === position.chapterIndex) {
      read += length(paragraphs, position.paragraphIndex);
    }
  });
  return { read, total };
}

/** 今の段落より前に読んだ文字数。1 つの章の中で数える。 */
export function chapterProgress(
  paragraphs: Paragraph[],
  paragraphIndex: number,
): { read: number; total: number } {
  return {
    read: length(paragraphs, paragraphIndex),
    total: length(paragraphs),
  };
}

/** 本の中の指定した文字オフセットを含む段落。 */
export function positionAt(
  chapters: Paragraph[][],
  offset: number,
): Position | null {
  let remaining = offset;
  let last: Position | null = null;
  for (const [chapterIndex, paragraphs] of chapters.entries()) {
    for (const [paragraphIndex, paragraph] of paragraphs.entries()) {
      last = { chapterIndex, paragraphIndex };
      if (remaining < paragraph.text.length) {
        return last;
      }
      remaining -= paragraph.text.length;
    }
  }
  return last;
}

export function movePosition(
  chapters: Paragraph[][],
  position: Position,
  direction: -1 | 1,
  unit: Step = "paragraph",
  // 本文をこれから取得する章にはまだ段落がないが、飛ばしてよい章ではない。
  awaitsText: (chapterIndex: number) => boolean = () => false,
): Position | null {
  if (unit === "chapter") {
    const chapterIndex = position.chapterIndex + direction;
    return chapterIndex >= 0 && chapterIndex < chapters.length
      ? { chapterIndex, paragraphIndex: 0 }
      : null;
  }
  const paragraphIndex = position.paragraphIndex + direction;
  if (
    paragraphIndex >= 0 &&
    paragraphIndex < (chapters[position.chapterIndex]?.length ?? 0)
  ) {
    return { ...position, paragraphIndex };
  }
  for (
    let chapterIndex = position.chapterIndex + direction;
    chapterIndex >= 0 && chapterIndex < chapters.length;
    chapterIndex += direction
  ) {
    if (chapters[chapterIndex].length || awaitsText(chapterIndex)) {
      return {
        chapterIndex,
        paragraphIndex:
          direction === -1 ? Math.max(0, chapters[chapterIndex].length - 1) : 0,
      };
    }
  }
  return null;
}
