import type { Book } from "@/features/books/book";
import { bySeries, isSeries } from "@/features/books/series";

function file(title: string, name?: string, position?: number): Book {
  return {
    id: `${title}.epub`,
    source: "file",
    title,
    author: "著者",
    ...(name && {
      series: { name, ...(position !== undefined && { position }) },
    }),
    chapters: [],
  };
}

it("groups the volumes of one series, in volume order, where the first of them stood", () => {
  const other = file("別の本");
  const third = file("帰還", "銀河の旅", 3);
  const first = file("旅立ち", "銀河の旅", 1);
  const second = file("星の海", "銀河の　旅", 2);
  const unnumbered = file("外伝", "銀河の旅");
  const items = bySeries([other, third, unnumbered, first, second]);
  expect(items).toHaveLength(2);
  expect(items[0]).toBe(other);
  expect(items[1]).toMatchObject({
    title: "銀河の旅",
    author: "著者",
    volumes: [first, second, third, unnumbered],
    latest: third,
  });
});

it("never guesses a series from titles", () => {
  const books = [file("銀河の旅 1"), file("銀河の旅 2"), file("銀河の旅 3")];
  expect(bySeries(books)).toEqual(books);
});

it("leaves alone a lone volume and Web novels", () => {
  const lone = file("旅立ち", "銀河の旅", 1);
  const web: Book = { ...file("星の海", "銀河の旅", 2), source: "kakuyomu" };
  const items = bySeries([lone, web]);
  expect(items).toEqual([lone, web]);
  expect(items.some(isSeries)).toBe(false);
});
