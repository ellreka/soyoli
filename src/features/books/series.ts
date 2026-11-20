import type { Book } from "./book";

export interface Series {
  id: string;
  title: string;
  author: string;
  volumes: Book[];
  latest: Book;
}

function seriesKey(name: string): string {
  return name.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

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
    const position = (member: Book) =>
      member.series?.position ?? Number.POSITIVE_INFINITY;
    result.push({
      id: key,
      title: book.series.name,
      author: book.author,
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
