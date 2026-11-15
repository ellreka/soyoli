import { router } from "expo-router";

import { browseParams } from "./browser";

/** これまでに `openInBrowser` がページを開いた回数。 */
let opened = 0;

/**
 * ページをアプリ内ブラウザで表示する。ブラウザは 1 つだけ: すでに開いて
 * いれば — 別のタブの下にあっても — そのブラウザをそのページへ移し、
 * 2 つ目を上に重ねない。それをするのが `navigate`: すでにある画面へ
 * 新しいページをパラメータにして移り、なければそのときだけ作る。
 *
 * `withAnchor` は、こうして作ったブラウザの下にホームを置く。これがないと、
 * ホームを一度も表示しないまま別のタブから開いたブラウザが、ホームタブの
 * 唯一の画面になる: 閉じて戻る先がなく、ホームタブのボタンにも戻るべき
 * 最初のページがない。
 *
 * `at` は開くたびに変わる。すでにあるブラウザは、前に開いたのと同じ
 * ページを渡されても — 読者がその中で別のページへ進んでいても — これで
 * そのページへ戻る。パラメータが同じままだと、`navigate` は何もしない。
 */
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
