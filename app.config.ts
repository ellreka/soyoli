import type { ConfigContext, ExpoConfig } from "expo/config";

const isDevelopment = process.env.APP_VARIANT === "development";

const id = isDevelopment ? "net.ellreka.soyoli.dev" : "net.ellreka.soyoli";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: isDevelopment ? "Soyoli(dev)" : "Soyoli",
  slug: "soyoli",
  scheme: isDevelopment ? "soyoli-dev" : "soyoli",
  ios: { ...config.ios, bundleIdentifier: id },
  android: { ...config.android, package: id },
});
