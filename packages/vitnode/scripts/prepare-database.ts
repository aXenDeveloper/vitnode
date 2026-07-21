/* eslint-disable no-console */
import { count } from "drizzle-orm";

import { core_admin_permissions } from "@/database/admins.js";
import { core_languages, core_languages_words } from "@/database/languages.js";
import { core_moderators_permissions } from "@/database/moderators.js";
import { core_roles } from "@/database/roles.js";

import { getConfig } from "./get-config.js";
import { preparePluginsFiles } from "./prepare-plugins-files.js";
import { runInteractiveShellCommand } from "./run-interactive-shell-command.js";

export const generateDatabaseMigrations = async () => {
  try {
    await runInteractiveShellCommand("npm", ["run", "drizzle-kit", "up"]);
    await runInteractiveShellCommand("npm", ["run", "drizzle-kit", "generate"]);
  } catch (err) {
    console.error("\x1b[31m%s\x1b[0m", err);
    process.exit(1);
  }
};

export const runMigrations = async () => {
  try {
    await runInteractiveShellCommand("npm", ["run", "drizzle-kit", "migrate"]);
  } catch (err) {
    console.error("\x1b[31m%s\x1b[0m", err);
    process.exit(1);
  }
};

export const initialDataForDatabase = async () => {
  const config = await getConfig({ type: "api.config" });
  const dbClient = config.dbProvider;
  const webConfig = await getConfig({ type: "config", optional: true });

  const [roleCount] = await dbClient
    .select({
      count: count(),
    })
    .from(core_roles)
    .limit(1);

  const languages = webConfig?.i18n?.locales?.length
    ? webConfig.i18n.locales.map(locale => ({
        code: locale.code,
        name: locale.name,
        default: locale.code === webConfig.i18n.defaultLocale,
        protected: locale.code === webConfig.i18n.defaultLocale,
        timezone: webConfig.i18n.timeZone ?? "UTC",
      }))
    : [
        {
          code: "en",
          name: "English (USA)",
          default: true,
          protected: true,
          timezone: "America/New_York",
        },
      ];

  await dbClient
    .insert(core_languages)
    .values(languages)
    .onConflictDoNothing({ target: core_languages.code });

  if (roleCount.count === 0) {
    const roles = await dbClient
      .insert(core_roles)
      .values([
        {
          // Guest role
          protected: true,
          guest: true,
        },
        {
          // Member role
          protected: true,
          default: true,
        },
        {
          // Moderator role
          protected: true,
          color: "hsl(122, 80%, 45%)",
        },
        {
          // Administrator role
          protected: true,
          root: true,
          color: "hsl(0, 100%, 50%)",
        },
      ])
      .returning({ id: core_roles.id });

    await dbClient.insert(core_languages_words).values([
      {
        // Guest role
        languageCode: "en",
        pluginCode: "core",
        itemId: roles[0].id,
        value: "Guest",
        tableName: "core_roles",
        variable: "name",
      },
      {
        // Member role
        languageCode: "en",
        pluginCode: "core",
        itemId: roles[1].id,
        value: "Member",
        tableName: "core_roles",
        variable: "name",
      },
      {
        // Moderator role
        languageCode: "en",
        pluginCode: "core",
        itemId: roles[2].id,
        value: "Moderator",
        tableName: "core_roles",
        variable: "name",
      },
      {
        // Administrator role
        languageCode: "en",
        pluginCode: "core",
        itemId: roles[3].id,
        value: "Administrator",
        tableName: "core_roles",
        variable: "name",
      },
    ]);

    // Insert default permissions
    await dbClient.insert(core_moderators_permissions).values([
      {
        roleId: roles[2].id,
        protected: true,
        unrestricted: true,
      },
      {
        roleId: roles[3].id,
        protected: true,
        unrestricted: true,
      },
    ]);

    // Insert default admin permissions
    await dbClient.insert(core_admin_permissions).values({
      roleId: roles[3].id,
      protected: true,
      unrestricted: true,
    });
  }
};

export const prepareDatabase = async ({
  initMessage,
  flag,
}: {
  flag: string;
  initMessage: string;
}) => {
  const steps: { action: () => Promise<void>; label: string }[] = [];

  if (flag === "--web") {
    steps.push({
      label: "Prepare plugins files...",
      action: async () => await preparePluginsFiles(flag),
    });
  } else if (flag === "--api") {
    steps.push(
      {
        label: "Prepare plugins files...",
        action: async () => await preparePluginsFiles(flag),
      },
      {
        label: "Generate migrations...",
        action: generateDatabaseMigrations,
      },
      {
        label: "Run migrations...",
        action: runMigrations,
      },
      {
        label: "Insert initial data...",
        action: initialDataForDatabase,
      },
    );
  } else {
    steps.push(
      {
        label: "Prepare plugins files...",
        action: async () => await preparePluginsFiles(flag),
      },
      {
        label: "Generate migrations...",
        action: generateDatabaseMigrations,
      },
      {
        label: "Run migrations...",
        action: runMigrations,
      },
      {
        label: "Insert initial data...",
        action: initialDataForDatabase,
      },
    );
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepNum = `[${i + 1}/${steps.length}]`;

    if (step.label === "Insert initial data...") {
      console.log(`\n${initMessage} ${stepNum} ${step.label}`);
    } else {
      console.log(`${initMessage} ${stepNum} ${step.label}`);
    }

    await step.action();
  }

  console.log(`${initMessage} \x1b[32mInitial setup completed.\x1b[0m`);
  process.exit(0);
};
