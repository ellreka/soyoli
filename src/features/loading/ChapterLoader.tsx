import { createContext, useContext, useState, type ReactNode } from "react";

import { isTocMarker, tocUrlOf, workIdOf } from "@/features/web/episode";
import { usePlayback } from "@/features/player/Playback";
import { useSubscription } from "@/lib/subscription";
import { createChapterFetching } from "./chapterFetching";
import { useOpenBook } from "./useOpenBook";

interface ChapterLoader {
  failedChapter: string | null;
  expandToc: (url: string) => void;
  reload: () => void;
}

const ChapterLoaderContext = createContext<ChapterLoader | null>(null);

export function ChapterLoaderProvider({ children }: { children: ReactNode }) {
  const { state } = usePlayback();
  const open = useOpenBook();
  const [failedChapter, setFailedChapter] = useState<string | null>(null);
  const [fetching] = useState(() =>
    createChapterFetching(open, setFailedChapter),
  );
  useSubscription(fetching.watch);
  const book = state.book;
  const chapter = book?.chapters[state.chapterIndex];

  function reload(): void {
    if (!book || !chapter?.url || isTocMarker(chapter)) {
      return;
    }
    setFailedChapter(null);
    fetching.retry();
    if (chapter.content.length > 0) {
      open.replace({
        ...book,
        chapters: book.chapters.map((item) =>
          item.id === chapter.id ? { ...item, content: [] } : item,
        ),
      });
    }
    const toc = tocUrlOf(chapter.url, workIdOf(book));
    if (toc) {
      fetching.expandToc(toc);
    }
  }

  return (
    <ChapterLoaderContext
      value={{ failedChapter, expandToc: fetching.expandToc, reload }}
    >
      {children}
    </ChapterLoaderContext>
  );
}

export function useChapterLoader(): ChapterLoader {
  const loader = useContext(ChapterLoaderContext);
  if (!loader) {
    throw new Error("ChapterLoaderProviderが必要です。");
  }
  return loader;
}
