import { Directory, File } from "expo-file-system";

export type SavedBackup =
  | { canceled: true }
  | { canceled: false; name: string };

export async function saveBackup(
  name: string,
  value: object,
): Promise<SavedBackup> {
  let folder: Directory;
  try {
    folder = await Directory.pickDirectoryAsync();
  } catch {
    return { canceled: true };
  }
  const file = folder.createFile(name, "application/json");
  file.writeSync(JSON.stringify(value, null, 2));
  return { canceled: false, name: file.name };
}

export type PickedBackup =
  | { canceled: true }
  | { canceled: false; value: unknown };

export async function pickBackup(): Promise<PickedBackup> {
  const pick = await File.pickFileAsync({
    mimeTypes: ["application/json", "text/plain", "application/octet-stream"],
  });
  if (pick.canceled) {
    return { canceled: true };
  }
  return { canceled: false, value: JSON.parse(await pick.result.text()) };
}
