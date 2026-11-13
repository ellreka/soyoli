import { router } from "expo-router";

import { browseParams } from "./browser";

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
 */
export function openInBrowser(url: string): void {
  router.navigate(
    { pathname: "/home/browse", params: browseParams(url) },
    { withAnchor: true },
  );
}
