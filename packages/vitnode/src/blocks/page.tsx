import type { ReactElement, ReactNode } from "react";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AnyEditablePageDefinition,
  EditablePageLayoutPayload,
  EditablePageZone,
} from "../content/editor/types";
import type {
  VisualEditorAdapter,
  VisualEditorSaveInput,
} from "../editor/adapter/types";
import type {
  EditablePageContextValue,
  EditablePageZoneResolution,
} from "./page-context";
import type { EditablePageZones } from "./page-layout";

import { editablePageZone } from "../content/editor/define";
import { ContentEngineError } from "../content/errors";
import { ContentEditorRuntime } from "./edit";
import { useEditWidgets } from "./edit-widgets-context";
import { EditablePageContext } from "./page-context";
import { adoptedZones, layoutKey, layoutZones } from "./page-layout";

export interface EditablePageProps {
  adapter?: VisualEditorAdapter;
  canEdit?: boolean;
  children: ReactNode;
  layout?: EditablePageLayoutPayload | null;
  onExit?: () => void;
  openEditing?: boolean;
  page: AnyEditablePageDefinition;
}

export const EditablePage = ({
  adapter,
  canEdit,
  children,
  layout,
  onExit,
  openEditing,
  page,
}: EditablePageProps): ReactElement => {
  const [zones, setZones] = useState<EditablePageZones>(() =>
    layoutZones(layout),
  );
  const [seed, setSeed] = useState(() => layoutKey(layout));
  const key = layoutKey(layout);

  if (seed !== key) {
    setSeed(key);
    setZones(layoutZones(layout));
  }

  const adopt = useCallback(
    (
      input: VisualEditorSaveInput,
      canonical: EditablePageZones | undefined,
    ) => {
      const adopted = adoptedZones(input, canonical);

      if (Object.keys(adopted).length === 0) return;

      setZones(current => ({ ...current, ...adopted }));
    },
    [],
  );

  const saving = useMemo<undefined | VisualEditorAdapter>(
    () =>
      adapter && {
        save: async input => {
          const result = await adapter.save(input);

          adopt(input, result?.zones);

          return result;
        },
      },
    [adapter, adopt],
  );

  const value = useMemo<EditablePageContextValue>(() => {
    const resolution = (
      zone: EditablePageZone,
      zoneId: string,
    ): EditablePageZoneResolution => ({
      allowedBlocks: zone.allowed,
      blocks: Object.hasOwn(zones, zoneId) ? zones[zoneId] : zone.default,
      max: zone.max,
      min: zone.min,
    });

    return {
      lookupZone: zoneId =>
        Object.hasOwn(page.zones, zoneId)
          ? resolution(page.zones[zoneId], zoneId)
          : undefined,
      pageId: page.id,
      resolveZone: zoneId => resolution(editablePageZone(page, zoneId), zoneId),
    };
  }, [page, zones]);

  const control = useEditWidgets();
  const { publish, release, start, stop } = control ?? {};
  const offer = useMemo(
    () => ({ canEdit: canEdit === true, pageId: page.id }),
    [canEdit, page.id],
  );

  useEffect(() => {
    if (!publish || !release) return;

    publish(offer);

    return () => {
      release(offer.pageId);
    };
  }, [offer, publish, release]);

  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    if (!start || !offer.canEdit || openEditing !== true) return;

    opened.current = true;
    start(offer.pageId);
  }, [offer.canEdit, offer.pageId, openEditing, start]);

  const editing =
    control?.editing === true && control.offer?.pageId === page.id;

  const exit = useCallback(() => {
    stop?.();
    onExit?.();
  }, [onExit, stop]);

  if (layout && layout.pageId !== page.id) {
    throw new ContentEngineError(
      `This layout belongs to the page ${JSON.stringify(layout.pageId)}, which is not ${JSON.stringify(page.id)}. Rendering one page's blocks under another page's zones would save them onto the wrong page, so it is refused.`,
      { contentTypeId: page.id },
    );
  }

  return (
    <EditablePageContext value={value}>
      {canEdit === true ? (
        <ContentEditorRuntime adapter={saving} enabled={editing} onExit={exit}>
          {children}
        </ContentEditorRuntime>
      ) : (
        children
      )}
    </EditablePageContext>
  );
};

export type {
  EditablePageContextValue,
  EditablePageZoneResolution,
} from "./page-context";
export type { EditablePageZones } from "./page-layout";
