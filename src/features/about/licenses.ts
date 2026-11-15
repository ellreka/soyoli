/** アプリが使っているライブラリ（か素材）1 つと、そのライセンス。 */
export interface LicensedPackage {
  /** 一覧の中でそのライブラリを指すもの: 名前とバージョン。 */
  id: string;
  name: string;
  /** ライブラリのバージョン。素材（音）にはない。 */
  version?: string;
  /** ライセンスの名前（SPDX の識別子）。 */
  license: string;
  /** ライブラリのページ。分かっている場合。 */
  homepage?: string;
  /** ライセンスの本文。ライブラリが同梱していなければない。 */
  text?: string;
}

/**
 * `assets/licenses.json` の形。`scripts/licenses.mjs` が書く。同じ本文を
 * 何度も持たないように、ライブラリは本文を `texts` の番号で指す。
 */
interface LicenseFile {
  packages: (Omit<LicensedPackage, "id" | "text"> & { text?: number })[];
  texts: string[];
}

let loaded: readonly LicensedPackage[] | null = null;

/**
 * アプリに入っているすべてのライブラリと素材。名前の順。一覧のファイルは大きい
 * ので、最初に求められたときに読む: ライセンスの画面を開かない限り、
 * 起動には関わらない。
 */
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
