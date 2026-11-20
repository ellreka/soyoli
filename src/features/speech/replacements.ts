import { isEmphasisReading, type Paragraph } from "@/features/books/paragraphs";
import {
  buildPattern,
  type DictionaryEntry,
} from "@/features/dictionary/entries";

export interface Replacement {
  start: number;
  end: number;
  reading: string;
}

const patterns = new Map<string, RegExp | null>();

function compile(source: string, multiline: boolean): RegExp | null {
  const flags = multiline ? "muy" : "uy";
  const key = `${flags}/${source}`;
  let pattern = patterns.get(key);
  if (pattern === undefined) {
    const built = buildPattern(source, flags);
    pattern = built instanceof Error ? null : built;
    patterns.set(key, pattern);
  }
  return pattern;
}

export function expandReading(reading: string, match: RegExpExecArray): string {
  return reading.replace(
    /\$(?:(\$)|(&)|(\d\d?)|<([^>]*)>)/g,
    (whole, dollar?: string, all?: string, digits?: string, name?: string) => {
      if (dollar) {
        return "$";
      }
      if (all) {
        return match[0];
      }
      if (digits !== undefined) {
        const two = Number(digits);
        if (two > 0 && two < match.length) {
          return match[two] ?? "";
        }
        const one = Number(digits[0]);
        if (digits.length === 2 && one > 0 && one < match.length) {
          return (match[one] ?? "") + digits.slice(1);
        }
        return whole;
      }
      const groups = match.groups;
      return groups && name !== undefined && name in groups
        ? (groups[name] ?? "")
        : whole;
    },
  );
}

function matchAt(
  entry: DictionaryEntry,
  text: string,
  index: number,
): Replacement | null {
  if (entry.off) {
    return null;
  }
  if (!entry.regex) {
    return text.startsWith(entry.surface, index)
      ? {
          start: index,
          end: index + entry.surface.length,
          reading: entry.reading,
        }
      : null;
  }
  const pattern = compile(entry.surface, entry.multiline === true);
  if (!pattern) {
    return null;
  }
  pattern.lastIndex = index;
  const match = pattern.exec(text);
  if (!match || match[0].length === 0) {
    return null;
  }
  return {
    start: index,
    end: index + match[0].length,
    reading: expandReading(entry.reading, match),
  };
}

function replacer(text: string) {
  const taken = Array.from({ length: text.length }, () => false);
  const replacements: Replacement[] = [];
  function free(start: number, end: number): boolean {
    for (let index = start; index < end; index += 1) {
      if (taken[index]) {
        return false;
      }
    }
    return true;
  }
  function take(start: number, end: number, reading: string): void {
    taken.fill(true, start, end);
    replacements.push({ start, end, reading });
  }
  function apply(
    entries: readonly DictionaryEntry[],
    multiline: boolean,
  ): void {
    const rules = entries.filter(
      (entry) => !entry.off && Boolean(entry.multiline) === multiline,
    );
    if (!rules.length) {
      return;
    }
    for (let index = 0; index < text.length; index += 1) {
      if (taken[index]) {
        continue;
      }
      let best: Replacement | null = null;
      for (const entry of rules) {
        const found = matchAt(entry, text, index);
        if (
          found &&
          (!best || found.end > best.end) &&
          free(index, found.end)
        ) {
          best = found;
        }
      }
      if (best) {
        take(best.start, best.end, best.reading);
        index = best.end - 1;
      }
    }
  }
  return { replacements, free, take, apply };
}

function spansParagraphs(entries: readonly DictionaryEntry[]): boolean {
  return entries.some((entry) => entry.multiline && !entry.off);
}

let lastChapter: {
  paragraphs: readonly Paragraph[];
  bookEntries: readonly DictionaryEntry[];
  commonEntries: readonly DictionaryEntry[];
  result: readonly (readonly Replacement[])[];
} | null = null;

export function chapterReplacements(
  paragraphs: readonly Paragraph[],
  bookEntries: readonly DictionaryEntry[],
  commonEntries: readonly DictionaryEntry[],
): readonly (readonly Replacement[])[] | null {
  if (!spansParagraphs(bookEntries) && !spansParagraphs(commonEntries)) {
    return null;
  }
  if (
    lastChapter?.paragraphs === paragraphs &&
    lastChapter.bookEntries === bookEntries &&
    lastChapter.commonEntries === commonEntries
  ) {
    return lastChapter.result;
  }
  const chapter = replacer(
    paragraphs.map((paragraph) => paragraph.text).join("\n"),
  );
  chapter.apply(bookEntries, true);
  chapter.apply(commonEntries, true);
  const result: Replacement[][] = paragraphs.map(() => []);
  const found = chapter.replacements.sort((a, b) => a.start - b.start);
  let cursor = 0;
  let offset = 0;
  for (const [index, paragraph] of paragraphs.entries()) {
    const end = offset + paragraph.text.length;
    while (cursor < found.length && found[cursor].start < end) {
      const item = found[cursor];
      const start = Math.max(item.start, offset);
      if (Math.min(item.end, end) > start) {
        result[index].push({
          start: start - offset,
          end: Math.min(item.end, end) - offset,
          reading: item.start >= offset - 1 ? item.reading : "",
        });
      }
      if (item.end > end) {
        break;
      }
      cursor += 1;
    }
    offset = end + 1;
  }
  lastChapter = { paragraphs, bookEntries, commonEntries, result };
  return result;
}

export function speechFor(
  paragraph: Paragraph,
  bookEntries: readonly DictionaryEntry[],
  commonEntries: readonly DictionaryEntry[],
  systemEntries: readonly DictionaryEntry[] = [],
  fixed: readonly Replacement[] = [],
): string {
  if (
    !bookEntries.length &&
    !commonEntries.length &&
    !systemEntries.length &&
    !fixed.length
  ) {
    return paragraph.speech;
  }
  const text = paragraph.text;
  let speech = "";
  let cursor = 0;
  for (const item of paragraphReplacements(
    paragraph,
    bookEntries,
    commonEntries,
    systemEntries,
    fixed,
  )) {
    speech += text.slice(cursor, item.start) + item.reading;
    cursor = item.end;
  }
  return (speech + text.slice(cursor)).trim();
}

export function paragraphReplacements(
  paragraph: Paragraph,
  bookEntries: readonly DictionaryEntry[],
  commonEntries: readonly DictionaryEntry[],
  systemEntries: readonly DictionaryEntry[],
  fixed: readonly Replacement[],
): Replacement[] {
  const { replacements, free, take, apply } = replacer(paragraph.text);
  for (const item of fixed) {
    take(item.start, item.end, item.reading);
  }
  apply(bookEntries, false);
  for (const annotation of paragraph.ruby ?? []) {
    const end = annotation.start + annotation.length;
    if (!isEmphasisReading(annotation.reading) && free(annotation.start, end)) {
      take(annotation.start, end, annotation.reading);
    }
  }
  apply(commonEntries, false);
  apply(systemEntries, false);
  return replacements.sort((a, b) => a.start - b.start);
}
