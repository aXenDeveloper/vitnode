import type { Editor, ReactNodeViewProps } from "@tiptap/react";

import { cn } from "cn";
import { ImageUpIcon, Settings2Icon, Trash2Icon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import {
  themeIndicatorClassName,
  themeSegmentClassName,
  themeSegmentPressedClassName,
  themeSegmentsClassName,
} from "@/components/switchers/themes/theme-options";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  slidingIndicatorTransitionClassName,
  useSlidingIndicator,
} from "@/hooks/use-sliding-indicator";
import {
  EDITOR_IMAGE_MAX_ALT_LENGTH,
  EDITOR_IMAGE_MIME_TYPES,
  EDITOR_IMAGE_MIN_WIDTH,
  EDITOR_IMAGE_WRAPS,
  type EditorImageWrap,
} from "@/lib/editor-uploads";

import { replaceEditorImageFile } from "../uploads/flow";
import { useEditorUploadRuntime } from "../uploads/runtime";

const WRAPPED_DEFAULT_WIDTH = 50;

const FULL_LINES = [13, 17, 21].map(y => ({ width: 22, x: 1, y }));

const linesBeside = (x: number) => [
  { width: 9, x, y: 3 },
  { width: 9, x, y: 7 },
  ...FULL_LINES,
];

const WRAP_LAYOUTS: Record<
  EditorImageWrap,
  { imageX: number; lines: { width: number; x: number; y: number }[] }
> = {
  left: { imageX: 1, lines: linesBeside(14) },
  none: { imageX: 7, lines: FULL_LINES },
  right: { imageX: 13, lines: linesBeside(1) },
};

const WrapIcon = ({ wrap }: { wrap: EditorImageWrap }) => (
  <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
    <rect height="9" rx="1.5" width="10" x={WRAP_LAYOUTS[wrap].imageX} y="1" />
    {WRAP_LAYOUTS[wrap].lines.map(line => (
      <rect
        height="2"
        key={`${line.x}-${line.y}`}
        rx="1"
        width={line.width}
        x={line.x}
        y={line.y}
      />
    ))}
  </svg>
);

const WrapSwitcher = ({
  labelledBy,
  onChange,
  value,
}: {
  labelledBy: string;
  onChange: (wrap: EditorImageWrap) => void;
  value: EditorImageWrap;
}) => {
  const t = useTranslations("core.global.editor.image.wrap");
  const { containerRef, indicatorRef, isReady } =
    useSlidingIndicator<HTMLDivElement>(EDITOR_IMAGE_WRAPS.indexOf(value));

  return (
    <div
      aria-labelledby={labelledBy}
      className={themeSegmentsClassName}
      ref={containerRef}
      role="group"
    >
      <span
        aria-hidden
        className={cn(
          themeIndicatorClassName,
          isReady && slidingIndicatorTransitionClassName,
        )}
        ref={indicatorRef}
      />
      {EDITOR_IMAGE_WRAPS.map(option => (
        <button
          aria-pressed={value === option}
          className={cn(themeSegmentClassName, themeSegmentPressedClassName)}
          data-sliding-indicator-item
          key={option}
          onClick={() => {
            onChange(option);
          }}
          type="button"
        >
          <WrapIcon wrap={option} />
          <span className="w-full truncate text-center">{t(option)}</span>
        </button>
      ))}
    </div>
  );
};

interface FrozenAnchor {
  contextElement: Element;
  getBoundingClientRect: () => DOMRect;
}

const freezeAnchor = (trigger: HTMLElement): FrozenAnchor | null => {
  const column = trigger.closest(".ProseMirror");
  if (!column) return null;

  const triggerRect = trigger.getBoundingClientRect();
  const columnRect = column.getBoundingClientRect();
  const offsetX = triggerRect.left - columnRect.left;
  const offsetY = triggerRect.top - columnRect.top;

  return {
    contextElement: column,
    getBoundingClientRect: () => {
      const current = column.getBoundingClientRect();

      return new DOMRect(
        current.left + offsetX,
        current.top + offsetY,
        triggerRect.width,
        triggerRect.height,
      );
    },
  };
};

export const EditorImageSettings = ({
  alt,
  deleteNode,
  editor,
  getPos,
  onOpenChange,
  open,
  updateAttributes,
  width,
  wrap,
}: Pick<ReactNodeViewProps, "deleteNode" | "getPos" | "updateAttributes"> & {
  alt: string;
  editor: Editor;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  width: null | number;
  wrap: EditorImageWrap;
}) => {
  const t = useTranslations("core.global.editor.image");
  const runtime = useEditorUploadRuntime();
  const altId = React.useId();
  const altHintId = React.useId();
  const widthId = React.useId();
  const wrapId = React.useId();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [anchor, setAnchor] = React.useState<FrozenAnchor | null>(null);
  const shownWidth = width ?? 100;

  return (
    <Popover
      onOpenChange={next => {
        if (next && triggerRef.current) {
          setAnchor(freezeAnchor(triggerRef.current));
        }
        onOpenChange(next);
      }}
      open={open}
    >
      <PopoverTrigger
        render={
          <Button
            aria-label={t("settings")}
            className="absolute end-2 top-2 opacity-0 shadow-sm group-hover/image:opacity-100 group-data-selected/image:opacity-100 focus-visible:opacity-100"
            ref={triggerRef}
            size="icon-sm"
            variant="secondary"
          />
        }
      >
        <Settings2Icon />
      </PopoverTrigger>

      <PopoverContent
        align="end"
        anchor={anchor ?? undefined}
        className="w-80 gap-4"
      >
        <PopoverHeader>
          <PopoverTitle>{t("settings")}</PopoverTitle>
        </PopoverHeader>

        <div className="flex flex-col gap-2">
          <Label id={wrapId}>{t("wrap.label")}</Label>
          <WrapSwitcher
            labelledBy={wrapId}
            onChange={picked => {
              updateAttributes({
                width:
                  picked !== "none" && width === null
                    ? WRAPPED_DEFAULT_WIDTH
                    : width,
                wrap: picked,
              });
            }}
            value={wrap}
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <Label id={widthId}>{t("width.label")}</Label>
            <span className="text-muted-foreground text-sm tabular-nums">
              {t("width.value", { value: shownWidth })}
            </span>
          </div>
          <Slider
            aria-labelledby={widthId}
            max={100}
            min={EDITOR_IMAGE_MIN_WIDTH}
            onValueChange={next => {
              const value = Array.isArray(next) ? next[0] : next;
              if (typeof value !== "number") return;

              updateAttributes({ width: value >= 100 ? null : value });
            }}
            step={5}
            value={[shownWidth]}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={altId}>{t("alt.label")}</Label>
          <Textarea
            aria-describedby={altHintId}
            id={altId}
            maxLength={EDITOR_IMAGE_MAX_ALT_LENGTH}
            onChange={event => {
              updateAttributes({ alt: event.target.value });
            }}
            rows={3}
            value={alt}
          />
          <p
            className="text-muted-foreground text-xs leading-relaxed"
            id={altHintId}
          >
            {t("alt.desc")}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          {runtime ? (
            <>
              <Button
                onClick={() => fileInputRef.current?.click()}
                size="sm"
                variant="outline"
              >
                <ImageUpIcon />
                {t("replace")}
              </Button>
              <input
                accept={EDITOR_IMAGE_MIME_TYPES.join(",")}
                aria-label={t("replace")}
                className="sr-only"
                onChange={event => {
                  const file = event.target.files?.[0];
                  const pos = getPos();
                  event.target.value = "";
                  if (!file || pos === undefined) return;

                  onOpenChange(false);
                  replaceEditorImageFile(editor, runtime, { file, pos });
                }}
                ref={fileInputRef}
                tabIndex={-1}
                type="file"
              />
            </>
          ) : (
            <span />
          )}
          <Button
            onClick={() => {
              onOpenChange(false);
              deleteNode();
            }}
            size="sm"
            variant="ghost"
          >
            <Trash2Icon />
            {t("remove")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
