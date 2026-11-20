import { useState } from "react";

import type { Book } from "@/features/books/book";
import type { Step } from "@/features/books/paragraphs";
import { useLibrary } from "@/features/library/Library";
import { usePlayback } from "@/features/player/Playback";
import type { PlaybackState } from "@/features/player/playbackState";
import type { Playing } from "@/features/player/playbackStore";
import type { PlaybackSettings } from "@/features/player/settings";

export interface PlayerNow {
  state: PlaybackState;
  settings: PlaybackSettings;
  pause: () => void;
  step: (direction: -1 | 1, unit?: Step) => void;
  seekChapter: (index: number) => void;
  closeBook: (bookId: string) => void;
}

export interface OpenBook {
  current: () => Book | null;
  playback: () => PlayerNow;
  source: {
    get: () => Playing;
    subscribe: (listener: () => void) => () => void;
  };
  replace: (book: Book) => void;
  loadFile: (bookId: string) => Promise<Book>;
}

export function useOpenBook(): OpenBook {
  const { source, pause, step, seekChapter, closeBook, openBook } =
    usePlayback();
  const { addBook, loadFile } = useLibrary();
  const [open] = useState<OpenBook>(() => ({
    current: () => source.get().state.book,
    playback: () => ({ ...source.get(), pause, step, seekChapter, closeBook }),
    source,
    replace(book) {
      addBook(book);
      openBook(book);
    },
    loadFile,
  }));
  return open;
}
