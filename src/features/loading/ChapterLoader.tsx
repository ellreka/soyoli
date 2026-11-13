import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { isWebNovel, type Book } from "@/features/books/book";
import { useLibrary } from "@/features/library/Library";
import { usePlayback } from "@/features/player/Playback";
import { useFilePages } from "./useFilePages";
import { useOpenBook } from "./useOpenBook";
import {
  chainNextEpisode,
  episodeContent,
  isTocMarker,
  isTocPageUrl,
  mergeToc,
  parseEpisode,
  parseToc,
  tocUrlOf,
} from "@/features/web/episode";

// なろうはブラウザでない User-Agent（okhttp など）を拒否する。話をその場で
// 取得するには、デスクトップ風の UA が要る。
const fetchHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
};

function fetchHtml(url: string, signal: AbortSignal): Promise<string> {
  return fetch(url, { signal, headers: fetchHeaders }).then((response) =>
    response.ok
      ? response.text()
      : Promise.reject(new Error(String(response.status))),
  );
}

/** まだ目次がなく、読んだものしか持っていない Web 小説。 */
function lacksToc(book: Book): boolean {
  return book.chapters.length < 3 && !book.chapters.some(isTocMarker);
}

/**
 * `rowIndex` の目次の行が話に変わった後、読む位置が着く先: その行に来る
 * 前にいた話の次の話。最初の話より上にある行の場合は、その後ろに
 * 続いていた話の 1 つ前。
 */
function landingIndex(before: Book, after: Book, rowIndex: number): number {
  const previous = before.chapters[rowIndex - 1];
  const at = previous
    ? after.chapters.findIndex((item) => item.id === previous.id)
    : -1;
  if (at >= 0 && at + 1 < after.chapters.length) {
    return at + 1;
  }
  const next = before.chapters[rowIndex + 1];
  const following = next
    ? after.chapters.findIndex((item) => item.id === next.id)
    : -1;
  return following > 0 ? following - 1 : -1;
}

interface ChapterLoader {
  /** 取得に失敗した章の URL。最後の試みが失敗した場合に入る。 */
  failedChapter: string | null;
  /** シートから目次の窓を広げる: ページを取得し、位置は保つ。 */
  expandToc: (url: string) => void;
  /**
   * 読んでいる話と、その前後の目次を取得し直す: ページが壊れて返ってきた
   * ときや、画面がおかしくなったときの逃げ道。
   */
  reload: () => void;
}

const ChapterLoaderContext = createContext<ChapterLoader | null>(null);

/**
 * Web 小説の話は、内容が空の目次の行として本に入る。再生がその行に来たら
 * ページを取得し、位置を保ったまま内容を差し込む。画面より上の層にあるので、
 * 本がミニプレーヤーにしかないとき（起動後や、ビューアーを閉じたまま
 * 読み上げが先へ進むとき）にも話が読み込まれる。
 */
export function ChapterLoaderProvider({ children }: { children: ReactNode }) {
  const playback = usePlayback();
  const { markRead } = useLibrary();
  // 取得は何回もの render をまたいで続く。結果はそのときに開いているものに
  // 反映するので、取得そのものは対象のページ以外に依存しない。
  const open = useOpenBook();
  // ページごとに読むファイルの章も、Web の話と並んで読み込まれる。
  useFilePages(open);
  const [failedChapter, setFailedChapter] = useState<string | null>(null);
  const pending = useRef(new Set<string>());
  // reload() が増やす。同じページをもう一度取得させるため。
  const [attempt, setAttempt] = useState(0);
  const { state } = playback;
  const book = state.book;
  const chapter = book?.chapters[state.chapterIndex];
  // 取得するページ: 今の章のページ。まだ本文がない間だけ。
  const missingUrl =
    chapter?.url && chapter.content.length === 0 ? chapter.url : null;

  // 読んでいる話を覚えておく。本棚がそれを起動をまたいで保存する。
  useEffect(() => {
    if (book && chapter?.url && !isTocMarker(chapter)) {
      markRead(book.id, chapter.id);
    }
  }, [book, chapter, markRead]);

  useEffect(() => {
    if (!missingUrl || pending.current.has(missingUrl)) {
      return;
    }
    const url = missingUrl;
    const requests = pending.current;
    requests.add(url);
    const request = new AbortController();
    function fail(): void {
      setFailedChapter(url);
      // 読み上げがこのページを待っていた。待つのをやめる。
      open.playback().pause();
    }
    fetchHtml(url, request.signal)
      .then((html) => {
        const current = open.current();
        if (request.signal.aborted || !current) {
          return;
        }
        const { seekChapter, state: now } = open.playback();
        const episode = isTocPageUrl(url) ? null : parseEpisode(html, url);
        if (episode) {
          const updated: Book = {
            ...current,
            chapters: chainNextEpisode(
              current.chapters.map((item) =>
                item.url === url
                  ? {
                      ...item,
                      title: episode.title,
                      content: episodeContent(episode.title, episode.body),
                    }
                  : item,
              ),
              episode.nextUrl,
            ),
          };
          open.replace(updated);
          return;
        }
        // 話ではない: 読む位置が、まだ取得していない目次ページの行に来た。
        // その行をそのページの話に変えて、そちらへ進む。
        const toc = parseToc(html, url);
        if (!toc.entries.length) {
          fail();
          return;
        }
        const updated = mergeToc(current, toc, url);
        open.replace(updated);
        const landing = landingIndex(current, updated, now.chapterIndex);
        if (landing >= 0) {
          seekChapter(landing);
        }
      })
      .catch(() => {
        if (!request.signal.aborted) {
          fail();
        }
      })
      .finally(() => {
        requests.delete(url);
      });
    return () => {
      request.abort();
    };
  }, [missingUrl, attempt, open]);

  // 目次なしで開いた Web 小説 — 起動後に本棚から開いたか、ブラウザが目次を
  // 取得する前に開いたもの — は、セッションに 1 回、ここで目次を得る。
  // 読むほうはそれを待たない。
  const tocTried = useRef(new Set<string>());
  const bookId = book?.id;
  const tocUrl =
    book &&
    isWebNovel(book) &&
    chapter?.url &&
    !isTocMarker(chapter) &&
    lacksToc(book)
      ? tocUrlOf(chapter.url)
      : null;
  useEffect(() => {
    if (!tocUrl || !bookId || tocTried.current.has(bookId)) {
      return;
    }
    tocTried.current.add(bookId);
    // 再 render では中断しない: 結果はそのときのものに反映される。
    fetchHtml(tocUrl, new AbortController().signal)
      .then((html) => {
        const current = open.current();
        const toc = parseToc(html, tocUrl);
        if (current?.id !== bookId || !toc.entries.length) {
          return;
        }
        const updated = mergeToc(current, toc, tocUrl);
        open.replace(updated);
      })
      .catch(() => {
        /* 目次がなくても、話から次の話へと読み進められる。 */
      });
  }, [tocUrl, bookId, open]);

  function expandToc(url: string): void {
    if (!book || pending.current.has(url)) {
      return;
    }
    const requests = pending.current;
    requests.add(url);
    fetchHtml(url, new AbortController().signal)
      .then((html) => {
        const current = open.current();
        const toc = parseToc(html, url);
        if (!current || !toc.entries.length) {
          return;
        }
        // 読者は読んでいる章にとどまる: 同じ作品を開き直すと、行がどこへ
        // 動いていても、章を基準に位置が保たれる。
        const updated = mergeToc(current, toc, url);
        open.replace(updated);
      })
      .catch(() => {
        /* 行は残る。読者はシートからやり直せる。 */
      })
      .finally(() => {
        requests.delete(url);
      });
  }

  function reload(): void {
    if (!book || !chapter?.url || isTocMarker(chapter)) {
      return;
    }
    setFailedChapter(null);
    setAttempt((value) => value + 1);
    // 本文を捨てると、その章は通常の取得をもう一度通る。章の中の読む位置は
    // 保たれ、本文が戻ったときに反映される。
    if (chapter.content.length > 0) {
      const updated: Book = {
        ...book,
        chapters: book.chapters.map((item) =>
          item.id === chapter.id ? { ...item, content: [] } : item,
        ),
      };
      open.replace(updated);
    }
    const toc = tocUrlOf(chapter.url);
    if (toc) {
      expandToc(toc);
    }
  }

  return (
    <ChapterLoaderContext value={{ failedChapter, expandToc, reload }}>
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
