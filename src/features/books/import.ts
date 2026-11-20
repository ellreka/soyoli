import { File } from "expo-file-system";

import type { Book } from "./book";
import { parseEpub } from "./epub";
import {
  coverUri,
  fileUri,
  keepSeries,
  loadFiles,
  readFile,
  saveFile,
  withTempFile,
  type SavedFile,
} from "./fileStore";
import { checkPdfText, openPdf, pdfCover } from "./pdf";

type Reader =
  | { parse: (bytes: Uint8Array, id: string) => Book }
  | {
      open: (uri: string, id: string) => Promise<Book>;
      check: (uri: string) => Promise<void>;
      cover: (uri: string) => Promise<string | undefined>;
    };

type Format = Reader & {
  extension: string;
  mimeTypes: string[];
  maxBytes?: number;
  looksLike: (bytes: Uint8Array) => boolean;
};

const formats: Format[] = [
  {
    extension: "epub",
    mimeTypes: ["application/epub+zip"],
    looksLike: (bytes) => bytes[0] === 0x50 && bytes[1] === 0x4b,
    parse: parseEpub,
  },
  {
    extension: "pdf",
    mimeTypes: ["application/pdf"],
    maxBytes: 64 * 1024 * 1024,
    looksLike: (bytes) =>
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46,
    open: openPdf,
    check: checkPdfText,
    cover: pdfCover,
  },
];

const unreadable = "ファイルを読み込めませんでした。";

function named(name: string): Format | undefined {
  const extension = /\.([^.]+)$/.exec(name)?.[1].toLowerCase();
  return formats.find((item) => item.extension === extension);
}

// WORKAROUND: Android のピッカーは、ファイル名ではなくドキュメント ID を渡してくる。名前で分からなければ先頭のバイトから種類を決める。
function formatOf(name: string, bytes: Uint8Array): Format {
  const format = named(name) ?? formats.find((item) => item.looksLike(bytes));
  if (!format) {
    throw new Error("この形式のファイルには対応していません。");
  }
  return format;
}

function withStore(book: Book, saved: SavedFile): Book {
  return { ...book, file: saved.file, cover: coverUri(saved) ?? book.cover };
}

export function savedFileBooks(): Book[] {
  return loadFiles().map((saved) => ({
    id: saved.id,
    source: "file",
    title: saved.title,
    author: saved.author,
    cover: coverUri(saved),
    ...(saved.series && { series: saved.series }),
    file: saved.file,
    chapters: [],
  }));
}

export async function openSavedFile(id: string): Promise<Book> {
  const saved = loadFiles().find((item) => item.id === id);
  if (!saved) {
    throw new Error("保存したファイルが見つかりません。");
  }
  try {
    const format = named(saved.file);
    if (!format) {
      throw new Error(unreadable);
    }
    const book =
      "open" in format
        ? await format.open(fileUri(saved.file), saved.id)
        : format.parse(await readFile(saved), saved.id);
    try {
      keepSeries(saved.id, book.series);
    } catch {}
    return withStore(book, saved);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : unreadable);
  }
}

export interface ImportFailure {
  name: string;
  message: string;
}

export interface ImportResult {
  added: Book[];
  failed: ImportFailure[];
}

async function importOne(file: File): Promise<Book> {
  const bytes = await file.bytes();
  const format = formatOf(file.name, bytes);
  if (format.maxBytes && bytes.length > format.maxBytes) {
    throw new Error(
      `ファイルは${format.maxBytes / 1024 / 1024} MB以下にしてください。`,
    );
  }
  const parsed =
    "open" in format
      ? await withTempFile(bytes, format.extension, async (uri) => {
          await format.check(uri);
          const opened = await format.open(uri, file.name);
          return { ...opened, cover: await format.cover(uri) };
        })
      : format.parse(bytes, file.name);
  const book = named(file.name)
    ? parsed
    : { ...parsed, id: `${parsed.title}.${format.extension}` };
  return {
    ...withStore(book, saveFile(book, bytes, format.extension)),
    chapters: [],
  };
}

export async function importFiles(
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult | null> {
  const pick = await File.pickFileAsync({
    mimeTypes: formats.flatMap((format) => format.mimeTypes),
    multipleFiles: true,
  });
  if (pick.canceled) {
    return null;
  }
  const result: ImportResult = { added: [], failed: [] };
  for (const [index, file] of pick.result.entries()) {
    onProgress?.(index, pick.result.length);
    try {
      // oxlint-disable-next-line no-await-in-loop
      const book = await importOne(file);
      result.added = [
        ...result.added.filter((other) => other.id !== book.id),
        book,
      ];
    } catch (error) {
      result.failed.push({
        name: file.name,
        message: error instanceof Error ? error.message : unreadable,
      });
    }
  }
  return result;
}
