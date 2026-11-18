import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { withLoadedPages } from "@/features/books/book";
import { importFiles, type ImportResult } from "@/features/books/import";
import { useOpenBook } from "@/features/loading/useOpenBook";
import { useLibrary } from "./Library";

/** 取り込みの知らせが、自分で消えるまでの時間。 */
export const noticeMs = 6000;

interface ImportFilesValue {
  importing: boolean;
  /** 取り込みの最中なら、どこまで進んだか。 */
  progress: { done: number; total: number } | null;
  /** 最後の取り込みの結果。次の取り込みを始めると入れ替わる。 */
  result: ImportResult | null;
  /**
   * まだ出ている知らせ。作品が入っただけなら少し経つと自分で消え、読めない
   * ファイルがあったときは閉じるまで残る。
   */
  notice: ImportResult | null;
  dismiss: () => void;
  /**
   * システムのファイルピッカーを開く。選んだファイルは保存され、本棚に入る。
   * 入れるだけで、開かない: 読み上げ中の作品はそのまま続く。
   */
  start: () => void;
}

const ImportFilesContext = createContext<ImportFilesValue | null>(null);

/**
 * ファイルの取り込みと、その結果の知らせ。アプリ全体で 1 つ: 取り込みは
 * ホームで始まるが、知らせはどのタブにいても見える。
 */
export function ImportFilesProvider({ children }: { children: ReactNode }) {
  const { addBook } = useLibrary();
  // 取り込みは時間がかかる。開いている本は、終わったときのものを見る。
  const open = useOpenBook();
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportFilesValue["progress"]>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [notice, setNotice] = useState<ImportResult | null>(null);

  useEffect(() => {
    // 読めなかったファイルの知らせは、読まれないまま消えてはならない。
    if (!notice || notice.failed.length > 0) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setNotice(null);
    }, noticeMs);
    return () => {
      clearTimeout(timer);
    };
  }, [notice]);

  function finish(imported: ImportResult): void {
    setResult(imported);
    setNotice(imported);
  }

  function start(): void {
    if (importing) {
      return;
    }
    setImporting(true);
    importFiles((done, total) => {
      setProgress({ done, total });
    })
      .then((imported) => {
        // ピッカーを閉じただけなら、前の結果を残す。
        if (imported) {
          // 本棚の先頭には、選んだ順に並ぶ。
          for (const book of imported.added.toReversed()) {
            const current = open.current();
            if (current?.id === book.id) {
              // 開いている本を取り込み直した: 保存してあったファイルは
              // 消えたので、プレーヤーが持つ本も新しいファイルを指す
              // ものに替える。読んだ本文は引き継ぎ、読み上げは続く。
              open.replace(withLoadedPages(book, current));
            } else {
              addBook(book);
            }
          }
          finish(imported);
        }
      })
      .catch((cause: unknown) => {
        finish({
          added: [],
          failed: [
            {
              name: "",
              message:
                cause instanceof Error
                  ? cause.message
                  : "ファイルを読み込めませんでした。",
            },
          ],
        });
      })
      .finally(() => {
        setImporting(false);
        setProgress(null);
      });
  }

  return (
    <ImportFilesContext
      value={{
        importing,
        progress,
        result,
        notice,
        dismiss: () => {
          setNotice(null);
        },
        start,
      }}
    >
      {children}
    </ImportFilesContext>
  );
}

export function useImportFiles(): ImportFilesValue {
  const value = useContext(ImportFilesContext);
  if (!value) {
    throw new Error("ImportFilesProviderが必要です。");
  }
  return value;
}
