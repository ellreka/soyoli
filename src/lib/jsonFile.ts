import { File, Paths } from "expo-file-system";

export interface JsonFile {
  /** ファイルの中身。ファイルがないか、読めなければ null。 */
  read: () => unknown;
  /** ファイルを置き換える。失敗した書き込みは捨てる。 */
  write: (value: unknown) => void;
}

/**
 * アプリのドキュメントの中の JSON ファイル。起動をまたいで保存するものを
 * 入れる。ベストエフォート: 使えるドキュメントディレクトリがないところ
 * （テスト、一部の Web 環境）では何も読まず、何も書かず、アプリはメモリに
 * あるもので動き続ける。読んだものはここでは確かめない: ファイルは古い
 * バージョンのものかもしれず、壊れているかもしれないので、呼び出し側が
 * 検証する。
 */
export function jsonFile(name: string): JsonFile {
  return {
    read() {
      try {
        const file = new File(Paths.document, name);
        return file.exists ? (JSON.parse(file.textSync()) as unknown) : null;
      } catch {
        return null;
      }
    },
    write(value) {
      try {
        const file = new File(Paths.document, name);
        file.create({ overwrite: true });
        file.writeSync(JSON.stringify(value));
      } catch {
        /* 失われるのは永続化だけ。セッションは今あるものを持ち続ける。 */
      }
    },
  };
}
