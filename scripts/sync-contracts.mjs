import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, cpSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const coreRepo = process.argv[2];
if (!coreRepo) throw new Error("Usage: node scripts/sync-contracts.mjs <core-repository>");
const root = new URL("../", import.meta.url);
const provenanceUrl = new URL("contracts/provenance.json", root);
const provenance = JSON.parse(readFileSync(provenanceUrl, "utf8"));
const verified = run("git", ["-C", coreRepo, "rev-parse", `${provenance.core_commit}^{commit}`]).trim();
if (verified !== provenance.core_commit) throw new Error("The frozen Core commit is unavailable");
for (const [file, identity] of Object.entries(provenance.reference_files)) {
  const blob = run("git", ["-C", coreRepo, "rev-parse", `${provenance.core_commit}:${file}`]).trim();
  if (blob !== identity.git_blob) throw new Error(`Frozen reference blob mismatch: ${file}`);
  const bytes = spawnSync("git", ["-C", coreRepo, "show", `${provenance.core_commit}:${file}`], { encoding: null });
  if (bytes.status !== 0) throw new Error(bytes.stderr.toString("utf8"));
  const digest = createHash("sha256").update(bytes.stdout).digest("hex");
  if (digest !== identity.sha256) throw new Error(`Frozen reference SHA-256 mismatch: ${file}`);
}

const temporary = mkdtempSync(join(tmpdir(), "capbus-ui-contracts-"));
try {
  const archive = spawnSync("git", ["-C", coreRepo, "archive", provenance.core_commit, provenance.source_path], { encoding: null });
  if (archive.status !== 0) throw new Error(archive.stderr.toString("utf8"));
  const unpacked = join(temporary, "unpacked");
  run("mkdir", ["-p", unpacked]);
  const tar = spawnSync("tar", ["-x", "-C", unpacked], { input: archive.stdout, encoding: null });
  if (tar.status !== 0) throw new Error(tar.stderr.toString("utf8"));
  const source = join(unpacked, provenance.source_path);
  const destination = new URL(`${provenance.snapshot_path}/`, root).pathname;
  rmSync(destination, { recursive: true, force: true });
  cpSync(source, destination, { recursive: true });
  const files = {};
  for (const file of walk(source).sort()) files[file] = createHash("sha256").update(readFileSync(join(source, file))).digest("hex");
  provenance.files = files;
  writeFileSync(provenanceUrl, `${JSON.stringify(provenance, null, 2)}\n`);
  console.log(`synced ${Object.keys(files).length} files from ${provenance.core_commit}`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `${command} failed`);
  return result.stdout;
}
function walk(base) {
  const result = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const child = join(directory, entry.name);
      if (entry.isDirectory()) visit(child); else result.push(relative(base, child));
    }
  };
  visit(base); return result;
}
