import React from "react";
import { useTranslations } from "use-intl";

import type { FileConstraints } from "@/lib/file-constraints";

import {
  fileAcceptAttribute,
  fileFormatLabels,
  validateFile,
} from "@/lib/file-constraints";
import { formatBytes } from "@/lib/format-bytes";

import type { Offset, Size } from "./crop-math";
import type { ImageCropOutput, LoadedSource } from "./crop-render";

import { clampOffset, clampZoom, MIN_ZOOM } from "./crop-math";
import {
  CROP_UNREADABLE,
  encoderFor,
  loadSource,
  renderCrop,
} from "./crop-render";

export type { ImageCropOutput } from "./crop-render";

export interface UseImageCropOptions {
  constraints: FileConstraints;
  fileName: string;
  onSourceChange?: (hasSource: boolean) => void;
  output: ImageCropOutput;
}

export interface ImageCrop {
  accept: string | undefined;
  clear: () => void;
  error: null | string;
  isLoading: boolean;
  offset: Offset;
  pick: (files: File[]) => void;
  setError: (message: null | string) => void;
  source: LoadedSource | null;
  toFile: () => Promise<File>;
  updateOffset: (
    update: (current: Offset, frame: Size) => Offset,
    frame?: Size,
  ) => void;
  updateZoom: (update: (current: number) => number) => void;
  zoom: number;
}

const INITIAL_VIEW: { offset: Offset; zoom: number } = {
  offset: { x: 0, y: 0 },
  zoom: MIN_ZOOM,
};

export const useImageCrop = ({
  constraints,
  fileName,
  onSourceChange,
  output,
}: UseImageCropOptions): ImageCrop => {
  const t = useTranslations("core.global.image_crop");
  const tFile = useTranslations("core.global.file");
  const [source, setSource] = React.useState<LoadedSource | null>(null);
  const sourceRef = React.useRef<LoadedSource | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<null | string>(null);
  const [view, setView] = React.useState(INITIAL_VIEW);
  const { offset, zoom } = view;
  const frameRef = React.useRef<Size>({ height: 0, width: 0 });

  const formats = fileFormatLabels(constraints);

  React.useEffect(
    () => () => {
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url);
    },
    [],
  );

  const replaceSource = (next: LoadedSource | null) => {
    if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url);
    sourceRef.current = next;
    setSource(next);
    setView(INITIAL_VIEW);
    onSourceChange?.(next !== null);
  };

  const read = async (chosen: File) => {
    const rejection = validateFile(constraints, {
      mimeType: chosen.type,
      name: chosen.name,
      size: chosen.size,
    });
    if (rejection) {
      setError(
        rejection.reason === "size"
          ? tFile("errors.too_large", {
              max: formatBytes(constraints.maxBytes),
              size: rejection.value,
            })
          : tFile("errors.wrong_format", {
              formats: formats.join(", "),
              value: rejection.value,
            }),
      );

      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      replaceSource(await loadSource(chosen));
    } catch {
      setError(t("errors.unreadable"));
    } finally {
      setIsLoading(false);
    }
  };

  const updateOffset = (
    update: (current: Offset, frame: Size) => Offset,
    frame?: Size,
  ) => {
    if (frame) frameRef.current = frame;
    if (!source) return;

    setView(current => ({
      offset: clampOffset(
        update(current.offset, frameRef.current),
        source.size,
        frameRef.current,
        current.zoom,
      ),
      zoom: current.zoom,
    }));
  };

  const updateZoom = React.useCallback(
    (update: (current: number) => number) => {
      setView(current => {
        const next = clampZoom(update(current.zoom));

        return {
          offset: source
            ? clampOffset(current.offset, source.size, frameRef.current, next)
            : current.offset,
          zoom: next,
        };
      });
    },
    [source],
  );

  return {
    accept: fileAcceptAttribute(constraints),
    clear: () => {
      replaceSource(null);
      setError(null);
    },
    error,
    isLoading,
    offset,
    pick: files => {
      const chosen = files[0];
      if (chosen) void read(chosen);
    },
    setError,
    source,
    toFile: async () => {
      if (!source) throw new Error(CROP_UNREADABLE);

      const blob = await renderCrop({
        frame: frameRef.current,
        offset,
        output,
        source,
        zoom,
      });
      if (blob.size > constraints.maxBytes) {
        throw new Error(
          t("errors.too_large_after_crop", {
            max: formatBytes(constraints.maxBytes),
            size: formatBytes(blob.size),
          }),
        );
      }

      const { extension } = encoderFor();

      return new File([blob], `${fileName}.${extension}`, { type: blob.type });
    },
    updateOffset,
    updateZoom,
    zoom,
  };
};
