import { File } from "expo-file-system";

import type { Book } from "./book";
import { parseEpub } from "./epub";
import {
  coverUri,
  fileUri,
  loadFiles,
  readFile,
  saveFile,
  withTempFile,
  type SavedFile,
} from "./fileStore";
import { checkPdfText, openPdf, pdfCover } from "./pdf";

/** ある種類のファイルが本になる方法: バイト列から、またはその場所から。 */
type Reader =
  | { parse: (bytes: Uint8Array, id: string) => Book }
  | {
      /** `file://` URI のファイルを読む。本文は後から来てもよい。 */
      open: (uri: string, id: string) => Promise<Book>;
      /** 読み上げられないファイルを、取り込むときに断る。 */
      check: (uri: string) => Promise<void>;
      /** `data:` URI の表紙。ファイルを取り込むときに一度だけ作る。 */
      cover: (uri: string) => Promise<string | undefined>;
    };

type Format = Reader & {
  extension: string;
  mimeTypes: string[];
  /** 取り込める最大のファイル（バイト）。リーダー自身に上限がない場合に使う。 */
  maxBytes?: number;
  /** バイト列がこの種類に見えるかどうか。名前から分からないファイル用。 */
  looksLike: (bytes: Uint8Array) => boolean;
};

/** 取り込めるファイルの種類。新しい種類は、項目を 1 つ足すだけ。 */
const formats: Format[] = [
  {
    extension: "epub",
    mimeTypes: ["application/epub+zip"],
    // zip アーカイブ（"PK"）。残りはパーサーが確かめる。
    looksLike: (bytes) => bytes[0] === 0x50 && bytes[1] === 0x4b,
    parse: parseEpub,
  },
  {
    extension: "pdf",
    mimeTypes: ["application/pdf"],
    // ファイルは、端末へコピーする間に一度メモリに載る。
    maxBytes: 64 * 1024 * 1024,
    // "%PDF"
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

/**
 * ファイルの種類: 名前から、名前で分からなければ先頭のバイトから決める
 * （Android のピッカーは、ファイル名ではなくドキュメント ID を渡してくる）。
 */
function formatOf(name: string, bytes: Uint8Array): Format {
  const format = named(name) ?? formats.find((item) => item.looksLike(bytes));
  if (!format) {
    throw new Error("この形式のファイルには対応していません。");
  }
  return format;
}

/** 本棚が持つ形の本: 端末に保存され、表紙はファイルになっている。 */
function withStore(book: Book, saved: SavedFile): Book {
  return { ...book, file: saved.file, cover: coverUri(saved) ?? book.cover };
}

/**
 * 保存した作品を、起動時に本棚が見せる形で返す: 本文はまだない。本文は、
 * 作品を開いたときに `openSavedFile` から来る。
 */
export function savedFileBooks(): Book[] {
  return loadFiles().map((saved) => ({
    id: saved.id,
    source: "file",
    title: saved.title,
    author: saved.author,
    cover: coverUri(saved),
    file: saved.file,
    chapters: [],
  }));
}

/** 保存した作品のファイルを読んで、ビューアーが表示する本にする。 */
export async function openSavedFile(id: string): Promise<Book> {
  const saved = loadFiles().find((item) => item.id === id);
  if (!saved) {
    throw new Error("保存したファイルが見つかりません。");
  }
  try {
    // ストアは、種類に応じた名前をファイルに付けている。
    const format = named(saved.file);
    if (!format) {
      throw new Error(unreadable);
    }
    const book =
      "open" in format
        ? await format.open(fileUri(saved.file), saved.id)
        : format.parse(await readFile(saved), saved.id);
    return withStore(book, saved);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : unreadable);
  }
}

/**
 * システムのファイルピッカーを開き、選ばれたファイルを読んで、そのコピーを
 * 端末に保存する。作品が本棚に残るようにするため。
 */
export async function importFile(): Promise<Book | null> {
  const pick = await File.pickFileAsync({
    mimeTypes: formats.flatMap((format) => format.mimeTypes),
  });
  if (pick.canceled) {
    return null;
  }
  const file = pick.result;
  try {
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
    // id は、作品の位置と辞書を保存するときのキー: ファイルの名前があれば
    // それを、なければタイトルを使う。同じファイルをもう一度取り込んだときに
    // それらが見つかるようにするため。
    const book = named(file.name)
      ? parsed
      : { ...parsed, id: `${parsed.title}.${format.extension}` };
    return withStore(book, saveFile(book, bytes, format.extension));
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : unreadable);
  }
}
