import type { VisualEditorAdapter, VisualEditorSaveInput } from "./types";

export interface MemoryVisualEditorAdapter extends VisualEditorAdapter {
  saves: readonly VisualEditorSaveInput[];
}

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
