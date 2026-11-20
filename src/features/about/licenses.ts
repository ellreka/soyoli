export interface LicensedPackage {
  id: string;
  name: string;
  version?: string;
  license: string;
  homepage?: string;
  text?: string;
}

interface LicenseFile {
  packages: (Omit<LicensedPackage, "id" | "text"> & { text?: number })[];
  texts: string[];
}

let loaded: readonly LicensedPackage[] | null = null;

export function licensedPackages(): readonly LicensedPackage[] {
  if (!loaded) {
    // SAFETY: アプリに同梱した、スクリプトが書いたファイル。端末に保存した
    // ファイルと違い、読者や古いバージョンが書き換えることはない。
    const file = require("../../../assets/licenses.json") as LicenseFile;
    loaded = file.packages.map(({ text, ...item }) => ({
      ...item,
      id: item.version ? `${item.name}@${item.version}` : item.name,
      ...(text !== undefined && { text: file.texts[text] }),
    }));
  }
  return loaded;
}

export function findPackage(id: string): LicensedPackage | undefined {
  return licensedPackages().find((item) => item.id === id);
}
