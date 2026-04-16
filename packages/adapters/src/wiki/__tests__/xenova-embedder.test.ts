import { describe, it, expect, vi, beforeEach } from "vitest";
import { wikiEmbedderContractSuite } from "@teamagent/ports";

// Mock @xenova/transformers before any imports that use it
vi.mock("@xenova/transformers", () => ({
  pipeline: vi.fn().mockImplementation(() =>
    Promise.resolve(
      vi.fn().mockImplementation((texts: string[], _opts?: unknown) => {
        const inputTexts = Array.isArray(texts) ? texts : [texts];
        return Promise.resolve({
          tolist: () => inputTexts.map(() => Array<number>(384).fill(0.1)),
        });
      }),
    ),
  ),
}));

// Import after mock is set up
const { XenovaEmbedder } = await import("../xenova-embedder.js");

describe("XenovaEmbedder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("embed([]) returns []", async () => {
    const embedder = new XenovaEmbedder();
    const result = await embedder.embed([]);
    expect(result).toEqual([]);
  });

  it("embed(['text']) calls pipeline once and returns result", async () => {
    const { pipeline } = await import("@xenova/transformers");
    const embedder = new XenovaEmbedder();
    const result = await embedder.embed(["hello world"]);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(384);
    // pipeline factory was called once to load the model
    expect(pipeline).toHaveBeenCalledWith("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  });

  it("model is only loaded once (second embed does not re-download)", async () => {
    const { pipeline } = await import("@xenova/transformers");
    const embedder = new XenovaEmbedder();
    await embedder.embed(["first"]);
    await embedder.embed(["second"]);
    // pipeline factory should only have been called once for model loading
    expect(pipeline).toHaveBeenCalledTimes(1);
  });

  it("embed returns correct number of vectors", async () => {
    const embedder = new XenovaEmbedder();
    const result = await embedder.embed(["foo", "bar", "baz"]);
    expect(result).toHaveLength(3);
    for (const vec of result) {
      expect(vec).toHaveLength(384);
    }
  });
});

// Contract suite
describe("XenovaEmbedder (contract)", () => {
  wikiEmbedderContractSuite(() => new XenovaEmbedder());
});
