import { useMutation } from "@tanstack/react-query";
import { BookOpenIcon, ImageOffIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormFileValue } from "@/components/form/fields/file";

import { AutoForm, AutoFormSubmitButton } from "@/components/form/auto-form";
import { AutoFormFile } from "@/components/form/fields/file";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormSelect } from "@/components/form/fields/select";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { DOCS_URLS } from "@/lib/docs-links";
import {
  OG_IMAGE_DESCRIPTION_MAX_LENGTH,
  OG_IMAGE_TITLE_MAX_LENGTH,
} from "@/og-image";

import type {
  AdminOgImagePreviewInput,
  AdminOgImagesOptions,
} from "./og-images-query";

const COVER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

const code = (chunks: React.ReactNode) => (
  <code className="bg-muted rounded px-1 font-mono">{chunks}</code>
);

/**
 * Keeps covers picked in the form in the browser. The file field normally
 * uploads; here "uploading" only hands back a local id and an object URL, so
 * a preview never stores a file.
 */
const useLocalCovers = () => {
  const filesRef = React.useRef(new Map<number, File>());
  const urlsRef = React.useRef<string[]>([]);

  React.useEffect(
    () => () => {
      for (const url of urlsRef.current) URL.revokeObjectURL(url);
    },
    [],
  );

  return {
    keep: async (picked: File): Promise<AutoFormFileValue> => {
      // A copy of the bytes, so a file changed on disk after picking cannot
      // make the preview and the thumbnail disagree.
      const file = new File([await picked.arrayBuffer()], picked.name, {
        type: picked.type,
      });
      const id = filesRef.current.size + 1;
      const url = URL.createObjectURL(file);
      filesRef.current.set(id, file);
      urlsRef.current.push(url);

      return {
        id,
        mimeType: file.type,
        name: file.name,
        size: file.size,
        url,
      };
    },
    read: (id: null | number | undefined): File | null =>
      id ? (filesRef.current.get(id) ?? null) : null,
  };
};

/** The rendered PNG as an object URL, revoked once it is replaced. */
const usePreviewUrl = () => {
  const [url, setUrl] = React.useState<null | string>(null);

  React.useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  return [url, (blob: Blob) => setUrl(URL.createObjectURL(blob))] as const;
};

const PreviewImage = ({
  alt,
  error,
  height,
  isPending,
  url,
  width,
}: {
  alt: string;
  error: null | string;
  height: number;
  isPending: boolean;
  url: null | string;
  width: number;
}) => {
  const t = useTranslations("admin.seo.og_images.preview");

  return (
    <div aria-busy={isPending} className="flex flex-col gap-3">
      <span aria-live="polite" className="sr-only" role="status">
        {isPending ? t("loading") : ""}
      </span>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{t("error")}</AlertTitle>
          <AlertDescription className="text-pretty">{error}</AlertDescription>
        </Alert>
      ) : null}
      {url ? (
        <img
          alt={alt}
          className="border-border aspect-1200/630 w-full rounded-lg border object-cover transition-opacity duration-150 data-[pending=true]:opacity-60 motion-reduce:transition-none"
          data-pending={isPending}
          height={height}
          src={url}
          width={width}
        />
      ) : (
        <Skeleton className="aspect-1200/630 w-full rounded-lg" />
      )}
      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {t("size", { height, width })}
      </p>
    </div>
  );
};

/**
 * AdminCP → SEO → OG Images: renders temporary previews of every registered
 * template with the same generator public pages use. Nothing here is saved.
 */
export const OgImagesContent = ({
  data,
  onRender,
}: {
  data: AdminOgImagesOptions;
  onRender: (input: AdminOgImagePreviewInput) => Promise<Blob>;
}) => {
  const t = useTranslations("admin.seo.og_images");
  const covers = useLocalCovers();
  const [previewUrl, setPreview] = usePreviewUrl();
  const [lastTitle, setLastTitle] = React.useState("");

  const render = useMutation({
    mutationFn: onRender,
    onSuccess: (blob, input) => {
      setPreview(blob);
      setLastTitle(input.title);
    },
  });

  const [defaultTemplate] = data.templates;
  const formSchema = React.useMemo(
    () =>
      z.object({
        template: z
          .enum(data.templates.map(template => template.id) as [string])
          .default(defaultTemplate?.id ?? ""),
        locale: z
          .enum(data.locales.map(locale => locale.code) as [string])
          .default(data.defaultLocale),
        title: z
          .string()
          .trim()
          .min(1)
          .max(OG_IMAGE_TITLE_MAX_LENGTH)
          .default(t("sample.title")),
        description: z
          .string()
          .max(OG_IMAGE_DESCRIPTION_MAX_LENGTH)
          .default(t("sample.description")),
        cover: z.number().int().positive().nullable().default(null),
      }),
    [data, defaultTemplate, t],
  );

  const { mutate } = render;
  React.useEffect(() => {
    if (!defaultTemplate) return;

    mutate({
      cover: null,
      description: t("sample.description"),
      locale: data.defaultLocale,
      template: defaultTemplate.id,
      title: t("sample.title"),
    });
  }, [data.defaultLocale, defaultTemplate, mutate, t]);

  if (!data.enabled || !defaultTemplate) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ImageOffIcon />
          </EmptyMedia>
          <EmptyTitle>{t("disabled.title")}</EmptyTitle>
          <EmptyDescription>
            {t.rich("disabled.desc", { code })}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const errorMessage =
    render.error === null
      ? null
      : render.error instanceof Error
        ? render.error.message
        : t("preview.error");

  return (
    <div className="flex flex-col gap-6">
      <Alert variant="info">
        <AlertDescription className="flex flex-col items-start gap-3 leading-relaxed text-pretty">
          <span>{t.rich("config_note", { code })}</span>
          <a
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href={DOCS_URLS.ogImages}
            rel="noreferrer"
            target="_blank"
          >
            <BookOpenIcon aria-hidden />
            {t("docs_link")}
          </a>
        </AlertDescription>
      </Alert>

      <div className="grid items-start gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardContent>
            <AutoForm
              fields={[
                {
                  id: "template",
                  component: props => (
                    <AutoFormSelect
                      {...props}
                      label={t("form.template")}
                      labels={data.templates.map(template => {
                        const label = template.label ?? template.id;

                        return {
                          label: template.isDefault
                            ? t("form.template_default", { label })
                            : label,
                          value: template.id,
                        };
                      })}
                    />
                  ),
                },
                {
                  id: "locale",
                  hidden: () => data.locales.length < 2,
                  component: props => (
                    <AutoFormSelect
                      {...props}
                      label={t("form.locale")}
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
                    <AutoFormInput {...props} label={t("form.title")} />
                  ),
                },
                {
                  id: "description",
                  component: props => (
                    <AutoFormTextarea
                      {...props}
                      label={t("form.description")}
                    />
                  ),
                },
                {
                  id: "cover",
                  component: props => (
                    <AutoFormFile
                      {...props}
                      allowedMimeTypes={COVER_TYPES}
                      description={t("form.cover_desc")}
                      label={t("form.cover")}
                      maxBytes={data.coverMaxBytes}
                      onUpload={covers.keep}
                    />
                  ),
                },
              ]}
              formSchema={formSchema}
              layout={fields => (
                <div className="flex flex-col gap-4">
                  {Object.values(fields)}
                  <AutoFormSubmitButton className="self-start">
                    {t("form.refresh")}
                  </AutoFormSubmitButton>
                </div>
              )}
              onSubmit={async values => {
                await render
                  .mutateAsync({
                    cover: covers.read(values.cover),
                    description: values.description,
                    locale: values.locale,
                    template: values.template,
                    title: values.title,
                  })
                  .catch(() => undefined);
              }}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{t("preview.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <PreviewImage
              alt={t("preview.alt", { title: lastTitle })}
              error={errorMessage}
              height={data.height}
              isPending={render.isPending}
              url={previewUrl}
              width={data.width}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
