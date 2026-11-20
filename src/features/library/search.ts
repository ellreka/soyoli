import type { Book } from "@/features/books/book";

function folded(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (kana) =>
      String.fromCharCode(kana.charCodeAt(0) - 0x60),
    );
}

export function matchesSearch(book: Book, query: string): boolean {
  const words = folded(query).split(/\s+/).filter(Boolean);
  const text = folded(`${book.title}\n${book.author}`);
  return words.every((word) => text.includes(word));
}
