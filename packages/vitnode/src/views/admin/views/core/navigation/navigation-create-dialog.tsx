import { cn } from "cn";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  LinkIcon,
  PlusIcon,
} from "lucide-react";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

import type { NavigationKind, NavigationPreset } from "@/lib/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  useDialog,
} from "@/components/ui/dialog";
import { EmojiIcon } from "@/components/ui/emoji-icon";
import { Loader } from "@/components/ui/loader";
import { parseEmojiIcon } from "@/lib/emoji-icon";
import { navigationItemLabels, navigationPresetKey } from "@/lib/navigation";

import type { AdminNavigationFormProps } from "./navigation-form-content";
import type { AdminNavigationItem } from "./navigation-query";

import { presetLabelSource, useNavigationTranslate } from "./navigation-labels";

const AdminNavigationFormContent = React.lazy(async () =>
  import("./navigation-form-content").then(module => ({
    default: module.AdminNavigationFormContent,
  })),
);

export const usedNavigationPresetKeys = (
  items: readonly AdminNavigationItem[],
  except?: number,
): string[] =>
  items.flatMap(item =>
    item.kind === "preset" &&
    item.pluginId &&
    item.presetId &&
    item.id !== except
      ? [navigationPresetKey(item.pluginId, item.presetId)]
      : [],
  );

interface NavigationCreateChoice {
  kind: NavigationKind;
  preset?: NavigationPreset;
}

export interface NavigationCreateDialogProps {
  items: AdminNavigationItem[];
  onOpenChange: (open: boolean) => void;
  onSave: AdminNavigationFormProps["onSave"];
  onSaved?: () => void;
  open: boolean;
  parentId: null | number;
  presets: NavigationPreset[];
  session: number;
}

const tileClassName =
  "hover:bg-muted/60 focus-visible:ring-ring/50 flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border p-3 text-start outline-none transition duration-150 ease-out focus-visible:ring-3 active:scale-96 motion-reduce:transition-none";

const NavigationCreateChoiceStep = ({
  items,
  onChoose,
  parentName,
  presets,
  returned,
}: {
  items: AdminNavigationItem[];
  onChoose: (choice: NavigationCreateChoice) => void;
  parentName: null | string;
  presets: NavigationPreset[];
  returned: boolean;
}) => {
  const t = useTranslations("admin.navigation");
  const locale = useLocale();
  const translate = useNavigationTranslate();
  const used = usedNavigationPresetKeys(items);
  const available = presets.filter(
    preset => !used.includes(navigationPresetKey(preset.pluginId, preset.id)),
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-5",
        returned &&
          "animate-in fade-in-0 slide-in-from-left-2 duration-200 motion-reduce:animate-none",
      )}
    >
      <DialogHeader>
        <DialogTitle className="text-balance">
          {parentName
            ? t("create.childTitle", { name: parentName })
            : t("create.title")}
        </DialogTitle>
        <DialogDescription>{t("create.desc")}</DialogDescription>
      </DialogHeader>

      <section
        aria-labelledby="navigation-create-presets"
        className="flex flex-col gap-2"
      >
        <h3
          className="text-muted-foreground text-xs font-medium"
          id="navigation-create-presets"
        >
          {t("create.presets")}
        </h3>

        {available.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {available.map(preset => (
              <button
                className={tileClassName}
                key={navigationPresetKey(preset.pluginId, preset.id)}
                onClick={() => {
                  onChoose({ kind: "preset", preset });
                }}
                type="button"
              >
                <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md">
                  <EmojiIcon
                    className="size-4"
                    value={parseEmojiIcon(preset.icon)}
                  />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">
                    {navigationItemLabels({
                      item: presetLabelSource(preset),
                      locale,
                      translate,
                    }).title || preset.id}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {preset.pluginId}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm leading-relaxed">
            {t("form.presetEmpty")}
          </p>
        )}
      </section>

      <button
        className={cn(tileClassName, "items-center")}
        onClick={() => {
          onChoose({ kind: "custom" });
        }}
        type="button"
      >
        <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md">
          <LinkIcon className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium">{t("form.kind.custom")}</span>
          <span className="text-muted-foreground text-xs">
            {t("form.kind.customDesc")}
          </span>
        </span>
        <ChevronRightIcon
          aria-hidden
          className="text-muted-foreground size-4 shrink-0"
        />
      </button>
    </div>
  );
};

const NavigationCreateDetailsStep = ({
  choice,
  items,
  onBack,
  onSave,
  onSaved,
  parentId,
  parentName,
  presets,
}: {
  choice: NavigationCreateChoice;
  items: AdminNavigationItem[];
  onBack: () => void;
  onSave: AdminNavigationFormProps["onSave"];
  onSaved?: () => void;
  parentId: null | number;
  parentName: null | string;
  presets: NavigationPreset[];
}) => {
  const t = useTranslations("admin.navigation");
  const locale = useLocale();
  const translate = useNavigationTranslate();
  const { setIsDirty } = useDialog();
  const { preset } = choice;

  const title = preset
    ? navigationItemLabels({
        item: presetLabelSource(preset),
        locale,
        translate,
      }).title || preset.id
    : t("form.kind.custom");
  const placement = parentName
    ? t("create.inDropdown", { name: parentName })
    : t("create.inHeader");

  return (
    <div className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-5 duration-200 motion-reduce:animate-none">
      <DialogHeader>
        <Button
          className="text-muted-foreground -ms-2 w-fit"
          onClick={() => {
            setIsDirty?.(false);
            onBack();
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          <ArrowLeftIcon />
          {t("create.back")}
        </Button>
        <DialogTitle className="text-balance">{title}</DialogTitle>
        <DialogDescription className="text-pretty">
          {preset
            ? t("create.fromPlugin", { placement, plugin: preset.pluginId })
            : placement}
        </DialogDescription>
      </DialogHeader>

      <React.Suspense fallback={<Loader />}>
        <AdminNavigationFormContent
          items={items}
          kind={choice.kind}
          onSave={onSave}
          onSaved={onSaved}
          parentId={parentId}
          preset={preset}
          presets={presets}
          surface="dialog"
        />
      </React.Suspense>
    </div>
  );
};

const NavigationCreateSteps = ({
  items,
  onSave,
  onSaved,
  parentId,
  presets,
}: Omit<NavigationCreateDialogProps, "onOpenChange" | "open" | "session">) => {
  const [choice, setChoice] = React.useState<NavigationCreateChoice | null>(
    null,
  );
  const [returned, setReturned] = React.useState(false);
  const locale = useLocale();
  const translate = useNavigationTranslate();
  const parent =
    parentId === null ? undefined : items.find(item => item.id === parentId);
  const parentName = parent
    ? navigationItemLabels({ item: parent, locale, translate }).title
    : null;

  return choice ? (
    <NavigationCreateDetailsStep
      choice={choice}
      items={items}
      onBack={() => {
        setReturned(true);
        setChoice(null);
      }}
      onSave={onSave}
      onSaved={onSaved}
      parentId={parentId}
      parentName={parentName}
      presets={presets}
    />
  ) : (
    <NavigationCreateChoiceStep
      items={items}
      onChoose={setChoice}
      parentName={parentName}
      presets={presets}
      returned={returned}
    />
  );
};

export const NavigationCreateDialog = ({
  onOpenChange,
  open,
  session,
  ...props
}: NavigationCreateDialogProps) => (
  <Dialog onOpenChange={onOpenChange} open={open}>
    <DialogContent className="sm:max-w-lg">
      <NavigationCreateSteps key={session} {...props} />
    </DialogContent>
  </Dialog>
);

export const CreateNavigationAction = ({
  items,
  onSave,
  onSaved,
  presets,
}: Omit<
  NavigationCreateDialogProps,
  "onOpenChange" | "open" | "parentId" | "session"
>) => {
  const t = useTranslations("admin.navigation.create");
  const [session, setSession] = React.useState(0);
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        onClick={() => {
          setSession(current => current + 1);
          setOpen(true);
        }}
      >
        <PlusIcon />
        {t("title")}
      </Button>

      <NavigationCreateDialog
        items={items}
        onOpenChange={setOpen}
        onSave={onSave}
        onSaved={onSaved}
        open={open}
        parentId={null}
        presets={presets}
        session={session}
      />
    </>
  );
};
