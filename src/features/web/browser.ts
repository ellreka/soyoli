// アプリ内ブラウザが受け取り、表示する形のアドレス。サイトそのものに
// ついてアプリが知っていることは `sites/` にある。

// URL ではなく正規表現を使う: React Native の URL は host/pathname を実装していない。
const webUrl = /^https?:\/\/([^/?#]+)([^?#]*)/i;
const scheme = /^[a-z][a-z\d+.-]*:\/\//i;
const bareHost = /^[^\s/]+\.[a-z]{2,}(?:[/?#]\S*)?$/i;

/**
 * アプリ内ブラウザで読み込むのは Web ページだけ。ほかのスキーム（tel:、
 * intent:、アプリリンク）は、別のアプリに渡さずに捨てる。
 */
export function canLoadInBrowser(url: string): boolean {
  return url === "about:blank" || webUrl.test(url);
}

/** ホストとパス。スキーム、クエリ、末尾のスラッシュは付けない。 */
export function displayUrl(url: string): string {
  const match = webUrl.exec(url);
  if (!match) {
    return url;
  }
  return `${match[1]}${match[2]}`.replace(/\/$/, "");
}

export function isSecureUrl(url: string): boolean {
  return /^https:\/\//i.test(url);
}

/**
 * ブラウザの画面で `url` を開くルートのパラメータ。ルーターはパラメータの
 * 値をデコードするので、URL の中のパーセントエスケープ（たとえば検索
 * キーワード）が剥がれてしまう。そこで URL はもう一度エスケープして渡す。
 */
export function browseParams(url: string): { url: string } {
  return { url: encodeURIComponent(url) };
}

/** ブラウザのルートを開いたときのページ。Web の URL でなければ null。 */
export function urlFromParam(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  if (canLoadInBrowser(value)) {
    return value;
  }
  try {
    const decoded = decodeURIComponent(value);
    return canLoadInBrowser(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * 入力されたアドレスを、読み込める URL にする: ホストだけなら https:// を
 * 前に付け、Web でないスキーム（file:、intent:）のリンクは何にもならない。
 */
export function resolveAddress(text: string): string | null {
  const target = text.trim();
  if (!target) {
    return null;
  }
  if (scheme.test(target)) {
    return webUrl.test(target) ? target : null;
  }
  return `https://${target}`;
}

/**
 * ホームのアドレス欄が開くもの: Web のアドレス（https:// の有無は問わない）
 * ならその文字列、それ以外は何も開かない — キーワードでは検索しない。
 */
export function resolveWebAddress(text: string): string | null {
  const address = text.trim();
  return scheme.test(address) || bareHost.test(address)
    ? resolveAddress(address)
    : null;
}
