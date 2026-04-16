export interface WikiEmbedderPort {
  // Current impl: XenovaEmbedder (all-MiniLM-L6-v2, 384 dims)
  // Future: AnthropicEmbedder (marked as upgradeable)
  embed(texts: string[]): Promise<number[][]>;
}
