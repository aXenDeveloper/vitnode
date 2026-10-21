import {
  type Editor,
  EditorContent,
  type Extensions,
  useEditor,
} from "@tiptap/react";
import { cn } from "cn";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { RichTextDocument } from "@/content/rich-text/document";

import { useEditorConfig } from "@/components/editor-provider";
import {
  EDITOR_ATTACHMENT_MAX_BYTES,
  EDITOR_IMAGE_MAX_BYTES,
  isEditorImageMimeType,
} from "@/lib/editor-uploads";
import { formatBytes } from "@/lib/format-bytes";

import { TipTapDragHandle } from "./drag-handle";
import { EditorSkeleton } from "./editor-skeleton";
import { createTipTapExtensions } from "./extension";
import { editorEmojiItems, toRichTextDocument } from "./rich-text-json";
import { TipTapToolbar } from "./toolbar/tiptap-toolbar";
import { ReusableUploadsBar } from "./uploads/reusable-uploads-bar";
import {
  type EditorReusableUpload,
  EditorReusableUploadsContext,
} from "./uploads/reuse";
import {
  type EditorUploadRuntime,
  EditorUploadRuntimeContext,
} from "./uploads/runtime";
import { uploadEditorFile } from "./uploads/upload";

/**
 * Options for an editor that accepts uploads. `session: "member"` (the
 * default) posts to `/users/files/editor` as the signed-in user and accepts
 * images only. `session: "admin"` posts to `/admin/files/editor` with the
 * AdminCP session, needs the staff permission `files:can_upload`, and can
 * also accept `files`.
 */
export type EditorUploadsOptions =
  | {
      /**
       * Also accepts PDF, Word, PowerPoint and ZIP files as downloadable
       * attachment cards. Defaults to `false`.
       */
      files?: boolean;
      session: "admin";
    }
  | { session?: "member" };

export type TipTapEditorBaseProps = Omit<
  React.ComponentProps<"div">,
  "defaultValue" | "onChange"
> & {
  disableScroll?: boolean;
  extensions?: Extensions;
  onEditor?: (editor: Editor | null) => void;
  placeholder?: string;
  /**
   * Images and files from other language versions of the same field, offered
   * under **+ Insert → From other languages** so they can be reused without
   * uploading them again. `AutoFormEditor` with `multiLang` fills it in.
   */
  reusableUploads?: EditorReusableUpload[];
  undoRedo?: boolean;
  /**
   * Lets people drop, paste or insert images (and, with `files`, attachments).
   * Off by default: an editor without it keeps the images and attachments a
   * document already has but accepts no new ones. Uploads are stored in
   * `core_files`; `editor.images.remote` in the app config also allows
   * `https://` image addresses.
   */
  uploads?: boolean | EditorUploadsOptions;
};

export type TipTapEditorHtmlProps = TipTapEditorBaseProps & {
  format?: "html";
  onChange?: (value: string) => void;
  value?: string;
};

export type TipTapEditorJsonProps = TipTapEditorBaseProps & {
  format: "json";
  onChange?: (value: RichTextDocument) => void;
  value?: null | RichTextDocument;
};

export type TipTapEditorProps = TipTapEditorHtmlProps | TipTapEditorJsonProps;

const textboxAttributesOf = ({
  describedBy,
  invalid,
  labelledBy,
}: {
  describedBy?: string;
  invalid?: React.AriaAttributes["aria-invalid"];
  labelledBy?: string;
}): Record<string, string> => ({
  ...(labelledBy ? { "aria-labelledby": labelledBy } : {}),
  ...(describedBy ? { "aria-describedby": describedBy } : {}),
  ...(invalid === true || invalid === "true" ? { "aria-invalid": "true" } : {}),
});

// Serializing the whole document on every transaction is the expensive part of
// typing in a long post, so the value is handed up at most this often. Blur,
// the form's submit, Escape and unmount flush it, so nothing typed is lost.
const ON_CHANGE_DELAY_MS = 200;

const NO_REUSABLE_UPLOADS: EditorReusableUpload[] = [];

const EDITOR_CLASS =
  "max-w-full min-h-40 py-4 ps-5 pe-4 text-base focus:outline-none md:text-sm";

export const TipTapEditor = (props: TipTapEditorProps) => {
  const {
    "aria-describedby": describedBy,
    "aria-labelledby": labelledBy,
    className,
    disableScroll,
    extensions,
    format: _format,
    placeholder,
    undoRedo,
    reusableUploads,
    uploads,
    value: _value,
    onChange: _onChange,
    onBlur,
    onEditor,
    onKeyDownCapture,
    ...rest
  } = props;
  const t = useTranslations("core.global.editor");
  const { emojis, images } = useEditorConfig();
  const emojiItems = React.useMemo(() => editorEmojiItems(emojis), [emojis]);
  const placeholderText = placeholder ?? t("placeholder");
  const invalid = rest["aria-invalid"];

  const uploadOptions: EditorUploadsOptions =
    typeof uploads === "object" ? uploads : {};
  const uploadSession = uploads ? (uploadOptions.session ?? "member") : null;
  const allowsAttachments =
    uploadOptions.session === "admin" && uploadOptions.files === true;
  const allowsRemoteImages = images?.remote === true;
  const uploadRuntime = React.useMemo<EditorUploadRuntime | null>(
    () =>
      uploadSession === null
        ? null
        : {
            attachments: allowsAttachments,
            onReject: (rejection, file, detail) => {
              toast.error(t("uploads.errors.title"), {
                description: [
                  t(`uploads.errors.${rejection}`, {
                    name: file.name,
                    size: formatBytes(
                      isEditorImageMimeType(file.type)
                        ? EDITOR_IMAGE_MAX_BYTES
                        : EDITOR_ATTACHMENT_MAX_BYTES,
                      0,
                    ),
                  }),
                  detail,
                ]
                  .filter(Boolean)
                  .join(" "),
              });
            },
            remote: allowsRemoteImages,
            upload: async file => await uploadEditorFile(uploadSession, file),
          },
    [allowsAttachments, allowsRemoteImages, t, uploadSession],
  );

  // Stable options keep `useEditor` from calling `setOptions` on every render.
  const allExtensions = React.useMemo(
    () => [
      ...createTipTapExtensions({
        customEmojis: emojis,
        getUploadRuntime: () => uploadRuntime,
        placeholder: placeholderText,
        undoRedo,
      }),
      ...(extensions ?? []),
    ],
    [emojis, extensions, placeholderText, undoRedo, uploadRuntime],
  );
  const editorProps = React.useMemo(
    () => ({
      attributes: {
        class: EDITOR_CLASS,
        role: "textbox",
        "aria-multiline": "true",
        ...textboxAttributesOf({ describedBy, invalid, labelledBy }),
      },
    }),
    [describedBy, invalid, labelledBy],
  );
  // The editor only reads its content when it is created; later values are
  // its own output echoed back, so they must not count as an option change.
  const [initialContent] = React.useState(() =>
    props.format === "json" ? (props.value ?? null) : (props.value ?? ""),
  );

  const pendingChangeRef = React.useRef<(() => void) | null>(null);
  const changeTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const flushChange = React.useCallback(() => {
    clearTimeout(changeTimerRef.current);
    const pending = pendingChangeRef.current;
    pendingChangeRef.current = null;
    pending?.();
  }, []);

  const editor = useEditor({
    extensions: allExtensions,
    editorProps,
    content: initialContent,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      // Captures this render's `onChange`, so a flush on unmount still writes
      // to the field (or language) the text was typed into.
      pendingChangeRef.current =
        props.format === "json"
          ? () => {
              props.onChange?.(
                toRichTextDocument(currentEditor.getJSON(), emojiItems),
              );
            }
          : () => {
              props.onChange?.(currentEditor.getHTML());
            };
      clearTimeout(changeTimerRef.current);
      changeTimerRef.current = setTimeout(flushChange, ON_CHANGE_DELAY_MS);
    },
  });

  React.useEffect(() => flushChange, [flushChange]);

  React.useEffect(() => {
    if (!editor) return;
    const form = editor.view.dom.closest("form");
    if (!form) return;

    // Capture on the form itself runs before React's delegated `onSubmit`,
    // so a Mod+Enter submit straight from the editor sends the latest text.
    form.addEventListener("submit", flushChange, true);

    return () => {
      form.removeEventListener("submit", flushChange, true);
    };
  }, [editor, flushChange]);

  const announceEditor = React.useEffectEvent((next: Editor | null) => {
    onEditor?.(next);
  });
  React.useEffect(() => {
    if (!editor) return;
    announceEditor(editor);

    return () => {
      announceEditor(null);
    };
  }, [editor]);

  if (!editor) return <EditorSkeleton className={className} />;

  return (
    <div
      className={cn(
        "bg-card focus-within:border-ring focus-within:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 ease-fluid relative w-full rounded-md border shadow-xs transition-[border-color,box-shadow] duration-150 focus-within:ring-3 aria-invalid:ring-3 motion-reduce:transition-none",
        { "max-h-80 overflow-hidden overflow-y-auto": !disableScroll },
        className,
      )}
      onBlur={event => {
        flushChange();
        onBlur?.(event);
      }}
      onKeyDownCapture={event => {
        // A dialog closes on Escape: hand the text up first so its
        // unsaved-changes guard sees it.
        if (event.key === "Escape") flushChange();
        onKeyDownCapture?.(event);
      }}
      {...rest}
    >
      <EditorUploadRuntimeContext value={uploadRuntime}>
        <EditorReusableUploadsContext
          value={reusableUploads ?? NO_REUSABLE_UPLOADS}
        >
          <TipTapToolbar editor={editor} />
          <ReusableUploadsBar editor={editor} />
          <TipTapDragHandle editor={editor} />
          <EditorContent
            className="w-full min-w-full cursor-text"
            editor={editor}
          />
        </EditorReusableUploadsContext>
      </EditorUploadRuntimeContext>
    </div>
  );
};
