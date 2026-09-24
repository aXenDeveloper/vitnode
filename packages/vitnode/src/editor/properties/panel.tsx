import type z from "zod";

import { CopyIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { Fragment, type ReactElement, useEffect, useState } from "react";
import { useTranslations } from "use-intl";

import type {
  AnyBlockDefinition,
  AnyBlockInstance,
  BlockUnknownData,
  RegisteredBlock,
} from "../../blocks/types";
import type { EditorNodeRef } from "../state/types";

import { getDefaultBlockRegistry } from "../../blocks/registry";
import { AutoForm } from "../../components/form/auto-form";
import { Button } from "../../components/ui/button";
import { useFormApi } from "../../components/ui/form";
import { TooltipWithContent } from "../../components/ui/tooltip";
import { buildFormSchemaFromSpec } from "../../content/admin/spec";
import { BlockGlyph } from "../block-picker/block-glyph";
import { useVisualEditor } from "../context";
import { blockInstanceIssue } from "../instance/defaults";
import {
  EditorPanelBack,
  EditorPanelHeader,
  EditorPanelSeparator,
} from "../sidebar/panel-header";
import {
  refusesDuplicate,
  refusesRemoval,
  zoneCapacity,
} from "../state/bounds";
import { containerNodes, sameValue } from "../state/reducer";
import { isRepairRemoval } from "../state/repair";
import { AreaPropertiesPanelContent } from "./area-panel";
import { BlockPropertyField } from "./field";
import { selectedNode } from "./selection";
import {
  blockDataFromFormValues,
  blockDisplayName,
  blockFieldPatchEntries,
  blockFieldSpecs,
  blockFormSpec,
  clearsBlockField,
} from "./spec";
import { BlockVariantControl } from "./variant";

const BlockDataSync = ({
  definition,
  formSchema,
  onSent,
  target,
}: {
  definition: AnyBlockDefinition;
  formSchema: z.ZodObject<z.ZodRawShape>;
  onSent: (patch: BlockUnknownData, removed: readonly string[]) => void;
  target: EditorNodeRef;
}) => {
  const { dispatch } = useVisualEditor();
  const { form } = useFormApi();

  useEffect(() => {
    let edited: Record<string, unknown> = { ...form.store.state.values };

    const subscription = form.store.subscribe(() => {
      const values: Record<string, unknown> = { ...form.store.state.values };
      const changed = Object.keys(values).filter(
        name => !sameValue(values[name], edited[name]),
      );

      edited = values;
      if (changed.length === 0) return;

      const removed = changed.filter(name =>
        clearsBlockField(definition, name, values[name]),
      );
      const patch = blockDataFromFormValues(
        {},
        Object.fromEntries(
          changed
            .filter(name => !removed.includes(name))
            .flatMap(name =>
              blockFieldPatchEntries(
                definition,
                formSchema,
                name,
                values[name],
              ),
            ),
        ),
      );

      if (Object.keys(patch).length === 0 && removed.length === 0) return;

      onSent(patch, removed);
      dispatch({ data: patch, ref: target, remove: removed, type: "update" });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [definition, dispatch, form, formSchema, onSent, target]);

  return null;
};

const BlockPropertiesForm = ({
  entry,
  instance,
  onSent,
  target,
}: {
  entry: RegisteredBlock;
  instance: AnyBlockInstance;
  onSent: (patch: BlockUnknownData, removed: readonly string[]) => void;
  target: EditorNodeRef;
}) => {
  const [base] = useState<BlockUnknownData>(() => instance.data);
  const [specs] = useState(() => blockFieldSpecs(entry.definition));
  const [formSchema] = useState(() =>
    buildFormSchemaFromSpec(blockFormSpec(entry), base),
  );

  return (
    <AutoForm
      fields={specs.map(spec => ({
        id: spec.name,
        component: props => (
          <BlockPropertyField
            descriptor={entry.definition.fields[spec.name]}
            spec={spec}
            {...props}
          />
        ),
      }))}
      formSchema={formSchema}
      layout={rendered => (
        <div className="flex flex-col gap-6">
          {specs.map(spec => (
            <Fragment key={spec.name}>{rendered[spec.name]}</Fragment>
          ))}
        </div>
      )}
      mode="onChange"
    >
      <BlockDataSync
        definition={entry.definition}
        formSchema={formSchema}
        onSent={onSent}
        target={target}
      />
    </AutoForm>
  );
};

const BlockPropertiesPanelContent = ({
  instance,
  target,
}: {
  instance: AnyBlockInstance;
  target: EditorNodeRef;
}): ReactElement => {
  const { dispatch, setPanel, state } = useVisualEditor();
  const t = useTranslations("core.editor");
  const tGlobal = useTranslations("core.global");

  const [sent, setSent] = useState<BlockUnknownData>(instance.data);
  const [baseline, setBaseline] = useState(0);

  if (!sameValue(sent, instance.data)) {
    setSent(instance.data);
    setBaseline(generation => generation + 1);
  }

  const zone = state.zones[target.zoneId];
  const capacity = zoneCapacity(zone);
  const siblings =
    containerNodes(state, {
      areaId: target.areaId,
      zoneId: target.zoneId,
    })?.length ?? 0;
  const duplicateRefused = refusesDuplicate(
    capacity,
    1,
    target.areaId === null ? null : siblings,
  );
  const removeRefused = refusesRemoval(
    capacity,
    1,
    zone !== undefined && isRepairRemoval(zone, instance),
  );

  const registry = zone.registry ?? getDefaultBlockRegistry();
  const entry = registry?.get(instance.type);
  const issue = blockInstanceIssue(registry, instance);
  const name = entry ? blockDisplayName(entry) : t("block.unknown.title");

  return (
    <section aria-label={t("properties")} className="flex flex-col">
      <EditorPanelHeader
        actions={
          <>
            <TooltipWithContent text={t("duplicate")}>
              <Button
                aria-label={t("block.duplicate", { name })}
                disabled={duplicateRefused}
                onClick={() => {
                  dispatch({ ref: target, type: "duplicate" });
                }}
                size="icon-sm"
                variant="ghost"
              >
                <CopyIcon />
              </Button>
            </TooltipWithContent>

            <EditorPanelSeparator />

            <TooltipWithContent text={tGlobal("remove")}>
              <Button
                aria-label={t("block.remove", { name })}
                className="hover:bg-destructive/10 hover:text-destructive -me-2"
                disabled={removeRefused}
                onClick={() => {
                  dispatch({ ref: target, type: "remove" });
                  setPanel();
                }}
                size="icon-sm"
                variant="ghost"
              >
                <Trash2Icon />
              </Button>
            </TooltipWithContent>
          </>
        }
        description={<span className="font-mono">{instance.type}</span>}
        icon={<BlockGlyph icon={entry?.definition.icon} />}
        leading={<EditorPanelBack />}
        title={name}
      />

      <div className="flex flex-col gap-6 p-4">
        {issue === null ? null : (
          <div
            className="border-destructive/30 bg-destructive/10 text-destructive flex gap-2 rounded-lg border p-3"
            role="status"
          >
            <TriangleAlertIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm leading-relaxed text-pretty">
                {entry ? t("invalid_block") : t("block.issue.unknown_type")}
              </p>
              <p className="text-sm leading-relaxed opacity-80">{issue}</p>
            </div>
          </div>
        )}

        {entry ? (
          <BlockVariantControl
            definition={entry.definition}
            target={target}
            variant={instance.variant}
          />
        ) : null}

        {entry ? (
          <BlockPropertiesForm
            entry={entry}
            instance={instance}
            key={`${target.zoneId}/${target.nodeId}/${baseline}`}
            onSent={(patch, removed) => {
              setSent(current => {
                const next: BlockUnknownData = { ...current, ...patch };
                for (const name of removed) delete next[name];

                return next;
              });
            }}
            target={target}
          />
        ) : null}
      </div>
    </section>
  );
};

export const EditorPropertiesPanel = (): ReactElement => {
  const { state } = useVisualEditor();
  const t = useTranslations("core.editor");

  const selected = state.selected;
  const view = selectedNode(state, selected);

  if (selected === null || view === null) {
    return (
      <section aria-label={t("properties")} className="p-6">
        <p className="text-muted-foreground text-center text-sm leading-relaxed text-balance">
          {t("no_selection")}
        </p>
      </section>
    );
  }

  return view.kind === "area" ? (
    <AreaPropertiesPanelContent area={view.area} target={selected} />
  ) : (
    <BlockPropertiesPanelContent instance={view.instance} target={selected} />
  );
};
