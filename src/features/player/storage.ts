import { jsonFile } from "@/lib/jsonFile";

/** 読者が本を読みかけた位置: 章（id で指す）と、その中の段落。 */
export interface SavedPosition {
  chapterId: string;
  paragraphIndex: number;
}

export interface SavedPlayback {
  /** 最後に開いていた本。 */
  bookId: string | null;
  chapterIndex: number;
  paragraphIndex: number;
  /** これまでに読んだすべての本の中の位置。本の id ごと。 */
  positions?: Record<string, SavedPosition>;
  rate: number;
  pitch: number;
  voice?: string;
  /** カッコの声。読み戻すときに `toBracketVoices` が検証する。 */
  brackets?: unknown;
  /** 読み上げ中、画面を点けたままにする。true と保存されていない限りオフ。 */
  keepAwake?: boolean;
  /** ページめくりの音。false と保存されていない限りオン。 */
  pageSound?: boolean;
  /** 連続再生。false と保存されていない限りオン。 */
  autoNext?: boolean;
  /** 前書きと後書きを読む。true と保存されていない限りオフ。 */
  authorNotes?: boolean;
}

/**
 * 読む位置と音声設定。戻ってくるのはファイルの形のままで、検証していない:
 * 使う場所で検証する。
 */
const file = jsonFile("playback.json");

export function loadPlayback(): SavedPlayback | null {
  const value = file.read();
  return value && typeof value === "object" ? fromDisk(value) : null;
}

export function savePlayback(value: SavedPlayback): void {
  file.write(toDisk(value));
}

// ファイルは段落のインデックスを `sentenceIndex` と呼ぶ: 最初に書いたときの
// 名前で、以前のバージョンが保存した位置を読めるように残している。
type Disk = Record<string, unknown>;

function renamed(value: unknown, from: string, to: string): unknown {
  if (!value || typeof value !== "object" || !(from in value)) {
    return value;
  }
  const { [from]: index, ...rest } = value as Disk;
  return { ...rest, [to]: index };
}

function eachPosition(value: unknown, from: string, to: string): unknown {
  return value && typeof value === "object"
    ? Object.fromEntries(
        Object.entries(value).map(([bookId, position]) => [
          bookId,
          renamed(position, from, to),
        ]),
      )
    : value;
}

function fromDisk(value: object): SavedPlayback {
  const saved = renamed(value, "sentenceIndex", "paragraphIndex") as Disk;
  // 形はファイルの言い分にすぎない。そこから読んだものは、使う場所で
  // 検証する（`initialState`、`savedPositions`）。
  return {
    ...saved,
    positions: eachPosition(saved.positions, "sentenceIndex", "paragraphIndex"),
  } as unknown as SavedPlayback;
}

function toDisk(value: SavedPlayback): Disk {
  const saved = renamed(value, "paragraphIndex", "sentenceIndex") as Disk;
  return {
    ...saved,
    positions: eachPosition(saved.positions, "paragraphIndex", "sentenceIndex"),
  };
}

/** 保存された位置のうち、形の正しいもの。それ以外は落とす。 */
export function savedPositions(
  saved: SavedPlayback | null,
): Record<string, SavedPosition> {
  const result: Record<string, SavedPosition> = {};
  const value: unknown = saved?.positions;
  if (!value || typeof value !== "object") {
    return result;
  }
  for (const [bookId, item] of Object.entries(value)) {
    const position = item as Partial<SavedPosition> | null;
    if (
      position &&
      typeof position.chapterId === "string" &&
      Number.isInteger(position.paragraphIndex) &&
      (position.paragraphIndex as number) >= 0
    ) {
      result[bookId] = {
        chapterId: position.chapterId,
        paragraphIndex: position.paragraphIndex as number,
      };
    }
  }
  return result;
}
