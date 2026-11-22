import { isWebNovel, type Book } from "@/features/books/book";
import { fileUri } from "@/features/books/fileStore";
import { readPdfPages } from "@/features/books/pdf";
import type { PlaybackState } from "@/features/player/playbackState";
import type { Subscription } from "@/lib/subscription";
import {
  chainNextEpisode,
  episodeContent,
  episodeDataUrl,
  isTocMarker,
  isTocPageUrl,
  mergeToc,
  parseEpisode,
  parseToc,
  tocUrlOf,
  workIdOf,
} from "@/features/web/episode";
import type { OpenBook } from "./useOpenBook";

// WORKAROUND: なろうはブラウザでない User-Agent（okhttp など）を拒否する。
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

function lacksToc(book: Book): boolean {
  return book.chapters.length < 3 && !book.chapters.some(isTocMarker);
}

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

function missingUrlOf(state: PlaybackState): string | null {
  const chapter = state.book?.chapters[state.chapterIndex];
  return chapter?.url && chapter.content.length === 0 ? chapter.url : null;
}

function tocUrlFor(state: PlaybackState): string | null {
  const { book } = state;
  const chapter = book?.chapters[state.chapterIndex];
  return book &&
    isWebNovel(book) &&
    chapter?.url &&
    !isTocMarker(chapter) &&
    lacksToc(book)
    ? tocUrlOf(chapter.url, workIdOf(book))
    : null;
}

interface FilePages {
  key: string;
  bookId: string;
  file: string;
  chapterId: string;
  from: number;
  count: number;
}

function filePagesOf(state: PlaybackState): FilePages | null {
  const { book } = state;
  const chapter = book?.chapters[state.chapterIndex];
  const pages = chapter?.pages;
  if (!book?.file || !chapter || !pages || chapter.content.length > 0) {
    return null;
  }
  if (!pages.count) {
    return null;
  }
  return {
    key: [book.id, book.file, chapter.id, pages.from, pages.count].join("\n"),
    bookId: book.id,
    file: book.file,
    chapterId: chapter.id,
    from: pages.from,
    count: pages.count,
  };
}

function withPages(
  book: Book,
  chapterId: string,
  content: Book["chapters"][number]["content"],
): Book {
  return {
    ...book,
    chapters: book.chapters.map((item) =>
      item.id === chapterId
        ? { ...item, content, pages: content.length ? item.pages : undefined }
        : item,
    ),
  };
}

function tocIsOptional(): void {}

function rowStaysForRetry(): void {}

export interface ChapterFetching {
  watch: Subscription;
  retry: () => void;
  expandToc: (url: string) => void;
}

export function createChapterFetching(
  open: OpenBook,
  onFailed: (url: string) => void,
): ChapterFetching {
  const pending = new Set<string>();
  const tocTried = new Set<string>();
  const filesTried = new Set<string>();
  const episode: {
    url: string | null;
    attempt: number;
    request?: AbortController;
  } = { url: null, attempt: -1 };
  const pages: { key: string | null; request?: AbortController } = {
    key: null,
  };
  const retries = { count: 0 };

  function fail(url: string): void {
    onFailed(url);
    open.playback().pause();
  }

  function applyEpisode(url: string, html: string): void {
    const current = open.current();
    if (!current) {
      return;
    }
    const { seekChapter, state, settings } = open.playback();
    const found = isTocPageUrl(url) ? null : parseEpisode(html, url);
    if (found) {
      open.replace({
        ...current,
        episodeCount: found.episodeCount ?? current.episodeCount,
        chapters: chainNextEpisode(
          current.chapters.map((item) =>
            item.url === url
              ? {
                  ...item,
                  title: found.title,
                  content: episodeContent(found, settings.authorNotes),
                }
              : item,
          ),
          found.nextUrl,
        ),
      });
      return;
    }
    const toc = parseToc(html, url);
    if (!toc.entries.length) {
      fail(url);
      return;
    }
    const updated = mergeToc(current, toc, url);
    open.replace(updated);
    const landing = landingIndex(current, updated, state.chapterIndex);
    if (landing >= 0) {
      seekChapter(landing);
    }
  }

  function fetchEpisode(url: string): void {
    pending.add(url);
    const request = new AbortController();
    episode.request = request;
    fetchHtml(episodeDataUrl(url), request.signal)
      .then((html) => {
        if (!request.signal.aborted) {
          applyEpisode(url, html);
        }
      })
      .catch(() => {
        if (!request.signal.aborted) {
          fail(url);
        }
      })
      .finally(() => {
        pending.delete(url);
      });
  }

  function followEpisode(state: PlaybackState): void {
    const url = missingUrlOf(state);
    if (url === episode.url && retries.count === episode.attempt) {
      return;
    }
    episode.request?.abort();
    episode.request = undefined;
    episode.url = url;
    episode.attempt = retries.count;
    if (url && !pending.has(url)) {
      fetchEpisode(url);
    }
  }

  function followToc(state: PlaybackState): void {
    const tocUrl = tocUrlFor(state);
    const bookId = state.book?.id;
    if (!tocUrl || !bookId || tocTried.has(bookId)) {
      return;
    }
    tocTried.add(bookId);
    fetchHtml(tocUrl, new AbortController().signal)
      .then((html) => {
        const current = open.current();
        const toc = parseToc(html, tocUrl);
        if (current?.id !== bookId || !toc.entries.length) {
          return;
        }
        open.replace(mergeToc(current, toc, tocUrl));
      })
      .catch(tocIsOptional);
  }

  function applyPages(
    wanted: FilePages,
    request: AbortController,
    content: Book["chapters"][number]["content"],
  ): void {
    const now = open.playback();
    const current = open.current();
    if (request.signal.aborted || !current || current.id !== wanted.bookId) {
      return;
    }
    const index = current.chapters.findIndex(
      (item) => item.id === wanted.chapterId,
    );
    open.replace(withPages(current, wanted.chapterId, content));
    if (content.length || !now.state.playing) {
      return;
    }
    if (index >= 0 && index < current.chapters.length - 1) {
      now.step(1, "chapter");
    } else {
      now.pause();
    }
  }

  function followPages(state: PlaybackState): void {
    const wanted = filePagesOf(state);
    const key = wanted?.key ?? null;
    if (key === pages.key) {
      return;
    }
    pages.request?.abort();
    pages.request = undefined;
    pages.key = key;
    if (!wanted) {
      return;
    }
    const request = new AbortController();
    pages.request = request;
    readPdfPages(fileUri(wanted.file), {
      from: wanted.from,
      count: wanted.count,
    }).then(
      (content) => {
        applyPages(wanted, request, content);
      },
      () => {
        if (!request.signal.aborted) {
          open.playback().pause();
          applyPages(wanted, request, []);
        }
      },
    );
  }

  function followFile(state: PlaybackState): void {
    const { book } = state;
    if (!book?.file || book.chapters.length > 0 || filesTried.has(book.id)) {
      return;
    }
    const bookId = book.id;
    filesTried.add(bookId);
    open.loadFile(bookId).then(
      (loaded) => {
        if (open.current()?.id === bookId) {
          open.replace(loaded);
        }
      },
      () => {
        open.playback().closeBook(bookId);
      },
    );
  }

  function follow(): void {
    const { state } = open.source.get();
    followFile(state);
    followEpisode(state);
    followToc(state);
    followPages(state);
  }

  function stop(): void {
    episode.request?.abort();
    pages.request?.abort();
    episode.url = null;
    episode.attempt = -1;
    pages.key = null;
  }

  return {
    watch() {
      follow();
      const unsubscribe = open.source.subscribe(follow);
      return () => {
        unsubscribe();
        stop();
      };
    },
    retry() {
      retries.count += 1;
      follow();
    },
    expandToc(url) {
      if (!open.current() || pending.has(url)) {
        return;
      }
      pending.add(url);
      fetchHtml(url, new AbortController().signal)
        .then((html) => {
          const current = open.current();
          const toc = parseToc(html, url);
          if (!current || !toc.entries.length) {
            return;
          }
          open.replace(mergeToc(current, toc, url));
        })
        .catch(rowStaysForRetry)
        .finally(() => {
          pending.delete(url);
        });
    },
  };
}
