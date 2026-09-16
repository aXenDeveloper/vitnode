import type z from "zod";

import { CopyIcon, Trash2Icon } from "lucide-react";
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

export const BlockPropertiesPanelContent = (): ReactElement => {
  const { dispatch, setPanel, state } = useVisualEditor();
  const t = useTranslations("core.editor");
  const tGlobal = useTranslations("core.global");

  const found =
    state.selectedBlockId === null
      ? null
      : findBlock(state, state.selectedBlockId);

  if (found === null) {
    return (
      <section aria-label={t("properties")} className="p-4">
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t("no_selection")}
        </p>
      </section>
    );
  }

  const registry =
    state.zones[found.zoneId].registry ?? getDefaultBlockRegistry();
  const entry = registry?.get(found.instance.type);
  const issue = blockInstanceIssue(registry, found.instance);
  const name = entry ? blockDisplayName(entry) : t("block.unknown.title");

  return (
    <section aria-label={t("properties")} className="flex flex-col gap-4 p-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-sm leading-none font-semibold text-balance">
          {name}
        </h2>
        <p className="text-muted-foreground truncate text-xs">
          {found.instance.type}
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
        <BlockPropertiesForm
          entry={entry}
          instance={found.instance}
          key={found.instance.id}
        />
      ) : null}

      <div className="border-border flex gap-2 border-t pt-4">
        <Button
          aria-label={t("block.duplicate", { name })}
          className="flex-1"
          onClick={() => {
            dispatch({ blockId: found.instance.id, type: "duplicate" });
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
            dispatch({ blockId: found.instance.id, type: "remove" });
            setPanel("blocks");
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
