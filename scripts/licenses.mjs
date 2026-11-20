import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "assets", "licenses.json");

const extras = [
  {
    name: "OtoLogic（ページをめくる音）",
    license: "CC-BY-4.0",
    homepage: "https://otologic.jp",
    text: "CC-BY-4.0",
  },
];

const licenseFile = /^(licen[sc]e|copying|notice)([-.][\w.-]*)?$/i;
const notText = /\.(js|cjs|mjs|ts|json|html)$/i;

function textOf(path) {
  const parts = readdirSync(path)
    .filter((file) => licenseFile.test(file) && !notText.test(file))
    .sort()
    .map((file) => join(path, file))
    .filter((file) => statSync(file).isFile())
    .map((file) => readFileSync(file, "utf8").replace(/\r\n/g, "\n").trim())
    .filter(Boolean);
  return parts.length ? parts.join("\n\n----------\n\n") : null;
}

const texts = [];
function indexOf(text) {
  const found = texts.indexOf(text);
  return found >= 0 ? found : texts.push(text) - 1;
}

const listed = JSON.parse(
  execFileSync("pnpm", ["licenses", "list", "--prod", "--json"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }),
);

function real(path) {
  return realpathSync(path);
}

function bundledPaths() {
  const out = mkdtempSync(join(tmpdir(), "soyoli-licenses-"));
  try {
    execFileSync(
      "npx",
      [
        "expo",
        "export",
        "--platform",
        "ios",
        "--platform",
        "android",
        "--source-maps",
        "--output-dir",
        out,
      ],
      { cwd: root, stdio: "ignore", env: { ...process.env, CI: "1" } },
    );
    const paths = new Set();
    for (const platform of ["ios", "android"]) {
      const dir = join(out, "_expo", "static", "js", platform);
      for (const file of readdirSync(dir).filter((f) => f.endsWith(".map"))) {
        const { sources } = JSON.parse(readFileSync(join(dir, file), "utf8"));
        for (const source of sources) {
          const found = /^(.*\/node_modules\/)((?:@[^/]+\/)?[^/]+)\//.exec(
            source,
          );
          if (found) {
            paths.add(real(join(root, found[1], found[2])));
          }
        }
      }
    }
    return paths;
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

const { dependencies } = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
);
const shipped = bundledPaths();
for (const name of Object.keys(dependencies)) {
  shipped.add(real(join(root, "node_modules", name)));
}

const packages = [];
for (const [license, group] of Object.entries(listed)) {
  for (const item of group) {
    item.paths.forEach((path, index) => {
      if (!shipped.delete(real(path))) {
        return;
      }
      const text = textOf(path);
      packages.push({
        name: item.name,
        version: item.versions[index],
        license,
        ...(typeof item.homepage === "string" &&
          item.homepage.startsWith("https://") && { homepage: item.homepage }),
        ...(text !== null && { text: indexOf(text) }),
      });
    });
  }
}
if (shipped.size) {
  throw new Error(
    `ライセンスが分からないパッケージがあります:\n${[...shipped].join("\n")}`,
  );
}

function standardText(license) {
  const marker = {
    "Apache-2.0": /^\s*Apache License\s+Version 2\.0, January 2004/,
    "CC-BY-4.0": /^\s*Attribution 4\.0 International/,
  }[license];
  for (const item of Object.values(listed).flat()) {
    for (const path of item.paths) {
      const text = textOf(path);
      if (text !== null && marker?.test(text)) {
        return indexOf(text);
      }
    }
  }
  throw new Error(`${license} の本文を持つパッケージが見つかりません。`);
}

for (const extra of extras) {
  packages.push({ ...extra, text: standardText(extra.text) });
}

const natives = JSON.parse(
  readFileSync(join(root, "scripts", "native-licenses.json"), "utf8"),
);
for (const { text, ...native } of natives) {
  const index =
    text !== undefined
      ? indexOf(text)
      : native.license === "Apache-2.0"
        ? standardText("Apache-2.0")
        : undefined;
  packages.push({ ...native, ...(index !== undefined && { text: index }) });
}

packages.sort((a, b) => {
  const byName = a.name.toLowerCase().localeCompare(b.name.toLowerCase(), "en");
  return byName !== 0
    ? byName
    : (a.version ?? "").localeCompare(b.version ?? "", "en", { numeric: true });
});

writeFileSync(output, `${JSON.stringify({ packages, texts })}\n`);
process.stdout.write(
  `${packages.length} 件、本文 ${texts.length} 種類を ${output} に書きました。\n`,
);
