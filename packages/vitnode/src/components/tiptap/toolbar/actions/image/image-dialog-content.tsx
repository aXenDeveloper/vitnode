import { ImageUpIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";
import z from "zod";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
import { useDialog } from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsPanels,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  EDITOR_IMAGE_MAX_ALT_LENGTH,
  EDITOR_IMAGE_MAX_BYTES,
  EDITOR_IMAGE_MIME_TYPES,
  isRemoteEditorImageUrl,
} from "@/lib/editor-uploads";
import { formatBytes } from "@/lib/format-bytes";

import type { EditorUploadRuntime } from "../../../uploads/runtime";

import {
  insertEditorFiles,
  insertRemoteEditorImage,
} from "../../../uploads/flow";
import { useEditorUploadRuntime } from "../../../uploads/runtime";
import { useToolbarEditor } from "../../use-toolbar-editor";

const UploadPanel = ({ runtime }: { runtime: EditorUploadRuntime }) => {
  const t = useTranslations("core.global.editor.image");
  const { editor } = useToolbarEditor();
  const { setOpen } = useDialog();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const hintId = React.useId();
  const [isDragging, setIsDragging] = React.useState(false);

  const insert = (files: File[]) => {
    if (files.length === 0) return;

    setOpen?.(false);
    insertEditorFiles(editor, runtime, files);
  };

  return (
    <>
      <button
        aria-describedby={hintId}
        className="border-border hover:border-primary/50 hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-ring/50 data-dragging:border-primary data-dragging:bg-primary/5 flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center transition-[border-color,background-color] duration-150 outline-none focus-visible:ring-3 motion-reduce:transition-none"
        data-dragging={isDragging ? "" : undefined}
        onClick={() => inputRef.current?.click()}
        onDragLeave={() => {
          setIsDragging(false);
        }}
        onDragOver={event => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDrop={event => {
          event.preventDefault();
          setIsDragging(false);
          insert(Array.from(event.dataTransfer.files));
        }}
        type="button"
      >
        <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
          <ImageUpIcon className="size-5" />
        </span>
        <span className="text-foreground text-sm font-medium">
          {t("dropzone")}
        </span>
        <span
          className="text-muted-foreground text-xs leading-relaxed text-pretty"
          id={hintId}
        >
          {t("limits", { size: formatBytes(EDITOR_IMAGE_MAX_BYTES, 0) })}
        </span>
      </button>
      <input
        accept={EDITOR_IMAGE_MIME_TYPES.join(",")}
        aria-label={t("dropzone")}
        className="sr-only"
        multiple
        onChange={event => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          insert(files);
        }}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />
    </>
  );
};

const RemotePanel = () => {
  const t = useTranslations("core.global.editor.image");
  const { editor } = useToolbarEditor();
  const { setOpen } = useDialog();
  const formSchema = z.object({
    alt: z.string().max(EDITOR_IMAGE_MAX_ALT_LENGTH),
    src: z.url().refine(isRemoteEditorImageUrl, { message: t("url.https") }),
  });

  return (
    <AutoForm
      fields={[
        {
          id: "src",
          component: props => (
            <AutoFormInput
              description={t("url.desc")}
              label={t("url.label")}
              placeholder="https://example.com/photo.webp"
              type="url"
              {...props}
            />
          ),
        },
        {
          id: "alt",
          component: props => (
            <AutoFormTextarea
              description={t("alt.desc")}
              label={t("alt.label")}
              rows={2}
              {...props}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      mode="all"
      onSubmit={({ alt, src }) => {
        insertRemoteEditorImage(editor, { alt, src });
        setOpen?.(false);
      }}
      submitButtonProps={{ children: t("url.submit") }}
    />
  );
};

export const ImageDialogContent = () => {
  const t = useTranslations("core.global.editor.image");
  const runtime = useEditorUploadRuntime();
  if (!runtime) return null;

  if (!runtime.remote) return <UploadPanel runtime={runtime} />;

  return (
    <Tabs defaultValue="upload">
      <TabsList className="w-full">
        <TabsTrigger value="upload">{t("tabs.upload")}</TabsTrigger>
        <TabsTrigger value="url">{t("tabs.url")}</TabsTrigger>
      </TabsList>
      <TabsPanels>
        <TabsContent value="upload">
          <UploadPanel runtime={runtime} />
        </TabsContent>
        <TabsContent value="url">
          <RemotePanel />
        </TabsContent>
      </TabsPanels>
    </Tabs>
  );
};
