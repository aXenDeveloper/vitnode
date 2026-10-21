import { useMutation, useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { ImageIcon, InfoIcon, XIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { AutoForm, AutoFormSubmitButton } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormSelect } from "@/components/form/fields/select";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/components/ui/attachment";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes } from "@/lib/format-bytes";

import type {
  AdminOgImagePreviewInput,
  AdminOgImageTemplates,
} from "./og-images-query";

import {
  ogImageTemplatesQueryKey,
  renderOgImagePreview,
} from "./og-images-query";

const COVER_MAX_BYTES = 5 * 1024 * 1024;
const COVER_ACCEPT = "image/avif,image/jpeg,image/png,image/webp";

/** An object URL for `blob`, revoked once the blob is replaced or the component unmounts. */
const useObjectUrl = (blob: Blob | File | null): null | string => {
  const url = React.useMemo(
    () => (blob ? URL.createObjectURL(blob) : null),
    [blob],
  );
  React.useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  return url;
};

const COVER_TYPES = new Set(COVER_ACCEPT.split(","));

/**
 * Picks a local cover image for the preview. Kept outside the form schema: a
 * `File` has no JSON Schema, and the file never leaves this tab except inside
 * the preview request.
 */
const CoverPicker = ({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
}) => {
  const t = useTranslations("admin.seo.og_images.form.cover");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState(false);
  const preview = useObjectUrl(file);
  const id = React.useId();

  return (
    <Field data-invalid={error || undefined}>
      <FieldLabel htmlFor={id}>
        {t("label")}{" "}
        <span className="text-muted-foreground font-normal">
          {t("optional")}
        </span>
      </FieldLabel>
      <input
        accept={COVER_ACCEPT}
        aria-describedby={`${id}-desc`}
        className="hidden"
        id={id}
        onChange={event => {
          const picked = event.target.files?.[0] ?? null;
          event.target.value = "";
          const valid =
            picked !== null &&
            picked.size <= COVER_MAX_BYTES &&
            COVER_TYPES.has(picked.type);
          setError(picked !== null && !valid);
          if (valid) onChange(picked);
        }}
        ref={inputRef}
        type="file"
      />
      <Attachment className="w-full" state={file ? "done" : "idle"}>
        <AttachmentMedia variant={preview ? "image" : "icon"}>
          {preview ? (
            <img alt="" height={40} src={preview} width={40} />
          ) : (
            <ImageIcon />
          )}
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{file?.name ?? t("empty")}</AttachmentTitle>
          <AttachmentDescription>
            {file ? formatBytes(file.size) : t("hint")}
          </AttachmentDescription>
        </AttachmentContent>
        {file ? (
          <AttachmentActions>
            <AttachmentAction
              aria-label={t("remove")}
              onClick={() => onChange(null)}
              type="button"
            >
              <XIcon />
            </AttachmentAction>
          </AttachmentActions>
        ) : (
          <AttachmentTrigger
            aria-label={t("choose")}
            onClick={() => inputRef.current?.click()}
          />
        )}
      </Attachment>
      <FieldDescription id={`${id}-desc`}>{t("desc")}</FieldDescription>
      {error ? <FieldError>{t("invalid")}</FieldError> : null}
    </Field>
  );
};

const PreviewPane = ({
  error,
  isPending,
  src,
}: {
  error: boolean;
  isPending: boolean;
  src: null | string;
}) => {
  const t = useTranslations("admin.seo.og_images.preview");

  return (
    <section
      aria-busy={isPending}
      aria-labelledby="og-image-preview-heading"
      className="flex flex-col gap-3"
    >
      <h2
        className="text-muted-foreground text-sm font-medium"
        id="og-image-preview-heading"
      >
        {t("title")}
      </h2>
      <span className="sr-only" role="status">
        {isPending ? t("loading") : ""}
      </span>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{t("error.title")}</AlertTitle>
          <AlertDescription>{t("error.desc")}</AlertDescription>
        </Alert>
      ) : null}
      {src ? (
        <img
          alt={t("alt")}
          className={cn(
            "bg-muted aspect-1200/630 w-full rounded-lg border object-cover transition-opacity motion-reduce:transition-none",
            isPending && "opacity-60",
          )}
          height={630}
          src={src}
          width={1200}
        />
      ) : (
        <Skeleton className="aspect-1200/630 w-full rounded-lg" />
      )}
      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {t("size")}
      </p>
    </section>
  );
};

/**
 * AdminCP → SEO → OG Images: pick a registered template, type temporary text,
 * optionally choose a cover, and see the image the API's generator draws.
 * Nothing is saved; templates and branding live in `vitnode.api.config.ts`.
 */
export const OgImagesContent = ({ data }: { data: AdminOgImageTemplates }) => {
  const t = useTranslations("admin.seo.og_images");

  const templateIds = data.templates.map(template => template.id);
  const localeCodes = data.locales.map(locale => locale.code);
  const [firstTemplate = "default", ...otherTemplates] = templateIds;
  const [firstLocale = "en", ...otherLocales] = localeCodes;
  const defaults: AdminOgImagePreviewInput = {
    cover: null,
    description: t("form.description.sample"),
    locale: firstLocale,
    template: data.defaultTemplate ?? firstTemplate,
    title: t("form.title.sample"),
  };

  const formSchema = z.object({
    template: z
      .enum([firstTemplate, ...otherTemplates])
      .default(defaults.template),
    locale: z.enum([firstLocale, ...otherLocales]).default(defaults.locale),
    title: z.string().trim().min(1).max(200).default(defaults.title),
    description: z.string().max(400).default(defaults.description),
  });
  const [cover, setCover] = React.useState<File | null>(null);

  // The first image, drawn from the form's defaults so the page never opens
  // empty. Not kept once the page is left: a preview is not data.
  const initial = useQuery({
    enabled: data.enabled,
    gcTime: 0,
    queryFn: async () => await renderOgImagePreview(defaults),
    queryKey: [...ogImageTemplatesQueryKey, "initial-preview", defaults],
    retry: false,
    staleTime: Infinity,
  });
  const preview = useMutation({
    mutationFn: async (input: AdminOgImagePreviewInput) =>
      await renderOgImagePreview(input),
  });

  const src = useObjectUrl(preview.data ?? initial.data ?? null);
  const isPending = preview.isPending || (data.enabled && initial.isPending);
  const isError = preview.isError || (!preview.data && initial.isError);

  if (!data.enabled) {
    return (
      <Alert variant="warning">
        <AlertTitle>{t("disabled.title")}</AlertTitle>
        <AlertDescription>{t("disabled.desc")}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Alert icon={<InfoIcon />} variant="info">
        <AlertTitle>{t("info.title")}</AlertTitle>
        <AlertDescription>{t("info.desc")}</AlertDescription>
      </Alert>

      <div className="grid gap-8 lg:grid-cols-5">
        <AutoForm
          className="flex flex-col gap-6 lg:col-span-2"
          fields={[
            {
              id: "template",
              component: props => (
                <AutoFormSelect
                  {...props}
                  description={t("form.template.desc")}
                  label={t("form.template.label")}
                  labels={data.templates.map(template => ({
                    label: template.isDefault
                      ? t("form.template.default", { id: template.id })
                      : template.id,
                    value: template.id,
                  }))}
                />
              ),
            },
            {
              id: "locale",
              hidden: () => data.locales.length < 2,
              component: props => (
                <AutoFormSelect
                  {...props}
                  description={t("form.locale.desc")}
                  label={t("form.locale.label")}
                  labels={data.locales.map(locale => ({
                    label: locale.name,
                    value: locale.code,
                  }))}
                />
              ),
            },
            {
              id: "title",
              component: props => (
                <AutoFormInput {...props} label={t("form.title.label")} />
              ),
            },
            {
              id: "description",
              component: props => (
                <AutoFormTextarea
                  {...props}
                  label={t("form.description.label")}
                />
              ),
            },
          ]}
          formSchema={formSchema}
          layout={rendered => (
            <>
              {rendered.template}
              {rendered.locale}
              {rendered.title}
              {rendered.description}
              <CoverPicker file={cover} onChange={setCover} />
              <AutoFormSubmitButton className="self-start">
                {t("form.submit")}
              </AutoFormSubmitButton>
            </>
          )}
          onSubmit={async values => {
            await preview
              .mutateAsync({ ...values, cover })
              .catch(() => undefined);
          }}
        />

        <div className="lg:col-span-3">
          <PreviewPane error={isError} isPending={isPending} src={src} />
        </div>
      </div>
    </div>
  );
};
