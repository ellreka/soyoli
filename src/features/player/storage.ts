import { jsonFile } from "@/lib/jsonFile";

export interface SavedPosition {
  chapterId: string;
  paragraphIndex: number;
}

export interface SavedPlayback {
  bookId: string | null;
  chapterIndex: number;
  paragraphIndex: number;
  positions?: Record<string, SavedPosition>;
  rate: number;
  pitch: number;
  voice?: string;
  brackets?: unknown;
  keepAwake?: boolean;
  pageSound?: boolean;
  autoNext?: boolean;
  authorNotes?: boolean;
}

const file = jsonFile("playback.json");

export function loadPlayback(): SavedPlayback | null {
  const value = file.read();
  return value && typeof value === "object" ? fromDisk(value) : null;
}

export function savePlayback(value: SavedPlayback): void {
  file.write(toDisk(value));
}

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
