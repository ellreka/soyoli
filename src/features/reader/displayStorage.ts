import { jsonFile } from "@/lib/jsonFile";

const file = jsonFile("reader-display.json");

export function loadDisplay(): Record<string, unknown> | null {
  const value = file.read();
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export function saveDisplay(value: object): void {
  file.write(value);
}
