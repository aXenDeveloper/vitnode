import type {
  EditablePageLayoutPayload,
  EditablePageSavePayload,
} from "@vitnode/core/content/editor";

import { createBlockRegistry, zodContentNode } from "@vitnode/core/widgets";
import { blocks as coreBlocks } from "@vitnode/core/widgets/built-in";
import { EditablePage } from "@vitnode/core/widgets/page";
import { ContentZone } from "@vitnode/core/widgets/zone";
import {
  AutoForm,
  AutoFormSubmitButton,
} from "@vitnode/core/components/form/auto-form";
import { AutoFormInput } from "@vitnode/core/components/form/fields/input";
import { Button } from "@vitnode/core/components/ui/button";
import {
  createContentEditorAdapter,
  EditablePageSaveRefused,
} from "@vitnode/core/content/editor";
import {
  definePluginRoute,
  type PluginRoutePageProps,
} from "@vitnode/core/routing";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { widgets as exampleWidgets } from "@/widgets";
import {
  EXAMPLE_ZONE_IDS,
  mayEditSettingsPage,
  settingsPage,
} from "@/content/settings-page";

import type { ZonesSearch } from "./zones-search";

const serverRefusal = async (response: Response): Promise<string> => {
  const fallback = `Saving these widgets answered ${response.status}. Nothing was stored, and the editor keeps your changes.`;

  try {
    const body: unknown = await response.json();
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? body.message
        : undefined;

    return typeof message === "string" && message.length > 0
      ? message
      : fallback;
  } catch {
    return fallback;
  }
};

const blocksRegistry = createBlockRegistry([coreBlocks, exampleWidgets]);

const zodLayout = z.object({
  pageId: z.string(),
  updatedAt: z.string().nullable(),
  zones: z.record(z.string(), z.array(zodContentNode)),
});

interface ZonesPageData {
  canEdit: boolean;
  layout: EditablePageLayoutPayload;
}

export const route = definePluginRoute<ZonesPageData, ZonesSearch>({
  load: async (): Promise<ZonesPageData> => {
    const [stored, staff] = await Promise.all([
      fetcher({
        plugin: "@vitnode/core",
        method: "get",
        module: "pages",
        path: "/layout",
        args: { query: { pageId: settingsPage.id } },
      }),
      fetcher({
        plugin: "@vitnode/core",
        method: "get",
        module: "users",
        path: "/permissions",
      }),
    ]);

    if (!stored.ok) {
      throw new Error(
        `Reading this page's layout answered ${stored.status}, so what is stored is unknown. Nothing is rendered in its place: a layout invented here is the layout the next Save would write over.`,
      );
    }

    return {
      canEdit: staff.ok ? mayEditSettingsPage(await staff.json()) : false,
      layout: zodLayout.parse(await stored.json()),
    };
  },

  head: () => ({ title: "Settings" }),
});

const profileSchema = z.object({
  displayName: z.string().min(1).max(60).default("Ada"),
});

const ProfileForm = () => {
  const [clicks, setClicks] = useState(0);

  return (
    <section
      aria-labelledby="profile-heading"
      className="border-border flex flex-col gap-4 rounded-lg border p-4 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-balance" id="profile-heading">
          Profile
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          Locked application UI. A zone can sit around it, never inside it. Type
          below, press the counter, then enter and leave edit mode: neither
          resets, because the editor never remounts the page.
        </p>
      </div>

      <Button
        className="self-start"
        onClick={() => {
          setClicks(count => count + 1);
        }}
        size="sm"
        variant="secondary"
      >
        Local state: {clicks}
      </Button>

      <AutoForm
        fields={[
          {
            component: props => (
              <AutoFormInput
                {...props}
                autoComplete="nickname"
                label="Display name"
              />
            ),
            id: "displayName",
          },
        ]}
        formSchema={profileSchema}
        onSubmit={values => {
          toast.success("Profile saved", {
            description: `Nothing was stored - "${values.displayName}" is only here to show application UI between two zones.`,
          });
        }}
      >
        <AutoFormSubmitButton>Save</AutoFormSubmitButton>
      </AutoForm>
    </section>
  );
};

const VIEW_MODE_CHECKS = [
  "before-profile - three blocks, no wrapper: no element around them in the DOM.",
  "after-profile - one area with two blocks in it, one empty area, and one block beside them. The filled area renders a two-column grid; the empty one renders nothing at all, not even a gap.",
  'example:features stored with variant: "list" renders one item per row. Nothing in its data says "list".',
  "example:callout and example:features wrap their text in <BlockField>, and it leaves no trace: no wrapper element around the heading, no contenteditable anywhere in the DOM, exactly the markup those blocks rendered before inline editing existed.",
  'sidebar - wrapped in <aside>, so it carries data-vitnode-zone and a narrower data-vitnode-zone-allowed. The page writes neither: <ContentZone id="sidebar" /> takes both from the page definition around it.',
  "before-footer - empty: no markup at all, and no gap below the sidebar.",
  "Network: one GET /api/vitnode/core/pages/layout?pageId=example:settings, made by the route loader. The zones themselves request nothing.",
  "Until somebody saves, that read answers with the blocks defineEditablePage ships and updatedAt: null. They are real content, not a placeholder - which is why the first Save is allowed to write over them.",
  "Network, JS filter: nothing under /src/editor/ is requested. The @dnd-kit deps you may also see come from the AdminCP dashboard grid on every development route, not from this page.",
];

const EDIT_MODE_CHECKS = [
  "Edit widgets is shown only to a member holding the moderator permission example.widgets/can_edit - or to a root role. Sign out and it is gone, and nothing on the page changes otherwise.",
  "Arrive at /example/zones?edit=true and the page opens in edit mode already - but only if that same permission says so. The URL asks; it never authorizes, and PUT /pages/layout asks the permission again on every save.",
  "The editor chunk is fetched on the first Edit widgets click and never before it. Use Finish editing and click Edit widgets again: the second click fetches nothing.",
  "createContentEditorAdapter is imported normally, not lazily: it belongs to the page definition, not to the editor, and its whole graph is two files with no third-party package in it. A boundary test in this plugin asserts nothing under core's src/editor/ is in this page's eager graph even so.",
  "One sidebar opens on the right and the page is padded, never covered - the zones keep their full width under it. Narrow the window below md and the same sidebar becomes a bottom sheet, with the padding moving underneath the page so the last zone still scrolls clear of it.",
  "before-footer becomes visible only in edit mode, as a large dashed placeholder with its own Add block button. Finish editing and it disappears again.",
  "The empty area in after-profile becomes visible only in edit mode too, as a two-column drop target. Finish editing and it leaves no trace.",
  "Add block on a zone targets it: the sidebar switches to Available Blocks, its header reads For: that zone id, and the zone stays outlined until you clear the target.",
  "A catalog entry is both draggable and clickable. Drag one between two blocks and an insertion line shows exactly where it will land; click one instead and it goes to the targeted zone, or to the first zone that accepts it.",
  "Available Blocks opens with a Layout section above the plugin groups, holding a single Area entry. Click it and an empty area lands in the targeted zone. It is a button, not a drag source - no grab cursor, because an area is not a registered block.",
  "Target a zone from inside an area (Add block on the area) and the header reads For: an area in that zone - and the Layout section disappears, because an area cannot hold another area.",
  "Target the sidebar and the catalog offers core:text alone; clear the target and core:cta, core:hero, example:callout and example:features come back.",
  "Dropping onto a block inserts before or after it, by which half of it the pointer is over. Nothing ever lands inside a block.",
  "Drag a root block into the filled area: it becomes a child of it and the area re-flows. Drag a child back out to the zone root and the area keeps the rest. Reorder two children inside one area and only their order changes.",
  "Drag example:callout over the sidebar: the zone turns red and the drop is refused, from the same allowlist the catalog filters by - and the API refuses it again from the zone's own allowlist, which it reads off the registered page rather than off the request.",
  "Select a block and the same sidebar switches to Properties. Back to Available Blocks clears the selection and returns to the catalog.",
  "Click the heading of the example:callout block in before-profile: a caret lands in the real <h2> and typing changes the page as you type. There is no dialog and no second copy of the text - it is the same heading view mode renders.",
  "Select that block while you do it: the sidebar's Title field holds what you typed, and typing in the sidebar moves the heading on the page. One block.data, two ways into it.",
  "Enter in the callout's title finishes the edit, because title is a field.text. Enter in its body inserts a newline and keeps it, because body is a field.textarea. Paste two lines into the title and they arrive as one line.",
  "Paste <strong>Hello</strong> into the callout body: it stores Hello. Blocks hold plain text, and the Tiptap editor that ships in this repo is deliberately nowhere near them.",
  "Escape while editing the heading reverts that field alone. The body you edited a moment before, the block you moved and the area you re-laid out all stay exactly as they were, and the footer still says Unsaved changes.",
  "Nothing is written on blur. Click away from the heading and the footer still says Unsaved changes - only Save sends anything, and the zones the save answers with rebase the text on the page and in the sidebar together.",
  "Empty the callout title completely and a placeholder reading Add title takes its place - drawn, never stored. That title is required, so the editor also says the text does not fit the field yet and Save stays blocked until you put something back. Empty the body of a nullable field instead and Save is perfectly happy with the empty string.",
  "example:features exposes heading and intro inline and nothing else. Its three feature groups stay in the properties panel, because a group is not an inline field - and a <BlockField> naming a field the block does not declare warns in development rather than writing the wrong value.",
  "Blocks inside the filled area in after-profile edit the same way, through their own zone, area and node: click a heading in there and only that block's data changes.",
  "Dragging still starts at the drag handle. Press and drag across the heading text and you select text - the block is never picked up.",
  "Preview turns inline editing off entirely: the heading stops taking a caret, no placeholder is drawn, and the block's own links work again. Back to editing returns it with every word you typed.",
  "Select the example:features block: a Variant control sits above its fields. Switch grid, list and compact and the page re-renders instantly while every word in the fields stays exactly as it was, and the block keeps its id.",
  "Select an area and the sidebar shows Area properties instead: Columns, Gap, Alignment and Distribution, then Duplicate area, Ungroup and Delete area. Each control re-lays the area out as you pick it.",
  "Ungroup keeps the children and drops them into the zone at the area's own position. Delete area on a non-empty area asks first, and the same dialog offers Ungroup, keep blocks. Delete an empty area and it says so instead of counting blocks.",
  "Every block sits in an inert container, so a block's own links and buttons cannot be clicked or tabbed to. Preview gives them back and collapses the sidebar to a slim bar with Back to editing and Finish editing.",
  "The profile form is application code: no overlay, no drag handle, and its input still takes focus while edit mode is on.",
  "Save sends { pageId, zones, expectedZones } to PUT /api/vitnode/core/pages/layout with only the zones that changed, and answers with the blocks those zones now hold. Open Last save payload and read it. Finish editing and view mode already shows the result - no reload. Reload anyway and the areas, their children and the variant you picked all come back exactly as you left them.",
  "expectedZones is what each of those zones held when the editor opened. The API compares it with what is stored right now, under the same lock it writes in: equal and the save lands, different and it answers 409 and writes nothing, so a stale tab cannot wipe out somebody else's rearrangement. Two people editing different zones of this page both still succeed.",
  "Open this page in two tabs, rearrange the same zone in both, and save the second one: it is refused, the toast says the page moved, and the editor keeps every block you arranged so you can reload and redo it. Change different zones in the two tabs instead and both saves land.",
  'The "Last rearranged" line under the title reads the updatedAt the save answered with, so it moves the moment a save lands - no reload.',
  "Network, on Save: one request. Edit one zone and the body carries that zone alone - the three zones you did not touch are not in it, and the API merges it into this page's one stored row, so they keep whatever they had.",
  "A zone holding a value that is not a block shows it as an unreadable entry it refuses to drop, and Save stays disabled until you remove that entry yourself.",
  "Take the sidebar zone off the page while the editor is open: it leaves the editor too, and its Add block target and selection clear. A Save afterwards never mentions it, so whatever was stored for it stays stored - a zone the page no longer declares is ignored when rendering, never deleted. If you had edited it first, the footer says so instead of dropping the change quietly.",
  "Nothing on the page remounts when edit mode turns on: the local counter and the display name you typed both survive Edit widgets and Finish editing.",
];

const Checklist = ({
  heading,
  id,
  items,
}: {
  heading: string;
  id: string;
  items: readonly string[];
}) => (
  <section
    aria-labelledby={id}
    className="bg-muted/40 flex flex-col gap-2 rounded-lg p-4 text-sm"
  >
    <h2 className="font-semibold" id={id}>
      {heading}
    </h2>
    <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-5 leading-relaxed">
      {items.map(item => (
        <li className="text-pretty" key={item}>
          {item}
        </li>
      ))}
    </ul>
  </section>
);

const SavedPayload = ({ body }: { body: EditablePageSavePayload }) => {
  const changed = Object.keys(body.zones);

  return (
    <details className="border-border rounded-lg border p-4 text-sm">
      <summary className="cursor-pointer font-semibold">
        {changed.length === 1
          ? "Last save payload - 1 changed zone"
          : `Last save payload - ${changed.length} changed zones`}
      </summary>

      <div className="flex flex-col gap-2 pt-3">
        <p className="text-muted-foreground leading-relaxed text-pretty">
          Exactly what went to <code>PUT /pages/layout</code>. The page maps
          nothing: it names its own page id, the server looks that id up in the
          pages it has registered, and every block is re-validated against the
          zone&apos;s own allowlist before anything is stored.{" "}
          <code>expectedZones</code> holds the same zones as they were when the
          editor opened, so the server can refuse a save that would write over
          somebody else&apos;s.
        </p>
        <pre className="bg-muted/40 overflow-x-auto rounded-md p-3 text-xs leading-relaxed">
          {JSON.stringify(body, null, 2)}
        </pre>
      </div>
    </details>
  );
};

const SettingsScreen = ({
  canEdit,
  loadedLayout,
  openEditing,
}: {
  canEdit: boolean;
  loadedLayout: EditablePageLayoutPayload;
  openEditing: boolean;
}) => {
  const [editing, setEditing] = useState(canEdit && openEditing);
  const [showSidebar, setShowSidebar] = useState(true);
  const [layout, setLayout] = useState(loadedLayout);
  const [lastSave, setLastSave] = useState<EditablePageSavePayload | null>(
    null,
  );

  const adapter = useMemo(
    () =>
      createContentEditorAdapter({
        page: settingsPage,
        save: async payload => {
          const response = await fetcher({
            plugin: "@vitnode/core",
            method: "put",
            module: "pages",
            path: "/layout",
            args: { body: payload },
          });

          if (!response.ok) {
            throw new EditablePageSaveRefused(await serverRefusal(response), {
              conflict: response.status === 409,
              pageId: settingsPage.id,
            });
          }

          const stored = zodLayout.parse(await response.json());

          setLastSave(payload);
          setLayout(current => ({
            ...stored,
            zones: { ...current.zones, ...stored.zones },
          }));

          return stored;
        },
      }),
    [],
  );

  return (
    <EditablePage
      adapter={adapter}
      canEdit={canEdit}
      editing={editing}
      layout={layout}
      onExit={() => {
        setEditing(false);
      }}
      page={settingsPage}
    >
      <main className="container mx-auto flex max-w-3xl flex-col gap-6 p-4">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-balance">
              Settings
            </h1>
            <p className="text-muted-foreground leading-relaxed text-pretty">
              An ordinary application page that happens to be editable. Four
              zones sit around a locked profile form, and their blocks come from
              the route loader, so the zones themselves make no request.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {layout.updatedAt === null
                ? "Nobody has rearranged this page yet, so these are the widgets it ships with."
                : `Last rearranged ${new Date(layout.updatedAt).toLocaleString()}.`}
            </p>
          </div>

          {canEdit && !editing ? (
            <Button
              className="md:shrink-0"
              onClick={() => {
                setEditing(true);
              }}
              variant="outline"
            >
              Edit widgets
            </Button>
          ) : null}
        </header>

        <Checklist
          heading="What to look for in DevTools"
          id="view-checks-heading"
          items={VIEW_MODE_CHECKS}
        />

        <Checklist
          heading="What to look for once you click Edit widgets"
          id="edit-checks-heading"
          items={EDIT_MODE_CHECKS}
        />

        <Button
          className="self-start"
          onClick={() => {
            setShowSidebar(shown => !shown);
          }}
          size="sm"
          variant="outline"
        >
          {showSidebar
            ? "Take the sidebar zone off the page"
            : "Put the sidebar zone back"}
        </Button>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex flex-1 flex-col gap-6">
            <ContentZone
              id={EXAMPLE_ZONE_IDS.beforeProfile}
              registry={blocksRegistry}
            />

            <ProfileForm />

            <ContentZone
              id={EXAMPLE_ZONE_IDS.afterProfile}
              registry={blocksRegistry}
            />
          </div>

          {showSidebar ? (
            <ContentZone
              as="aside"
              className="border-border w-full rounded-lg border p-4 lg:w-64"
              id={EXAMPLE_ZONE_IDS.sidebar}
              registry={blocksRegistry}
            />
          ) : null}
        </div>

        <ContentZone
          id={EXAMPLE_ZONE_IDS.beforeFooter}
          registry={blocksRegistry}
        />

        {lastSave ? <SavedPayload body={lastSave} /> : null}
      </main>
    </EditablePage>
  );
};

const ZonesPage = ({
  loaderData,
  search,
}: PluginRoutePageProps<ZonesPageData, ZonesSearch>) => (
  <SettingsScreen
    canEdit={loaderData.canEdit}
    loadedLayout={loaderData.layout}
    openEditing={search.edit === true}
  />
);

export default ZonesPage;
