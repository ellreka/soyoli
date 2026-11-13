import { Directory, File, Paths } from "expo-file-system";

import type { Book } from "./book";

/**
 * ファイルから取り込んで端末に保存した作品: ファイルそのもの、独立した
 * 画像としての表紙、本棚に見せる情報。本文は起動時ではなく、作品を開いた
 * ときにファイルから読む。
 */
export interface SavedFile {
  /** 本の id: 取り込んだときのファイルの名前。 */
  id: string;
  title: string;
  author: string;
  /** ストアの中での名前。ストアの場所はインストールごとに変わりうる。 */
  file: string;
  cover?: string;
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

/** ストアが自分で作った名前: フォルダの外へ出られるものを含まない。 */
function isStoreName(value: unknown): value is string {
  return isText(value) && /^[a-z0-9]+\.[a-z0-9]+$/.test(value);
}

function toSavedFile(value: unknown): SavedFile | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const { id, title, author, file, cover, addedAt } = value as Record<
    string,
    unknown
  >;
  if (!isText(id) || !isText(title) || !isStoreName(file)) {
    return null;
  }
  return {
    id,
    title,
    author: typeof author === "string" ? author : "",
    file,
    ...(isStoreName(cover) ? { cover } : {}),
    addedAt: typeof addedAt === "number" ? addedAt : 0,
  };
}

/** 保存したファイル。新しい順。索引の中の壊れた項目は落とす。 */
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
  } catch {
    /* 残ったファイルは容量を食うだけ。 */
  }
}

/** `data:` URI の中の画像と、保存するときの拡張子。 */
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

/** 保存したファイルの表紙が今ある場所。画像として表示するため。 */
export function coverUri(saved: SavedFile): string | undefined {
  return saved.cover ? new File(folder(), saved.cover).uri : undefined;
}

/**
 * 解析した作品のファイルを端末に保存する。同じ名前のファイルをもう一度
 * 取り込むと、保存してあったものを置き換える。端末が保存できないときは投げる。
 */
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
    addedAt: Date.now(),
  };
  writeIndex([saved, ...files.filter((item) => item.id !== book.id)]);
  discard(previous?.file);
  discard(previous?.cover);
  return saved;
}

/** 保存した作品のファイルと表紙を削除し、記録からも消す。 */
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

/** ストアのファイルが今ある場所。ネイティブコードが読むため。 */
export function fileUri(name: string): string {
  return new File(folder(), name).uri;
}

/**
 * バイト列を独立したファイルに入れて `run` を実行する。バイト列ではなく
 * ファイルを受け取るリーダーのためのもの。ファイルは終わると消える。
 */
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
    } catch {
      /* キャッシュを消すのはシステムの役目。 */
    }
  }
}

/** 保存した作品のファイルのバイト列。 */
export function readFile(saved: SavedFile): Promise<Uint8Array> {
  return new File(folder(), saved.file).bytes();
}
