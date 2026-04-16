import { describe, it, expect } from "vitest";
import { detectStackPackages, mergeStack } from "../stack-packages.js";

describe("detectStackPackages", () => {
  it("returns empty array for empty files", () => {
    expect(detectStackPackages({})).toEqual([]);
  });

  it("extracts dependencies from package.json", () => {
    const files = {
      "package.json": JSON.stringify({
        dependencies: { react: "^18.0.0", axios: "^1.0.0" },
      }),
    };
    const result = detectStackPackages(files);
    expect(result).toContain("react");
    expect(result).toContain("axios");
  });

  it("extracts devDependencies from package.json", () => {
    const files = {
      "package.json": JSON.stringify({
        devDependencies: { vitest: "^2.0.0", typescript: "^5.0.0" },
      }),
    };
    const result = detectStackPackages(files);
    expect(result).toContain("vitest");
    expect(result).toContain("typescript");
  });

  it("extracts peerDependencies from package.json", () => {
    const files = {
      "package.json": JSON.stringify({
        peerDependencies: { react: ">=17" },
      }),
    };
    const result = detectStackPackages(files);
    expect(result).toContain("react");
  });

  it("deduplicates packages appearing in multiple sections", () => {
    const files = {
      "package.json": JSON.stringify({
        dependencies: { react: "^18.0.0" },
        devDependencies: { react: "^18.0.0" },
      }),
    };
    const result = detectStackPackages(files);
    expect(result.filter((p) => p === "react")).toHaveLength(1);
  });

  it("handles malformed package.json gracefully", () => {
    const files = { "package.json": "not valid json" };
    expect(() => detectStackPackages(files)).not.toThrow();
    expect(detectStackPackages(files)).toEqual([]);
  });

  it("extracts packages from requirements.txt", () => {
    const files = {
      "requirements.txt": "numpy==1.24.0\npandas>=2.0.0\nscikit-learn\n",
    };
    const result = detectStackPackages(files);
    expect(result).toContain("numpy");
    expect(result).toContain("pandas");
    expect(result).toContain("scikit-learn");
  });

  it("lowercases requirements.txt packages", () => {
    const files = { "requirements.txt": "NumPy==1.24.0\n" };
    const result = detectStackPackages(files);
    expect(result).toContain("numpy");
  });

  it("extracts packages from go.mod require lines", () => {
    const files = {
      "go.mod": `module example.com/myapp\n\ngo 1.21\n\nrequire github.com/gin-gonic/gin v1.9.0\nrequire golang.org/x/net v0.17.0\n`,
    };
    const result = detectStackPackages(files);
    expect(result).toContain("github.com/gin-gonic/gin");
    expect(result).toContain("golang.org/x/net");
  });

  it("extracts packages from Cargo.toml dependencies section", () => {
    const files = {
      "Cargo.toml": `[package]\nname = "my-app"\n\n[dependencies]\nserde = "1.0"\ntokio = { version = "1.0", features = ["full"] }\n`,
    };
    const result = detectStackPackages(files);
    expect(result).toContain("serde");
    expect(result).toContain("tokio");
  });

  it("combines packages from multiple file types", () => {
    const files = {
      "package.json": JSON.stringify({ dependencies: { react: "^18" } }),
      "requirements.txt": "numpy==1.24.0\n",
    };
    const result = detectStackPackages(files);
    expect(result).toContain("react");
    expect(result).toContain("numpy");
  });
});

describe("mergeStack", () => {
  it("merges detected and manual stacks", () => {
    const result = mergeStack(["react", "typescript"], ["vite"]);
    expect(result).toContain("react");
    expect(result).toContain("typescript");
    expect(result).toContain("vite");
  });

  it("deduplicates entries", () => {
    const result = mergeStack(["react", "typescript"], ["react", "zod"]);
    expect(result.filter((p) => p === "react")).toHaveLength(1);
  });

  it("returns empty array for two empty arrays", () => {
    expect(mergeStack([], [])).toEqual([]);
  });

  it("works with only detected packages", () => {
    const result = mergeStack(["react"], []);
    expect(result).toEqual(["react"]);
  });

  it("works with only manual packages", () => {
    const result = mergeStack([], ["vue"]);
    expect(result).toEqual(["vue"]);
  });
});
