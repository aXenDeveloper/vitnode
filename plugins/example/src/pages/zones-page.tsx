import type { AnyBlockInstance } from "@vitnode/core/blocks";

import { createBlockRegistry } from "@vitnode/core/blocks";
import { blocks as coreBlocks } from "@vitnode/core/blocks/built-in";
import { ContentZone } from "@vitnode/core/blocks/zone";
import {
  AutoForm,
  AutoFormSubmitButton,
} from "@vitnode/core/components/form/auto-form";
import { AutoFormInput } from "@vitnode/core/components/form/fields/input";
import {
  definePluginRoute,
  type PluginRoutePageProps,
} from "@vitnode/core/routing";
import { toast } from "sonner";
import { z } from "zod";

import { blocks as exampleBlocks } from "@/blocks";
import {
  PAGE_BLOCKS_ALLOWED,
  PAGE_SIDEBAR_BLOCKS_ALLOWED,
} from "@/content/page-blocks";

const blocksRegistry = createBlockRegistry([coreBlocks, exampleBlocks]);

interface SettingsZones {
  afterProfile: AnyBlockInstance[];
  beforeFooter: AnyBlockInstance[];
  beforeProfile: AnyBlockInstance[];
  sidebar: AnyBlockInstance[];
}

export const route = definePluginRoute<SettingsZones>({
  load: (): SettingsZones => ({
    afterProfile: [
      {
        data: {
          description: "Four zones sit on this page. Two of them wrap nothing.",
          href: "/docs/dev/blocks/content-zones",
          label: "Read the guide",
          title: "Content Zones",
        },
        id: "01JEXAMPLEZONESAFTERCTA01",
        type: "core:cta",
      },
    ],

    beforeFooter: [],

    beforeProfile: [
      {
        data: {
          body: "Everything above and below the profile form is block content an editor will be able to arrange. The form itself is application code and stays locked.",
          title: "This notice lives in a zone",
          tone: "info",
        },
        id: "01JEXAMPLEZONESBEFORE0001",
        type: "example:callout",
      },
      {
        data: {
          body: "This zone holds two blocks, rendered in stored order. It was given no wrapper, so neither of them sits inside an element the zone added.",
          heading: "Two blocks, one zone",
          width: "prose",
        },
        id: "01JEXAMPLEZONESBEFORE0002",
        type: "core:text",
      },
    ],

    sidebar: [
      {
        data: {
          body: "This zone allows core:text and nothing else, while the zones around the form take the same allowlist the page content type declares.",
          heading: "A narrower zone",
          width: "prose",
        },
        id: "01JEXAMPLEZONESSIDEBAR001",
        type: "core:text",
      },
    ],
  }),

  head: () => ({ title: "Content zones" }),
});

const profileSchema = z.object({
  displayName: z.string().min(1).max(60).default("Ada"),
});

const ProfileForm = () => (
  <section
    aria-labelledby="profile-heading"
    className="border-border flex flex-col gap-4 rounded-lg border p-4 md:p-6"
  >
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold text-balance" id="profile-heading">
        Profile
      </h2>
      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        Locked application UI. A zone can sit around it, never inside it.
      </p>
    </div>

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

const CHECKS = [
  "settings:before-profile - two blocks, no wrapper: no element around them in the DOM.",
  "settings:after-profile - one block, no wrapper.",
  "settings:sidebar - wrapped in <aside>, so it carries data-vitnode-zone and a narrower data-vitnode-zone-allowed.",
  "settings:before-footer - empty: no markup at all, and no gap below the sidebar.",
];

const ZonesPage = ({ loaderData }: PluginRoutePageProps<SettingsZones>) => (
  <div className="container mx-auto flex max-w-3xl flex-col gap-6 p-4">
    <header className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold tracking-tight text-balance">
        Settings
      </h1>
      <p className="text-muted-foreground leading-relaxed text-pretty">
        A system page with four content zones. Blocks come from the route
        loader, so the zones themselves make no request.
      </p>
    </header>

    <section
      aria-labelledby="checks-heading"
      className="bg-muted/40 flex flex-col gap-2 rounded-lg p-4 text-sm"
    >
      <h2 className="font-semibold" id="checks-heading">
        What to look for in DevTools
      </h2>
      <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-5 leading-relaxed">
        {CHECKS.map(check => (
          <li className="text-pretty" key={check}>
            {check}
          </li>
        ))}
      </ul>
    </section>

    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <div className="flex flex-1 flex-col gap-6">
        <ContentZone
          allowedBlocks={PAGE_BLOCKS_ALLOWED}
          blocks={loaderData.beforeProfile}
          id="settings:before-profile"
          registry={blocksRegistry}
        />

        <ProfileForm />

        <ContentZone
          allowedBlocks={PAGE_BLOCKS_ALLOWED}
          blocks={loaderData.afterProfile}
          id="settings:after-profile"
          registry={blocksRegistry}
        />
      </div>

      <ContentZone
        allowedBlocks={PAGE_SIDEBAR_BLOCKS_ALLOWED}
        as="aside"
        blocks={loaderData.sidebar}
        className="border-border w-full rounded-lg border p-4 md:w-64"
        id="settings:sidebar"
        registry={blocksRegistry}
      />
    </div>

    <ContentZone
      allowedBlocks={PAGE_BLOCKS_ALLOWED}
      blocks={loaderData.beforeFooter}
      id="settings:before-footer"
      registry={blocksRegistry}
    />
  </div>
);

export default ZonesPage;
