import type { WikiEmbedderPort } from "@teamagent/ports";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XenovaPipeline = (texts: string | string[], opts?: Record<string, unknown>) => Promise<{ tolist(): number[][] }>;

export class XenovaEmbedder implements WikiEmbedderPort {
  private pipeline: XenovaPipeline | null = null;
  private loadPromise: Promise<void> | null = null;

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    await this.ensureLoaded();
    const output = await this.pipeline!(texts, { pooling: "mean", normalize: true });
    return output.tolist();
  }

  private async ensureLoaded(): Promise<void> {
    if (this.pipeline) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.loadModel();
    return this.loadPromise;
  }

  private async loadModel(): Promise<void> {
    // Dynamic import to avoid loading at startup
    const { pipeline } = await import("@xenova/transformers");
    console.error("⏳ First run: downloading embedding model (~90MB)...");
    this.pipeline = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2") as unknown as XenovaPipeline;
    console.error("✓ Model ready.");
  }
}
