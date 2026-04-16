/**
 * Extract flat list of package names from project files.
 * Used by AutoSubscriber to determine which sources to subscribe to.
 * Pure function — caller provides file contents.
 */
export function detectStackPackages(files: Record<string, string>): string[] {
  const packages = new Set<string>();

  const pkg = files["package.json"];
  if (pkg) {
    try {
      const obj = JSON.parse(pkg);
      for (const section of ["dependencies", "devDependencies", "peerDependencies"]) {
        const s = obj[section];
        if (s && typeof s === "object") {
          for (const name of Object.keys(s)) packages.add(name);
        }
      }
    } catch {}
  }

  const req = files["requirements.txt"];
  if (req) {
    for (const line of req.split("\n")) {
      const match = line.trim().match(/^([a-zA-Z0-9_-]+)/);
      if (match?.[1]) packages.add(match[1].toLowerCase());
    }
  }

  const gomod = files["go.mod"];
  if (gomod) {
    for (const line of gomod.split("\n")) {
      const match = line.trim().match(/^require\s+(\S+)/);
      if (match?.[1]) packages.add(match[1]);
    }
  }

  const cargo = files["Cargo.toml"];
  if (cargo) {
    // Simple: extract [dependencies] section package names
    const depSection = cargo.match(/\[dependencies\]([\s\S]*?)(\[|$)/)?.[1] ?? "";
    for (const line of depSection.split("\n")) {
      const match = line.match(/^(\w[\w-]*)\s*=/);
      if (match?.[1]) packages.add(match[1]);
    }
  }

  return [...packages];
}

export function mergeStack(detected: string[], manual: string[]): string[] {
  return [...new Set([...detected, ...manual])];
}
