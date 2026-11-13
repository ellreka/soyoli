/// <reference types="node" />
import { routes } from "@/testing/app";

import { act, fireEvent, screen } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import * as Speech from "expo-speech";

it("samples the chosen voice, and stops the sample on leaving the page", async () => {
  await renderRouter(routes, { initialUrl: "/settings/speed" });
  await fireEvent.press(
    await screen.findByRole("radio", { name: "日本語音声（拡張）" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "基本音声の試聴" }));
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "こんにちは。これは音声の試聴です。",
    expect.objectContaining({ voice: "ja-voice", rate: 1, pitch: 1 }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "基本音声の試聴を停止" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "基本音声の試聴" }));
  // 別の声を選ぶと、前の声の試聴は止まる。
  await fireEvent.press(screen.getByRole("radio", { name: "端末標準" }));
  expect(
    screen.getByRole("button", { name: "基本音声の試聴" }),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "基本音声の試聴" }));
  const stops = jest.mocked(Speech.stop).mock.calls.length;
  await fireEvent.press(screen.getByRole("button", { name: "戻る" }));
  expect(screen).toHavePathname("/settings");
  expect(jest.mocked(Speech.stop).mock.calls.length).toBeGreaterThan(stops);
  // 一覧には、使っている声と速度が出る。
  expect(
    screen.getByRole("button", { name: "音声設定" }),
  ).toHaveAccessibilityValue({ text: "端末標準 · 1x" });
});

it("shows voice loading, empty and failed states and retries without losing the default voice", async () => {
  let resolveVoices!: (voices: Speech.Voice[]) => void;
  jest.mocked(Speech.getAvailableVoicesAsync).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveVoices = resolve;
      }),
  );
  await renderRouter(routes, { initialUrl: "/settings/speed" });
  expect(screen.getByText("音声を読み込み中…")).toBeOnTheScreen();
  expect(
    screen.getByRole("button", { name: "音声一覧を再取得" }),
  ).toBeDisabled();
  expect(screen.getByRole("radio", { name: "端末標準" })).toBeChecked();
  await act(async () => {
    resolveVoices([]);
  });
  expect(screen.getByText(/日本語音声が見つかりません/)).toBeOnTheScreen();
  jest
    .mocked(Speech.getAvailableVoicesAsync)
    .mockRejectedValueOnce(new Error("unavailable"));
  await fireEvent.press(
    screen.getByRole("button", { name: "音声一覧を再取得" }),
  );
  expect(
    await screen.findByText(/音声一覧を取得できませんでした/),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "基本音声の試聴" }));
  expect(Speech.speak).toHaveBeenLastCalledWith(
    expect.any(String),
    expect.objectContaining({ voice: undefined }),
  );
  const options = jest.mocked(Speech.speak).mock.calls.at(-1)![1]!;
  await act(async () => {
    (options.onError as (error: Error) => void)(new Error("unavailable"));
  });
  expect(screen.getByText(/試聴できませんでした/)).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole("button", { name: "音声一覧を再取得" }),
  );
  expect(
    await screen.findByRole("radio", { name: "日本語音声（拡張）" }),
  ).toBeOnTheScreen();
  expect(screen.queryByText(/音声一覧を取得できませんでした/)).toBeNull();
});

it("sets the speed with a slider from 0.5 to 3, which the preset buttons also move", async () => {
  await renderRouter(routes);
  await fireEvent.press(
    await screen.findByRole("link", { name: "サンプル作品を開く" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "音声設定" }));
  // リーダーのシートには、設定タブのスイッチがない。
  expect(screen.queryByText("ページをめくる音")).toBeNull();
  const slider = await screen.findByRole("adjustable", { name: "速度" });
  expect(slider).toHaveProp("minimumValue", 0.5);
  expect(slider).toHaveProp("maximumValue", 3);
  expect(slider).toHaveProp("value", 1);
  // プリセットを押すと、スライダーのつまみがその値に動く。
  await fireEvent.press(screen.getByRole("radio", { name: "1.7×" }));
  expect(screen.getByRole("adjustable", { name: "速度" })).toHaveProp(
    "value",
    1.7,
  );
  // スライダーの上の値、選ばれたプリセット、リーダーのボタン。
  expect(screen.getAllByText("1.7×")).toHaveLength(3);
  // スライダーはボタンにない速度にも届く。値はドラッグ中に表示され、
  // 離したときに反映される。
  await fireEvent(slider, "RNCSliderSlidingStart", {
    nativeEvent: { value: 1.7 },
  });
  await fireEvent(slider, "RNCSliderValueChange", {
    nativeEvent: { value: 2.8000000000000003 },
  });
  expect(screen.getByText("2.8×")).toBeOnTheScreen();
  expect(screen.getByRole("adjustable", { name: "速度" })).toHaveProp(
    "value",
    1.7,
  );
  await fireEvent(slider, "RNCSliderSlidingComplete", {
    nativeEvent: { value: 2.8000000000000003 },
  });
  expect(screen.getByRole("adjustable", { name: "速度" })).toHaveProp(
    "value",
    2.8,
  );
  // 一致するプリセットがないので、どれも選択されない。
  expect(screen.queryByRole("radio", { checked: true, name: /×$/ })).toBeNull();
});

it("steps the speed and the pitch by a tenth with the buttons at the slider's ends", async () => {
  await renderRouter(routes, { initialUrl: "/reader?id=sample-01" });
  await fireEvent.press(
    await screen.findByRole("button", { name: "音声設定" }),
  );
  const speed = () => screen.getByRole("adjustable", { name: "速度" });
  await fireEvent.press(screen.getByRole("button", { name: "速度を上げる" }));
  expect(speed()).toHaveProp("value", 1.1);
  await fireEvent.press(screen.getByRole("button", { name: "速度を下げる" }));
  await fireEvent.press(screen.getByRole("button", { name: "速度を下げる" }));
  // ちょうど 0.1 刻みで、浮動小数の誤差が出ない。
  expect(speed()).toHaveProp("value", 0.9);
  // スライダーの上の値と、リーダーのボタン。
  expect(screen.getAllByText("0.9×")).toHaveLength(2);
  // 範囲の端では、その方向のボタンが無効になる。
  await fireEvent(speed(), "RNCSliderSlidingComplete", {
    nativeEvent: { value: 3 },
  });
  expect(screen.getByRole("button", { name: "速度を上げる" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "速度を下げる" })).toBeEnabled();

  const pitch = () => screen.getByRole("adjustable", { name: "声の高さ" });
  await fireEvent.press(
    screen.getByRole("button", { name: "声の高さを上げる" }),
  );
  expect(pitch()).toHaveProp("value", 1.1);
  await fireEvent.press(
    screen.getByRole("button", { name: "声の高さを下げる" }),
  );
  // ちょうど 1 に戻った: 声そのままとして表示される。
  expect(pitch()).toHaveProp("value", 1);
  expect(screen.getByText("標準")).toBeOnTheScreen();
});

it("opens the voices of brackets from the reader's sheet, on a page of their own", async () => {
  await renderRouter(routes, { initialUrl: "/reader?id=sample-01" });
  await screen.findByTestId("viewer-player");
  await fireEvent.press(screen.getByRole("button", { name: "音声設定" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "カッコ別の音声 オフ" }),
  );
  expect(screen).toHavePathname("/bracket-voices");
  await fireEvent.press(
    screen.getByRole("button", { name: "「」 会話の声 基本音声と同じ" }),
  );
  expect(screen).toHavePathname("/bracket-voice");
  await fireEvent.press(screen.getByRole("button", { name: "閉じる" }));
  await fireEvent.press(screen.getByRole("button", { name: "閉じる" }));
  // ページを開くとシートは閉じている。そうでないとページがシートの下になる。
  expect(screen).toHavePathname("/reader");
  expect(screen.queryByText("音声設定")).toBeNull();
});

it("gives a kind of bracket a voice of its own from the settings", async () => {
  jest.mocked(Speech.getAvailableVoicesAsync).mockResolvedValue([
    {
      identifier: "ja-voice",
      language: "ja-JP",
      name: "日本語音声",
      quality: Speech.VoiceQuality.Default,
    },
  ]);
  await renderRouter(routes, { initialUrl: "/settings/brackets" });
  expect(screen.getByText("カッコ別の音声")).toBeOnTheScreen();
  // どのカッコも、専用の声を決めるまでは基本の声で読まれる。
  await fireEvent.press(
    screen.getByRole("button", { name: "「」 会話の声 基本音声と同じ" }),
  );
  expect(screen).toHavePathname("/bracket-voice");
  expect(screen.getByText("「」 会話の声")).toBeOnTheScreen();
  const toggle = screen.getByRole("switch", { name: "このカッコの声を変える" });
  expect(toggle).not.toBeChecked();
  expect(screen.queryByRole("adjustable", { name: "声の高さ" })).toBeNull();
  await fireEvent(toggle, "valueChange", true);
  await fireEvent.press(
    await screen.findByRole("radio", { name: "日本語音声" }),
  );
  await fireEvent(
    screen.getByRole("adjustable", { name: "声の高さ" }),
    "RNCSliderSlidingComplete",
    { nativeEvent: { value: 1.5 } },
  );
  // 試聴は基本の高さではなく、そのカッコの高さで再生される。
  await fireEvent.press(screen.getByRole("button", { name: "声の試聴" }));
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "こんにちは。これは音声の試聴です。",
    expect.objectContaining({ voice: "ja-voice", pitch: 1.5 }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "閉じる" }));
  expect(screen).toHavePathname("/settings/brackets");
  expect(
    screen.getByRole("button", {
      name: "「」 会話の声 日本語音声 · 高さ 1.5",
    }),
  ).toBeOnTheScreen();
});
