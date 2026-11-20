/** @type {import('expo/fingerprint').Config} */
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
