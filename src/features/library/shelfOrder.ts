import { jsonFile } from "@/lib/jsonFile";

/** 本棚での作品の位置と、最後にビューアーで開いた時刻。 */
export interface ShelfEntry {
  id: string;
  /** ms。追加してから、これを保存するようになって一度も開いていない作品にはない。 */
  openedAt?: number;
}

/**
 * 作品。最近開いたものが先。Web 小説とファイル由来の作品は 2 か所に分けて
 * 保存している。起動時にそれらを 1 つの順番に戻すのがこれ。順番はリストの
 * 並びそのもの: 開いた作品が先頭に来る。時刻は、本棚を別の並びにするために
 * 横に持っている。
 */
const file = jsonFile("shelf-order.json");

function toEntry(value: unknown): ShelfEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const { id, openedAt } = value as Record<string, unknown>;
  if (typeof id !== "string" || !id) {
    return null;
  }
  return typeof openedAt === "number" && Number.isFinite(openedAt)
    ? { id, openedAt }
    : { id };
}

/** 保存されていたもの。壊れたものは落とす。 */
export function loadShelfOrder(): ShelfEntry[] {
  const value = file.read();
  const entries: ShelfEntry[] = [];
  for (const item of Array.isArray(value) ? value : []) {
    const entry = toEntry(item);
    if (entry && !entries.some((other) => other.id === entry.id)) {
      entries.push(entry);
    }
  }
  return entries;
}

export function saveShelfOrder(entries: readonly ShelfEntry[]): void {
  file.write(entries);
}

/**
 * 作品を保存された順に並べる。順番に名前のない作品（順番を保存するように
 * なる前のファイル）は、名前のある作品の後ろに、渡された順で来る。
 */
export function inOrder<T extends { id: string }>(
  works: readonly T[],
  order: readonly string[],
): T[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  const place = (work: T) => rank.get(work.id) ?? order.length;
  // Array.prototype.sort は安定: 同じ位置のものは順番を保つ。
  return [...works].sort((a, b) => place(a) - place(b));
}
