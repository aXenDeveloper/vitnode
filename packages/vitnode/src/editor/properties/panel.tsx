import type z from "zod";

import { CopyIcon, Trash2Icon } from "lucide-react";
import { Fragment, type ReactElement, useEffect, useState } from "react";
import { useTranslations } from "use-intl";

import type {
  AnyBlockInstance,
  BlockUnknownData,
  RegisteredBlock,
} from "../../blocks/types";
import type { ContentFormFieldSpec } from "../../content/admin/spec";
import type { EditorNodeRef } from "../state/types";

import { getDefaultBlockRegistry } from "../../blocks/registry";
import { AutoForm } from "../../components/form/auto-form";
import { Button } from "../../components/ui/button";
import { useFormApi } from "../../components/ui/form";
import { buildFormSchemaFromSpec } from "../../content/admin/spec";
import { useVisualEditor } from "../context";
import { blockInstanceIssue } from "../instance/defaults";
import { sameValue } from "../state/reducer";
import { AreaPropertiesPanelContent } from "./area-panel";
import { BlockPropertyField } from "./field";
import { selectedNode } from "./selection";
import {
  blockDataFromFormValues,
  blockDisplayName,
  blockFieldSpecs,
  blockFormSpec,
  clearsBlockField,
} from "./spec";
import { BlockVariantControl } from "./variant";

const BlockDataSync = ({
  formSchema,
  onSent,
  specs,
  target,
}: {
  formSchema: z.ZodObject<z.ZodRawShape>;
  onSent: (patch: BlockUnknownData, removed: readonly string[]) => void;
  specs: readonly ContentFormFieldSpec[];
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
        clearsBlockField(specs, name, values[name]),
      );
      const patch = blockDataFromFormValues(
        {},
        Object.fromEntries(
          changed
            .filter(name => !removed.includes(name))
            .flatMap(name => {
              const field = formSchema.shape[name] as undefined | z.ZodType;
              const parsed = field?.safeParse(values[name]);

              return parsed?.success ? [[name, parsed.data] as const] : [];
            }),
        ),
      );

      if (Object.keys(patch).length === 0 && removed.length === 0) return;

      onSent(patch, removed);
      dispatch({ data: patch, ref: target, remove: removed, type: "update" });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [dispatch, form, formSchema, onSent, specs, target]);

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
        component: props => <BlockPropertyField spec={spec} {...props} />,
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
        formSchema={formSchema}
        onSent={onSent}
        specs={specs}
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

  const registry =
    state.zones[target.zoneId].registry ?? getDefaultBlockRegistry();
  const entry = registry?.get(instance.type);
  const issue = blockInstanceIssue(registry, instance);
  const name = entry ? blockDisplayName(entry) : t("block.unknown.title");

  return (
    <section aria-label={t("properties")} className="flex flex-col gap-4 p-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-sm leading-none font-semibold text-balance">
          {name}
        </h2>
        <p className="text-muted-foreground truncate text-xs">
          {instance.type}
        </p>
      </div>

      {issue === null ? null : (
        <div
          className="border-destructive/40 bg-destructive/10 text-destructive flex flex-col gap-1 rounded-md border p-3"
          role="status"
        >
          <p className="text-sm leading-relaxed text-pretty">
            {entry ? t("invalid_block") : t("block.issue.unknown_type")}
          </p>
          <p className="text-xs leading-relaxed opacity-80">{issue}</p>
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

      <div className="border-border flex gap-2 border-t pt-4">
        <Button
          aria-label={t("block.duplicate", { name })}
          className="flex-1"
          onClick={() => {
            dispatch({ ref: target, type: "duplicate" });
          }}
          size="sm"
          variant="secondary"
        >
          <CopyIcon />
          {t("duplicate")}
        </Button>

        <Button
          aria-label={t("block.remove", { name })}
          className="flex-1"
          onClick={() => {
            dispatch({ ref: target, type: "remove" });
            setPanel();
          }}
          size="sm"
          variant="destructive"
        >
          <Trash2Icon />
          {tGlobal("remove")}
        </Button>
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
      <section aria-label={t("properties")} className="p-4">
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
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
