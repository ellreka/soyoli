/// <reference types="node" />
import { routes } from "@/testing/app";

import { fireEvent, screen, within } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import { licensedPackages } from "@/features/about/licenses";

it("opens the list of libraries from the settings, and a library's license from the list", async () => {
  await renderRouter(routes, { initialUrl: "/settings" });
  expect(
    await screen.findByRole("button", { name: "バージョン" }),
  ).toHaveAccessibilityValue({ text: "1.2.3" });
  await fireEvent.press(
    screen.getByRole("button", { name: "オープンソースライセンス" }),
  );
  expect(screen).toHavePathname("/settings/licenses");
  const packages = licensedPackages();
  expect(
    screen.getByText(
      `このアプリは、次の${packages.length}件のライブラリと素材を使っています。`,
    ),
  ).toBeOnTheScreen();
  // 名前の順に並ぶ。行にはバージョンとライセンスの名前が出る。
  const first = packages[0];
  const row = screen.getByRole("button", {
    name: `${first.name} ${first.version}のライセンス`,
  });
  expect(within(row).getByText(first.license)).toBeOnTheScreen();
  await fireEvent.press(row);
  expect(screen).toHavePathname("/settings/license");
  expect(screen.getByRole("header", { name: first.name })).toBeOnTheScreen();
  expect(
    screen.getByText(`${first.version} · ${first.license}`),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "戻る" }));
  expect(screen).toHavePathname("/settings/licenses");
  await fireEvent.press(screen.getByRole("button", { name: "戻る" }));
  expect(screen).toHavePathname("/settings");
});

it("shows a library's license text, or its name where the library ships none", async () => {
  const packages = licensedPackages();
  const withText = packages.find((item) => item.name === "react")!;
  await renderRouter(routes, {
    initialUrl: `/settings/license?id=${encodeURIComponent(withText.id)}`,
  });
  expect(await screen.findByTestId("license-text")).toHaveTextContent(
    /Permission is hereby granted/,
  );
  expect(
    screen.getByRole("link", { name: "reactのページを開く" }),
  ).toBeOnTheScreen();
});

it("credits the page-turn sound, which has no version", async () => {
  const sound = licensedPackages().find((item) =>
    item.name.startsWith("OtoLogic"),
  )!;
  await renderRouter(routes, {
    initialUrl: `/settings/license?id=${encodeURIComponent(sound.id)}`,
  });
  expect(await screen.findByText("CC-BY-4.0")).toBeOnTheScreen();
  expect(screen.getByText("https://otologic.jp")).toBeOnTheScreen();
  expect(screen.getByTestId("license-text")).toHaveTextContent(
    /Attribution 4\.0 International/,
  );
});

it("says so for a library that is not in the list", async () => {
  await renderRouter(routes, { initialUrl: "/settings/license?id=nothing@0" });
  expect(await screen.findByText("見つかりません")).toBeOnTheScreen();
});
