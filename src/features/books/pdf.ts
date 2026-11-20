import PdfText from "../../../modules/pdf-text/src/PdfTextModule";
import type { Book, Chapter, ContentNode, PageRange } from "./book";
import { pdfContent } from "./pdfText";

const pagesPerChapter = 10;
const sampledPages = 5;

const unreadable = "ファイルを読み込めませんでした。";

function reader(): NonNullable<typeof PdfText> {
  if (!PdfText) {
    throw new Error(
      "このバージョンのアプリでは、この形式のファイルを読み込めません。",
    );
  }
  return PdfText;
}

function explained(error: unknown): Error {
  const code =
    error && typeof error === "object" && "code" in error ? error.code : null;
  return new Error(
    code === "ERR_PDF_LOCKED"
      ? "パスワードが付いたファイルには対応していません。"
      : unreadable,
  );
}

function chapterTitle({ from, count }: PageRange): string {
  return count > 1 ? `p.${from + 1}–${from + count}` : `p.${from + 1}`;
}

export async function openPdf(uri: string, id: string): Promise<Book> {
  const native = reader();
  const info = await native.info(uri).catch((error: unknown) => {
    throw explained(error);
  });
  if (!(info.pages > 0)) {
    throw new Error(unreadable);
  }
  const chapters: Chapter[] = [];
  for (let from = 0; from < info.pages; from += pagesPerChapter) {
    const pages = {
      from,
      count: Math.min(pagesPerChapter, info.pages - from),
    };
    chapters.push({
      id: `p${from + 1}`,
      title: chapterTitle(pages),
      content: [],
      pages,
    });
  }
  return {
    id,
    source: "file",
    title: info.title.trim() || id.replace(/\.[^.]+$/, ""),
    author: info.author.trim(),
    chapters,
  };
}

export async function checkPdfText(uri: string): Promise<void> {
  const native = reader();
  try {
    const { pages } = await native.info(uri);
    const sample = [
      ...new Set(
        Array.from({ length: sampledPages }, (_, index) =>
          Math.round((index * (pages - 1)) / (sampledPages - 1)),
        ),
      ),
    ];
    const texts = await native.texts(uri, sample);
    if (texts.some((text) => text.trim().length > 0)) {
      return;
    }
  } catch (error) {
    throw explained(error);
  }
  throw new Error(
    "このファイルには文字の情報がありません。画像だけのファイルは読み上げできません。",
  );
}

const coverWidth = 600;

export async function pdfCover(uri: string): Promise<string | undefined> {
  try {
    const jpeg = await reader().cover?.(uri, coverWidth);
    return jpeg ? `data:image/jpeg;base64,${jpeg}` : undefined;
  } catch {
    return undefined;
  }
}

export async function readPdfPages(
  uri: string,
  { from, count }: PageRange,
): Promise<ContentNode[]> {
  const texts = await reader().texts(
    uri,
    Array.from({ length: count }, (_, index) => from + index),
  );
  return pdfContent(texts);
}
