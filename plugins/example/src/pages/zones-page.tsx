import type {
  VisualEditorAdapter,
  VisualEditorSaveInput,
} from "@vitnode/core/editor";

import { createBlockRegistry } from "@vitnode/core/blocks";
import { blocks as coreBlocks } from "@vitnode/core/blocks/built-in";
import { ContentEditorRuntime } from "@vitnode/core/blocks/edit";
import { ContentZone } from "@vitnode/core/blocks/zone";
import {
  AutoForm,
  AutoFormSubmitButton,
} from "@vitnode/core/components/form/auto-form";
import { AutoFormInput } from "@vitnode/core/components/form/fields/input";
import { Button } from "@vitnode/core/components/ui/button";
import {
  definePluginRoute,
  type PluginRoutePageProps,
} from "@vitnode/core/routing";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { blocks as exampleBlocks } from "@/blocks";
import { CONFIG_PLUGIN } from "@/const";
import {
  PAGE_BLOCKS_ALLOWED,
  PAGE_SIDEBAR_BLOCKS_ALLOWED,
} from "@/content/page-blocks";
import {
  DEFAULT_EXAMPLE_ZONES_LAYOUT,
  EXAMPLE_ZONE_IDS,
  toZonesLayout,
  type ZonesLayout,
  zonesToFields,
} from "@/content/zones-layout-fields";

const blocksRegistry = createBlockRegistry([coreBlocks, exampleBlocks]);

export const route = definePluginRoute<ZonesLayout>({
  load: async (): Promise<ZonesLayout> => {
    const response = await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      method: "get",
      module: "zones",
      path: "/layout",
    });

    if (!response.ok) {
      throw new Error(
        `The zones layout route answered ${response.status}, so what is stored is unknown. The shipped defaults are deliberately not offered as editable content here: saving them would overwrite whatever the record really holds.`,
      );
    }

    return toZonesLayout(await response.json());
  },

  head: () => ({ title: "Content zones" }),
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
  "settings:before-profile - three blocks, no wrapper: no element around them in the DOM.",
  "settings:after-profile - one area with two blocks in it, one empty area, and one block beside them. The filled area renders a two-column grid; the empty one renders nothing at all, not even a gap.",
  'example:features is stored with variant: "list", so it renders one item per row. Nothing in its data says "list".',
  "settings:sidebar - wrapped in <aside>, so it carries data-vitnode-zone and a narrower data-vitnode-zone-allowed.",
  "settings:before-footer - empty: no markup at all, and no gap below the sidebar.",
  "Network, JS filter: nothing under /src/editor/ is requested. The @dnd-kit deps you may also see come from the AdminCP dashboard grid on every development route, not from this page.",
];

const EDIT_MODE_CHECKS = [
  "The editor chunk is fetched on the first Edit page click and never before it. Use Finish editing and click Edit page again: the second click fetches nothing.",
  "One sidebar opens on the right and the page is padded, never covered - the zones keep their full width under it. Narrow the window below md and the same sidebar becomes a bottom sheet, with the padding moving underneath the page so the last zone still scrolls clear of it.",
  "settings:before-footer becomes visible only in edit mode, as a large dashed placeholder with its own Add block button. Finish editing and it disappears again.",
  "The empty area in settings:after-profile becomes visible only in edit mode too, as a two-column drop target. Finish editing and it leaves no trace.",
  "Add block on a zone targets it: the sidebar switches to Available Blocks, its header reads For: that zone id, and the zone stays outlined until you clear the target.",
  "A catalog entry is both draggable and clickable. Drag one between two blocks and an insertion line shows exactly where it will land; click one instead and it goes to the targeted zone, or to the first zone that accepts it.",
  "Available Blocks opens with a Layout section above the plugin groups, holding a single Area entry. Click it and an empty area lands in the targeted zone. It is a button, not a drag source - no grab cursor, because an area is not a registered block.",
  "Target a zone from inside an area (Add block on the area) and the header reads For: an area in that zone - and the Layout section disappears, because an area cannot hold another area.",
  "Target settings:sidebar and the catalog offers core:text alone; clear the target and core:cta, core:hero, example:callout and example:features come back.",
  "Dropping onto a block inserts before or after it, by which half of it the pointer is over. Nothing ever lands inside a block.",
  "Drag a root block into the filled area: it becomes a child of it and the area re-flows. Drag a child back out to the zone root and the area keeps the rest. Reorder two children inside one area and only their order changes.",
  "Drag example:callout over settings:sidebar: the zone turns red and the drop is refused, from the same allowlist the catalog filters by - and the API refuses it again from the field's own allowlist.",
  "Select a block and the same sidebar switches to Properties. Back to Available Blocks clears the selection and returns to the catalog.",
  "Select the example:features block: a Variant control sits above its fields. Switch grid, list and compact and the page re-renders instantly while every word in the fields stays exactly as it was, and the block keeps its id.",
  "Select an area and the sidebar shows Area properties instead: Columns, Gap, Alignment and Distribution, then Duplicate area, Ungroup and Delete area. Each control re-lays the area out as you pick it.",
  "Ungroup keeps the children and drops them into the zone at the area's own position. Delete area on a non-empty area asks first, and the same dialog offers Ungroup, keep blocks. Delete an empty area and it says so instead of counting blocks.",
  "Every block sits in an inert container, so a block's own links and buttons cannot be clicked or tabbed to. Preview gives them back and collapses the sidebar to a slim bar with Back to editing and Finish editing.",
  "The profile form is application code: no overlay, no drag handle, and its input still takes focus while edit mode is on.",
  "Save runs this page's adapter from the sidebar footer, which writes the layout to the API and answers with the layout it stored. Finish editing and view mode already shows it - no reload. Reload anyway and the areas, their children and the variant you picked all come back exactly as you left them.",
  "A zone holding a value that is not a block shows it as an unreadable entry it refuses to drop, and Save stays disabled until you remove that entry yourself.",
  "Take the sidebar zone off the page while the editor is open: it leaves the editor too, its Add block target and selection clear, and a Save afterwards keeps whatever was stored for it rather than writing the copy the editor was holding. If you had edited it first, the footer says so instead of dropping the change quietly.",
  "Nothing on the page remounts when edit mode turns on: the local counter and the display name you typed both survive Edit page and Finish editing.",
];

const canEditPage = (): boolean => process.env.NODE_ENV !== "production";

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

const LayoutSource = ({ source, updatedAt }: Omit<ZonesLayout, "zones">) => (
  <p
    className="text-muted-foreground text-sm leading-relaxed text-pretty"
    data-testid="zones-layout-source"
    data-zones-source={source}
  >
    {source === "stored"
      ? `Showing the layout stored on the server${
          updatedAt
            ? `, last saved ${new Date(updatedAt).toLocaleString()}`
            : ""
        }.`
      : "Showing the shipped defaults - nothing has been saved to the server yet."}
  </p>
);

const SavedPayload = ({ input }: { input: VisualEditorSaveInput }) => (
  <details className="border-border rounded-lg border p-4 text-sm">
    <summary className="cursor-pointer font-semibold">
      {input.changedZoneIds.length === 1
        ? "Last save payload - 1 changed zone"
        : `Last save payload - ${input.changedZoneIds.length} changed zones`}
    </summary>

    <div className="flex flex-col gap-2 pt-3">
      <p className="text-muted-foreground leading-relaxed text-pretty">
        Exactly what this page&apos;s <code>VisualEditorAdapter.save</code> was
        handed. The adapter maps each zone id onto the matching field of the{" "}
        <code>example.zones-layout</code> record and sends it to the API, which
        re-validates every block against that field&apos;s own allowlist before
        storing it.
      </p>
      <pre className="bg-muted/40 overflow-x-auto rounded-md p-3 text-xs leading-relaxed">
        {JSON.stringify(input, null, 2)}
      </pre>
    </div>
  </details>
);

const ZonesPage = ({ loaderData }: PluginRoutePageProps<ZonesLayout>) => {
  const [editing, setEditing] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [lastSave, setLastSave] = useState<null | VisualEditorSaveInput>(null);
  const [layout, setLayout] = useState<ZonesLayout>(loaderData);
  const [loaded, setLoaded] = useState<ZonesLayout>(loaderData);

  if (loaded !== loaderData) {
    setLoaded(loaderData);
    setLayout(loaderData);
  }

  const save = useCallback(
    async (input: VisualEditorSaveInput) => {
      const response = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        args: {
          body: zonesToFields(
            input.zones,
            zonesToFields(layout.zones, DEFAULT_EXAMPLE_ZONES_LAYOUT),
          ),
        },
        method: "put",
        module: "admin/zones",
        path: "/layout",
      });

      if (!response.ok) {
        throw new Error(`The zones layout route answered ${response.status}.`);
      }

      const stored = toZonesLayout(await response.json());

      setLayout(stored);
      setLastSave(input);

      return { zones: stored.zones };
    },
    [layout.zones],
  );

  const adapter = useMemo<VisualEditorAdapter>(() => ({ save }), [save]);

  return (
    <ContentEditorRuntime
      adapter={adapter}
      enabled={editing}
      onExit={() => {
        setEditing(false);
      }}
    >
      <div className="container mx-auto flex max-w-3xl flex-col gap-6 p-4">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-balance">
              Settings
            </h1>
            <p className="text-muted-foreground leading-relaxed text-pretty">
              A system page with four content zones. Blocks come from the route
              loader, so the zones themselves make no request.
            </p>
            <LayoutSource source={layout.source} updatedAt={layout.updatedAt} />
          </div>

          {canEditPage() && !editing ? (
            <Button
              className="md:shrink-0"
              onClick={() => {
                setEditing(true);
              }}
              variant="outline"
            >
              Edit page
            </Button>
          ) : null}
        </header>

        <Checklist
          heading="What to look for in DevTools"
          id="view-checks-heading"
          items={VIEW_MODE_CHECKS}
        />

        <Checklist
          heading="What to look for once you click Edit page"
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
              allowedBlocks={PAGE_BLOCKS_ALLOWED}
              blocks={layout.zones[EXAMPLE_ZONE_IDS.beforeProfile]}
              id={EXAMPLE_ZONE_IDS.beforeProfile}
              registry={blocksRegistry}
            />

            <ProfileForm />

            <ContentZone
              allowedBlocks={PAGE_BLOCKS_ALLOWED}
              blocks={layout.zones[EXAMPLE_ZONE_IDS.afterProfile]}
              id={EXAMPLE_ZONE_IDS.afterProfile}
              registry={blocksRegistry}
            />
          </div>

          {showSidebar ? (
            <ContentZone
              allowedBlocks={PAGE_SIDEBAR_BLOCKS_ALLOWED}
              as="aside"
              blocks={layout.zones[EXAMPLE_ZONE_IDS.sidebar]}
              className="border-border w-full rounded-lg border p-4 lg:w-64"
              id={EXAMPLE_ZONE_IDS.sidebar}
              registry={blocksRegistry}
            />
          ) : null}
        </div>

        <ContentZone
          allowedBlocks={PAGE_BLOCKS_ALLOWED}
          blocks={layout.zones[EXAMPLE_ZONE_IDS.beforeFooter]}
          id={EXAMPLE_ZONE_IDS.beforeFooter}
          registry={blocksRegistry}
        />

        {lastSave ? <SavedPayload input={lastSave} /> : null}
      </div>
    </ContentEditorRuntime>
  );
};

export default ZonesPage;
