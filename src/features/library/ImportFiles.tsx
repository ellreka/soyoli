import { createContext, useContext, useState, type ReactNode } from "react";

import { withLoadedPages } from "@/features/books/book";
import { importFiles, type ImportResult } from "@/features/books/import";
import { useOpenBook } from "@/features/loading/useOpenBook";
import { useSubscription, type Subscription } from "@/lib/subscription";
import { useLibrary } from "./Library";

export const noticeMs = 6000;

interface ImportFilesValue {
  importing: boolean;
  progress: { done: number; total: number } | null;
  result: ImportResult | null;
  notice: ImportResult | null;
  dismiss: () => void;
  start: () => void;
}

const ImportFilesContext = createContext<ImportFilesValue | null>(null);

export function ImportFilesProvider({ children }: { children: ReactNode }) {
  const { addBook } = useLibrary();
  const open = useOpenBook();
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportFilesValue["progress"]>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [notice, setNotice] = useState<ImportResult | null>(null);

  const [expiry, setExpiry] = useState<{ subscribe: Subscription } | null>(
    null,
  );
  useSubscription(notice && expiry ? expiry.subscribe : null);

  function expireLater(shown: ImportResult): Subscription {
    return () => {
      const timer = setTimeout(() => {
        setNotice((current) => (current === shown ? null : current));
      }, noticeMs);
      return () => {
        clearTimeout(timer);
      };
    };
  }

  function finish(imported: ImportResult): void {
    setResult(imported);
    setNotice(imported);
    setExpiry(
      imported.failed.length === 0
        ? { subscribe: expireLater(imported) }
        : null,
    );
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
        if (imported) {
          for (const book of imported.added.toReversed()) {
            const current = open.current();
            if (current?.id === book.id) {
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
