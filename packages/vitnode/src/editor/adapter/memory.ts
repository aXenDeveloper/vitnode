import type { VisualEditorAdapter, VisualEditorSaveInput } from "./types";

export interface MemoryVisualEditorAdapter extends VisualEditorAdapter {
  saves: readonly VisualEditorSaveInput[];
}

/**
 * An adapter that only records each save in `saves` - for tests, demos and
 * prototypes. Nothing is persisted.
 *
 * @param options.delay Milliseconds to wait before resolving, to simulate a request.
 * @param options.onSave Called with each save input.
 */
export const createMemoryAdapter = ({
  delay = 0,
  onSave,
}: {
  delay?: number;
  onSave?: (input: VisualEditorSaveInput) => Promise<void> | void;
} = {}): MemoryVisualEditorAdapter => {
  const saves: VisualEditorSaveInput[] = [];

  return {
    save: async input => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      saves.push(input);
      await onSave?.(input);
    },
    saves,
  };
};
