/// <reference types="node" />
import { book, routes, dismissSheet, seed } from "@/testing/app";

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import * as Clipboard from "expo-clipboard";
import * as Speech from "expo-speech";
import {
  narouEpisodeHtml,
  narouTocHtml,
  pixivEpisodeDataUrl,
  pixivEpisodeJson,
  pixivEpisodeUrl,
  pixivTocJson,
  pixivTocUrl,
} from "@/__fixtures__/webPages";
import { loadLibrary } from "@/features/library/libraryStorage";

it("copies the source URL and opens web novels in the browser from the menu", async () => {
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
        content: [{ type: "text", text: "Webの本文。" }],
      },
    ],
  });
  await renderRouter(routes, { initialUrl: "/reader?id=narou-n1234ab" });
  await screen.findByTestId("viewer-player");
  await fireEvent.press(screen.getByRole("button", { name: "その他" }));
  const menu = within(screen.getByTestId("reader-menu"));
  expect(
    menu.getByRole("button", { name: "元のサイトで開く" }),
  ).toBeOnTheScreen();
  expect(menu.queryByRole("button", { name: "目次" })).toBeNull();
  expect(menu.queryByRole("button", { name: "タイマー" })).toBeNull();
  expect(screen.queryByTestId("player-sheet")).toBeNull();
  await fireEvent.press(screen.getByTestId("reader-menu-backdrop"));
  expect(screen.queryByTestId("reader-menu")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "その他" }));
  await fireEvent.press(screen.getByRole("button", { name: "URLをコピー" }));
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
    "https://ncode.syosetu.com/n1234ab/2/",
  );
  expect(screen.queryByTestId("reader-menu")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "その他" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "元のサイトで開く" }),
  );
  expect(screen).toHavePathname("/home/browse");
  expect(
    screen.getByLabelText(
      "表示中のページ https://ncode.syosetu.com/n1234ab/2/",
    ),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("link", { name: "ビューアーを開く" }));
  await screen.findByTestId("viewer-player");
  await fireEvent.press(screen.getByRole("button", { name: "本棚に追加" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "ビューアーを閉じる" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "ブラウザを閉じる" }),
  );
  expect(screen).toHavePathname("/home");
  await fireEvent.press(screen.getByLabelText("本棚"));
  await fireEvent.press(
    await screen.findByRole("link", { name: "Web作品を開く" }),
  );
  await screen.findByTestId("viewer-player");
  await fireEvent.press(screen.getByRole("button", { name: "その他" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "元のサイトで開く" }),
  );
  expect(
    screen.getByLabelText(
      "表示中のページ https://ncode.syosetu.com/n1234ab/2/",
    ),
  ).toBeOnTheScreen();
});

it("shows no site icon for a novel from Narou", async () => {
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
        content: [{ type: "text", text: "Webの本文。" }],
      },
    ],
  });
  await renderRouter(routes, { initialUrl: "/reader?id=narou-n1234ab" });
  await screen.findByTestId("viewer-player");
  await fireEvent.press(
    screen.getByRole("button", { name: "ビューアーを閉じる" }),
  );
  expect(await screen.findByTestId("mini-player")).toBeOnTheScreen();
  expect(screen.queryByTestId("mini-player-thumbnail")).toBeNull();
});

it("opens the page of the episode being read, even when the browser was left on it", async () => {
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
        content: [{ type: "text", text: "次の本文。" }],
      },
    ],
  });
  await renderRouter(routes, { initialUrl: "/reader?id=narou-n1234ab" });
  await screen.findByTestId("viewer-player");
  await fireEvent.press(screen.getByRole("button", { name: "本棚に追加" }));
  await fireEvent.press(screen.getByRole("button", { name: "次の話" }));
  expect(screen.getByRole("header", { name: "第三話" })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "その他" }));
  await fireEvent.press(screen.getByRole("button", { name: "URLをコピー" }));
  expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(
    "https://ncode.syosetu.com/n1234ab/3/",
  );
  await fireEvent.press(screen.getByRole("button", { name: "その他" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "元のサイトで開く" }),
  );
  expect(screen).toHavePathname("/home/browse");
  expect(
    screen.getByLabelText(
      "表示中のページ https://ncode.syosetu.com/n1234ab/3/",
    ),
  ).toBeOnTheScreen();
  await act(async () => {
    screen.getByTestId("webview").props.onNavigationStateChange({
      url: "https://ncode.syosetu.com/n1234ab/",
      title: "",
      loading: false,
      canGoBack: true,
      canGoForward: false,
    });
  });
  expect(
    screen.getByLabelText("表示中のページ https://ncode.syosetu.com/n1234ab/"),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByLabelText("本棚"));
  await fireEvent.press(
    await screen.findByRole("link", { name: "Web作品を開く" }),
  );
  await screen.findByTestId("viewer-player");
  await fireEvent.press(screen.getByRole("button", { name: "その他" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "元のサイトで開く" }),
  );
  expect(screen.getAllByTestId("webview")).toHaveLength(1);
  expect(
    screen.getByLabelText(
      "表示中のページ https://ncode.syosetu.com/n1234ab/3/",
    ),
  ).toBeOnTheScreen();
});

it("loads the next episode on demand when the arrows cross chapters", async () => {
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
  let resolveHtml!: (html: string) => void;
  const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(
    () =>
      Promise.resolve({
        ok: true,
        text: () =>
          new Promise<string>((resolve) => {
            resolveHtml = resolve;
          }),
      }) as unknown as Promise<Response>,
  );
  await renderRouter(routes, { initialUrl: "/reader?id=narou-n1234ab" });
  await screen.findByTestId("viewer-player");
  expect(screen.getByRole("header", { name: "第二話" })).toBeOnTheScreen();
  expect(screen.getByText("2 話")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "次の話" }));
  expect(screen.getByRole("header", { name: "第三話" })).toBeOnTheScreen();
  expect(await screen.findByText("次の話を取得しています…")).toBeOnTheScreen();
  expect(screen.getByText("0 / 0 字")).toBeOnTheScreen();
  expect(fetchSpy).toHaveBeenCalledWith(
    "https://ncode.syosetu.com/n1234ab/3/",
    {
      signal: expect.any(AbortSignal),
      headers: {
        "User-Agent": expect.stringContaining("Mozilla/5.0"),
      },
    },
  );
  resolveHtml(narouEpisodeHtml);
  await waitFor(() => {
    expect(screen.queryByText("次の話を取得しています…")).toBeNull();
  });
  expect(screen.getByRole("button", { name: "再生" })).toBeEnabled();
  expect(screen.getByText("3 / 3 話")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "再生" }));
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "第二話　出会い",
    expect.any(Object),
  );
  expect(
    screen.getAllByRole("header", { name: "第二話　出会い" }),
  ).toHaveLength(2);
  await act(async () => {
    (jest.mocked(Speech.speak).mock.calls.at(-1)![1]!.onDone as () => void)();
  });
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "まほうを使った。",
    expect.any(Object),
  );
  fetchSpy.mockRestore();
});

it("fetches the next hundred episodes when the arrows reach the TOC window's end", async () => {
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
        id: "https://ncode.syosetu.com/n1234ab/?p=1",
        title: "次の100話",
        url: "https://ncode.syosetu.com/n1234ab/?p=1",
        content: [],
      },
    ],
  });
  const fetchSpy = jest.spyOn(global, "fetch").mockImplementation((input) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : input instanceof URL
            ? input.href
            : String(input);
    const html = url.includes("?p=") ? narouTocHtml : narouEpisodeHtml;
    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve(html),
    }) as unknown as Promise<Response>;
  });
  await renderRouter(routes, { initialUrl: "/reader?id=narou-n1234ab" });
  await screen.findByTestId("viewer-player");
  await fireEvent.press(screen.getByRole("button", { name: "次の話" }));
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "再生" })).toBeEnabled();
  });
  expect(fetchSpy).toHaveBeenCalledWith(
    "https://ncode.syosetu.com/n1234ab/?p=1",
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
  expect(fetchSpy).toHaveBeenCalledWith(
    "https://ncode.syosetu.com/n1234ab/3/",
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "目次" }));
  expect(screen.getByRole("radio", { name: "第一話" })).toBeOnTheScreen();
  expect(screen.getByRole("radio", { name: "第二話" })).toBeOnTheScreen();
  const landed = screen.getByRole("radio", { checked: true });
  expect(within(landed).getByText("第二話　出会い")).toBeOnTheScreen();
  expect(screen.getByRole("radio", { name: "次の100話" })).toBeOnTheScreen();
  fetchSpy.mockRestore();
});

it("expands the TOC in place from the sheet without moving the reading position", async () => {
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
        id: "https://ncode.syosetu.com/n1234ab/?p=1",
        title: "次の100話",
        url: "https://ncode.syosetu.com/n1234ab/?p=1",
        content: [],
      },
    ],
  });
  const fetchSpy = jest.spyOn(global, "fetch").mockImplementation((input) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : input instanceof URL
            ? input.href
            : String(input);
    const html = url.includes("?p=") ? narouTocHtml : narouEpisodeHtml;
    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve(html),
    }) as unknown as Promise<Response>;
  });
  await renderRouter(routes, { initialUrl: "/reader?id=narou-n1234ab" });
  await screen.findByTestId("viewer-player");
  await fireEvent.press(screen.getByRole("button", { name: "目次" }));
  await fireEvent.press(screen.getByRole("radio", { name: "次の100話" }));
  expect(
    await screen.findByRole("radio", { name: "第一話" }),
  ).toBeOnTheScreen();
  expect(screen.getByRole("radio", { name: "第三話" })).toBeOnTheScreen();
  expect(screen.getByRole("radio", { name: "次の100話" })).toBeOnTheScreen();
  expect(screen.getByTestId("player-sheet")).toBeOnTheScreen();
  expect(fetchSpy).toHaveBeenCalledWith(
    "https://ncode.syosetu.com/n1234ab/?p=1",
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
  await dismissSheet();
  expect(screen.getByRole("header", { name: "第二話" })).toBeOnTheScreen();
  fetchSpy.mockRestore();
});

it("fetches the table of contents of a saved web novel when it is opened again", async () => {
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
  const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(
    (input) =>
      Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            (typeof input === "string" ? input : "").includes("?p=")
              ? narouTocHtml
              : narouEpisodeHtml,
          ),
      }) as unknown as Promise<Response>,
  );
  await renderRouter(routes, { initialUrl: "/reader?id=narou-n1234ab" });
  await screen.findByTestId("viewer-player");
  await waitFor(() => {
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://ncode.syosetu.com/n1234ab/?p=1",
      expect.anything(),
    );
  });
  await fireEvent.press(screen.getByRole("button", { name: "目次" }));
  expect(
    await screen.findByRole("radio", { name: "第一話" }),
  ).toBeOnTheScreen();
  expect(screen.getByRole("radio", { name: "第三話" })).toBeOnTheScreen();
  expect(
    screen.getAllByRole("header", { name: "第二話　出会い" }).length,
  ).toBeGreaterThan(0);
  expect(screen.getByRole("radio", { name: "次の100話" })).toBeOnTheScreen();
  fetchSpy.mockRestore();
});

it("fetches the episode being read again from the menu", async () => {
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
  const episodeUrl = "https://ncode.syosetu.com/n1234ab/2/";
  const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(
    (input) =>
      Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            (typeof input === "string" ? input : "").includes("?p=")
              ? narouTocHtml
              : narouEpisodeHtml,
          ),
      }) as unknown as Promise<Response>,
  );
  const fetched = () =>
    fetchSpy.mock.calls.filter((call) => call[0] === episodeUrl).length;
  await renderRouter(routes, { initialUrl: "/reader?id=narou-n1234ab" });
  await screen.findByTestId("viewer-player");
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "再生" })).toBeEnabled();
  });
  expect(fetched()).toBe(1);

  await fireEvent.press(screen.getByRole("button", { name: "その他" }));
  await fireEvent.press(screen.getByRole("button", { name: "再取得" }));
  await waitFor(() => {
    expect(fetched()).toBe(2);
  });
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "再生" })).toBeEnabled();
  });
  fetchSpy.mockRestore();
});

it("fetches a saved pixiv novel's text and series from the site's JSON when it is opened again", async () => {
  jest.mocked(loadLibrary).mockReturnValue([
    {
      id: "pixiv-series-77",
      source: "pixiv",
      title: "テスト連作",
      author: "書き手",
      episode: { id: "2002", title: "第二話　再会", url: pixivEpisodeUrl },
    },
  ]);
  const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(
    (input) =>
      Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            input === pixivTocUrl ? pixivTocJson : pixivEpisodeJson,
          ),
      }) as unknown as Promise<Response>,
  );
  await renderRouter(routes, { initialUrl: "/reader?id=pixiv-series-77" });
  await screen.findByTestId("viewer-player");
  await waitFor(() => {
    expect(fetchSpy).toHaveBeenCalledWith(pixivTocUrl, expect.anything());
  });
  expect(fetchSpy).toHaveBeenCalledWith(pixivEpisodeDataUrl, expect.anything());
  expect(fetchSpy).not.toHaveBeenCalledWith(pixivEpisodeUrl, expect.anything());
  expect(await screen.findByText("「待って」")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "目次" }));
  expect(
    await screen.findByRole("radio", { name: "第一話　始まり" }),
  ).toBeOnTheScreen();
  expect(screen.getByRole("radio", { name: "第三話　別れ" })).toBeOnTheScreen();
  fetchSpy.mockRestore();
});
