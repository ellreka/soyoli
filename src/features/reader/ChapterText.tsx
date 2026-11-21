import { useMemo, useState } from "react";
import { Platform, StyleSheet } from "react-native";

import { Loading } from "@/components/Loading";
import type { Chapter } from "@/features/books/book";
import { parseChapter, type Block } from "@/features/books/paragraphs";
import { useSubscription } from "@/lib/subscription";
import { ChapterList, rowOf, type Row } from "./ChapterList";
import { createRowTaps, type RowLook } from "./ChapterRow";
import { fontSizes, lineHeights, themes, type ReaderPalette } from "./Display";
import { createChapterScroller } from "./chapterScroller";
import type { Reading } from "./reading";
import type { RubyLook } from "./ruby";

const placementFallbackMs = 500;
const rubyScale = 0.5;
const headingScale = 1.2;
const headingLineScale = 1.5;

function groupRows(blocks: readonly Block[]): Row[] {
  const grouped: Row[] = [];
  for (const block of blocks) {
    const previous = grouped.at(-1);
    if (block.kind === "image") {
      grouped.push(block);
    } else if (
      block.startsBlock ||
      previous?.kind !== "text" ||
      previous.heading !== block.heading
    ) {
      grouped.push({
        kind: "text",
        indices: [block.index],
        ...(block.heading && { heading: true as const }),
      });
    } else {
      previous.indices.push(block.index);
    }
  }
  return grouped;
}

function rowLook(
  palette: ReaderPalette,
  fontSize: number,
  lineHeight: number,
): RowLook {
  const ruby = (base: number, line: number): RubyLook => ({
    base,
    line,
    size: Math.round(base * rubyScale),
    color: palette.dimmed,
  });
  const line = Math.round(fontSize * lineHeight);
  const headingSize = Math.round(fontSize * headingScale);
  const headingLine = Math.round(headingSize * headingLineScale);
  return {
    palette,
    text: [styles.text, { color: palette.text, fontSize, lineHeight: line }],
    heading: [
      styles.heading,
      { color: palette.text, fontSize: headingSize, lineHeight: headingLine },
    ],
    ruby: {
      text: ruby(fontSize, line),
      heading: ruby(headingSize, headingLine),
    },
  };
}

function usePlacement(reading: Reading, rows: readonly Row[]) {
  const [placed, setPlaced] = useState(
    () =>
      Platform.OS === "web" ||
      !reading.follows() ||
      rowOf(rows, reading.paragraphIndex()) <= 0,
  );
  const [revealSoon] = useState(() => (): (() => void) => {
    const fallback = setTimeout(() => {
      setPlaced(true);
    }, placementFallbackMs);
    return () => {
      clearTimeout(fallback);
    };
  });
  useSubscription(placed ? null : revealSoon);
  return { placed, setPlaced };
}

function useScroller(
  reading: Reading,
  rows: readonly Row[],
  setPlaced: (placed: boolean) => void,
) {
  const [scroller] = useState(() =>
    createChapterScroller(
      reading.follows() ? rowOf(rows, reading.paragraphIndex()) : -1,
    ),
  );
  const [attachList] = useState(() => scroller.attachList);
  const [onShown] = useState(() => (rowIndex: number): void => {
    if (reading.follows() && scroller.isTarget(rowIndex)) {
      scroller.scrollTo(rowIndex, reading.paragraphIndex());
    }
    requestAnimationFrame(() => {
      setPlaced(true);
    });
  });
  return { scroller, attachList, onShown };
}

interface ChapterTextProps {
  chapter: Chapter;
  reading: Reading;
  fontSize?: number;
  lineHeight?: number;
  palette?: ReaderPalette;
  onSelect: (paragraphIndex: number) => void;
  onPlay?: (paragraphIndex: number) => void;
  onMenu?: (paragraphIndex: number) => void;
}

export function ChapterText({
  chapter,
  reading,
  fontSize = fontSizes.medium,
  lineHeight = lineHeights.normal,
  palette = themes.black,
  onSelect,
  onPlay,
  onMenu,
}: ChapterTextProps) {
  const { paragraphs, blocks } = useMemo(
    () => parseChapter(chapter.content),
    [chapter],
  );
  const rows = useMemo(() => groupRows(blocks), [blocks]);
  const look = useMemo(
    () => rowLook(palette, fontSize, lineHeight),
    [fontSize, lineHeight, palette],
  );
  const { placed, setPlaced } = usePlacement(reading, rows);
  const { scroller, attachList, onShown } = useScroller(
    reading,
    rows,
    setPlaced,
  );
  const [taps] = useState(() => createRowTaps(scroller.paragraphTops));
  taps.listenTo({ onSelect, onPlay, onMenu });

  return (
    <>
      {!placed && (
        <Loading color={palette.text} style={StyleSheet.absoluteFill} />
      )}
      <ChapterList
        title={chapter.title}
        rows={rows}
        placed={placed}
        attachList={attachList}
        paragraphs={paragraphs}
        look={look}
        playsOnDoubleTap={onPlay !== undefined}
        opensMenu={onMenu !== undefined}
        taps={taps}
        scroller={scroller}
        reading={reading}
        onShown={onShown}
      />
    </>
  );
}

const styles = StyleSheet.create({
  text: {
    fontWeight: "400",
    fontSize: 17,
    lineHeight: 33,
  },
  heading: { fontWeight: "600", paddingVertical: 8 },
});
