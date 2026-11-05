import type {
  ModerationReportSnapshot,
  ModerationSnapshotField,
} from "@/lib/moderation/snapshot";

import { safeNotificationTarget } from "@/api/lib/notifications/safe";
import { richTextToPlainText } from "@/content/rich-text/plain-text";
import {
  MODERATION_LIMITS,
  MODERATION_SNAPSHOT_VERSION,
} from "@/lib/moderation/const";

import type { ModerationCaptureResult } from "./targets";

export const safeReportTargetUrl = (value: unknown): null | string => {
  const path = safeNotificationTarget(value);
  if (path !== null) return path;
  if (typeof value !== "string") return null;

  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
};

const byteLength = (value: unknown): number =>
  Buffer.byteLength(JSON.stringify(value), "utf8");

const clip = (value: string, max: number): [string, boolean] =>
  value.length > max ? [value.slice(0, max), true] : [value, false];

export const sealReportSnapshot = ({
  capture,
  capturedAt = new Date(),
  target,
}: {
  capture: ModerationCaptureResult;
  capturedAt?: Date;
  target: ModerationReportSnapshot["target"];
}): ModerationReportSnapshot => {
  let truncated = false;
  const maxText = MODERATION_LIMITS.snapshotTextMaxLength;

  const fields: ModerationSnapshotField[] = capture.fields.map(field => {
    if (field.kind === "text" && field.value !== null) {
      const [value, cut] = clip(field.value, maxText);
      truncated ||= cut;

      return { ...field, value };
    }

    return field;
  });

  const [title, titleCut] =
    capture.title === null ? [null, false] : clip(capture.title, 500);
  truncated ||= titleCut;

  const snapshot: ModerationReportSnapshot = {
    ...capture,
    capturedAt: capturedAt.toISOString(),
    fields,
    target,
    title,
    truncated,
    url: safeReportTargetUrl(capture.url),
    version: MODERATION_SNAPSHOT_VERSION,
  };

  if (byteLength(snapshot) <= MODERATION_LIMITS.snapshotMaxBytes) {
    return snapshot;
  }

  snapshot.truncated = true;
  snapshot.fields = snapshot.fields.map(field => {
    if (field.kind !== "richText" || field.value === null) return field;
    const [value] = clip(richTextToPlainText(field.value), maxText);

    return { kind: "text", label: field.label, name: field.name, value };
  });

  while (
    snapshot.fields.length > 0 &&
    byteLength(snapshot) > MODERATION_LIMITS.snapshotMaxBytes
  ) {
    snapshot.fields = snapshot.fields.slice(0, -1);
  }

  return snapshot;
};
