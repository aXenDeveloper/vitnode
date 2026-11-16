import type { RichTextDocument } from "@/content/rich-text/document";

export interface ModerationSnapshotFile {
  id: null | number | string;
  mimeType: null | string;
  name: null | string;
  size: null | number;
  url: null | string;
}

interface SnapshotFieldBase {
  label: null | string;
  name: string;
}

export type ModerationSnapshotField =
  | (SnapshotFieldBase & { kind: "file"; value: ModerationSnapshotFile[] })
  | (SnapshotFieldBase & { kind: "richText"; value: null | RichTextDocument })
  | (SnapshotFieldBase & { kind: "text"; value: null | string })
  | (SnapshotFieldBase & {
      kind: "value";
      value: boolean | null | number | string;
    });

export interface ModerationReportSnapshot {
  authors: { id: number; name: string }[];
  capturedAt: string;
  fields: ModerationSnapshotField[];
  locale: {
    fallback: boolean;
    requested: null | string;
    served: null | string;
  };
  scope: null | { family: string; id: string };
  source: {
    publishedAt: null | string;
    updatedAt: null | string;
    version: null | number;
  };
  target: { id: string; pluginId: string; type: string };
  title: null | string;
  truncated: boolean;
  url: null | string;
  version: number;
}
