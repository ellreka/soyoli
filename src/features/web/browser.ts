// WORKAROUND: React Native の URL は host/pathname を実装していない。URL ではなく正規表現を使う。
const webUrl = /^https?:\/\/([^/?#]+)([^?#]*)/i;
const scheme = /^[a-z][a-z\d+.-]*:\/\//i;
const bareHost = /^[^\s/]+\.[a-z]{2,}(?:[/?#]\S*)?$/i;

export function canLoadInBrowser(url: string): boolean {
  return url === "about:blank" || webUrl.test(url);
}

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

export function browseParams(url: string): { url: string } {
  return { url: encodeURIComponent(url) };
}

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

export function resolveWebAddress(text: string): string | null {
  const address = text.trim();
  return scheme.test(address) || bareHost.test(address)
    ? resolveAddress(address)
    : null;
}
