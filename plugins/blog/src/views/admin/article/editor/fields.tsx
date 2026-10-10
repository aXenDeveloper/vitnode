import type { ItemAutoFormComponentProps } from "@vitnode/core/components/form/auto-form";

import { AutoFormLabel } from "@vitnode/core/components/form/common/label";
import {
  type MultiLangFieldProps,
  useMultiLangField,
} from "@vitnode/core/components/form/fields/multi-lang";
import { FormControl, FormMessage } from "@vitnode/core/components/ui/form";
import { useContentForm } from "@vitnode/core/content/admin-form";
import { cn } from "cn";
import { useTranslations } from "use-intl";

import { useArticleFieldAction } from "./field-actions";
import { RECOMMENDED_LENGTH } from "./readiness";

const fieldClassName =
  "bg-background border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 w-full min-w-0 rounded-md border px-2.5 text-base outline-none transition-[border-color,box-shadow] duration-150 ease-out focus-visible:ring-3 motion-reduce:transition-none md:text-sm";

export const CharacterCount = ({
  field,
  value,
}: {
  field: keyof typeof RECOMMENDED_LENGTH;
  value: string;
}) => {
  const t = useTranslations("@vitnode/blog.admin.article.editor.counter");
  const max = RECOMMENDED_LENGTH[field];
  const over = value.length > max;

  return (
    <span
      className={cn(
        "text-xs whitespace-nowrap tabular-nums",
        over ? "text-warn" : "text-muted-foreground",
      )}
      title={t(field, { max })}
    >
      {value.length} / {max}
      <span className="sr-only">. {t(field, { max })}</span>
    </span>
  );
};

export const ArticleTitleField = ({ field }: ItemAutoFormComponentProps) => {
  const t = useTranslations("@vitnode/blog");
  const { currentValue, selected, setValue } = useMultiLangField(
    field as MultiLangFieldProps["field"],
  );

  return (
    <>
      <AutoFormLabel className="sr-only">
        {t("content.post.fields.title")}
      </AutoFormLabel>
      <FormControl>
        <textarea
          className="placeholder:text-muted-foreground/60 aria-invalid:text-destructive field-sizing-content w-full resize-none bg-transparent text-3xl leading-tight font-bold tracking-tight text-balance transition-opacity duration-200 ease-out outline-none disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none sm:text-4xl"
          lang={selected}
          name={field.name}
          onBlur={field.onBlur}
          onChange={event => {
            setValue(event.target.value.replace(/\n/g, " "));
          }}
          placeholder={t("admin.article.editor.title.placeholder")}
          rows={1}
          value={currentValue}
        />
      </FormControl>
      <div className="flex items-center justify-end gap-2">
        <CharacterCount field="title" value={currentValue} />
      </div>
      <FormMessage />
    </>
  );
};

export const ArticleSlugField = ({ field }: ItemAutoFormComponentProps) => {
  const t = useTranslations("@vitnode/blog.content.post.fields");
  const { currentValue, setValue } = useMultiLangField(
    field as MultiLangFieldProps["field"],
  );

  return (
    <>
      <AutoFormLabel className="sr-only">{t("friendlyUrl")}</AutoFormLabel>
      <div className="text-muted-foreground flex min-w-0 items-center gap-1 text-sm">
        <span aria-hidden className="shrink-0">
          /blog/
        </span>
        <FormControl>
          <input
            className="hover:bg-muted focus-visible:bg-muted focus-visible:ring-ring/50 text-foreground min-w-0 flex-1 truncate rounded-sm bg-transparent px-1 py-0.5 text-base outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
            name={field.name}
            onBlur={field.onBlur}
            onChange={event => {
              setValue(event.target.value);
            }}
            spellCheck={false}
            value={currentValue}
          />
        </FormControl>
      </div>
      <FormMessage />
    </>
  );
};

export const ArticleExcerptField = ({ field }: ItemAutoFormComponentProps) => {
  const t = useTranslations("@vitnode/blog");
  const labelRight = useArticleFieldAction("excerpt");
  const { currentValue, selected, setValue } = useMultiLangField(
    field as MultiLangFieldProps["field"],
  );

  return (
    <>
      <AutoFormLabel isOptional labelRight={labelRight}>
        {t("content.post.fields.excerpt")}
      </AutoFormLabel>
      <FormControl>
        <textarea
          className={cn(
            fieldClassName,
            "field-sizing-content min-h-20 resize-none py-2 leading-relaxed",
          )}
          lang={selected}
          maxLength={300}
          name={field.name}
          onBlur={field.onBlur}
          onChange={event => {
            setValue(event.target.value);
          }}
          placeholder={t("admin.article.editor.excerpt.placeholder")}
          rows={3}
          value={currentValue}
        />
      </FormControl>
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
          {t("admin.article.editor.excerpt.hint")}
        </p>
        <CharacterCount field="excerpt" value={currentValue} />
      </div>
      <FormMessage />
    </>
  );
};

export const ArticleCoverAltField = ({ field }: ItemAutoFormComponentProps) => {
  const t = useTranslations("@vitnode/blog");
  const labelRight = useArticleFieldAction("coverImageAlt");
  const { currentValue, selected, setValue } = useMultiLangField(
    field as MultiLangFieldProps["field"],
  );
  const { files } = useContentForm();
  const cover = files?.coverImage;
  const fileAlt =
    cover && !Array.isArray(cover) ? cover.alts?.[selected] : undefined;

  return (
    <>
      <AutoFormLabel isOptional labelRight={labelRight}>
        {t("content.post.fields.coverImageAlt")}
      </AutoFormLabel>
      <FormControl>
        <input
          className={cn(fieldClassName, "h-9")}
          lang={selected}
          maxLength={255}
          name={field.name}
          onBlur={field.onBlur}
          onChange={event => {
            setValue(event.target.value);
          }}
          placeholder={
            fileAlt?.trim()
              ? fileAlt
              : t("admin.article.editor.alt.placeholder")
          }
          value={currentValue}
        />
      </FormControl>
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
          {t("admin.article.editor.alt.hint")}
          {fileAlt ? ` ${t("admin.article.editor.alt.file_default")}` : null}
        </p>
        <CharacterCount field="coverImageAlt" value={currentValue} />
      </div>
      <FormMessage />
    </>
  );
};
