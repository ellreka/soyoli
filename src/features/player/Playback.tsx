import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
  type SetStateAction,
} from "react";

import { awaitsText, type Book } from "@/features/books/book";
import {
  movePosition,
  toParagraphs,
  type Position,
  type Step,
} from "@/features/books/paragraphs";
import { useDictionary } from "@/features/dictionary/Dictionary";
import type { BracketId, BracketVoice } from "@/features/speech/brackets";
import { moveToSpoken } from "@/features/speech/spoken";
import { isPitch, isRate } from "@/features/speech/voiceLimits";
import { mediaControls } from "./MediaSession";
import { useSubscription } from "@/lib/subscription";
import { useKeepAwake } from "./playbackEffects";
import { createPlaybackStore } from "./playbackStore";
import {
  keepPosition,
  restorePosition,
  type PlaybackState,
} from "./playbackState";
import type { PlaybackSettings } from "./settings";
import { loadPlayback, type SavedPosition } from "./storage";
import { useStore } from "@/lib/store";
import { useGeneration } from "./useGeneration";
import { usePreview } from "./usePreview";
import { useReadAloud } from "./useReadAloud";
import { useSleepTimer } from "./useSleepTimer";
import { useVoices } from "./useVoices";

function usePlaybackState(onChapterRead: ChapterRead, findBook: FindBook) {
  const [saved] = useState(loadPlayback);
  const [{ state, settings }, , store] = useStore(() =>
    createPlaybackStore(
      saved,
      onChapterRead,
      saved?.bookId ? findBook(saved.bookId) : undefined,
    ),
  );
  const { setState, setSettings } = store;
  useSubscription(store.keepSaving);
  const [error, setError] = useState<string | null>(null);
  const { voices, voiceLoading, voiceError, loadVoices } = useVoices();
  const { dictionary, current: currentDictionary } = useDictionary();

  const generation = useGeneration();
  const { preview, previewError, setPreviewError, startPreview, stopPreview } =
    usePreview(generation.begin);
  const interrupt = useCallback(() => {
    stopPreview();
    // WORKAROUND: React が変更をコミットするまでの間に、エンジンが古い発話についてコールバックしてくることがある。世代は今すぐ進める。
    generation.begin();
  }, [stopPreview, generation]);
  const change = useCallback(
    (update: SetStateAction<PlaybackState>) => {
      interrupt();
      setState(update);
    },
    [interrupt, setState],
  );

  const { timer, setSleepTimer, timerNow } = useSleepTimer(state.playing);
  const positionsOf = store.positions;
  useKeepAwake(settings.keepAwake && state.playing);
  useReadAloud({
    state,
    settings,
    preview,
    generation,
    latest: {
      rules: currentDictionary,
      timer: timerNow,
      autoNext: () => store.get().settings.autoNext,
      pageSound: () => store.get().settings.pageSound,
    },
    change,
    setSleepTimer,
    stopPreview,
    setError,
    setPreviewError,
  });

  const openBook = useCallback(
    (book: Book, at?: { chapterId: string }) => {
      setError(null);
      const opened = store.get().state;
      if (opened.book === book && !at) {
        return;
      }
      const chapters = book.chapters.map((chapter) =>
        toParagraphs(chapter.content),
      );
      const left = positionsOf()[book.id];
      const wanted =
        at && left?.chapterId !== at.chapterId
          ? { chapterId: at.chapterId, paragraphIndex: 0 }
          : left;
      if (opened.book?.id === book.id && opened.chapters.length > 0) {
        change((current) => ({
          ...current,
          book,
          chapters,
          ...keepPosition(current, book, chapters, wanted, at?.chapterId),
        }));
        return;
      }
      change((current) => ({
        ...current,
        book,
        chapters,
        ...restorePosition(book, chapters, wanted, saved),
        playing: false,
      }));
    },
    [store, change, positionsOf, saved],
  );
  const pause = useCallback(() => {
    change((current) => ({ ...current, playing: false }));
  }, [change]);
  function toggle() {
    const { state: now } = store.get();
    if (!now.playing && !now.chapters[now.chapterIndex]?.length) {
      return;
    }
    setError(null);
    // WORKAROUND: Android ではネイティブの pause/resume が使えない。一時停止は今の段落を止め、再開で読み直す。
    change((current) => ({ ...current, playing: !current.playing }));
  }
  function step(direction: -1 | 1, unit: Step = "paragraph") {
    const { state, settings } = store.get();
    const next =
      unit === "paragraph"
        ? moveToSpoken(
            { rules: dictionary, brackets: settings.brackets },
            state.book,
            state.chapters,
            state,
            direction,
          )
        : movePosition(state.chapters, state, direction, unit, (index) =>
            awaitsText(state.book?.chapters[index]),
          );
    if (!next) {
      return;
    }
    change((current) => ({
      ...current,
      ...next,
      playing:
        current.playing &&
        (current.chapters[next.chapterIndex].length > 0 ||
          awaitsText(current.book?.chapters[next.chapterIndex])),
    }));
    setError(null);
  }
  function seekParagraph(index: number, play = false) {
    if (!Number.isFinite(index)) {
      return;
    }
    const count = state.chapters[state.chapterIndex]?.length ?? 0;
    if (!count) {
      return;
    }
    change((current) => ({
      ...current,
      paragraphIndex: Math.max(0, Math.min(count - 1, Math.round(index))),
      playing: play || current.playing,
    }));
    setError(null);
  }
  function seekChapter(index: number) {
    if (!Number.isInteger(index) || index < 0) {
      return;
    }
    change((current) => {
      if (index >= current.chapters.length) {
        return current;
      }
      return {
        ...current,
        chapterIndex: index,
        paragraphIndex: 0,
        playing:
          current.playing &&
          (current.chapters[index].length > 0 ||
            awaitsText(current.book?.chapters[index])),
      };
    });
    setError(null);
  }
  function seekPosition(position: Position) {
    const paragraphs = state.chapters[position.chapterIndex];
    if (!paragraphs?.[position.paragraphIndex]) {
      return;
    }
    change((current) => ({ ...current, ...position }));
    setError(null);
  }
  function closeBook(bookId: string) {
    if (store.get().state.book?.id !== bookId) {
      return;
    }
    setError(null);
    setSleepTimer(null);
    change((current) => ({
      ...current,
      book: null,
      chapters: [],
      chapterIndex: 0,
      paragraphIndex: 0,
      playing: false,
    }));
  }
  function setVoiceSettings(update: Partial<PlaybackSettings>) {
    interrupt();
    setSettings((current) => ({ ...current, ...update }));
  }
  function setRate(rate: number) {
    if (isRate(rate)) {
      setVoiceSettings({ rate });
    }
  }
  function setPitch(pitch: number) {
    if (isPitch(pitch)) {
      setVoiceSettings({ pitch });
    }
  }
  function setVoice(voice?: string) {
    if (!voice || voices.some((item) => item.identifier === voice)) {
      setVoiceSettings({ voice });
    }
  }
  function setBracketVoice(kind: BracketId, value: BracketVoice) {
    if (
      isPitch(value.pitch) &&
      (!value.voice || voices.some((item) => item.identifier === value.voice))
    ) {
      interrupt();
      setSettings((current) => ({
        ...current,
        brackets: { ...current.brackets, [kind]: value },
      }));
    }
  }
  function setPageSound(pageSound: boolean) {
    setSettings((current) => ({ ...current, pageSound }));
  }
  function setKeepAwake(keepAwake: boolean) {
    setSettings((current) => ({ ...current, keepAwake }));
  }
  function setAutoNext(autoNext: boolean) {
    setSettings((current) => ({ ...current, autoNext }));
  }
  function setAuthorNotes(authorNotes: boolean) {
    setSettings((current) => ({ ...current, authorNotes }));
  }
  function restore(
    next: PlaybackSettings | undefined,
    positions: Record<string, SavedPosition>,
  ) {
    Object.assign(positionsOf(), positions);
    setVoiceSettings(next ?? {});
  }
  function previewVoice(voice?: string, pitch?: number) {
    if (voice && !voices.some((item) => item.identifier === voice)) {
      return;
    }
    change((current) => ({ ...current, playing: false }));
    startPreview({ voice, pitch });
  }
  const [lockScreen] = useState(() =>
    mediaControls({
      toggle,
      stepChapter: (direction) => {
        step(direction, "chapter");
      },
      stop: pause,
      isPlaying: () => store.get().state.playing,
    }),
  );
  useSubscription(lockScreen);
  return {
    state,
    settings,
    source: { get: store.get, subscribe: store.subscribe },
    positionsOf,
    error,
    preview,
    previewError,
    voices,
    voiceLoading,
    voiceError,
    timer,
    openBook,
    closeBook,
    toggle,
    pause,
    step,
    seekParagraph,
    seekChapter,
    seekPosition,
    setRate,
    setPitch,
    setVoice,
    setBracketVoice,
    setKeepAwake,
    setPageSound,
    setAutoNext,
    setAuthorNotes,
    restore,
    previewVoice,
    stopPreview,
    setSleepTimer,
    loadVoices,
  };
}

const PlaybackContext = createContext<ReturnType<
  typeof usePlaybackState
> | null>(null);
type ChapterRead = (bookId: string, chapterId: string) => void;
type FindBook = (bookId: string) => Book | undefined;

function ignoreChapterRead(): void {}

function knowsNoBooks(): undefined {
  return undefined;
}

interface PlaybackProviderProps {
  children: ReactNode;
  onChapterRead?: ChapterRead;
  findBook?: FindBook;
}

export function PlaybackProvider({
  children,
  onChapterRead = ignoreChapterRead,
  findBook = knowsNoBooks,
}: PlaybackProviderProps) {
  return (
    <PlaybackContext value={usePlaybackState(onChapterRead, findBook)}>
      {children}
    </PlaybackContext>
  );
}
export function usePlayback() {
  const playback = useContext(PlaybackContext);
  if (!playback) {
    throw new Error("PlaybackProviderが必要です。");
  }
  return playback;
}
