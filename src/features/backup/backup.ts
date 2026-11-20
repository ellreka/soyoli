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

export interface Backup {
  dictionary?: Dictionary;
  settings?: PlaybackSettings;
  works: Works;
  positions: Record<string, SavedPosition>;
}

const app = "soyoli";
const version = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function backupFileName(now: Date): string {
  const day = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  return `soyoli-backup-${day}.json`;
}

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

export function readingCount(dictionary: Dictionary): number {
  return (
    dictionary.common.length +
    dictionary.sets.reduce((total, set) => total + set.entries.length, 0)
  );
}

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
