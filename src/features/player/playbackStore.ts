import type { SetStateAction } from "react";

import type { Book } from "@/features/books/book";
import { toParagraphs } from "@/features/books/paragraphs";
import { isTocMarker } from "@/features/web/episode";
import { createStore, type Store } from "@/lib/store";
import type { Subscription } from "@/lib/subscription";
import { showNowPlaying, showPlaying } from "./MediaSession";
import {
  nothingOpen,
  restorePosition,
  type PlaybackState,
} from "./playbackState";
import { initialSettings, type PlaybackSettings } from "./settings";
import {
  savePlayback,
  savedPositions,
  type SavedPlayback,
  type SavedPosition,
} from "./storage";

export interface Playing {
  state: PlaybackState;
  settings: PlaybackSettings;
}

export interface PlaybackStore extends Store<Playing> {
  positions: () => Record<string, SavedPosition>;
  setState: (action: SetStateAction<PlaybackState>) => void;
  setSettings: (
    change: (current: PlaybackSettings) => PlaybackSettings,
  ) => void;
  keepSaving: Subscription;
}

const saveDelayMs = 1000;

function rememberPosition(
  positions: Record<string, SavedPosition>,
  state: PlaybackState,
): void {
  const chapter = state.book?.chapters[state.chapterIndex];
  if (!state.book || !chapter) {
    return;
  }
  const known = positions[state.book.id];
  const awaitingParagraphs = !state.chapters[state.chapterIndex]?.length;
  if (known?.chapterId === chapter.id && awaitingParagraphs) {
    return;
  }
  positions[state.book.id] = {
    chapterId: chapter.id,
    paragraphIndex: state.paragraphIndex,
  };
}

function movesPosition(next: PlaybackState, previous: PlaybackState): boolean {
  return (
    next.book !== previous.book ||
    next.chapters !== previous.chapters ||
    next.chapterIndex !== previous.chapterIndex ||
    next.paragraphIndex !== previous.paragraphIndex
  );
}

function chapterRead(
  state: PlaybackState,
): { bookId: string; chapterId: string } | null {
  const chapter = state.book?.chapters[state.chapterIndex];
  if (!state.book || !chapter?.url || isTocMarker(chapter)) {
    return null;
  }
  return { bookId: state.book.id, chapterId: chapter.id };
}

function turnsChapter(next: PlaybackState, previous: PlaybackState): boolean {
  return (
    next.book !== previous.book || next.chapterIndex !== previous.chapterIndex
  );
}

function showOnLockScreen(next: PlaybackState, previous: PlaybackState): void {
  const { book } = next;
  if (!book) {
    return;
  }
  if (turnsChapter(next, previous)) {
    showNowPlaying(book, book.chapters[next.chapterIndex]?.title ?? undefined);
  }
  if (book !== previous.book || next.playing !== previous.playing) {
    showPlaying(next.playing);
  }
}

function changesSaved(next: Playing, previous: Playing): boolean {
  return (
    next.settings !== previous.settings ||
    next.state.book !== previous.state.book ||
    next.state.chapterIndex !== previous.state.chapterIndex ||
    next.state.paragraphIndex !== previous.state.paragraphIndex
  );
}

function openedAtStart(
  book: Book | undefined,
  positions: Record<string, SavedPosition>,
  saved: SavedPlayback | null,
): PlaybackState {
  if (!book) {
    return nothingOpen;
  }
  const chapters = book.chapters.map((chapter) =>
    toParagraphs(chapter.content),
  );
  return {
    ...nothingOpen,
    book,
    chapters,
    ...restorePosition(book, chapters, positions[book.id], saved),
  };
}

export function createPlaybackStore(
  saved: SavedPlayback | null,
  markRead: (bookId: string, chapterId: string) => void,
  lastBook?: Book,
): PlaybackStore {
  const positions = savedPositions(saved);
  const pending: { save?: ReturnType<typeof setTimeout> } = {};

  function scheduleSave(playing: Playing): void {
    clearTimeout(pending.save);
    pending.save = setTimeout(() => {
      savePlayback({
        bookId: playing.state.book?.id ?? null,
        chapterIndex: playing.state.chapterIndex,
        paragraphIndex: playing.state.paragraphIndex,
        positions,
        ...playing.settings,
      });
    }, saveDelayMs);
  }

  const store = createStore<Playing>(
    {
      state: openedAtStart(lastBook, positions, saved),
      settings: initialSettings(saved),
    },
    (next, previous) => {
      showOnLockScreen(next.state, previous.state);
      if (movesPosition(next.state, previous.state)) {
        rememberPosition(positions, next.state);
      }
      if (changesSaved(next, previous)) {
        scheduleSave(next);
      }
      const read = turnsChapter(next.state, previous.state)
        ? chapterRead(next.state)
        : null;
      if (read) {
        markRead(read.bookId, read.chapterId);
      }
    },
  );
  return {
    ...store,
    positions: () => positions,
    keepSaving: () => () => {
      clearTimeout(pending.save);
    },
    setState(action) {
      store.update((current) => ({
        ...current,
        state: typeof action === "function" ? action(current.state) : action,
      }));
    },
    setSettings(change) {
      store.update((current) => ({
        ...current,
        settings: change(current.settings),
      }));
    },
  };
}
