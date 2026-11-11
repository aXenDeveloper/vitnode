import { z } from "zod";

import { SSO_PROFILE_FIELDS } from "@/lib/sso-profile";
import { manifest } from "@/manifest";

import { defineEvent } from "../lib/event-definition";

const pluginId = manifest.id;

export const userCreatedEvent = defineEvent({
  pluginId,
  name: "user.created",
  payload: z.object({
    email: z.string(),
    emailVerified: z.boolean(),
    name: z.string(),
    userId: z.number().int(),
  }),
});

/**
 * Declared for plugins implementing account deletion - core has no user
 * deletion flow yet and never emits this itself.
 */
export const userDeletedEvent = defineEvent({
  pluginId,
  name: "user.deleted",
  payload: z.object({ email: z.string(), userId: z.number().int() }),
});

export const userUpdatedEvent = defineEvent({
  pluginId,
  name: "user.updated",
  payload: z.object({
    email: z.string(),
    name: z.string(),
    userId: z.number().int(),
  }),
});

export const userEmailVerifiedEvent = defineEvent({
  pluginId,
  name: "user.email.verified",
  payload: z.object({ email: z.string(), userId: z.number().int() }),
});

export const userPasswordUpdatedEvent = defineEvent({
  pluginId,
  name: "user.password.updated",
  payload: z.object({ userId: z.number().int() }),
});

export const userAvatarUpdatedEvent = defineEvent({
  pluginId,
  name: "user.avatar.updated",
  payload: z.object({
    fileId: z.number().int().nullable(),
    userId: z.number().int(),
  }),
});

export const userCoverUpdatedEvent = defineEvent({
  pluginId,
  name: "user.cover.updated",
  payload: z.object({
    fileId: z.number().int().nullable(),
    userId: z.number().int(),
  }),
});

export const userSessionsRevokedEvent = defineEvent({
  pluginId,
  name: "user.sessions.revoked",
  payload: z.object({
    deviceId: z.number().int().nullable(),
    sessions: z.number().int(),
    userId: z.number().int(),
  }),
});

export const userPasskeyCreatedEvent = defineEvent({
  pluginId,
  name: "user.passkey.created",
  payload: z.object({
    passkeyId: z.number().int(),
    userId: z.number().int(),
  }),
});

export const userPasskeyUpdatedEvent = defineEvent({
  pluginId,
  name: "user.passkey.updated",
  payload: z.object({
    name: z.string(),
    passkeyId: z.number().int(),
    userId: z.number().int(),
  }),
});

export const userPasskeyDeletedEvent = defineEvent({
  pluginId,
  name: "user.passkey.deleted",
  payload: z.object({
    passkeyId: z.number().int(),
    userId: z.number().int(),
  }),
});

export const userSsoLinkedEvent = defineEvent({
  pluginId,
  name: "user.sso.linked",
  payload: z.object({
    email: z.string(),
    providerId: z.string(),
    userId: z.number().int(),
  }),
});

export const userSsoUnlinkedEvent = defineEvent({
  pluginId,
  name: "user.sso.unlinked",
  payload: z.object({ providerId: z.string(), userId: z.number().int() }),
});

export const userSsoPreferencesUpdatedEvent = defineEvent({
  pluginId,
  name: "user.sso.preferences_updated",
  payload: z.object({
    sources: z.partialRecord(z.enum(SSO_PROFILE_FIELDS), z.string().nullable()),
    sync: z.record(z.string(), z.boolean()),
    userId: z.number().int(),
  }),
});

export const userSsoProfileSyncedEvent = defineEvent({
  pluginId,
  name: "user.sso.profile_synced",
  payload: z.object({
    fields: z.array(z.enum(SSO_PROFILE_FIELDS)),
    providerId: z.string(),
    trigger: z.enum(["import", "sign_in", "sync"]),
    userId: z.number().int(),
  }),
});

/** Every `user.*` event core defines. */
export const userEventDefinitions = [
  userCreatedEvent,
  userDeletedEvent,
  userUpdatedEvent,
  userEmailVerifiedEvent,
  userPasswordUpdatedEvent,
  userAvatarUpdatedEvent,
  userCoverUpdatedEvent,
  userSessionsRevokedEvent,
  userPasskeyCreatedEvent,
  userPasskeyUpdatedEvent,
  userPasskeyDeletedEvent,
  userSsoLinkedEvent,
  userSsoUnlinkedEvent,
  userSsoPreferencesUpdatedEvent,
  userSsoProfileSyncedEvent,
];
