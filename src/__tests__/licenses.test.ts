/// <reference types="node" />
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { findPackage, licensedPackages } from "@/features/about/licenses";

const root = join(__dirname, "..", "..");

function readJson(...path: string[]): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, ...path), "utf8")) as Record<
    string,
    unknown
  >;
}

it("lists every library the app depends on, at the installed version", () => {
  const dependencies = Object.keys(
    readJson("package.json").dependencies as Record<string, string>,
  );
  const missing = dependencies.filter((name) => {
    const { version } = readJson("node_modules", name, "package.json");
    return !findPackage(`${name}@${String(version)}`);
  });
  expect(missing).toEqual([]);
});

it("carries the license text of a library, shared between the libraries that use the same one", () => {
  const react = findPackage(
    `react@${String(readJson("node_modules", "react", "package.json").version)}`,
  )!;
  expect(react.license).toBe("MIT");
  expect(react.text).toContain("Permission is hereby granted");
  expect(react.homepage).toMatch(/^https:\/\//);
});

it("lists the native libraries that do not come through npm", () => {
  const named = (name: string) =>
    licensedPackages().find((item) => item.name === name)!;
  const pdfbox = named("com.tom-roush:pdfbox-android");
  expect(pdfbox.license).toBe("Apache-2.0");
  expect(pdfbox.text).toContain("Apache License");
  expect(named("androidx.lifecycle").license).toBe("Apache-2.0");
  expect(named("com.squareup.okhttp3").text).toContain("Apache License");
  expect(named("ReachabilitySwift").text).toContain("Ashley Mills");
});

it("names each library once per version, in alphabetical order", () => {
  const packages = licensedPackages();
  const ids = packages.map((item) => item.id);
  expect(new Set(ids).size).toBe(ids.length);
  const names = packages.map((item) => item.name.toLowerCase());
  expect(names).toEqual(names.toSorted((a, b) => a.localeCompare(b, "en")));
  expect(packages.filter((item) => !item.license)).toEqual([]);
});
