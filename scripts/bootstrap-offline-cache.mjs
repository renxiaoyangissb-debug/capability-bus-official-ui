import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const npmExecutable = command("which", ["npm"]).trim();
const npmRoot = resolve(dirname(realpathSync(npmExecutable)), "../node_modules");
const requireFromNpm = createRequire(join(npmRoot, "bootstrap.cjs"));
const cacache = requireFromNpm(join(npmRoot, "cacache"));
const semver = requireFromNpm(join(npmRoot, "semver"));
const sourceCache = command("npm", ["config", "get", "cache"]).trim() + "/_cacache";
const workspace = process.cwd();
const packageJson = JSON.parse(readFileSync(join(workspace, "package.json"), "utf8"));
const temporary = mkdtempSync(join(tmpdir(), "capbus-ui-offline-npm-"));
const targetCache = join(temporary, "cache");
const targetContentCache = join(targetCache, "_cacache");
const archiveDirectory = join(temporary, "archives");
command("mkdir", ["-p", archiveDirectory]);

try {
  const index = await cacache.ls(sourceCache);
  const available = new Map();
  for (const [key, entry] of Object.entries(index)) {
    const parsed = parseTarballKey(key);
    if (!parsed) continue;
    const versions = available.get(parsed.name) ?? new Map();
    versions.set(parsed.version, { key, entry });
    available.set(parsed.name, versions);
  }

  const requirements = new Map();
  for (const [name, range] of Object.entries({ ...packageJson.dependencies, ...packageJson.devDependencies })) addRequirement(name, range);
  const selected = new Map();
  const metadata = new Map();
  const pending = [...requirements.keys()];
  while (pending.length > 0) {
    const name = pending.shift();
    const choices = available.get(name);
    if (!choices) throw new Error(`No cached tarball for ${name}`);
    const ranges = requirements.get(name);
    const version = [...choices.keys()].filter((item) => ranges.every((range) => semver.satisfies(item, range, { includePrerelease: true }))).sort(semver.rcompare)[0];
    if (!version) throw new Error(`No single cached ${name} version satisfies ${ranges.join(", ")}`);
    if (selected.get(name) === version) continue;
    selected.set(name, version);
    const pkg = await readPackage(name, version, choices.get(version));
    metadata.set(name, pkg);
    const dependencies = { ...pkg.dependencies, ...pkg.optionalDependencies };
    for (const [dependency, range] of Object.entries(dependencies ?? {})) {
      if (pkg.optionalDependencies?.[dependency] !== undefined && !matchesCurrentPlatform(dependency)) continue;
      if (!available.has(dependency)) {
        if (pkg.optionalDependencies?.[dependency] !== undefined) continue;
        throw new Error(`No cached tarball for required ${dependency}@${range} from ${name}@${version}`);
      }
      if (pkg.optionalDependencies?.[dependency] !== undefined && ![...available.get(dependency).keys()].some((item) => semver.satisfies(item, range, { includePrerelease: true }))) continue;
      if (addRequirement(dependency, range)) pending.push(dependency);
    }
    for (const [peer, range] of Object.entries(pkg.peerDependencies ?? {})) {
      if (pkg.peerDependenciesMeta?.[peer]?.optional) continue;
      if (!available.has(peer)) throw new Error(`No cached peer ${peer}@${range} from ${name}@${version}`);
      if (addRequirement(peer, range)) pending.push(peer);
    }
  }

  for (const [name, version] of selected) {
    const source = available.get(name).get(version);
    const data = (await cacache.get(sourceCache, source.key)).data;
    await cacache.put(targetContentCache, source.key, data, { metadata: source.entry.metadata, integrity: source.entry.integrity });
    const pkg = metadata.get(name);
    const tarball = source.key.replace("make-fetch-happen:request-cache:", "");
    const packument = {
      name,
      "dist-tags": { latest: version },
      versions: { [version]: { ...pkg, dist: { tarball, integrity: source.entry.integrity } } }
    };
    const packumentUrl = `https://registry.npmjs.org/${name.startsWith("@") ? name.replace("/", "%2f") : name}`;
    await cacache.put(targetContentCache, `make-fetch-happen:request-cache:${packumentUrl}`, JSON.stringify(packument), {
      metadata: { time: Date.now(), url: packumentUrl, reqHeaders: { accept: "application/json" }, resHeaders: { "content-type": "application/json", "cache-control": "public, max-age=300", vary: "accept" }, options: { compress: true } }
    });
  }

  const install = spawnSync("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", targetCache], { cwd: workspace, encoding: "utf8" });
  process.stdout.write(install.stdout);
  process.stderr.write(install.stderr);
  if (install.status !== 0) process.exitCode = install.status ?? 1;
  else console.log(`offline bootstrap: ${selected.size} cached packages locked and installed`);

  function addRequirement(name, range) {
    const ranges = requirements.get(name) ?? [];
    if (ranges.includes(range)) return false;
    ranges.push(range);
    requirements.set(name, ranges);
    return true;
  }

  async function readPackage(name, version, source) {
    const archive = join(archiveDirectory, `${name.replaceAll("/", "-")}-${version}.tgz`);
    writeFileSync(archive, (await cacache.get(sourceCache, source.key)).data);
    const output = spawnSync("tar", ["-xOf", archive, "package/package.json"], { encoding: "utf8" });
    if (output.status !== 0) throw new Error(`Cannot inspect ${name}@${version}: ${output.stderr}`);
    return JSON.parse(output.stdout);
  }
} finally {
  if (process.env.CAPBUS_KEEP_TEMP === "1") console.log(`offline cache retained at ${temporary}`);
  else rmSync(temporary, { recursive: true, force: true });
}

function parseTarballKey(key) {
  const prefix = "make-fetch-happen:request-cache:https://registry.npmjs.org/";
  if (!key.startsWith(prefix) || !key.endsWith(".tgz")) return null;
  const path = key.slice(prefix.length);
  const match = path.match(/^(?:(@[^/]+)\/)?([^/]+)\/-\/[^/]+-((?:\d+\.){2}\d+(?:-[0-9A-Za-z.-]+)?)\.tgz$/);
  if (!match) return null;
  return { name: match[1] ? `${match[1]}/${match[2]}` : match[2], version: match[3] };
}

function matchesCurrentPlatform(name) {
  if (name.includes("wasm32")) return false;
  const platforms = ["darwin", "linux", "win32", "freebsd", "android"];
  const namedPlatform = platforms.find((item) => name.includes(`-${item}`));
  if (namedPlatform && namedPlatform !== process.platform) return false;
  const architectures = ["arm64", "x64", "ia32", "ppc64", "s390x", "riscv64"];
  const namedArchitecture = architectures.find((item) => name.endsWith(`-${item}`) || name.includes(`-${item}-`));
  return !namedArchitecture || namedArchitecture === process.arch;
}

function command(executable, args) {
  const result = spawnSync(executable, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `${basename(executable)} failed`);
  return result.stdout;
}
