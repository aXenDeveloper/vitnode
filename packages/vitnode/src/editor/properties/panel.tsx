import type z from "zod";

import { XIcon } from "lucide-react";
import { Fragment, type ReactElement, useEffect, useState } from "react";
import { useTranslations } from "use-intl";

import type {
  AnyBlockInstance,
  BlockUnknownData,
  RegisteredBlock,
} from "../../blocks/types";

import { getDefaultBlockRegistry } from "../../blocks/registry";
import { AutoForm } from "../../components/form/auto-form";
import { Button } from "../../components/ui/button";
import { useFormApi } from "../../components/ui/form";
import { buildFormSchemaFromSpec } from "../../content/admin/spec";
import { useVisualEditor } from "../context";
import { blockInstanceIssue } from "../instance/defaults";
import { findBlock } from "../state/reducer";
import { BlockPropertyField } from "./field";
import {
  blockDataFromFormValues,
  blockDisplayName,
  blockFieldSpecs,
  blockFormSpec,
} from "./spec";

const BlockDataSync = ({
  base,
  blockId,
  formSchema,
}: {
  base: BlockUnknownData;
  blockId: string;
  formSchema: z.ZodObject<z.ZodRawShape>;
}) => {
  const { dispatch } = useVisualEditor();
  const { form } = useFormApi();

  useEffect(() => {
    let edited = JSON.stringify(form.store.state.values);

    const subscription = form.store.subscribe(() => {
      const values = JSON.stringify(form.store.state.values);
      if (values === edited) return;
      edited = values;

      const parsed = formSchema.safeParse(form.store.state.values);
      if (!parsed.success) return;

      dispatch({
        blockId,
        data: blockDataFromFormValues(base, parsed.data),
        type: "update",
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [base, blockId, dispatch, form, formSchema]);

  return null;
};

const BlockPropertiesForm = ({
  entry,
  instance,
}: {
  entry: RegisteredBlock;
  instance: AnyBlockInstance;
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
        base={base}
        blockId={instance.id}
        formSchema={formSchema}
      />
    </AutoForm>
  );
};

export const BlockPropertiesPanel = (): null | ReactElement => {
  const { dispatch, preview, state } = useVisualEditor();
  const t = useTranslations("core.editor");
  const tGlobal = useTranslations("core.global");

  const found =
    state.selectedBlockId === null
      ? null
      : findBlock(state, state.selectedBlockId);

  if (preview || !found) return null;

  const registry =
    state.zones[found.zoneId].registry ?? getDefaultBlockRegistry();
  const entry = registry?.get(found.instance.type);
  const issue = blockInstanceIssue(registry, found.instance);

  return (
    <aside
      aria-label={t("properties")}
      className="border-border bg-background fixed inset-x-0 bottom-0 z-40 flex max-h-96 flex-col border-t shadow-lg md:inset-y-0 md:left-auto md:max-h-none md:w-80 md:border-t-0 md:border-l"
    >
      <header className="border-border flex items-start justify-between gap-2 border-b p-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-sm leading-none font-semibold text-balance">
            {entry ? blockDisplayName(entry) : t("block.unknown.title")}
          </h2>
          <p className="text-muted-foreground truncate text-xs">
            {found.instance.type}
          </p>
        </div>

        <Button
          aria-label={tGlobal("close")}
          onClick={() => {
            dispatch({ blockId: null, type: "select" });
          }}
          size="icon-sm"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pb-20 md:pb-4">
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
          <BlockPropertiesForm
            entry={entry}
            instance={found.instance}
            key={found.instance.id}
          />
        ) : null}
      </div>
    </aside>
  );
};
