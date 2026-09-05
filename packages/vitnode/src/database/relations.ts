import { defineRelations } from "drizzle-orm";

import * as admins from "./admins";
import * as content from "./content";
import * as cron from "./cron";
import * as dashboard from "./dashboard";
import * as files from "./files";
import * as languages from "./languages";
import * as logs from "./logs";
import * as moderators from "./moderators";
import * as queue from "./queue";
import * as roles from "./roles";
import * as search from "./search";
import * as secrets from "./secrets";
import * as sessions from "./sessions";
import * as users from "./users";

export const coreSchema = {
  ...admins,
  ...content,
  ...cron,
  ...dashboard,
  ...files,
  ...languages,
  ...logs,
  ...moderators,
  ...queue,
  ...roles,
  ...search,
  ...secrets,
  ...sessions,
  ...users,
};

export const coreRelations = defineRelations(coreSchema, r => ({
  core_users: {
    group: r.one.core_roles({
      from: r.core_users.roleId,
      to: r.core_roles.id,
    }),
    // `language_ref`, not `language`: that name is already the foreign key
    // column on this table, and Relational Queries v2 puts relations and
    // columns in one namespace, so reusing it is an error rather than a shadow.
    language_ref: r.one.core_languages({
      from: r.core_users.language,
      to: r.core_languages.code,
    }),
    secondary_roles: r.many.core_users_secondary_roles(),
    sso: r.many.core_users_sso(),
    confirm_email: r.one.core_users_confirm_emails(),
    forgot_password: r.one.core_users_forgot_password(),
  },

  core_users_secondary_roles: {
    user: r.one.core_users({
      from: r.core_users_secondary_roles.userId,
      to: r.core_users.id,
    }),
    role: r.one.core_roles({
      from: r.core_users_secondary_roles.roleId,
      to: r.core_roles.id,
    }),
  },

  core_users_sso: {
    user: r.one.core_users({
      from: r.core_users_sso.userId,
      to: r.core_users.id,
    }),
  },

  core_users_confirm_emails: {
    user: r.one.core_users({
      from: r.core_users_confirm_emails.userId,
      to: r.core_users.id,
    }),
  },

  core_users_forgot_password: {
    user: r.one.core_users({
      from: r.core_users_forgot_password.userId,
      to: r.core_users.id,
    }),
  },

  core_languages_words: {
    language: r.one.core_languages({
      from: r.core_languages_words.languageCode,
      to: r.core_languages.code,
    }),
  },

  core_moderators_permissions: {
    group: r.one.core_roles({
      from: r.core_moderators_permissions.roleId,
      to: r.core_roles.id,
    }),
    user: r.one.core_users({
      from: r.core_moderators_permissions.userId,
      to: r.core_users.id,
    }),
  },

  core_admin_permissions: {
    group: r.one.core_roles({
      from: r.core_admin_permissions.roleId,
      to: r.core_roles.id,
    }),
    user: r.one.core_users({
      from: r.core_admin_permissions.userId,
      to: r.core_users.id,
    }),
  },

  core_admin_dashboard: {
    user: r.one.core_users({
      from: r.core_admin_dashboard.userId,
      to: r.core_users.id,
    }),
  },

  core_admin_sessions: {
    user: r.one.core_users({
      from: r.core_admin_sessions.userId,
      to: r.core_users.id,
    }),
    device: r.one.core_sessions_known_devices({
      from: r.core_admin_sessions.deviceId,
      to: r.core_sessions_known_devices.id,
    }),
  },

  core_sessions: {
    user: r.one.core_users({
      from: r.core_sessions.userId,
      to: r.core_users.id,
    }),
    // Aliased on both sides: `core_sessions` and `core_sessions_known_devices`
    // are joined twice over, once per direction, and Drizzle needs the name to
    // tell the two apart.
    device: r.one.core_sessions_known_devices({
      alias: "session_device",
      from: r.core_sessions.deviceId,
      to: r.core_sessions_known_devices.id,
    }),
  },

  core_sessions_known_devices: {
    session: r.one.core_sessions({
      alias: "device_session",
      from: r.core_sessions_known_devices.id,
      to: r.core_sessions.deviceId,
    }),
  },

  core_files: {
    user: r.one.core_users({
      from: r.core_files.userId,
      to: r.core_users.id,
    }),
  },
}));
