import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../", import.meta.url);
const provenance = JSON.parse(readFileSync(new URL("contracts/provenance.json", root), "utf8"));
const snapshot = new URL(`${provenance.snapshot_path}/`, root);
const actualFiles = walk(snapshot).sort();
const expectedFiles = Object.keys(provenance.files).sort();
if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
  throw new Error(`Contract inventory mismatch\nexpected=${expectedFiles.join(",")}\nactual=${actualFiles.join(",")}`);
}
for (const file of actualFiles) {
  const bytes = readFileSync(new URL(file, snapshot));
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== provenance.files[file]) throw new Error(`Contract hash mismatch: ${file}`);
}
if (provenance.core_commit !== "78127bb9192aa6ddf8f15b544c553c149415c5a5") throw new Error("Unexpected Core commit");
if (provenance.protocol_version !== "0.1.0-alpha.1") throw new Error("Unexpected protocol version");
for (const [file, identity] of Object.entries(provenance.reference_files)) {
  if (!/^[0-9a-f]{40}$/.test(identity.git_blob) || !/^[0-9a-f]{64}$/.test(identity.sha256)) throw new Error(`Invalid frozen reference identity: ${file}`);
}
console.log(`contracts: ${actualFiles.length} files and ${Object.keys(provenance.reference_files).length} reference identities match Core ${provenance.core_commit}`);

function walk(directoryUrl) {
  const basePath = directoryUrl.pathname;
  const result = [];
  const visit = (path) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) visit(child);
      else result.push(relative(basePath, child));
    }
  };
  visit(basePath);
  return result;
}
