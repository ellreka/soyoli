import { useState } from "react";

import type { Book } from "@/features/books/book";
import { importFile } from "@/features/books/import";
import { useLibrary } from "./Library";

interface ImportFile {
  importing: boolean;
  error: string | null;
  /** システムのファイルピッカーを開く。選んだファイルは保存され、本棚に入る。 */
  start: () => void;
}

/** すべての「追加」の入口で共有する、ファイルの取り込み。 */
export function useImportFile(onAdded?: (book: Book) => void): ImportFile {
  const { addBook } = useLibrary();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function start(): void {
    if (importing) {
      return;
    }
    setImporting(true);
    importFile()
      .then((book) => {
        setError(null);
        if (book) {
          addBook(book);
          onAdded?.(book);
        }
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "ファイルを読み込めませんでした。",
        );
      })
      .finally(() => {
        setImporting(false);
      });
  }

  return { importing, error, start };
}
