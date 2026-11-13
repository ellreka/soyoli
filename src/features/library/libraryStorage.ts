import { jsonFile } from "@/lib/jsonFile";

/** 本棚と履歴の Web 小説。`fromSavedWorks` が検証する。 */
const file = jsonFile("library.json");

export function loadLibrary(): unknown {
  return file.read();
}

export function saveLibrary(value: object): void {
  file.write(value);
}
