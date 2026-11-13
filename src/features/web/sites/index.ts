import { sourceLabels, type WebSource } from "@/features/books/book";
import { hameln } from "./hameln";
import { kakuyomu } from "./kakuyomu";
import { narou } from "./narou";
import type { SiteListing, WebSite } from "./site";

/** Web 小説を読むサイト。新しいサイトは、項目を 1 つ足すだけ。 */
export const webSites: readonly WebSite[] = [narou, kakuyomu, hameln];

/** あるアドレスが、その話でありうるサイト。 */
export function siteOf(url: string): WebSite | undefined {
  return webSites.find((site) => site.mayBeEpisode(url));
}

export function siteById(id: string): WebSite | undefined {
  return webSites.find((site) => site.id === id);
}

export interface ListedSite extends SiteListing {
  id: WebSource;
  name: string;
}

/**
 * ホームに並べるサイト。ホームでの順。それ以外（なろう）の作品も、ページを
 * アドレスで開けば検出され、読める。ホームからそこへ案内しないだけ。
 */
export const listedSites: readonly ListedSite[] = webSites.flatMap((site) =>
  site.listing
    ? [{ id: site.id, name: sourceLabels[site.id], ...site.listing }]
    : [],
);

/**
 * アプリが作品に付ける id（`narou-n1234ab`、`kakuyomu-123…`、`hameln-123…`）
 * から得た、Web 小説のページ。ライブラリからなくなった作品でも、見分けて
 * もう一度見つけられる。それ以外では null（ファイル由来の作品の id は
 * ファイルの名前）。
 */
export function workUrlOf(bookId: string): string | null {
  const match = /^([a-z]+)-(.+)$/.exec(bookId);
  return match ? (siteById(match[1])?.workUrl(match[2]) ?? null) : null;
}

/**
 * Web 小説の話が属する作品のページ。サイトにホストが 2 つ以上ある場合は
 * 話のアドレスそのものから取り、実際に読んだほうのホストを保つ。
 */
export function workPageOf(bookId: string, episodeUrl?: string): string | null {
  for (const site of episodeUrl ? webSites : []) {
    const page = site.workPageOf?.(episodeUrl ?? "");
    if (page) {
      return page;
    }
  }
  return workUrlOf(bookId);
}
