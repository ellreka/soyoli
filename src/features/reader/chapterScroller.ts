import { Platform } from "react-native";

interface ScrollableList {
  scrollToIndex: (params: {
    index: number;
    viewPosition?: number;
    viewOffset?: number;
    animated?: boolean;
  }) => void;
  scrollToOffset: (params: { offset: number; animated?: boolean }) => void;
}

const slideMs = 150;
const readingLine = 0.3;
const retryMs = 100;
const maxRetries = 30;

export type ParagraphAttach = (element: object | null) => (() => void) | void;

export interface ChapterScroller {
  attachList: (list: ScrollableList | null) => void;
  track: ParagraphAttach;
  refFor: (paragraph: number, row: number) => ParagraphAttach;
  isTarget: (row: number) => boolean;
  scrollTo: (row: number, paragraph: number, animated?: boolean) => void;
  retryLater: (row: number, retry: () => void) => void;
  stop: () => void;
  setViewportHeight: (height: number) => void;
  setOffset: (offset: number) => void;
  setRowTop: (row: number, top: number) => void;
  paragraphTops: Map<number, number>;
}

function easeOut(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

export function createChapterScroller(initialTarget: number): ChapterScroller {
  const rowTops = new Map<number, number>();
  const paragraphTops = new Map<number, number>();
  const scroll: {
    list: ScrollableList | null;
    paragraph: object | null;
    target: number;
    retries: number;
    retry?: ReturnType<typeof setTimeout>;
    slide?: number;
    offset: number;
    viewportHeight: number;
  } = {
    list: null,
    paragraph: null,
    target: initialTarget,
    retries: 0,
    offset: 0,
    viewportHeight: 0,
  };

  function scrollIntoViewOnWeb(): boolean {
    // SAFETY: Web では ref が描画された <span> 要素を持つので、そこでは
    // DOM の型が本物。ネイティブはこの分岐に入らない。
    const element = scroll.paragraph as HTMLElement | null;
    if (!element?.scrollIntoView) {
      return false;
    }
    element.scrollIntoView({ block: "nearest", behavior: "instant" });
    return true;
  }

  function slideTo(to: number): void {
    const from = scroll.offset;
    const start = performance.now();
    const frame = () => {
      const progress = Math.min(1, (performance.now() - start) / slideMs);
      const y = from + (to - from) * easeOut(progress);
      scroll.offset = y;
      scroll.list?.scrollToOffset({ offset: y, animated: false });
      scroll.slide = progress < 1 ? requestAnimationFrame(frame) : undefined;
    };
    scroll.slide = requestAnimationFrame(frame);
  }

  function scrollTo(row: number, paragraph: number, animated = false): void {
    if (Platform.OS === "web" && scrollIntoViewOnWeb()) {
      return;
    }
    if (row < 0) {
      return;
    }
    cancelAnimationFrame(scroll.slide ?? 0);
    scroll.slide = undefined;
    const rowTop = rowTops.get(row);
    const paragraphTop = paragraphTops.get(paragraph) ?? 0;
    const line = scroll.viewportHeight * readingLine;
    if (animated && rowTop !== undefined) {
      slideTo(Math.max(0, rowTop + paragraphTop - line));
      return;
    }
    scroll.list?.scrollToIndex({
      index: row,
      viewPosition: 0,
      viewOffset: line - paragraphTop,
      animated: false,
    });
  }

  function stop(): void {
    scroll.target = -1;
    clearTimeout(scroll.retry);
    cancelAnimationFrame(scroll.slide ?? 0);
  }

  function track(element: object | null): void {
    scroll.paragraph = element;
  }

  const followers = new Map<number, ParagraphAttach>();
  function follow(row: number, paragraph: number): ParagraphAttach {
    return (element) => {
      scroll.paragraph = element;
      scroll.target = row;
      scroll.retries = 0;
      scrollTo(row, paragraph, true);
      return () => {
        scroll.paragraph = null;
        stop();
      };
    };
  }

  function retryLater(row: number, retry: () => void): void {
    if (scroll.target !== row) {
      return;
    }
    clearTimeout(scroll.retry);
    scroll.retry = setTimeout(() => {
      scroll.retry = undefined;
      if (scroll.target === row && scroll.retries < maxRetries) {
        scroll.retries += 1;
        retry();
      }
    }, retryMs);
  }

  return {
    attachList(list) {
      scroll.list = list;
    },
    track,
    refFor(paragraph, row) {
      const known = followers.get(paragraph);
      if (known) {
        return known;
      }
      const created = follow(row, paragraph);
      followers.set(paragraph, created);
      return created;
    },
    isTarget: (row) => scroll.target === row,
    scrollTo,
    retryLater,
    stop,
    setViewportHeight(height) {
      scroll.viewportHeight = height;
    },
    setOffset(offset) {
      scroll.offset = offset;
    },
    setRowTop(row, top) {
      rowTops.set(row, top);
    },
    paragraphTops,
  };
}
