import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "scripts", "native-licenses.json");
const gradleCache = join(
  homedir(),
  ".gradle",
  "caches",
  "modules-2",
  "files-2.1",
);

function spdx(name) {
  const known = [
    [/apache/i, "Apache-2.0"],
    [/^(the )?mit( licen[sc]e)?$/i, "MIT"],
    [/^(simplified bsd|bsd 2-clause)/i, "BSD-2-Clause"],
  ];
  return (
    known.find(([pattern]) => pattern.test(name.trim()))?.[1] ?? name.trim()
  );
}

function pomOf(group, artifact, version) {
  const dir = join(gradleCache, group, artifact, version);
  if (!existsSync(dir)) {
    return null;
  }
  for (const hash of readdirSync(dir)) {
    const file = readdirSync(join(dir, hash)).find((name) =>
      name.endsWith(".pom"),
    );
    if (file) {
      return readFileSync(join(dir, hash, file), "utf8");
    }
  }
  return null;
}

function tag(xml, name) {
  return new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1]?.trim();
}

function describe(group, artifact, version, depth = 0) {
  const pom = pomOf(group, artifact, version);
  if (pom === null) {
    return null;
  }
  const parent = /<parent>([\s\S]*?)<\/parent>/.exec(pom)?.[1];
  const own = pom
    .replace(/<parent>[\s\S]*?<\/parent>/, "")
    .replace(/<dependencies>[\s\S]*?<\/dependencies>/g, "");
  const licenses = [...own.matchAll(/<license>([\s\S]*?)<\/license>/g)]
    .map((match) => tag(match[1], "name"))
    .filter(Boolean)
    .map(spdx);
  const homepage = tag(
    own
      .replace(/<licenses>[\s\S]*?<\/licenses>/, "")
      .replace(/<scm>[\s\S]*?<\/scm>/, "")
      .replace(/<developers>[\s\S]*?<\/developers>/, "")
      .replace(/<organization>[\s\S]*?<\/organization>/, ""),
    "url",
  );
  const inherited =
    licenses.length === 0 && parent && depth < 4
      ? describe(
          tag(parent, "groupId"),
          tag(parent, "artifactId"),
          tag(parent, "version"),
          depth + 1,
        )
      : null;
  return {
    license: licenses.length
      ? [...new Set(licenses)].join(" AND ")
      : (inherited?.license ?? ""),
    homepage: homepage ?? inherited?.homepage,
  };
}

const local =
  /^(host\.exp\.exponent|expo\.modules\.|com\.facebook\.react:react-native:)/;

function android() {
  const tree = execFileSync(
    "./gradlew",
    ["-q", ":app:dependencies", "--configuration", "releaseRuntimeClasspath"],
    {
      cwd: join(root, "android"),
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: {
        ...process.env,
        ANDROID_HOME:
          process.env.ANDROID_HOME ??
          join(homedir(), "Library", "Android", "sdk"),
      },
    },
  );
  const coordinates = new Set(
    [
      ...tree.matchAll(/([\w.-]+):([\w.-]+):([\w.+-]+)(?: -> ([\w.+-]+))?/g),
    ].map(
      ([, group, artifact, version, resolved]) =>
        `${group}:${artifact}:${resolved ?? version}`,
    ),
  );
  const groups = new Map();
  for (const coordinate of [...coordinates].sort()) {
    const [group, artifact, version] = coordinate.split(":");
    const found = describe(group, artifact, version);
    if (found === null) {
      if (!local.test(coordinate)) {
        throw new Error(`POM が見つかりません: ${coordinate}`);
      }
      continue;
    }
    if (!found.license) {
      throw new Error(`ライセンスが分かりません: ${coordinate}`);
    }
    groups.set(group, [
      ...(groups.get(group) ?? []),
      { artifact, version, ...found },
    ]);
  }
  const entries = [];
  for (const [group, artifacts] of groups) {
    const same = (key) =>
      new Set(artifacts.map((item) => item[key])).size === 1;
    const rows =
      artifacts.length > 1 && same("license")
        ? [
            {
              ...artifacts[0],
              name: group,
              version: same("version") ? artifacts[0].version : undefined,
            },
          ]
        : artifacts.map((item) => ({
            ...item,
            name: `${group}:${item.artifact}`,
          }));
    for (const row of rows) {
      entries.push({
        name: row.name,
        ...(row.version && { version: row.version }),
        license: row.license,
        ...(row.homepage?.startsWith("https://") && { homepage: row.homepage }),
      });
    }
  }
  return entries;
}

function ios() {
  const pods = join(root, "ios", "Pods");
  const target = readdirSync(join(pods, "Target Support Files")).find(
    (name) => name.startsWith("Pods-") && !name.includes("Tests"),
  );
  const { PreferenceSpecifiers: items } = JSON.parse(
    execFileSync(
      "plutil",
      [
        "-convert",
        "json",
        "-o",
        "-",
        join(
          pods,
          "Target Support Files",
          target,
          `${target}-acknowledgements.plist`,
        ),
      ],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    ),
  );
  const fromNpm = new Set(
    readdirSync(join(pods, "Local Podspecs")).map((file) =>
      file.replace(/\.podspec\.json$/, ""),
    ),
  );
  const lock = readFileSync(join(root, "ios", "Podfile.lock"), "utf8");
  return items
    .filter((item) => item.License && !fromNpm.has(item.Title))
    .map((item) => {
      const version = new RegExp(`^  - ${item.Title} \\(([^)]+)\\)`, "m").exec(
        lock,
      )?.[1];
      return {
        name: item.Title,
        ...(version && { version }),
        license: item.License,
        text: item.FooterText.trim(),
      };
    });
}

const entries = [...android(), ...ios()];
writeFileSync(output, `${JSON.stringify(entries, null, 2)}\n`);
process.stdout.write(`${entries.length} 件を ${output} に書きました。\n`);
