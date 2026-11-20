import { jsonFile } from "@/lib/jsonFile";

export type ShelfView = "grid" | "list";

const file = jsonFile("bookshelf.json");

export function loadShelfView(): ShelfView {
  const value = file.read();
  return (value as { view?: unknown } | null)?.view === "list"
    ? "list"
    : "grid";
}

export function saveShelfView(view: ShelfView): void {
  file.write({ view });
}
