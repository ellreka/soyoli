import type { Book } from "./book";

/** 同じシリーズの巻をまとめたもの。本棚では 1 作品として出す。 */
export interface Series {
  /** まとまりを見分けるキー。保存はしない: シリーズの名前から毎回作る。 */
  id: string;
  title: string;
  /** 最後に開いた巻の著者。 */
  author: string;
  /** 巻の順。 */
  volumes: Book[];
  /** 渡された並びで最初に来た巻: 本棚では、最後に開いた巻。 */
  latest: Book;
}

/** 同じシリーズかどうかを比べる形: 全角と半角、大文字と小文字、空白を区別しない。 */
function seriesKey(name: string): string {
  return name.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

/**
 * 取り込んだファイルの作品のうち、同じシリーズの巻を 1 つにまとめる。
 * 見るのはファイルが自分で名乗るシリーズ（`Book.series`）だけで、書名からは
 * 推測しない: 書名だけでは、別の作品を巻と取り違える。シリーズを名乗らない
 * 作品、巻が 1 つしかないシリーズ、Web 小説は、そのまま返す。まとまりは、
 * その巻のうち最初に来たものの位置に置く。
 */
export function bySeries(books: readonly Book[]): (Book | Series)[] {
  const keyOf = (book: Book) =>
    book.source === "file" && book.series
      ? seriesKey(book.series.name)
      : undefined;
  const groups = new Map<string, Book[]>();
  for (const book of books) {
    const key = keyOf(book);
    if (key) {
      groups.set(key, [...(groups.get(key) ?? []), book]);
    }
  }
  const placed = new Set<string>();
  const result: (Book | Series)[] = [];
  for (const book of books) {
    const key = keyOf(book);
    const members = key ? (groups.get(key) ?? []) : [];
    if (!key || !book.series || members.length < 2) {
      result.push(book);
      continue;
    }
    if (placed.has(key)) {
      continue;
    }
    placed.add(key);
    // 巻の番号のない巻は、番号のある巻の後ろ。
    const position = (member: Book) =>
      member.series?.position ?? Number.POSITIVE_INFINITY;
    result.push({
      id: key,
      title: book.series.name,
      author: book.author,
      // Array.prototype.sort は安定: 同じ番号の巻は、渡された順を保つ。
      volumes: [...members].sort((a, b) => {
        const [first, second] = [position(a), position(b)];
        return first === second ? 0 : first < second ? -1 : 1;
      }),
      latest: book,
    });
  }
  return result;
}

export function isSeries(item: Book | Series): item is Series {
  return "volumes" in item;
}
