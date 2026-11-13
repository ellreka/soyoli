import { jsonFile } from "@/lib/jsonFile";

/** 本棚が作品を並べる方法。 */
export type ShelfView = "grid" | "list";

const file = jsonFile("bookshelf.json");

/** 最後に選んだレイアウト。選ぶまではグリッド。 */
export function loadShelfView(): ShelfView {
  const value = file.read();
  return (value as { view?: unknown } | null)?.view === "list"
    ? "list"
    : "grid";
}

export function saveShelfView(view: ShelfView): void {
  file.write({ view });
}
