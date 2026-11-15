/// <reference types="node" />
import { book, routes, chapterText, seed } from "@/testing/app";

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import { Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Speech from "expo-speech";
import { narouEpisodeHtml } from "@/__fixtures__/webPages";
import type { Book } from "@/features/books/book";
import { removeFile } from "@/features/books/fileStore";
import {
  importFile,
  openSavedFile,
  savedFileBooks,
} from "@/features/books/import";
import { loadLibrary, saveLibrary } from "@/features/library/libraryStorage";
import { loadShelfOrder, saveShelfOrder } from "@/features/library/shelfOrder";
import { saveShelfView } from "@/features/library/shelfView";
import { loadPlayback } from "@/features/player/storage";

it("shows the shelf as a grid or a list, without counts or filters, and continues from the mini player", async () => {
  await renderRouter(routes);
  const tile = await screen.findByRole("link", { name: "サンプル作品を開く" });
  // まだ開いていない作品は、話の名前の位置に著者を出す。
  expect(within(tile).getByText("サンプル著者")).toBeOnTheScreen();
  // まだ何も開いていない: 続きから読むものがない。
  expect(screen.queryByTestId("mini-player")).toBeNull();
  // 作品数も、入手元での絞り込みも、作品を追加するボタンもない。
  expect(screen.queryByText(/作品 ·/)).toBeNull();
  expect(screen.queryByRole("tab", { name: "なろう" })).toBeNull();
  expect(screen.queryByRole("button", { name: "作品を追加" })).toBeNull();
  expect(screen.getByRole("button", { name: "検索" })).toBeEnabled();
  expect(screen.getByRole("tab", { name: "本棚の作品" })).toBeSelected();
  // リストは各作品についてより多くを見せ、選んだ表示は保存される。
  await fireEvent.press(
    screen.getByRole("button", { name: "リスト表示にする" }),
  );
  expect(saveShelfView).toHaveBeenLastCalledWith("list");
  expect(
    within(screen.getByRole("link", { name: "サンプル作品を開く" })).getByText(
      "サンプル著者",
    ),
  ).toBeOnTheScreen();
  // 作品がファイル由来であることは、行に書くほどのことではない。
  expect(screen.queryByText(/EPUB|ファイル/)).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "グリッド表示にする" }),
  );
  expect(saveShelfView).toHaveBeenLastCalledWith("grid");
  // メニューには、その作品について分かっていることが出る。
  await fireEvent(
    screen.getByRole("link", { name: "サンプル作品を開く" }),
    "longPress",
  );
  expect(screen.getByTestId("action-unshelve")).toBeOnTheScreen();
  expect(screen.queryByTestId("action-site")).toBeNull();
  // EPUB の表には著者があり、サイトやアドレスはない。
  const table = within(screen.getByTestId("action-sheet-details"));
  expect(table.getByText("サンプル著者")).toBeOnTheScreen();
  expect(table.queryByText("EPUB")).toBeNull();
  expect(table.queryByText("URL")).toBeNull();
  await fireEvent.press(screen.getByTestId("action-unshelve"));
  expect(
    screen.getByRole("link", { name: "サンプル作品を開く" }),
  ).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole("link", { name: "サンプル作品を開く" }),
  );
  expect(screen).toHavePathname("/reader");
  expect(screen.getByText("0 / 13 字")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "次の話" }));
  expect(screen.getByText("0 / 5 字")).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole("button", { name: "ビューアーを閉じる" }),
  );
  // 「続きから」の入口はミニプレーヤーだけで、共有している位置から始まる。
  expect(
    within(screen.getByTestId("mini-player")).getByText("おわり"),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("link", { name: "ビューアーを開く" }));
  expect(screen.getByRole("header", { name: "おわり" })).toBeOnTheScreen();
});

it("searches the shelf by title and author, and shows everything again when closed", async () => {
  seed(book, { ...book, id: "sample-02", title: "別の物語", author: "ヤマダ" });
  await renderRouter(routes);
  await screen.findByRole("link", { name: "サンプル作品を開く" });
  // 欄は、虫めがねを押すまで出ない。
  expect(screen.queryByLabelText("作品を検索")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "検索" }));
  await fireEvent.changeText(screen.getByLabelText("作品を検索"), "物語");
  expect(
    screen.getByRole("link", { name: "別の物語を開く" }),
  ).toBeOnTheScreen();
  expect(screen.queryByRole("link", { name: "サンプル作品を開く" })).toBeNull();
  // 著者でも探せる。ひらがなとカタカナは区別しない。
  await fireEvent.changeText(screen.getByLabelText("作品を検索"), "やまだ");
  expect(
    screen.getByRole("link", { name: "別の物語を開く" }),
  ).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText("作品を検索"), "ない言葉");
  expect(screen.getByText("見つかりませんでした")).toBeOnTheScreen();
  expect(screen.queryByText("本棚は空です")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "検索を閉じる" }));
  expect(screen.queryByLabelText("作品を検索")).toBeNull();
  expect(
    screen.getByRole("link", { name: "サンプル作品を開く" }),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole("link", { name: "別の物語を開く" }),
  ).toBeOnTheScreen();
});

it("keeps a web novel off the shelf until it is bookmarked, then remembers it", async () => {
  seed({
    ...book,
    id: "narou-n1234ab",
    source: "narou",
    title: "Web作品",
    url: "https://ncode.syosetu.com/n1234ab/2/",
    chapters: [
      {
        id: "2",
        title: "第二話",
        url: "https://ncode.syosetu.com/n1234ab/2/",
        content: [{ type: "text", text: "Webの本文。" }],
      },
      {
        id: "3",
        title: "第三話",
        url: "https://ncode.syosetu.com/n1234ab/3/",
        content: [],
      },
    ],
  });
  const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(
    () =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(narouEpisodeHtml),
      }) as unknown as Promise<Response>,
  );
  await renderRouter(routes, { initialUrl: "/reader?id=narou-n1234ab" });
  await screen.findByTestId("viewer-player");
  const work = {
    id: "narou-n1234ab",
    source: "narou",
    title: "Web作品",
    author: "サンプル著者",
  };
  const read = { readAt: expect.any(Number) };
  // 読んだだけなら履歴に残るだけ。ブックマークボタンで本棚に入る。
  expect(saveLibrary).toHaveBeenLastCalledWith([
    {
      ...work,
      episode: {
        id: "2",
        title: "第二話",
        url: "https://ncode.syosetu.com/n1234ab/2/",
      },
      ...read,
      bookmarked: false,
    },
  ]);
  expect(screen.queryByRole("button", { name: "本棚から削除" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "本棚に追加" }));
  expect(
    screen.getByRole("button", { name: "本棚から削除" }),
  ).toBeOnTheScreen();
  expect(saveLibrary).toHaveBeenLastCalledWith([
    {
      ...work,
      episode: {
        id: "2",
        title: "第二話",
        url: "https://ncode.syosetu.com/n1234ab/2/",
      },
      ...read,
    },
  ]);
  // 先へ進むと保存される話も進む。そのタイトルは取得したページから取る。
  await fireEvent.press(screen.getByRole("button", { name: "次の話" }));
  await waitFor(() => {
    expect(saveLibrary).toHaveBeenLastCalledWith([
      {
        ...work,
        episode: {
          id: "3",
          title: "第二話　出会い",
          url: "https://ncode.syosetu.com/n1234ab/3/",
        },
        ...read,
      },
    ]);
  });
  // 書き込むのはメタ情報だけで、話の本文は決して書かない。
  expect(JSON.stringify(jest.mocked(saveLibrary).mock.calls)).not.toContain(
    "本文",
  );
  // 本棚には読みかけの位置が出る。
  await fireEvent.press(
    screen.getByRole("button", { name: "ビューアーを閉じる" }),
  );
  const webTile = within(screen.getByRole("link", { name: "Web作品を開く" }));
  expect(webTile.getByText("第二話　出会い")).toBeOnTheScreen();
  // タイトルは表紙の下にもある。表紙画像のない作品はカードにも
  // すでに出ているが。
  expect(webTile.getAllByText("Web作品")).toHaveLength(2);
  // ブックマークを外すと本棚から消えるが、作品は履歴に残り、
  // ミニプレーヤーでも開いたまま。
  await fireEvent.press(screen.getByRole("link", { name: "ビューアーを開く" }));
  await fireEvent.press(screen.getByRole("button", { name: "本棚から削除" }));
  expect(saveLibrary).toHaveBeenLastCalledWith([
    expect.objectContaining({ ...work, ...read, bookmarked: false }),
  ]);
  await fireEvent.press(
    screen.getByRole("button", { name: "ビューアーを閉じる" }),
  );
  expect(screen.queryByRole("link", { name: "Web作品を開く" })).toBeNull();
  expect(screen.getByText("本棚は空です")).toBeOnTheScreen();
  expect(
    within(screen.getByTestId("mini-player")).getByText("Web作品"),
  ).toBeOnTheScreen();
  // 履歴には読みかけの話と一緒にまだ残っていて、本棚に戻すこともできる。
  await fireEvent.press(screen.getByRole("tab", { name: "履歴" }));
  expect(screen.getByRole("header", { name: "今日" })).toBeOnTheScreen();
  expect(
    within(screen.getByRole("link", { name: "Web作品を開く" })).getByText(
      "小説家になろう · 第二話　出会い",
    ),
  ).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole("button", { name: "Web作品を本棚に追加" }),
  );
  expect(screen.getByText("本棚にあります")).toBeOnTheScreen();
  expect(saveLibrary).toHaveBeenLastCalledWith([
    expect.not.objectContaining({ bookmarked: false }),
  ]);
  await fireEvent.press(screen.getByRole("tab", { name: "本棚の作品" }));
  expect(screen.getByRole("link", { name: "Web作品を開く" })).toBeOnTheScreen();
  fetchSpy.mockRestore();
});

it("keeps a work taken in from a file on the shelf, reads its text when opened, and deletes it with its file", async () => {
  const kept: Book = {
    ...book,
    id: "novel.epub",
    title: "取り込んだ作品",
    file: "abc123.epub",
  };
  // 起動時、本棚には作品があるが本文はない。
  jest.mocked(savedFileBooks).mockReturnValue([{ ...kept, chapters: [] }]);
  jest.mocked(openSavedFile).mockResolvedValue(kept);
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  await renderRouter(routes);
  const tile = await screen.findByRole("link", {
    name: "取り込んだ作品を開く",
  });
  expect(openSavedFile).not.toHaveBeenCalled();
  // 開くとファイルを 1 回だけ読み、本文を表示する。
  await fireEvent.press(tile);
  expect(openSavedFile).toHaveBeenCalledWith("novel.epub");
  expect(await screen.findByTestId("viewer-player")).toBeOnTheScreen();
  expect(chapterText("最初の本文。")).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole("button", { name: "ビューアーを閉じる" }),
  );
  await fireEvent.press(
    screen.getByRole("link", { name: "取り込んだ作品を開く" }),
  );
  await screen.findByTestId("viewer-player");
  expect(openSavedFile).toHaveBeenCalledTimes(1);
  await fireEvent.press(
    screen.getByRole("button", { name: "ビューアーを閉じる" }),
  );
  // メニューには著者だけ。削除は先に確認する: ファイルも消えるため。
  await fireEvent(
    screen.getByRole("link", { name: "取り込んだ作品を開く" }),
    "longPress",
  );
  const table = within(screen.getByTestId("action-sheet-details"));
  expect(table.getByText("サンプル著者")).toBeOnTheScreen();
  expect(table.queryByText("novel.epub")).toBeNull();
  await fireEvent.press(screen.getByTestId("action-unshelve"));
  expect(removeFile).not.toHaveBeenCalled();
  // 削除されるまでは、ミニプレーヤーから続きを読める。
  expect(
    within(screen.getByTestId("mini-player")).getByText("取り込んだ作品"),
  ).toBeOnTheScreen();
  const buttons = alert.mock.calls.at(-1)![2]!;
  await act(async () => {
    buttons.find((button) => button.style === "destructive")!.onPress!();
  });
  expect(removeFile).toHaveBeenCalledWith("novel.epub");
  expect(
    screen.queryByRole("link", { name: "取り込んだ作品を開く" }),
  ).toBeNull();
  // ミニプレーヤーも一緒に消える: 続きを読むものが残っていない。
  expect(screen.queryByTestId("mini-player")).toBeNull();
  alert.mockRestore();
});

it("reads the shelf from the device again when it is pulled down", async () => {
  const kept: Book = {
    ...book,
    id: "novel.epub",
    title: "取り込んだ作品",
    file: "abc123.epub",
    chapters: [],
  };
  jest.mocked(savedFileBooks).mockReturnValue([kept]);
  await renderRouter(routes);
  await screen.findByRole("link", { name: "取り込んだ作品を開く" });
  // 端末に保存されているものが変わった: タイトルが新しくなり、作品が増えた。
  jest.mocked(savedFileBooks).mockReturnValue([
    { ...kept, id: "other.epub", title: "増えた作品", file: "def456.epub" },
    { ...kept, title: "直った題名" },
  ]);
  await act(async () => {
    screen.getByTestId("refreshable").props.refreshControl.props.onRefresh();
  });
  expect(
    screen.getByRole("link", { name: "直った題名を開く" }),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole("link", { name: "増えた作品を開く" }),
  ).toBeOnTheScreen();
  expect(
    screen.queryByRole("link", { name: "取り込んだ作品を開く" }),
  ).toBeNull();
  // 端末に保存されなくなった作品は本棚から消える。
  jest.mocked(savedFileBooks).mockReturnValue([]);
  await act(async () => {
    screen.getByTestId("refreshable").props.refreshControl.props.onRefresh();
  });
  expect(screen.queryByRole("link", { name: "直った題名を開く" })).toBeNull();
});

it("says so when a kept file cannot be read", async () => {
  jest
    .mocked(savedFileBooks)
    .mockReturnValue([
      { ...book, id: "novel.epub", file: "abc123.epub", chapters: [] },
    ]);
  jest
    .mocked(openSavedFile)
    .mockRejectedValue(new Error("保存したファイルが見つかりません。"));
  await renderRouter(routes, { initialUrl: "/reader?id=novel.epub" });
  expect(
    await screen.findByText("保存したファイルが見つかりません。"),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "閉じる" }));
  expect(screen).toHavePathname("/");
});

it("takes in a file from Home, opens it, and puts it on the shelf", async () => {
  jest.mocked(importFile).mockResolvedValue({
    ...book,
    id: "novel.epub",
    title: "取り込んだ作品",
    file: "abc123.epub",
  });
  await renderRouter(routes);
  await screen.findByRole("link", { name: "サンプル作品を開く" });
  await fireEvent.press(screen.getByLabelText("ホーム"));
  await fireEvent.press(
    screen.getByRole("button", { name: "ファイルを取り込む" }),
  );
  expect(await screen.findByTestId("viewer-player")).toBeOnTheScreen();
  expect(screen).toHavePathname("/reader");
  // 取り込むときにすでに読んでいる: ファイルは読み直さない。
  expect(openSavedFile).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("button", { name: "ビューアーを閉じる" }),
  );
  await fireEvent.press(screen.getByLabelText("本棚"));
  expect(
    screen.getByRole("link", { name: "取り込んだ作品を開く" }),
  ).toBeOnTheScreen();
});

it("lists the history by day, newest first, and forgets one work or all of them", async () => {
  const now = Date.now();
  const saved = (id: string, title: string) => ({
    id: `narou-${id}`,
    source: "narou",
    title,
    author: "作者名",
    episode: {
      id: "2",
      title: "第二話",
      url: `https://ncode.syosetu.com/${id}/2/`,
    },
  });
  jest.mocked(loadLibrary).mockReturnValue([
    // 本棚にはあるが、履歴ができてから一度も読んでいない: 履歴には出ない。
    saved("n0001aa", "本棚だけの作品"),
    { ...saved("n0002aa", "昨日の作品"), readAt: now - 86_400_000 },
    { ...saved("n0003aa", "今日の作品"), readAt: now, bookmarked: false },
  ]);
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  await renderRouter(routes);
  // 本棚にあるのはブックマークしたものだけ。
  await screen.findByRole("link", { name: "昨日の作品を開く" });
  expect(screen.queryByRole("link", { name: "今日の作品を開く" })).toBeNull();
  await fireEvent.press(screen.getByRole("tab", { name: "履歴" }));
  expect(
    screen.getAllByRole("link").map((link) => link.props.accessibilityLabel),
  ).toEqual(["今日の作品を開く", "昨日の作品を開く"]);
  expect(screen.getByRole("header", { name: "今日" })).toBeOnTheScreen();
  expect(screen.getByRole("header", { name: "昨日" })).toBeOnTheScreen();
  expect(
    screen.queryByRole("link", { name: "本棚だけの作品を開く" }),
  ).toBeNull();
  // 長押しで作品のメニューが出る。履歴から消しても本棚には残る。
  await fireEvent(
    screen.getByRole("link", { name: "昨日の作品を開く" }),
    "longPress",
  );
  expect(screen.getByTestId("action-site")).toBeOnTheScreen();
  // メニューは作品が何であるかを表で示す。アドレスはコピーできる。
  const table = within(screen.getByTestId("action-sheet-details"));
  for (const cell of [
    "著者",
    "作者名",
    "サイト",
    "小説家になろう",
    "読んでいる話",
  ]) {
    expect(table.getByText(cell)).toBeOnTheScreen();
  }
  expect(table.getByText("第二話")).toBeOnTheScreen();
  expect(table.getByText("ncode.syosetu.com/n0002aa/2")).toBeOnTheScreen();
  await fireEvent.press(table.getByRole("button", { name: "URLをコピー" }));
  expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(
    "https://ncode.syosetu.com/n0002aa/2/",
  );
  expect(table.getByText("コピー済み")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("action-forget"));
  expect(screen.queryByRole("link", { name: "昨日の作品を開く" })).toBeNull();
  expect(saveLibrary).toHaveBeenLastCalledWith([
    saved("n0001aa", "本棚だけの作品"),
    saved("n0002aa", "昨日の作品"),
    expect.objectContaining({ id: "narou-n0003aa", bookmarked: false }),
  ]);
  // すべて消す操作は 1 階層下にあり、先に確認する。
  await fireEvent.press(screen.getByRole("button", { name: "履歴のメニュー" }));
  await fireEvent.press(screen.getByTestId("action-clear"));
  expect(
    screen.getByRole("link", { name: "今日の作品を開く" }),
  ).toBeOnTheScreen();
  const buttons = alert.mock.calls.at(-1)![2]!;
  await act(async () => {
    buttons.find((button) => button.style === "destructive")!.onPress!();
  });
  expect(screen.getByText("履歴はありません")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "履歴のメニュー" })).toBeDisabled();
  // 履歴のためだけに保存していた作品は、もう書き込まれない。
  expect(saveLibrary).toHaveBeenLastCalledWith([
    saved("n0001aa", "本棚だけの作品"),
    saved("n0002aa", "昨日の作品"),
  ]);
  alert.mockRestore();
});

it("keeps the shelf in the order the works were opened, across both kinds and across launches", async () => {
  seed(book, { ...book, id: "sample-02", title: "別の作品" });
  jest.mocked(loadLibrary).mockReturnValue([
    {
      id: "narou-n1234ab",
      source: "narou",
      title: "Web作品",
      author: "作者名",
      episode: {
        id: "2",
        title: "第二話",
        url: "https://ncode.syosetu.com/n1234ab/2/",
      },
    },
  ]);
  // 前回の起動で残した状態: ファイル由来の 2 作品の間に Web 小説が 1 つ。
  jest
    .mocked(loadShelfOrder)
    .mockReturnValue([
      { id: "sample-02", openedAt: 300 },
      { id: "narou-n1234ab", openedAt: 200 },
      { id: "sample-01" },
    ]);
  await renderRouter(routes);
  await screen.findByRole("link", { name: "Web作品を開く" });
  const names = () =>
    screen
      .getAllByRole("link", { name: /作品を開く$/ })
      .map((link) => link.props.accessibilityLabel as string);
  expect(names()).toEqual([
    "別の作品を開く",
    "Web作品を開く",
    "サンプル作品を開く",
  ]);
  // 作品を開くと先頭に来て、その順番が書き込まれる。
  await fireEvent.press(
    screen.getByRole("link", { name: "サンプル作品を開く" }),
  );
  await screen.findByTestId("viewer-player");
  await fireEvent.press(
    screen.getByRole("button", { name: "ビューアーを閉じる" }),
  );
  expect(names()).toEqual([
    "サンプル作品を開く",
    "別の作品を開く",
    "Web作品を開く",
  ]);
  // 本棚を別の並びにするために、それぞれを開いた時刻も一緒に。
  expect(saveShelfOrder).toHaveBeenLastCalledWith([
    { id: "sample-01", openedAt: expect.any(Number) },
    { id: "sample-02", openedAt: 300 },
    { id: "narou-n1234ab", openedAt: 200 },
  ]);
});

it("shows no bookmark button for EPUBs, which are always on the shelf", async () => {
  await renderRouter(routes, { initialUrl: "/reader?id=sample-01" });
  await screen.findByTestId("viewer-player");
  expect(screen.queryByRole("button", { name: "本棚に追加" })).toBeNull();
  expect(screen.queryByRole("button", { name: "本棚から削除" })).toBeNull();
});

it("brings saved web novels back at launch and continues from the mini player", async () => {
  jest.mocked(loadLibrary).mockReturnValue([
    {
      id: "narou-n1234ab",
      source: "narou",
      title: "Web作品",
      author: "作者名",
      episode: {
        id: "2",
        title: "第二話　出会い",
        url: "https://ncode.syosetu.com/n1234ab/2/",
      },
    },
  ]);
  jest.mocked(loadPlayback).mockReturnValue({
    bookId: "narou-n1234ab",
    chapterIndex: 0,
    paragraphIndex: 0,
    rate: 1,
    pitch: 1,
  });
  const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(
    () =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(narouEpisodeHtml),
      }) as unknown as Promise<Response>,
  );
  await renderRouter(routes);
  // 保存した作品は、同梱の本の隣に並ぶ。
  const tile = await screen.findByRole("link", { name: "Web作品を開く" });
  expect(within(tile).getByText("第二話　出会い")).toBeOnTheScreen();
  // ミニプレーヤーに戻っていて、ビューアーを開かなくても話が取得される。
  const mini = within(await screen.findByTestId("mini-player"));
  expect(mini.getByText("Web作品")).toBeOnTheScreen();
  await waitFor(() => {
    expect(mini.getByRole("button", { name: "再生" })).toBeEnabled();
  });
  expect(fetchSpy).toHaveBeenCalledWith(
    "https://ncode.syosetu.com/n1234ab/2/",
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
  expect(Speech.speak).not.toHaveBeenCalled();
  await fireEvent.press(mini.getByRole("button", { name: "再生" }));
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "第二話　出会い",
    expect.any(Object),
  );
  fetchSpy.mockRestore();
});
