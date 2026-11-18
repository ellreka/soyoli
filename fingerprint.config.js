/**
 * runtimeVersion（`app.json` の `fingerprint`）のハッシュに何を入れるか。
 *
 * ハッシュが変わると別の runtime になり、出ているビルドに OTA アップデートが
 * 届かなくなる。だから、ネイティブ側に効かないものは入れない。
 *
 * `sourceSkips` を書くと既定（`balanced`）の一覧を置き換えるので、既定のものも
 * ここに並べる。足したのは最後の 2 つ:
 *
 * - `PackageJsonScriptsAll`: `package.json` の `scripts`。lint やテストの
 *   コマンドを変えただけで runtime が変わらないようにする。ネイティブ側を
 *   変えるスクリプト（`postinstall` など）を足すときは、これを外すこと。
 * - `GitIgnore`: `.gitignore`。
 *
 * @type {import('expo/fingerprint').Config}
 */
const config = {
  sourceSkips: [
    "PackageJsonAndroidAndIosScriptsIfNotContainRun",
    "ExpoConfigVersions",
    "ExpoConfigRuntimeVersionIfString",
    "EasJson",
    "Easignore",
    "AutolinkingConfigPaths",
    "PackageJsonScriptsAll",
    "GitIgnore",
  ],
};

module.exports = config;
