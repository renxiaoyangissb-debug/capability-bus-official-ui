export function planLockedPackages(lock, platform = process.platform, architecture = process.arch) {
  if (lock?.lockfileVersion !== 3 || typeof lock.packages !== "object" || lock.packages === null) {
    throw new Error("Offline bootstrap requires a package-lock v3 packages table");
  }
  const plan = [];
  for (const [path, value] of Object.entries(lock.packages)) {
    if (path === "") continue;
    const entry = value ?? {};
    if (entry.optional === true && !matchesPlatform(entry, platform, architecture)) continue;
    const name = packageName(path);
    for (const field of ["version", "resolved", "integrity"]) {
      if (typeof entry[field] !== "string" || entry[field].length === 0) {
        throw new Error(`Locked package ${name} selected for ${platform}/${architecture} is missing ${field}`);
      }
    }
    plan.push({ name, version: entry.version, resolved: entry.resolved, integrity: entry.integrity });
  }
  return plan.sort((left, right) => left.name.localeCompare(right.name) || left.version.localeCompare(right.version));
}

export function selectCachedTarballs(plan, available) {
  return plan.map((locked) => {
    const source = available.get(locked.name)?.get(locked.version);
    if (!source) throw new Error(`Required locked tarball is not cached: ${locked.name}@${locked.version}`);
    if (String(source.entry.integrity) !== locked.integrity) {
      throw new Error(`Cached integrity does not match package-lock: ${locked.name}@${locked.version}`);
    }
    return { ...locked, source };
  });
}

export function cachedTarballs(index) {
  const available = new Map();
  for (const [key, entry] of Object.entries(index)) {
    const parsed = parseTarballKey(key);
    if (!parsed) continue;
    const versions = available.get(parsed.name) ?? new Map();
    versions.set(parsed.version, { key, entry });
    available.set(parsed.name, versions);
  }
  return available;
}

export function parseTarballKey(key) {
  const prefix = "make-fetch-happen:request-cache:https://registry.npmjs.org/";
  if (!key.startsWith(prefix) || !key.endsWith(".tgz")) return null;
  const path = key.slice(prefix.length);
  const match = path.match(/^(?:(@[^/]+)\/)?([^/]+)\/-\/[^/]+-((?:\d+\.){2}\d+(?:-[0-9A-Za-z.-]+)?)\.tgz$/);
  if (!match) return null;
  return { name: match[1] ? `${match[1]}/${match[2]}` : match[2], version: match[3] };
}

function packageName(path) {
  const marker = "node_modules/";
  const tail = path.slice(path.lastIndexOf(marker) + marker.length);
  const parts = tail.split("/");
  return parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
}

function matchesPlatform(entry, platform, architecture) {
  return matchesConstraint(entry.os, platform) && matchesConstraint(entry.cpu, architecture);
}

function matchesConstraint(value, current) {
  if (!Array.isArray(value) || value.length === 0) return true;
  const excluded = value.filter((item) => typeof item === "string" && item.startsWith("!")).map((item) => item.slice(1));
  if (excluded.includes(current)) return false;
  const allowed = value.filter((item) => typeof item === "string" && !item.startsWith("!"));
  return allowed.length === 0 || allowed.includes(current);
}
