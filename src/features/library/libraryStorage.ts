import { jsonFile } from "@/lib/jsonFile";

const file = jsonFile("library.json");

export function loadLibrary(): unknown {
  return file.read();
}

export function saveLibrary(value: object): void {
  file.write(value);
}
