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
  "No block registry is registered. `src/blocks.gen.ts` calls setBlockRegistry() when it is evaluated, so an application has to load it before rendering or validating blocks; an API process registers one from the `blocks` its plugins declare in `buildApiPlugin`.";

export class BlockRegistryMissingError extends BlockError {
  constructor() {
    super(BLOCK_REGISTRY_MISSING);

    this.name = "BlockRegistryMissingError";
  }
}
