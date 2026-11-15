import type { Book } from "@/features/books/book";
import { matchesSearch } from "@/features/library/search";

const book: Book = {
  id: "b",
  source: "narou",
  title: "ＡＢＣ物語　カタカナ",
  author: "山田 太郎",
  chapters: [],
};

it("matches every work when there is nothing to search for", () => {
  expect(matchesSearch(book, "")).toBe(true);
  expect(matchesSearch(book, "  ")).toBe(true);
});

it("looks in the title and the author", () => {
  expect(matchesSearch(book, "物語")).toBe(true);
  expect(matchesSearch(book, "太郎")).toBe(true);
  expect(matchesSearch(book, "花子")).toBe(false);
});

it("ignores width, case and the kind of kana", () => {
  expect(matchesSearch(book, "abc")).toBe(true);
  expect(matchesSearch(book, "かたかな")).toBe(true);
});

it("needs every word, in any order", () => {
  expect(matchesSearch(book, "山田　物語")).toBe(true);
  expect(matchesSearch(book, "山田 花子")).toBe(false);
});
