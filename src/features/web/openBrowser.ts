import { router } from "expo-router";

import { browseParams } from "./browser";

let opened = 0;

export function openInBrowser(url: string): void {
  opened += 1;
  router.navigate(
    {
      pathname: "/home/browse",
      params: { ...browseParams(url), at: String(opened) },
    },
    { withAnchor: true },
  );
}
