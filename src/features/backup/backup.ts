import { toDictionary, type Dictionary } from "@/features/dictionary/entries";
import {
  fromSavedWorks,
  takesProgress,
  toSavedWorks,
  type Works,
} from "@/features/library/savedWorks";
import {
  initialSettings,
  type PlaybackSettings,
} from "@/features/player/settings";
import {
  savedPositions,
  type SavedPlayback,
  type SavedPosition,
} from "@/features/player/storage";
import type { BracketVoices } from "@/features/speech/brackets";

/**
 * バックアップに入るもの: 読み方辞書、どう読むか、本棚と履歴の Web 小説、
 * その読みかけの位置。Web 小説はメタ情報と最後に読んだ話だけで、本文は
 * 入らない。端末に保存したファイル（EPUB、PDF）も入らない。
 *
 * ファイルから読んだものは、書かれていた部分だけを持つ: ない部分は
 * 取り込まず、端末にあるものを残す。
 */
export interface Backup {
  dictionary?: Dictionary;
  settings?: PlaybackSettings;
  works: Works;
  /** 作品の読みかけの位置。`works` にある作品の分だけ。 */
  positions: Record<string, SavedPosition>;
}

/** バックアップファイルが自分のものだと分かる目印。 */
const app = "soyoli";
const version = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** 書き出すファイルの名前。書き出した日が入る。 */
export function backupFileName(now: Date): string {
  const day = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  return `soyoli-backup-${day}.json`;
}

/**
 * ファイルに書く形。この形は永遠: 一度書き出されたファイルは、後の
 * バージョンでも取り込めなければならない。各部分は、端末に保存している
 * ファイルと同じ形にしてあり、読み戻すときも同じ検証を通る。
 */
export function toBackupFile(
  backup: Required<Backup>,
  now: Date,
): Record<string, unknown> {
  const { works, settings } = backup;
  const saved = toSavedWorks(
    works.books,
    works.lastRead,
    works.bookmarked,
    works.history,
  );
  return {
    app,
    version,
    exportedAt: now.toISOString(),
    dictionary: backup.dictionary,
    voice: settings,
    works: saved,
    positions: Object.fromEntries(
      saved.flatMap((work) => {
        const position = backup.positions[work.id];
        return position ? [[work.id, position]] : [];
      }),
    ),
  };
}

/**
 * ファイルから読んだバックアップ。このアプリのバックアップでなければ null。
 * 中の壊れたものは落とす。
 */
export function fromBackupFile(value: unknown): Backup | null {
  if (!isRecord(value) || value.app !== app) {
    return null;
  }
  const works = fromSavedWorks(value.works);
  const positions = savedPositions({
    positions: value.positions,
  } as unknown as SavedPlayback);
  return {
    ...(isRecord(value.dictionary) && {
      dictionary: toDictionary(value.dictionary),
    }),
    ...(isRecord(value.voice) && {
      // SAFETY: 形はファイルの言い分にすぎない。`initialSettings` が検証する。
      settings: initialSettings(value.voice as unknown as SavedPlayback),
    }),
    works,
    positions: Object.fromEntries(
      Object.entries(positions).filter(([bookId]) =>
        works.books.some((book) => book.id === bookId),
      ),
    ),
  };
}

/**
 * 声を、この端末にあるものだけにした設定。声の id は端末ごとのものなので、
 * 別の端末のバックアップが指す声はないことがある: そのときは端末の既定の
 * 声で読む。
 */
export function withKnownVoices(
  settings: PlaybackSettings,
  known: readonly string[],
): PlaybackSettings {
  const brackets: BracketVoices = {};
  for (const [kind, item] of Object.entries(settings.brackets)) {
    const { voice, ...rest } = item;
    brackets[kind as keyof BracketVoices] =
      voice !== undefined && known.includes(voice) ? item : rest;
  }
  const { voice, ...rest } = settings;
  return {
    ...rest,
    ...(voice !== undefined && known.includes(voice) && { voice }),
    brackets,
  };
}

/**
 * 取り込む読みかけの位置: 端末の読みかけより優先される作品の分だけ
 * （`takesProgress`）。
 */
export function positionsToRestore(
  backup: Backup,
  current: Works,
  openId?: string | null,
): Record<string, SavedPosition> {
  return Object.fromEntries(
    Object.entries(backup.positions).filter(([bookId]) =>
      takesProgress(current, backup.works, bookId, openId),
    ),
  );
}

/** 辞書に入っている読みの数。 */
export function readingCount(dictionary: Dictionary): number {
  return (
    dictionary.common.length +
    dictionary.sets.reduce((total, set) => total + set.entries.length, 0)
  );
}

/** 取り込む前に読者に伝える、バックアップの中身。 */
export function backupSummary(backup: Backup): string {
  const replaced = [
    ...(backup.dictionary
      ? [`読み方辞書（読み${readingCount(backup.dictionary)}件）`]
      : []),
    ...(backup.settings ? ["音声設定"] : []),
  ];
  const works = backup.works.books.length;
  return [
    ...(replaced.length
      ? [`${replaced.join("と")}は、バックアップの内容に置き換わります。`]
      : []),
    ...(works
      ? [
          `本棚と履歴には、バックアップのWeb小説${works}件が加わります。今ある作品は残ります。`,
        ]
      : []),
  ].join("\n");
}
