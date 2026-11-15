import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
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
import { useMediaSession } from "./MediaSession";
import {
  useKeepAwake,
  usePageTurn,
  useSavedPositions,
} from "./playbackEffects";
import {
  keepPosition,
  nothingOpen,
  restorePosition,
  type PlaybackState,
} from "./playbackState";
import { initialSettings, type PlaybackSettings } from "./settings";
import { loadPlayback, type SavedPosition } from "./storage";
import { useGeneration } from "./useGeneration";
import { usePreview } from "./usePreview";
import { useReadAloud } from "./useReadAloud";
import { useSleepTimer } from "./useSleepTimer";
import { useVoices } from "./useVoices";

/**
 * 本の読み上げに関するすべてをまとめたもの: 何が開いていて読者がどこに
 * いるか（`state`）、どう読むか（`settings`）、その中を移動する操作。
 * 各部分は独立したフックになっている:
 *
 * - `useReadAloud` は、位置にある段落を読み上げて次へ進む。
 * - `usePreview` は声を試聴する。`useSleepTimer` は読み上げを自動で止める。
 * - `playbackEffects` は位置を保存し、ページをめくり、画面を点けたままにする。
 */
function usePlaybackState() {
  // 前回のセッションが残したもの。一度だけ読む。
  const [saved] = useState(loadPlayback);
  const [state, setState] = useState<PlaybackState>(nothingOpen);
  const [settings, setSettings] = useState(() => initialSettings(saved));
  const [error, setError] = useState<string | null>(null);
  const { voices, voiceLoading, voiceError, loadVoices } = useVoices();
  const { dictionary } = useDictionary();
  const dictionaryRef = useRef(dictionary);
  useEffect(() => {
    dictionaryRef.current = dictionary;
  }, [dictionary]);

  // 読み上げ中に切り替えても、読んでいる段落はやり直さない: 話の終わりで読む。
  const autoNextRef = useRef(settings.autoNext);
  useEffect(() => {
    autoNextRef.current = settings.autoNext;
  }, [settings.autoNext]);

  const generation = useGeneration();
  const { preview, previewError, setPreviewError, startPreview, stopPreview } =
    usePreview(generation.begin);
  /** 話している内容（本文でも試聴でも）を、それが変わる前に打ち切る。 */
  const interrupt = useCallback(() => {
    stopPreview();
    // React が変更をコミットする前に、今すぐ: その間に、エンジンが古い発話に
    // ついてコールバックしてくることがある。
    generation.begin();
  }, [stopPreview, generation]);
  const change = useCallback(
    (update: SetStateAction<PlaybackState>) => {
      interrupt();
      setState(update);
    },
    [interrupt],
  );

  const { timer, timerRef, setSleepTimer } = useSleepTimer(state.playing);
  const positionsOf = useSavedPositions(state, settings, saved);
  const onChapterTurn = usePageTurn(
    state.book,
    state.chapterIndex,
    settings.pageSound,
  );
  useKeepAwake(settings.keepAwake && state.playing);
  useReadAloud({
    state,
    settings,
    preview,
    generation,
    dictionary: dictionaryRef,
    timer: timerRef,
    autoNext: autoNextRef,
    onChapterTurn,
    change,
    setSleepTimer,
    stopPreview,
    setError,
    setPreviewError,
  });

  const openBook = useCallback(
    (book: Book, at?: { chapterId: string }) => {
      setError(null);
      if (state.book === book && !at) {
        return;
      }
      // 最初にすべての章を解析している（スマートフォンで本文 1 MB
      // あたり約 1 秒）。巨大な本で開くのが止まるようなら、逐次解析にすること。
      const chapters = book.chapters.map((chapter) =>
        toParagraphs(chapter.content),
      );
      const left = positionsOf()[book.id];
      // 章を指定された: 読者が読みかけていたのがそこなら続きから、そうで
      // なければ先頭から始める。
      const wanted =
        at && left?.chapterId !== at.chapterId
          ? { chapterId: at.chapterId, paragraphIndex: 0 }
          : left;
      // 参照ではなく id で比べる: ライブラリは、読み込み直したときや、取得した
      // Web の話・目次の続きを取り込んだときに Book オブジェクトを置き換える。
      // それで読者が位置を失ってはならない。
      if (state.book?.id === book.id && state.chapters.length > 0) {
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
    [state.book, state.chapters.length, change, positionsOf, saved],
  );
  const pause = useCallback(() => {
    change((current) => ({ ...current, playing: false }));
  }, [change]);
  function toggle() {
    // 一時停止はいつでも効く。話の読み込みを待っている間も同じ。
    if (!state.playing && !state.chapters[state.chapterIndex]?.length) {
      return;
    }
    setError(null);
    // 一時停止では今の段落を止めて、再開で読み直している。Android ではネイティブの pause/resume が使えない。
    change((current) => ({ ...current, playing: !current.playing }));
  }
  function step(direction: -1 | 1, unit: Step = "paragraph") {
    // 段落を 1 つずつ見て、読むもののない段落は飛ばす: 再生中にそこで
    // 止まっても、またすぐ先へ進むだけ。
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
    // 検証は関数型の更新の中で行う: 呼び出し側が章を足した直後（取得した
    // 目次ページ）かもしれず、キャプチャした state は古いことがある。
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
  /**
   * 開いているのがその本なら、プレーヤーから外す: 読み上げは止まり、続きを
   * 読むものがなくなる。その本の中で読者がいた位置は保たれるので、開き
   * 直せばそこから再開する。
   */
  function closeBook(bookId: string) {
    if (state.book?.id !== bookId) {
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
  /**
   * 本文の読み方を変える。ここから先は読み方が変わるので、話している内容を
   * 打ち切り、新しい設定で読み直す。
   */
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
  /** カッコの種類に声を与える。またはオフにする（`on: false`）。 */
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
  // ここからは声に関わらない: 読み上げ中のものは打ち切らない。
  function setPageSound(pageSound: boolean) {
    setSettings((current) => ({ ...current, pageSound }));
  }
  function setKeepAwake(keepAwake: boolean) {
    setSettings((current) => ({ ...current, keepAwake }));
  }
  function setAutoNext(autoNext: boolean) {
    setSettings((current) => ({ ...current, autoNext }));
  }
  /** 次に取得する話から効く: 届いている本文は書き換えない。 */
  function setAuthorNotes(authorNotes: boolean) {
    setSettings((current) => ({ ...current, authorNotes }));
  }
  /**
   * バックアップから取り込む: 読み方を入れ替え（あれば）、作品の読みかけの
   * 位置を足す。位置は次にその作品を開いたときから効く。
   */
  function restore(
    next: PlaybackSettings | undefined,
    positions: Record<string, SavedPosition>,
  ) {
    Object.assign(positionsOf(), positions);
    // 設定が変わると、位置も一緒に保存される。
    setVoiceSettings(next ?? {});
  }
  /** 声の試聴を再生する。指定した高さか、基本の高さで。 */
  function previewVoice(voice?: string, pitch?: number) {
    if (voice && !voices.some((item) => item.identifier === voice)) {
      return;
    }
    change((current) => ({ ...current, playing: false }));
    startPreview({ voice, pitch });
  }
  // ロック画面・通知ドロワーに出る、メディアアプリ風の操作。
  useMediaSession({
    book: state.book,
    playing: state.playing,
    chapterTitle: state.book?.chapters[state.chapterIndex]?.title ?? undefined,
    toggle,
    stepChapter: (direction: -1 | 1) => {
      step(direction, "chapter");
    },
    stop: pause,
  });
  return {
    state,
    settings,
    /** アプリを最後に使ったときに開いていた本。あれば。 */
    lastBookId: saved?.bookId ?? null,
    /** 読者が各本を読みかけた位置。本の id ごと。 */
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
export function PlaybackProvider({ children }: { children: ReactNode }) {
  return (
    <PlaybackContext value={usePlaybackState()}>{children}</PlaybackContext>
  );
}
export function usePlayback() {
  const playback = useContext(PlaybackContext);
  if (!playback) {
    throw new Error("PlaybackProviderが必要です。");
  }
  return playback;
}
