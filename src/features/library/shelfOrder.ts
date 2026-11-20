import { jsonFile } from "@/lib/jsonFile";

export interface ShelfEntry {
  id: string;
  openedAt?: number;
}

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

export function inOrder<T extends { id: string }>(
  works: readonly T[],
  order: readonly string[],
): T[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  const place = (work: T) => rank.get(work.id) ?? order.length;
  return [...works].sort((a, b) => place(a) - place(b));
}
