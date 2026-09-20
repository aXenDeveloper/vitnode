import type { ReactElement, ReactNode } from "react";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { VisualEditorAdapter } from "../editor/adapter/types";
import type {
  ContentEditRuntime,
  ContentZoneOutletEntry,
  ContentZoneRelease,
} from "./edit-context";

import { ContentEditContext, sameContentZoneMount } from "./edit-context";
import { EDITOR_SHELL_TRANSITION_MS } from "./editor-shell";
import { BlockError } from "./errors";

const EditorRoot = lazy(async () => await import("../editor/root"));

export interface ContentEditorRuntimeProps {
  adapter?: VisualEditorAdapter;
  children: ReactNode;
  enabled: boolean;
  onExit?: () => void;
}

const NO_OUTLETS: readonly ContentZoneOutletEntry[] = [];

const duplicateContentZone = (id: string): BlockError =>
  new BlockError(
    `Two \`<ContentZone id=${JSON.stringify(id)} />\` outlets are on the page at the same time. A zone id names one place on one page, and the editor stores, moves and saves blocks by it - with two of them it cannot tell which one a block belongs to, and saving would write one over the other. Give each zone its own id, or render only one of them.`,
  );

export const ContentEditorRuntime = ({
  adapter,
  children,
  enabled,
  onExit,
}: ContentEditorRuntimeProps): ReactElement => {
  const [outlets, setOutlets] =
    useState<readonly ContentZoneOutletEntry[]>(NO_OUTLETS);
  const registeredRef = useRef<readonly ContentZoneOutletEntry[]>(NO_OUTLETS);
  const [preview, setPreview] = useState(false);
  const [closing, setClosing] = useState(false);
  const [wasEnabled, setWasEnabled] = useState(enabled);

  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    setClosing(wasEnabled);
  }

  if (!enabled && !closing && preview) setPreview(false);

  useEffect(() => {
    if (!closing) return;

    const timer = setTimeout(() => {
      setClosing(false);
    }, EDITOR_SHELL_TRANSITION_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [closing]);

  const registerZone = useCallback((entry: ContentZoneOutletEntry) => {
    const current = registeredRef.current;
    const open = current.find(held => held.mount.id === entry.mount.id);

    if (open?.node === entry.node) {
      if (sameContentZoneMount(open.mount, entry.mount)) return;
    } else if (open && open.node.isConnected && entry.node.isConnected) {
      throw duplicateContentZone(entry.mount.id);
    }

    registeredRef.current = open
      ? current.map(held => (held === open ? entry : held))
      : [...current, entry];

    setOutlets(registeredRef.current);
  }, []);

  const releaseZone = useCallback(({ id, node }: ContentZoneRelease) => {
    const current = registeredRef.current;
    const open = current.find(
      held => held.mount.id === id && held.node === node,
    );

    if (!open) return;

    registeredRef.current = current.filter(held => held !== open);
    setOutlets(registeredRef.current);
  }, []);

  const runtime = useMemo<ContentEditRuntime | null>(
    () =>
      enabled || closing
        ? { preview: preview || closing, registerZone, releaseZone }
        : null,
    [closing, enabled, preview, registerZone, releaseZone],
  );

  return (
    <ContentEditContext value={runtime}>
      {children}

      {enabled || closing ? (
        <Suspense fallback={null}>
          <EditorRoot
            adapter={adapter}
            closing={closing}
            onExit={onExit}
            outlets={outlets}
            preview={preview}
            setPreview={setPreview}
          />
        </Suspense>
      ) : null}
    </ContentEditContext>
  );
};

export type {
  ContentEditRuntime,
  ContentZoneMount,
  ContentZoneOutletEntry,
  ContentZoneRelease,
} from "./edit-context";
