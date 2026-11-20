import { sourceLabels, type WebSource } from "@/features/books/book";
import { hameln } from "./hameln";
import { kakuyomu } from "./kakuyomu";
import { narou } from "./narou";
import type { SiteListing, WebSite } from "./site";

export const webSites: readonly WebSite[] = [narou, kakuyomu, hameln];

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

export const listedSites: readonly ListedSite[] = webSites.flatMap((site) =>
  site.listing
    ? [{ id: site.id, name: sourceLabels[site.id], ...site.listing }]
    : [],
);

export function workUrlOf(bookId: string): string | null {
  const match = /^([a-z]+)-(.+)$/.exec(bookId);
  return match ? (siteById(match[1])?.workUrl(match[2]) ?? null) : null;
}

export function workPageOf(bookId: string, episodeUrl?: string): string | null {
  for (const site of episodeUrl ? webSites : []) {
    const page = site.workPageOf?.(episodeUrl ?? "");
    if (page) {
      return page;
    }
  }
  return workUrlOf(bookId);
}
