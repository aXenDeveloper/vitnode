import type { ReactElement, ReactNode } from "react";

import { useCallback, useMemo, useState } from "react";

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
import { EditablePageContext } from "./page-context";
import { adoptedZones, layoutKey, layoutZones } from "./page-layout";

export interface EditablePageProps {
  adapter?: VisualEditorAdapter;
  canEdit?: boolean;
  children: ReactNode;
  editing?: boolean;
  layout?: EditablePageLayoutPayload | null;
  onExit?: () => void;
  page: AnyEditablePageDefinition;
}

export const EditablePage = ({
  adapter,
  canEdit,
  children,
  editing,
  layout,
  onExit,
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

  if (layout && layout.pageId !== page.id) {
    throw new ContentEngineError(
      `This layout belongs to the page ${JSON.stringify(layout.pageId)}, which is not ${JSON.stringify(page.id)}. Rendering one page's blocks under another page's zones would save them onto the wrong page, so it is refused.`,
      { contentTypeId: page.id },
    );
  }

  return (
    <EditablePageContext value={value}>
      {canEdit === true ? (
        <ContentEditorRuntime
          adapter={saving}
          enabled={editing === true}
          onExit={onExit}
        >
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
