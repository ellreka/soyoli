import { Directory, File } from "expo-file-system";

/** バックアップを保存した結果。保存先を選ばなければ `canceled`。 */
export type SavedBackup =
  | { canceled: true }
  | { canceled: false; /** 保存したファイルの名前。 */ name: string };

/**
 * バックアップを JSON ファイルにして、読者が選んだフォルダに保存する:
 * システムのピッカーで保存先（ダウンロード、ドキュメントなど）を選ばせ、
 * そこにファイルを作る。同じ名前がすでにあれば、どう名付けるかは端末が
 * 決める。書けなければ reject する。
 */
export async function saveBackup(
  name: string,
  value: object,
): Promise<SavedBackup> {
  let folder: Directory;
  try {
    folder = await Directory.pickDirectoryAsync();
  } catch {
    // 選ばずに閉じたときも reject で返ってくる（`File.pickFileAsync` と違い、
    // ライブラリは包んでくれない）。
    return { canceled: true };
  }
  const file = folder.createFile(name, "application/json");
  file.writeSync(JSON.stringify(value, null, 2));
  return { canceled: false, name: file.name };
}

/** 読者が選んだファイルの中身。選ばなければ `canceled`。 */
export type PickedBackup =
  | { canceled: true }
  | { canceled: false; value: unknown };

/**
 * システムのファイルピッカーを開き、選ばれたファイルを JSON として読む。
 * 読んだものはここでは確かめない（`fromBackupFile` が検証する）。JSON で
 * なければ reject する。
 */
export async function pickBackup(): Promise<PickedBackup> {
  const pick = await File.pickFileAsync({
    // 置き場所によっては、JSON をただのテキストやバイナリとして出してくる。
    mimeTypes: ["application/json", "text/plain", "application/octet-stream"],
  });
  if (pick.canceled) {
    return { canceled: true };
  }
  return { canceled: false, value: JSON.parse(await pick.result.text()) };
}
