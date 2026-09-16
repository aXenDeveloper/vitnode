export class BlockError extends Error {
  constructor(
    message: string,
    options?: { blockId?: string; cause?: unknown },
  ) {
    super(
      options?.blockId
        ? `[Blocks] ${options.blockId}: ${message}`
        : `[Blocks] ${message}`,
      { cause: options?.cause },
    );

    this.name = "BlockError";
    this.blockId = options?.blockId;
  }

  readonly blockId: string | undefined;
}

export const BLOCK_REGISTRY_MISSING =
  "No block registry was given and none is installed as this process's default. Pass one - `<ContentRenderer registry={blocksRegistry} />`, or `zodBlockInstances({ registry })` - or install one with setDefaultBlockRegistry(), which `src/blocks.gen.ts` does when it is evaluated.";

export class BlockRegistryMissingError extends BlockError {
  constructor() {
    super(BLOCK_REGISTRY_MISSING);

    this.name = "BlockRegistryMissingError";
  }
}
