import { jsonFile } from "@/lib/jsonFile";

/** 読み方辞書。`toDictionary` が検証する。 */
const file = jsonFile("dictionary.json");

export function loadDictionary(): unknown {
  return file.read();
}

export function saveDictionary(value: object): void {
  file.write(value);
}
