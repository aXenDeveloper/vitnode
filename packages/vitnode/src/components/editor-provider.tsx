import React from "react";

export interface EditorCustomEmoji {
  /** Shortcode used to insert it, so `vitnode` is typed as `:vitnode:`. */
  name: string;
  /** Image rendered wherever the emoji appears. */
  src: string;
  /** Words the picker and the `:` menu also match on. */
  tags?: string[];
}

export interface EditorEmojiSection {
  emojis: EditorCustomEmoji[];
  /** Heading the section gets in the picker. */
  label: string;
}

/** Where editor images may come from. */
export interface EditorImagesConfig {
  /**
   * Lets people insert an image by its `https://` address instead of
   * uploading it. Off by default, so every image is uploaded to the
   * install's storage and recorded in `core_files`. Only `https` addresses
   * are accepted. It only matters for editors that allow uploads.
   */
  remote?: boolean;
}

/** Editor settings, from the `editor` option of the app's `buildConfig`. */
export interface VitNodeEditorConfig {
  /** Custom emoji sections in the picker. Empty sections are dropped. */
  emojis?: EditorEmojiSection[];
  /** Where images inserted into an editor may come from. */
  images?: EditorImagesConfig;
}

const EditorConfigContext = React.createContext<VitNodeEditorConfig>({});

/** Provides the app's {@link VitNodeEditorConfig} to every editor below it. */
export const EditorConfigProvider = ({
  children,
  config = {},
}: {
  children: React.ReactNode;
  config?: VitNodeEditorConfig;
}) => {
  const value = React.useMemo(
    () => ({
      emojis: config.emojis?.filter(section => section.emojis.length),
      images: config.images,
    }),
    [config.emojis, config.images],
  );

  return <EditorConfigContext value={value}>{children}</EditorConfigContext>;
};

/** The editor config from the nearest {@link EditorConfigProvider}; `{}` without one. */
export const useEditorConfig = (): VitNodeEditorConfig =>
  React.use(EditorConfigContext);
