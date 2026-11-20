import { File, Paths } from "expo-file-system";

export interface JsonFile {
  read: () => unknown;
  write: (value: unknown) => void;
}

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
      } catch {}
    },
  };
}
