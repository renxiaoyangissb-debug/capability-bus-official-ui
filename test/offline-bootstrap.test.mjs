import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { planLockedPackages, selectCachedTarballs } from "../scripts/offline-lock-plan.mjs";

const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));

test("offline plan is determined by the lock and current platform, not cache contents", () => {
  const plan = planLockedPackages(lock, "darwin", "arm64");
  const names = plan.map((item) => item.name);
  assert.ok(names.includes("@rolldown/binding-darwin-arm64"));
  assert.ok(names.includes("lightningcss-darwin-arm64"));
  assert.ok(names.includes("fsevents"));
  assert.ok(!names.includes("@rolldown/binding-darwin-x64"));
  assert.ok(!names.includes("lightningcss-linux-x64-gnu"));

  const available = availableFor(plan);
  const baseline = selectCachedTarballs(plan, available).map(identity);
  available.get("lightningcss-darwin-arm64").set("99.0.0", {
    key: "unused-extra-tarball",
    entry: { integrity: "sha512-unused" }
  });
  assert.deepEqual(selectCachedTarballs(plan, available).map(identity), baseline);
});

test("a missing current-platform optional tarball fails closed", () => {
  const plan = planLockedPackages(lock, "darwin", "arm64");
  const available = availableFor(plan);
  available.get("lightningcss-darwin-arm64").delete("1.33.0");
  assert.throws(
    () => selectCachedTarballs(plan, available),
    /Required locked tarball is not cached: lightningcss-darwin-arm64@1\.33\.0/
  );
});

test("cached content with the wrong integrity fails closed", () => {
  const plan = planLockedPackages(lock, "darwin", "arm64");
  const available = availableFor(plan);
  available.get("@rolldown/binding-darwin-arm64").get("1.2.1").entry.integrity = "sha512-wrong";
  assert.throws(
    () => selectCachedTarballs(plan, available),
    /Cached integrity does not match package-lock/
  );
});

function availableFor(plan) {
  const available = new Map();
  for (const item of plan) {
    const versions = available.get(item.name) ?? new Map();
    versions.set(item.version, {
      key: `make-fetch-happen:request-cache:${item.resolved}`,
      entry: { integrity: item.integrity }
    });
    available.set(item.name, versions);
  }
  return available;
}

function identity(item) {
  return { name: item.name, version: item.version, integrity: item.integrity };
}
