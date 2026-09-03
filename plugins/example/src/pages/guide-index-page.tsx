import { useTranslations } from "use-intl";

/**
 * What `/example/guide` renders inside the layout beside it.
 *
 * The `page.tsx` next to a `layout.tsx`, said as a tree: `index()` inside the
 * layout's `children`. It renders no heading of its own - the frame owns that - and no `<main>`, because the application shell owns the document's
 * one `main` landmark and a plugin page that rendered a second would give a
 * screen reader two to choose between.
 *
 * It declares no `route` export at all, which is the point of it sitting next to
 * `guide-layout.tsx`: the whole of this page's behaviour - its robots directive,
 * its breadcrumb, its message namespaces - is inherited. A module whose default
 * export is a component is a complete module.
 *
 * The strings come from `@vitnode/example.guide`, which the *layout* declares in
 * `routes.ts`. Message namespaces are inherited by every descendant, so a page
 * renders in strings it never had to ask for - and the host warms them alongside this
 * module's chunk rather than in a round trip after it.
 */
const GuideIndexPage = () => {
  const t = useTranslations("@vitnode/example.guide");

  return (
    <div className="flex flex-col gap-4">
      <p className="leading-relaxed text-pretty">{t("index.intro")}</p>

      <ul className="text-muted-foreground flex list-disc flex-col gap-2 pl-5 leading-relaxed">
        <li>{t("index.points.nested")}</li>
        <li>{t("index.points.messages")}</li>
        <li>{t("index.points.breadcrumb")}</li>
      </ul>
    </div>
  );
};

export default GuideIndexPage;
