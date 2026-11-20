import { jsonFile } from "@/lib/jsonFile";

const file = jsonFile("dictionary.json");

export function loadDictionary(): unknown {
  return file.read();
}

export function saveDictionary(value: object): void {
  file.write(value);
}
