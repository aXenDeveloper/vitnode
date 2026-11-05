import React from "react";

import type { ContentLivePreviewPayload } from "@/content/live-preview";

import {
  CONTENT_LIVE_PREVIEW_MESSAGE,
  parseContentLivePreviewValues,
} from "@/content/live-preview";

const editorWindows = (): Window[] => {
  const windows: Window[] = [];
  if (window.parent !== window) windows.push(window.parent);
  const opener: unknown = window.opener;
  if (opener !== null && typeof opener === "object") {
    windows.push(opener as Window);
  }

  return windows;
};

/**
 * The unsaved values an AdminCP editor is typing, for the page behind a
 * Content Engine preview link. Lay them over the record the page loaded.
 *
 * Browser-only: `null` during SSR, on a page that is neither framed by nor
 * opened from an editor, and until the first message arrives. The editor's
 * `ContentLivePreview` sends a message on every change, and again when this
 * page reloads. Messages are accepted only from the framing or opening window,
 * and only when it shares this page's origin.
 *
 * @example
 * import type { MultiLangValue } from "@vitnode/core/lib/helpers/multi-lang";
 *
 * import { getLangValue } from "@vitnode/core/lib/helpers/multi-lang";
 * import { useContentLivePreview } from "@vitnode/core/tanstack/content";
 *
 * const StoryTitle = ({ saved }: { saved: string }) => {
 *   const live = useContentLivePreview();
 *   const title = live?.values.title as MultiLangValue | undefined;
 *
 *   return <h1>{getLangValue(title, live?.locale ?? "en") || saved}</h1>;
 * };
 */
export const useContentLivePreview = (): ContentLivePreviewPayload | null => {
  const [payload, setPayload] =
    React.useState<ContentLivePreviewPayload | null>(null);

  React.useEffect(() => {
    const sources = editorWindows();
    if (sources.length === 0) return;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!sources.some(source => source === event.source)) return;

      const next = parseContentLivePreviewValues(event.data);
      if (next) setPayload(next);
    };

    window.addEventListener("message", onMessage);
    for (const source of sources) {
      source.postMessage(
        { type: CONTENT_LIVE_PREVIEW_MESSAGE.ready },
        window.location.origin,
      );
    }

    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  return payload;
};
