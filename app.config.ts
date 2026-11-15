import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * `app.json` を土台に、開発用のビルドだけ別のアプリにする。
 *
 * `APP_VARIANT=development` のとき、名前・ID・URL スキームを変える。OS はこれを
 * 本番とは別のアプリとして扱うので、同じ端末に両方を入れておける。`slug` と
 * EAS のプロジェクトは変えない: どちらも同じプロジェクトのビルドである。
 */
const isDevelopment = process.env.APP_VARIANT === "development";

const id = isDevelopment ? "com.ellreka.soyoli.dev" : "com.ellreka.soyoli";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: isDevelopment ? "Soyoli(dev)" : "Soyoli",
  slug: "soyoli",
  // 両方が同じスキームを名乗ると、リンクをどちらで開くかが決まらない。
  scheme: isDevelopment ? "soyoli-dev" : "soyoli",
  ios: { ...config.ios, bundleIdentifier: id },
  android: { ...config.android, package: id },
});
