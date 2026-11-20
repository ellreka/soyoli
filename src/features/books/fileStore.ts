import { Directory, File, Paths } from "expo-file-system";

import { toBookSeries, type Book, type BookSeries } from "./book";

export interface SavedFile {
  id: string;
  title: string;
  author: string;
  file: string;
  cover?: string;
  series?: BookSeries;
  addedAt: number;
}

const INDEX_NAME = "files.json";
const FOLDER = "books";

function folder(): Directory {
  return new Directory(Paths.document, FOLDER);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isStoreName(value: unknown): value is string {
  return isText(value) && /^[a-z0-9]+\.[a-z0-9]+$/.test(value);
}

function toSavedFile(value: unknown): SavedFile | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const { id, title, author, file, cover, series, addedAt } = value as Record<
    string,
    unknown
  >;
  const kept = toBookSeries(series);
  if (!isText(id) || !isText(title) || !isStoreName(file)) {
    return null;
  }
  return {
    id,
    title,
    author: typeof author === "string" ? author : "",
    file,
    ...(isStoreName(cover) ? { cover } : {}),
    ...(kept ? { series: kept } : {}),
    addedAt: typeof addedAt === "number" ? addedAt : 0,
  };
}

export function loadFiles(): SavedFile[] {
  try {
    const index = new File(Paths.document, INDEX_NAME);
    const value: unknown = index.exists ? JSON.parse(index.textSync()) : [];
    const files: SavedFile[] = [];
    for (const item of Array.isArray(value) ? value : []) {
      const saved = toSavedFile(item);
      if (saved && !files.some((other) => other.id === saved.id)) {
        files.push(saved);
      }
    }
    return files.sort((a, b) => b.addedAt - a.addedAt);
  } catch {
    return [];
  }
}

function writeIndex(files: SavedFile[]): void {
  const index = new File(Paths.document, INDEX_NAME);
  index.create({ overwrite: true });
  index.writeSync(JSON.stringify(files));
}

function discard(name: string | undefined): void {
  if (!name) {
    return;
  }
  try {
    const file = new File(folder(), name);
    if (file.exists) {
      file.delete();
    }
  } catch {}
}

function decodeImage(
  uri: string,
): { bytes: Uint8Array; extension: string } | null {
  const match = /^data:image\/([a-z0-9]+)[^;,]*;base64,(.+)$/i.exec(uri);
  if (!match) {
    return null;
  }
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return { bytes, extension: match[1].toLowerCase() };
}

export function coverUri(saved: SavedFile): string | undefined {
  return saved.cover ? new File(folder(), saved.cover).uri : undefined;
}

export function saveFile(
  book: Book,
  bytes: Uint8Array,
  extension: string,
): SavedFile {
  const directory = folder();
  if (!directory.exists) {
    directory.create({ intermediates: true });
  }
  const files = loadFiles();
  const previous = files.find((item) => item.id === book.id);
  const key = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const file = new File(directory, `${key}.${extension}`);
  file.create({ overwrite: true });
  file.writeSync(bytes);
  const image = book.cover ? decodeImage(book.cover) : null;
  let cover: string | undefined;
  if (image) {
    cover = `${key}c.${image.extension}`;
    const target = new File(directory, cover);
    target.create({ overwrite: true });
    target.writeSync(image.bytes);
  }
  const saved: SavedFile = {
    id: book.id,
    title: book.title,
    author: book.author,
    file: file.name,
    ...(cover ? { cover } : {}),
    ...(book.series ? { series: book.series } : {}),
    addedAt: Date.now(),
  };
  writeIndex([saved, ...files.filter((item) => item.id !== book.id)]);
  discard(previous?.file);
  discard(previous?.cover);
  return saved;
}

export function keepSeries(id: string, series: BookSeries | undefined): void {
  const files = loadFiles();
  const saved = files.find((item) => item.id === id);
  if (!saved || JSON.stringify(saved.series) === JSON.stringify(series)) {
    return;
  }
  const { series: _old, ...rest } = saved;
  writeIndex(
    files.map((item) =>
      item === saved ? { ...rest, ...(series ? { series } : {}) } : item,
    ),
  );
}

export function removeFile(id: string): void {
  const files = loadFiles();
  const saved = files.find((item) => item.id === id);
  if (!saved) {
    return;
  }
  writeIndex(files.filter((item) => item.id !== id));
  discard(saved.file);
  discard(saved.cover);
}

export function fileUri(name: string): string {
  return new File(folder(), name).uri;
}

export async function withTempFile<T>(
  bytes: Uint8Array,
  extension: string,
  run: (uri: string) => Promise<T>,
): Promise<T> {
  const file = new File(Paths.cache, `import.${extension}`);
  file.create({ overwrite: true });
  file.writeSync(bytes);
  try {
    return await run(file.uri);
  } finally {
    try {
      file.delete();
    } catch {}
  }
}

export function readFile(saved: SavedFile): Promise<Uint8Array> {
  return new File(folder(), saved.file).bytes();
}
