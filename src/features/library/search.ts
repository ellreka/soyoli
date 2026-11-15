import type { Book } from "@/features/books/book";

/** 比べるための形: 全角と半角、大文字と小文字、ひらがなとカタカナを区別しない。 */
function folded(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (kana) =>
      String.fromCharCode(kana.charCodeAt(0) - 0x60),
    );
}

/**
 * 検索の言葉に合う作品。書名と著者を見る。空白で区切った言葉は、すべてを
 * 含む作品だけが合う。言葉がなければ、すべての作品が合う。
 */
export function matchesSearch(book: Book, query: string): boolean {
  const words = folded(query).split(/\s+/).filter(Boolean);
  const text = folded(`${book.title}\n${book.author}`);
  return words.every((word) => text.includes(word));
}
