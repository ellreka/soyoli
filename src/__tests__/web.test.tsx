import { act, fireEvent, screen } from "@testing-library/react-native";
import { Slot, useLocalSearchParams } from "expo-router";
import { renderRouter } from "expo-router/testing-library";
import { BackHandler, Platform, Text } from "react-native";
import type { WebViewNavigation } from "react-native-webview/lib/WebViewTypes";

import {
  narouEpisodeHtml,
  narouEpisodeUrl,
  narouTocHtml,
} from "@/__fixtures__/webPages";
import HomeLayout from "@/app/(tabs)/home/_layout";
import BrowseScreen from "@/app/(tabs)/home/browse";
import HomeScreen from "@/app/(tabs)/home/index";
import { LibraryProvider, useLibrary } from "@/features/library/Library";
import { saveLibrary } from "@/features/library/libraryStorage";
import { PlaybackProvider } from "@/features/player/Playback";
import {
  canLoadInBrowser,
  displayUrl,
  isSecureUrl,
  browseParams,
  resolveAddress,
  resolveWebAddress,
  urlFromParam,
} from "@/features/web/browser";

import { mockCommands as commands } from "../../__mocks__/react-native-webview";

jest.mock("@/features/library/libraryStorage", () => ({
  loadLibrary: jest.fn(() => null),
  saveLibrary: jest.fn(),
}));
jest.mock("@/features/player/storage", () => ({
  ...jest.requireActual("@/features/player/storage"),
  loadPlayback: jest.fn(() => null),
  savePlayback: jest.fn(),
}));
jest.mock("@/features/player/pageSound", () => ({
  playPageTurn: jest.fn(),
  pageTurnWait: () => 0,
}));
jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
  maxSpeechInputLength: 4000,
  getAvailableVoicesAsync: jest.fn(() => Promise.resolve([])),
}));

function Layout() {
  return (
    <LibraryProvider>
      <PlaybackProvider>
        <Slot />
      </PlaybackProvider>
    </LibraryProvider>
  );
}

/** リーダーのルートの代役: ライブラリが渡してくるものを表示する。 */
function ReaderProbe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const book = useLibrary().books.find((item) => item.id === id);
  return (
    <Text>
      {book
        ? `${book.title}|${book.author}|${book.chapters.map((chapter) => chapter.title).join(",")}`
        : "作品なし"}
    </Text>
  );
}

const routes = {
  _layout: Layout,
  index: () => <Text>本棚</Text>,
  "home/_layout": HomeLayout,
  "home/index": HomeScreen,
  "home/browse": BrowseScreen,
  reader: ReaderProbe,
};

async function renderHome() {
  await renderRouter(routes, { initialUrl: "/home" });
}

function webView() {
  return screen.getByTestId("webview");
}

async function navigate(state: Partial<WebViewNavigation>) {
  await act(async () => {
    webView().props.onNavigationStateChange({
      url: "https://syosetu.com/",
      title: "",
      loading: false,
      canGoBack: false,
      canGoForward: false,
      lockIdentifier: 0,
      navigationType: "click",
      ...state,
    });
  });
}

async function openSite() {
  await renderHome();
  await fireEvent.press(screen.getByRole("button", { name: "カクヨムを開く" }));
}

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

it("opens a supported site from Home in the full-screen browser", async () => {
  await renderHome();
  expect(screen.getByRole("header", { name: "ホーム" })).toBeOnTheScreen();
  expect(
    screen.getByRole("button", { name: "カクヨムを開く" }),
  ).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole("button", { name: "カクヨムを開く" }));
  expect(screen).toHavePathname("/home/browse");
  expect(webView().props.source).toEqual({ uri: "https://kakuyomu.jp/" });
  expect(
    screen.getByLabelText("表示中のページ https://kakuyomu.jp/"),
  ).toBeOnTheScreen();
});

it("opens a site's ranking from Home", async () => {
  await renderHome();
  await fireEvent.press(
    screen.getByRole("button", { name: "カクヨムのランキング" }),
  );
  expect(webView().props.source).toEqual({
    uri: "https://kakuyomu.jp/rankings/all/weekly",
  });
});

it("shows each site with its icon, and leaves the adult sites out of Home", async () => {
  await renderHome();
  expect(screen.getByTestId("site-icon-syosetu.org").props.source).toEqual({
    uri: "https://img.syosetu.org/image/apple-touch-icon-180x180.png",
  });
  // アイコンが読み込めなければただの記号が残る。行はそれでも使える。
  await fireEvent(screen.getByTestId("site-icon-kakuyomu.jp"), "error");
  expect(screen.queryByTestId("site-icon-kakuyomu.jp")).toBeNull();
  expect(
    screen.getByRole("button", { name: "カクヨムを開く" }),
  ).toBeOnTheScreen();

  // 成人向けサイトもほかと同じように読めるが、ホームには並べない。
  expect(screen.queryByText(/成人向け|R18|ノクターン/)).toBeNull();
  // なろうも並べない: その作品はアドレスから開く。
  expect(screen.queryByText(/なろう/)).toBeNull();
  expect(screen.getByText("対応形式：.epub / .pdf")).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole("button", { name: "ハーメルンを開く" }),
  );
  // サイトの年齢確認で答えた内容は、リーダーが出すリクエストとも共有される。
  expect(webView().props.sharedCookiesEnabled).toBe(true);
});

it("accepts only a URL in the Home address field", async () => {
  await renderHome();
  // サイトの選択肢はない: キーワードでは検索しない。
  expect(screen.queryByRole("radio")).toBeNull();
  const field = screen.getByLabelText("URLを入力");
  // 何も入力していない: 何も開かず、何も指摘されない。
  await fireEvent(field, "submitEditing");
  expect(screen).toHavePathname("/home");
  expect(screen.queryByRole("alert")).toBeNull();
  // キーワードはメッセージ付きで断られる。入力し直すと消える。
  await fireEvent.changeText(field, "転生 魔法");
  await fireEvent(field, "submitEditing");
  expect(screen).toHavePathname("/home");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "URLを入力してください。",
  );
  await fireEvent.changeText(field, "転生");
  expect(screen.queryByRole("alert")).toBeNull();
});

it("opens a URL typed on Home as is", async () => {
  await renderHome();
  const field = screen.getByLabelText("URLを入力");
  await fireEvent.changeText(field, "ncode.syosetu.com/n1234ab/2/");
  await fireEvent(field, "submitEditing");
  expect(webView().props.source).toEqual({
    uri: "https://ncode.syosetu.com/n1234ab/2/",
  });
});

it("empties the Home address field with its clear button", async () => {
  await renderHome();
  // ボタンは何か入力して初めて出る。
  expect(screen.queryByRole("button", { name: "入力を消す" })).toBeNull();
  await fireEvent.changeText(screen.getByLabelText("URLを入力"), "kakuyomu.jp");
  await fireEvent.press(screen.getByRole("button", { name: "入力を消す" }));
  expect(screen.queryByRole("button", { name: "入力を消す" })).toBeNull();
  // フィールドはまた空: 送信しても何も開かない。
  await fireEvent(screen.getByLabelText("URLを入力"), "submitEditing");
  expect(screen).toHavePathname("/home");
});

it("follows navigation state in the toolbar", async () => {
  await openSite();
  expect(screen.getByRole("button", { name: "進む" })).toBeDisabled();
  // Web の履歴を戻るのは別の操作。閉じるボタンはいつでも閉じる。
  expect(screen.getByRole("button", { name: "戻る" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "読み込みを中止" }),
  ).toBeOnTheScreen();

  await navigate({
    url: "https://ncode.syosetu.com/n0000aa/48/",
    canGoBack: true,
    canGoForward: true,
  });
  expect(
    screen.getByLabelText(
      "表示中のページ https://ncode.syosetu.com/n0000aa/48/",
    ),
  ).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole("button", { name: "戻る" }));
  expect(commands.goBack).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole("button", { name: "進む" }));
  expect(commands.goForward).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole("button", { name: "再読み込み" }));
  expect(commands.reload).toHaveBeenCalledTimes(1);
});

it("closes back to where the browser was opened, from any page", async () => {
  await openSite();
  await navigate({
    url: "https://ncode.syosetu.com/n0000aa/48/",
    canGoBack: true,
  });
  await fireEvent.press(
    screen.getByRole("button", { name: "ブラウザを閉じる" }),
  );
  expect(screen).toHavePathname("/home");
  expect(screen.queryByTestId("webview")).toBeNull();
  expect(
    screen.getByRole("button", { name: "カクヨムを開く" }),
  ).toBeOnTheScreen();
});

it("navigates to the address edited in the toolbar", async () => {
  await openSite();
  await navigate({ url: "https://syosetu.com/", loading: false });
  const field = screen.getByLabelText("表示中のページ https://syosetu.com/");
  // 編集は、短くした表示形ではなく生の URL から始まる。
  await fireEvent.changeText(field, "https://ncode.syosetu.com/n2267be/1/");
  await fireEvent(field, "submitEditing");
  // 再マウントされた WebView が、送信された URL を読み込む。
  expect(webView().props.source).toEqual({
    uri: "https://ncode.syosetu.com/n2267be/1/",
  });
  // Web でないスキームは、読み込まずに捨てる。
  await fireEvent.changeText(field, "file:///etc/hosts");
  await fireEvent(field, "submitEditing");
  expect(webView().props.source).toEqual({
    uri: "https://ncode.syosetu.com/n2267be/1/",
  });
  // ホストだけの入力には https:// を前に付ける。
  await fireEvent.changeText(field, "kakuyomu.jp/works/1");
  await fireEvent(field, "submitEditing");
  expect(webView().props.source).toEqual({
    uri: "https://kakuyomu.jp/works/1",
  });
});
it("routes the Android back button to page history first", async () => {
  type Listener = Parameters<typeof BackHandler.addEventListener>[1];
  const listeners: Listener[] = [];
  jest
    .spyOn(BackHandler, "addEventListener")
    .mockImplementation((_event, handler) => {
      listeners.push(handler);
      return { remove: jest.fn() };
    });
  await openSite();
  await navigate({ canGoBack: true });

  await act(async () => {
    expect(listeners.at(-1)?.({} as Parameters<Listener>[0])).toBe(true);
  });
  expect(commands.goBack).toHaveBeenCalledTimes(1);
});

it("blocks non-web schemes instead of opening other apps", async () => {
  await openSite();
  const shouldStart = webView().props.onShouldStartLoadWithRequest;
  expect(webView().props.originWhitelist).toEqual(["*"]);
  expect(shouldStart({ url: "https://kakuyomu.jp/works/1" })).toBe(true);
  expect(shouldStart({ url: "intent://scan/#Intent;end" })).toBe(false);
  expect(shouldStart({ url: "tel:0120000000" })).toBe(false);
});

it("explains that the browser is unavailable on web", async () => {
  jest.replaceProperty(Platform, "OS", "web");
  await renderRouter(routes, {
    initialUrl: "/home/browse?url=https%3A%2F%2Fsyosetu.com%2F",
  });
  expect(screen.getByText("アプリ内ブラウザは使えません")).toBeOnTheScreen();
  expect(screen.queryByTestId("webview")).toBeNull();
});

it("refuses to open a page that is not a web URL", async () => {
  await renderRouter(routes, {
    initialUrl: "/home/browse?url=file%3A%2F%2F%2Fetc%2Fhosts",
  });
  expect(screen.getByText("ページを開けません")).toBeOnTheScreen();
  expect(screen.queryByTestId("webview")).toBeNull();
  // 直リンクの後は戻る先がない: この画面の持ち主であるホームへ。
  await fireEvent.press(screen.getByRole("button", { name: "閉じる" }));
  expect(screen).toHavePathname("/home");
});

describe("browser urls", () => {
  it("shows host and path without scheme, query or trailing slash", () => {
    expect(displayUrl("https://kakuyomu.jp/works/123?ref=top#a")).toBe(
      "kakuyomu.jp/works/123",
    );
    expect(displayUrl("about:blank")).toBe("about:blank");
  });

  it("allows only web pages and about:blank", () => {
    expect(canLoadInBrowser("http://example.com")).toBe(true);
    expect(canLoadInBrowser("about:blank")).toBe(true);
    expect(canLoadInBrowser("data:text/html,x")).toBe(false);
    expect(canLoadInBrowser("file:///etc/hosts")).toBe(false);
  });

  it("marks only https as secure", () => {
    expect(isSecureUrl("https://syosetu.com/")).toBe(true);
    expect(isSecureUrl("http://syosetu.com/")).toBe(false);
  });

  it("carries a URL through route params without losing its escapes", () => {
    const url = "https://kakuyomu.jp/search?q=%E8%BB%A2%E7%94%9F%26a";
    const { url: param } = browseParams(url);
    // ルーターが値をデコードしてもしなくても、同じ URL が戻ってくる。
    expect(urlFromParam(param)).toBe(url);
    expect(urlFromParam(decodeURIComponent(param))).toBe(url);
    expect(urlFromParam(encodeURIComponent("file:///etc/hosts"))).toBeNull();
    expect(urlFromParam("%E0%A4%A")).toBeNull();
    expect(urlFromParam(undefined)).toBeNull();
  });

  it("resolves a typed address, dropping non-web schemes", () => {
    expect(resolveAddress(" kakuyomu.jp/works/1 ")).toBe(
      "https://kakuyomu.jp/works/1",
    );
    expect(resolveAddress("http://example.com/a")).toBe("http://example.com/a");
    expect(resolveAddress("file:///etc/hosts")).toBeNull();
    expect(resolveAddress("intent://scan/#Intent;end")).toBeNull();
    expect(resolveAddress("   ")).toBeNull();
  });

  it("takes only web addresses for the Home field", () => {
    expect(resolveWebAddress("https://kakuyomu.jp/works/1")).toBe(
      "https://kakuyomu.jp/works/1",
    );
    expect(resolveWebAddress(" syosetu.com ")).toBe("https://syosetu.com");
    expect(resolveWebAddress("file:///etc/hosts")).toBeNull();
    expect(resolveWebAddress("")).toBeNull();
    // キーワードでは検索しない。
    expect(resolveWebAddress("無職転生")).toBeNull();
    // 点を含む文でも、ホストではない。
    expect(resolveWebAddress("俺は Lv.99")).toBeNull();
  });
});

describe("episode detection", () => {
  async function loadPage(url: string, html: string) {
    await navigate({ url, loading: false });
    await act(async () => {
      webView().props.onLoad({ nativeEvent: { url } });
    });
    await act(async () => {
      webView().props.onMessage({ nativeEvent: { url, data: html } });
    });
  }

  const openButton = { name: "第二話　出会いをリーダーで開く" };

  it("opens a detected episode in the reader", async () => {
    await openSite();
    await loadPage(narouEpisodeUrl, narouEpisodeHtml);

    // ページの HTML と作品の目次の両方が要求される。
    expect(commands.injectJavaScript).toHaveBeenCalledTimes(2);
    const injected = jest
      .mocked(commands.injectJavaScript)
      .mock.calls.map((call) => call[0]);
    expect(injected[0]).toContain("document.documentElement.outerHTML");
    expect(injected[1]).toContain(
      'fetch("https://ncode.syosetu.com/n1234ab/?p=1")',
    );
    // カードには話と作品の名前が出る。ラベルの行はない。
    expect(screen.getByTestId("episode-card")).toBeOnTheScreen();
    expect(screen.queryByText(/対応作品を検出/)).toBeNull();
    expect(
      screen.getByText("第一章　始まり · 第二話　出会い"),
    ).toBeOnTheScreen();
    expect(screen.getByText("テスト作品 · 作者名")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", openButton));
    expect(screen).toHavePathname("/reader");
    expect(screen).toHaveSearchParams({ id: "narou-n1234ab" });
    expect(
      screen.getByText("テスト作品|作者名|第二話　出会い,次の話"),
    ).toBeOnTheScreen();
  });

  it("bookmarks the detected work onto the shelf without opening it", async () => {
    await openSite();
    await loadPage(narouEpisodeUrl, narouEpisodeHtml);
    // 作品を検出したり読んだりしても、本棚には入らない。
    expect(saveLibrary).toHaveBeenLastCalledWith([]);
    await fireEvent.press(screen.getByRole("button", { name: "本棚に追加" }));
    expect(screen).toHavePathname("/home/browse");
    expect(saveLibrary).toHaveBeenLastCalledWith([
      {
        id: "narou-n1234ab",
        source: "narou",
        title: "テスト作品",
        author: "作者名",
        episode: {
          id: "2",
          title: "第二話　出会い",
          url: narouEpisodeUrl,
        },
      },
    ]);
    // 同じボタンでまた外せる。
    await fireEvent.press(screen.getByRole("button", { name: "本棚から削除" }));
    expect(saveLibrary).toHaveBeenLastCalledWith([]);
    expect(
      screen.getByRole("button", { name: "本棚に追加" }),
    ).toBeOnTheScreen();
  });

  it("does not ask other pages for their HTML", async () => {
    await openSite();
    await act(async () => {
      webView().props.onLoad({ nativeEvent: { url: "https://syosetu.com/" } });
    });
    expect(commands.injectJavaScript).not.toHaveBeenCalled();
  });

  it("ignores messages from pages that are not episodes", async () => {
    await openSite();
    await navigate({ url: "https://example.com/n1234ab/2/" });
    await act(async () => {
      webView().props.onMessage({
        nativeEvent: {
          url: "https://example.com/n1234ab/2/",
          data: narouEpisodeHtml,
        },
      });
    });
    expect(screen.queryByText(/リーダーで開く/)).toBeNull();
  });

  it("attaches a fetched TOC so the reader spans the whole work", async () => {
    await openSite();
    await loadPage(narouEpisodeUrl, narouEpisodeHtml);
    await act(async () => {
      webView().props.onMessage({
        nativeEvent: {
          url: narouEpisodeUrl,
          data: JSON.stringify({ kind: "toc", html: narouTocHtml }),
        },
      });
    });

    await fireEvent.press(screen.getByRole("button", openButton));
    expect(screen).toHavePathname("/reader");
    // プローブは章のタイトルを表示する: 目次の 3 項目すべてと、その位置に
    // 入った開いた話の内容。
    expect(
      screen.getByText(
        "テスト作品|作者名|第一話,第二話　出会い,第三話,次の100話",
      ),
    ).toBeOnTheScreen();
  });

  it("ignores TOC payloads from a stale request", async () => {
    await openSite();
    await loadPage(narouEpisodeUrl, narouEpisodeHtml);
    await navigate({ url: "https://kakuyomu.jp/", loading: false });
    await act(async () => {
      webView().props.onMessage({
        nativeEvent: {
          url: narouEpisodeUrl,
          data: JSON.stringify({ kind: "toc", html: narouTocHtml }),
        },
      });
    });
    await navigate({ url: narouEpisodeUrl, loading: false });
    await fireEvent.press(screen.getByRole("button", openButton));
    // その目次は別のページのものだった。本は 1 話だけのまま。
    expect(
      screen.getByText("テスト作品|作者名|第二話　出会い,次の話"),
    ).toBeOnTheScreen();
  });

  it("shows no card for a table of contents", async () => {
    await openSite();
    await loadPage("https://ncode.syosetu.com/n1234ab/", narouTocHtml);
    expect(screen.queryByText(/リーダーで開く/)).toBeNull();
  });

  it("hides the card once the browser leaves the episode", async () => {
    await openSite();
    await loadPage(narouEpisodeUrl, narouEpisodeHtml);
    expect(screen.getByRole("button", openButton)).toBeOnTheScreen();

    await navigate({
      url: "https://ncode.syosetu.com/n1234ab/3/",
      loading: true,
    });
    expect(screen.queryByRole("button", openButton)).toBeNull();
  });
});
